/* مسارات الملف الشخصي للمتعلم — يقرأ الطالب ملفه ويعدّله بنفسه.
   الحماية: requireAuth يكفي هنا (الملكية شخصية بصاحب الجلسة)،
   والصلاحية learner.portal تحكم بوابة التعلم لا إدارة الحساب الذاتية. */

import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { ProfileService } from '../../services/profile.service'
import { requireAuth } from '../auth-plugin'

export function registerProfileRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const profiles = new ProfileService(prisma)

  app.get('/api/learner/profile', {
    preHandler: requireAuth,
    schema: { tags: ['learner'], summary: 'قراءة الملف الشخصي الكامل لصاحب الجلسة' },
  }, async (req) => {
    return profiles.getProfile(req.auth!.userId)
  })

  app.patch('/api/learner/profile', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: {
      tags: ['learner'], summary: 'تحديث الحقول الاختيارية في ملف المتعلم — الحقول غير المرسلة تبقى كما هي',
      /* لا additionalProperties هنا: Fastify يحذف الخصائص غير المعلنة بصمت.
         التحقق الفعلي والتنظيف يحدثان في patchSchema داخل الخدمة (zod). */
      body: { type: 'object' },
    },
  }, async (req) => {
    return profiles.updateProfile(req.auth!.userId, req.body)
  })
}
