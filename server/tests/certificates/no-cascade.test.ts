/* الشهادةُ الصادرةُ لا تُمحى بسلسلةِ حذف — والقاعدةُ هي التي ترفض.

   العطب: `Certificate.enrollmentId` كان `ON DELETE CASCADE`. فحذفُ صفِّ
   تسجيلٍ يمحو **شهادةً أُصدرت فعلا**، ورقمُها منشورٌ للناس ويُتحقَّق منه
   برابطٍ عامّ — فيصير الرابطُ يقول «لا شهادةَ بهذا الرقم» عن شهادةٍ صحيحة.
   والشهادةُ ليست أثرا للتسجيل: هي دعوى المنصّة على صاحبها، تبقى وإن انتهى
   تسجيلُه.

   ومئةٌ وخمسَ عشرةَ سلسلةَ حذفٍ في المخطّط، وعشرٌ منها تنطلق من التسجيل.
   وهذه أخطرُها لأنّها وحدَها تمحو شيئا **معلَنا خارج المنصّة**.

   ولماذا الاختبارُ على القاعدة لا على الخدمة: طبقةُ الشيفرة تحرسه فعلا —
   بصمةُ الحساب في `account-purge.service` تعدّ الشهادات وترفض المحوَ إن
   وُجدت. لكنّ حرسا في الشيفرة وحدَها يسقط بأوّل مسارٍ جديدٍ أو سكربتٍ أو
   استعلامٍ يدويّ. و`Restrict` لا يسقط. فيُفحَص القيدُ نفسُه: يُحذف التسجيلُ
   مباشرةً بـPrisma — بلا مرورٍ بأيّ خدمة — ويُنتظَر الرفض.

   وطريقُ السحبِ يبقى مفتوحا: `status: 'revoked'` مع صفٍّ في
   `CertificateRevocation` يحمل السببَ ومن سحبها. فالسحبُ يُقال والمحوُ
   يُخفي — وهذا الاختبارُ يحرس الفرقَ بينهما. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'

let prisma: PrismaClient
let auth: AuthService
let cohortId = ''
const STAMP = Date.now()
const COURSE = 'C-BIZ-101'

/** تسجيلٌ لمتعلّمٍ جديد — يعيد معرّفَه */
let seq = 0
async function enrollment(): Promise<string> {
  seq += 1
  const { userId } = await auth.register(`cert-nc-${seq}-${STAMP}@test.local`, 'Learner#12345', `متعلّم ${seq}`)
  const e = await prisma.enrollment.create({ data: { userId, cohortId, status: 'enrolled' } })
  return e.id
}

async function issue(enrollmentId: string) {
  return prisma.certificate.create({
    data: {
      number: `WJ-CERT-2026-${String(90_000 + seq)}`,
      enrollmentId,
      learnerName: 'اسمُ صاحبها وقتَ الإصدار',
      courseId: COURSE,
      courseVersion: 1,
    },
  })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  const c = await prisma.cohort.create({
    data: {
      courseId: COURSE, title: `شعبةُ حرسِ الشهادة ${STAMP}`, status: 'active',
      registrationOpen: false, financialReady: true, price: 100, currency: 'JOD', capacity: 20,
      startsAt: new Date(Date.now() - 30 * 86_400_000),
    },
  })
  cohortId = c.id
})

describe('الشهادةُ الصادرة لا تُمحى بسلسلةِ حذف', () => {
  it('حذفُ التسجيل يُرفض من القاعدة نفسِها حين تعلّقت به شهادة', async () => {
    const enrollmentId = await enrollment()
    const cert = await issue(enrollmentId)

    /* بلا خدمةٍ ولا مسارٍ: الحذفُ مباشرةً على القاعدة */
    await expect(prisma.enrollment.delete({ where: { id: enrollmentId } })).rejects.toThrow()

    /* والشهادةُ باقيةٌ برقمها — لا نصفَ محوٍ ولا صفٌّ يتيم */
    const still = await prisma.certificate.findUnique({ where: { id: cert.id } })
    expect(still, 'الشهادةُ اختفت رغم رفضِ الحذف').not.toBeNull()
    expect(still?.number).toBe(cert.number)
    /* والتسجيلُ باقٍ كذلك: المعاملةُ رُدّت كلُّها */
    expect(await prisma.enrollment.findUnique({ where: { id: enrollmentId } })).not.toBeNull()
  })

  it('والتسجيلُ بلا شهادةٍ يُحذف كما كان — القيدُ يمنع الضرر لا الحركة', async () => {
    const enrollmentId = await enrollment()
    await prisma.enrollment.delete({ where: { id: enrollmentId } })
    expect(await prisma.enrollment.findUnique({ where: { id: enrollmentId } })).toBeNull()
  })

  it('والسحبُ هو البابُ: تُوسَم «مسحوبة» بسببٍ ومن سحبها، ولا تُمحى', async () => {
    const enrollmentId = await enrollment()
    const cert = await issue(enrollmentId)
    const { userId: adminId } = await auth.register(`cert-nc-admin-${STAMP}@test.local`, 'Admin#12345', 'مدير')

    await prisma.certificate.update({ where: { id: cert.id }, data: { status: 'revoked' } })
    await prisma.certificateRevocation.create({
      data: { certificateId: cert.id, reason: 'أُصدرت على تسجيلٍ خاطئ', revokedBy: adminId },
    })

    const after = await prisma.certificate.findUnique({
      where: { id: cert.id },
      include: { revocation: true },
    })
    /* الرقمُ باقٍ، والرابطُ يقول «مسحوبة» لا «غير موجودة» — والفرقُ هو المقصود */
    expect(after?.status).toBe('revoked')
    expect(after?.revocation?.reason).toBe('أُصدرت على تسجيلٍ خاطئ')
    expect(after?.number).toBe(cert.number)
  })
})
