/* مساراتُ توقيع العقد — عامّةٌ لا تسأل عن جلسة.

   والمدرّبُ لا حسابَ له في هذا الطور: `profile.userId` فارغٌ حتّى الدعوة
   الآمنة، وهي تُرسَل **بعد** التوقيع. فالرمزُ هو البابُ الوحيد، كما في
   `/api/r/:token` — والفرقُ أنّ ذاك يقرأ ويُقيّم، وهذا **يلزم إنسانا بمال**.

   ── وثلاثةُ فروقٍ عن رابط السجلّ، كلُّها من ذلك الفرق ──

   ① **حدٌّ صارمٌ على الطلبات.** رابطُ السجلّ يُحرَس بالعشوائيّة وحدَها (٣٠٠
      طلبٍ في الدقيقة لكلّ عنوانٍ عامّا). وبابُ توقيعٍ يُخمَّن رمزُه يُوقَّع
      منه عقد — فيُضيَّق عليه بمقدارٍ يكفي إنسانا يقرأ ويوقّع، ويضيق على من
      يجرّب.

   ② **`noindex` على الردود كلِّها.** الصفحةُ تحمل اسمَ إنسانٍ وأتعابَه.

   ③ **وعنوانُ الشبكة يُقرأ من الطلب لا من جسمه.** فمن أرسل `ip` في الجسم
      كتب ما شاء، ودليلُ التوقيع يصير ما يقوله الموقِّعُ عن نفسه. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { TrainerReviewService } from '../../services/trainer-review.service'

/** يكفي قارئا يوقّع، ويضيق على من يجرّب الرموز */
const SIGN_RATE = { max: 30, timeWindow: '1 minute' }

export function registerContractSignRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const svc = new TrainerReviewService(prisma)
  const params = z.object({ token: z.string().min(16).max(200) })

  app.get('/api/c/:token', {
    config: { rateLimit: SIGN_RATE },
    schema: { tags: ['trainer-contracts'], summary: 'العقدُ كما يقرؤه صاحبُ الرابط' },
  }, async (req, reply) => {
    const { token } = params.parse(req.params)
    reply.header('X-Robots-Tag', 'noindex, nofollow')
    return svc.contractByToken(token)
  })

  app.post('/api/c/:token/documents', {
    config: { rateLimit: SIGN_RATE },
    schema: { tags: ['trainer-contracts'], summary: 'وعدُ رفعِ وثيقةٍ مطلوبةٍ مع التوقيع' },
  }, async (req, reply) => {
    const { token } = params.parse(req.params)
    const body = z.object({
      kind: z.string().min(1).max(40),
      originalName: z.string().trim().min(1).max(200),
      mime: z.string().min(3).max(100),
      sizeBytes: z.number().int().positive(),
    }).parse(req.body)
    reply.header('X-Robots-Tag', 'noindex, nofollow')
    return svc.requestContractDocumentUpload(token, body)
  })

  app.post('/api/c/:token/sign', {
    config: { rateLimit: SIGN_RATE },
    schema: { tags: ['trainer-contracts'], summary: 'توقيعُ المدرّب عقدَه بنفسه' },
  }, async (req, reply) => {
    const { token } = params.parse(req.params)
    const body = z.object({
      legalName: z.string().trim().min(4).max(120),
      /* هاشُ ما عُرض عليه — يُقابَل بالمحفوظ، فمن بُدّل تحته النصُّ يُردّ */
      bodyHash: z.string().length(64),
      acks: z.array(z.string().min(1).max(40)).max(20),
    }).parse(req.body)
    reply.header('X-Robots-Tag', 'noindex, nofollow')
    /* ولا يُقرأ العنوانُ من الجسم: `req.ip` يحترم `trustProxy` المضبوطَ في
       التطبيق، وما يكتبه الموقِّعُ عن نفسه ليس دليلا عليه. */
    return svc.signContractByToken(token, {
      ...body, ip: req.ip, userAgent: req.headers['user-agent'] ?? null,
    })
  })

  app.post('/api/c/:token/decline', {
    config: { rateLimit: SIGN_RATE },
    schema: { tags: ['trainer-contracts'], summary: 'اعتذارُ المدرّب عن العقد — جوابٌ مشروع' },
  }, async (req, reply) => {
    const { token } = params.parse(req.params)
    const { reasonAr } = z.object({ reasonAr: z.string().trim().min(5).max(500) }).parse(req.body)
    reply.header('X-Robots-Tag', 'noindex, nofollow')
    return svc.declineContractByToken(token, reasonAr)
  })
}
