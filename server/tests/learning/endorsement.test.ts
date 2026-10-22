/* خطابُ توصيةٍ من الأكاديمية يُستحقّ مع الشهادة (٢٢ أكتوبر ٢٠٢٦) — والعلّةُ في رأس `src/application/learning/endorsement.ts`.

   ① **يصدر مع الشهادة لمن استحقّه** — حضورٌ ٨٠٪ فأكثر ومهامُّه كلُّها — بأرقامه ومهارات الدورة وساعاتها، ورقمٍ
      عشوائيّ، وأثرٍ مكتوب، وخبرٍ لصاحبه.
   ② **ولا يصدر** لمن حضر أقلّ، ولا لمن بقيت عليه مهمّة — وشهادتُه تصدر كما كانت.
   ③ **وما صدر قبل الخطاب يلحقه** حين يفتح صاحبُه «شهاداتي» — مرّةً واحدة.
   ④ **وصفحتُه العامّة** تقول أرقامَه وتُسجَّل تحقّقا من شهادته؛ وشهادةٌ مسحوبةٌ تجعله ملغى ولا يُعرض في «شهاداتي». */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CertificateService } from '../../services/certificate.service'
import { EndorsementService } from '../../services/endorsement.service'

let prisma: PrismaClient
let auth: AuthService
let certs: CertificateService
let letters: EndorsementService
let cohortId = ''
let ownerId = ''
let seq = 0

const STAMP = Date.now()
const COURSE = `C-END-${STAMP}`
const TITLE = 'إدارة فرق العمل'
const SKILLS = ['تفويض المهام', 'إدارة الاجتماعات', 'التغذية الراجعة']
const NUMBER = /^WJ-REC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/

