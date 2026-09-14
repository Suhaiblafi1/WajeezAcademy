/* مسارات الملف الشخصي للمتعلم — يقرأ الطالب ملفه ويعدّله بنفسه.
   الحماية: requireAuth يكفي هنا (الملكية شخصية بصاحب الجلسة)،
   والصلاحية learner.portal تحكم بوابة التعلم لا إدارة الحساب الذاتية. */

import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { ProfileService } from '../../services/profile.service'
import { requireAuth } from '../auth-plugin'
import { getObject, getObjectMeta, assertSafeKey } from '../../services/object-store'
import { PHOTO_KEY_PREFIX } from '../../services/storage.service'

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

  app.post('/api/learner/avatar-upload', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: { tags: ['learner'], summary: 'رابطُ رفعٍ موقّتٌ لصورة الحساب — يحتاج FILE_UPLOADS' },
  }, async (req, reply) => {
    const { mime } = z.object({ mime: z.string().min(3).max(64) }).parse(req.body)
    return reply.status(201).send(await profiles.startAvatarUpload(req.auth!.userId, mime))
  })

  /* ═══ قراءةُ صورة الحساب — بلا توقيع، وبلا حارسِ نشر ═══

     صورةُ المدرّب العامّةُ يحرسها `PUBLIC_TRAINER_WHERE`، لأنّها تُعرض
     للعامّة باسم صاحبها. وهذه غيرُها: تظهر في ترويسة صاحبها وفي شهادته —
     والشهادةُ يشاركها هو بنفسه بمن شاء. فلو اشترطنا جلسةً لَانكسرت الصورةُ
     في كلّ شهادةٍ تُفتح خارج الحساب.

     والحارسُ هنا **أنّ المفتاحَ مملوك**: أربعةٌ وعشرون بايتا عشوائيّةٌ لا
     تُخمَّن، ولا يُفشيها إلّا صاحبُها. ولا تقول الصورةُ اسما ولا بريدا. */
  app.get('/api/v1/avatars/:storageKey', {
    schema: { tags: ['public'], summary: 'صورةُ حسابٍ بمفتاحها — تظهر في الشهادات' },
  }, async (req, reply) => {
    const { storageKey } = z.object({ storageKey: z.string().min(10) }).parse(req.params)
    assertSafeKey(storageKey)
    const owner = await prisma.learnerProfile.findFirst({
      where: { avatarUrl: `${PHOTO_KEY_PREFIX}${storageKey}` }, select: { id: true },
    })
    if (!owner) return reply.status(404).send({ error: { code: 'not_found', message_ar: 'لا صورة' } })
    const content = await getObject(storageKey)
    if (!content) return reply.status(404).send({ error: { code: 'not_found', message_ar: 'لا صورة' } })
    const meta = await getObjectMeta(storageKey)
    reply.header('content-type', meta?.mime || 'image/jpeg')
    reply.header('cache-control', 'public, max-age=3600')
    return reply.send(content)
  })
}
