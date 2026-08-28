/* حفظ مسار سمّاه متعلم — العقد الذي يحرسه الخادم لا الواجهة.

   الواجهة تُقصّ وتتحقق، لكن نقطة النهاية عامة: أي طلب يصلها مباشرة. فما يُفرض
   هنا هو ما يُعتمد عليه — الطول والعدد وتصفية المعرّفات على الكتالوج المنشور. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { buildApp } from '../../http/app'
import { setupTestDb, testPrisma } from '../helpers/db'

let app: FastifyInstance
let prisma: PrismaClient
let realCourseIds: string[]

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  const courses = await prisma.course.findMany({ take: 5, select: { id: true } })
  realCourseIds = courses.map((c) => c.id)
  expect(realCourseIds.length, 'لا دورات في قاعدة الاختبار').toBeGreaterThan(2)
}, 180_000)

const post = (body: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/path-drafts', payload: body })

describe('POST /api/path-drafts', () => {
  it('يحفظ مسارا مسمّى لزائر بلا حساب', async () => {
    const res = await post({ name: 'مسار التفاوض للمستقلين', courseIds: realCourseIds.slice(0, 3) })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { id: string; saved: number }
    expect(body.saved).toBe(3)
    const row = await prisma.learnerPathDraft.findUnique({ where: { id: body.id } })
    expect(row?.name).toBe('مسار التفاوض للمستقلين')
    expect(row?.courseIds).toEqual(realCourseIds.slice(0, 3))
    expect(row?.status).toBe('pending_review')
    /* بلا حساب: لا يُخترع ربط */
    expect(row?.userId).toBeNull()
  })

  it('يُسقط المعرّفات المجهولة ويحفظ المعروفة', async () => {
    const res = await post({ name: 'خليط', courseIds: [realCourseIds[0], 'C-LA-YOUJAD', realCourseIds[1]] })
    expect(res.statusCode).toBe(201)
    const row = await prisma.learnerPathDraft.findUnique({ where: { id: (res.json() as { id: string }).id } })
    expect(row?.courseIds).toEqual([realCourseIds[0], realCourseIds[1]])
  })

  it('يزيل التكرار', async () => {
    const res = await post({ name: 'مكرر', courseIds: [realCourseIds[0], realCourseIds[0], realCourseIds[1]] })
    const row = await prisma.learnerPathDraft.findUnique({ where: { id: (res.json() as { id: string }).id } })
    expect(row?.courseIds).toEqual([realCourseIds[0], realCourseIds[1]])
  })

  it('يرفض قائمة لا دورة معروفة فيها بـ400 لا بصفّ فارغ', async () => {
    const before = await prisma.learnerPathDraft.count()
    const res = await post({ name: 'كله وهم', courseIds: ['C-LA-YOUJAD', 'C-WAHM'] })
    expect(res.statusCode).toBe(400)
    expect(await prisma.learnerPathDraft.count()).toBe(before)
  })

  /* التحقق المخطَّطي يردّ 422 في هذا التطبيق (معالج أخطاء Zod الموحّد)،
     بخلاف 400 التي نردّها نحن حين تكون البنية سليمة والمحتوى لا يصلح. */
  it('يرفض اسما أقصر من ثلاثة أحرف وقائمة فارغة', async () => {
    expect((await post({ name: 'أ', courseIds: realCourseIds.slice(0, 1) })).statusCode).toBe(422)
    expect((await post({ name: 'اسم صالح', courseIds: [] })).statusCode).toBe(422)
  })

  it('يرفض ما تجاوز السقوف — الحدّ في الخادم لا في الواجهة', async () => {
    const long = 'ط'.repeat(81)
    expect((await post({ name: long, courseIds: realCourseIds.slice(0, 1) })).statusCode).toBe(422)
    const many = Array.from({ length: 13 }, (_, i) => realCourseIds[i % realCourseIds.length])
    expect((await post({ name: 'كثير', courseIds: many })).statusCode).toBe(422)
  })

  it('لا يقبل حقلا شخصيا مهما أُرسل — المخطط لا يعرفه فلا يُخزَّن', async () => {
    const res = await post({
      name: 'مع بريد',
      courseIds: realCourseIds.slice(0, 2),
      email: 'x@y.com',
      fullName: 'اسم',
    })
    expect(res.statusCode).toBe(201)
    const row = await prisma.learnerPathDraft.findUnique({ where: { id: (res.json() as { id: string }).id } })
    expect(JSON.stringify(row)).not.toContain('x@y.com')
    expect(JSON.stringify(row)).not.toContain('اسم')
  })
})

describe('GET /api/path-drafts', () => {
  it('محمي: بلا صلاحية لا قراءة', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/path-drafts' })
    expect([401, 403]).toContain(res.statusCode)
  })
})
