/* ما يفعله «اعتمِدِ التوقيع» بحسب ما وقّعه صاحبُه — وما يقرأ الحالَ الجديدةَ بعده.
 * بقاعدةٍ حقيقيّة.
 *
 * قرارُ صاحب المنصّة (١ أكتوبر ٢٠٢٦): «لا أريد أن أتعاقد مع أحدٍ قبل أن أعتمد
 * دوراته». فاعتمادُ توقيعِ العرض المشروط لا يختم، ونختمه عند النشر —
 * و`countersign-then-publish.test.ts` يقيس ذلك وما بعده. وهذا الملفُّ يقيس ما حوله:
 *
 * ① عرضٌ وُقّع على متنٍ يجعل الاعتمادَ توقيعا (v12–v23) لا يُختَم بنقرةٍ لم تطلبه:
 *    يُردّ بالخيارين ولا يُمَسّ صفُّه. ويُعتمَد كما وقّعه بطلبٍ صريح (`asSigned`)
 *    فيُختَم الآن بنصّه ويُفتح طورُ موادّه — قرارُ صاحب المنصّة (٢ أكتوبر ٢٠٢٦):
 *    «Do not force me to do any action». و`asSigned` لا يختم نصّا حاضرا.
 *    ومتنُ v4–v11 يقول قولَ اليوم.
 * ② والعقدُ غيرُ المشروط يُختَم باعتماد توقيعه كما كان، ويُزيح نافذا قبله.
 * ③ والعاملان يجدان من في طور الموادّ بحاله الجديدة (`signature_approved`)،
 *    وبريدُ الانقضاء يُحيل على بند «لا إخلال» في متنه هو لا على رقمٍ مكتوب.
 * ④ ومن خُتم عرضُه قبل اعتماد موادّه (٢٧ سبتمبر — ١ أكتوبر) يُركَّب له عقدُه
 *    التالي مشروطا — وخَتمُ الباب القديم يبقى اعتمادا.
 * ⑤ والبندُ 4-10 يُعدّ مقبولا بعقدٍ نافذٍ يحمله، لا بعقدٍ «ينتظر اعتمادنا» وحدَه.
 * ⑥ وإنهاءُ عرضٍ لم نوقّعه يُقال «انتهى العرض» لا «انتهى العقدُ بيننا».
 *
 * والبريدُ يُلتقَط عند `sendDirectEmail` — فما يُقاس هو ما خرج من الخدمة.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'

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
import { TrainerDepartureService } from '../../services/trainer-departure.service'
import { TrainerCodeService } from '../../services/trainer-code.service'
import { ACADEMY_LEGAL } from '../../../src/data/academy-legal'
import { CONDITION_CLAUSE_MARK, NO_FAULT_CLAUSE_OPENING } from '../../../src/application/trainer/contract-body'
import { CODE_TERMS_FIRST_BODY } from '../../../src/application/trainer/trainer-code'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const DAY = 86_400_000

/* متنٌ فيه بندُ الشرط وبندُ «لا إخلال» **برقمٍ غيرِ رقمه في الحاضر** (2-10 لا
   2-11) بقصد: إن قرأ العاملُ رقما مكتوبا لا رقمَ المتن سقط ③ */
const BODY = `نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.
${CONDITION_CLAUSE_MARK}: تعتمد الأكاديمية توقيع المدرب.
2-10 ${NO_FAULT_CLAUSE_OPENING} — بأن لم تقبل الأكاديمية ما قدمه المدرب، فلا يعد ذلك إخلالا من أي من الطرفين.`

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  adminId = (await auth.register('modes-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')).userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

beforeEach(() => { outbox.length = 0 })

let seq = 0

/** مرشّحٌ وعقدُه بالحال المطلوبة. والصفُّ يُكتب بيدٍ: المقيسُ ما يقع بعده
 *  لا طريقُه إليه — وطريقُه مقيسٌ في ملفّاته. */
