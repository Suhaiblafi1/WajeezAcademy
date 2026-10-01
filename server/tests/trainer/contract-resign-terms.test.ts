/* «أعِدْه للتوقيع» بشروطٍ جديدة — أجرٍ ودوراتٍ وبنودٍ خاصّة. بقاعدةٍ حقيقيّة.

   ═══ ما يحرسه ═══

   ① ما يُغيَّر يُطبَع في المتن ويُحفَظ في الصفّ — والأجرُ قاعدةً كذلك، فلا
      يخرج عقدٌ يقول رقما والقاعدةُ تقول غيرَه.
   ② ورسالةُ الإعادة تقول ما تغيّر **فيه هو** أوّلَ القسم الذي لا يُحذَف:
      لو خُفّض أجرُه لَوصلته رسالةٌ تعدّ تحسينَ الصياغة وتسكت عن أجره.
   ③ ولا يُغيَّر أجرُ مدرّبٍ نشط من هنا: المستحقّاتُ تُحسب بالقاعدة السارية
      ساعةَ الحساب، فيتبدّل ما يُحسب له قبل أن يوقّع.
   ④ وما لم يُطلَب تغييرُه يبقى كما كان، ولا سطرَ عنه في الرسالة.
   ⑤ والأجرُ لمن يملك ضبطَه: «يتعاقد ولا يسعّر» (`permissions.ts`).

   والبريدُ يُلتقَط عند `sendDirectEmail` — فما يُقاس هو ما خرج من الخدمة. */

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
import { CONTRACT_BODY_VERSION, contractAcks } from '../../../src/application/trainer/contract-body'
import { changesBetween } from '../../../src/application/trainer/contract-changelog'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let app: FastifyInstance
let adminId = ''
let managerCookie = ''
let superCookie = ''
let financeCookie = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const COURSE_A = 'C-RT-A'
const COURSE_B = 'C-RT-B'
const SUBJECT = 'عنوانٌ كتبه صاحبُ المنصّة'
const BODY = 'فقرةٌ كتبها صاحبُ المنصّة لهذا المدرّب وحده.'
const ask = (id: string, extra: Record<string, unknown> = {}) =>
  review.requestResign(id, adminId, { subjectAr: SUBJECT, bodyAr: BODY, ...extra })
const mailTo = (email: string) => outbox.find((m) => m.to === email && m.subject === SUBJECT)

async function session(email: string, role: string) {
  const password = 'Session#12345'
  const u = await auth.register(email, password, role)
  await auth.setRoles(u.userId, [role])
  const { token } = await auth.login(email, password)
  return { userId: u.userId, cookie: `${SESSION_COOKIE}=${token}` }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const manager = await session('rt-manager@test.local', 'academic_manager')
  adminId = manager.userId
  managerCookie = manager.cookie
  superCookie = (await session('rt-super@test.local', 'super_admin')).cookie
  financeCookie = (await session('rt-finance@test.local', 'finance')).cookie
  app = await buildApp(prisma)
  await app.ready()
  for (const [id, t] of [[COURSE_A, 'دورةُ التحليل'], [COURSE_B, 'دورةُ الإدارة']] as const) {
    await prisma.course.create({ data: { id, status: 'published', currentVersion: 1 } })
    await prisma.courseVersion.create({ data: { courseId: id, version: 1, titleAr: t, totalHours: 10 } })
  }
}, 240_000)

beforeEach(() => { outbox.length = 0 })

let seq = 0

/** عقدٌ موقَّعٌ لم يُعتمَد — بدورةٍ واحدةٍ من دورتَين مؤهَّلٍ لهما، وبأجر 25 */
async function signed(opts: { specialTermsAr?: string } = {}) {
  seq += 1
  const email = `rt-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', 'سهيب الخوالدة')
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-RT-${Date.now()}-${seq}`, fullName: 'سهيب الخوالدة', email,
      status: 'conditionally_approved', motivation: 'اختبار',
      privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: user.userId, isVerified: true },
  })
  for (const courseId of [COURSE_A, COURSE_B]) {
    await prisma.trainerCourseQualification.create({ data: { profileId: profile.id, courseId, status: 'qualified' } })
  }
  await new EarningsService(prisma).setRule(adminId, { profileId: profile.id, type: 'per_seat', rate: 25, minSeats: 0 })
  await prisma.trainerOnboardingTask.create({ data: { profileId: profile.id, key: 'sign_contract', title: 'توقيع العقد' } })
  const c = await review.composeContract(application.id, adminId, {
    title: 'اتفاقية تقديم خدمات تدريبية', courseIds: [COURSE_A],
    requiredDocuments: [{ kind: 'national_id', labelAr: 'الهويّة', required: true }],
    specialTermsAr: opts.specialTermsAr,
  })
  const sent = await review.sendContract(c.id, adminId)
  const token = decodeURIComponent(sent.signingUrl.split('/c/')[1])
  await prisma.trainerContractDocument.create({
    data: { contractId: c.id, kind: 'national_id', storageKey: `rt-${c.id}`, originalName: 'id.pdf', mime: 'application/pdf', sizeBytes: 1024 },
  })
  await review.signContractByToken(token, {
    legalName: 'سهيب عبد الله الخوالدة', addressAr: 'عمّان — بناية ١٢', phone: '+962790000000',
    bodyHash: sha256(c.bodyAr ?? ''), acks: contractAcks(c.gatesActivation).map((a) => a.key),
  })
  outbox.length = 0
  return { c, application, profile, email }
}

