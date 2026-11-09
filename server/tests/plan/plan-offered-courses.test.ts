/* الخطّةُ من دوراتٍ تُعرض (٩ نوفمبر ٢٠٢٦) — والعلّةُ في `PlanService.adopt` و`replaceCourses` و`path-drafts.routes.ts`.

   كان اعتمادُ الخطّة وتبديلُ دوراتها يقبلان أيَّ رمز — دورةً لا وجودَ لها أو مسودّةً لم تُنشر — فتُكتب «تنتظر شعبة» بإشعارٍ لا
   يأتي، وتُعدّ طلبا عند الإدارة على ما لا يُباع. ومسودّةُ المسار العامّة كانت تكتفي بوجود الصفّ. وما في خطّته الآن أو ما سُجّل فيه
   يبقى ولو سُحب نشرُه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { PlanService } from '../../services/plan.service'
import { buildApp } from '../../http/app'

let prisma: PrismaClient
let plans: PlanService
let app: FastifyInstance
let published = ''
let seq = 0
const DRAFT = 'C-PLD-901'

const learner = async () => {
  seq += 1
  return (await new AuthService(prisma).register(`pof-${seq}@test.local`, 'Learn#12345', `متعلم ${seq}`)).userId
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  plans = new PlanService(prisma)
  app = await buildApp(prisma)
  published = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } })).id
  await prisma.course.create({ data: { id: DRAFT, status: 'draft', currentVersion: 1 } })
  await prisma.courseVersion.create({ data: { courseId: DRAFT, version: 1, titleAr: 'دورة لم تنشر', totalHours: 5 } })
}, 240_000)

describe('الخطة من دورات تعرض', () => {
  it('⚠️ رمز لا وجود له أو مسودة: يرد الاعتماد ويسميها', async () => {
    const me = await learner()
    await expect(plans.adopt(me, { nameAr: 'خطتي', composed: false, courseIds: ['C-NOPE-999'] }), 'قبل دورة لا وجود لها').rejects.toMatchObject({ code: 'course_not_offered' })
    await expect(plans.adopt(me, { nameAr: 'خطتي', composed: false, courseIds: [published, DRAFT] })).rejects.toMatchObject({ code: 'course_not_offered' })
    expect(await prisma.learnerPlan.count({ where: { userId: me } })).toBe(0)
  })

  it('⚠️ وتبديل الدورات كذلك — والمنشورة تمضي', async () => {
    const me = await learner()
    await plans.adopt(me, { nameAr: 'خطتي', composed: false, courseIds: [published] })
    await expect(plans.replaceCourses(me, [published, DRAFT]), 'أضاف مسودة إلى الخطة').rejects.toMatchObject({ code: 'course_not_offered' })
  })

  it('وما في خطته الآن يبقى ولو سحب نشره', async () => {
    const me = await learner()
    await plans.adopt(me, { nameAr: 'خطتي', composed: false, courseIds: [published] })
    await prisma.course.update({ where: { id: published }, data: { status: 'archived' } })
    try {
      const v = await plans.replaceCourses(me, [published])
      expect(v.items.map((i) => i.courseId)).toEqual([published])
    } finally {
      await prisma.course.update({ where: { id: published }, data: { status: 'published' } })
    }
  })

  it('⚠️ ومسودة المسار العامة تحفظ المنشورة وحدها', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/path-drafts', payload: { name: 'مساري', courseIds: [published, DRAFT] } })
    expect(res.statusCode).toBe(201)
    expect(res.json().saved, 'حفظت المسودة دورة لم تنشر').toBe(1)
  })
})
