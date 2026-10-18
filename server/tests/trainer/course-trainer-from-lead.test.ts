/* مدرّبُ الدورة في صفحتها من أصيل شعبتها — لا من الإسناد اليدويّ وحدَه (١٨ أكتوبر ٢٠٢٦).

   كان `publicCourseTrainer` يقرأ `TrainerCourseAssignment` وحدَه، ولا يكتبه إلّا الإسنادُ اليدويّ. والطريقُ الذي تُفتح
   به الشعبُ اليوم — شعبةُ إعدادٍ يُكتب مدرّبُها أصيلا (`trainer-prep.service.ts`) — لا يكتبه أبدا: فتقول بطاقةُ الدورة
   «سيتم تعيين المدرب قريبا» وشعبتُها مفتوحةٌ بمدرّبها. وهنا على قاعدةٍ حقيقيّة ومن المسار العامّ نفسِه:

   ① أصيلُ شعبةٍ مفتوحةٍ بلا إسنادٍ يُعلَن باسمه.
   ② والإسنادُ وحدَه (حيث لا أصيل) يُعلَن كما كان.
   ③ ولا يُعلَن: مسوّدةٌ، ولا مدرّبٌ لم يُعتمد ظهورُه، ولا مساعدٌ وحدَه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'

let prisma: PrismaClient
let app: FastifyInstance
let courses: string[] = []
let seq = 0

async function trainer(name: string, visible = true) {
  seq += 1
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-CTL-${Date.now()}-${seq}`, fullName: name, email: `ctl-${seq}-${Date.now()}@test.local`, status: 'active' },
  })
  return (await prisma.trainerProfile.create({
    data: {
      applicationId: application.id, headline: 'مدرّب تفاوض',
      ...(visible ? { publicVisibility: true, isVerified: true, publishApprovedAt: new Date() } : {}),
    },
  })).id
}
async function cohort(courseId: string, status: string) {
  seq += 1
  return (await prisma.cohort.create({ data: { courseId, title: `شعبة ${seq}`, status, capacity: 20 } })).id
}
const announced = async (courseId: string) =>
  (await app.inject({ method: 'GET', url: `/api/courses/${encodeURIComponent(courseId)}/trainer` })).json() as
    { announced: boolean; trainers: { id: string; name: string }[] }

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  courses = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' } }))
    .map((c) => c.id).slice(4, 10)
}, 240_000)

describe('① أصيلُ الشعبة المفتوحة يُعلَن', () => {
  it('⚠️ شعبةُ إعدادٍ فُتحت: أصيلُها بلا إسنادٍ يدويّ — يُعلَن باسمه', async () => {
    const c = courses[0]!
    const t = await trainer('مدرّبة الإعداد')
    const id = await cohort(c, 'open')
    await prisma.cohortTrainer.create({ data: { cohortId: id, profileId: t, role: 'lead' } })
    expect(await prisma.trainerCourseAssignment.count({ where: { cohortId: id } })).toBe(0)
    const r = await announced(c)
    expect(r.announced, 'قيل «سيتم تعيين المدرب قريبا» وشعبتها مفتوحة بمدرّبها').toBe(true)
    expect(r.trainers).toEqual([expect.objectContaining({ id: t, name: 'مدرّبة الإعداد' })])
  })
})

describe('② والإسنادُ وحدَه يُعلَن كما كان', () => {
  it('⚠️ شعبةٌ بإسنادٍ نشطٍ ولا أصيلَ لها', async () => {
    const c = courses[1]!
    const t = await trainer('مدرّب بإسناد')
    const id = await cohort(c, 'active')
    await prisma.trainerCourseAssignment.create({ data: { cohortId: id, courseId: c, profileId: t } })
    expect((await announced(c)).trainers.map((x) => x.id)).toEqual([t])
  })
})

describe('③ وما لا يُعلَن', () => {
  it('⚠️ مسوّدةٌ بأصيلها — لا تُباع فلا يُعلَن مدرّبُها', async () => {
    const c = courses[2]!
    const id = await cohort(c, 'draft')
    await prisma.cohortTrainer.create({ data: { cohortId: id, profileId: await trainer('مدرّب مسوّدة'), role: 'lead' } })
    expect((await announced(c)).announced).toBe(false)
  })

  it('⚠️ مدرّبٌ لم يُعتمد ظهورُه — ولو كان أصيلَ شعبةٍ مفتوحة', async () => {
    const c = courses[3]!
    const id = await cohort(c, 'open')
    await prisma.cohortTrainer.create({ data: { cohortId: id, profileId: await trainer('مدرّب مخفيّ', false), role: 'lead' } })
    expect((await announced(c)).announced).toBe(false)
  })

  it('ومساعدٌ وحدَه لا يُعلَن مدرّبا للدورة', async () => {
    const c = courses[4]!
    const id = await cohort(c, 'open')
    await prisma.cohortTrainer.create({ data: { cohortId: id, profileId: await trainer('مدرّب مساعد'), role: 'assistant' } })
    expect((await announced(c)).announced).toBe(false)
  })
})
