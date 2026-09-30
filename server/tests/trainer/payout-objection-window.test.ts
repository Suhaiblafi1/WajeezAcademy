/* ═══ مهلةُ اعتراض المدرّب على الكشف — حارسٌ لا نصّا وحدَه ═══
 *
 * سأل صاحبُ المنصّة: «هل ممكن أن يكون اعتراض للمدرب على الكشف؟ خاصة اذا كان
 * هناك حسم؟» فصار له ذلك في البنود 4-11 إلى 4-14. ثمّ أمر: «اضف الحارس الان».
 *
 * **ولمَ لا يكفي النصّ.** البند 4-11 يقول للمدرّب: «لا يعتمد الكشف قبل مضي
 * سبعة أيّامٍ من إتاحته له». ولو بقيت جملةً في وثيقةٍ لَجاز أن يُنشئ الموظّفُ
 * الكشفَ ويعتمده في الجلسة نفسِها — فنخالف عقدا نحن كتبناه، ولا يقول أحدٌ
 * إنّا خالفناه. والزرّان متجاوران في الشاشة، فليس هذا احتمالا بعيدا: من
 * أنشأ عشرةَ كشوفٍ اعتمدها معها بلا قصدِ سوء.
 *
 * وهذه القياساتُ على المسلك نفسِه (`EarningsService.approve`) لا على نصّ
 * البند — فالبندُ يحرسه `contract-v18-amendments`، وهذا يحرس الفعل.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { EarningsService } from '../../services/earnings.service'
import { PAYOUT_OBJECTION_DAYS } from '../../../src/application/trainer/notice-periods'

let prisma: PrismaClient
let earnings: EarningsService
let adminId = ''
let seq = 0

const DAY = 24 * 60 * 60 * 1000

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  earnings = new EarningsService(prisma)
  const admin = await auth.register('objection-admin@test.local', 'Admin#12345', 'المدير المالي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

/** كشفٌ بانتظار الاعتماد، ظهر للمدرّب قبل `ageDays` يوما */
async function mkPayout(ageDays: number) {
  seq += 1
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-OBJ-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`,
      email: `obj-${seq}-${Date.now()}@test.local`,
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  const p = await prisma.trainerPayout.create({
    data: { profileId: profile.id, period: '2026-09', status: 'pending', total: 100, currency: 'USD' },
  })
  /* و`createdAt` يُرجَع بالكتابة: هو ميلادُ ظهور الكشف للمدرّب، وعليه يُعَدّ */
  return prisma.trainerPayout.update({
    where: { id: p.id },
    data: { createdAt: new Date(Date.now() - ageDays * DAY) },
  })
}

/** يُقاس **أيُّ** حارسٍ ردَّ لا أنّ شيئا ردّ — فحارسٌ آخرُ يلتقطها يخفي تعطيلَ هذا */
async function codeOf(work: Promise<unknown>): Promise<string> {
  try { await work; return 'لم يُردّ' } catch (e) { return (e as { code?: string }).code ?? 'بلا رمز' }
}

describe('لا يُعتمد كشفٌ قبل أن تمضيَ مهلةُ الاعتراض', () => {
  it('⚠️ كشفٌ ظهر اليومَ لا يُعتمد اليوم — وبالرمز الذي يخصّه', async () => {
    const p = await mkPayout(0)
    expect(await codeOf(earnings.approve(p.id, adminId))).toBe('objection_window_open')
    const after = await prisma.trainerPayout.findUniqueOrThrow({ where: { id: p.id } })
    expect(after.status, 'اعتُمد كشفٌ ومهلةُ اعتراض صاحبه لم تبدأ').toBe('pending')
    expect(after.approvedBy, 'كُتب معتمِدٌ على كشفٍ لم يُعتمد').toBeNull()
  })

  it('وفي اليوم الأخير من المهلة لا يُعتمد بعدُ', async () => {
    const p = await mkPayout(PAYOUT_OBJECTION_DAYS - 1)
    expect(await codeOf(earnings.approve(p.id, adminId))).toBe('objection_window_open')
    const after = await prisma.trainerPayout.findUniqueOrThrow({ where: { id: p.id } })
    expect(after.status).toBe('pending')
  })

  /* والوجهُ الآخرُ لازم: حارسٌ يردّ كلَّ شيءٍ يخضرّ على القياس الأوّل
     وحدَه، ويوقف الصرفَ في المنصّة كلِّها. */
  it('ومتى مضت اعتُمد — فالحارسُ مهلةٌ لا سدٌّ', async () => {
    const p = await mkPayout(PAYOUT_OBJECTION_DAYS + 1)
    await earnings.approve(p.id, adminId)
    const after = await prisma.trainerPayout.findUniqueOrThrow({ where: { id: p.id } })
    expect(after.status, 'لم يُعتمد كشفٌ انقضت مهلتُه — فالصرفُ موقوفٌ أبدا').toBe('approved')
    expect(after.approvedBy).toBe(adminId)
  })

  it('وعند انقضائها بالضبط يُعتمد — فالحدُّ «مضت» لا «تجاوزت»', async () => {
    /* وثانيةٌ تُزاد لئلّا يُقاس على حدٍّ يتحرّك بزمن التنفيذ */
    const p = await mkPayout(PAYOUT_OBJECTION_DAYS + 1 / 86400)
    await earnings.approve(p.id, adminId)
    expect((await prisma.trainerPayout.findUniqueOrThrow({ where: { id: p.id } })).status)
      .toBe('approved')
  })

  it('والردُّ يقول كم بقي من المهلة وأيُّ بندٍ يمنع', async () => {
    const p = await mkPayout(2)
    const msg = await earnings.approve(p.id, adminId).then(() => '', (e: { message?: string }) => e.message ?? '')
    expect(msg, 'لا يقول كم بقي — فيُعاد الزرُّ ولا يُدرى لِمَ').toMatch(/يبقى \d+ يوما/)
    expect(msg, 'لا يقول أيُّ بندٍ يمنع، فيُظَنّ عطبا').toContain('4-11')
    expect(msg, 'العددُ في الرسالة ليس من الثابت').toContain(String(PAYOUT_OBJECTION_DAYS))
  })

  /* ═══ ولا يُوسَّع الحارسُ إلى ما لم يُوضَع له ═══

     المهلةُ شرطُ **اعتمادٍ** وحدَه. فلو ألغي كشفٌ خاطئٌ أُنشئ قبل ساعةٍ
     لَوجب أن يُلغى الآن لا بعد سبعة أيّام — والبندُ لا يمنع ذلك، إذ لا
     يمسّ مالا استحقّ. */
  it('والإلغاءُ لا تحجزه المهلة — فالخطأُ يُصحَّح ساعتَه', async () => {
    const p = await mkPayout(0)
    await earnings.cancel(p.id, adminId, 'أُنشئ بالخطأ على شعبةٍ أخرى')
    expect((await prisma.trainerPayout.findUniqueOrThrow({ where: { id: p.id } })).status)
      .toBe('cancelled')
  })

  it('وكشفٌ لا وجودَ له يُردّ بـ`unknown_payout` لا بالمهلة', async () => {
    expect(await codeOf(earnings.approve('00000000-0000-0000-0000-000000000000', adminId)))
      .toBe('unknown_payout')
  })
})