/** متعلّمٌ موثَّقُ البريد في الشعبة، ودليلُ تقدّمه كما يحفظه `recomputeProgress` */
async function learner(evidence: Record<string, number>) {
  seq += 1
  const { userId } = await auth.register(`end-${seq}-${STAMP}@test.local`, 'Learner#12345', `متعلم ${seq}`)
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } })
  const e = await prisma.enrollment.create({ data: { userId, cohortId, status: 'enrolled' } })
  await prisma.courseProgress.create({ data: { enrollmentId: e.id, percent: 90, evidence } })
  return { userId, enrollmentId: e.id }
}
const earned = { attendancePct: 85, assignmentsAccepted: 3, assignmentsTotal: 3, assessmentsPassed: 1, assessmentsTotal: 1 }
const letterOf = (certificateId: string) => prisma.endorsementLetter.findUnique({ where: { certificateId } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  certs = new CertificateService(prisma)
  letters = new EndorsementService(prisma)
  ownerId = (await auth.register(`end-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId

  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({ data: { courseId: COURSE, version: 1, titleAr: TITLE, totalHours: 24, status: 'approved' } })
  for (const [i, nameAr] of SKILLS.entries()) {
    const id = `SK-END-${STAMP}-${i}`
    await prisma.skill.create({ data: { id, slug: id.toLowerCase(), nameAr } })
    await prisma.courseSkillLink.create({ data: { courseId: COURSE, skillId: id, sequence: i } })
  }
  const cohort = await prisma.cohort.create({
    data: {
      courseId: COURSE, title: `شعبة الخطاب ${STAMP}`, status: 'active', registrationOpen: false, financialReady: true,
      price: 100, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() - 30 * 86_400_000),
    },
  })
  cohortId = cohort.id
}, 240_000)

describe('① يصدر مع الشهادة لمن استحقه', () => {
  it('⚠️ بأرقامه ومهارات الدورة وساعاتها ورقم عشوائي وأثر — وخبر لصاحبه', async () => {
    const a = await learner(earned)
    const cert = await certs.issue(a.enrollmentId, ownerId)
    const letter = await letterOf(cert.id)
    expect(letter, 'لم يصدر لمن حضر وأنجز').not.toBeNull()
    expect(letter!.number).toMatch(NUMBER)
    expect(letter).toMatchObject({ attendancePct: 85, tasksDone: 4, tasksTotal: 4, totalHours: 24 })
    expect(letter!.skills).toEqual(SKILLS)
    expect(await prisma.auditEvent.count({ where: { action: 'certificate.endorse', entityId: cert.id } })).toBe(1)
    const note = await prisma.notification.findFirst({ where: { userId: a.userId, templateKey: 'certificate.endorsed' } })
    expect(note?.body, 'لم يخبر صاحبه بخطابه').toContain('خطاب توصية')
  })
})

describe('② ولا يصدر لمن لم يستحقه — وشهادته تصدر كما كانت', () => {
  it('⚠️ حضور 79% أو مهمة باقية — شهادة بلا خطاب', async () => {
    const low = await learner({ ...earned, attendancePct: 79 })
    const lowCert = await certs.issue(low.enrollmentId, ownerId)
    expect(await letterOf(lowCert.id), 'صدر لمن حضر أقل من 80%').toBeNull()

    const short = await learner({ ...earned, assignmentsAccepted: 2 })
    const shortCert = await certs.issue(short.enrollmentId, ownerId)
    expect(await letterOf(shortCert.id), 'صدر لمن بقيت عليه مهمة').toBeNull()

    expect(await prisma.notification.count({ where: { userId: low.userId, templateKey: 'certificate.endorsed' } })).toBe(0)
    expect(await prisma.notification.count({ where: { userId: low.userId, templateKey: 'certificate.issued' } }), 'لم تصدر شهادته').toBe(1)
  })
})

describe('③ وما صدر قبل الخطاب يلحقه في «شهاداتي»', () => {
  it('⚠️ يصدر حين يفتحها — مرة واحدة', async () => {
    const old = await learner(earned)
    const cert = await prisma.certificate.create({
      data: { number: `WJ-CERT-2026-${String(70_000 + (STAMP % 1000))}`, enrollmentId: old.enrollmentId, learnerName: 'متعلم قديم', courseId: COURSE, courseVersion: 1 },
    })
    expect(await letterOf(cert.id)).toBeNull()
    const first = (await certs.myCertificates(old.userId)).find((c) => c.id === cert.id)
    expect(first?.endorsementNumber, 'لم يلحقه الخطاب').toMatch(NUMBER)
    const again = (await certs.myCertificates(old.userId)).find((c) => c.id === cert.id)
    expect(again?.endorsementNumber).toBe(first?.endorsementNumber)
    expect(await prisma.endorsementLetter.count({ where: { certificateId: cert.id } })).toBe(1)
  })
})

describe('④ صفحته العامة', () => {
  it('⚠️ تقول أرقامه وتسجل تحققا من شهادته — والشهادة المسحوبة تجعله ملغى', async () => {
    const a = await learner(earned)
    const cert = await certs.issue(a.enrollmentId, ownerId)
    const number = (await letterOf(cert.id))!.number
    const before = await prisma.certificateVerification.count({ where: { certificateId: cert.id } })
    const v = await letters.view(number.toLowerCase())
    expect(v).toMatchObject({ courseTitle: TITLE, attendancePct: 85, tasksDone: 4, tasksTotal: 4, status: 'active', certificateNumber: cert.number })
    expect(await prisma.certificateVerification.count({ where: { certificateId: cert.id } })).toBe(before + 1)

    await certs.revoke(cert.id, ownerId, 'خطأ في بيانات الإتمام')
    const after = await letters.view(number)
    expect(after.status).toBe('revoked')
    expect(after.revokedReason).toBe('خطأ في بيانات الإتمام')
    const mine = (await certs.myCertificates(a.userId)).find((c) => c.id === cert.id)
    expect(mine?.endorsementNumber, 'عرض خطاب شهادة مسحوبة').toBeNull()
    await expect(letters.view('WJ-REC-AAAA-AAAA')).rejects.toMatchObject({ code: 'not_found' })
  })
})
