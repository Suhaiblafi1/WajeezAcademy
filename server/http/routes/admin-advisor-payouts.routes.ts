/* كشوفُ عمولة المستشارين — بابُ من يصرف (١٩ أكتوبر ٢٠٢٦). والعلّةُ في `advisor-payout.service.ts`.

   وبابٌ مستقلٌّ عن `admin-advisors.routes.ts`: ذاك بيد من يقرّر النسبة (`advisor.manage`)،
   وهذا بيد من يصرف (`advisor.payout.manage`) — كما تُفصل قواعدُ أتعاب المدرّب عن عقده. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requirePermission } from '../auth-plugin'
import { AdvisorPayoutService, lastClosedPeriod } from '../../services/advisor-payout.service'

export function registerAdminAdvisorPayoutRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const payouts = new AdvisorPayoutService(prisma)
  const canPay = requirePermission('advisor.payout.manage')
  const byId = z.object({ id: z.string().uuid() })

  app.get('/api/admin/advisor-payouts', {
    preHandler: canPay,
    schema: { tags: ['admin-advisors'], summary: 'كشوف عمولة المستشارين، وصف لكل مستشار: ما صرف وما ينتظر' },
  }, async (req) => {
    const { status } = z.object({ status: z.string().optional() }).parse(req.query)
    const [list, summaries] = await Promise.all([payouts.listAll({ status }), payouts.summaries()])
    return { payouts: list, summaries, lastClosedPeriod: lastClosedPeriod(new Date()) }
  })

  app.post('/api/admin/advisor-payouts/generate', {
    preHandler: canPay,
    schema: { tags: ['admin-advisors'], summary: 'توليد كشوف شهر انتهى — ومن له كشف للشهر يتخطى' },
  }, async (req) => {
    const { period } = z.object({ period: z.string().optional() }).parse(req.body ?? {})
    return payouts.generate(period ?? lastClosedPeriod(new Date()), req.auth!.userId)
  })

  app.post('/api/admin/advisor-payouts/:id/approve', {
    preHandler: canPay,
    schema: { tags: ['admin-advisors'], summary: 'اعتماد كشف عمولة' },
  }, async (req) => {
    await payouts.approve(byId.parse(req.params).id, req.auth!.userId)
    return { ok: true }
  })

  app.post('/api/admin/advisor-payouts/:id/pay', {
    preHandler: canPay,
    schema: { tags: ['admin-advisors'], summary: 'تأكيد صرف كشف معتمد — ومرجع الحوالة إن وجد' },
  }, async (req) => {
    const { ref } = z.object({ ref: z.string().max(200).optional() }).parse(req.body ?? {})
    await payouts.markPaid(byId.parse(req.params).id, req.auth!.userId, ref)
    return { ok: true }
  })

  app.post('/api/admin/advisor-payouts/:id/cancel', {
    preHandler: canPay,
    schema: { tags: ['admin-advisors'], summary: 'إلغاء كشف لم يصرف — بسبب، وتعود دفعاته إلى الكشف التالي' },
  }, async (req) => {
    const { reason } = z.object({ reason: z.string().min(5).max(500) }).parse(req.body)
    await payouts.cancel(byId.parse(req.params).id, req.auth!.userId, reason)
    return { ok: true }
  })
}
