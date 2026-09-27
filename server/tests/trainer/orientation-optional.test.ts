/* جلسةُ التهيئة وعدٌ لا شرطٌ عند التركيب — بقاعدةٍ حقيقيّة.
 *
 * ── وكان هذا الملفُّ يقيس نقيضَه ──
 *
 * سُئل صاحبُ المنصّة (٢٦ سبتمبر ٢٠٢٦): أتُجعل جلسةُ التهيئة إلزاميّةً؟ فقال
 * «نعم». وعلّةُ ذلك أنّ المهلةَ كانت تُحسَب منها، وبلا مهلةٍ لا طورَ موادٍّ:
 * `openConditionContract` تشترط `conditionDeadlineAt` غيرَ فارغ، فلا يستطيع
 * المدرّبُ أن يُعلن اكتمالَ موادّه — ولا حارسُ الموادّ يعترض اعتمادَه.
 *
 * ── ثمّ نُسخ المبدأُ فسقط الشرطُ معه (٢٧ سبتمبر ٢٠٢٦) ──
 *
 * «معه ٥ أيّام من بعد التوقيع لإتمام الموادّ… وأبلغهم أنّ هناك ستكون جلسةُ
 * توتوريال **تُحدَّد بعد التوقيع**». فصار أصلُ المهلة التوقيعَ، وصارت الجلسةُ
 * موعدا يُبلَّغ به بعده.
 *
 * فالشرطُ لم يُنقَض حكمُه اعتباطا: سقطت علّتُه. لم يكن حكما قائما بنفسه، بل
 * يحرس أنّ للمهلة أصلا — وأصلُها اليومَ فعلُ المدرّب نفسِه، يقع ويُكتب في
 * الصفّ لحظتَه فلا يحتاج إلى وعدٍ من أحد.
 *
 * **والضمانُ الذي اشتراه الشرطُ باقٍ بتمامه**: لا يُعتمَد عرضٌ مشروطٌ إلّا
 * بعد أن يُعلن صاحبُه اكتمالَ موادّه — بل صار أقوى: كان يُفلت من لا مهلةَ
 * له (حارسُ الموادّ يُجيز `none` عمدا)، وصار لكلّ موقَّعٍ مهلةٌ فلا مُفلِت.
 *
 * ── وأدقُّ ما يُقاس: أنّ الطورَ على المشروط وحدَه ──
 *
 * العقدُ العاديُّ لا طورَ له ولا مهلة. فلو عمّ لَحُبس كلُّ مدرّبٍ اعتُمدت
 * موادُّه من قبل — وهو أكثرُ ما يُركَّب بعد أوّل موسم.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { DEFAULT_REQUIRED_DOCUMENTS } from '../../../src/application/trainer/contract-documents'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''
const COURSE = 'C-ORIENT-101'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('orient-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({
    data: { courseId: COURSE, version: 1, titleAr: 'أساسيّاتُ المحاسبة', totalHours: 10 },
  })
}, 240_000)

let seq = 0

/** مرشّحٌ في «قبولٍ داخليّ» بأتعابٍ ودورةٍ مؤهَّلٍ لها — جاهزٌ لتركيب عقده */
async function readyToCompose(opts: { materialsApprovedBefore: boolean }) {
  seq += 1
  const email = `orient-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مرشّحٌ ${seq}`)
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-ORI-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: 'conditionally_approved', motivation: 'اختبار',
      privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: app.id, isVerified: true },
  })
  await prisma.trainerCourseQualification.create({
    data: { profileId: profile.id, courseId: COURSE, status: 'qualified' },
  })
  await prisma.trainerCompensationRule.create({
    data: { profileId: profile.id, type: 'per_seat', rate: 25, currency: 'USD', minSeats: 0 },
  })
  if (opts.materialsApprovedBefore) {
    /* عقدٌ سابقٌ اكتمل شرطُه — فالعقدُ التالي غيرُ مشروطٍ (`offerGatesActivation`) */
    await prisma.trainerContract.create({
      data: {
        profileId: profile.id, title: 'عقدٌ سابقٌ نافذ', status: 'countersigned',
        gatesActivation: true, signedAt: new Date(), countersignedAt: new Date(),
        conditionMetAt: new Date(),
      },
    })
  }
  return { applicationId: app.id, profileId: profile.id }
}

