/* مسار العملاء المحتملين — بريدُ زائرٍ مقابل كود خصم، بلا حساب وبلا تسجيل دخول.

   عامّ بلا requireAuth (كصفحتي المسار والتشخيص اللتين تناديه)، وحدّه أضيق
   من حدّ التحليلات العام: كل نداء هنا يُرسل بريدا فعليا، فحدٌّ فضفاض يفتح
   بابا لإغراق عناوين لا تخصّ المرسل. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { captureDiscountLead } from '../../services/leads.service'

const leadBody = z.object({
  email: z.string().email().max(200),
  source: z.enum(['pathway_discount', 'diagnostic_discount']),
  pathwayId: z.string().regex(/^[\w:-]{1,80}$/).optional(),
})

export function registerLeadRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.post('/api/leads/discount-email', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    schema: { tags: ['leads'], summary: 'بريد مقابل كود الخصم — يلتقط عميلا محتملا ويرسل الكود، بلا حساب' },
  }, async (req) => {
    const body = leadBody.parse(req.body)
    const result = await captureDiscountLead(prisma, body)
    return { ok: true, code: result.code, percentOff: result.percentOff }
  })
}
