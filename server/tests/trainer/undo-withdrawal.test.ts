/* إعادةُ الطلب المسحوب — بابُ المردود بعينه، بسببٍ إلزاميٍّ يصل صاحبَه.

   ═══ ما نُقض هنا ═══

   كان `withdrawn` نهايةً بلا مخرجٍ في خريطة الانتقالات: من سُحب طلبُه —
   بيده أو بيدنا، بخطأٍ أو بقرارٍ تبدّل — لا يُستعاد إلّا بطلبٍ جديدٍ يفقد
   رقمَه ومستنداتِه ومقابلتَه. وطلبه صاحبُ المنصّة (٢٩ سبتمبر ٢٠٢٦): «هناك
   حساباتٌ مسحوبة.. أرجو إعادتها».

   ═══ وما يُفحص هنا ═══

   ①–⑤ ما يُفحص في التراجع عن الرفض (`undo-rejection.test.ts`) بحذوه: البابُ
      إلى «قيد المراجعة» وحدَها، ولا عودةَ في صمت، والسببُ في الأثر، وإخفاقُ
      البريد لا يُسقط القرار، ولا اعتمادَ بنقرةٍ من مسحوب.
   ⑥ **ولا يُعاد إلّا آخرُ طلبٍ لصاحبه** — والمسحوبُ يسمح لصاحب البريد بطلبٍ
      جديد. فإن كان الجديدُ قائما رُدّت الإعادةُ (وإلّا صار له طلبان حيّان)،
      وإن انتهى هو أيضا رُدّت إعادةُ القديم: فُكّ عن الحساب يومَ تقدّم ثانيةً،
      فلا يراه صاحبُه ولا يجد الاعتمادُ حسابا يمنحه دورَه. والحارسُ للبابَين
      معا — فالمردودُ يتقدّم ثانيةً كما يتقدّم المسحوب.
   ⑦ **ولكلّ نهايةٍ بابُها** — الخريطةُ تسأل عن الوجهة لا عن الفعل، والنهايتان
      تصلان «قيد المراجعة» كما يصلها `move_to_review`. فكان المردودُ يُعاد به
      بلا سببٍ ولا رسالة، وكاد المسحوبُ يُعاد بـ`undo_reject` فتصله «عُدنا في
      قرارنا» عن قرارٍ لم نتّخذه. فالفعلُ يُقابَل بالحالة في `decide`.

   ونصُّ الرسالة وسفرُ السبب فيها محروسان في المسار السريع
   (`src/tests/trainer-decision-mail.test.ts`). */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { ALLOWED_TRANSITIONS, TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { ONE_CLICK_APPROVABLE_STATUSES } from '../../../src/application/trainer/approval'

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService
let review: TrainerReviewService
let app: FastifyInstance
let adminId = ''
let adminCookie = ''

const WHY = 'سُحب الطلبُ بضغطةٍ على الصفّ الخطأ، وصاحبُه ما زال يريد المضيَّ فيه'

const applicant = (n: number) => ({
  fullName: `متقدّمُ الإعادة ${n}`, email: `restore-${n}@test.local`,
  specialties: ['القيادة وتطوير المدراء'], domainYears: '4-7', trainingYears: 'workshops',
  trainingLanguages: ['العربية'], deliveryMode: 'remote' as const,
  motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي وأكتب لكل واحد ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const, password: 'Trainer#12345',
})

/** طلبٌ مقدَّمٌ لصاحب هذا الرقم — يُنشأ ويُقدَّم */
async function submitted(n: number): Promise<{ id: string; reference: string; userId: string }> {
  const res = await apps.submitPhase1(applicant(n))
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.transition(row.id, 'submitted', null, 'اكتمال الطلب')
  return { id: row.id, reference: res.reference, userId: res.userId }
}

/** طلبٌ مسحوبٌ جاهزٌ للإعادة — يسحبه صاحبُه من حسابه، بالمسار الذي يسلكه فعلا */
async function withdrawnApplication(n: number): Promise<{ id: string; reference: string; userId: string }> {
  const a = await submitted(n)
  await apps.withdrawMine(a.userId, 'تغيّرت ظروفي')
  const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
  expect(after.status, 'لم يُسحب الطلبُ أصلا — فلا إعادةَ تُفحص').toBe('withdrawn')
  return a
}

const statusOf = async (id: string) =>
  (await prisma.trainerApplication.findUniqueOrThrow({ where: { id } })).status

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  /* قناةٌ مفعّلةٌ بوجهةٍ ميّتة — كما في `undo-rejection.test.ts`: الإرسالُ
     يخفق ولا يخرج شيءٌ إلى الشبكة، والقرارُ يُفحص وحدَه. */
  process.env.RESEND_BASE_URL = 'http://127.0.0.1:1'
  await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled: true, config: { apiKey: 're_test_key', fromName: 'أكاديمية وجيز', fromEmail: 'no-reply@test.local' } },
    create: { provider: 'email', enabled: true, config: { apiKey: 're_test_key', fromName: 'أكاديمية وجيز', fromEmail: 'no-reply@test.local' } },
  })
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  app = await buildApp(prisma)

  const admin = await auth.register('restore-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  const { token } = await auth.login('restore-admin@test.local', 'Admin#12345')
  adminCookie = `${SESSION_COOKIE}=${token}`
}, 240_000)

