/* مسارات تحليلات الرحلة وبطاقة رأي التشخيص —
   /api/events عامة لكنها محكومة: قائمة أحداث بيضاء، وmeta أرقام/رموز فقط
   (أي نص حر مرفوض بالتحقق)، ومعدل محدود لكل IP.
   userId لا يؤخذ من العميل إطلاقا — يُشتق من كوكي الجلسة عند وجودها،
   وبذلك يُربط anonId بالحساب تلقائيا عند أول حدث بعد التسجيل. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requireAuth, requirePermission } from '../auth-plugin'
import { ANALYTICS_EVENTS } from '../../../src/application/analytics/events'

/* الأحداثُ المسموحة — من القائمة المشتركة لا من نسخةٍ هنا.

   كان تعليقُ هذا الموضع يقول إنّه «مرآة» لاتّحاد الواجهة، وكانت المرآةُ قد
   شاخت: أحدَ عشرَ حدثا تُطلقها الواجهةُ ولا تعرفها هذه المجموعة، فتعود
   ٤٢٢ ولا يُسجَّل شيء — والصفحةُ لا تتعطّل، فيُقرأ الصفرُ في اللوحة
   «لا أحد يفعل هذا». */
const ALLOWED_EVENTS = new Set<string>(ANALYTICS_EVENTS)

/* المفاتيح وanonId: رموز لاتينية قصيرة — قيم meta: رموز مصنفة بلا مسافات
   (لاتينية أو عربية؛ المسافة هي علامة النص الحر، والجمل مرفوضة دائما) */
const KEY_RE = /^[\w.:-]{1,64}$/
const VALUE_RE = /^\S{1,64}$/u

const metaValue = z.union([z.number().finite(), z.boolean(), z.string().regex(VALUE_RE)])
const eventsBody = z.object({
  event: z.string().max(64).refine((v) => ALLOWED_EVENTS.has(v), { message: 'حدث غير معروف' }),
  meta: z
    .record(z.string().regex(KEY_RE), metaValue)
    .refine((m) => Object.keys(m).length <= 12, { message: 'سمات كثيرة' })
    .optional(),
  anonId: z.string().regex(KEY_RE).optional(),
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
