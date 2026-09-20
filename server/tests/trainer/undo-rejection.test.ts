/* التراجعُ عن رفض طلب انضمام — بابُ رجوعٍ واحدٌ بسببٍ إلزاميّ.

   ═══ ما نُقض هنا ═══

   كان `rejected` بلا مخرجٍ في خريطة الانتقالات: من رُدّ بضغطةٍ على الصفّ
   الخطأ، أو بقرارٍ بُني على وثيقةٍ لم تُقرأ، لا يُستعاد إلّا بطلبٍ جديدٍ
   يفقد رقمَه ومستنداتِه ومقابلتَه — وسجلُّ حالته يقول إنّه رُدّ ولا يقول
   إنّنا عدنا. وطلبه صاحبُ المنصّة (١٩ سبتمبر ٢٠٢٦): «عند رفض أيّ مدرّب
   أريد خيارَ التراجع عن الرفض مع ذكر السبب، والذي يصل للمتقدّم بالإيميل».

   ═══ وما يُفحص هنا ═══

   ① **البابُ يُفتح ويُغلق على مقاسه**: `rejected` تصل «قيد المراجعة» ولا
      تصل غيرَها — ولا اعتمادَ بنقرةٍ منها، فالطريقُ خطوتان بقصد.
   ② **ولا نقضَ في صمت**: بلا سببٍ (أو بسببٍ لا يقول شيئا) يُردّ ٤٢٢
      **ولا تتحرّك الحالة** — والحارسُ في الخدمة لا في الشاشة، فيُفحص من
      المسار الذي تناديه أدواتٌ أخرى.
   ③ **والسببُ يبقى في الأثر**: سجلُّ الحالة يحمل الانتقالَ بنصّه وفاعله.
   ④ **وإخفاقُ البريد لا يُسقط القرار**: بوّابةُ الإرسال مغلقةٌ في بيئة
      الاختبار (`mail-gate`)، فالرسالةُ لا تخرج — والحالةُ تعود مع ذلك.
      وصاحبُ الطلب لا يُترك بلا خبرٍ في الإنتاج: نصُّ الرسالة وسفرُ السبب
      فيها محروسان في المسار السريع (`src/tests/trainer-decision-mail.test.ts`)،
      فلا يحتاج نصُّها قاعدةَ بيانات. */

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

const WHY = 'راجعنا شهادةَ الاعتماد بعد القرار فتبيّن أنّ خبرتَه تفي بما تطلبه الشعبة'

const applicant = (n: number) => ({
  fullName: `متقدّمُ التراجع ${n}`, email: `undo-${n}@test.local`,
  specialties: ['القيادة وتطوير المدراء'], domainYears: '4-7', trainingYears: 'workshops',
  trainingLanguages: ['العربية'], deliveryMode: 'remote' as const,
  motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي وأكتب لكل واحد ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const, password: 'Trainer#12345',
})

