/* «حُدّث النصُّ — أعِدْه للتوقيع» — بقاعدةٍ حقيقيّة.

   ═══ ما يحرسه ═══

   مدرّبٌ وقّع إصدارا سابقا ولم نعتمده بعد، فنسحب عرضَه ونعرض الحاضر برسالةٍ
   يكتبها صاحبُ المنصّة. والخطرُ في ثلاثة مواضع:

   ① أن يُسحَب ما لا يُسحَب: المعتمَدُ نافذٌ، والمرسَلُ لا توقيعَ عليه.
   ② أن يُمحى دليلُ توقيعٍ صحيح، أو يُقرأ سحبُه «رفضا» في شاشة العقود.
   ③ أن تخرج الرسالةُ بلا قائمة التغييرات أو بقائمةٍ ناقصة — وفيها نقصٌ في
      حدّه الأدنى المضمون (`v19`). فتُقاس الرسالةُ المرسَلةُ نفسُها.

   والبريدُ يُلتقَط عند `sendDirectEmail` لا يُقرأ من دالّة النصّ: ما يُقاس
   هو ما خرج من الخدمة، لا ما كان ينبغي أن يخرج. */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

const outbox = vi.hoisted(() => [] as { to: string; subject: string; text: string }[])
vi.mock('../../services/notification.service', async (orig) => {
  const real = await orig<typeof import('../../services/notification.service')>()
  return {
    ...real,
    sendDirectEmail: async (_p: unknown, input: { to: string; subject: string; text: string }) => {
      outbox.push({ to: input.to, subject: input.subject, text: input.text })
      return { status: 'sent' as const }
    },
  }
})

import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { EarningsService } from '../../services/earnings.service'
import { CONTRACT_BODY_VERSION, contractAcks } from '../../../src/application/trainer/contract-body'
import { changesBetween } from '../../../src/application/trainer/contract-changelog'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const COURSE = 'C-RESIGN-101'
const SIGNED_NAME = 'سهيب عبد الله محمد الخوالدة'
/* إصدارٌ أقدمُ من الحاضر بإصدارَين — فالقائمةُ نقاطُ `v18` و`v19` معا */
const OLD_VERSION = 'v17-2026-09-30'
const SUBJECT = 'عنوانٌ كتبه صاحبُ المنصّة لهذا المدرّب'
/* ونصٌّ لا يذكر التغييرات أصلا — فإن خرجت فقد أُلحقت لا نُقلت من نصّه */
const BODY = 'فقرةٌ أولى خاصّةٌ بهذا المدرّب.\n\nوفقرةٌ ثانيةٌ عن الدورة التي نريد أن يركّز عليها.'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('resign-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({
    data: { courseId: COURSE, version: 1, titleAr: 'أساسيّاتُ المحاسبة', totalHours: 10 },
  })
}, 240_000)

beforeEach(() => { outbox.length = 0 })

let seq = 0

/** عقدٌ مُرسَلٌ حقيقيٌّ — ورمزُه، ليوقَّع إن أُريد */
async function sentContract() {
  seq += 1
  const email = `resign-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', 'سهيب الخوالدة')
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-RESIGN-${Date.now()}-${seq}`, fullName: 'سهيب الخوالدة', email,
      status: 'conditionally_approved', motivation: 'اختبار',
      privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: user.userId, isVerified: true },
  })
  await prisma.trainerCourseQualification.create({
    data: { profileId: profile.id, courseId: COURSE, status: 'qualified' },
  })
  await new EarningsService(prisma).setRule(adminId, {
    profileId: profile.id, type: 'per_seat', rate: 25, minSeats: 0,
  })
  await prisma.trainerOnboardingTask.create({
    data: { profileId: profile.id, key: 'sign_contract', title: 'توقيع العقد' },
  })
  const c = await review.composeContract(application.id, adminId, {
    title: 'اتفاقية تقديم خدمات تدريبية',
    requiredDocuments: [{ kind: 'national_id', labelAr: 'الهويّة', required: true }],
    orientationAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  })
  const sent = await review.sendContract(c.id, adminId)
  const token = decodeURIComponent(sent.signingUrl.split('/c/')[1])
  return { c, token, profile, email }
}

/** عقدٌ موقَّعٌ على إصدارٍ قديم — الحالُ التي بُني لها هذا الباب */
async function signedOnOldVersion() {
  const made = await sentContract()
  await prisma.trainerContractDocument.create({
    data: {
      contractId: made.c.id, kind: 'national_id', storageKey: `k-${made.c.id}`,
      originalName: 'id.pdf', mime: 'application/pdf', sizeBytes: 1024,
    },
  })
  await review.signContractByToken(made.token, {
    legalName: SIGNED_NAME, addressAr: 'عمّان — بناية ١٢', phone: '+962790000000',
    bodyHash: sha256(made.c.bodyAr ?? ''), acks: contractAcks(made.c.gatesActivation).map((a) => a.key),
  })
  /* والإصدارُ يُرَدّ إلى ما قبل الحاضر — كما هي صفوفُ الإنتاج الستّة */
  await prisma.trainerContract.update({ where: { id: made.c.id }, data: { bodyVersion: OLD_VERSION } })
  outbox.length = 0
  return made
}

const ask = (id: string, body = BODY) =>
  review.requestResign(id, adminId, { subjectAr: SUBJECT, bodyAr: body })

