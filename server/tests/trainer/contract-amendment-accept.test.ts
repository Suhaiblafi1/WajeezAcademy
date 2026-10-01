/* قبولُ طلب التعديل — جوابُنا وعقدُه المصحَّحُ في رسالةٍ واحدة (بقاعدةٍ حقيقيّة).

   ═══ العطبُ الذي يحرسه ═══

   كان «قبلتُ التعديل» يُغلق العرضَ ويرسل «قبلنا طلبك ويصلك عقدٌ مصحَّح» بلا
   رابط، ثمّ ينتظر من يُنشئ العقدَ بيده. وبلاغُ صاحب المنصّة (١ أكتوبر ٢٠٢٦):
   «محمّد لم يستلم شيئا — وأريدك أن تفعّل الأولى»: أن يصله جوابُنا وعقدُه
   المصحَّحُ معا، بنصٍّ يكتبه كما يشاء.

   ومعه عطبٌ ثانٍ في البابِ الآخر («يبقى العرضُ كما هو»): رسالتُه كانت تقول
   «لم يتغيّر فيه حرف» ولو حُدّث نصُّه بعد الطلب — وهو حالُ محمّد بعينه.

   والبريدُ يُلتقَط عند `sendDirectEmail`: ما يُقاس هو ما خرج من الخدمة. */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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
import { CONTRACT_BODY_VERSION } from '../../../src/application/trainer/contract-body'
import { changeGroupsBetween, changesBetween } from '../../../src/application/trainer/contract-changelog'
import {
  AMENDMENT_NO_CHANGES_AR, AMENDMENT_PLACEHOLDER_AR, RESIGN_NO_CHANGES_AR, amendmentTemplateNoteAr,
} from '../../../src/application/trainer/contract-resign'

/* ═══ ولطالب التعديل يُقال تحديثُ القالب سطرا وأبوابا — لا نقاطا (١ أكتوبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة، وعلّتُه عند `amendmentTemplateNoteAr`. فما يُقاس هنا أنّ السطرَ
   المحسوبَ ممّا قرأه هو خرج في الرسالة، وأنّ النقاطَ لم تخرج. */
const noteFrom = (from: string) => amendmentTemplateNoteAr(changeGroupsBetween(from, CONTRACT_BODY_VERSION))!

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''

const COURSE = 'C-AMEND-101'
const OLD_VERSION = 'v20-2026-09-30'
const SUBJECT = 'قبلنا ملاحظاتِك — وهذا عقدُك المصحَّح'
const BODY = 'شكرا لك على ملاحظاتك.\n\nقبلنا أن تتحمّل الأكاديميّةُ رسومَ مصرفها على الحوالة.'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('amend-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({
    data: { courseId: COURSE, version: 1, titleAr: 'أساسيّاتُ المحاسبة', totalHours: 10 },
  })
}, 240_000)

beforeEach(() => { outbox.length = 0 })

let seq = 0

/** عرضٌ مرسَلٌ طلب صاحبُه تعديلَه — ومتنُه من إصدارٍ سابق */
async function amendmentRequested() {
  seq += 1
  const email = `amend-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', 'محمّد المدرّب')
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-AMEND-${Date.now()}-${seq}`, fullName: 'محمّد المدرّب', email,
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
  const c = await review.composeContract(application.id, adminId, {
    title: 'اتفاقية تقديم خدمات تدريبية',
    requiredDocuments: [{ kind: 'national_id', labelAr: 'الهويّة', required: true }],
    orientationAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  })
  const sent = await review.sendContract(c.id, adminId)
  const token = decodeURIComponent(sent.signingUrl.split('/c/')[1])
  await review.requestContractAmendment(token, 'أرجو أن تتحمّل الأكاديميّةُ رسومَ الحوالة')
  await prisma.trainerContract.update({ where: { id: c.id }, data: { bodyVersion: OLD_VERSION } })
  outbox.length = 0
  return { c, token, profile, email }
}

const accept = (id: string, extra: Record<string, unknown> = {}) =>
  review.answerAmendmentWithNewContract(id, adminId, { subjectAr: SUBJECT, bodyAr: BODY, ...extra })

