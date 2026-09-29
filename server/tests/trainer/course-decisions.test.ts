/* ملفُّ قراراتِ الدورات — على قاعدةٍ حقيقيّة.

   قواعدُ الرسم مفحوصةٌ في `src/tests/trainer/course-decisions.test.ts` على
   مدخلاتٍ مبنيّةٍ باليد. وهذا يفحص ما لا يُرى هناك: أنّ كلَّ خطوةٍ تقع فعلا من
   باب زرّها — فيُكتب في القاعدة ما يكتبه الزرّ — وأنّ القاعدةَ كما تكتبها
   الخدماتُ تُقرأ «طُبّق من قبل» حين يُرفع الملفُّ ثانية.

   والمدرّبون يُقبَلون بالمسار الحقيقيّ (`review.decide`)، فالاقتراحاتُ مبذورةٌ
   والمؤهّلاتُ المعلَّقةُ مزروعةٌ كما تزرعها المنصّة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CourseProposalService } from '../../services/course-proposal.service'
import { CourseDecisionsService, type DecisionsActor } from '../../services/course-decisions.service'
import { ROLE_PERMISSIONS } from '../../auth/permissions'
import { DECISIONS_KIND, DECISIONS_VERSION } from '../../../src/application/trainer/course-decisions'
import { makeReadyForApproval } from '../helpers/trainer-ready'

let prisma: PrismaClient
let apps: TrainerApplicationService
let review: TrainerReviewService
let proposals: CourseProposalService
let decisions: CourseDecisionsService
let adminId: string
let actor: DecisionsActor

const base = {
  phoneCountryCode: '+962', phone: '771070000', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدرّبة', specialties: ['الإدارة'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرةٌ ميدانيّة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'درّبتُ فرقا حقيقيّةً في بيئات عملٍ عربيّة، وأعرف الفرقَ بين من يعرف المادّة ومن يستطيع تعليمها. سأعطي كلَّ متعلّمٍ مهمّةً من واقع عمله في كلّ وحدة، وأراجع مخرجاته بنفسي وأكتب له ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
}

async function applicant(email: string, fullName: string, titles: string[], ticked: string[] = []) {
  const res = await apps.submitPhase1({ ...base, email, fullName })
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: ticked, availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' },
    teachableProposals: titles.map((titleAr) => ({ titleAr, summaryAr: '' })),
  })
  await prisma.trainerApplication.update({ where: { id: row.id }, data: { emailVerifiedAt: new Date() } })
  return { applicationId: row.id, reference: res.reference, fullName }
}

/** مقبولٌ داخليّا بالمسار الحقيقيّ — ومعرّفاتُ اقتراحاته المبذورة بعناوينها */
async function accepted(email: string, fullName: string, titles: string[], ticked: string[] = []) {
  const a = await applicant(email, fullName, titles, ticked)
  await review.decide(a.applicationId, adminId, 'conditionally_approve')
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: a.applicationId } })
  const seeded = await prisma.trainerCourseProposal.findMany({ where: { profileId: profile.id } })
  const idOf = (t: string) => seeded.find((s) => s.titleAr === t)!.id
  return { ...a, profileId: profile.id, idOf }
}