describe('الموقَّعُ وحدَه يُعاد للتوقيع', () => {
  it('المعتمَدُ نافذٌ — فيُردّ بـ409', async () => {
    const { c } = await signedOnOldVersion()
    await prisma.trainerContract.update({
      where: { id: c.id }, data: { status: 'countersigned', countersignedAt: new Date() },
    })
    await expect(ask(c.id)).rejects.toMatchObject({ code: 'bad_state', status: 409 })
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(row.status, 'سُحب عقدٌ نافذٌ بنقرة').toBe('countersigned')
  })

  it('والمرسَلُ لا توقيعَ عليه يُسحَب — فيُردّ بـ409', async () => {
    const { c } = await sentContract()
    await expect(ask(c.id)).rejects.toMatchObject({ code: 'bad_state', status: 409 })
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(row.status).toBe('sent')
  })
})

describe('سحبُ الموقَّع وإعادتُه', () => {
  it('⚠️ دليلُ التوقيع لا يُمَسّ، والسببُ ليس «رفضا»', async () => {
    const { c } = await signedOnOldVersion()
    const before = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(before.status).toBe('signed')
    await ask(c.id)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(after.status).toBe('revoked')
    for (const col of [
      'signedAt', 'signerLegalName', 'signedBodyHash', 'bodyHash', 'bodyAr', 'signerIp',
      'signerUserAgent', 'signerAddressAr', 'signerPhone', 'signerEmail', 'consentTextAr', 'consentAcksAr',
    ] as const) {
      expect(
        JSON.stringify((after as Record<string, unknown>)[col] ?? null),
        `مُسّ عمودُ الدليل ${col}`,
      ).toBe(JSON.stringify((before as Record<string, unknown>)[col] ?? null))
    }
    expect(after.signedAt, 'لا توقيعَ أصلا — فالفحصُ يقيس الفراغ').not.toBeNull()
    expect(after.revokeReasonAr ?? '', 'قُرئ السحبُ رفضا في شاشة العقود').not.toMatch(/^رُفض التوقيع/)
    expect(after.revokeReasonAr ?? '').toMatch(/^أُعيد للتوقيع على نصٍّ محدَّث/)
  })

  it('ويُنشأ بديلٌ على الإصدار الحاضر، مُرسَلا، باسم من وقّع', async () => {
    const { c } = await signedOnOldVersion()
    const out = await ask(c.id)
    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: out.contractId } })
    expect(next.status, 'لم يُرسَل البديل').toBe('sent')
    expect(next.bodyVersion, 'البديلُ على غير الإصدار الحاضر').toBe(CONTRACT_BODY_VERSION)
    expect(next.replacesContractId).toBe(c.id)
    expect(next.bodyAr ?? '', 'تبدّل الاسمُ الذي وقّع به').toContain(`الطرف الثاني: ${SIGNED_NAME}`)
  })

  it('وتُفتَح مهمّةُ التوقيع ثانيةً', async () => {
    const { c, profile } = await signedOnOldVersion()
    const closed = await prisma.trainerOnboardingTask.findUniqueOrThrow({
      where: { profileId_key: { profileId: profile.id, key: 'sign_contract' } },
    })
    expect(closed.doneAt, 'لم تُغلَق المهمّةُ بالتوقيع — فالفحصُ يقيس لا شيء').not.toBeNull()
    await ask(c.id)
    const reopened = await prisma.trainerOnboardingTask.findUniqueOrThrow({
      where: { profileId_key: { profileId: profile.id, key: 'sign_contract' } },
    })
    expect(reopened.doneAt, 'بقيت المهمّةُ مغلقةً وعقدُه عاد إليه').toBeNull()
  })

  it('ويُكتب أثرُه', async () => {
    const { c } = await signedOnOldVersion()
    const out = await ask(c.id)
    const row = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.contract.resign_requested', entityId: c.id },
    })
    expect(row, 'لا أثرَ للسحب').not.toBeNull()
    expect((row!.meta as { nextContractId?: string }).nextContractId).toBe(out.contractId)
  })
})

describe('الرسالةُ: نصُّ صاحب المنصّة بحرفه، والقائمةُ كاملةً بعده', () => {
  it('⚠️ العنوانُ والنصُّ كما كُتبا، وكلُّ نقاط التغيير ولو لم يذكرها النصّ', async () => {
    const { c, email } = await signedOnOldVersion()
    await ask(c.id)
    const mail = outbox.find((m) => m.subject === SUBJECT)
    expect(mail, `لم تخرج رسالةٌ بالعنوان المكتوب — خرج: ${outbox.map((m) => m.subject).join(' | ')}`)
      .toBeDefined()
    expect(mail!.to).toBe(email)
    for (const p of BODY.split('\n\n')) expect(mail!.text, 'ضاعت فقرةٌ من نصّه').toContain(p)

    const points = changesBetween(OLD_VERSION, CONTRACT_BODY_VERSION)
    expect(points.length, 'لا نقاطَ بين الإصدارَين — فالفحصُ يقيس الفراغ').toBeGreaterThan(0)
    expect(mail!.text).toContain('ما تغيّر في نصّ عقدك')
    for (const p of points) expect(mail!.text, `سقطت نقطةٌ من القائمة: ${p}`).toContain(p)
  })

  it('والرسالةُ تسبق رابطَ النسخة الجديدة — كما يعد نصُّها', async () => {
    const { c } = await signedOnOldVersion()
    await ask(c.id)
    const at = outbox.findIndex((m) => m.subject === SUBJECT)
    expect(at, 'لم تخرج الرسالة').toBeGreaterThanOrEqual(0)
    expect(outbox.length, 'لم يخرج بريدُ الرابط بعدها').toBeGreaterThan(at + 1)
  })
})
