/* فصلُ الشعبة يُنشأ إن لم يكن — ولا تبقى شعبةٌ معروفُ موسمها «بلا فصل» (١٨ أكتوبر ٢٠٢٦).

   ١) صفُّ الفصل يُنشأ «مخطَّطا» بحدوده، ولا يُكرَّر.
   ٢) ولا تُعاد شعبةٌ إلى فصلٍ أُغلق.
   ٣) ما سقط قبل الإصلاح يُملأ: المعتمدةُ من بدئها، والمؤجَّلةُ من يوم تأجيلها — وما لا خطّةَ له لا يُخمَّن. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { assignMissingTerms, ensureTerm, ensureTermOf } from '../../services/term-ensure'

const STAMP = Date.now()
let prisma: PrismaClient
let courseId = ''
let profileId = ''

async function cohort(title: string, startsAt: Date | null, plan?: { status: string; postponedTo?: Date }, status = 'draft') {
  const c = await prisma.cohort.create({ data: { courseId, title: `${title} ${STAMP}`, status, startsAt } })
  if (plan) {
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId: c.id, trainerId: profileId, status: plan.status, postponedTo: plan.postponedTo ?? null, content: { kind: 'trainer', modules: [] } as never },
    })
  }
  return c.id
}

const termOfCohort = async (id: string) =>
  (await prisma.cohort.findUniqueOrThrow({ where: { id }, select: { term: { select: { year: true, season: true } } } })).term

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  courseId = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, select: { id: true } })).id
  const app = await prisma.trainerApplication.create({
    data: { reference: `TR-TE-${STAMP}`, fullName: 'مدرب الفصول', email: `te-${STAMP}@test.local`, status: 'active', motivation: 'اختبار', privacyConsentAt: new Date() },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: app.id, isVerified: true } })).id
}, 240_000)

describe('فصل الشعبة', () => {
  it('ينشأ مخططا بحدوده ولا يكرر', async () => {
    const a = await ensureTerm(prisma, { year: 2093, season: 'feb_apr' })
    const b = await ensureTerm(prisma, { year: 2093, season: 'feb_apr' })
    expect(b.id).toBe(a.id)
    const t = await prisma.term.findUniqueOrThrow({ where: { id: a.id } })
    expect(t.status).toBe('planned')
    expect(t.startsOn.toISOString().slice(0, 10)).toBe('2093-02-01')
  })

  it('ولا تعاد شعبة إلى فصل أغلق', async () => {
    const t = await ensureTerm(prisma, { year: 2093, season: 'may_jul' })
    await prisma.term.update({ where: { id: t.id }, data: { status: 'closed' } })
    expect(await ensureTermOf(prisma, new Date('2093-06-10T00:00:00Z'))).toBeNull()
  })

  it('ما سقط قبل الإصلاح يملأ — وما لا خطة له لا يخمن', async () => {
    await prisma.term.deleteMany({ where: { year: { in: [2094, 2095] } } })
    const approved = await cohort('معتمدة', new Date('2094-12-05T00:00:00Z'), { status: 'approved' })
    const postponed = await cohort('مؤجلة', new Date('2094-12-05T00:00:00Z'), { status: 'changes_requested', postponedTo: new Date('2095-02-01T00:00:00Z') })
    const bare = await cohort('بلا خطة', new Date('2094-12-05T00:00:00Z'))
    const cancelled = await cohort('ملغاة', new Date('2094-12-05T00:00:00Z'), { status: 'approved' }, 'cancelled')

    expect(await assignMissingTerms(prisma)).toBeGreaterThanOrEqual(2)
    expect(await termOfCohort(approved), 'المعتمدة بقيت بلا فصل').toEqual({ year: 2094, season: 'nov_jan' })
    expect(await termOfCohort(postponed), 'المؤجلة لم تسم بموسم تأجيلها').toEqual({ year: 2095, season: 'feb_apr' })
    expect(await termOfCohort(bare)).toBeNull()
    expect(await termOfCohort(cancelled)).toBeNull()
  })
})
