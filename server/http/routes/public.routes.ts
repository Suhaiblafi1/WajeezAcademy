/* مسارات الكتالوج العام — مصدر الموقع للزوار: منشور فقط، بلا مسودات.
   المسارات والقوالب والدورات والوحدات والمخرجات والشعب والأسعار والمواعيد والمنهجية. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { PublicCatalogService } from '../../services/public-catalog.service'
import { fileUploadsEnabled } from '../../services/storage.service'
import { getCalendlyConfig } from '../../services/integrations.service'

export function registerPublicCatalogRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const catalog = new PublicCatalogService(prisma)

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
    interviewBookingUrl: (await getCalendlyConfig(prisma)).bookingUrl ?? null,
  }))

  app.get('/api/public/pathways', {
    schema: { tags: ['public-catalog'], summary: 'المسارات المنشورة مع دوراتها مرتبة' },
  }, async () => catalog.pathways())

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

  app.get('/api/public/methodology', {
    schema: { tags: ['public-catalog'], summary: 'المراجع العلمية للمنهجية — من ملف المصدر الوحيد' },
  }, async () => catalog.methodology())

  app.get('/api/public/core-catalog', {
    schema: { tags: ['public-catalog'], summary: 'الكتالوج الجوهري المنشور بصيغة core-catalog.v2 — الواجهة تبني عرضها منه بالمحولات ذاتها' },
  }, async () => catalog.coreCatalog())
}