async function trainerWith(
  contract: Omit<Prisma.TrainerContractUncheckedCreateInput, 'profileId' | 'title'>,
  appStatus = 'contract_pending',
) {
  seq += 1
  const email = `modes-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مدرّبٌ ${seq}`)
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-MODES-${Date.now()}-${seq}`, fullName: `مدرّبٌ ${seq}`, email,
      status: appStatus, motivation: 'اختبار', privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, isVerified: true },
  })
  const row = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `عقدُ ${seq}`,
      bodyAr: BODY, bodyHash: sha256(BODY), signedBodyHash: sha256(BODY),
      signerEmail: email, signerLegalName: `الاسمُ القانونيُّ ${seq}`, signedAt: new Date(),
      ...contract,
    },
  })
  return { application, profile, contract: row, userId: user.userId, email }
}

const rowOf = (id: string) => prisma.trainerContract.findUniqueOrThrow({ where: { id } })

describe('① ما وُقّع على نصٍّ يجعل الاعتمادَ توقيعا — يُختار فيه ولا يُختَم صامتا', () => {
  it('⚠️ بلا طلبٍ صريح يُردّ بالخيارين — والصفُّ كما هو، ولا بريد', async () => {
    const t = await trainerWith({ status: 'signed', gatesActivation: true, bodyVersion: 'v20-2026-10-01' })
    await expect(review.approveSignature(t.contract.id, adminId, { noteAr: 'طابقتُ الاسمَ' }))
      .rejects.toMatchObject({ code: 'sealed_by_text' })
    const row = await rowOf(t.contract.id)
    expect(row.status, 'تغيّرت حالُ عرضٍ رُدّ اعتمادُه').toBe('signed')
    expect(row.countersignedAt, 'خُتم عرضٌ نصُّه يجعل الاعتمادَ توقيعا').toBeNull()
    expect(row.signatureApprovedAt, 'اعتُمد بلا خَتمٍ خلافَ ما وقّعه').toBeNull()
    expect(outbox, 'خرج بريدُ اعتمادٍ لم يقع').toHaveLength(0)
  })

  /* «اعتمِدْه كما وقّعه»: نصُّه يجعل الاعتمادَ توقيعا، فيُختَم الآن — وطورُ موادّه
     يُفتح كسائر العروض، فهو لم يُنشَر ولم تُعتمَد دوراتُه بعد. */
  it('⚠️ وبطلبٍ صريح يُعتمَد كما وقّعه: يُختَم الآن بنصّه ويُفتح طورُ موادّه', async () => {
    const t = await trainerWith({ status: 'signed', gatesActivation: true, bodyVersion: 'v20-2026-10-01' })
    const out = await review.approveSignature(t.contract.id, adminId, {
      noteAr: 'طابقتُ الاسمَ بجواز السفر', asSigned: true,
    })
    expect(out.sealed, 'اعتُمد كما وقّعه ولم يُختَم — ونصُّه يجعل الاعتمادَ توقيعا').toBe(true)
    const row = await rowOf(t.contract.id)
    expect(row.status).toBe('countersigned')
    expect(row.academySignatoryName, 'خُتم بلا اسم المفوَّض').toBe(ACADEMY_LEGAL.signatoryNameAr)
    expect(row.countersignedBy).toBe(adminId)
    expect(row.signatureApprovedAt?.getTime(), 'اعتمادُ التوقيع وخَتمُه وقعا معا')
      .toBe(row.countersignedAt?.getTime())
    expect(row.conditionDeadlineAt, 'خُتم ولم يُفتح طورُ موادّه').not.toBeNull()
    expect(row.conditionMetAt, 'تحقّق شرطُه ولم تُعتمَد دوراتُه').toBeNull()
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: t.application.id } })
    expect(app.status, 'اعتُمد ولم يدخل طورَ الموادّ').toBe('onboarding')

    /* والسجلُّ يقول لمَ خُتم عرضٌ مشروطٌ قبل اعتماد دوراته */
    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.contract.countersign', entityId: t.contract.id },
    })
    expect((audit?.meta as { acceptedAsSigned?: boolean } | null)?.acceptedAsSigned,
      'لا يقول السجلُّ إنّه اعتُمد كما وقّعه').toBe(true)

    /* وبريدُه يقول إنّا وقّعناه الآن — لا «نوقّعه حين نعتمد دوراتك» */
    const mail = outbox.find((m) => m.to === t.email)
    expect(mail?.text ?? '', 'لم يُقل له إنّا وقّعناه').toContain('ووقّعنا العقدَ من جهتنا بالنصّ الذي وقّعتَه')
    expect(mail?.text ?? '', 'وُعد بتوقيعٍ وقع').not.toContain('وسنوقّع العقدَ من جهتنا')
  })

  /* والطلبُ الصريحُ يعبر المسارَ نفسَه الذي تضغطه الشاشة: لو أسقطه المسارُ لَردّه
     الخادمُ بالخيارين بعد أن اختار المعتمِدُ أحدَهما — وهو ما يُقاس هنا بالطلب
     كما يصل، لا بنداء الخدمة. */
  it('⚠️ و«كما وقّعه» يعبر المسارَ إلى الخدمة — وبلاه يُردّ بالخيارين لا بأحدهما', async () => {
    const app = await buildApp(prisma)
    const suEmail = `modes-su-${Date.now()}@test.local`
    const su = await auth.register(suEmail, 'Super#12345', 'المدير الأعلى')
    await auth.setRoles(su.userId, ['super_admin'])
    const { token } = await auth.login(suEmail, 'Super#12345')
    const cookie = `${SESSION_COOKIE}=${token}`
    const t = await trainerWith({ status: 'signed', gatesActivation: true, bodyVersion: 'v22-2026-10-01' })
    const url = `/api/admin/trainer-contracts/${t.contract.id}/countersign`

    const plain = await app.inject({ method: 'POST', url, headers: { cookie }, payload: { noteAr: 'طابقتُ الاسمَ' } })
    expect(plain.statusCode, 'اعتُمد بلا طلبٍ صريح').toBe(409)
    expect(plain.json().error?.code).toBe('sealed_by_text')
    expect(plain.json().error?.message_ar ?? '', 'رُدّ بغير الخيارين')
      .toMatch(/أن تعتمده كما وقّعه[\s\S]*أن تعيده للتوقيع/)

    const asSigned = await app.inject({
      method: 'POST', url, headers: { cookie }, payload: { noteAr: 'طابقتُ الاسمَ', asSigned: true },
    })
    expect(asSigned.statusCode, `سقط الطلبُ الصريحُ في المسار: ${asSigned.body}`).toBe(200)
    expect(asSigned.json().sealed).toBe(true)
    expect((await rowOf(t.contract.id)).status).toBe('countersigned')
    await app.close()
  })

  /* و`asSigned` معناه «بنصّه»: والنصُّ الحاضرُ لا يجعل الاعتمادَ توقيعا — فلا يُختَم به */
  it('⚠️ ولا يختم `asSigned` عرضا على النصّ الحاضر — يُعتمَد توقيعُه وحدَه', async () => {
    const t = await trainerWith({ status: 'signed', gatesActivation: true, bodyVersion: 'v24-2026-10-01' })
    const out = await review.approveSignature(t.contract.id, adminId, { asSigned: true })
    expect(out.sealed, 'خُتم عرضٌ نصُّه لا يجعل الاعتمادَ توقيعا').toBe(false)
    const row = await rowOf(t.contract.id)
    expect(row.status).toBe('signature_approved')
    expect(row.countersignedAt).toBeNull()
  })

  it('ومتنُ v4–v11 يقول قولَ اليوم («توقع… يوم يتحقق الشرط») — فيُعتمَد بلا خَتم', async () => {
    const t = await trainerWith({ status: 'signed', gatesActivation: true, bodyVersion: 'v11-2026-09-27' })
    const out = await review.approveSignature(t.contract.id, adminId, {})
    expect(out.sealed).toBe(false)
    const row = await rowOf(t.contract.id)
    expect(row.status).toBe('signature_approved')
    expect(row.countersignedAt).toBeNull()
  })
})

describe('② والعقدُ غيرُ المشروط يُختَم باعتماد توقيعه — كما كان', () => {
  it('⚠️ يوقّع عنّا الآن، ويُزيح نافذا قبله، ويقول بريدُه إنّه نفذ', async () => {
    const t = await trainerWith({
      status: 'countersigned', gatesActivation: false, bodyVersion: 'v20-2026-10-01',
      countersignedAt: new Date(Date.now() - 30 * DAY),
    }, 'active')
    const next = await prisma.trainerContract.create({
      data: {
        profileId: t.profile.id, title: 'بندٌ يُوثَّق', status: 'signed', gatesActivation: false,
        bodyVersion: 'v24-2026-10-01', bodyAr: BODY, bodyHash: sha256(BODY), signedBodyHash: sha256(BODY),
        signedAt: new Date(), signerLegalName: 'الاسمُ القانونيّ', signerEmail: t.email,
      },
    })
    const out = await review.approveSignature(next.id, adminId, { noteAr: 'طابقتُ الاسمَ' })
    expect(out.sealed, 'لم يُختَم عقدٌ غيرُ مشروط باعتماد توقيعه').toBe(true)
    const row = await rowOf(next.id)
    expect(row.status).toBe('countersigned')
    expect(row.academySignatoryName).toBe(ACADEMY_LEGAL.signatoryNameAr)
    /* واعتمادُ توقيعه مكتوبٌ معه — وقع في اللحظة نفسِها */
    expect(row.signatureApprovedAt?.getTime()).toBe(row.countersignedAt?.getTime())
    const prior = await rowOf(t.contract.id)
    expect(prior.status, 'بقي للمدرّب عقدان نافذان').toBe('superseded')
    expect(outbox.find((m) => m.to === t.email)?.text ?? '').toContain('فصار العقدُ نافذا بين الطرفين')
  })
})

describe('③ والعاملان يجدان من في طور الموادّ بحاله الجديدة', () => {
  it('⚠️ التذكيرُ يصل من اعتُمد توقيعُه ولم نوقّعه', async () => {
    const t = await trainerWith({
      status: 'signature_approved', gatesActivation: true, bodyVersion: 'v24-2026-10-01',
      signatureApprovedAt: new Date(Date.now() - 4 * DAY),
      conditionDeadlineAt: new Date(Date.now() + DAY),
    }, 'onboarding')
    await review.remindConditionDeadlines()
    expect((await rowOf(t.contract.id)).conditionRemindedAt, 'لم يجد التذكيرُ من في طور الموادّ')
      .not.toBeNull()
    expect(outbox.some((m) => m.to === t.email), 'لم يصله التذكير').toBe(true)
  })

  it('⚠️ والانقضاءُ يصله — ويُحيل على بند «لا إخلال» في متنه هو', async () => {
    const t = await trainerWith({
      status: 'signature_approved', gatesActivation: true, bodyVersion: 'v24-2026-10-01',
      signatureApprovedAt: new Date(Date.now() - 6 * DAY),
      conditionDeadlineAt: new Date(Date.now() - DAY),
    }, 'onboarding')
    await review.noticeLapsedConditions()
    const mail = outbox.find((m) => m.to === t.email)
    expect(mail, 'لم يصله خبرُ الانقضاء').toBeDefined()
    expect(mail!.text, 'أحال على غير بند «لا إخلال» في متنه').toContain('البند 2-10 من عرضك')
  })
})

describe('④ وخَتمٌ على عرضٍ مشروطٍ قبل اعتماد موادّه ليس اعتمادا لها', () => {
  it('⚠️ يُركَّب له عقدُه التالي مشروطا', async () => {
    const t = await trainerWith({
      status: 'countersigned', gatesActivation: true, bodyVersion: 'v20-2026-10-01',
      countersignedAt: new Date(Date.now() - 2 * DAY),
      conditionDeadlineAt: new Date(Date.now() + 3 * DAY),
    }, 'onboarding')
    const pre = await review.contractPrefill(t.application.id)
    expect(pre.gatesActivation, 'خرج عقدُه التالي غيرَ مشروطٍ ولم تُعتمَد موادُّه').toBe(true)
  })

  it('وخَتمُ الباب القديم — لا مهلةَ تحته — يبقى اعتمادا', async () => {
    const t = await trainerWith({
      status: 'countersigned', gatesActivation: true, bodyVersion: null,
      countersignedAt: new Date('2026-08-01T00:00:00Z'),
    }, 'active')
    expect((await review.contractPrefill(t.application.id)).gatesActivation,
      'أُعيد اشتراطُ من يعمل بعقدٍ قديم').toBe(false)
  })
})

describe('⑤ والبندُ 4-10 مقبولٌ بعقدٍ نافذٍ يحمله', () => {
  it('⚠️ لا يُطلب من مدرّبٍ نافذٍ عقدُه أن يقبله ثانيةً', async () => {
    const t = await trainerWith({
      status: 'countersigned', gatesActivation: false,
      bodyVersion: `v${CODE_TERMS_FIRST_BODY}-2026-10-01`, countersignedAt: new Date(),
    }, 'active')
    const terms = await new TrainerCodeService(prisma).termsFor(t.profile.id, t.userId)
    expect(terms.accepted, 'عقدُه النافذُ يحمل البندَ ولا يُعدّ قبولا').toBe(true)
    expect(terms.via).toBe('contract')
  })
})

describe('⑥ وإنهاءُ عرضٍ لم نوقّعه يُسمّى باسمه', () => {
  it('⚠️ يُنهى العرض — ورسالتُه لا تقول «انتهى العقدُ بيننا»', async () => {
    const t = await trainerWith({
      status: 'signature_approved', gatesActivation: true, bodyVersion: 'v24-2026-10-01',
      signatureApprovedAt: new Date(), conditionDeadlineAt: new Date(Date.now() + 3 * DAY),
    }, 'onboarding')
    await new TrainerDepartureService(prisma).open(adminId, t.profile.id, 'انسحب قبل أن يُكمل موادَّه')
    expect((await rowOf(t.contract.id)).status, 'بقي العرضُ مفتوحا بعد رحيله').toBe('terminated')
    const mail = outbox.find((m) => m.to === t.email)
    expect(mail, 'لم يصله أنّ العرضَ انتهى').toBeDefined()
    expect(mail!.text, 'قيل له إنّ عقدا انتهى ولم نوقّعه').not.toContain('انتهى العقدُ بيننا')
    expect(mail!.text).toContain('انتهى العرضُ الذي وقّعتَه')
  })
})