describe('① و② الأجر', () => {
  it('يُطبَع في المتن، ويُكتب قاعدةً، ويقوله البريدُ أوّلا', async () => {
    const { c, profile, email } = await signed()
    /* وقّع إصدارا أقدم — فللقالب نقاطٌ في الرسالة، ويُقاس أنّ أجرَه يسبقها */
    const OLD = 'v17-2026-09-30'
    await prisma.trainerContract.update({ where: { id: c.id }, data: { bodyVersion: OLD } })
    const firstPoint = changesBetween(OLD, CONTRACT_BODY_VERSION)[0]
    expect(firstPoint, 'لا نقاطَ للقالب — فالترتيبُ يُقاس على فراغ').toBeTruthy()
    const out = await ask(c.id, { compensation: { type: 'per_seat', rate: 40, minSeats: 0 } })
    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: out.contractId } })
    expect(String(next.compensationRate), 'لم يُكتب الأجرُ الجديدُ في الصفّ').toBe('40')
    expect(next.bodyAr ?? '', 'المتنُ يقول الأجرَ القديم').toContain('20 × 40')
    const rule = await new EarningsService(prisma).activeRule(profile.id)
    expect(String(rule?.rate), 'لم تُكتب القاعدة — فالعقدُ يقول رقما والقاعدةُ غيرَه').toBe('40')
    expect(next.compensationRuleId, 'لا يقول الصفُّ من أيّ قاعدةٍ نُقل أجرُه').toBe(rule?.id)
    const mail = mailTo(email)
    expect(mail, 'لم تخرج رسالةُ الإعادة').toBeDefined()
    const at = mail!.text.indexOf('تغيّر أساسُ أتعابك')
    expect(at, 'سكتت الرسالةُ عن تغيّر أجره').toBeGreaterThan(-1)
    const tpl = mail!.text.indexOf(firstPoint!)
    expect(tpl, 'سقطت نقاطُ القالب من الرسالة').toBeGreaterThan(-1)
    expect(at, 'تغيّرُ أجره بعد نقاط القالب — لا أوّلَ القسم').toBeLessThan(tpl)
  })

  it('③ ولا يُغيَّر أجرُ مدرّبٍ نشطٍ من هنا — ولا يقع شيءٌ منه', async () => {
    const { c, application, profile } = await signed()
    await prisma.trainerApplication.update({ where: { id: application.id }, data: { status: 'active' } })
    await expect(ask(c.id, { compensation: { type: 'per_seat', rate: 10, minSeats: 0 } }))
      .rejects.toMatchObject({ code: 'fee_active_trainer', status: 409 })
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(row.status, 'سُحب العقدُ والطلبُ مردود').toBe('signed')
    const rule = await new EarningsService(prisma).activeRule(profile.id)
    expect(String(rule?.rate), 'تبدّلت القاعدةُ والطلبُ مردود').toBe('25')
  })
})