const compose = (applicationId: string, orientationAt?: string) =>
  review.composeContract(applicationId, adminId, {
    title: 'عقدُ اختبارِ الجلسة',
    courseIds: [COURSE],
    requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
    ...(orientationAt ? { orientationAt } : {}),
  })

describe('العرضُ المشروط يُركَّب بجلسةٍ وبلا جلسة', () => {
  it('بلا جلسةٍ: يُركَّب — ولا يُخترَع له موعد', async () => {
    const t = await readyToCompose({ materialsApprovedBefore: false })
    await compose(t.applicationId)
    const c = await prisma.trainerContract.findFirstOrThrow({ where: { profileId: t.profileId } })
    expect(c.gatesActivation, 'رُكّب غيرَ مشروطٍ فسقط الفحصُ كلُّه').toBe(true)
    expect(c.orientationAt, 'اختُرعت جلسةٌ لم تُعطَ').toBeNull()
  })

  it('وبها: تُحفَظ — فمن عُرف موعدُها طُبع في متنه', async () => {
    const t = await readyToCompose({ materialsApprovedBefore: false })
    const at = new Date(Date.now() + 3 * 86_400_000)
    await compose(t.applicationId, at.toISOString())
    const c = await prisma.trainerContract.findFirstOrThrow({ where: { profileId: t.profileId } })
    expect(c.orientationAt, 'لم تُحفظ الجلسة').not.toBeNull()
  })

  /* ═══ ولا ساعةَ تجري قبل أن يلتزم ═══

     وهو الضمانُ الذي حُفظ عبر التبديل: كان «لا ساعةَ بلا جلسةٍ يُعلَم بها»،
     فصار «لا ساعةَ قبل أن يوقّع». ويُقاس في الحالَين معا — فلو كُتبت المهلةُ
     عند التركيب لَجرت على من لم يقرأ العرضَ بعد. */
  it('ولا مهلةَ تُكتب عند التركيب — بجلسةٍ كان أو بلا', async () => {
    for (const withSession of [true, false]) {
      const t = await readyToCompose({ materialsApprovedBefore: false })
      await compose(t.applicationId,
        withSession ? new Date(Date.now() + 3 * 86_400_000).toISOString() : undefined)
      const c = await prisma.trainerContract.findFirstOrThrow({ where: { profileId: t.profileId } })
      expect(c.conditionDeadlineAt, `جرت ساعةٌ على عرضٍ لم يُوقَّع (بجلسة: ${withSession})`).toBeNull()
    }
  })
})

describe('والشرطُ على المشروط وحدَه', () => {
  it('عقدٌ غيرُ مشروطٍ يُركَّب بلا جلسة — ولا يُحبَس من اعتُمدت موادُّه من قبل', async () => {
    const t = await readyToCompose({ materialsApprovedBefore: true })
    await prisma.trainerContract.updateMany({
      where: { profileId: t.profileId }, data: { status: 'terminated' },
    })
    await compose(t.applicationId)
    const c = await prisma.trainerContract.findFirstOrThrow({
      where: { profileId: t.profileId, status: { not: 'terminated' } },
    })
    expect(c.gatesActivation, 'عُدَّ مشروطا ومَوادُّه اعتُمدت من قبل').toBe(false)
    expect(c.conditionDeadlineAt, 'كُتبت مهلةٌ لعقدٍ لا طورَ له').toBeNull()
  })
})

describe('وقائمةُ الطابور تقول من لم تخرج إليه دعوةُ حجز', () => {
  it('`null` لمن لم يُدعَ، وتاريخٌ لمن دُعي', async () => {
    seq += 1
    const email = `inv-${seq}-${Date.now()}@test.local`
    const app = await prisma.trainerApplication.create({
      data: {
        reference: `TR-INV-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
        status: 'under_review', motivation: 'اختبار', privacyConsentAt: new Date(),
      },
    })
    const before = (await review.listApplications()).find((r) => r.id === app.id)
    expect(before, 'لم يُعثر على الصفّ').toBeTruthy()
    expect(before!.interviewInvitedAt, 'قيل إنّه دُعي ولم يُدعَ').toBeNull()

    await prisma.auditEvent.create({
      data: {
        actorId: adminId, action: 'trainer.interview.remind',
        entityType: 'trainer_application', entityId: app.id, meta: {},
      },
    })
    const after = (await review.listApplications()).find((r) => r.id === app.id)
    expect(after!.interviewInvitedAt, 'خرجت الدعوةُ ولا يعرف الطابور').not.toBeNull()
  })
})
