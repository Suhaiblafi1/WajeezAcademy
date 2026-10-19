/* «افتح المعتمدة كلها» — على قاعدةٍ حقيقيّة (١٩ أكتوبر ٢٠٢٦).

   «أريد أن أفتح الشعبَ التي لها مدرّبٌ واعتُمدت موادُّها — كلَّها مرّةً واحدة، عدا ما تمّ نقلُه» (صاحب المنصّة).

   ① المعاينةُ تسمّي كلَّ شيءٍ ولا تغيّر شيئا — من كلّ المواسم لا من موسمٍ واحد.
   ② التنفيذ يفتح الجاهزةَ من بابِ الفتح نفسِه، وما لا تتمّ شروطُه يُسمّى ولا يُفتح.
   ③ ولا يُمسّ: ما نُقل إلى موسمٍ آخر، وما لم تُعتمَد خطّةُ مدرّبه، وما لا مدرّبَ فيه، وشعبةُ إعدادِ مدرّبٍ في طوره. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { OpenApprovedService } from '../../services/open-approved.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

const DAY = 86_400_000
const STAMP = Date.now()
let prisma: PrismaClient
let svc: OpenApprovedService
let app: FastifyInstance
let cookie = ''
let adminId = ''
let profileId = ''
let onboardingId = ''
let courseId = ''
let winterId = ''
let springId = ''
const ids: Record<string, string> = {}

async function cohort(key: string, data: {
  termId: string; approved?: boolean; ready?: boolean; trainer?: string | null; moved?: boolean
}) {
  const trainer = data.trainer === undefined ? profileId : data.trainer
  const c = await prisma.cohort.create({
    data: {
      courseId, title: `${key} ${STAMP}`, status: 'draft', termId: data.termId,
      capacity: data.ready === false ? null : 10, price: 100, financialReady: true, registrationOpen: false,
    },
  })
  await prisma.cohortSession.create({ data: { cohortId: c.id, title: 'لقاء', startsAt: new Date(Date.now() + 40 * DAY) } })
  if (trainer) await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId: trainer, role: 'lead' } })
  if (data.approved) {
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId: c.id, trainerId: trainer ?? profileId, status: 'approved', content: { kind: 'trainer', modules: [] } as never },
    })
  }
  if (data.moved) {
    await prisma.cohortMoveRequest.create({
      data: { cohortId: c.id, requestedBy: adminId, toYear: 2092, toSeason: 'feb_apr', reason: 'نقل', status: 'approved', reviewedAt: new Date() },
    })
  }
  ids[key] = c.id
}
const statusOf = async (k: string) => (await prisma.cohort.findUniqueOrThrow({ where: { id: ids[k]! } })).status
const titles = (xs: { title: string }[]) => xs.map((x) => x.title.replace(` ${STAMP}`, '')).sort()

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  svc = new OpenApprovedService(prisma)
  adminId = (await auth.register(`oa-admin-${STAMP}@test.local`, 'Admin#12345', 'مدير الشعب')).userId
  await auth.setRoles(adminId, ['academic_manager'])
  cookie = `${SESSION_COOKIE}=${(await auth.login(`oa-admin-${STAMP}@test.local`, 'Admin#12345')).token}`
  app = await buildApp(prisma)
  await app.ready()
  courseId = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, select: { id: true } })).id

  const active = await prisma.trainerApplication.create({
    data: { reference: `TR-OA-${STAMP}`, fullName: 'مدرب نشط', email: `oa-t-${STAMP}@test.local`, status: 'active', motivation: 'اختبار', privacyConsentAt: new Date() },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: active.id, isVerified: true } })).id
  await prisma.trainerCourseQualification.create({ data: { profileId, courseId, status: 'qualified' } })

  /* ومدرّبٌ في طوره: شعبتُه شعبةُ إعدادٍ لتأهيله، لا للبيع */
  const onboarding = await prisma.trainerApplication.create({
    data: { reference: `TR-OA2-${STAMP}`, fullName: 'مدرب في الطور', email: `oa-t2-${STAMP}@test.local`, status: 'onboarding', motivation: 'اختبار', privacyConsentAt: new Date() },
  })
  onboardingId = (await prisma.trainerProfile.create({ data: { applicationId: onboarding.id, isVerified: true } })).id
  await prisma.trainerCourseQualification.create({ data: { profileId: onboardingId, courseId, status: 'pending' } })

  winterId = (await prisma.term.create({ data: { year: 2093, season: 'nov_jan', titleAr: 'شتاء تجربة', startsOn: new Date('2093-11-01'), endsOn: new Date('2094-01-31') } })).id
  springId = (await prisma.term.create({ data: { year: 2094, season: 'feb_apr', titleAr: 'ربيع تجربة', startsOn: new Date('2094-02-01'), endsOn: new Date('2094-04-30') } })).id

  await cohort('جاهزة شتاء', { termId: winterId, approved: true })
  await cohort('جاهزة ربيع', { termId: springId, approved: true })
  await cohort('معتمدة بلا سعة', { termId: winterId, approved: true, ready: false })
  await cohort('منقولة', { termId: winterId, approved: true, moved: true })
  await cohort('غير معتمدة', { termId: winterId })
  await cohort('بلا مدرب', { termId: winterId, approved: true, trainer: null })
  await cohort('شعبة إعداد', { termId: winterId, approved: true, trainer: onboardingId })
}, 240_000)

describe('افتح المعتمدة كلها', () => {
  it('① المعاينة تسمي كل شيء ولا تغير شيئا — من كل المواسم', async () => {
    const p = await svc.preview()
    expect(titles(p.toOpen)).toEqual(['جاهزة ربيع', 'جاهزة شتاء', 'معتمدة بلا سعة'])
    expect(p.toOpen.find((c) => c.title.startsWith('معتمدة بلا سعة'))?.ready).toBe(false)
    expect(titles(p.moved), 'المنقولة لم تسم').toEqual(['منقولة'])
    expect(await statusOf('جاهزة شتاء')).toBe('draft')
  })

  it('② والباب الإداري يعاين للمدير الأكاديمي', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/cohorts/open-approved', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    expect(titles(res.json().moved)).toEqual(['منقولة'])
  })

  it('③ التنفيذ يفتح الجاهزة ولا يمس المنقولة ولا غير المعتمدة ولا ما بلا مدرب ولا شعبة الإعداد', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/cohorts/open-approved', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    const r = res.json()
    expect(r.opened).toBe(2)
    expect(r.moved).toBe(1)
    expect(r.failed.map((f: { title: string }) => f.title)).toEqual([`معتمدة بلا سعة ${STAMP}`])
    expect(await statusOf('جاهزة شتاء')).toBe('open')
    expect(await statusOf('جاهزة ربيع')).toBe('open')
    for (const k of ['معتمدة بلا سعة', 'منقولة', 'غير معتمدة', 'بلا مدرب', 'شعبة إعداد']) {
      expect(await statusOf(k), `فتحت ${k}`).toBe('draft')
    }
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.open_approved', actorId: adminId } })).toBe(1)
  })
})