describe('قبولُ التعديل: رسالةٌ واحدةٌ فيها الجوابُ والعقدُ المصحَّح', () => {
  it('⚠️ يصله جوابُك بحرفه، وما تغيّر، ورابطُ العقد الجديد — ولا بريدَ ثانٍ', async () => {
    const { c, email } = await amendmentRequested()
    const out = await accept(c.id)

    expect(outbox.length, `خرج غيرُ رسالةٍ واحدة: ${outbox.map((m) => m.subject).join(' | ')}`).toBe(1)
    const mail = outbox[0]
    expect(mail.to).toBe(email)
    expect(mail.subject, 'العنوانُ غيرُ ما كتبه الموظّف').toBe(SUBJECT)
    for (const p of BODY.split('\n\n')) expect(mail.text, 'ضاعت فقرةٌ من جوابه').toContain(p)
    expect(mail.text, 'الرسالةُ بلا رابط العقد المصحَّح').toContain(out.signingUrl)
    expect(mail.text, 'لم يُقل إنّا عدّلنا العقدَ وأبوابُ ذلك').toContain(noteFrom(OLD_VERSION))
    for (const pt of changesBetween(OLD_VERSION, CONTRACT_BODY_VERSION)) {
      expect(mail.text, `قيلت النقطةُ كاملةً لطالب التعديل: ${pt}`).not.toContain(pt)
    }
  })

  it('القديمُ يُغلَق بسببٍ يقول إنّ طلبَه قُبل، والجديدُ مرسَلٌ ينتظر توقيعَه', async () => {
    const { c } = await amendmentRequested()
    const out = await accept(c.id)

    const old = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(old.status).toBe('revoked')
    expect(old.revokeReasonAr ?? '').toContain('قُبل طلبُ التعديل')
    expect(old.amendmentReplyAr, 'لم يُحفَظ الجوابُ في خانته').toBe(BODY)
    expect(old.tokenHash, 'مُسح الرمزُ فصار بابُ القديم صامتا').toBeTruthy()

    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: out.contractId } })
    expect(next.status, 'العقدُ المصحَّحُ لم يُرسَل').toBe('sent')
    expect(next.replacesContractId).toBe(c.id)
    expect(next.bodyVersion).toBe(CONTRACT_BODY_VERSION)
    expect(next.number, 'المصحَّحُ برقم القديم').not.toBe(c.number)

    const rows = await prisma.auditEvent.findMany({
      where: { entityType: 'trainer_contract', entityId: c.id }, select: { action: true },
    })
    const actions = rows.map((r) => r.action)
    expect(actions, 'لا أثرَ لقبول التعديل').toContain('trainer.contract.amendment_reissue')
    expect(actions, 'كُتب إعادةً للتوقيع فضاع تمييزُه').not.toContain('trainer.contract.resign_requested')
  })

  it('وبنودُه الخاصّةُ تدخل العقدَ المصحَّح، وتُقال في بطاقة «شروطُك أنت»', async () => {
    const { c } = await amendmentRequested()
    const TERM = 'تتحمّل الأكاديميّةُ رسومَ مصرفها على كلّ حوالة'
    const out = await accept(c.id, { specialTermsAr: TERM })
    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: out.contractId } })
    expect(next.bodyAr ?? '', 'البندُ الخاصّ لم يدخل المتن').toContain(TERM)
    expect(outbox[0].text).toContain('شروطُك أنت')
  })

  it('⚠️ ولا يخرج بسطر «اكتب هنا» لم يُستبدَل — والصفُّ لا يُمَسّ', async () => {
    const { c } = await amendmentRequested()
    await expect(accept(c.id, { bodyAr: `شكرا لك.\n\n${AMENDMENT_PLACEHOLDER_AR}` }))
      .rejects.toMatchObject({ code: 'placeholder_left' })
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(row.status).toBe('amendment_requested')
    expect(outbox.length).toBe(0)
  })

  it('ولا يُقبَل تعديلٌ لا طلبَ له', async () => {
    const { c, token } = await amendmentRequested()
    await review.replyToAmendment(c.id, adminId, 'يبقى العرضُ كما هو')
    void token
    outbox.length = 0
    await expect(accept(c.id)).rejects.toMatchObject({ code: 'bad_state' })
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(row.status, 'أُغلق عرضٌ لا طلبَ تعديلٍ عليه').toBe('sent')
    expect(outbox.length).toBe(0)
  })
})

