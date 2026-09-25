/* ملحقُ الدورات المعتمدة — بقاعدةٍ حقيقيّة.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * البندُ 2-11 من المتن الموقَّع يَعِد: «ويعاد إلى المدرب مع ملحق يبين الدورات
 * المعتمدة له». وحارسُ `src/tests` يقيس أنّ المكوّنَ يعرض ما يُعطى، وأنّ الوعدَ
 * في المتن. **ولا يُثبت أنّ الخَتمَ يكتب اللقطة** — ومن لا لقطةَ له لا ملحقَ
 * له، فيبقى الوعدُ بلا وفاء.
 *
 * ── وأدقُّ ما يُقاس: أنّها لقطةٌ لا استعلامٌ حيّ ──
 *
 * التأهيلُ يزيد بعد الخَتم. فلو قُرئت الدوراتُ من `TrainerCourseQualification`
 * وقتَ العرض لَوجد المدرّبُ في ملحقه بعد شهرَين دوراتٍ لم تكن معتمدةً يومَ
 * خُتم عقدُه — وملحقٌ يتبدّل بعد توقيعه ليس ملحقا. فيُؤهَّل لدورةٍ **بعد**
 * الخَتم، ويُقاس أنّ اللقطةَ لم تتحرّك.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeReadyForApproval } from '../helpers/trainer-ready'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { contractAcks, CONDITION_CLAUSE_MARK } from '../../../src/application/trainer/contract-body'
import { readApprovedCourses } from '../../../src/application/trainer/contract-execution'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let app: FastifyInstance
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = `نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.

${CONDITION_CLAUSE_MARK} لا عقد نهائي. ونفاذه معلق على قبول الأكاديمية لمواد المدرب.`
const ACKS = contractAcks(true).map((a) => a.key)

const COURSE_A = 'C-ANX-101'
const COURSE_B = 'C-ANX-202'
/** دورةٌ يُؤهَّل لها **بعد** الخَتم — بها يُقاس أنّ اللقطةَ لا تتحرّك */
const COURSE_LATER = 'C-ANX-303'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  app = await buildApp(prisma)
  const admin = await auth.register('anx-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  for (const [id, t] of [
    [COURSE_A, 'أساسيّاتُ المحاسبة'], [COURSE_B, 'إدارةُ المشاريع'], [COURSE_LATER, 'دورةٌ لاحقة'],
  ] as const) {
    await prisma.course.create({ data: { id, status: 'published', currentVersion: 1 } })
    await prisma.courseVersion.create({ data: { courseId: id, version: 1, titleAr: t, totalHours: 10 } })
  }
}, 240_000)

let seq = 0

/** مرشّحٌ مشروطٌ وقّع عرضَه، ثمّ يُعتمَد فيُختَم — المسارُ الحقيقيُّ بتمامه.

    ═══ والترتيبُ مقصود: يُوقَّع العرضُ **قبل** `makeReadyForApproval` ═══

    السقالةُ تكتب عقدا `signed` بلا `signedAt` إن لم تجد موقَّعا (خطوتُها ④).
    فلو نُوديت قبل توقيعنا لَزاد صفٌّ ثانٍ مرشَّحٌ للخَتم، ولخُتم أحدُهما بلا
    أن يُقصَد — وهو ما وقع فعلا في أوّل جولةٍ لهذا الملفّ. وهو ترتيبُ
    `offer-and-countersign.test.ts` نفسُه: يُبنى الموقَّعُ ثمّ تُهيَّأ البوّابة. */