/** طلبٌ مردودٌ جاهزٌ للتراجع — يُنشأ ويُقدَّم ويُرفض */
async function rejectedApplication(n: number): Promise<{ id: string; reference: string }> {
  const res = await apps.submitPhase1(applicant(n))
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.transition(row.id, 'submitted', null, 'اكتمال الطلب')
  await review.decide(row.id, adminId, 'reject', 'الخبرةُ أقلُّ ممّا تحتاجه الشعبةُ المفتوحة')
  const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: row.id } })
  expect(after.status, 'لم يُرفض الطلبُ أصلا — فلا تراجعَ يُفحص').toBe('rejected')
  return { id: row.id, reference: res.reference }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  /* قناةٌ مفعّلةٌ بوجهةٍ ميّتة — كما في سائر اختبارات هذا الباب: الإرسالُ
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

  const admin = await auth.register('undo-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  const { token } = await auth.login('undo-admin@test.local', 'Admin#12345')
  adminCookie = `${SESSION_COOKIE}=${token}`
}, 240_000)

describe('التراجعُ عن الرفض', () => {
  it('① المردودُ يعود «قيد المراجعة» — والسببُ يبقى في سجلّ حالته', async () => {
    const { id } = await rejectedApplication(1)
    await review.decide(id, adminId, 'undo_reject', WHY)

    const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id } })
    expect(after.status, 'لم يعد الطلبُ إلى المراجعة').toBe('under_review')

    const back = await prisma.trainerStatusHistory.findFirst({
      where: { applicationId: id, fromStatus: 'rejected', toStatus: 'under_review' },
      orderBy: { createdAt: 'desc' },
    })
    expect(back, 'لا أثرَ للتراجع في سجلّ الحالة').toBeTruthy()
    expect(back!.note, 'السببُ لم يُكتب في الأثر').toBe(WHY)
    expect(back!.actorId, 'التراجعُ بلا فاعلٍ مسجَّل').toBe(adminId)
  })

  it('② ولا يُنقض ردٌّ بلا سببٍ يُقرأ — ولا تتحرّك الحالةُ بمحاولةٍ مردودة', async () => {
    const { id } = await rejectedApplication(2)
    /* بلا شيء */
    await expect(review.decide(id, adminId, 'undo_reject')).rejects.toMatchObject({ code: 'reason_required' })
    /* وبكلمةٍ لا تقول شيئا — الحدُّ عشرةُ أحرف */
    await expect(review.decide(id, adminId, 'undo_reject', 'خطأ')).rejects.toMatchObject({ code: 'reason_required' })
    const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id } })
    expect(after.status, 'تحرّكت الحالةُ رغم ردّ المحاولة').toBe('rejected')
  })

  it('③ والمسارُ يقبله بسببه ويردّه بلا سبب — فالشاشةُ ليست الحارسَ الوحيد', async () => {
    const { id } = await rejectedApplication(3)

    const bare = await app.inject({
      method: 'POST', url: `/api/admin/trainer-applications/${id}/decision`,
      headers: { cookie: adminCookie }, payload: { action: 'undo_reject' },
    })
    expect(bare.statusCode, 'قُبل نقضُ قرارٍ بلا كلمةٍ تُقال لصاحبه').toBe(422)
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id } })).status).toBe('rejected')

    const ok = await app.inject({
      method: 'POST', url: `/api/admin/trainer-applications/${id}/decision`,
      headers: { cookie: adminCookie }, payload: { action: 'undo_reject', note: WHY },
    })
    expect(ok.statusCode, 'رُدَّ التراجعُ من المسار').toBe(200)
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id } })).status).toBe('under_review')
    /* وحالُ البريد يُعاد إلى الشاشة لا يُبتلع: هي وحدَها تَعِد بأنّ السببَ
       وصل صاحبَه، فلا تقولها على ظنّ. وهنا «failed» لأنّ بوّابةَ الإرسال
       مغلقةٌ في الاختبار — والمهمُّ أنّ الحالَ يُقال لا أنّه نجاح. */
    expect(ok.json().emailDelivery, 'حالُ بريد التراجع لا يصل الشاشة')
      .toMatch(/^(sent|failed|not_configured)$/)
  })

  it('④ وإخفاقُ البريد لا يُسقط التراجع — القرارُ حقيقةٌ في القاعدة والرسالةُ إشعارٌ بها', async () => {
    /* بوّابةُ الإرسال مغلقةٌ في هذه البيئة (`mail-gate`)، فلا رسالةَ تخرج.
       ولو كان القرارُ معلَّقا بنجاحها لَبقي الطلبُ مردودا بلا سببٍ ظاهر. */
    const { id } = await rejectedApplication(4)
    await expect(review.decide(id, adminId, 'undo_reject', WHY)).resolves.not.toThrow()
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id } })).status).toBe('under_review')
  })

  it('⑤ والبابُ واحدٌ: لا اعتمادَ بنقرةٍ من مردودٍ ولا انتقالَ إلى غير المراجعة', async () => {
    expect(ALLOWED_TRANSITIONS.rejected, 'انفتح للمردود أكثرُ من بابٍ واحد').toEqual(['under_review'])
    expect(
      [...ONE_CLICK_APPROVABLE_STATUSES] as string[],
      'صار المردودُ يُعتمَد بنقرةٍ — والطريقُ خطوتان بقصد',
    ).not.toContain('rejected')

    const { id } = await rejectedApplication(5)
    await expect(review.decide(id, adminId, 'approve')).rejects.toMatchObject({ code: 'bad_transition' })
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id } })).status).toBe('rejected')
  })
})
