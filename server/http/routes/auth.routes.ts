/* مسارات المصادقة — تسجيل، دخول، خروج، استعادة كلمة مرور، هوية، إيقاف ذاتي */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AuthService } from '../../services/auth.service'
import { SESSION_COOKIE, requireAuth } from '../auth-plugin'

const email = z.string().trim().toLowerCase().email('صيغة البريد غير صحيحة')
const password = z.string().min(8, 'كلمة المرور 8 أحرف على الأقل')

export function registerAuthRoutes(app: FastifyInstance, auth: AuthService) {
  app.post('/api/auth/register', {
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
    return reply.status(201).send({ userId, message: 'أنشئ الحساب — يمكنك تسجيل الدخول الآن' })
  })

  app.post('/api/auth/login', {
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
    schema: {
      tags: ['auth'], summary: 'طلب استعادة كلمة المرور — الرد لا يكشف وجود البريد',
      body: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
    },
  }, async (req) => {
    const body = z.object({ email }).parse(req.body)
    const { tokenForDelivery } = await auth.requestPasswordReset(body.email)
    /* مرحلة التأسيس: لا قناة بريد بعد — يُعاد الرمز في وضع التطوير فقط لتسهيل الفحص */
    return {
      message: 'إن كان البريد مسجلا فستصله رسالة استعادة',
      ...(process.env.NODE_ENV !== 'production' ? { devToken: tokenForDelivery } : {}),
    }
  })

  app.post('/api/auth/password/reset', {
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

  app.get('/api/auth/me', { schema: { tags: ['auth'], summary: 'هوية الجلسة الحالية وصلاحياتها' } }, async (req) => {
    return { user: req.auth }
  })

  app.post('/api/auth/deactivate', { preHandler: requireAuth, schema: { tags: ['auth'], summary: 'إيقاف الحساب ذاتيا — يبطل الجلسات فورا' } }, async (req, reply) => {
    await auth.suspend(req.auth!.userId)
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return { ok: true }
  })
}
