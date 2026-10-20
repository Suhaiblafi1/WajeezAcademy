/* بطاقةُ المدرّب في «المدربون» على قاعدةٍ حقيقيّة (١٩ أكتوبر ٢٠٢٦).

   «لماذا لا تظهر دوراتُها ومواعيدُها وما اعتُمد منها وما هو مسوّدة وما أُجّل؟ وكيف أعلم أنّه أرفق صورةً أو
   لا، أو عدّل الكلامَ أو لا؟» (صاحب المنصّة، عن مدرّبةٍ بطاقتُها تقول «لا إسناد نشط»).

   ① شعبٌ مربوطةٌ بـ`CohortTrainer` وحدَه — بلا صفّ إسنادٍ قديم — تظهر بحالها وأوّلِ لقائها وعددِ لقاءاتها
      وحالِ خطّتها، والمؤجَّلةُ بتاريخها، والمنقولةُ منقولة، والملغاةُ لا.
   ② وحفظُ الإدارة يسمّي في أثره ما تغيّر وحدَه — فحفظُ الصورة لا يمحو أنّ النبذةَ كتبها المدرّب.
   ③ وعقدُه: آخرُ عقدٍ غيرِ مُزاح — يقول من عليه الخطوةُ في سطره المطويّ (`trainer-status.ts`، ٢٠ أكتوبر ٢٠٢٦). */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerPublicTextService } from '../../services/trainer-public-text.service'
import type { CardCohort, ProfileTrail } from '../../../src/application/trainer/trainer-card'

const STAMP = Date.now()
let prisma: PrismaClient
let review: TrainerReviewService
let adminId = ''
let profileId = ''
let courseId = ''
const ids: Record<string, string> = {}

type Row = { profileId: string; cohorts: CardCohort[]; trail: ProfileTrail; contract: { status: string } | null }
const me = async () => (await review.listForOps() as unknown as Row[]).find((r) => r.profileId === profileId)!
const byTitle = (cs: CardCohort[], k: string) => cs.find((c) => c.title === `${k} ${STAMP}`)

async function cohort(key: string, opts: { status?: string; plan?: string; postponedTo?: Date; sessions?: number; moved?: boolean } = {}) {
  const c = await prisma.cohort.create({
    data: { courseId, title: `${key} ${STAMP}`, status: opts.status ?? 'draft', registrationOpen: false },
  })
  for (let i = 0; i < (opts.sessions ?? 0); i++) {
    await prisma.cohortSession.create({ data: { cohortId: c.id, title: `لقاء ${i + 1}`, startsAt: new Date(Date.UTC(2093, 10, 3 + i * 7, 16)) } })
  }
  /* ولقاءٌ ملغى قبلها كلِّها — لا يُعدّ ولا يكون «أوّلَ لقاء» */
  if (opts.sessions) {
    await prisma.cohortSession.create({ data: { cohortId: c.id, title: 'ملغى', status: 'cancelled', startsAt: new Date(Date.UTC(2093, 9, 1, 16)) } })
  }
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
  if (opts.plan) {
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId: c.id, trainerId: profileId, status: opts.plan, postponedTo: opts.postponedTo ?? null, content: { kind: 'trainer', modules: [] } as never },
    })
  }
  if (opts.moved) {
    await prisma.cohortMoveRequest.create({
      data: { cohortId: c.id, requestedBy: adminId, toYear: 2094, toSeason: 'feb_apr', reason: 'نقل', status: 'approved', reviewedAt: new Date() },
    })
  }
  ids[key] = c.id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  review = new TrainerReviewService(prisma)
  adminId = (await new AuthService(prisma).register(`card-admin-${STAMP}@test.local`, 'Admin#12345', 'مدير')).userId
  courseId = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, select: { id: true } })).id
  const app = await prisma.trainerApplication.create({
    data: { reference: `TR-CARD-${STAMP}`, fullName: 'مدربة البطاقة', email: `card-${STAMP}@test.local`, status: 'active', motivation: 'اختبار', privacyConsentAt: new Date() },
  })
  profileId = (await prisma.trainerProfile.create({
    data: { applicationId: app.id, isVerified: true, headline: 'مدربة ومستشارة', bioPublic: 'نبذة الطلب' },
  })).id
  await prisma.trainerCourseQualification.create({ data: { profileId, courseId, status: 'qualified' } })

  await cohort('معتمدة', { plan: 'approved', sessions: 3 })
  await cohort('تنتظرك', { plan: 'submitted' })
  await cohort('مؤجلة', { plan: 'changes_requested', postponedTo: new Date('2094-02-01') })
  await cohort('بلا خطة')
  await cohort('منقولة', { plan: 'approved', moved: true })
  await cohort('ملغاة', { status: 'cancelled', plan: 'approved' })
}, 240_000)

