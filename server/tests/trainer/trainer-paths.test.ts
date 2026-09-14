/* مسارُ المدرّب على قاعدةٍ حقيقيّة (ن-١ · ن-٢ · ن-٤).

   حرّاسُ `src/tests` يقرؤون الشكلَ ويحكمون عليه. وهذا يُشغّله: يُعتمد مدرّبٌ
   فعلا، ويُبنى مسارٌ فعلا، ويُردّ ما يجب ردُّه برقم حالته، ويختفي من الرفّ من
   يُوقَف — **ويبقى صفُّه كما هو**، وهو بيتُ القصيد في ن-٤. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerPathService } from '../../services/trainer-path.service'

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService
let review: TrainerReviewService
let paths: TrainerPathService
let adminId: string
let termId: string

const base = {
  phoneCountryCode: '+962', phone: '771050000', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدرّب أتمتة', specialties: ['الأتمتة'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرةٌ ميدانيّة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'درّبتُ فرقا حقيقيّةً في بيئات عملٍ عربيّة، وأعرف الفرقَ بين من يعرف المادّة ومن يستطيع تعليمها. سأعطي كلَّ متعلّمٍ مهمّةً من واقع عمله في كلّ وحدة، وأراجع مخرجاته بنفسي وأكتب له ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
}

async function course(id: string, titleAr: string) {
  const c = await prisma.course.create({ data: { id, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({ data: { courseId: c.id, version: 1, titleAr, totalHours: 10 } })
  return c.id
}

/** مدرّبٌ معتمَدٌ مؤهَّلٌ لدورتَين — ويُعتمد ظهورُه اختياريّا */
async function trainer(email: string, fullName: string, courseIds: string[], publicOk: boolean) {
  const res = await apps.submitPhase1({ ...base, email, fullName })
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' },
  })
  await prisma.trainerApplication.update({ where: { id: row.id }, data: { emailVerifiedAt: new Date() } })
  await review.decide(row.id, adminId, 'approve', 'اعتماد للاختبار')
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: row.id } })

  for (const courseId of courseIds) {
    await prisma.trainerCourseQualification.create({ data: { profileId: profile.id, courseId } })
  }
  await prisma.trainerProfile.update({
    where: { id: profile.id },
    data: publicOk
      ? { publicVisibility: true, isVerified: true, publishApprovedAt: new Date(), publishApprovedBy: adminId }
      : {},
  })
  return { profileId: profile.id, userId: res.userId as string }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  paths = new TrainerPathService(prisma)
  const admin = await auth.register('admin-paths@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])

  await course('C-PATH-1', 'دورةُ الأتمتة الأولى')
  await course('C-PATH-2', 'دورةُ الأتمتة الثانية')
  await course('C-PATH-3', 'دورةٌ لم يُؤهَّل لها')

  /* و`upsert` لا `create`: قاعدةُ الاختبار مبذورةٌ وقد تحمل الموسمَ نفسَه،
     و`@@unique([year, season])` يردّ الثاني. وفحصٌ يسقط على بذرةٍ سابقةٍ
     يُخفي ما جاء يقيسه. */
  const term = await prisma.term.upsert({
    where: { year_season: { year: 2087, season: 'nov_jan' } },
    update: {},
    create: {
      year: 2087, season: 'nov_jan', titleAr: 'موسمُ اختبار',
      startsOn: new Date('2087-11-01'), endsOn: new Date('2088-01-31'),
      registrationOpensAt: new Date('2087-10-01'), status: 'planned',
    },
  })
  termId = term.id
}, 180_000)