describe('وما قرأه هو — لا ما حُدّث تحته', () => {
  it('⚠️ عرضٌ حُدّث نصُّه بعد طلبه: يُقال ما تغيّر عمّا قرأه', async () => {
    const { c } = await amendmentRequested()
    /* حالُ محمّد: طلب على إصدارٍ سابق، ثمّ «حدِّث نصَّ العروض المفتوحة» */
    await prisma.trainerContract.update({
      where: { id: c.id }, data: { bodyVersion: CONTRACT_BODY_VERSION },
    })
    await prisma.trainerContract.update({
      where: { id: c.id },
      data: { bodyPrevVersion: OLD_VERSION, bodyUpdatedAt: new Date(Date.now() + 1000) },
    })
    await accept(c.id)
    expect(outbox[0].text, 'قِيس من الصفّ المحدَّث فلم يُقل إنّا عدّلنا').toContain(noteFrom(OLD_VERSION))
  })

  it('⚠️ و«يبقى العرضُ كما هو» لا يقول «لم يتغيّر فيه حرف» عن نصٍّ تغيّر', async () => {
    const { c } = await amendmentRequested()
    await prisma.trainerContract.update({
      where: { id: c.id },
      data: {
        bodyVersion: CONTRACT_BODY_VERSION, bodyPrevVersion: OLD_VERSION,
        bodyUpdatedAt: new Date(Date.now() + 1000),
      },
    })
    await review.replyToAmendment(c.id, adminId, 'لا نستطيع تغييرَ البند الرابع')
    const text = outbox[0].text
    expect(text, 'قيل له إنّ نصَّه لم يتغيّر وقد تغيّر').not.toContain('لم يتغيّر فيه حرف')
    expect(text, 'لم يُقل إنّا عدّلنا العقدَ وأبوابُ ذلك').toContain(noteFrom(OLD_VERSION))
  })

  it('ومن لم يُحدَّث نصُّه يُقال له ذلك كما كان', async () => {
    const { c } = await amendmentRequested()
    await prisma.trainerContract.update({ where: { id: c.id }, data: { bodyVersion: CONTRACT_BODY_VERSION } })
    await review.replyToAmendment(c.id, adminId, 'لا نستطيع تغييرَ البند الرابع')
    expect(outbox[0].text).toContain('لم يتغيّر فيه حرف')
  })
})

/* ═══ ولا تغيير: جملةُ بابه — لا «منذ آخر توقيعٍ لك» (١ أكتوبر ٢٠٢٦) ═══

   من طلب تعديلا لم يوقّع شيئا، وقبولُه يمرّ من رسالة الإعادة للتوقيع. فإن قرأ
   الحاضرَ ولم تُمَسّ شروطُه في النافذة فلا تغيير — وكانت الرسالةُ تقول له
   «لم يتغيّر شيءٌ في بنود عقدك منذ آخر توقيعٍ لك». رآها صاحبُ المنصّة في
   معاينة النافذة قبل أن يرسل. */
describe('ولا تغييرَ فيه — بجملة بابه', () => {
  it('⚠️ قرأ الحاضرَ ولم تُغيَّر شروطُه: «عمّا قرأتَه قبل طلبك» لا «منذ آخر توقيعٍ لك»', async () => {
    const { c } = await amendmentRequested()
    /* قرأ الحاضرَ نفسَه — فلا تغييرَ في القالب، ولا شيءَ في شروطه */
    await prisma.trainerContract.update({ where: { id: c.id }, data: { bodyVersion: CONTRACT_BODY_VERSION } })
    await accept(c.id)
    expect(outbox.length, 'لم تخرج رسالةٌ واحدة').toBe(1)
    const text = outbox[0].text
    expect(text, 'لم تُقَل جملةُ «لا تغيير» لبابه').toContain(AMENDMENT_NO_CHANGES_AR)
    expect(text, 'قيل لمن لم يوقّع إنّه وقّع').not.toContain(RESIGN_NO_CHANGES_AR)
  })
})
