/* مسارات الكتالوج العام — مصدر الموقع للزوار: منشور فقط، بلا مسودات.
   المسارات والقوالب والدورات والوحدات والمخرجات والشعب والأسعار والمواعيد والمنهجية. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { PublicCatalogService } from '../../services/public-catalog.service'

export function registerPublicCatalogRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const catalog = new PublicCatalogService(prisma)

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
