/* حسابُ التجربة لا يُعدّ في «من ينتظر دورة بلا شعبة» (١٧ أكتوبر ٢٠٢٦).

   «اخفي هذه القائمة اذا كان الطلب من حساب تجريبي» (صاحب المنصّة) — واختار أن يُعرف بوجهَين.
   وهنا على قاعدةٍ حقيقيّة:

   ① **من نفسه**: من يعمل في المنصّة (فريقٌ أو مدرّبٌ أو مستشار)، وحساباتُ البذر على `wajeez.local`
      — في خطّته وببريده كذلك. والمتعلّمُ الحقيقيّ يُعدّ كما كان.
   ② **وبمفتاح الإدارة**: «حساب تجريبي» يُخرجه من العدّ، ورفعُه يعيده — بأثرٍ يُقرأ، ولمن يدير الحسابات وحدَه.
   ③ **ودورةٌ لا يطلبها إلّا حسابُ تجربةٍ لا تُعرض**. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { PlanService } from '../../services/plan.service'
import { CourseInterestService } from '../../services/course-interest.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let plans: PlanService
let interest: CourseInterestService
let app: FastifyInstance
const S = Date.now()
const PASS = 'Pass#12345'
const cookies: Record<string, string> = {}
let courses: string[] = []
let seq = 0

const person = async (email: string, roles: string[] = []) => {
  const { userId } = await auth.register(email, PASS, `حساب ${++seq}`)
  if (roles.length) await auth.setRoles(userId, roles)
  return userId
}
const wants = async (userId: string, courseId: string) =>
  plans.adopt(userId, { nameAr: 'خطّتي', composed: true, courseIds: [courseId] })
const row = async (courseId: string) => (await interest.demand()).rows.find((r) => r.courseId === courseId)
const flag = (who: string, id: string, value: boolean) =>
  app.inject({ method: 'POST', url: `/api/admin/users/${id}/test-account`, headers: { cookie: cookies[who] }, payload: { value } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  plans = new PlanService(prisma)
  interest = new CourseInterestService(prisma)
  app = await buildApp(prisma)
  await person(`ta-admin-${S}@test.local`, ['super_admin'])
  cookies.admin = `${SESSION_COOKIE}=${(await auth.login(`ta-admin-${S}@test.local`, PASS)).token}`
  /* يرى الحسابات ولا يديرها (`admin.users.view` بلا `manage`) */
  await person(`ta-viewer-${S}@test.local`, ['academic_manager'])
  cookies.viewer = `${SESSION_COOKIE}=${(await auth.login(`ta-viewer-${S}@test.local`, PASS)).token}`
  /* من آخر الكتالوج — بعيدا عمّا تأخذه `course-interest.test.ts` من أوّله */
  courses = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' } }))
    .map((c) => c.id).slice(0, 4)
}, 240_000)

describe('① يُعرف من نفسه — والحقيقيُّ يُعدّ', () => {
  it('⚠️ الفريقُ والمدرّبُ والمستشارُ والبذرُ لا يُعدّون — في الخطّة والبريد', async () => {
    const c = courses[0]!
    await wants(await person(`ta-real-${S}@example.com`), c)
    await interest.record(`ta-visitor-${S}@example.com`, c)
    await wants(await person(`ta-staff-${S}@example.com`, ['academic_manager']), c)
    await wants(await person(`ta-trainer-${S}@example.com`, ['trainer']), c)
    await wants(await person(`ta-advisor-${S}@example.com`, ['advisor']), c)
    await wants(await person(`ta-seed-${S}@wajeez.local`), c)
    await interest.record(`ta-seed-visitor-${S}@wajeez.local`, c)
    /* وموظّفٌ ترك بريدَه زائرا — يُعرف بحسابه على البريد نفسِه */
    await interest.record(`TA-STAFF-${S}@example.com`, c)
    const r = await row(c)
    expect([r?.planWaiting, r?.visitorWaiting], 'عُدّ حساب تجربة').toEqual([1, 1])
  })
})

describe('② وبمفتاح الإدارة', () => {
  let tester = ''

  it('⚠️ «حساب تجريبي» يخرجه من العدّ — خطّةً وبريدا — ويكتب أثره', async () => {
    const c = courses[1]!
    tester = await person(`ta-tester-${S}@example.com`)
    await wants(tester, c)
    await interest.record(`ta-tester-${S}@example.com`, c)
    await wants(await person(`ta-real2-${S}@example.com`), c)
    expect((await row(c))?.total).toBe(3)

    const r = await flag('admin', tester, true)
    expect(r.statusCode, r.body).toBe(200)
    expect([(await row(c))?.planWaiting, (await row(c))?.visitorWaiting], 'بقي يعدّ بعد تعليمه').toEqual([1, 0])
    const ev = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'admin.user.test_account', entityId: tester } })
    expect(ev.meta).toMatchObject({ value: true })
    const list = (await app.inject({ method: 'GET', url: '/api/admin/users', headers: { cookie: cookies.admin } })).json() as { id: string; isTestAccount: boolean }[]
    expect(list.find((u) => u.id === tester)?.isTestAccount).toBe(true)
  })

  it('⚠️ ورفعُه يعيده إلى العدّ', async () => {
    expect((await flag('admin', tester, false)).statusCode).toBe(200)
    expect((await row(courses[1]!))?.total).toBe(3)
  })

  it('⚠️ ولمن يدير الحسابات وحدَه — لا لمن يراها', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/admin/users', headers: { cookie: cookies.viewer } })).statusCode).toBe(200)
    expect((await flag('viewer', tester, true)).statusCode).toBe(403)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: tester } })).isTestAccount).toBe(false)
  })
})

it('⚠️ ③ ودورةٌ لا يطلبها إلّا حسابُ تجربةٍ لا تُعرض', async () => {
  const c = courses[2]!
  const t = await person(`ta-only-${S}@example.com`)
  await wants(t, c)
  expect(await row(c)).toBeDefined()
  await flag('admin', t, true)
  expect(await row(c), 'عرضت دورة لا يطلبها إلا حساب تجربة').toBeUndefined()
})
