/* مسارات تحليلات الرحلة وبطاقة رأي التشخيص —
   /api/events عامة لكنها محكومة: قائمة أحداث بيضاء، وmeta أرقام/رموز فقط
   (أي نص حر مرفوض بالتحقق)، ومعدل محدود لكل IP.
   userId لا يؤخذ من العميل إطلاقا — يُشتق من كوكي الجلسة عند وجودها،
   وبذلك يُربط anonId بالحساب تلقائيا عند أول حدث بعد التسجيل. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requireAuth, requirePermission } from '../auth-plugin'

/* الأحداث المسموحة — مرآة نوع AnalyticsEvent في الواجهة (src/services/analytics.ts) */
const ALLOWED_EVENTS = new Set([
  'hero_cta_clicked',
  'mirror_started',
  'mirror_completed',
  'diagnostic_started',
  'diagnostic_question_completed',
  'diagnostic_abandoned',
  'diagnostic_completed',
  'recommendation_viewed',
  'result_teaser_viewed',
  'gate_viewed',
  'gate_dismissed',
  'result_full_viewed',
  'account_started',
  'account_created',
  'account_failed',
  'feedback_submitted',
  'pathway_viewed',
  'course_viewed',
  'checkout_started',
  'payment_completed',
  'payment_failed',
  'refund_requested',
  'contact_submitted',
  'deepening_started',
  'deepening_completed',
  'composite_adopted',
])

/* رموز قصيرة فقط: معرفات وقيم مصنفة — أي نص حر (مسافات/عربية/طول) مرفوض */
const CODE_RE = /^[\w.:-]{1,64}$/

const metaValue = z.union([z.number().finite(), z.boolean(), z.string().regex(CODE_RE)])
const eventsBody = z.object({
  event: z.string().max(64).refine((v) => ALLOWED_EVENTS.has(v), { message: 'حدث غير معروف' }),
  meta: z
    .record(z.string().regex(CODE_RE), metaValue)
    .refine((m) => Object.keys(m).length <= 12, { message: 'سمات كثيرة' })
    .optional(),
  anonId: z.string().regex(CODE_RE).optional(),
})

const feedbackBody = z.object({
  sessionId: z.string().regex(/^[\w:-]{3,120}$/),
  pathwayId: z.string().regex(/^[\w:-]{1,80}$/).optional(),
  verdict: z.enum(['yes', 'somewhat', 'no']),
  note: z.string().max(500).transform((s) => s.trim()).optional(),
})

export function registerAnalyticsRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.post('/api/events', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    schema: { tags: ['analytics'], summary: 'حدث رحلة واحد — قائمة بيضاء وسمات رمزية بلا نص حر' },
  }, async (req) => {
    const body = eventsBody.parse(req.body)
    await prisma.analyticsEvent.create({
      data: {
        event: body.event,
        meta: body.meta ?? undefined,
        anonId: body.anonId ?? null,
        userId: req.auth?.userId ?? null,
      },
    })
    return { ok: true }
  })

  app.post('/api/diagnostic-feedback', {
    preHandler: requireAuth,
    schema: { tags: ['analytics'], summary: 'رأي متعلم في نتيجة تشخيصه — مربوط بجلسة التشخيص والمسار الموصى به' },
  }, async (req) => {
    const body = feedbackBody.parse(req.body)
    await prisma.diagnosticFeedback.create({
      data: {
        sessionId: body.sessionId,
        pathwayId: body.pathwayId ?? null,
        verdict: body.verdict,
        note: body.note || null,
        userId: req.auth!.userId,
      },
    })
    return { ok: true }
  })

  app.get('/api/admin/quality/feedback', {
    preHandler: requirePermission('diagnostic.simulate'),
    schema: { tags: ['quality'], summary: 'آراء المتعلمين في نتائجهم — مجمعة بالحكم مع أحدث الملاحظات' },
  }, async () => {
    const [byVerdict, recent] = await Promise.all([
      prisma.diagnosticFeedback.groupBy({ by: ['verdict'], _count: true }),
      prisma.diagnosticFeedback.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, verdict: true, note: true, pathwayId: true, createdAt: true },
      }),
    ])
    const count = (v: string) => byVerdict.find((r) => r.verdict === v)?._count ?? 0
    return {
      total: byVerdict.reduce((s, r) => s + r._count, 0),
      verdicts: { yes: count('yes'), somewhat: count('somewhat'), no: count('no') },
      recent,
    }
  })
}
