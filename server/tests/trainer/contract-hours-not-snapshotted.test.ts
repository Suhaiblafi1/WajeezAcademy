/* ساعاتُ الكتالوج لا تدخل لقطةَ العقد — بقاعدةٍ حقيقيّة.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * قرارُ صاحب المنصّة (٢٩ سبتمبر ٢٠٢٦): «لا داعي لذكر عدد الساعات لكل دورة من
 * الكاتلوج لانه هو من سيحددها بالاتفاق معنا».
 *
 * وحارسُ `src/tests/trainer/contract-hours-agreed-later.test.ts` يقيس أنّ
 * **المصيِّرَ** يطبع العنوانَ وحدَه إذا أُعطي لقطةً بلا ساعات. ولا يُثبت أنّ
 * اللقطةَ تُكتب بلا ساعات — والمصيِّرُ يطبع ما يجده: فلو بقي `chosenCourses`
 * ينسخ `totalHours` من الكتالوج لَخرج الرقمُ في الوثيقة والحارسُ الأوّلُ
 * أخضر. فالنصفُ الثاني هنا، وعلى قاعدةٍ حقيقيّةٍ لا على كائنٍ مصطنع.
 *
 * ── ودورةُ السقالة لها ساعاتٌ بقصد ──
 *
 * `totalHours: 10` في الكتالوج. فلو كُتب صفرٌ أو `null` لَخضرّ الفحصُ لأنّ
 * المصدرَ فارغٌ لا لأنّ النسخَ توقّف — وهو خضرةٌ لسببٍ خاطئ.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { EarningsService } from '../../services/earnings.service'
import { readContractCourses } from '../../../src/application/trainer/contract-body'
import { MIN_LIVE_HOURS_GUIDE } from '../../../src/application/catalog/course-hours'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''

const COURSE = 'C-HRS-101'
const TITLE = 'أساسيّاتُ المحاسبة'
/** ساعاتٌ في الكتالوج — لولاها خضرّ الفحصُ على مصدرٍ فارغ */
const CATALOG_HOURS = 10

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('hrs-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({
    data: {
      courseId: COURSE, version: 1, titleAr: TITLE,
      totalHours: CATALOG_HOURS, recordedHours: 4,
    },
  })
}, 240_000)

let seq = 0

async function candidate() {
  seq += 1
  const email = `hrs-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مرشّحٌ ${seq}`)
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-HRS-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
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
  return { application, profile }
}

const COMPOSE = {
  title: 'اتفاقية تقديم خدمات تدريبية',
  requiredDocuments: [{ kind: 'national_id', labelAr: 'الهويّة', required: true }],
  orientationAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
}

describe('لقطةُ الملحق (أ) تُكتب بلا ساعات', () => {
  it('والكتالوجُ يحملها فعلا — فلا يخضرّ الفحصُ على مصدرٍ فارغ', async () => {
    const v = await prisma.courseVersion.findFirstOrThrow({ where: { courseId: COURSE } })
    expect(v.totalHours, 'دورةُ السقالة بلا ساعاتٍ — فما تحته لا يقيس شيئا').toBe(CATALOG_HOURS)
  })

  it('⚠️ اللقطةُ المحفوظةُ بلا `totalHours` ولا `recordedHours`', async () => {
    const { application, profile } = await candidate()
    await review.composeContract(application.id, adminId, COMPOSE)

    const saved = await prisma.trainerContract.findFirstOrThrow({ where: { profileId: profile.id } })
    const rows = (saved.qualifiedSnapshot ?? []) as unknown as Record<string, unknown>[]
    expect(Array.isArray(rows) && rows.length, 'لا لقطةَ محفوظة').toBeTruthy()

    for (const r of rows) {
      expect(r.courseId, 'صفٌّ بلا معرِّف').toBeTruthy()
      expect(r.titleAr, 'صفٌّ بلا عنوان').toBeTruthy()
      expect(r, `ساعاتُ الكتالوج نُسخت في لقطةِ «${String(r.titleAr)}»`)
        .not.toHaveProperty('totalHours')
      expect(r).not.toHaveProperty('recordedHours')
    }
    /* وما تقرؤه الوحدةُ من اللقطة: لا رقمَ يصل المصيِّر */
    for (const c of readContractCourses(saved.qualifiedSnapshot)) {
      expect(c.totalHours, 'وصل الرقمُ إلى المصيِّر').toBeNull()
    }
  })

  it('⚠️ والمتنُ المجمَّدُ لا يطبع رقما أمام الدورة، ويقول من يحدّدها', async () => {
    const { application, profile } = await candidate()
    await review.composeContract(application.id, adminId, COMPOSE)
    const saved = await prisma.trainerContract.findFirstOrThrow({ where: { profileId: profile.id } })
    const body = saved.bodyAr ?? ''

    const line = body.split('\n').find((l) => /^\d+\.\s/.test(l.trim()) && l.includes(TITLE))
    expect(line, 'سقط سطرُ الدورة من الملحق').toBeTruthy()
    expect(line, `طُبع رقمُ ساعاتٍ: «${line}»`).not.toMatch(/ساعة|ساعات|مباشرة|مسجَّلة/)
    expect(line!.trim(), 'السطرُ ليس عنوانا وحدَه').toBe(`1. ${TITLE}`)

    expect(body).toContain('ولا يبين هذا الملحق عدد ساعات كل دورة')
    expect(body).toContain(`لا يقل عن ${MIN_LIVE_HOURS_GUIDE} ساعة مباشرة`)
  })

  /* والمعاينةُ هي ما يراه الموظّفُ قبل الإرسال. فلو طبعت رقما ثمّ لم يطبعه
     المجمَّدُ لَأرسل وهو يظنّ أنّه أرسل غيرَ ما أرسل — ومصدرُهما واحدٌ
     (`chosenCourses`)، فالفحصُ يُثبت أنّه بقي واحدا. */
  it('والمعاينةُ تطابق المجمَّدَ — فما يراه الموظّفُ هو ما يُوقَّع', async () => {
    const { application, profile } = await candidate()
    /* و`previewContract` تردّ المتنَ نصّا لا كائنا — فلا `.bodyAr` لها */
    const preview = await review.previewContract(application.id, COMPOSE)
    await review.composeContract(application.id, adminId, COMPOSE)
    const saved = await prisma.trainerContract.findFirstOrThrow({ where: { profileId: profile.id } })

    const annexOf = (b: string) =>
      b.split('\n').filter((l) => /^\d+\.\s/.test(l.trim()) && l.includes(TITLE)).join('\n')
    expect(annexOf(preview), 'لم يُقرأ سطرُ الدورة من المعاينة — فالمقابلةُ على فراغ')
      .toBe(`1. ${TITLE}`)
    expect(annexOf(preview), 'المعاينةُ تفترق عن المجمَّد')
      .toBe(annexOf(saved.bodyAr ?? ''))
  })
})
