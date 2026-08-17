/* مسارات الديمو — تبديل الأدوار لبيئة العرض المحلية فقط.
   حماية مزدوجة:
   1) لا تُسجَّل هذه المسارات إلا إذا DEMO_MODE=true عند بناء التطبيق (انظر app.ts).
   2) كل معالج يعيد التحقق داخليا ويعيد 404 عند غياب العلامة —
      فالمسار مستحيل في الإنتاج حتى لو وصل إليه الطلب. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AuthService } from '../../services/auth.service'
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoRoleKey } from '../../db/seed-demo'
import { SESSION_COOKIE } from '../auth-plugin'

const demoEnabled = () => process.env.DEMO_MODE === 'true'

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
