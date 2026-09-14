/* ملفُّ المحتوى النظريّ — مساراتُه (ع-٢).

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
import { ModuleBodyService } from '../../services/module-body.service'
import { assertSafeKey, getObject, getObjectMeta } from '../../services/object-store'
import { BODY_FILE_MIMES } from '../../../src/application/trainer/module-body'

export function registerModuleBodyRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const bodies = new ModuleBodyService(prisma)

  app.post('/api/trainer/cohorts/:cohortId/modules/:moduleId/body-file', {
    preHandler: requireAuth,
    schema: { tags: ['trainer'], summary: 'رابطُ رفعٍ لملفِّ المحتوى النظريّ — يحتاج FILE_UPLOADS' },
  }, async (req, reply) => {
    const { cohortId, moduleId } = z.object({
      cohortId: z.string().uuid(), moduleId: z.string().trim().min(1).max(120),
    }).parse(req.params)
    const body = z.object({
      mime: z.enum(BODY_FILE_MIMES as unknown as [string, ...string[]]),
      originalName: z.string().trim().min(1).max(200),
    }).parse(req.body)
    return reply.status(201).send(await bodies.startUpload(req.auth!.userId, cohortId, moduleId, body))
  })

  app.delete('/api/trainer/cohorts/:cohortId/body-file/:storageKey', {
    preHandler: requireAuth,
    schema: { tags: ['trainer'], summary: 'فكُّ ملفِّ المحتوى النظريّ ومحوُه' },
  }, async (req) => {
    const { cohortId, storageKey } = z.object({
      cohortId: z.string().uuid(), storageKey: z.string().min(10),
    }).parse(req.params)
    assertSafeKey(storageKey)
    return bodies.detach(req.auth!.userId, cohortId, storageKey)
  })

  app.get('/api/v1/module-body/:storageKey', {
    preHandler: requireAuth,
    schema: { tags: ['learner'], summary: 'قراءةُ ملفِّ المحتوى النظريّ — لمن التحق بالشعبة' },
  }, async (req, reply) => {
    const { storageKey } = z.object({ storageKey: z.string().min(10) }).parse(req.params)
    assertSafeKey(storageKey)
    const row = await bodies.assertCanRead(storageKey, req.auth!)

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
