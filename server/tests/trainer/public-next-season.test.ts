/* بطاقةُ المدرّب العامّة: ما يقدّمه للموسم القادم وحدَه، بموسمه — على قاعدةٍ حقيقيّة (١٩ أكتوبر ٢٠٢٦).

   «لماذا تظهر كلُّ الدورات للمدرّب وليس للموسم القادم؟» (صاحب المنصّة).
   ① المفتوحةُ للتسجيل والممتلئةُ تُعرض تحت موسمها، والأقربُ أوّلا.
   ② ولا تُعرض: الجاريةُ والمنتهيةُ والمسوّدة، ولا إسنادٌ بلا شعبةٍ تُباع، ولا مسارٌ منشورٌ بلا موسم.
   ③ ومسارُه المنشورُ لموسمٍ مسمّى يُعرض في موسمه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerReviewService } from '../../services/trainer-review.service'

const ACTOR = '00000000-0000-0000-0000-000000000009'
let prisma: PrismaClient
let review: TrainerReviewService
let profileId = ''
let c: string[] = []

type Card = { id: string; offer: { termAr: string | null; courseIds: string[] }[]; assignedCourseIds: string[] }
const card = async () => (await review.listPublicTrainers() as unknown as Card[]).find((t) => t.id === profileId)!

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  review = new TrainerReviewService(prisma)
  c = (await prisma.course.findMany({ where: { status: 'published' }, take: 9, orderBy: { id: 'asc' }, select: { id: true } })).map((x) => x.id)
  profileId = (await review.createTrainerDirectly(ACTOR, { fullName: 'مدربة المواسم', email: 'next-season@test.local' })).profileId
  await review.approvePublicVisibility(profileId, ACTOR)

  const term = (year: number, season: string, startsOn: string, endsOn: string) => prisma.term.upsert({
    where: { year_season: { year, season } }, update: {},
    create: { year, season, titleAr: `${season} ${year}`, startsOn: new Date(startsOn), endsOn: new Date(endsOn) },
  })
  const winter = await term(2096, 'nov_jan', '2096-11-01', '2097-01-31')
  const spring = await term(2097, 'feb_apr', '2097-02-01', '2097-04-30')
  const lead = async (k: number, status: string, termId: string | null, startsAt: string) => {
    const x = await prisma.cohort.create({ data: { courseId: c[k]!, title: `شعبة ${k}`, status, termId, startsAt: new Date(startsAt) } })
    await prisma.cohortTrainer.create({ data: { cohortId: x.id, profileId, role: 'lead' } })
  }
  await lead(0, 'open', winter.id, '2096-11-05')
  await lead(1, 'full', spring.id, '2097-02-10')
  await lead(2, 'active', winter.id, '2096-11-03')
  await lead(3, 'completed', winter.id, '2096-11-02')
  await lead(4, 'draft', winter.id, '2096-11-04')
  /* وصفُّ فصلها يقول الشتاء ومواعيدُها في الربيع — يراها المشتري في الربيع */
  await lead(8, 'open', winter.id, '2097-02-15')
  await prisma.trainerCourseAssignment.create({ data: { profileId, courseId: c[5]!, status: 'active' } })
  await prisma.trainerPath.create({
    data: { profileId, titleAr: 'مسار الشتاء', status: 'published', publishedAt: new Date(), termId: winter.id, courses: { create: [{ courseId: c[6]!, sequence: 1 }] } },
  })
  await prisma.trainerPath.create({
    data: { profileId, titleAr: 'مسار بلا موسم', status: 'published', publishedAt: new Date(), courses: { create: [{ courseId: c[7]!, sequence: 1 }] } },
  })
}, 240_000)

describe('بطاقة المدرب العامة — الموسم القادم وحده', () => {
  it('⚠️ ① المفتوحة والممتلئة تحت موسمها، والأقرب أولا', async () => {
    const o = (await card()).offer
    expect(o.map((g) => g.termAr)).toEqual(['موسم الشتاء 2096/2097', 'موسم الربيع 2097'])
    expect(o[0]!.courseIds).toContain(c[0])
    expect(o[1]!.courseIds).toContain(c[1])
  })

  it('⚠️ ② لا الجارية ولا المنتهية ولا المسودة، ولا إسناد بلا شعبة، ولا مسار بلا موسم', async () => {
    const ids = (await card()).assignedCourseIds
    for (const k of [2, 3, 4, 5, 7]) expect(ids, `ظهرت الدورة ${k}`).not.toContain(c[k])
  })

  it('⚠️ وموسم الشعبة من مواعيدها لا من صف فصلها', async () => {
    const o = (await card()).offer
    expect(o.find((g) => g.termAr === 'موسم الربيع 2097')?.courseIds, 'قرئ الموسم من صف الفصل').toContain(c[8])
    expect(o[0]!.courseIds).not.toContain(c[8])
  })

  it('③ ومساره المنشور لموسم مسمى في موسمه', async () => {
    expect((await card()).offer[0]!.courseIds.sort()).toEqual([c[0], c[6]].sort())
  })
})