async function sealedTrainer(
  qualified: string[] = [COURSE_A, COURSE_B],
  pending: string[] = [],
  beforeSeal?: (ctx: { profileId: string }) => Promise<void>,
) {
  seq += 1
  const email = `anx-${seq}-${Date.now()}@test.local`
  const pass = 'Trainer#12345'
  const user = await auth.register(email, pass, `مرشّحٌ ${seq}`)
  await auth.setRoles(user.userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-ANX-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(),
      userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: user.userId, isVerified: true },
  })
  const profileId = profile.id

  /* والمعتمَدُ وحدَه يدخل الملحق. و`pending` تُكتب **قبل** الخَتم بقصد: هي ما
     اخترناه له ولم تُقيَّم موادُّه، فذكرُها في «وما اعتمدناه» اعتمادٌ لم يقع.
     ولو كُتبت بعده لكان الفحصُ خضرةً على لا شيء — فاللقطةُ أُخذت قبلها. */
  for (const courseId of qualified) {
    await prisma.trainerCourseQualification.create({
      data: { profileId, courseId, status: 'qualified' },
    })
  }
  for (const courseId of pending) {
    await prisma.trainerCourseQualification.create({
      data: { profileId, courseId, status: 'pending' },
    })
  }

  const contract = await prisma.trainerContract.create({
    data: {
      profileId, title: `عرضٌ مشروطٌ ${seq}`, status: 'draft',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: [], signerEmail: email, gatesActivation: true,
    },
  })
  const sent = await review.sendContract(contract.id, adminId)
  const token = decodeURIComponent(sent.signingUrl.split('/c/')[1])
  await review.signContractByToken(token, {
    legalName: `الاسمُ القانونيُّ ${seq}`, addressAr: 'عمّان — بناية ١٢',
    phone: '+962790000000', bodyHash: sha256(BODY), acks: [...ACKS],
  })

  /* وبعد التوقيع تُهيَّأ البوّابة: تجد موقَّعا فلا تبني سقالةً، وتجد مؤهَّلا
     فلا تزيد دورةً، وتكتب الاتّفاقَ الماليَّ الذي تفحصه البوّابة. */
  await makeReadyForApproval(prisma, application.id, adminId)

  if (beforeSeal) await beforeSeal({ profileId })

  /* والخَتمُ يقع في `decide('approve')` نفسِها — لا بيدٍ منفصلة */
  await review.decide(application.id, adminId, 'approve')
  const cookie = (await auth.login(email, pass)).token
  return { application, profileId, contract, cookie }
}

const mine = (cookie: string) => app.inject({
  method: 'GET', url: '/api/trainer/me/contract',
  cookies: { [SESSION_COOKIE]: cookie },
})

describe('الخَتمُ يكتب ملحقَ الدورات المعتمدة — فوعدُ 2-11 يُوفى', () => {
  it('اللقطةُ تُكتب في الصفّ عند الاعتماد، بأسماءٍ عربيّةٍ لا معرّفاتٍ وحدَها', async () => {
    const t = await sealedTrainer()
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contract.id } })
    expect(row.status, 'لم يُختَم العقدُ أصلا — فالقياسُ على غير موضعه').toBe('countersigned')
    const courses = readApprovedCourses(row.approvedCoursesSnapshot)
    expect(courses, 'لا لقطةَ في الصفّ — فلا ملحقَ يُبنى منها').toHaveLength(2)
    expect(courses.map((c) => c.titleAr).sort())
      .toEqual(['أساسيّاتُ المحاسبة', 'إدارةُ المشاريع'])
  })

  it('وتصل بوّابتَه فيقرأ ملحقَه', async () => {
    const t = await sealedTrainer()
    const res = await mine(t.cookie)
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('approvedCoursesSnapshot')
    expect(readApprovedCourses(body.approvedCoursesSnapshot)).toHaveLength(2)
    /* وتاريخُ تحقّق الشرط معه — وهو ما يُطبَع في الملحق */
    expect(body.conditionMetAt, 'لا تاريخَ لتحقّق الشرط').toBeTruthy()
  })

  /* ═══ وهي لقطةٌ لا استعلامٌ حيّ ═══
     التأهيلُ يزيد بعد الخَتم، وملحقٌ يتبدّل بعد توقيعه ليس ملحقا. */
  it('ولا تتحرّك بتأهيلٍ يُضاف بعد الخَتم', async () => {
    const t = await sealedTrainer()
    const before = readApprovedCourses(
      (await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contract.id } })).approvedCoursesSnapshot,
    )
    expect(before).toHaveLength(2)

    await prisma.trainerCourseQualification.upsert({
      where: { profileId_courseId: { profileId: t.profileId, courseId: COURSE_LATER } },
      update: { status: 'qualified' },
      create: { profileId: t.profileId, courseId: COURSE_LATER, status: 'qualified' },
    })

    const after = readApprovedCourses(
      (await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contract.id } })).approvedCoursesSnapshot,
    )
    expect(after, 'تحرّكت اللقطةُ بتأهيلٍ لاحق — فهي استعلامٌ حيٌّ لا ملحق').toEqual(before)
    expect(after.map((c) => c.titleAr), 'دخلت الملحقَ دورةٌ اعتُمدت بعد الخَتم')
      .not.toContain('دورةٌ لاحقة')
  })

  /* و`pending` ما اخترناه له ولم تُقيَّم موادُّه — فذكرُه اعتمادٌ لم يقع */
  it('وما لم يُعتمَد لا يدخل الملحق — و`pending` قائمةٌ قبل الخَتم', async () => {
    const t = await sealedTrainer([COURSE_A], [COURSE_B])
    /* والحالُ قائمٌ فعلا قبل الخَتم: بدونه يقيس الفحصُ غيابَ صفٍّ لا وجودَ له */
    const pendingRow = await prisma.trainerCourseQualification.findFirstOrThrow({
      where: { profileId: t.profileId, courseId: COURSE_B },
    })
    expect(pendingRow.status, 'الصفُّ لم يبقَ `pending` — فالقياسُ على غير موضعه').toBe('pending')

    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contract.id } })
    const titles = readApprovedCourses(row.approvedCoursesSnapshot).map((c) => c.titleAr)
    expect(titles).toContain('أساسيّاتُ المحاسبة')
    expect(titles, 'دخل الملحقَ ما لم تُقيَّم موادُّه').not.toContain('إدارةُ المشاريع')
  })
})

