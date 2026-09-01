/* الشهادةُ تُصدَر من قائمةٍ لا من معرّفٍ يُلصق.

   كانت الشاشةُ تطلب «معرّف التسجيل (UUID)» يُكتب يدا ولا شاشةَ تعرضه. فمن
   أراد أن يُصدر شهادةً لطالبٍ أنهى دورتَه احتاج أن يستخرج معرّفا من مكانٍ
   آخر — والزرُّ يُضغط ثمّ يُردّ بقائمةِ قواعدَ لم يعرفها قبل الضغط.

   وقرارُ صاحب المنصّة: «فلتر القائمة افتراضيا لمن أنهى فعلا».

   والحارسُ هنا على شيءٍ واحد قبل كلِّ شيء: **ألّا تقول القائمةُ «مؤهَّل» ثمّ
   يرفض الإصدار**. فالأهليّةُ تُحسب بالقواعد نفسِها التي يفحصها الإصدار، لا
   بقاعدةٍ ثانية تُشبهها — وقائمةٌ تكذب أسوأ من لا قائمة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { CertificateService } from '../../services/certificate.service'

let prisma: PrismaClient
let certificates: CertificateService
let cohortId = ''
let readyId = ''      // أنهى ووثّق بريده
let unverifiedId = '' // أنهى وبريدُه غير موثَّق
let notDoneId = ''    // لم يستوفِ القواعد

const ADMIN = '44444444-4444-4444-8444-444444444444'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  certificates = new CertificateService(prisma)
  const auth = new AuthService(prisma)
  const enrollments = new EnrollmentService(prisma)

  const cohort = await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: 'شعبة الشهادات', status: 'active',
      registrationOpen: true, financialReady: true,
      price: 100, currency: 'USD', capacity: 30,
      startsAt: new Date(Date.now() - 30 * 86_400_000),
    },
  })
  cohortId = cohort.id

  /* قاعدةُ إكمالٍ واحدة تُقاس عليها الثلاثة */
  await prisma.completionRule.create({
    data: { courseId: 'C-BIZ-101', cohortId, type: 'modules_completed', threshold: 1, required: true },
  })

  const mk = async (email: string, name: string, verified: boolean) => {
    const u = await auth.register(email, 'Learner#12345', name)
    if (verified) await prisma.user.update({ where: { id: u.userId }, data: { emailVerifiedAt: new Date() } })
    const e = await enrollments.enroll(cohortId, u.userId, null, {})
    return e.id
  }

  readyId = await mk('cert-ready@test.local', 'من أنهى', true)
  unverifiedId = await mk('cert-unverified@test.local', 'بلا توثيق', false)
  notDoneId = await mk('cert-notdone@test.local', 'لم يُنهِ', true)

  /* من أنهى: دليلُ إكمالِ وحدةٍ يفي بالقاعدة */
  for (const id of [readyId, unverifiedId]) {
    await prisma.courseProgress.upsert({
      where: { enrollmentId: id },
      update: { percent: 100, evidence: { modulesCompleted: 5 } },
      create: { enrollmentId: id, percent: 100, evidence: { modulesCompleted: 5 } },
    })
  }
}, 240_000)

