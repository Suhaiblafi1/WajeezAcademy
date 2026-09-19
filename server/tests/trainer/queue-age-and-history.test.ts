/* ما يُحسب به عمرُ الطلب، ومن تقدّم سابقا.

   ═══ ① العمرُ من آخر حركةٍ لا من الإنشاء ═══

   الشارةُ في الطابور تقول «عندنا منذ كذا». فلو قِيست من تاريخ الإنشاء
   لاحمرَّ طلبٌ نُقل أمسِ إلى مراجعةٍ أكاديميّة لأنّه قُدّم قبل شهر — ويُقرأ
   ذلك تقصيرا لم يقع. والخادمُ هو من يردّ اللحظة، فهنا تُفحص.

   ═══ ② ومن رُدّ ثمّ عاد لا يبدو جديدا ═══

   حُذفت مدّةُ الستّة أشهر (١٩ سبتمبر) فصار المردودُ يتقدّم في الغد. وهذا
   الفحصُ يقيس ما بُني لأجله: أن يفتح المراجعُ الطلبَ الثاني فيجد أمامه
   رقمَ الأوّل ومآلَه **والسببَ الداخليَّ كما كُتب** — وهو سببٌ لم يصل
   صاحبَه في بريده، فموضعُه هنا وحدَه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'

let prisma: PrismaClient
let apps: TrainerApplicationService
let review: TrainerReviewService
let adminId = ''

const S = Date.now().toString(36).slice(-5)
const EMAIL = `returning-${S}@test.local`
const PASSWORD = 'Trainer#12345'
const REJECT_NOTE = 'الأدلّةُ المرفقةُ لا تُظهر تدريبا فعليّا — ولا فيديو'

const base = {
  phoneCountryCode: '+962', phone: '771050000', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدرّبة تسويق', specialties: ['التسويق الرقمي'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرةٌ ميدانيّة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'درّبتُ فرقا حقيقيّةً في بيئات عملٍ عربيّة، وأعرف الفرقَ بين من يعرف المادّة ومن يستطيع تعليمها. سأعطي كلَّ متعلّمٍ مهمّةً من واقع عمله في كلّ وحدة، وأراجع مخرجاته بنفسي وأكتب له ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const,
  password: PASSWORD,
}

/** طلبٌ مكتملٌ ببريدٍ موثَّق — نقطةُ البداية الواقعيّة */
async function submit(fullName: string) {
  const res = await apps.submitPhase1({ ...base, email: EMAIL, fullName })
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' },
  })
  await prisma.trainerApplication.update({ where: { id: row.id }, data: { emailVerifiedAt: new Date() } })
  return { id: row.id, reference: res.reference }
}

let first: { id: string; reference: string }
let second: { id: string; reference: string }

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register(`admin-history-${S}@test.local`, 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])

  first = await submit('سلمى العمري')
  await review.decide(first.id, adminId, 'reject', REJECT_NOTE)

  /* ═══ والطلبُ الثاني يُكتب في القاعدة مباشرةً ═══

     موضوعُ لوح «تقدّم سابقا» أن يجتمع طلبان على بريدٍ واحد — لا كيف جاء
     الثاني. ولو جاء هنا من `submitPhase1` لَصار نقضُ **فكِّ الطلب عن
     الحساب** يُسقط هذه التهيئةَ فتُقرأ الحزمةُ «تعطّل إعداد»، ويختفي
     الحارسُ الذي يجب أن يسقط باسمه. فالفكُّ يُفحص في متنه وحدَه أدناه. */
  const row = await prisma.trainerApplication.create({
    data: {
      reference: `WJ-TR-2026-${S}-2ND`,
      fullName: 'سلمى العمري', email: EMAIL, status: 'submitted',
      phase2CompletedAt: new Date(), emailVerifiedAt: new Date(),
    },
    select: { id: true, reference: true },
  })
  second = row
}, 240_000)

describe('عمرُ الطلب كما يردّه الخادم', () => {
  it('يُقاس من آخر حركةٍ في الطلب لا من إنشائه', async () => {
    const moved = await prisma.trainerStatusHistory.findFirstOrThrow({
      where: { applicationId: first.id }, orderBy: { createdAt: 'desc' },
    })
    const row = (await review.listApplications()).find((a) => a.id === first.id)
    expect(row, 'الطلبُ غائبٌ عن الطابور').toBeTruthy()
    expect(row!.waitingSince).toEqual(moved.createdAt)
    /* والفرقُ ليس نظريّا: الردُّ وقع بعد الإنشاء، فلو قيس من الإنشاء لاختلفا */
    expect(row!.waitingSince).not.toEqual(row!.createdAt)
  })

  it('ولا يُردّ فارغا — فالشارةُ تختفي بلا سبب', async () => {
    for (const row of await review.listApplications()) {
      expect(row.waitingSince, row.reference).toBeTruthy()
    }
  })
})