describe('الدوراتُ والبنودُ الخاصّة', () => {
  it('الدوراتُ تُختار ممّا هو مؤهَّلٌ له، ويقول البريدُ ما أُضيف وما رُفع', async () => {
    const { c, email } = await signed()
    const out = await ask(c.id, { courseIds: [COURSE_B] })
    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: out.contractId } })
    const ids = (next.qualifiedSnapshot as { courseId: string }[]).map((x) => x.courseId)
    expect(ids, 'لم تتبدّل دوراتُ الملحق (أ)').toEqual([COURSE_B])
    const text = mailTo(email)?.text ?? ''
    expect(text).toContain('أُضيف إلى الدورات المؤهَّل لها (الملحق أ): دورةُ الإدارة')
    expect(text).toContain('ورُفع من الدورات المؤهَّل لها (الملحق أ): دورةُ التحليل')
  })

  it('والبنودُ الخاصّةُ تُضاف فتُطبَع البندَ 21، ويقول البريدُ ذلك', async () => {
    const { c, email } = await signed()
    const out = await ask(c.id, { specialTermsAr: 'تعقد جلساته مساء الجمعة' })
    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: out.contractId } })
    expect(next.specialTermsAr).toBe('تعقد جلساته مساء الجمعة')
    expect(next.bodyAr ?? '').toContain('21-2 تعقد جلساته مساء الجمعة')
    expect(mailTo(email)?.text ?? '').toContain('أُضيفت إلى عقدك بنودٌ خاصّةٌ بك (البند 21)')
  })

  it('وتُرفع بـ`null` صراحةً — ويقول البريدُ إنّها رُفعت', async () => {
    const { c, email } = await signed({ specialTermsAr: 'بندٌ قديم' })
    const out = await ask(c.id, { specialTermsAr: null })
    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: out.contractId } })
    expect(next.specialTermsAr).toBeNull()
    expect(next.bodyAr ?? '').not.toContain('البند 21 —')
    expect(mailTo(email)?.text ?? '').toContain('ورُفعت من عقدك البنودُ الخاصّةُ بك (البند 21)')
  })
})

describe('④ وما لم يُطلَب تغييرُه يبقى', () => {
  it('الأجرُ والدوراتُ والبنودُ كما كانت، ولا سطرَ عن شروطه في البريد', async () => {
    const { c, email } = await signed({ specialTermsAr: 'بندٌ باقٍ' })
    const out = await ask(c.id)
    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: out.contractId } })
    expect(String(next.compensationRate)).toBe('25')
    expect(next.compensationRuleId, 'انقطع نسبُ الأجر إلى قاعدته').toBe(c.compensationRuleId)
    expect((next.qualifiedSnapshot as { courseId: string }[]).map((x) => x.courseId)).toEqual([COURSE_A])
    expect(next.specialTermsAr, 'سقطت البنودُ الخاصّة ولم يُطلَب رفعُها').toBe('بندٌ باقٍ')
    const text = mailTo(email)?.text ?? ''
    expect(text, 'لم تخرج الرسالة — فالغيابُ أدناه يقيس الفراغ').toContain(BODY)
    for (const line of ['تغيّر أساسُ أتعابك', 'الدورات المؤهَّل لها', 'البنودُ الخاصّةُ بك', 'بنودٌ خاصّةٌ بك']) {
      expect(text, `سطرٌ عن تغييرٍ لم يقع: ${line}`).not.toContain(line)
    }
  })
})

describe('⑤ والأجرُ يغيّره من يتعاقد — قرارُ صاحب المنصّة (١ أكتوبر ٢٠٢٦)', () => {
  /* كان الحارسُ هنا يردّ المديرَ الأكاديميَّ (٤٠٣). وقولُ صاحب المنصّة: «the
     financial manager, academy manager and the super admin.. all can change».
     فيُقلَب ولا يُحذَف: يغيّره، والأجرُ يصل الصفَّ فعلا لا ردٌّ ناجحٌ على أجرٍ أُسقط. */
  const post = (cookie: string, id: string, extra: Record<string, unknown>) => app.inject({
    method: 'POST', url: `/api/admin/trainer-contracts/${id}/resign-request`,
    headers: { cookie }, payload: { subjectAr: SUBJECT, bodyAr: BODY, ...extra },
  })

  /* والماليّةُ منهم (١ أكتوبر ٢٠٢٦): صار لها `trainer.contract.manage`، ونُزع عن
     الإعادة شرطُ `trainer.applications.decide` — فهي لا تفعّل حسابا. */
  const roles = [
    ['المديرُ الأكاديميّ', () => managerCookie],
    ['المديرُ الأعلى', () => superCookie],
    ['المديرُ الماليّ', () => financeCookie],
  ] as const
  for (const [who, cookie] of roles) {
    it(`${who} يغيّر الأجرَ في الإعادة`, async () => {
      const { c } = await signed()
      const res = await post(cookie(), c.id, { compensation: { type: 'per_seat', rate: 40 } })
      expect(res.statusCode, `رُدّ تغييرُ الأجر: ${res.body}`).toBe(200)
      const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: (res.json() as { contractId: string }).contractId } })
      expect(String(next.compensationRate), 'أسقط المسارُ الأجرَ وردّ نجاحا').toBe('40')
    })
  }
})
