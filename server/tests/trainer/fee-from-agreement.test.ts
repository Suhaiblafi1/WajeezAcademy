/* العقدُ يأخذ أجرَه من «الاتفاقية» — التركيبُ بقاعدتها، والإعادةُ بأجر عقده أو بأجرها (٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة «a»: الأجرُ يُضبط في «الاتفاقية» من ملفّ المدرّب وحدَها. فلا ترسل الشاشاتُ أجرا مع العقد: التركيبُ
   يطبع القاعدةَ السارية، والإعادةُ تُبقي أجرَ عقده أو تأخذ أجرَ «الاتفاقية» (`feeFromRule`). والشاشةُ يحرسها
   `src/tests/trainer/contract-fee-from-agreement.test.ts`؛ وهذا يحرس الخادم:

   ① التركيبُ بلا أجرٍ مكتوبٍ يطبع القاعدةَ السارية ويحفظ معرّفَها — ولا يكتب قاعدةً ثانية.
   ② والإعادةُ بلا اختيارٍ تُبقي أجرَ عقده ولو تغيّرت «الاتفاقية» بعده — ولا يتبدّل نصُّه من وراء من يعيده.
   ③ وبـ`feeFromRule` تأخذ أجرَ «الاتفاقية» الساريَ بمعرّفه، ويقوله البريد — ولا تُكتب قاعدة: هي قائمة.
   ④ ومن لا قاعدةَ له يُقال له أين تُضبط، والأجرُ المكتوبُ مع `feeFromRule` معا يُردّ.
   ⑤ ولا يُردّ لمدرّبٍ نشط: لا قاعدةَ تُكتب فتسري قبل توقيعه.
   ⑥ ويمرّ بالمسار نفسِه لا بالخدمة وحدَها: مخطّطُ الطلب يُسقط ما لا يعرفه بلا خطأ. */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'

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
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { contractAcks } from '../../../src/application/trainer/contract-body'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let earnings: EarningsService
let app: FastifyInstance
let adminId = ''
let managerCookie = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const COURSE = 'C-FA-A'
const SUBJECT = 'عنوانُ الإعادة'
const BODY = 'فقرةٌ كتبها صاحبُ المنصّة لهذا المدرّب وحده.'
const ask = (id: string, extra: Record<string, unknown> = {}) =>
  review.requestResign(id, adminId, { subjectAr: SUBJECT, bodyAr: BODY, ...extra })
const rulesOf = (profileId: string) => prisma.trainerCompensationRule.count({ where: { profileId } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  earnings = new EarningsService(prisma)
  const password = 'Session#12345'
  const u = await auth.register('fa-manager@test.local', password, 'academic_manager')
  await auth.setRoles(u.userId, ['academic_manager'])
  adminId = u.userId
  managerCookie = `${SESSION_COOKIE}=${(await auth.login('fa-manager@test.local', password)).token}`
  app = await buildApp(prisma)
  await app.ready()
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({ data: { courseId: COURSE, version: 1, titleAr: 'دورةُ الاتفاقية', totalHours: 10 } })
}, 240_000)

beforeEach(() => { outbox.length = 0 })

let seq = 0

/** عقدٌ موقَّعٌ لم يُعتمَد — بأجر 25 من «الاتفاقية»، أو بلا قاعدةٍ وبسببٍ مكتوب */
async function signed(opts: { noRule?: boolean } = {}) {
  seq += 1
  const email = `fa-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', 'مدرّبُ الاتفاقية')
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-FA-${Date.now()}-${seq}`, fullName: 'مدرّبُ الاتفاقية', email,
      status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: user.userId, isVerified: true },
  })
  await prisma.trainerCourseQualification.create({ data: { profileId: profile.id, courseId: COURSE, status: 'qualified' } })
  const rule = opts.noRule
    ? null
    : await earnings.setRule(adminId, { profileId: profile.id, type: 'per_seat', rate: 25, minSeats: 0 })
  await prisma.trainerOnboardingTask.create({ data: { profileId: profile.id, key: 'sign_contract', title: 'توقيع العقد' } })
  const c = await review.composeContract(application.id, adminId, {
    title: 'اتفاقية تقديم خدمات تدريبية', courseIds: [COURSE],
    requiredDocuments: [{ kind: 'national_id', labelAr: 'الهويّة', required: true }],
    ...(opts.noRule ? { rateWaivedReasonAr: 'يحدد قبل أول إسناد باتفاق مكتوب' } : {}),
  })
  const sent = await review.sendContract(c.id, adminId)
  const token = decodeURIComponent(sent.signingUrl.split('/c/')[1])
  await prisma.trainerContractDocument.create({
    data: { contractId: c.id, kind: 'national_id', storageKey: `fa-${c.id}`, originalName: 'id.pdf', mime: 'application/pdf', sizeBytes: 1024 },
  })
  await review.signContractByToken(token, {
    legalName: 'مدرّبُ الاتفاقية القانونيّ', addressAr: 'عمّان', phone: '+962790000000',
    bodyHash: sha256(c.bodyAr ?? ''), acks: contractAcks(c.gatesActivation).map((a) => a.key),
  })
  outbox.length = 0
  return { c, application, profile, email, rule }
}