describe('البابُ الذي فُتح في النصّ يُفتح في القاعدة', () => {
  /* ═══ ولمَ متقدّمٌ خاصٌّ بهذا الوصف ═══

     الفحصُ يقع كلُّه في متنه — تقديمٌ، فردٌّ، فتقديمٌ ثانٍ — لا في `beforeAll`.
     ولو استُعمل متقدّمُ الأعلى لَكان نقضُ الفكّ يُسقط التهيئةَ كلَّها، فتُقرأ
     الحزمةُ «تعطّل إعداد» لا «سقط حارسٌ باسمه». والحارسُ يجب أن يسقط بجملته. */
  it('من رُدّ يتقدّم من جديدٍ — والطلبُ المنتهي يُفكّ عن حسابه ولا يُمحى', async () => {
    const email = `again-${S}@test.local`
    const one = await apps.submitPhase1({ ...base, email, fullName: 'ريم العائدة' })
    const oneRow = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: one.reference } })
    await prisma.trainerApplication.update({
      where: { id: oneRow.id }, data: { status: 'rejected', emailVerifiedAt: new Date() },
    })

    /* `userId` فريدٌ في الجدول، فكان هذا النداءُ يسقط على قيد التفرّد:
       خطأُ قاعدةٍ خامٌّ في وجه من دعوناه بأنفسنا يومَ حذفنا مدّةَ الانتظار. */
    const two = await apps.submitPhase1({ ...base, email, fullName: 'ريم العائدة' })
    expect(two.reference).not.toBe(one.reference)

    const old = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: oneRow.id } })
    expect(old.userId, 'بقي الطلبُ المنتهي ممسكا بالحساب').toBeNull()
    /* ولم يضع منه شيء: رقمُه وبريدُه وحالتُه كما كانت */
    expect(old.reference).toBe(one.reference)
    expect(old.email).toBe(email)
    expect(old.status).toBe('rejected')

    const fresh = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: two.reference } })
    expect(fresh.userId, 'الطلبُ الجديد بلا حساب').toBe(two.userId)

    /* وأثرُ الفكّ مكتوبٌ باسم صاحبه — فلا ينتقل ربطٌ في الخفاء */
    const trail = await prisma.auditEvent.findMany({
      where: { action: 'trainer.application.reapply', entityId: oneRow.id },
    })
    expect(trail).toHaveLength(1)
  })

  it('وطلبٌ حيٌّ لا يُفكّ عن حسابه — ولو تبدّل بريدُ صاحبه', async () => {
    /* ═══ الطريقُ إلى هذا الحارس ═══

       حارسُ التكرار فوقُ يسأل بالبريد، وهذا يسأل بالحساب. ولا يفترقان إلّا
       حين يتبدّل بريدُ الحساب بعد التقديم: فيمرّ الطلبُ الجديد من حارس
       البريد (لا طلبَ بهذا العنوان)، ويصل إلى الحساب وله طلبٌ حيّ. ولولا
       الشرطُ لفُكّ طلبٌ قائمٌ عن صاحبه في صمت، ولَبقي في الطابور بلا حساب
       يتابعه — ولا يعرف هو أين ذهب. */
    const firstEmail = `moved-${S}@test.local`
    const started = await apps.submitPhase1({ ...base, email: firstEmail, fullName: 'هدى المنتقلة' })
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: started.reference } })
    await prisma.trainerApplication.update({ where: { id: row.id }, data: { status: 'under_review' } })

    const movedEmail = `moved-new-${S}@test.local`
    await prisma.user.update({ where: { id: started.userId }, data: { email: movedEmail } })

    await expect(apps.submitPhase1({ ...base, email: movedEmail, fullName: 'هدى المنتقلة' }))
      .rejects.toMatchObject({ code: 'duplicate_application' })

    const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.userId, 'فُكّ طلبٌ حيٌّ عن حسابه').toBe(started.userId)
  })
})

describe('تاريخُ من تقدّم سابقا', () => {
  it('الطلبُ الثاني يحمل رقمَ الأوّل ومآلَه وسببَه كما كُتب', async () => {
    const detail = await review.getApplication(second.id)
    expect(detail.priorApplications).toHaveLength(1)
    const [prior] = detail.priorApplications
    expect(prior.reference).toBe(first.reference)
    expect(prior.status).toBe('rejected')
    expect(prior.noteAr, 'السببُ الداخليُّ لا يصل من يقرّر').toBe(REJECT_NOTE)
    expect(prior.decidedAt).toBeTruthy()
  })

  it('والطلبُ الأوّلُ لا يرى ما بعده — الماضي وحدَه يُعرض', async () => {
    /* لو جُمعت كلُّ طلبات البريد بلا تمييزٍ لَظهر الثاني في صفحة الأوّل
       «تقدّم سابقا»، وهو تقدّم بعده. */
    const detail = await review.getApplication(first.id)
    const refs = detail.priorApplications.map((p) => p.reference)
    expect(refs).not.toContain(first.reference)
    for (const p of detail.priorApplications) {
      expect(new Date(p.createdAt).getTime()).toBeLessThanOrEqual(detail.createdAt.getTime())
    }
  })

  it('ومن لا تاريخَ له تُردّ قائمةٌ فارغةٌ لا غياب', async () => {
    const fresh = await apps.submitPhase1({ ...base, email: `fresh-${S}@test.local`, fullName: 'ريم الجديدة' })
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: fresh.reference } })
    const detail = await review.getApplication(row.id)
    expect(detail.priorApplications).toEqual([])
  })
})