describe('إعادةُ الطلب المسحوب', () => {
  it('① المسحوبُ يعود «قيد المراجعة» — والسببُ وفاعلُه في سجلّ حالته', async () => {
    const { id } = await withdrawnApplication(1)
    await review.decide(id, adminId, 'undo_withdraw', WHY)

    expect(await statusOf(id), 'لم يعد الطلبُ إلى المراجعة').toBe('under_review')
    const back = await prisma.trainerStatusHistory.findFirst({
      where: { applicationId: id, fromStatus: 'withdrawn', toStatus: 'under_review' },
      orderBy: { createdAt: 'desc' },
    })
    expect(back, 'لا أثرَ للإعادة في سجلّ الحالة').toBeTruthy()
    expect(back!.note, 'السببُ لم يُكتب في الأثر').toBe(WHY)
    expect(back!.actorId, 'الإعادةُ بلا فاعلٍ مسجَّل').toBe(adminId)
  })

  it('② ولا يُعاد طلبٌ بلا سببٍ يُقرأ — ولا تتحرّك الحالةُ بمحاولةٍ مردودة', async () => {
    const { id } = await withdrawnApplication(2)
    await expect(review.decide(id, adminId, 'undo_withdraw')).rejects.toMatchObject({ code: 'reason_required' })
    /* وبكلمةٍ لا تقول شيئا — الحدُّ عشرةُ أحرف، كحدّ التراجع عن الرفض */
    await expect(review.decide(id, adminId, 'undo_withdraw', 'خطأ')).rejects.toMatchObject({ code: 'reason_required' })
    expect(await statusOf(id), 'تحرّكت الحالةُ رغم ردّ المحاولة').toBe('withdrawn')
  })

  it('③ والمسارُ يقبله بسببه ويردّه بلا سبب — وحالُ البريد يعود إلى الشاشة', async () => {
    const { id } = await withdrawnApplication(3)

    const bare = await app.inject({
      method: 'POST', url: `/api/admin/trainer-applications/${id}/decision`,
      headers: { cookie: adminCookie }, payload: { action: 'undo_withdraw' },
    })
    expect(bare.statusCode, 'قُبلت إعادةُ طلبٍ بلا كلمةٍ تُقال لصاحبه').toBe(422)
    expect(await statusOf(id)).toBe('withdrawn')

    const ok = await app.inject({
      method: 'POST', url: `/api/admin/trainer-applications/${id}/decision`,
      headers: { cookie: adminCookie }, payload: { action: 'undo_withdraw', note: WHY },
    })
    expect(ok.statusCode, 'رُدّت الإعادةُ من المسار').toBe(200)
    expect(await statusOf(id)).toBe('under_review')
    /* الشاشةُ وحدَها تَعِد بأنّ السببَ وصل صاحبَه، فلا تقولها على ظنّ */
    expect(ok.json().emailDelivery, 'حالُ بريد الإعادة لا يصل الشاشة')
      .toMatch(/^(sent|failed|not_configured)$/)
  })

  it('④ وإخفاقُ البريد لا يُسقط الإعادة — القرارُ حقيقةٌ في القاعدة والرسالةُ إشعارٌ بها', async () => {
    const { id } = await withdrawnApplication(4)
    await expect(review.decide(id, adminId, 'undo_withdraw', WHY)).resolves.not.toThrow()
    expect(await statusOf(id)).toBe('under_review')
  })

  it('⑤ والبابُ واحدٌ: لا اعتمادَ بنقرةٍ من مسحوبٍ ولا انتقالَ إلى غير المراجعة', async () => {
    expect(ALLOWED_TRANSITIONS.withdrawn, 'انفتح للمسحوب غيرُ بابٍ واحد').toEqual(['under_review'])
    expect(
      [...ONE_CLICK_APPROVABLE_STATUSES] as string[],
      'صار المسحوبُ يُعتمَد بنقرةٍ — والطريقُ خطوتان بقصد',
    ).not.toContain('withdrawn')

    const { id } = await withdrawnApplication(5)
    await expect(review.decide(id, adminId, 'approve')).rejects.toMatchObject({ code: 'bad_transition' })
    expect(await statusOf(id)).toBe('withdrawn')
  })
})