describe('① التركيب بلا أجر مكتوب يطبع القاعدة السارية', () => {
  it('⚠️ بمعرفها — ولا قاعدة ثانية', async () => {
    const { c, profile, rule } = await signed()
    expect(String(c.compensationRate)).toBe('25')
    expect(c.compensationRuleId, 'لا يقول العقد من أي قاعدة أخذ أجره').toBe(rule?.id)
    expect(await rulesOf(profile.id), 'كتب التركيب قاعدة ثانية').toBe(1)
  })
})

describe('② والإعادة بلا اختيار تبقي أجر عقده', () => {
  it('⚠️ ولو تغيرت «الاتفاقية» بعده', async () => {
    const { c, profile } = await signed()
    await earnings.setRule(adminId, { profileId: profile.id, type: 'per_seat', rate: 40, minSeats: 0 })
    const out = await ask(c.id)
    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: out.contractId } })
    expect(String(next.compensationRate), 'تبدل نصه من وراء من أعاده').toBe('25')
    expect(next.compensationRuleId).toBe(c.compensationRuleId)
  })
})

describe('③ وبـ`feeFromRule` تأخذ أجر «الاتفاقية»', () => {
  it('⚠️ الساري بمعرفه — ويقوله البريد، ولا قاعدة تكتب', async () => {
    const { c, profile, email } = await signed()
    const forty = await earnings.setRule(adminId, { profileId: profile.id, type: 'per_seat', rate: 40, minSeats: 0 })
    const before = await rulesOf(profile.id)
    const out = await ask(c.id, { feeFromRule: true })
    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: out.contractId } })
    expect(String(next.compensationRate)).toBe('40')
    expect(next.compensationRuleId, 'لا يقول من أي قاعدة نقل أجره').toBe(forty.id)
    expect(next.bodyAr ?? '', 'المتن يقول الأجر القديم').toContain('20 × 40')
    expect(await rulesOf(profile.id), 'كتبت قاعدة وهي قائمة').toBe(before)
    const mail = outbox.find((m) => m.to === email && m.subject === SUBJECT)
    expect(mail?.text ?? '', 'سكت البريد عن تغير أجره').toContain('رفعنا أجرَ المقعد: من $25 إلى $40.')
  })

  it('وقاعدة شعبة لا تؤخذ — أجر «الاتفاقية» العام', async () => {
    const { c, profile } = await signed()
    const cohort = await prisma.cohort.create({ data: { courseId: COURSE, title: `شعبة ${seq}`, status: 'open', capacity: 10 } })
    await earnings.setRule(adminId, { profileId: profile.id, type: 'per_seat', rate: 90, minSeats: 0, cohortId: cohort.id })
    const out = await ask(c.id, { feeFromRule: true })
    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: out.contractId } })
    expect(String(next.compensationRate), 'أخذ أجر شعبة واحدة لعقده كله').toBe('25')
  })
})

describe('④ ولا أجر يخترع', () => {
  it('⚠️ من لا قاعدة له يقال له أين تضبط — ولا يقع شيء', async () => {
    const { c } = await signed({ noRule: true })
    await expect(ask(c.id, { feeFromRule: true })).rejects.toMatchObject({ code: 'no_rule', status: 409 })
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(row.status, 'سحب العقد والطلب مردود').toBe('signed')
  })

  it('والأجر المكتوب مع `feeFromRule` معا يرد', async () => {
    const { c } = await signed()
    await expect(ask(c.id, { feeFromRule: true, compensation: { type: 'per_seat', rate: 50, minSeats: 0 } }))
      .rejects.toMatchObject({ code: 'fee_twice', status: 422 })
  })
})

describe('⑤ ولا يرد لمدرب نشط', () => {
  it('⚠️ لا قاعدة تكتب فتسري قبل توقيعه', async () => {
    const { c, application, profile } = await signed()
    await earnings.setRule(adminId, { profileId: profile.id, type: 'per_seat', rate: 30, minSeats: 0 })
    await prisma.trainerApplication.update({ where: { id: application.id }, data: { status: 'active' } })
    const out = await ask(c.id, { feeFromRule: true })
    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: out.contractId } })
    expect(String(next.compensationRate)).toBe('30')
  })
})

describe('⑥ ويمر بالمسار نفسه', () => {
  it('⚠️ `feeFromRule` لا يسقطه مخطط الطلب', async () => {
    const { c, profile } = await signed()
    await earnings.setRule(adminId, { profileId: profile.id, type: 'per_seat', rate: 45, minSeats: 0 })
    const res = await app.inject({
      method: 'POST', url: `/api/admin/trainer-contracts/${c.id}/resign-request`,
      headers: { cookie: managerCookie }, payload: { subjectAr: SUBJECT, bodyAr: BODY, feeFromRule: true },
    })
    expect(res.statusCode, res.body).toBe(200)
    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: (res.json() as { contractId: string }).contractId } })
    expect(String(next.compensationRate), 'أسقط المسار الاختيار وأبقى الأجر القديم').toBe('45')
  })
})