async function course(id: string, titleAr: string) {
  await prisma.course.create({ data: { id, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({ data: { courseId: id, version: 1, titleAr, totalHours: 8 } })
}

const fileOf = (trainers: unknown[]) => ({
  kind: DECISIONS_KIND, version: DECISIONS_VERSION, titleAr: 'قراراتُ الاختبار', trainers,
})

const openTasks = () => prisma.staffTask.count({ where: { assigneeId: adminId, status: 'open' } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  proposals = new CourseProposalService(prisma)
  decisions = new CourseDecisionsService(prisma)
  const admin = await auth.register('dec-admin@test.local', 'Admin#12345', 'مديرُ القرارات')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  actor = { userId: adminId, roles: ['academic_manager'], permissions: ROLE_PERMISSIONS.academic_manager }

  await course('C-DEC-101', 'الخطابةُ أمام الجمهور')
  await course('C-DEC-102', 'الدورةُ التي وُلدت من فكرة')
  await course('C-DEC-103', 'دورةٌ اختارها في طلبه')
}, 240_000)

describe('ملفُّ القرارات — يُعاين ثمّ يُطبَّق من أبواب الأزرار', () => {
  it('كلُّ خطوةٍ تقع كما يوقعها زرُّها — ومرّةً ثانيةً لا جديد', async () => {
    const a = await accepted('dec-a@test.local', 'أمل للقرارات',
      ['دوره الخطابه', 'فكرةٌ تصير دورة', 'فكرةٌ غامضة'], ['C-DEC-103'])
    /* فقرتُه الحرّةُ القديمةُ لم تدخل الطابور — وفكرتُها تُدخَل من الملفّ */
    const b = await accepted('dec-b@test.local', 'باسم الفقرة الحرّة', [])
    const c = await accepted('dec-c@test.local', 'ملفٌّ مكرَّر', [])
    const d = await applicant('dec-d@test.local', 'دانة التجريبيّة', [])
    await makeReadyForApproval(prisma, d.applicationId, adminId)
    await review.decide(d.applicationId, adminId, 'approve', 'اعتمادٌ للاختبار')
    const dProfile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: d.applicationId } })

    const file = fileOf([
      {
        reference: a.reference, fullName: a.fullName,
        proposals: [
          { proposalId: a.idOf('دوره الخطابه'), titleAr: 'دورة الخطابة', verdict: 'link', courseId: 'C-DEC-101' },
          { proposalId: a.idOf('فكرةٌ تصير دورة'), verdict: 'became_course', courseId: 'C-DEC-102' },
          { proposalId: a.idOf('فكرةٌ غامضة'), verdict: 'ask', questionAr: 'لمن هي هذه الدورة؟ وما مخرَجُها؟' },
        ],
        qualify: ['C-DEC-101', 'C-DEC-102', 'C-DEC-103'],
      },
      {
        reference: b.reference, fullName: b.fullName,
        proposals: [{ titleAr: 'التسويق العملي للمشاريع الصغيرة', verdict: 'link', courseId: 'C-DEC-101' }],
        qualify: ['C-DEC-101'],
      },
      { reference: c.reference, fullName: c.fullName, status: 'withdraw', statusNoteAr: 'ملفٌّ مكرَّرٌ للتجربة' },
      { reference: d.reference, fullName: d.fullName, status: 'suspend', statusNoteAr: 'ملفٌّ تجريبيّ لا يدرّس' },
    ])

    const pre = await decisions.preview(file, actor)
    expect(pre.errorsAr).toEqual([])
    expect(pre.plan!.counts, pre.plan!.steps.filter((s) => s.state !== 'todo').map((s) => `${s.n} ${s.reasonAr}`).join('\n'))
      .toEqual({ todo: 12, done: 0, blocked: 0 })
    const tasksBefore = await openTasks()

    const out = await decisions.apply(file, actor)
    expect(out.refusedAr).toBeNull()
    expect(out.failed).toBeNull()
    expect(out.applied).toHaveLength(12)

    /* أ — الطابورُ كما تكتبه أزرارُه */
    const p = async (id: string) => prisma.trainerCourseProposal.findUniqueOrThrow({ where: { id } })
    expect(await p(a.idOf('دوره الخطابه'))).toMatchObject({ titleAr: 'دورة الخطابة', status: 'linked', courseId: 'C-DEC-101' })
    expect(await p(a.idOf('فكرةٌ تصير دورة'))).toMatchObject({ status: 'became_course', courseId: 'C-DEC-102' })
    expect(await p(a.idOf('فكرةٌ غامضة'))).toMatchObject({ status: 'info_requested', questionAr: 'لمن هي هذه الدورة؟ وما مخرَجُها؟' })
    const qualsA = await prisma.trainerCourseQualification.findMany({ where: { profileId: a.profileId } })
    expect(Object.fromEntries(qualsA.map((q) => [q.courseId, q.status]))).toEqual({
      'C-DEC-101': 'qualified', 'C-DEC-102': 'qualified', 'C-DEC-103': 'qualified',
    })

    /* ب — فكرةُ الفقرة الحرّة صارت اقتراحا في طابوره، ثمّ رُبطت */
    const bRows = await prisma.trainerCourseProposal.findMany({ where: { profileId: b.profileId } })
    expect(bRows.map((r) => [r.titleAr, r.status, r.courseId])).toEqual([
      ['التسويق العملي للمشاريع الصغيرة', 'linked', 'C-DEC-101'],
    ])

    /* ج ود — السحبُ والإيقافُ بسببهما المكتوب */
    const cApp = await prisma.trainerApplication.findUniqueOrThrow({
      where: { id: c.applicationId }, include: { statusHistory: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })
    expect(cApp.status).toBe('withdrawn')
    expect(cApp.statusHistory[0].note).toBe('ملفٌّ مكرَّرٌ للتجربة')
    expect((await prisma.trainerProfile.findUniqueOrThrow({ where: { id: dProfile.id } })).suspendedAt).not.toBeNull()

    /* ولا مهمّةَ «أهِّله» لمن أُهِّل قبل أن يُربط — والترتيبُ هو ما يمنعها */
    expect(await openTasks(), 'فُتحت مهمّةُ تأهيلٍ لمن أُهِّل قبلها').toBe(tasksBefore)

    /* وصفٌّ يجمع الملفَّ في الأثر */
    const summary = await prisma.auditEvent.findMany({
      where: { action: 'trainer.course_decisions.apply', actorId: adminId },
    })
    expect(summary).toHaveLength(1)
    expect(summary[0].meta).toMatchObject({ applied: 12, failedAt: null })

    /* ثانيةً — لا جديد، ولا يُدخَل الاقتراحُ الجديدُ مرّتين */
    const again = await decisions.apply(file, actor)
    expect(again.applied).toEqual([])
    expect(again.refusedAr).toContain('لا جديد')
    expect((await decisions.preview(file, actor)).plan!.counts).toEqual({ todo: 0, done: 12, blocked: 0 })
    expect(await prisma.trainerCourseProposal.count({ where: { profileId: b.profileId } })).toBe(1)
  })

  it('قرارٌ وقع في الشاشة يُبقي صاحبَه كما هو كلَّه — ويُطبَّق غيرُه', async () => {
    const e = await accepted('dec-e@test.local', 'إياد المرفوض اقتراحُه', ['الأوّل', 'الثاني'])
    const h = await accepted('dec-h@test.local', 'هالة السليمة خطواتُها', [])
    const file = fileOf([
      {
        reference: e.reference, fullName: e.fullName,
        proposals: [
          { proposalId: e.idOf('الأوّل'), verdict: 'link', courseId: 'C-DEC-101' },
          { proposalId: e.idOf('الثاني'), verdict: 'link', courseId: 'C-DEC-102' },
        ],
      },
      { reference: h.reference, fullName: h.fullName, qualify: ['C-DEC-101'] },
    ])
    await proposals.reject(adminId, e.idOf('الثاني'), 'ليست في نطاقنا اليوم')

    const out = await decisions.apply(file, actor)
    expect(out.refusedAr).toBeNull()
    expect(out.applied, 'يُطبَّق المدرّبُ السليمُ وحدَه — خطوتُه الواحدة، لا أقلّ ولا أكثر').toHaveLength(1)
    const blocked = out.plan!.steps.filter((s) => s.state === 'blocked')
    expect(blocked.map((s) => s.reference)).toEqual([e.reference, e.reference])
    expect(blocked.some((s) => s.reasonAr?.includes('رُفض'))).toBe(true)
    expect((await prisma.trainerCourseProposal.findUniqueOrThrow({ where: { id: e.idOf('الأوّل') } })).status,
      'طُبّق نصفُ قراراتِ مدرّبٍ فيه خطوةٌ ممتنعة').toBe('submitted')
    expect((await prisma.trainerCourseQualification.findUniqueOrThrow({
      where: { profileId_courseId: { profileId: h.profileId, courseId: 'C-DEC-101' } },
    })).status).toBe('qualified')

    /* ومرّةً ثانيةً: السليمُ طُبّق من قبل، والممتنعُ ما زال — فلا شيء */
    const again = await decisions.apply(file, actor)
    expect(again.applied).toEqual([])
    expect(again.refusedAr).toContain('لم يُطبَّق شيء')
  })

  it('ومن لا يملك صلاحيّةَ التأهيل لا يؤهّل من الملفّ', async () => {
    const f = await accepted('dec-f@test.local', 'فرح بلا صلاحيّة', [])
    const file = fileOf([{ reference: f.reference, fullName: f.fullName, qualify: ['C-DEC-101'] }])
    const limited: DecisionsActor = {
      ...actor, permissions: actor.permissions.filter((k) => k !== 'trainer.qualify'),
    }
    const out = await decisions.apply(file, limited)
    expect(out.applied).toEqual([])
    expect(out.plan!.steps[0]).toMatchObject({ kind: 'qualify', state: 'blocked' })
    expect(await prisma.trainerCourseQualification.count({ where: { profileId: f.profileId } })).toBe(0)
  })
})

describe('والربطُ لا يفتح مهمّةَ «أهِّله» لمن هو مؤهَّلٌ لها', () => {
  it('المؤهَّلُ لا مهمّةَ له — وغيرُه تُفتح له كما كانت', async () => {
    const g = await accepted('dec-g@test.local', 'غيث المؤهَّل', ['يعرفها', 'لا يعرفها'])
    await review.qualifyForCourse(g.profileId, 'C-DEC-101', adminId)
    const assigner = { userId: adminId, roles: ['academic_manager'] }

    const before = await openTasks()
    await proposals.linkToCourse(assigner, g.idOf('يعرفها'), 'C-DEC-101')
    expect(await openTasks(), 'فُتحت مهمّةُ «أهِّله» لمن هو مؤهَّل').toBe(before)
    await proposals.linkToCourse(assigner, g.idOf('لا يعرفها'), 'C-DEC-102')
    expect(await openTasks(), 'لم تُفتح مهمّةُ التأهيل لمن ليس مؤهَّلا').toBe(before + 1)
  })
})
