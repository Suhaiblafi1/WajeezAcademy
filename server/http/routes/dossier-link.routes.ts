/* مسارا سجلِّ المتقدّم المشترك — عامّان لا يسألان عن جلسة.

   الرمزُ وحدَه يفتحهما، ويُحَلّ بمقارنة هاشِه بالعمود المفهرَس. ولا تُقاس
   صلاحيّتُهما بدورٍ ولا صلاحيّةٍ: من حاز الرابطَ فهو القارئُ المسمّى فيه،
   وهي مخاطرةٌ مقبولةٌ سُجّلت في تصميمها — والبديلُ كان رابطا عامّا بلا اسم.

   و`noindex` على الردَّين: صفحةٌ تحمل اسمَ إنسانٍ وسيرتَه لا تُفهرَس. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { INTERVIEW_OUTCOME_KEYS } from '../../../src/application/trainer/interview-outcome'
import type { PrismaClient } from '@prisma/client'
import { TrainerDossierLinkService } from '../../services/trainer-dossier-link.service'
import { RUBRIC_CRITERIA } from '../../services/trainer-review.service'

/* اختياريّةٌ وصارمة — كما في `assertRubric` سواءً بسواء: النقصُ جائز،
   والمفتاحُ المجهولُ يُرَدّ ولا يُقبل صامتا فيضيع. */
const scoresSchema = z.object(
  Object.fromEntries(RUBRIC_CRITERIA.map((k) => [k, z.number().int().min(1).max(5)])),
).partial().strict()

export function registerDossierLinkRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const svc = new TrainerDossierLinkService(prisma)

  app.get('/api/r/:token', {
    schema: { tags: ['trainer-applications'], summary: 'سجلُّ المتقدّم كما يراه صاحبُ الرابط' },
  }, async (req, reply) => {
    const { token } = z.object({ token: z.string() }).parse(req.params)
    reply.header('X-Robots-Tag', 'noindex, nofollow')
    return svc.view(token)
  })

  app.put('/api/r/:token/review', {
    schema: { tags: ['trainer-applications'], summary: 'حفظُ تقييم صاحب الرابط' },
  }, async (req, reply) => {
    const { token } = z.object({ token: z.string() }).parse(req.params)
    const body = z.object({
      scores: scoresSchema.optional(),
      overallNote: z.string().max(4000).nullable().optional(),
      /* ═══ والأربعةُ كلُّها — لا ثلاثةٌ منها (٢١ سبتمبر ٢٠٢٦) ═══

         كان المعجمُ هنا ثلاثةً بحجّة أنّ «القارئَ يقرأ ملفّا فلا يغيب عنه».
         وقد صار الحكمُ مربوطا بمقابلةٍ بعينها، فالحاكمُ هو من جلس إليها —
         و«لم يحضر» خبرٌ لا يملكه غيرُه. فهي `INTERVIEW_OUTCOME_KEYS` بعينها:
         معجمٌ واحدٌ لشيءٍ واحد، وما يُكتب هنا هو ما يُقرأ في قسم المقابلة. */
      verdict: z.enum(INTERVIEW_OUTCOME_KEYS).nullable().optional(),
      /* والمقابلةُ التي يحكم فيها — تلزم مع القرار، والخدمةُ تحرسها */
      interviewId: z.string().uuid().nullable().optional(),
      coursesNote: z.string().max(4000).nullable().optional(),
      /* الاتفاقُ الماليُّ نصّا لا رقما — والسقفُ قصيرٌ لأنّه سطرٌ لا تقرير */
      feeExpectationAr: z.string().max(500).nullable().optional(),
      feeProposalAr: z.string().max(500).nullable().optional(),
    }).parse(req.body)
    reply.header('X-Robots-Tag', 'noindex, nofollow')
    return svc.saveReview(token, body)
  })
}
