/* «جهّز رابط شراء» — للسوبر أدمن من صفوف المنح، وللمستشار من حالاته (٥ نوفمبر ٢٠٢٦، المرحلة الثانية).
   والحكمُ كلُّه في الخدمة (`buy-link.service.ts`): من يولّد ولمن وأيُّ كود — والحارسُ هنا الجلسةُ وحدَها، فلا تُخفى
   القاعدةُ في صلاحيّةٍ تُمنح لدورٍ ثالثٍ فيصلها. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requireAuth, requirePermission } from '../auth-plugin'
import { BuyLinkService, type BuyLinkTarget } from '../../services/buy-link.service'
import { PrivatePathService } from '../../services/private-path.service'
import { AuthError } from '../../services/auth.service'
import { CodeAttemptGuard } from '../../services/commerce/code-attempts'

const COURSE = z.string().trim().regex(/^[A-Za-z0-9_-]{1,80}$/)
const INPUT = z.object({
  courseId: COURSE,
  cohortId: z.string().uuid().nullish(),
  adds: z.array(z.object({ courseId: COURSE, cohortId: z.string().uuid().nullish() })).max(9).optional(),
  code: z.string().trim().max(40).nullish(),
  whatsapp: z.boolean().optional(),
  /* سببُ كلّ دورةٍ في المسار الخاصّ — بمعرّفها، ويُقصّ إلى حدّه في الخدمة (`cleanReason`) */
  reasons: z.record(COURSE, z.string().max(400)).optional(),
})

export function registerBuyLinkRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const links = new BuyLinkService(prisma)
  const paths = new PrivatePathService(prisma)
  /* ومن يجرّب الرموزَ رمزا بعد رمز يُوقف بعد عشرةٍ خاطئةٍ في ساعة — فوق سقف النداءات (٥ نوفمبر ٢٠٢٦) */
  const guesses = new CodeAttemptGuard()

  /* ═══ «مسارٌ خاصّ» — صفحتُه العامّة `/go/<رمز>` (٥ نوفمبر ٢٠٢٦) ═══
     بلا جلسة: الرمزُ العشوائيُّ هو السرّ (ثمانيةُ أحرف). والمجهولُ والمُبطَلُ جوابُهما واحد، فلا يُعرف أيُّ الرموز موجود.
     والعلّةُ في `private-path.service.ts`. */
  app.get('/api/public/go/:code', {
    config: { rateLimit: { max: 60, timeWindow: '10 minutes' } },
    schema: { tags: ['public'], summary: 'المسار الخاص باسم المتعلم — دوراته وأسبابها والسعر من المعاينة' },
  }, async (req, reply) => {
    const { code } = z.object({ code: z.string().trim().max(40) }).parse(req.params)
    const key = req.ip
    const upper = code.toUpperCase()
    if (!guesses.allows(key, upper)) {
      return reply.status(429).send({ error: { code: 'too_many_codes', message_ar: 'جربت روابط كثيرة. أعد المحاولة بعد ساعة.' } })
    }
    try {
      return await paths.view(upper, { ip: req.ip, userAgent: req.headers['user-agent'] })
    } catch (e) {
      if (e instanceof AuthError && e.code === 'not_found') guesses.reject(key, upper)
      throw e
    }
  })
  const actor = (req: { auth: { userId: string; roles: string[] } | null }) => ({ userId: req.auth!.userId, roles: req.auth!.roles })
  const norm = (b: z.infer<typeof INPUT>) => ({ ...b, adds: b.adds?.map((a) => ({ courseId: a.courseId, cohortId: a.cohortId ?? null })) })

  /* السوبر أدمن — من صفّ المتعلّم في صفحات المنح (`leadId`) */
  app.get('/api/admin/buy-links/lead/:leadId', {
    preHandler: requireAuth,
    schema: { tags: ['commerce'], summary: 'ما تفتح به أداة رابط الشراء لمتعلم من صفحات المنح — للمدير الأعلى' },
  }, async (req) => {
    const { leadId } = z.object({ leadId: z.string().uuid() }).parse(req.params)
    return links.prepare(actor(req), { leadId })
  })
  app.post('/api/admin/buy-links/lead/:leadId', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 60, timeWindow: '10 minutes' } },
    schema: { tags: ['commerce'], summary: 'توليد رابط شراء لمتعلم — يكتب أثرا ولا يمس سعرا' },
  }, async (req, reply) => {
    const { leadId } = z.object({ leadId: z.string().uuid() }).parse(req.params)
    return reply.status(201).send(await links.generate(actor(req), { leadId } as BuyLinkTarget, norm(INPUT.parse(req.body))))
  })

  /* المستشار — لحالةٍ مسندةٍ إليه الآن وحدَها */
  app.get('/api/advisor/cases/:id/buy-link', {
    preHandler: requirePermission('advisor.cases.operate'),
    schema: { tags: ['advisor-portal'], summary: 'ما تفتح به أداة رابط الشراء لحالة مسندة إلي' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return links.prepare(actor(req), { caseId: id })
  })
  app.post('/api/advisor/cases/:id/buy-link', {
    preHandler: requirePermission('advisor.cases.operate'),
    config: { rateLimit: { max: 60, timeWindow: '10 minutes' } },
    schema: { tags: ['advisor-portal'], summary: 'توليد رابط شراء لمتعلم في حالة مسندة إلي — بكوده وحده' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return reply.status(201).send(await links.generate(actor(req), { caseId: id }, norm(INPUT.parse(req.body))))
  })
}
