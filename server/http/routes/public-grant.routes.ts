/* صفحةُ «منحة أعضاء وجيز» — أبوابُها العامّة (٢٠ أكتوبر ٢٠٢٦). والعلّةُ في `grant-landing.service.ts`.

   بلا حساب: الزائرُ يعبّئ النموذج فيأخذ كودَه ويرى الدورات، والحسابُ حين يدفع. وسقفُ النموذج
   خمسٌ لكلّ شبكةٍ في ربع ساعة — تتّسع لمن أخطأ فأعاد، ولا تتّسع لمن يجمع أكوادا بأرقامٍ مختلَقة؛
   وسقفُ «تواصل مع مستشار» ثلاث: كلُّ طلبٍ حالةٌ يقرؤها إنسان. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { assertNotBot } from '../honeypot'
import { GrantLandingService } from '../../services/grant-landing.service'
import { learnerGrant } from '../../services/grant.service'
import { INFLUENCER_GRANT_SLUG, MEMBER_GRANT_SLUG } from '../../../src/application/commerce/grant'
import { recordGrantVisit } from '../../services/grant-visit.service'
import { requireAuth } from '../auth-plugin'

const applyBody = z.object({
  fullName: z.string().trim().min(2, 'اكتب اسمك').max(120),
  phone: z.string().trim().min(5, 'اكتب رقم واتساب').max(30),
  email: z.string().trim().toLowerCase().email('صيغة البريد غير صحيحة').max(200),
  workField: z.string().trim().min(2).max(60),
  careerLevel: z.string().trim().max(60).nullable().optional(),
  interests: z.array(z.string().trim().max(80)).max(10).optional(),
  channel: z.string().max(40).nullable().optional(),
  wave: z.string().max(40).nullable().optional(),
  /* زيارتاه — تُنظَّفان في الخدمة حقلا حقلا (`cleanTouch`)، فلا يُفحص هنا إلّا أنّهما شيءٌ أو لا شيء */
  source: z.object({ page: z.unknown().optional(), first: z.unknown().optional() }).nullable().optional(),
  visitorId: z.string().uuid().nullable().optional(),
})

/* ═══ سقفُ نموذجَي المنحة: حاجزُ غَمرٍ لا حاجزُ ناس (٢٨ أكتوبر ٢٠٢٦) ═══
   كان خمسةَ طلباتٍ لكلّ ربع ساعةٍ لكلّ عنوان. وهواتفُ زين وأورانج وأمنية تخرج كثيرا من عنوانٍ واحد، فسادسُ من عبّأ
   النموذجَ من شبكته في ربع الساعة نفسِها يُردّ — عميلٌ حقيقيٌّ لا يأخذ كودَه. وهو بعينه ما أصلح التسجيلَ من قبل
   (`registerRateMax` في `auth.routes.ts`). قرارُ صاحب المنصّة: «I don't care if everyone uses it and I can increase
   the grants.. we are flexible and no limit»، وخُيّر بين ١٢٠ ورفعِه كلّيّا فاختار ١٢٠: لا يبلغه ناسٌ على شبكةٍ واحدة،
   ويمنع من يرسل بالنموذج آلافَ الرسائل من نطاقنا إلى عناوينَ يكتبها — فيضعنا البريدُ في المزعج ولا يصل الناسَ كودُهم.
   والمصيدةُ (`assertNotBot`) والتحقّقُ وسقفُ الأكواد باقية. */
export const GRANT_FORM_RATE_MAX = 120

