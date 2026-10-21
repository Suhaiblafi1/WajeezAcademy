/* «قبل إطلاق الحملة» بقاعدةٍ حقيقيّة — الشعبةُ المنقولةُ لا تُعدّ مفتوحة (٢١ أكتوبر ٢٠٢٦).
   قولُ صاحب المنصّة: «لماذا يظهر في الإيميلات الدوراتُ التي قام المدرّبُ بنقلها فعلا وكأنّها من دوراته المفتوحة؟».
   الشعبةُ المنقولةُ تبقى `open` وتُزاح مواعيدُها، فالحكمُ لطلب النقل لا لحال الشعبة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { PrepReminderService } from '../../services/prep-reminder.service'

const STAMP = Date.now()
let prisma: PrismaClient
let profileId = ''
let adminId = ''
let courseId = ''

async function cohort(key: string, move?: 'approved' | 'pending' | 'rejected') {
  const c = await prisma.cohort.create({ data: { courseId, title: `${key} ${STAMP}`, status: 'open', registrationOpen: true } })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
  if (move) {
    await prisma.cohortMoveRequest.create({
      data: { cohortId: c.id, requestedBy: adminId, toYear: 2094, toSeason: 'feb_apr', reason: 'نقل', status: move },
    })
  }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  adminId = (await new AuthService(prisma).register(`moved-admin-${STAMP}@test.local`, 'Admin#12345', 'مدير')).userId
  courseId = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, select: { id: true } })).id
  const app = await prisma.trainerApplication.create({
    data: { reference: `TR-MOVED-${STAMP}`, fullName: 'مدربة النقل', email: `moved-${STAMP}@test.local`, status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: app.id } })).id
  await prisma.trainerContract.create({ data: { profileId, title: 'عقد', status: 'countersigned' } })
  await cohort('مفتوحة')
  await cohort('منقولة', 'approved')
  await cohort('تنتظر نقلها', 'pending')
  await cohort('رد نقلها', 'rejected')
}, 240_000)

describe('الشعب المنقولة في رسالة قبل الحملة', () => {
  it('المنقولة والمنتظر نقلها خارج المفتوحة، والمردود نقلها مفتوحة', async () => {
    const row = (await new PrepReminderService(prisma).list()).find((r) => r.profileId === profileId)
    expect(row, 'لا سطر للمدربة — صورتها ناقصة فتستحق الرسالة').toBeTruthy()
    expect(row!.facts.openCohorts.sort()).toEqual([`رد نقلها ${STAMP}`, `مفتوحة ${STAMP}`].sort())
    expect(row!.facts.moved.map((m) => [m.title, m.pending]).sort()).toEqual([[`تنتظر نقلها ${STAMP}`, true], [`منقولة ${STAMP}`, false]].sort())
  })
  it('والرسالة تقولها منقولة لا مفتوحة', async () => {
    const p = await new PrepReminderService(prisma).preview(profileId, '2093-11-01')
    const openPart = p.text.slice(p.text.indexOf('مفتوحة للتسجيل'), p.text.indexOf('نقلتها إلى موسم قادم'))
    expect(openPart).toContain(`مفتوحة ${STAMP}`)
    expect(openPart, 'المنقولة سردت مع المفتوحة').not.toContain(`منقولة ${STAMP}`)
    expect(p.text).toContain(`منقولة ${STAMP} (`)
    expect(p.text).toContain(`تنتظر نقلها ${STAMP} (طلبت نقلها إلى`)
  })
})
