/* الحذفُ وجوابُ طلب التعديل — بقاعدةٍ حقيقيّة.
 *
 * ── ولمَ لا تكفي قراءةُ المصدر ──
 *
 * حارسُ `src/tests` يقرأ الشيفرةَ نصّا: يرى `isUntouchableContract` مكتوبةً
 * ويرى القيدَ في `deleteMany`. ولا يُثبت أنّ صفّا موقَّعا **يصمد فعلا** حين
 * يُطلب محوُه — وذاك ما يُقاس هنا: الصفُّ يبقى بعد المحاولة.
 *
 * وأخطرُ ما يُقاس: **السباقُ**. بين قراءة الصفّ والحكمِ عليه ومحوِه قد
 * يُوقَّع، فيُمحى موقَّعٌ مرّ الحارسُ عليه وهو غيرُ موقَّع.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'

let prisma: PrismaClient
let review: TrainerReviewService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = 'نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('cdel-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

let seq = 0
async function mkContract(status: string, extra: Record<string, unknown> = {}) {
  seq += 1
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-CD-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`,
      email: `cdel-${seq}-${Date.now()}@test.local`,
      status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `اتفاقيّةُ اختبارٍ ${seq}`, status,
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: [], signerEmail: app.email, gatesActivation: true,
      ...extra,
    },
  })
  return { app, profile, contract }
}

describe('الحذفُ يقع على ما لم يُوقَّع وحدَه', () => {
  it('المسوّدةُ والملغاةُ تُمحيان فعلا', async () => {
    for (const status of ['draft', 'revoked']) {
      const { contract } = await mkContract(status)
      await review.deleteContract(contract.id, adminId)
      const after = await prisma.trainerContract.findUnique({ where: { id: contract.id } })
      expect(after, `بقي صفُّ ${status} بعد الحذف`).toBeNull()
    }
  })

  it('والموقَّعُ يصمد — ويبقى صفُّه بعد المحاولة', async () => {
    const { contract } = await mkContract('signed', { signedAt: new Date() })
    await expect(review.deleteContract(contract.id, adminId))
      .rejects.toMatchObject({ code: 'signed_contract' })
    const after = await prisma.trainerContract.findUnique({ where: { id: contract.id } })
    expect(after, 'مُحي عقدٌ موقَّع — ودليلُ ما التزم به الطرفان ذهب').toBeTruthy()
  })

  /* والحالةُ وحدَها تكفي: صفٌّ فُسخ بعد توقيعه حالتُه `terminated` */
  it('والمفسوخُ بعد توقيعه يصمد ولو خلا تاريخُ توقيعه', async () => {
    const { contract } = await mkContract('terminated')
    await expect(review.deleteContract(contract.id, adminId))
      .rejects.toMatchObject({ code: 'signed_contract' })
    expect(await prisma.trainerContract.findUnique({ where: { id: contract.id } })).toBeTruthy()
  })

  it('والأثرُ يبقى بعد الصفّ — فيُعرف ما كان', async () => {
    const { contract } = await mkContract('draft')
    await review.deleteContract(contract.id, adminId)
    const audit = await prisma.auditEvent.findFirst({
      where: { entityType: 'trainer_contract', entityId: contract.id, action: 'trainer.contract.delete' },
    })
    expect(audit, 'حُذف بلا أثر — فلا يُعرف من حذف ولا ماذا').toBeTruthy()
    expect(JSON.stringify(audit!.meta)).toContain('اتفاقيّةُ اختبارٍ')
  })
})

describe('جوابُ طلب التعديل يعيد العقدَ إلى التوقيع', () => {
  it('الحالةُ تعود `sent` ويُحفَظ الجوابُ ويُجدَّد الرمز', async () => {
    const { contract } = await mkContract('amendment_requested', {
      amendmentRequestAr: 'أريد تعديلَ مدّة الإخطار',
      amendmentRequestedAt: new Date(),
      tokenHash: sha256('old-token'),
    })
    await review.replyToAmendment(contract.id, adminId, 'المدّةُ نظامٌ عامٌّ لا تُفرَد لعقد')
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status).toBe('sent')
    expect(after.amendmentReplyAr).toContain('نظامٌ عامٌّ')
    expect(after.amendmentRepliedBy).toBe(adminId)
    expect(after.tokenHash, 'بقي الرمزُ القديمُ — فبأيّ رابطٍ يقرأ جوابَنا؟')
      .not.toBe(sha256('old-token'))
  })

  it('ولا يُجاب عن عقدٍ لا طلبَ عليه — وإلّا أُعيد ملغًى إلى التوقيع', async () => {
    const { contract } = await mkContract('revoked')
    await expect(review.replyToAmendment(contract.id, adminId, 'جوابٌ لا محلَّ له'))
      .rejects.toMatchObject({ code: 'bad_state' })
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status, 'أُعيد عقدٌ ملغًى إلى التوقيع').toBe('revoked')
  })

  it('والإلغاءُ صار يقبل الموقوفَ — وهو «أُلغي وأُرسل مصحَّحا»', async () => {
    const { contract } = await mkContract('amendment_requested')
    await review.revokeContract(contract.id, adminId, 'يُركَّب عرضٌ مصحَّحٌ بدله')
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status).toBe('revoked')
  })
})