describe('ن · مسارُ المدرّب على قاعدةٍ حقيقيّة', () => {
  it('يُبنى ويُرسَل ويُنشر — فيظهر على الرفّ باسم صاحبه', async () => {
    const t = await trainer('path-ok@test.local', 'سامي المدرّب', ['C-PATH-1', 'C-PATH-2'], true)
    const p = await paths.create(t.userId, {
      titleAr: 'من الفكرة إلى أوّل عمليّة مؤتمتة',
      blurbAr: 'لمن يبدأ', termId, courseIds: ['C-PATH-1', 'C-PATH-2'],
    })
    await paths.submit(t.userId, p.id)
    await paths.approve(adminId, p.id)

    const shelf = await paths.shelf()
    const mine = shelf.find((x) => x.id === p.id)
    expect(mine, 'لم يظهر المسارُ على الرفّ').toBeTruthy()
    expect(mine!.trainerName).toBe('سامي المدرّب')
    expect(mine!.slug, 'نُشر بلا عنوانٍ عامّ').toBeTruthy()
    /* ن-٣: الموسمُ صفٌّ لا نصّ — والبطاقةُ تقرأ منه نافذةَ التسجيل */
    expect(mine!.term?.registrationOpensAt).toBeTruthy()
    expect(mine!.courses.map((c) => c.titleAr)).toEqual(['دورةُ الأتمتة الأولى', 'دورةُ الأتمتة الثانية'])
  })

  it('ن-٢ · ولا يُنشر لمن لم يُعتمد ظهورُه — ويُردّ بـ٤٠٩ لا يمرّ صامتا', async () => {
    const t = await trainer('path-hidden@test.local', 'ريم المدرّبة', ['C-PATH-1', 'C-PATH-2'], false)
    const p = await paths.create(t.userId, {
      titleAr: 'مسارٌ لمن لم يُعتمد ظهورُه', termId, courseIds: ['C-PATH-1', 'C-PATH-2'],
    })
    /* ويُمنع الإرسالُ أصلا — فلا يصل الإدارةَ ما لا يُنشر */
    await expect(paths.submit(t.userId, p.id)).rejects.toMatchObject({ status: 400 })

    /* ولو بلغ الاعتمادَ بطريقٍ آخرَ لرُدّ هناك أيضا — حارسان لا واحد */
    await prisma.trainerPath.update({ where: { id: p.id }, data: { status: 'submitted' } })
    await expect(paths.approve(adminId, p.id)).rejects.toMatchObject({ status: 409 })

    const still = await prisma.trainerPath.findUniqueOrThrow({ where: { id: p.id } })
    expect(still.status, 'نُشر رغم أنّ ظهورَه لم يُعتمد').not.toBe('published')
    expect((await paths.shelf()).some((x) => x.id === p.id)).toBe(false)
  })

  it('ن-١ · ولا يُبنى إلّا من دوراته — دورةٌ لم يُؤهَّل لها تمنع الإرسال', async () => {
    const t = await trainer('path-stray@test.local', 'خالد المدرّب', ['C-PATH-1', 'C-PATH-2'], true)
    const p = await paths.create(t.userId, {
      titleAr: 'مسارٌ فيه دورةٌ ليست له', termId, courseIds: ['C-PATH-1', 'C-PATH-3'],
    })
    await expect(paths.submit(t.userId, p.id)).rejects.toMatchObject({ status: 400 })
  })

  /* ═══ وهذا بيتُ القصيد في ن-٤ ═══ */
  it('ن-٤ · والإيقافُ يُخرجه من الرفّ ولا يمسّ صفَّه ولا موسمَه', async () => {
    const t = await trainer('path-susp@test.local', 'فادي المدرّب', ['C-PATH-1', 'C-PATH-2'], true)
    const p = await paths.create(t.userId, {
      titleAr: 'مسارٌ سيُوقَف صاحبُه', termId, courseIds: ['C-PATH-1', 'C-PATH-2'],
    })
    await paths.submit(t.userId, p.id)
    await paths.approve(adminId, p.id)
    expect((await paths.shelf()).some((x) => x.id === p.id), 'لم يصل الرفَّ أصلا').toBe(true)

    await prisma.trainerProfile.update({ where: { id: t.profileId }, data: { suspendedAt: new Date() } })

    /* الرفُّ آليٌّ — يختفي في اللحظة بلا وظيفةٍ تمرّ */
    expect((await paths.shelf()).some((x) => x.id === p.id), 'بقي الموقوفُ على الرفّ').toBe(false)

    /* والعقدُ ليس — الصفُّ كما هو: منشورٌ بموسمه، لا مُلغى ولا مسحوب */
    const row = await prisma.trainerPath.findUniqueOrThrow({ where: { id: p.id } })
    expect(row.status, 'الإيقافُ ألغى المسارَ — والسحبُ قرارُ إنسان').toBe('published')
    expect(row.termId, 'الإيقافُ شطب الموسمَ المعلَن').toBe(termId)
    expect(row.retiredAt, 'الإيقافُ سحبه آليّا').toBeNull()

    /* ويعود برفع الإيقاف — فلا شيءَ فُقد */
    await prisma.trainerProfile.update({ where: { id: t.profileId }, data: { suspendedAt: null } })
    expect((await paths.shelf()).some((x) => x.id === p.id)).toBe(true)
  })

  /* ن-٣: ورأيتُه في الرفّ المصيَّر — البطاقةُ قالت «يبدأ ١ فبراير ٢٠٢٦» عن
     موسمٍ انقضى، لأنّ المنتقيَ كان يعرض المواسمَ كلَّها. وإعلانُ مسارٍ لموسمٍ
     انتهى فخٌّ لصاحبه قبل أن يكون خطأً في الشاشة. */
  it('ن-٣ · ولا يُعرض للإعلان موسمٌ انقضى', async () => {
    const past = await prisma.term.upsert({
      where: { year_season: { year: 2019, season: 'feb_apr' } },
      update: {},
      create: {
        year: 2019, season: 'feb_apr', titleAr: 'موسمٌ مضى',
        startsOn: new Date('2019-02-01'), endsOn: new Date('2019-04-30'), status: 'closed',
      },
    })
    const offered = await paths.upcomingTerms()
    expect(offered.some((t) => t.id === past.id), 'عُرض موسمٌ انتهى').toBe(false)
    expect(offered.some((t) => t.id === termId), 'سقط الموسمُ القادمُ أيضا').toBe(true)
    /* ولا واحدٌ منها منتهٍ — لا هذا وحدَه */
    for (const t of offered) {
      const row = await prisma.term.findUniqueOrThrow({ where: { id: t.id } })
      expect(row.endsOn.getTime(), `موسمٌ منتهٍ معروض: ${t.titleAr}`).toBeGreaterThanOrEqual(Date.now() - 86_400_000)
    }
  })

  it('وما خرج من يده لا يعدّله — والمردودُ يعود مسوّدةً بالتعديل', async () => {
    const t = await trainer('path-lock@test.local', 'ليلى المدرّبة', ['C-PATH-1', 'C-PATH-2'], true)
    const p = await paths.create(t.userId, {
      titleAr: 'مسارٌ سيُردّ', termId, courseIds: ['C-PATH-1', 'C-PATH-2'],
    })
    await paths.submit(t.userId, p.id)
    await expect(paths.update(t.userId, p.id, { titleAr: 'محاولة', courseIds: ['C-PATH-1'] }))
      .rejects.toMatchObject({ status: 409 })

    await paths.reject(adminId, p.id, 'الاسمُ يَعِد بما لا تغطّيه دوراتُه')
    const after = await paths.mine(t.userId)
    expect(after[0].reviewNoteAr, 'رُدّ ولا يعرف صاحبُه لماذا').toContain('الاسمُ')

    await paths.update(t.userId, p.id, {
      titleAr: 'اسمٌ مصحَّحٌ ودقيق', termId, courseIds: ['C-PATH-1', 'C-PATH-2'],
    })
    const back = await prisma.trainerPath.findUniqueOrThrow({ where: { id: p.id } })
    expect(back.status, 'بقي «مردودا» وقد أُصلح').toBe('draft')
  })

  it('والسحبُ من الرفّ يُخرجه ولا يلغي شيئا', async () => {
    const t = await trainer('path-retire@test.local', 'نور المدرّبة', ['C-PATH-1', 'C-PATH-2'], true)
    const p = await paths.create(t.userId, {
      titleAr: 'مسارٌ سيُسحب', termId, courseIds: ['C-PATH-1', 'C-PATH-2'],
    })
    await paths.submit(t.userId, p.id)
    await paths.approve(adminId, p.id)
    await paths.retire(adminId, p.id, 'انتهى تعاقدُنا معه')

    expect((await paths.shelf()).some((x) => x.id === p.id)).toBe(false)
    const row = await prisma.trainerPath.findUniqueOrThrow({ where: { id: p.id } })
    expect(row.status).toBe('retired')
    expect(row.termId, 'السحبُ شطب الموسمَ').toBe(termId)
  })
})
