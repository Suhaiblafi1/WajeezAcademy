/* تحديثُ نصِّ العروض المفتوحة **بلا بريد** — بقاعدةٍ حقيقيّة.

   ═══ ما يحرسه ═══

   أمرُ صاحب المنصّة (١ أكتوبر ٢٠٢٦): «I want to refresh them silently».

   ① الصامتُ لا يرسل شيئا — ويُقاس بما خرج من `sendDirectEmail` لا بقراءة
      الشيفرة. وفحصٌ يقول «لم يخرج بريد» يخضرّ على التقاطٍ لا يعمل، فيُقاس
      الوجهُ الآخر معه: المُبلِغُ يرسل، فالالتقاطُ يعمل.
   ② والصامتُ يحدّث النصَّ ويُبقي الشريط: `bodyUpdatedAt` يُكتب ونقاطُه تُقرأ
      من الرابط. فالتحديثُ صامتٌ لا خفيّ — يقرؤه صاحبُه فوق النصّ قبل أن يوقّع.
   ③ والأثرُ يقول أيُّهما وقع، فيُعرف بعد شهرٍ لمَ لم يصل أحدا بريد. */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

const outbox = vi.hoisted(() => [] as { to: string; subject: string }[])
vi.mock('../../services/notification.service', async (orig) => {
  const real = await orig<typeof import('../../services/notification.service')>()
  return {
    ...real,
    sendDirectEmail: async (_p: unknown, input: { to: string; subject: string }) => {
      outbox.push({ to: input.to, subject: input.subject })
      return { status: 'sent' as const }
    },
  }
})

import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CONTRACT_BODY_VERSION } from '../../../src/application/trainer/contract-body'

let prisma: PrismaClient
let review: TrainerReviewService
let adminId = ''
let seq = 0

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const OLD_VERSION = 'v17-2026-09-30'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('silent-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

beforeEach(() => { outbox.length = 0 })

/** عرضٌ مرسَلٌ نصُّه من إصدارٍ قديم — ويُعاد بريدُ صاحبه ورمزُه */
async function staleOffer() {
  seq += 1
  const email = `silent-${seq}-${Date.now()}@test.local`
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-SL-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  const composed = await review.composeContract(app.id, adminId, {
    title: `اتفاقيّةُ اختبارٍ ${seq}`,
    compensation: { type: 'per_seat', rate: 25, currency: 'USD', minSeats: 12, referralRate: 30 },
    requiredDocuments: [{ kind: 'national_id', labelAr: 'الهوية الوطنية', required: true }],
  } as never)
  const contractId = (composed as { contractId?: string; id?: string }).contractId
    ?? (composed as { id: string }).id
  const sent = await review.sendContract(contractId, adminId)
  const token = decodeURIComponent(sent.signingUrl.split('/c/')[1])
  /* والقديمُ نصّا لا إصدارا وحدَه — وإلّا تخطّاه المسلكُ بحقّ («نصُّه هو نفسُه») */
  const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
  const staleBody = `${row.bodyAr}\n\nسطرٌ من إصدارٍ قديمٍ لا يخرج من القالب الحاليّ.`
  await prisma.trainerContract.update({
    where: { id: contractId },
    data: { bodyVersion: OLD_VERSION, bodyAr: staleBody, bodyHash: sha256(staleBody) },
  })
  outbox.length = 0
  return { contractId, token, email, before: staleBody }
}

describe('التحديثُ الصامت', () => {
  it('⚠️ لا يخرج بريدٌ إلى صاحب العرض', async () => {
    const { email } = await staleOffer()
    const out = await review.refreshOpenContracts(adminId, { notify: false })
    expect(out.updated, 'لم يُحدَّث شيء — فالفحصُ يقيس الفراغ').toBeGreaterThanOrEqual(1)
    expect(outbox.filter((m) => m.to === email), 'خرج بريدٌ والتحديثُ صامت').toEqual([])
  })

  it('والمُبلِغُ يرسل — فالالتقاطُ يعمل، والصمتُ أعلاه صمتٌ حقّا', async () => {
    const { email } = await staleOffer()
    await review.refreshOpenContracts(adminId, { notify: true })
    expect(outbox.filter((m) => m.to === email).length, 'لم يُلتقَط بريدُ المُبلِغ').toBe(1)
  })

  it('⚠️ والنصُّ يُحدَّث والشريطُ يُكتب — صامتٌ لا خفيّ', async () => {
    const { contractId, token, before } = await staleOffer()
    await review.refreshOpenContracts(adminId, { notify: false })
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.bodyVersion).toBe(CONTRACT_BODY_VERSION)
    expect(after.bodyAr, 'لم يتبدّل النصّ').not.toBe(before)
    expect(after.bodyUpdatedAt, 'لا شريطَ على صفحته — فيوقّع على نصٍّ تبدّل بلا علامة').not.toBeNull()
    const view = await review.contractByToken(token) as { state: string; bodyChangesAr?: readonly string[] }
    expect(view.state, 'لم يعد رابطُه يفتح').toBe('open')
    expect((view.bodyChangesAr ?? []).length, 'لا نقاطَ تحت الشريط').toBeGreaterThan(0)
  })

  it('والأثرُ يقول إنّه لم يُبلَّغ', async () => {
    const { contractId } = await staleOffer()
    await review.refreshOpenContracts(adminId, { notify: false })
    const row = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.contract.body_refreshed', entityId: contractId },
    })
    expect(row, 'لا أثرَ للتحديث').not.toBeNull()
    expect((row!.meta as { notified?: boolean }).notified, 'لا يقول الأثرُ أبُلّغ أم لا').toBe(false)
  })
})
