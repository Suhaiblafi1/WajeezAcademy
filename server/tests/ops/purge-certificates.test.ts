/* المحوُ بالسجلّ يُجهَض على أوّل شهادة — البند ٦٤.

   ─────────── العطب ───────────

   `Certificate.enrollment` هي **العلاقةُ الوحيدةُ في المخطَّط كلِّه** التي
   تحمل `onDelete: Restrict` (فحصٌ آليّ: ١١٩ `Cascade` و٤ `SetNull` وواحدةٌ
   `Restrict`). وهي مقصودةٌ ومشروحةٌ في المخطَّط: شهادةٌ صدر رقمُها للناس لا
   تُمحى بسلسلةٍ من تسجيل.

   و`purgeAccountWithHistory` تحذف التسجيلاتِ مباشرةً:

       await tx.enrollment.deleteMany({ where: { userId } })

   وفوقها تعليقٌ يقول «التسجيلُ يسلسل إلى الحضور والمحاولات **والشهادات**» —
   **وهو غيرُ صحيح للشهادات وحدَها**. فالقاعدةُ ترفض، والمعاملةُ كلُّها تُردّ.

   ─────────── ولماذا لا يحرسه فحصُ البصمة ───────────

   `accountFootprint` **تعدّ الشهادات فعلا** و`footprintBlockersAr` تسمّيها.
   لكنّ هذا المسارَ بعينه هو **مسارُ التجاوز**: حين تكون هناك موانعُ يُنادى
   `purgeAccountWithHistory` — أي أنّ الفحصَ الذي كان سيمنع هو نفسُه الذي
   يوصل إلى الدالّة المعطوبة. فالحارسُ يحرس المسارَ العاديَّ ويترك القسريّ.

   ─────────── وما يُقاس هنا ───────────

   حسابٌ له شهادةٌ واحدة، ثمّ `purgeAccountWithHistory`. ولا يكفي أن تنجح:
   يجب أن **لا يبقى نصفُ محو**. فيُفحَص بعدها أنّ الحسابَ ذهب، وأنّ شهادتَه
   ذهبت معه، وأنّ **شهادةَ حسابٍ آخرَ لم تُمَسّ**. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { accountFootprint, purgeAccountWithHistory } from '../../services/account-purge.service'

let prisma: PrismaClient
let auth: AuthService
let cohortId = ''
const STAMP = Date.now()
const COURSE = 'C-BIZ-101'

let seq = 0
/** متعلّمٌ مسجَّلٌ له شهادةٌ صادرة — الحالةُ التي تُجهض المعاملة */
async function learnerWithCertificate() {
  seq += 1
  const { userId } = await auth.register(`purge-cert-${seq}-${STAMP}@test.local`, 'Learner#12345', `متعلّم ${seq}`)
  const enrollment = await prisma.enrollment.create({ data: { userId, cohortId, status: 'completed' } })
  const cert = await prisma.certificate.create({
    data: {
      number: `WJ-CERT-2077-${String(10_000 + seq)}`,
      enrollmentId: enrollment.id,
      learnerName: `متعلّم ${seq}`,
      courseId: COURSE,
      courseVersion: 1,
    },
  })
  return { userId, enrollmentId: enrollment.id, certId: cert.id, number: cert.number }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  const c = await prisma.cohort.create({
    data: {
      courseId: COURSE, title: `شعبةُ محوٍ ${STAMP}`, status: 'active',
      registrationOpen: false, financialReady: true, price: 100, currency: 'USD', capacity: 20,
      startsAt: new Date(Date.now() - 30 * 86_400_000),
    },
  })
  cohortId = c.id
}, 240_000)

describe('٦٤ · المحوُ بالسجلّ لا يُجهَض على شهادة', () => {
  it('حسابٌ له شهادةٌ يُمحى كاملا — وكان يرمي ويترك كلَّ شيءٍ كما هو', async () => {
    const a = await learnerWithCertificate()

    /* البصمةُ تراها — وهي نفسُها التي توصل إلى هذا المسار */
    const footprint = await accountFootprint(prisma, a.userId)
    expect(footprint.certificates).toBe(1)

    await purgeAccountWithHistory(prisma, a.userId)

    expect(await prisma.user.findUnique({ where: { id: a.userId } }), 'الحسابُ باقٍ').toBeNull()
    expect(await prisma.enrollment.findUnique({ where: { id: a.enrollmentId } }), 'تسجيلٌ يتيم').toBeNull()
    expect(await prisma.certificate.findUnique({ where: { id: a.certId } }), 'شهادةٌ يتيمة').toBeNull()
  })

  it('ولا يمسّ شهادةَ غيره — المحوُ بقدر صاحبه', async () => {
    const mine = await learnerWithCertificate()
    const other = await learnerWithCertificate()

    await purgeAccountWithHistory(prisma, mine.userId)

    const kept = await prisma.certificate.findUnique({ where: { id: other.certId } })
    expect(kept, 'ذهبت شهادةُ حسابٍ آخر').not.toBeNull()
    expect(kept?.number).toBe(other.number)
    expect(await prisma.user.findUnique({ where: { id: other.userId } })).not.toBeNull()
  })

  it('ولا نصفَ محو: لو سقطت المعاملةُ لبقي الحسابُ كما كان', async () => {
    /* المعاملةُ عقدٌ: إمّا كلٌّ أو لا شيء. وهذا يقيس الطرفَ الآخر — أنّ
       النجاحَ نجاحٌ تامّ لا صفوفا متناثرة. */
    const a = await learnerWithCertificate()
    await purgeAccountWithHistory(prisma, a.userId)

    const leftovers = await Promise.all([
      prisma.enrollment.count({ where: { userId: a.userId } }),
      prisma.certificate.count({ where: { enrollment: { userId: a.userId } } }),
      prisma.order.count({ where: { userId: a.userId } }),
    ])
    expect(leftovers, 'بقيت صفوفٌ تشير إلى حسابٍ لا وجودَ له').toEqual([0, 0, 0])
  })
})

describe('والقيدُ نفسُه يبقى — الإصلاحُ في الخدمة لا في المخطَّط', () => {
  it('`Restrict` واحدةٌ في المخطَّط كلِّه، وهي هذه', async () => {
    const { readFileSync } = await import('node:fs')
    const schema = readFileSync('prisma/schema.prisma', 'utf8')
    const restricts = schema.match(/onDelete:\s*Restrict/g) ?? []
    expect(restricts, 'تغيّر عددُ القيود المانعة — فليُراجَع المحو').toHaveLength(1)
    /* ولا تُحَلّ المشكلةُ بتحويلها إلى `Cascade`: الشهادةُ تُمحى **صراحةً**
       في المسار المأذون له وحدَه، لا بسلسلةٍ يبلغها أيُّ حذفِ تسجيل. */
    expect(schema).toMatch(/enrollment\s+Enrollment\s+@relation\([^)]*onDelete:\s*Restrict/)
  })
})