export function registerPublicGrantRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const landing = new GrantLandingService(prisma)
  const influencers = new GrantLandingService(prisma, INFLUENCER_GRANT_SLUG)

  /* كودُ منحته لصاحب الحساب ببريد النموذج — فيفتح لوحُ الدفع بمنحته ولو عبّأ النموذجَ من جهازٍ آخر (`myCode`) */
  app.get('/api/learner/grant-code', {
    preHandler: requireAuth,
    schema: { tags: ['commerce'], summary: 'كود المنحة لصاحب الحساب — من نموذج في الحملة ببريد حسابه، ما لم يستعمل' },
  }, async (req) => {
    const { campaign } = z.object({ campaign: z.enum(['member', 'influencer']) }).parse(req.query)
    return (campaign === 'influencer' ? influencers : landing).myCode(req.auth!.userId, req.ip)
  })

  /* وكودُ منحته في حسابه — لوحتُه تعرضه، ولوحُ الشراء يطبّقه وحده عند أيّ شراء (`learnerGrant`) */
  app.get('/api/learner/my-grant', {
    preHandler: requireAuth,
    schema: { tags: ['commerce'], summary: 'كود منحة صاحب الحساب وما بقي من دوراته — ليطبق تلقائيا عند الشراء' },
  }, async (req) => learnerGrant(prisma, req.auth!.userId))

  app.get('/api/public/grant', {
    schema: { tags: ['public'], summary: 'حال منحة وجيز ودوراتها بفصلها' },
  }, async () => landing.view())

  app.post('/api/public/grant', {
    config: { rateLimit: { max: GRANT_FORM_RATE_MAX, timeWindow: '15 minutes' } },
    schema: { tags: ['public'], summary: 'نموذج المنحة: عميل محتمل وكوده، والدورات' },
  }, async (req, reply) => {
    assertNotBot(req.body)
    const body = applyBody.parse(req.body)
    return reply.status(201).send(await landing.apply(body, req.ip))
  })

  /* ═══ «منحة مؤثرين وجيز» — صفحتُها غيرُ صفحة الأولى، وكودُ المؤثّر لازمٌ في نموذجها (`grant-landing.service.ts`) ═══ */
  app.get('/api/public/grant/influencer', {
    schema: { tags: ['public'], summary: 'حال منحة المؤثرين ودوراتها، واسم المؤثر إن كان كوده صحيحا' },
  }, async (req) => {
    const { code } = z.object({ code: z.string().max(40).optional() }).parse(req.query)
    return influencers.influencerView(code)
  })

  app.post('/api/public/grant/influencer', {
    config: { rateLimit: { max: GRANT_FORM_RATE_MAX, timeWindow: '15 minutes' } },
    schema: { tags: ['public'], summary: 'نموذج منحة المؤثرين: كود المؤثر لازم، وعميل محتمل وكوده' },
  }, async (req, reply) => {
    assertNotBot(req.body)
    const body = applyBody.extend({ influencerCode: z.string().trim().min(1, 'اكتب كود المؤثر').max(40) }).parse(req.body)
    return reply.status(201).send(await influencers.apply(body, req.ip))
  })

  /* من فتح صفحةَ المنحة — زائرٌ لكلّ متصفّحٍ في كلّ حملة، عبّأ أم لم يعبّئ (`grant-visit.service.ts`). يُرسَل مرّةً مع كلّ فتح،
     فالسقفُ واسعٌ لمن يحدّث الصفحة، ولا يقبل إلّا رقما عشوائيّا بشكله وزيارتين تُنظَّفان */
  app.post('/api/public/grant/visit', {
    config: { rateLimit: { max: 120, timeWindow: '15 minutes' } },
    schema: { tags: ['public'], summary: 'زيارة صفحة المنحة — لتعرف كم فتح الرابط من كل مصدر وكم عبأ منهم' },
  }, async (req, reply) => {
    const body = z.object({
      campaign: z.enum(['member', 'influencer']),
      visitorId: z.string().uuid(),
      code: z.string().max(40).nullable().optional(),
      source: z.object({ page: z.unknown().optional(), first: z.unknown().optional() }).nullable().optional(),
    }).parse(req.body)
    await recordGrantVisit(prisma, body.campaign === 'influencer' ? INFLUENCER_GRANT_SLUG : MEMBER_GRANT_SLUG, body)
    return reply.status(204).send()
  })

  /* ما اختاره من دوراتٍ يُحفظ في ملفّه فيراه المستشار — يُرسَل بعد كلّ تغييرٍ بمهلة، فالسقفُ أوسعُ من النموذج */
  app.put('/api/public/grant/picks', {
    config: { rateLimit: { max: 60, timeWindow: '15 minutes' } },
    schema: { tags: ['public'], summary: 'الدورات التي اختارها صاحب المنحة — تحفظ في ملفه' },
  }, async (req) => {
    const body = z.object({ ref: z.string().uuid(), courseIds: z.array(z.string().max(40)).max(20) }).parse(req.body)
    return landing.savePicks(body.ref, body.courseIds)
  })

  app.post('/api/public/grant/advisor', {
    config: { rateLimit: { max: 3, timeWindow: '15 minutes' } },
    schema: { tags: ['public'], summary: 'من عبأ نموذج المنحة يطلب مستشارا' },
  }, async (req, reply) => {
    assertNotBot(req.body)
    const body = z.object({ ref: z.string().uuid(), noteAr: z.string().max(500).nullable().optional() }).parse(req.body)
    return reply.status(201).send(await landing.askAdvisor(body.ref, body.noteAr, req.ip))
  })
}