describe('القائمةُ تقول الحقيقةَ عن الأهليّة', () => {
  it('من أنهى ووثّق بريده مؤهَّل', async () => {
    const row = (await certificates.candidates(cohortId)).find((r) => r.enrollmentId === readyId)
    expect(row?.eligible).toBe(true)
    expect(row?.failures).toEqual([])
  })

  it('ومن لم يستوفِ القواعد غيرُ مؤهَّل — وسببُه مكتوب', async () => {
    const row = (await certificates.candidates(cohortId)).find((r) => r.enrollmentId === notDoneId)
    expect(row?.eligible).toBe(false)
    expect(row?.failures.length, 'رُفض بلا سبب يُقرأ').toBeGreaterThan(0)
  })

  /* حاجزُ البريد صارمٌ في الإصدار — فيُعرض هنا سببا لا مفاجأةً بعد الضغط */
  it('ومن لم يوثّق بريده غيرُ مؤهَّل، ويُقال له لماذا قبل الضغط', async () => {
    const row = (await certificates.candidates(cohortId)).find((r) => r.enrollmentId === unverifiedId)
    expect(row?.eligible).toBe(false)
    expect(row?.failures.join(' ')).toContain('غير موثَّق')
  })

  it('والمؤهَّلُ بلا شهادةٍ أوّلا — وهو من فُتحت الشاشةُ لأجله', async () => {
    const rows = await certificates.candidates(cohortId)
    expect(rows[0].enrollmentId).toBe(readyId)
  })
})

describe('ولا تقول «مؤهَّل» ثمّ يرفض الإصدار', () => {
  /* هذا هو الحارسُ الأهمّ: قائمةٌ تُحسب بقاعدةٍ والإصدارُ يفحص أخرى تكذب
     على من يقرؤها — وهي أسوأ من لا قائمة. */
  it('كلُّ من قالت القائمةُ إنّه مؤهَّل تُصدَر شهادتُه فعلا', async () => {
    const eligible = (await certificates.candidates(cohortId)).filter((r) => r.eligible && !r.certificate)
    expect(eligible.length).toBeGreaterThan(0)
    for (const r of eligible) {
      const cert = await certificates.issue(r.enrollmentId, ADMIN)
      expect(cert.number, 'الرقمُ لا يُولَّد').toMatch(/^WJ-CERT-\d{4}-\d{5}$/)
    }
  })

  it('وكلُّ من قالت إنّه غيرُ مؤهَّل يُردّ فعلا — لا يمرّ صامتا', async () => {
    const blocked = (await certificates.candidates(cohortId)).filter((r) => !r.eligible && !r.certificate)
    expect(blocked.length).toBeGreaterThan(0)
    for (const r of blocked) {
      await expect(certificates.issue(r.enrollmentId, ADMIN)).rejects.toThrow()
    }
  })

  it('ومن صدرت شهادتُه تُقرأ برقمها في القائمة — لا تُصدَر ثانيةً', async () => {
    const row = (await certificates.candidates(cohortId)).find((r) => r.enrollmentId === readyId)
    expect(row?.certificate?.number).toMatch(/^WJ-CERT-/)
    await expect(certificates.issue(readyId, ADMIN)).rejects.toThrow(/مسبقا/)
  })
})

describe('والترقيمُ يصمد على إصدارين معا', () => {
  /* `count() + 1` ليس ذرّيّا: إصداران في اللحظة نفسِها يقرآن العدد نفسَه
     فيبنيان الرقمَ نفسَه، و`@unique` يُسقط الثاني برسالةِ قاعدةِ بيانات لا
     يفهمها من ضغط الزرّ. */
  it('شهادتان تُطلبان في آنٍ واحد تخرجان برقمين', async () => {
    const auth = new AuthService(prisma)
    const enrollments = new EnrollmentService(prisma)
    const ids: string[] = []
    for (const n of [1, 2]) {
      const u = await auth.register(`cert-race-${n}@test.local`, 'Learner#12345', `متسابق ${n}`)
      await prisma.user.update({ where: { id: u.userId }, data: { emailVerifiedAt: new Date() } })
      const e = await enrollments.enroll(cohortId, u.userId, null, {})
      await prisma.courseProgress.upsert({
        where: { enrollmentId: e.id },
        update: { percent: 100, evidence: { modulesCompleted: 5 } },
        create: { enrollmentId: e.id, percent: 100, evidence: { modulesCompleted: 5 } },
      })
      ids.push(e.id)
    }
    const [a, b] = await Promise.all(ids.map((id) => certificates.issue(id, ADMIN)))
    expect(a.number).not.toBe(b.number)
  })
})
