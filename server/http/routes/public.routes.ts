/* مسارات الكتالوج العام — مصدر الموقع للزوار: منشور فقط، بلا مسودات.
   المسارات والقوالب والدورات والوحدات والمخرجات والشعب والأسعار والمواعيد والمنهجية. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { PublicCatalogService } from '../../services/public-catalog.service'
import { fileUploadsEnabled } from '../../services/storage.service'
import { TrainerPathService } from '../../services/trainer-path.service'
import { getCalendlyConfig } from '../../services/integrations.service'
import { ShortLinkService } from '../../services/short-link.service'
import { deadLinkPage, previewPage } from '../../services/link-preview'
import { recordOpen } from '../../services/link-opens'
import { publicSiteUrl } from '../../services/site-url'
import { readSeasonGate } from '../../services/registration-window'
import { RegistrationInterestService, INTEREST_CONSENT_AR, INTEREST_SOURCES } from '../../services/registration-interest.service'
import { CourseInterestService, COURSE_INTEREST_CONSENT_AR } from '../../services/course-interest.service'
import { assertNotBot } from '../honeypot'
import { ContactService } from '../../services/contact.service'
import { AdvisorService } from '../../services/advisor.service'
import { GUEST_CONTACT_CONSENT_AR } from '../../../src/application/advisor/guest-contact'

export function registerPublicCatalogRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const catalog = new PublicCatalogService(prisma)
  const trainerPaths = new TrainerPathService(prisma)
  const shortLinks = new ShortLinkService(prisma)
  const interest = new RegistrationInterestService(prisma)

  /* ما تستطيعه هذه المنصّةُ فعلا — تقرأه الواجهةُ قبل أن تعرض زرّا.
     الواجهةُ كانت تعرض «ارفع التسجيل» و«ارفع سيرتك» حيث لا مخزنَ يقبلهما،
     فتفشل الأولى بعد الضغط وتكذب الثانيةُ فلا تُرسل الملفَّ أصلا. فبدل
     تكرار المعرفة في الواجهة، يقولها الخادمُ مرّةً واحدة. */
  app.get('/api/config', {
    schema: { tags: ['public-catalog'], summary: 'قدرات المنصّة المفعّلة — تقرؤها الواجهة لتخفي ما لا يعمل' },
  }, async () => ({
    fileUploads: fileUploadsEnabled(),
    demoMode: process.env.DEMO_MODE === 'true',
    /* بابُ الموسم — تقرؤه الواجهةُ لتعرض الرسالةَ مكانَ صفحة الدفع.

       وهو **راحةٌ لا حارس**: الحارسُ في `checkout` و`pay`، وهذا يجنّب المشتريَ
       أن يملأ سلّةً ويختار عملةً ثمّ يُردّ. ولو كُذب هذا الحقلُ في متصفّحٍ
       لَما مرّت دفعةٌ واحدة. */
    registration: await readSeasonGate(prisma),
    /* ═══ رابطُ الحجز: `null` تعني «استعمل المضمَّن» ═══

       الأصلُ في `src/application/trainer/application-options.ts`، ولا يستورد
       الخادمُ من `src/`. فبدل نسخِ الرابط هنا ونسخةٍ تفترق عن أختها، لا
       يُرسَل شيءٌ إلّا حين يُضبط بديلٌ من الشاشة — فيبقى مصدرٌ واحدٌ لا اثنان. */
    ...await (async () => {
      const c = await getCalendlyConfig(prisma)
      /* والحاضرون يُعلَنون هنا لأنّ الرابطَ يُبنى في المتصفّح: `guests=` معامَلٌ
         في رابط Calendly لا سرٌّ، وهو بريدٌ للعمل يظهر لكلّ حاضرٍ في الموعد
         أصلا — فلا يُكشف بإعلانه ما لم يكن مكشوفا. */
      return { interviewBookingUrl: c.bookingUrl ?? null, interviewGuests: c.guests ?? null }
    })(),
  }))

  /* بريدُ من ينتظر فتحَ الباب (قرارُ صاحب المنصّة ١٨ سبتمبر ٢٠٢٦).

     عامٌّ بلا مصادقة بقصد: **من يُردّ عند الدفع أكثرُه بلا حساب** — جاء من
     إعلانٍ أو بحث، ورأى السعرَ، ونقر. وأن نطلب منه حسابا قبل بريده يعني ألّا
     نأخذ بريدَ أكثرِهم.

     وحارسُه سقفُه لا فخُّه: الفخُّ طبقةٌ رخيصةٌ تُمسك متصفّحا آليّا، والسقفُ
     هو ما يمنع ألفَ عنوانٍ مختلَقٍ في دقيقة (والعلّةُ كاملةً في رأس
     `honeypot.ts`). */
  app.post('/api/public/registration-interest', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    schema: { tags: ['public'], summary: 'أبلغوني حين يفتح باب التسجيل — بريد ينتظر الموسم' },
  }, async (req, reply) => {
    assertNotBot(req.body)
    const body = z.object({
      email: z.string().trim().toLowerCase().email().max(200),
      source: z.enum(INTEREST_SOURCES).optional(),
    }).parse(req.body)
    const res = await interest.record(body.email, body.source ?? 'buy')
    return reply.status(201).send({ ...res, consentAr: INTEREST_CONSENT_AR })
  })

  /* «أبلغني حين تفتح شعبتها» — لدورةٍ بعينها، بلا حساب (١٢ أكتوبر ٢٠٢٦).
     والعلّةُ في `course-interest.service.ts` */
  const courseInterest = new CourseInterestService(prisma)
  app.post('/api/public/course-interest', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    schema: { tags: ['public'], summary: 'أبلغني حين تفتح شعبة هذه الدورة — بريد ينتظر الدورة' },
  }, async (req, reply) => {
    assertNotBot(req.body)
    const body = z.object({
      email: z.string().trim().toLowerCase().email().max(200),
      courseId: z.string().trim().min(1).max(80),
    }).parse(req.body)
    const res = await courseInterest.record(body.email, body.courseId)
    return reply.status(201).send({ ...res, consentAr: COURSE_INTEREST_CONSENT_AR })
  })

  /* «اترك رقمك ويتواصل معك مستشار» — آخرَ التشخيص، بلا حساب (١٨ أكتوبر ٢٠٢٦).
     والعلّةُ في `guest-contact.ts`، وحدودُه في `AdvisorService#requestContactAsGuest`.

     وسقفُه أضيقُ من «أبلغني»: كلُّ طلبٍ هنا حالةٌ يقرؤها إنسانٌ ويُسندها، لا
     بريدٌ في قائمةٍ تنتظر. فثلاثةٌ لكلّ شبكةٍ في ربع ساعة تتّسع لمن أخطأ
     فأعاد، ولا تتّسع لطابورٍ يُملأ بأسماءٍ مختلَقة. */
  const advisors = new AdvisorService(prisma)
  app.post('/api/public/advisor-contact', {
    config: { rateLimit: { max: 3, timeWindow: '15 minutes' } },
    schema: { tags: ['public'], summary: 'زائر أنهى التشخيص يطلب أن يتواصل معه مستشار — ببريد أو واتساب' },
  }, async (req, reply) => {
    assertNotBot(req.body)
    const body = z.object({
      fullName: z.string().trim().min(2, 'اكتب اسمك — حرفان على الأقل').max(120),
      email: z.string().trim().toLowerCase().email('صيغة البريد غير صحيحة').max(200).optional(),
      phone: z.string().trim().max(30).optional(),
      snapshot: z.unknown().optional(),
    }).parse(req.body)
    await advisors.requestContactAsGuest(body, req.ip)
    return reply.status(201).send({ ok: true, consentAr: GUEST_CONTACT_CONSENT_AR })
  })

  /* «تواصل معنا» — رسالةٌ تُحفظ وتصل بريدَ الأكاديميّة وصاحبَها (١٩ أكتوبر ٢٠٢٦). وكان النموذجُ
     يحاكي الإرسال. والعلّةُ في `contact.service.ts`. وسقفُه خمسٌ لكلّ شبكةٍ في ربع ساعة: تتّسع لمن
     أخطأ فأعاد، ولا تتّسع لصندوقٍ يُملأ — فكلُّ رسالةٍ بريدان وبندٌ يقرؤه إنسان. */
  const contact = new ContactService(prisma)
  app.post('/api/public/contact', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    schema: { tags: ['public'], summary: 'رسالة «تواصل معنا» — تُحفظ برقم مرجعي وتصل بريد الأكاديمية ونسخةٌ لصاحبها' },
  }, async (req, reply) => {
    assertNotBot(req.body)
    const body = z.object({
      name: z.string().trim().min(2, 'اكتب اسمك').max(120),
      email: z.string().trim().toLowerCase().email('صيغة البريد غير صحيحة — مثال: name@mail.com').max(200),
      entity: z.enum(['individual', 'company', 'gov', 'edu', 'nonprofit']).default('individual'),
      organization: z.string().trim().max(200).optional(),
      topic: z.string().trim().min(2).max(80),
      message: z.string().trim().min(10, 'اكتب رسالة أوضح (10 أحرف على الأقل)').max(5000),
    }).parse(req.body)
    return reply.status(201).send(await contact.submit(body))
  })

  app.get('/api/public/pathways', {
    schema: { tags: ['public-catalog'], summary: 'المسارات المنشورة مع دوراتها مرتبة' },
  }, async () => catalog.pathways())

  /* رفُّ مسارات المدرّبين (ن-١) — قسمٌ مستقلٌّ تحت «مسارات أعدّها مدرّبونا
     المعتمدون»، لا يختلط بالمسارات المنسَّقة ولا يدخل التشخيص (ن-٥).

     والترشيحُ وقتَ القراءة هو ما يجعل ن-٤ آليّا: الموقوفُ يسقط من الرفّ في
     اللحظة، ولا يُمسّ من التحق. */
  app.get('/api/public/trainer-paths', {
    schema: { tags: ['public-catalog'], summary: 'مسارات أعدّها مدرّبونا المعتمدون (ن-١)' },
  }, async () => trainerPaths.shelf())

  app.get('/api/public/pathways/:id', {
    schema: { tags: ['public-catalog'], summary: 'مسار منشور بالمعرف — 404 إن كان مسودة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    return catalog.pathway(id)
  })

  app.get('/api/public/courses', {
    schema: { tags: ['public-catalog'], summary: 'الدورات المنشورة مع وحداتها ومخرجاتها' },
  }, async () => catalog.courses())

  app.get('/api/public/courses/:id', {
    schema: { tags: ['public-catalog'], summary: 'دورة منشورة بالمعرف — 404 إن كانت مسودة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    return catalog.course(id)
  })

  app.get('/api/public/templates', {
    schema: { tags: ['public-catalog'], summary: 'قوالب التوصية المركبة المنشورة' },
  }, async () => catalog.templates())

  app.get('/api/public/listed-courses', {
    schema: { tags: ['public-catalog'], summary: 'رموز الدورات المعروضة في قوائم الموقع — لها شعبة أعلنت ولم تنته' },
  }, async () => ({ courseIds: await catalog.listedCourseIds() }))

  app.get('/api/public/cohorts', {
    schema: { tags: ['public-catalog'], summary: 'الشعب المفتوحة للتسجيل — سعر وموعد ومقاعد متبقية ومدربون منشورون' },
  }, async () => catalog.cohorts())

  /* صفحةُ المدرّب باسمه — بابٌ عامٌّ على شعبه المفتوحة (المرحلة «أ») */
  app.get('/api/public/trainers/:slug', {
    schema: { tags: ['public-catalog'], summary: 'صفحة مدرّب منشور باسمه — تعريفه وشعبه المفتوحة ورمز دعوته' },
  }, async (req) => {
    const { slug } = z.object({ slug: z.string().min(1).max(80) }).parse(req.params)
    return catalog.trainerPublicPage(slug)
  })

  /* رابطُ مسارٍ باسمه — يردّ وجهتَه لا صفحتَه (ن-٩) */
  app.get('/api/public/paths/:slug', {
    schema: { tags: ['public-catalog'], summary: 'وجهة رابط مسار منشور باسم مدرّبه — عنوان صفحته ومرساها' },
  }, async (req) => {
    const { slug } = z.object({ slug: z.string().min(1).max(120) }).parse(req.params)
    return catalog.pathPublicTarget(slug)
  })

  /* ط-٣: وجهةُ رابطٍ قصير — يُقرأ تحت زرِّ البريد ويُنسخ باليد.

     وهو عامٌّ بلا جلسةٍ بقصد: الرابطُ يُفتح من بريدٍ قبل الدخول، ومن جهازٍ
     ليس فيه حسابٌ أصلا. والسرُّ في الرمز لا في الجلسة. */
  app.get('/api/public/links/:code', {
    schema: { tags: ['public-catalog'], summary: 'وجهة رابط قصير — مسار داخليّ يحوّل إليه' },
  }, async (req) => {
    const { code } = z.object({ code: z.string().min(1).max(32) }).parse(req.params)
    return shortLinks.resolve(code)
  })

  /* ═══ الرابطُ القصيرُ نفسُه — يُجاب من هنا لا من الواجهة (٢٦ أكتوبر ٢٠٢٦) ═══
     ليقرأ زاحفُ واتساب وفيسبوك معاينتَه: ما له صورةٌ صفحةُ وسومٍ تحوّل فورا، وما لا صورةَ له ٣٠٢ كما كان.
     والعلّةُ في `link-preview.ts`. */
  app.get('/s/:code', { schema: { hide: true } }, async (req, reply) => {
    const { code } = z.object({ code: z.string().min(1).max(32) }).parse(req.params)
    const origin = publicSiteUrl()
    const target = await shortLinks.resolve(code).then((t) => t.target, () => null)
    if (!target) return reply.status(404).type('text/html; charset=utf-8').send(deadLinkPage(origin))
    /* وتُعدّ الفتحةُ إن فتحه إنسان — كم فُتح ومن أيّ منصّة، يراه المدرّبُ تحت رابطه (`link-opens.ts`) */
    await recordOpen(prisma, code, { ip: req.ip, userAgent: req.headers['user-agent'], via: (req.query as { p?: unknown }).p })
    const row = await prisma.shortLink.findUnique({ where: { code }, select: { previewSig: true, previewTitle: true, previewText: true } })
    if (!row?.previewSig || !row.previewTitle) return reply.redirect(`${origin}${target}`, 302)
    /* ولا تُخزَّن الصفحة: فتحةٌ تُجاب من مخزنٍ في الطريق لا تبلغ الخادمَ فلا تُعدّ */
    return reply.header('cache-control', 'no-store').type('text/html; charset=utf-8')
      .send(previewPage({ origin, code, target, title: row.previewTitle, text: row.previewText ?? '', sig: row.previewSig }))
  })

  app.get('/api/public/links/:code/preview.jpg', {
    schema: { tags: ['public-catalog'], summary: 'صورة معاينة رابط قصير' },
  }, async (req, reply) => {
    const { code } = z.object({ code: z.string().min(1).max(32) }).parse(req.params)
    const row = await prisma.shortLink.findUnique({ where: { code }, select: { previewImage: true, revokedAt: true } })
    if (!row?.previewImage || row.revokedAt) return reply.status(404).send({ error: { code: 'not_found', message_ar: 'لا معاينة لهذا الرابط' } })
    return reply.header('cache-control', 'public, max-age=86400').type('image/jpeg').send(Buffer.from(row.previewImage))
  })

  app.get('/api/public/methodology', {
    schema: { tags: ['public-catalog'], summary: 'المراجع العلمية للمنهجية — من ملف المصدر الوحيد' },
  }, async () => catalog.methodology())

  app.get('/api/public/core-catalog', {
    schema: { tags: ['public-catalog'], summary: 'الكتالوج الجوهري المنشور بصيغة core-catalog.v2 — الواجهة تبني عرضها منه بالمحولات ذاتها' },
  }, async () => catalog.coreCatalog())
}