describe('⑥ ولا يُعاد إلّا آخرُ طلبٍ لصاحبه', () => {
  it('سحب ثمّ تقدّم ثانيةً وطلبُه الجديدُ قائم — لا يُعاد القديمُ فيصيرَ له طلبان', async () => {
    const old = await withdrawnApplication(6)
    const fresh = await submitted(6)

    await expect(review.decide(old.id, adminId, 'undo_withdraw', WHY))
      .rejects.toMatchObject({ code: 'live_application_exists' })
    expect(await statusOf(old.id), 'أُعيد القديمُ وللبريد طلبٌ قائم').toBe('withdrawn')
    expect(await statusOf(fresh.id)).toBe('submitted')
  })

  it('وانتهى الجديدُ أيضا — يُعاد هو لا القديمُ الذي فُكّ عن الحساب', async () => {
    const old = await withdrawnApplication(7)
    const fresh = await withdrawnApplication(7)

    const unlinked = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: old.id } })
    expect(unlinked.userId, 'لم يُفكّ القديمُ عن الحساب — فلا يُفحص ما بُني عليه').toBeNull()

    await expect(review.decide(old.id, adminId, 'undo_withdraw', WHY))
      .rejects.toMatchObject({ code: 'newer_application_exists' })
    expect(await statusOf(old.id), 'أُعيد طلبٌ لا يراه صاحبُه في حسابه').toBe('withdrawn')

    /* والأحدثُ يُعاد، وحسابُه معه — فيراه صاحبُه ويجده الاعتماد */
    await review.decide(fresh.id, adminId, 'undo_withdraw', WHY)
    const back = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: fresh.id } })
    expect(back.status).toBe('under_review')
    expect(back.userId, 'أُعيد الأحدثُ بلا حسابه').toBe(fresh.userId)
  })

  it('والحارسُ للمردود أيضا — رُدّ فتقدّم ثانيةً، فلا يُتراجَع عن ردّ الأوّل', async () => {
    const old = await submitted(8)
    await review.decide(old.id, adminId, 'reject', 'الخبرةُ أقلُّ ممّا تحتاجه الشعبةُ المفتوحة')
    await submitted(8)

    await expect(review.decide(old.id, adminId, 'undo_reject', WHY))
      .rejects.toMatchObject({ code: 'live_application_exists' })
    expect(await statusOf(old.id)).toBe('rejected')
  })
})

describe('⑦ ولكلّ نهايةٍ بابُها — لا يُفتح بغيره', () => {
  it('المسحوبُ لا يُعاد بـ«بدء المراجعة» ولا بالتراجع عن الرفض — فلا عودةَ بلا سبب ولا رسالةَ عن قرارٍ لم يقع', async () => {
    const { id } = await withdrawnApplication(9)
    await expect(review.decide(id, adminId, 'move_to_review', WHY)).rejects.toMatchObject({ code: 'bad_transition' })
    await expect(review.decide(id, adminId, 'undo_reject', WHY)).rejects.toMatchObject({ code: 'bad_transition' })
    expect(await statusOf(id), 'أُعيد المسحوبُ من غير بابه').toBe('withdrawn')
  })

  it('والمردودُ كذلك — وكان يُعاد بـ«بدء المراجعة» من فوق حارس التراجع', async () => {
    const { id } = await submitted(10)
    await review.decide(id, adminId, 'reject', 'الخبرةُ أقلُّ ممّا تحتاجه الشعبةُ المفتوحة')
    await expect(review.decide(id, adminId, 'move_to_review')).rejects.toMatchObject({ code: 'bad_transition' })
    await expect(review.decide(id, adminId, 'undo_withdraw', WHY)).rejects.toMatchObject({ code: 'bad_transition' })
    expect(await statusOf(id), 'أُعيد المردودُ من غير بابه').toBe('rejected')
  })

  it('وفعلُ الرجوع لا يُستعمل على طلبٍ حيّ — فلا تصله رسالةُ عودةٍ وهو لم يخرج', async () => {
    const { id } = await submitted(11)
    await expect(review.decide(id, adminId, 'undo_reject', WHY)).rejects.toMatchObject({ code: 'bad_transition' })
    await expect(review.decide(id, adminId, 'undo_withdraw', WHY)).rejects.toMatchObject({ code: 'bad_transition' })
    expect(await statusOf(id)).toBe('submitted')
  })
})