describe('واختيارُ العرض الذي يُختَم — والفراغُ لا يسبق الموقَّعَ حقّا', () => {
  /* ═══ العطبُ الذي يحرسه ═══

     PostgreSQL يرتّب `NULL` **أوّلا** في `DESC`. فصفٌّ حالُه `signed` وتاريخُ
     توقيعه فارغٌ يتقدّم على كلّ موقَّعٍ حقيقيّ — فيُختَم هو ويُكتب ملحقُه،
     ويبقى العرضُ الذي وقّعه المدرّبُ فعلا `signed` بلا خَتمٍ ولا ملحق.

     ومسالكُ الإنتاج اليومَ تكتب التاريخَ مع الحالة في تحديثٍ واحد، فلا صفَّ
     كهذا اليوم. لكنّ الترتيبَ كان يتعلّق بذلك ولا يقوله — وصفٌّ من البابِ
     القديم أو تصحيحٌ بيدٍ في القاعدة يكفي لنقضه. وقد انكشف بسقالةِ اختبارٍ
     تكتب `status: 'signed'` بلا تاريخ، فخُتم صفُّ السقالة وبقي العرضُ معلَّقا.

     فتُبنى الصورةُ بيدٍ هنا: صفٌّ مرشَّحٌ للخَتم بلا تاريخِ توقيع، ثمّ يُقاس
     **أيَّهما خُتم**. */
  it('يُختَم العرضُ الموقَّعُ فعلا لا الصفُّ الذي لا تاريخَ له', async () => {
    let strayId = ''
    const t = await sealedTrainer([COURSE_A, COURSE_B], [], async ({ profileId }) => {
      const stray = await prisma.trainerContract.create({
        data: {
          profileId, title: 'صفٌّ بلا تاريخِ توقيع', status: 'signed',
          gatesActivation: true, signedAt: null,
        },
      })
      strayId = stray.id
    })

    const real = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contract.id } })
    const stray = await prisma.trainerContract.findUniqueOrThrow({ where: { id: strayId } })

    expect(real.status, 'خُتم الصفُّ الفارغُ وبقي العرضُ الموقَّعُ معلَّقا').toBe('countersigned')
    expect(readApprovedCourses(real.approvedCoursesSnapshot), 'الملحقُ كُتب في غير موضعه')
      .toHaveLength(2)

    expect(stray.status, 'خُتم صفٌّ لا تاريخَ توقيعٍ له').toBe('signed')
    expect(stray.approvedCoursesSnapshot, 'كُتب ملحقٌ لصفٍّ لم يوقّعه أحد').toBeNull()
  })
})