describe('① شعبها كما هي', () => {
  it('⚠️ تظهر من CohortTrainer ولا صف إسناد قديم لها', async () => {
    expect(await prisma.trainerCourseAssignment.count({ where: { profileId } }), 'الفحص يفترض ألا إسناد قديما').toBe(0)
    const r = await me()
    expect(r.cohorts.map((c) => c.title.replace(` ${STAMP}`, '')).sort())
      .toEqual(['بلا خطة', 'تنتظرك', 'مؤجلة', 'معتمدة', 'منقولة'])
  })

  it('بأول لقاء غير ملغى وعدد لقاءاتها وحال خطتها', async () => {
    const r = await me()
    const a = byTitle(r.cohorts, 'معتمدة')!
    expect(a.firstAt?.slice(0, 10), 'أول لقاء قرئ من الملغى').toBe('2093-11-03')
    expect(a.sessions, 'عد الملغى').toBe(3)
    expect(a.plan).toBe('approved')
    expect(a.courseId).toBe(courseId)
    expect(byTitle(r.cohorts, 'تنتظرك')!.plan).toBe('submitted')
    expect(byTitle(r.cohorts, 'بلا خطة')!.plan).toBeNull()
  })

  it('⚠️ والمؤجلة بتاريخها، والمنقولة منقولة', async () => {
    const r = await me()
    const p = byTitle(r.cohorts, 'مؤجلة')!
    expect(p.plan).toBe('changes_requested')
    expect(p.postponedTo).toBe('2094-02-01')
    expect(byTitle(r.cohorts, 'منقولة')!.moved).toEqual({ toYear: 2094, toSeason: 'feb_apr' })
    expect(byTitle(r.cohorts, 'معتمدة')!.moved).toBeNull()
  })
})

describe('② أثر الملف العام', () => {
  it('لا أثر بعد: لا صورة ولا كاتب', async () => {
    expect((await me()).trail).toEqual({ photo: null, photoRejectedAt: null, text: null, textRejectedAt: null })
  })

  it('⚠️ نبذة كتبها المدرب ثم حفظت الإدارة صورة وحدها — تبقى نبذته', async () => {
    await prisma.trainerProfile.update({
      where: { id: profileId },
      data: { headlinePending: 'مدربة ومستشارة استدامة', bioPending: 'نبذة كتبتها بنفسي', publicTextPendingAt: new Date() },
    })
    await new TrainerPublicTextService(prisma).approve(profileId, adminId, { headline: 'مدربة ومستشارة استدامة', bioPublic: 'نبذة كتبتها بنفسي' })
    expect((await me()).trail.text?.by).toBe('trainer')

    /* الشاشةُ ترسل الحقولَ الثلاثةَ في كلّ حفظ — والنصّان كما هما */
    await review.savePublicProfile(profileId, adminId, {
      headline: 'مدربة ومستشارة استدامة', bioPublic: 'نبذة كتبتها بنفسي', photoUrl: 'https://example.com/p.jpg',
    })
    const last = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: profileId, action: 'trainer.public_profile.save' }, orderBy: { createdAt: 'desc' },
    })
    expect(last.meta).toEqual({ fields: ['photoUrl'] })
    const t = (await me()).trail
    expect(t.text?.by, 'حفظ الصورة محا أن المدرب كتب نبذته').toBe('trainer')
    expect(t.photo?.by).toBe('admin_link')
  })

  it('وتعديل الإدارة للنبذة يحسب عليها', async () => {
    await review.savePublicProfile(profileId, adminId, {
      headline: 'مدربة ومستشارة استدامة', bioPublic: 'نبذة عدلتها الإدارة', photoUrl: 'https://example.com/p.jpg',
    })
    const t = (await me()).trail
    expect(t.text?.by).toBe('admin')
    expect(t.photo?.by).toBe('admin_link')
  })
})

describe('③ عقده', () => {
  it('⚠️ آخر عقد غير مزاح — ولا عقد: لا شيء', async () => {
    expect((await me()).contract).toBeNull()
    const at = (m: number) => new Date(Date.UTC(2026, 9, 20, 10, m))
    await prisma.trainerContract.create({ data: { profileId, title: 'عقد أول', status: 'sent', createdAt: at(0) } })
    await prisma.trainerContract.create({ data: { profileId, title: 'عقد أزاحه غيره', status: 'superseded', createdAt: at(5) } })
    expect((await me()).contract, 'قرئ المزاح').toEqual({ status: 'sent' })
    await prisma.trainerContract.create({ data: { profileId, title: 'عقد أحدث', status: 'signed', createdAt: at(9) } })
    expect((await me()).contract).toEqual({ status: 'signed' })
  })
})
