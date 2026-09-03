/* مسارات المصادقة — تسجيل، دخول، خروج، استعادة كلمة مرور، هوية، إيقاف ذاتي */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AuthService } from '../../services/auth.service'
import { SESSION_COOKIE, requireAuth } from '../auth-plugin'
import { sendPasswordResetEmail, sendVerifyEmail } from '../../services/account-mail'
import { getPrisma } from '../../db/client'

const email = z.string().trim().toLowerCase().email('صيغة البريد غير صحيحة')
const password = z.string().min(8, 'كلمة المرور 8 أحرف على الأقل')

export function registerAuthRoutes(app: FastifyInstance, auth: AuthService) {
  app.post('/api/auth/register', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
    schema: {
      tags: ['auth'], summary: 'إنشاء حساب متعلم',
      body: {
        type: 'object', required: ['email', 'password'],
        properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 }, displayName: { type: 'string' } },
      },
    },
  }, async (req, reply) => {
    const body = z.object({ email, password, displayName: z.string().trim().max(80).optional() }).parse(req.body)
    const { userId } = await auth.register(body.email, body.password, body.displayName ?? '')
    /* رابط التوثيق يُرسل مع الإنشاء لا بعده بخطوة يدوية — ولا يُسقط التسجيل
       عند تعذّر الإرسال: الحساب أُنشئ فعلا، وردٌّ بخطأ يجعل المستخدم يظنّ أنه
       لم يُنشأ فيعيد المحاولة فيصطدم بـ«هذا البريد مسجل». */
    const issued = await auth.issueEmailVerification(userId)
    const mail = issued ? await sendVerifyEmail(await getPrisma(), { to: issued.email, displayName: issued.displayName, token: issued.token }) : null
    return reply.status(201).send({
      userId,
      message: 'أنشئ الحساب — يمكنك تسجيل الدخول الآن',
      verificationSent: mail?.status === 'sent',
    })
  })

  app.post('/api/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
    schema: {
      tags: ['auth'], summary: 'تسجيل الدخول — كوكي جلسة httpOnly',
      body: {
        type: 'object', required: ['email', 'password'],
        properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
      },
    },
  }, async (req, reply) => {
    const body = z.object({ email, password: z.string() }).parse(req.body)
    const { token, expiresAt } = await auth.login(body.email, body.password, req.ip, req.headers['user-agent'])
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: 'lax', path: '/', expires: expiresAt,
      secure: process.env.NODE_ENV === 'production',
    })
    const ctx = await auth.resolve(token)
    return { user: ctx, expiresAt }
  })

  app.post('/api/auth/logout', { schema: { tags: ['auth'], summary: 'الخروج من الجلسة الحالية' } }, async (req, reply) => {
    if (req.sessionToken) await auth.logout(req.sessionToken)
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return { ok: true }
  })

  app.post('/api/auth/logout-all', { preHandler: requireAuth, schema: { tags: ['auth'], summary: 'الخروج من جميع الأجهزة' } }, async (req) => {
    const count = await auth.logoutAll(req.auth!.userId)
    return { ok: true, revoked: count }
  })

  app.post('/api/auth/password/forgot', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    schema: {
      tags: ['auth'], summary: 'طلب استعادة كلمة المرور — الرد لا يكشف وجود البريد',
      body: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
    },
  }, async (req) => {
    const body = z.object({ email }).parse(req.body)
    const { tokenForDelivery } = await auth.requestPasswordReset(body.email)
    /* كان الرمز يُولَّد ثم يُسقَط: يُعاد في التطوير وحده، ولا يُرسَل في الإنتاج
       أبدا — والردّ مع ذلك يقول «ستصلك رسالة». فمن نسي كلمته على الموقع الحيّ
       لم يكن له سبيل. الإرسال هنا هو الإصلاح، والنصّ في account-mail.ts. */
    if (tokenForDelivery) {
      await sendPasswordResetEmail(await getPrisma(), { to: body.email, token: tokenForDelivery })
    }
    /* الردّ واحد سواء وُجد البريد أم لا وسواء نجح الإرسال أم لا: تفريقُه يكشف
       من له حساب عندنا لمن يجرّب العناوين. */
    return {
      message: 'إن كان البريد مسجلا فستصله رسالة استعادة',
      ...(process.env.NODE_ENV !== 'production' ? { devToken: tokenForDelivery } : {}),
    }
  })

  app.post('/api/auth/password/reset', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    schema: {
      tags: ['auth'], summary: 'تعيين كلمة مرور جديدة برمز الاستعادة — يبطل كل الجلسات',
      body: {
        type: 'object', required: ['token', 'newPassword'],
        properties: { token: { type: 'string' }, newPassword: { type: 'string', minLength: 8 } },
      },
    },
  }, async (req) => {
    const body = z.object({ token: z.string().min(10), newPassword: password }).parse(req.body)
    await auth.resetPassword(body.token, body.newPassword)
    return { ok: true, message: 'عُيّنت كلمة المرور — سجّل الدخول من جديد' }
  })

  app.post('/api/auth/email/verify/request', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    schema: { tags: ['auth'], summary: 'إعادة إرسال رابط توثيق البريد' },
  }, async (req) => {
    const issued = await auth.issueEmailVerification(req.auth!.userId)
    if (!issued) return { status: 'already_verified', message: 'بريدك موثَّق أصلا' }
    const mail = await sendVerifyEmail(await getPrisma(), { to: issued.email, displayName: issued.displayName, token: issued.token })
    /* الحالة تُعاد كما هي: «not_configured» تعني أن قناة البريد لم تُفعَّل بعد،
       وقولُ «أُرسل» حينها يجعل المستخدم ينتظر رسالة لا وجود لها. */
    if (mail.status === 'sent') return { status: 'sent', message: `أُرسل رابط التوثيق إلى ${issued.email}` }
    if (mail.status === 'not_configured') {
      return { status: 'not_configured', message: 'قناة البريد غير مفعّلة بعد — تواصل مع الأكاديمية لتوثيق بريدك' }
    }
    return { status: 'failed', message: 'تعذّر إرسال الرسالة الآن — أعد المحاولة بعد قليل' }
  })

  app.post('/api/auth/email/verify', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    schema: {
      tags: ['auth'], summary: 'توثيق البريد برمز الرابط',
      body: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
    },
  }, async (req) => {
    const body = z.object({ token: z.string().min(10) }).parse(req.body)
    const { alreadyVerified } = await auth.verifyEmail(body.token)
    return { ok: true, alreadyVerified, message: alreadyVerified ? 'بريدك موثَّق أصلا' : 'وُثّق بريدك — الشراء والشهادة مفتوحان الآن' }
  })

  /* حارسُ كلّ بوّابةٍ في الواجهة ينادي هذا المسار عند كلّ انتقال، فوقوعُه
     تحت السقف العامّ (٣٠٠/دقيقة لكلّ عنوان) يعني أنّ مكتبا أو قاعةً بعنوانٍ
     واحدٍ تُطفئ الصلاحيّاتَ على نفسها: يرى المستخدم «تعذّر التحقّق من
     صلاحيّاتك» وهو داخلٌ فعلا (شُوهد في جولة ٢٠٢٦-٠٩: ٤٤ ردَّ 429، تسعةَ
     عشرَ منها على هذا المسار). فله سقفُه: واسعٌ لأنّه قراءةُ جلسةٍ قائمة،
     ومحدودٌ لأنّه ليس مفتوحا. */
  app.get('/api/auth/me', {
    config: { rateLimit: { max: 3000, timeWindow: '1 minute' } },
    schema: { tags: ['auth'], summary: 'هوية الجلسة الحالية وصلاحياتها' },
  }, async (req) => {
    return { user: req.auth }
  })

  app.post('/api/auth/deactivate', { preHandler: requireAuth, schema: { tags: ['auth'], summary: 'إيقاف الحساب ذاتيا — يبطل الجلسات فورا' } }, async (req, reply) => {
    await auth.suspend(req.auth!.userId)
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return { ok: true }
  })
}
