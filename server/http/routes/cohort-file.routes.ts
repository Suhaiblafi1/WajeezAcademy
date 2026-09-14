/* ملفّاتُ الشعبة — مساراتُها (ع-٢ · د-٣).

   ═══ بابٌ واحدٌ لغرضَين ═══

   متنُ المحور وملفُّ المصدر يختلفان في ما يُقبل منهما ويتّفقان في من يقرأ.
   والمقبولُ يقرّره `fileBlockerAr` بالغرض، والقراءةُ حارسٌ واحدٌ في الخدمة.

   ═══ ولمَ القراءةُ بالجلسة لا برابطٍ موقَّع ═══

   وثائقُ المتقدّم تُقرأ برابطٍ موقَّعٍ لعشر دقائق، لأنّ قارئَها قد يكون
   مراجِعا خارجيّا بلا حساب. وهذا غيرُه: قارئُه **متعلّمٌ مسجَّلٌ في شعبته**
   يفتح وحدتَه في بوّابته. فالحارسُ جلستُه وترشيحُ التحاقه — لا رابطٌ يُنسخ
   في محادثةٍ فيُفتح بعد شهرٍ بلا حساب.

   وما لا يملكه يُردّ **بأربعمئةٍ وأربعة** لا بثلاثمئةٍ وثلاثة: وجودُ ملفٍّ
   لشعبةٍ بعينها خبرٌ في نفسه. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requireAuth } from '../auth-plugin'
import { CohortFileService } from '../../services/cohort-file.service'
import { assertSafeKey, getObject, getObjectMeta } from '../../services/object-store'
import { FILE_PURPOSES } from '../../../src/application/trainer/module-body'

export function registerCohortFileRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const files = new CohortFileService(prisma)

  app.post('/api/trainer/cohorts/:cohortId/files', {
    preHandler: requireAuth,
    schema: { tags: ['trainer'], summary: 'رابطُ رفعٍ لملفِّ شعبة — متنِ محورٍ أو مصدر (يحتاج FILE_UPLOADS)' },
  }, async (req, reply) => {
    const { cohortId } = z.object({ cohortId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      purpose: z.enum(FILE_PURPOSES),
      refId: z.string().trim().min(1).max(120),
      mime: z.string().trim().min(3).max(120),
      originalName: z.string().trim().min(1).max(200),
    }).parse(req.body)
    return reply.status(201).send(
      await files.startUpload(req.auth!.userId, cohortId, body.purpose, body.refId, body),
    )
  })

  app.delete('/api/trainer/cohorts/:cohortId/files/:storageKey', {
    preHandler: requireAuth,
    schema: { tags: ['trainer'], summary: 'فكُّ ملفِّ شعبةٍ ومحوُه' },
  }, async (req) => {
    const { cohortId, storageKey } = z.object({
      cohortId: z.string().uuid(), storageKey: z.string().min(10),
    }).parse(req.params)
    assertSafeKey(storageKey)
    return files.detach(req.auth!.userId, cohortId, storageKey)
  })

  app.get('/api/v1/cohort-files/:storageKey', {
    preHandler: requireAuth,
    schema: { tags: ['learner'], summary: 'قراءةُ ملفِّ شعبة — لمن التحق بها أو يدرّسها أو يعتمد خطّتها' },
  }, async (req, reply) => {
    const { storageKey } = z.object({ storageKey: z.string().min(10) }).parse(req.params)
    assertSafeKey(storageKey)
    const row = await files.assertCanRead(storageKey, req.auth!)

    const content = await getObject(storageKey)
    if (!content) {
      return reply.status(404).send({ error: { code: 'not_uploaded', message_ar: 'الملف لم يرفع بعد' } })
    }
    const meta = await getObjectMeta(storageKey)
    /* الترويسةُ من مجاورِ الكائن حيث وُجد، ثمّ من السجلّ — لا نوعٌ يُدّعى */
    reply.header('content-type', meta?.mime || row.mime || 'application/octet-stream')
    reply.header(
      'content-disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(meta?.originalName || row.originalName)}`,
    )
    return reply.send(content)
  })
}
