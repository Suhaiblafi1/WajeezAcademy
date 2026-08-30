/* مسارات الديمو — تبديل الأدوار لبيئة العرض المحلية فقط.

   هذا المسار يُصدر جلسةً بلا كلمة مرور لأيّ حسابِ ديمو، ومنها حساب
   `super_admin`. فمن يصل إليه على شبكةٍ عامّة يصير مدير نظامٍ بطلبٍ واحد.

   وكانت الحماية طبقتين، كلتاهما تنتهيان إلى الشرط نفسه: «لا يُضبط
   DEMO_MODE في الإنتاج». وهذا ليس حراسةً — هو أمنيّة. ضُبط العلم على
   Production في ٢٤ آب فبقيت البوّابة مفتوحةً على الإنترنت ستّة أيّام،
   والتعليق فوقها يقول «مستحيل في الإنتاج».

   فالطبقة الثالثة لا تسأل عن العلم أصلا: نشرٌ إنتاجيّ = لا ديمو، مهما
   ضُبط ومن ضبطه. وثمنُها أنّ عرضا محلّيا بـNODE_ENV=production يفقد
   مبدّل الأدوار — وهو ثمنٌ يُدفع، لأنّ الخطأ في الاتّجاه الآخر يُسلّم
   المنصّة. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AuthService } from '../../services/auth.service'
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoRoleKey } from '../../db/seed-demo'
import { SESSION_COOKIE } from '../auth-plugin'

/** نشرٌ إنتاجيّ؟ VERCEL_ENV تحقنه المنصّة، وNODE_ENV يغطّي الاستضافة الذاتية */
const productionDeployment = () =>
  process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'

/** الديمو مفعّل: علمٌ مضبوط **و** ليس نشرا إنتاجيّا. الشرطان معا لا أحدهما. */
const demoEnabled = () => process.env.DEMO_MODE === 'true' && !productionDeployment()

export function registerDemoRoutes(app: FastifyInstance, auth: AuthService) {
  /* حالة الديمو — تُسجَّل دائما لتخبر الواجهة هل تُظهر مبدل الأدوار */
  app.get('/api/demo/status', {
    schema: { tags: ['demo'], summary: 'هل وضع الديمو مفعّل على هذا الخادم' },
  }, async () => ({ enabled: demoEnabled() }))

  app.post('/api/demo/switch-role', {
    schema: {
      tags: ['demo'], summary: 'تبديل الدور لحساب ديمو — بيئة محلية فقط',
      body: {
        type: 'object', required: ['role'],
        properties: { role: { type: 'string', enum: DEMO_ACCOUNTS.map((a) => a.key) } },
      },
    },
  }, async (req, reply) => {
    if (!demoEnabled()) return reply.callNotFound() // غير موجود خارج وضع الديمو

    const { role } = z.object({ role: z.enum(DEMO_ACCOUNTS.map((a) => a.key) as [DemoRoleKey, ...DemoRoleKey[]]) }).parse(req.body)
    const account = DEMO_ACCOUNTS.find((a) => a.key === role)!

    try {
      const { token, expiresAt } = await auth.login(account.email, DEMO_PASSWORD, req.ip, req.headers['user-agent'])
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true, sameSite: 'lax', path: '/', expires: expiresAt,
        secure: false, // وضع الديمو محلي حصرا — لا https
      })
      const ctx = await auth.resolve(token)
      return { user: ctx, role: account.key }
    } catch {
      return reply.status(409).send({
        error: { code: 'demo_not_seeded', message_ar: 'حسابات الديمو غير مزروعة — نفّذ: npm run seed:demo' },
      })
    }
  })
}
