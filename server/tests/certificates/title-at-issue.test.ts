/* الشهادةُ تحمل اسمَ دورتها يومَ صدرت — لا اسمَها اليوم.

   العطب: الشهادةُ تكتب في صفِّها `courseId` و`courseVersion` وقتَ الإصدار —
   لقطةٌ صحيحةٌ محفوظة — ثمّ كان `verify` **يتجاهلها** ويقرأ العنوانَ من
   `course.versions[0]`، أي من آخرِ إصدارٍ للدورة أيًّا كان وأيًّا متى صار.

   فأيُّ إعادةِ تسميةٍ لدورةٍ تُعيد تسميةَ كلِّ شهادةٍ صدرت قبلها — في صفحة
   التحقّق العامّة نفسِها التي يفتحها صاحبُ عملٍ ليتأكّد. والشهادةُ دعوى
   المنصّة على صاحبها في لحظةٍ بعينها؛ لا تُكتب بعد تسليمها من جديد.

   ولم يكن بابا نظريّا: `cohort-plan.service` كان يُطبّق اقتراحَ المدرّب
   بـ`updateMany` على النسخة الحاليّة — تبديلٌ واحدٌ يعتمده مديرٌ فيُعاد
   تسميةُ شهاداتٍ مسلَّمة. زال ذلك البابُ، ويبقى هذا الحارسُ لأنّ البابَ لم
   يكن وحدَه: `trainer-change` تُنشئ نسخةً جديدة، والمستوردُ يُحدّث.

   والفحصُ **بنيويٌّ لا نصّيّ**: تُبنى دورةٌ بنسختَين مختلفتَي الاسم،
   وتُصدَر شهادةٌ على الأولى، ثمّ يُطلب الاسم. فمن أعاد القراءةَ إلى
   «آخرِ إصدار» رأى الاسمَ الثاني وسقط — ولا يُنقذه تطابقُ حرفٍ في تعليق. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CertificateService } from '../../services/certificate.service'

let prisma: PrismaClient
let auth: AuthService
let certs: CertificateService
let cohortId = ''
let userId = ''
let number = ''
let otherNumber = ''

const STAMP = Date.now()
const COURSE = `C-VER-${STAMP}`
const OTHER = `C-VER2-${STAMP}`
const AT_ISSUE = 'إدارةُ المشاريع الصغيرة'
const RENAMED = 'قيادةُ المشاريع الرشيقة'
const OTHER_TITLE = 'أساسيّاتُ التحليل الماليّ'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  certs = new CertificateService(prisma)

  /* دورةٌ نسختُها الحاليّةُ الثانية، واسمُها فيهما مختلف */
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 2 } })
  await prisma.courseVersion.create({
    data: { courseId: COURSE, version: 1, titleAr: AT_ISSUE, totalHours: 20, status: 'approved' },
  })
  await prisma.courseVersion.create({
    data: { courseId: COURSE, version: 2, titleAr: RENAMED, totalHours: 20, status: 'approved' },
  })

  const cohort = await prisma.cohort.create({
    data: {
      courseId: COURSE, title: `شعبةُ حرسِ اسمِ الشهادة ${STAMP}`, status: 'active',
      registrationOpen: false, financialReady: true, price: 100, currency: 'JOD', capacity: 20,
      startsAt: new Date(Date.now() - 30 * 86_400_000),
    },
  })
  cohortId = cohort.id

  const registered = await auth.register(`cert-title-${STAMP}@test.local`, 'Learner#12345', 'صاحبُ الشهادة')
  userId = registered.userId
  const enrollment = await prisma.enrollment.create({ data: { userId, cohortId, status: 'completed' } })

  /* الشهادةُ صدرت على **النسخة الأولى** — واسمُها يومَها `AT_ISSUE` */
  number = `WJ-CERT-2026-${String(80_000 + (STAMP % 1000))}`
  await prisma.certificate.create({
    data: {
      number, enrollmentId: enrollment.id, learnerName: 'صاحبُ الشهادة',
      courseId: COURSE, courseVersion: 1,
    },
  })

  /* وشهادةٌ ثانيةٌ لصاحبها نفسِه على دورةٍ أخرى — بها وحدَها يُفحَص الربط */
  await prisma.course.create({ data: { id: OTHER, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({
    data: { courseId: OTHER, version: 1, titleAr: OTHER_TITLE, totalHours: 12, status: 'approved' },
  })
  const otherCohort = await prisma.cohort.create({
    data: {
      courseId: OTHER, title: `شعبةٌ ثانيةٌ ${STAMP}`, status: 'active',
      registrationOpen: false, financialReady: true, price: 100, currency: 'JOD', capacity: 20,
      startsAt: new Date(Date.now() - 30 * 86_400_000),
    },
  })
  const otherEnrollment = await prisma.enrollment.create({
    data: { userId, cohortId: otherCohort.id, status: 'completed' },
  })
  otherNumber = `WJ-CERT-2026-${String(82_000 + (STAMP % 1000))}`
  await prisma.certificate.create({
    data: {
      number: otherNumber, enrollmentId: otherEnrollment.id, learnerName: 'صاحبُ الشهادة',
      courseId: OTHER, courseVersion: 1,
    },
  })
})

describe('اسمُ الدورة في الشهادة هو اسمُها وقتَ الإصدار', () => {
  it('التحقّقُ العامُّ يعرض اسمَ النسخة المذكورة في الشهادة لا آخرَ نسخة', async () => {
    const out = await certs.verify(number)
    expect(out.courseVersion).toBe(1)
    expect(out.courseTitle).toBe(AT_ISSUE)
    /* والصريحُ أهمُّ من الضمنيّ: الاسمُ الجديدُ موجودٌ في القاعدة ولم يُقرأ */
    expect(out.courseTitle).not.toBe(RENAMED)
  })

  /* وشهادتان لصاحبٍ واحدٍ لا شهادةٌ واحدة — وإلّا كان الحارسُ زينة.

     بشهادةٍ واحدةٍ يمرّ كلُّ ربطٍ خاطئ: «أوّلُ عنوانٍ وجدتَه» و«آخرُه»
     و«الصحيح» كلُّها تعطي الجوابَ نفسَه، فلا يُفحَص الربطُ أصلا. جُرّبت
     الحالةُ الواحدةُ فمرّت على ربطٍ مكسورٍ عمدا — فوُسّعت. */
  it('«شهاداتي» تربط كلَّ شهادةٍ باسمِ دورتها هي — لا باسمِ جارتها', async () => {
    const mine = await certs.myCertificates(userId)
    const first = mine.find((c) => c.number === number)
    const second = mine.find((c) => c.number === otherNumber)
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(first!.courseTitle).toBe(AT_ISSUE)
    expect(second!.courseTitle).toBe(OTHER_TITLE)
    /* ولا رمزَ في الشاشة: الرمزُ هو ما كانت تعرضه قبل هذا العمل */
    expect(first!.courseTitle).not.toBe(first!.courseId)
  })

  it('إعادةُ التسمية بعد الإصدار لا تبلغ الشهادة', async () => {
    /* نسخةٌ ثالثةٌ باسمٍ ثالث، وتصير هي الحاليّة — والشهادةُ لا تتحرّك */
    await prisma.courseVersion.create({
      data: { courseId: COURSE, version: 3, titleAr: 'اسمٌ ثالثٌ بعدهما', totalHours: 20, status: 'approved' },
    })
    await prisma.course.update({ where: { id: COURSE }, data: { currentVersion: 3 } })
    const out = await certs.verify(number)
    expect(out.courseTitle).toBe(AT_ISSUE)
  })

  it('نسخةٌ مفقودةٌ تُعيد الرمزَ صريحا — لا اسما يبدو صحيحا وليس هو', async () => {
    const orphan = `WJ-CERT-2026-${String(81_000 + (STAMP % 1000))}`
    const e = await prisma.enrollment.create({
      data: {
        userId: (await auth.register(`cert-orphan-${STAMP}@test.local`, 'Learner#12345', 'صاحبٌ آخر')).userId,
        cohortId, status: 'completed',
      },
    })
    await prisma.certificate.create({
      data: {
        number: orphan, enrollmentId: e.id, learnerName: 'صاحبٌ آخر',
        /* نسخةٌ لا صفَّ لها — والشهادةُ صادرةٌ فلا تُخفى */
        courseId: COURSE, courseVersion: 99,
      },
    })
    const out = await certs.verify(orphan)
    expect(out.courseTitle).toBe(COURSE)
  })
})
