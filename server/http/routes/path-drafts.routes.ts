/* مسارات سمّاها المتعلمون لأنفسهم — كتابةٌ عامة وقراءةٌ بصلاحية.

   الكتابة مفتوحة للزائر عمدا: التركيبة تُبنى قبل التسجيل غالبا، واشتراط الحساب
   لحفظها يُفقدنا أصدق ما فيها — الطلب لحظةَ نشوئه. وهي عامة لكنها مقيَّدة:
   لا حقل شخصي يُقبل أصلا (اسم المسار وقائمة دوراته فقط)، والمعرّفات تُصفّى على
   الكتالوج المنشور فلا يُخزَّن ما لا وجود له، والسقوف مكتوبة هنا لا في الواجهة
   وحدها — الواجهة تُقصّ والخادم يرفض.

   والقراءة بصلاحية إدارية: هذه مادة قرار أكاديمي (أي تركيبة تكررت حتى تستحق أن
   تصير مسارا معتمدا)، لا محتوى عام. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requirePermission } from '../auth-plugin'

const MAX_NAME = 80
const MAX_COURSES = 12

export function registerPathDraftRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.post('/api/path-drafts', {
    /* المسارُ عامٌّ بلا حساب، وكان بلا سقفٍ خاصٍّ يعتمد على السقف العامّ وحدَه
       (٣٠٠ في الدقيقة) — أي ألوفَ المسودّات في الساعة من سكربتٍ واحد. ومتعلّمٌ
       حقيقيٌّ يحفظ مسارا أو ثلاثةً في جلسته، فثلاثون لكلّ ربع ساعةٍ سعةٌ واسعة.
       ولا فخَّ هنا: لا نموذجَ يُعبّئه إنسانٌ بحقولٍ حرّة، بل اسمٌ وقائمةُ دورات. */
    config: { rateLimit: { max: 30, timeWindow: '15 minutes' } },
    schema: { tags: ['path-drafts'], summary: 'حفظ مسار سمّاه متعلم — اسم وقائمة دورات، بلا بيانات شخصية' },
  }, async (req, reply) => {
    const body = z
      .object({
        name: z.string().trim().min(3).max(MAX_NAME),
        courseIds: z.array(z.string().trim().min(1)).min(1).max(MAX_COURSES),
      })
      .parse(req.body)

    /* المعرّفات تُصفّى على الدورات المنشورة: مسودة تشير إلى دورة لا وجود لها
       تُقرأ لاحقا كأنها طلب حقيقي وهي خطأ إدخال أو عبث. */
    const known = await prisma.course.findMany({
      where: { id: { in: body.courseIds } },
      select: { id: true },
    })
    const knownIds = new Set(known.map((c) => c.id))
    const courseIds = [...new Set(body.courseIds.filter((id) => knownIds.has(id)))]
    if (courseIds.length === 0) {
      return reply.code(400).send({ error: 'لا دورة معروفة في هذه القائمة' })
    }

    const draft = await prisma.learnerPathDraft.create({
      data: {
        name: body.name,
        courseIds,
        /* يُربط بالحساب إن كان موثقا وقت الحفظ — وليس شرطا */
        userId: req.auth?.userId ?? null,
      },
      select: { id: true },
    })
    return reply.code(201).send({ id: draft.id, saved: courseIds.length })
  })

  app.get('/api/path-drafts', {
    preHandler: requirePermission('catalog.view'),
    schema: { tags: ['path-drafts'], summary: 'المسارات التي سمّاها المتعلمون — للمراجعة الأكاديمية' },
  }, async (req) => {
    const q = z
      .object({ status: z.string().optional(), limit: z.coerce.number().int().min(1).max(200).default(50) })
      .parse(req.query)
    return prisma.learnerPathDraft.findMany({
      where: q.status ? { status: q.status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: q.limit,
      select: { id: true, name: true, courseIds: true, status: true, createdAt: true },
    })
  })
}
