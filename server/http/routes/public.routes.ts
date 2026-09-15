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

export function registerPublicCatalogRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const catalog = new PublicCatalogService(prisma)
  const trainerPaths = new TrainerPathService(prisma)
  const shortLinks = new ShortLinkService(prisma)

  /* ما تستطيعه هذه المنصّةُ فعلا — تقرأه الواجهةُ قبل أن تعرض زرّا.
     الواجهةُ كانت تعرض «ارفع التسجيل» و«ارفع سيرتك» حيث لا مخزنَ يقبلهما،
     فتفشل الأولى بعد الضغط وتكذب الثانيةُ فلا تُرسل الملفَّ أصلا. فبدل
     تكرار المعرفة في الواجهة، يقولها الخادمُ مرّةً واحدة. */
  app.get('/api/config', {
    schema: { tags: ['public-catalog'], summary: 'قدراتُ المنصّة المفعّلة — تقرؤها الواجهة لتخفي ما لا يعمل' },
  }, async () => ({
    fileUploads: fileUploadsEnabled(),
    demoMode: process.env.DEMO_MODE === 'true',
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

  app.get('/api/public/pathways', {
    schema: { tags: ['public-catalog'], summary: 'المسارات المنشورة مع دوراتها مرتبة' },
  }, async () => catalog.pathways())

  /* رفُّ مسارات المدرّبين (ن-١) — قسمٌ مستقلٌّ تحت «مسارات أعدّها مدرّبونا
     المعتمدون»، لا يختلط بالمسارات المنسَّقة ولا يدخل التشخيص (ن-٥).

     والترشيحُ وقتَ القراءة هو ما يجعل ن-٤ آليّا: الموقوفُ يسقط من الرفّ في
     اللحظة، ولا يُمسّ من التحق. */
  app.get('/api/public/trainer-paths', {
    schema: { tags: ['public-catalog'], summary: 'مساراتٌ أعدّها مدرّبونا المعتمدون (ن-١)' },
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

  app.get('/api/public/cohorts', {
    schema: { tags: ['public-catalog'], summary: 'الشعب المفتوحة للتسجيل — سعر وموعد ومقاعد متبقية ومدربون منشورون' },
  }, async () => catalog.cohorts())

  /* صفحةُ المدرّب باسمه — بابٌ عامٌّ على شعبه المفتوحة (المرحلة «أ») */
  app.get('/api/public/trainers/:slug', {
    schema: { tags: ['public-catalog'], summary: 'صفحةُ مدرّبٍ منشورٍ باسمه — تعريفُه وشعبُه المفتوحةُ ورمزُ دعوته' },
  }, async (req) => {
    const { slug } = z.object({ slug: z.string().min(1).max(80) }).parse(req.params)
    return catalog.trainerPublicPage(slug)
  })

  /* رابطُ مسارٍ باسمه — يردّ وجهتَه لا صفحتَه (ن-٩) */
  app.get('/api/public/paths/:slug', {
    schema: { tags: ['public-catalog'], summary: 'وجهةُ رابطِ مسارٍ منشورٍ باسم مدرّبه — عنوانُ صفحته ومرساها' },
  }, async (req) => {
    const { slug } = z.object({ slug: z.string().min(1).max(120) }).parse(req.params)
    return catalog.pathPublicTarget(slug)
  })

  /* ط-٣: وجهةُ رابطٍ قصير — يُقرأ تحت زرِّ البريد ويُنسخ باليد.

     وهو عامٌّ بلا جلسةٍ بقصد: الرابطُ يُفتح من بريدٍ قبل الدخول، ومن جهازٍ
     ليس فيه حسابٌ أصلا. والسرُّ في الرمز لا في الجلسة. */
  app.get('/api/public/links/:code', {
    schema: { tags: ['public-catalog'], summary: 'وجهةُ رابطٍ قصير — مسارٌ داخليٌّ يُحوَّل إليه' },
  }, async (req) => {
    const { code } = z.object({ code: z.string().min(1).max(32) }).parse(req.params)
    return shortLinks.resolve(code)
  })

  app.get('/api/public/methodology', {
    schema: { tags: ['public-catalog'], summary: 'المراجع العلمية للمنهجية — من ملف المصدر الوحيد' },
  }, async () => catalog.methodology())

  app.get('/api/public/core-catalog', {
    schema: { tags: ['public-catalog'], summary: 'الكتالوج الجوهري المنشور بصيغة core-catalog.v2 — الواجهة تبني عرضها منه بالمحولات ذاتها' },
  }, async () => catalog.coreCatalog())
}
