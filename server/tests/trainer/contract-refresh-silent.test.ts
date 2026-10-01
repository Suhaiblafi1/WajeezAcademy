/* تحديثُ نصِّ العروض المفتوحة **بلا بريد** — بقاعدةٍ حقيقيّة.

   ═══ ما يحرسه ═══

   أمرُ صاحب المنصّة (١ أكتوبر ٢٠٢٦): «I want to refresh them silently».

   ① الصامتُ لا يرسل شيئا — ويُقاس بما خرج من `sendDirectEmail` لا بقراءة
      الشيفرة. وفحصٌ يقول «لم يخرج بريد» يخضرّ على التقاطٍ لا يعمل، فيُقاس
      الوجهُ الآخر معه: المُبلِغُ يرسل، فالالتقاطُ يعمل.
   ② والصامتُ يحدّث النصَّ والرابطُ يفتح — **ولا قائمةَ تغييرٍ على صفحته**:
      نُزع الشريطُ بقرار صاحب المنصّة في اليوم نفسِه («no need for the update
      list on the top of the contract»). و`bodyUpdatedAt` يُكتب سجلًّا لا يُعرَض.
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
import { changesBetween } from '../../../src/application/trainer/contract-changelog'

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

  it('⚠️ والنصُّ يُحدَّث والرابطُ يفتح — ولا قائمةَ على صفحته', async () => {
    const { contractId, token, before } = await staleOffer()
    await review.refreshOpenContracts(adminId, { notify: false })
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.bodyVersion).toBe(CONTRACT_BODY_VERSION)
    expect(after.bodyAr, 'لم يتبدّل النصّ').not.toBe(before)
    expect(after.bodyUpdatedAt, 'لم يُكتب متى تبدّل نصُّه — فلا سجلَّ يُسأل عنه').not.toBeNull()

    const view = await review.contractByToken(token)
    if (view.state !== 'open') throw new Error('لم يعد رابطُه يفتح')
    /* بالمحتوى لا بالاسم — علّتُه في `contract-body-refresh.test.ts` */
    const points = changesBetween(OLD_VERSION, CONTRACT_BODY_VERSION)
    expect(points.length, 'لا نقاطَ يُبحَث عنها — فالفحصُ يقيس الفراغ').toBeGreaterThan(0)
    /* ونصُّ العقد نفسُه يُستثنى: هو ما يُقرأ، وليس شريطا فوقه */
    const shown = JSON.stringify({ ...view, bodyAr: null })
    for (const p of points) expect(shown, `ظهرت قائمةُ التغيير والتحديثُ صامت: ${p}`).not.toContain(p)
  })

  /* ═══ وسطرٌ واحدٌ يقول إنّه حُدّث — قرارُ صاحب المنصّة (١ أكتوبر ٢٠٢٦) ═══
     «فقط ابلغهم رساله بالاعلى يرجى اعاده قراءته… اختر جمله اقصر». علَمٌ لا
     قائمة: والقائمةُ محروسةٌ بالغياب في الفحص أعلاه. */
  it('ويحمل الرابطُ علَمَ التحديث — لا قبله، ونعم بعده', async () => {
    const { token } = await staleOffer()
    const before = await review.contractByToken(token)
    if (before.state !== 'open') throw new Error('لم يُفتح الرابط')
    expect(before.bodyUpdated, 'قال إنّه حُدّث ولم يُحدَّث').toBe(false)

    await review.refreshOpenContracts(adminId, { notify: false })
    const after = await review.contractByToken(token)
    if (after.state !== 'open') throw new Error('لم يعد رابطُه يفتح')
    expect(after.bodyUpdated, 'حُدّث صامتا ولا سطرَ يقوله على صفحته').toBe(true)
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
