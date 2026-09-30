/* ═══ لكلّ شيءٍ وقتُه عند المتعلّم — والخادمُ يحجب لا الشاشة (٢(ب-٢)) ═══

   قراراتُ صاحب المنصّة بكلمة «go» (٢٧ سبتمبر ٢٠٢٦): المتنُ والكرّاسةُ أوّلَ
   يوم الموعد، والمهامُّ والمصادرُ بعد أوّل لقاءٍ للمحور، والتسليمُ يتوقّف
   بانتهاء الشعبة والمتأخّرُ يُقبل ويُعلَّم، وستّةُ أشهرٍ للقراءة ثمّ ينتهي
   الوصول. والقاعدةُ محضةٌ في `cohort-gate.ts` (وحرّاسُها في
   `src/tests/learning/cohort-gate.test.ts`)، وهنا **أثرُها الحقيقيّ**: ما
   يخرج من `learnerCohortView` فعلا، وما يقبله التسليم، وما يقرؤه حارسُ الملفّات.

   والساعةُ ساعةُ الخادم الحقيقيّة — فالتواريخُ تُبنى حول اليوم: موعدٌ مضى،
   وموعدٌ جارٍ لقاؤه قادم، وموعدٌ لم يبدأ. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { AssessmentService } from '../../services/assessment.service'
import { CohortFileService } from '../../services/cohort-file.service'
import { zonedDay } from '../../../src/application/trainer/cohort-period'

const DAY = 86_400_000
const STAMP = Date.now()
/** يومٌ بتوقيت عمّان بعد `n` من اليوم (أو قبله) */
const day = (n: number) => zonedDay(new Date(STAMP + n * DAY))
const at = (n: number, hourUtc = 15) => new Date(`${day(n)}T${String(hourUtc).padStart(2, '0')}:00:00.000Z`)

let prisma: PrismaClient
let enrollments: EnrollmentService
let assessments: AssessmentService
let files: CohortFileService
let profileId = ''
let trainerUserId = ''
let courseId = ''

const BODY = 'ن'.repeat(400)

async function learner(tag: string, cohortId: string, status = 'enrolled') {
  const u = await new AuthService(prisma).register(`gate-${tag}-${STAMP}@test.local`, 'Learner#12345', `متعلّمُ ${tag}`)
  const e = await prisma.enrollment.create({ data: { cohortId, userId: u.userId, status } })
  return { userId: u.userId, enrollmentId: e.id }
}

/** شعبةٌ بخطّةٍ معتمَدةٍ لمدرّبها — ومواعيدُها وتاريخاها تُمرَّر */
async function cohortWithPlan(title: string, content: Record<string, unknown>, dates: { from: number; to: number }) {
  const cohort = await prisma.cohort.create({
    data: {
      courseId, title: `${title} ${STAMP}`, status: 'active', capacity: 30,
      startsAt: at(dates.from, 0), endsAt: at(dates.to, 12),
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
  await prisma.cohortDeliveryPlan.create({
    data: { cohortId: cohort.id, trainerId: profileId, status: 'approved', content: { kind: 'trainer', ...content } as never },
  })
  return cohort.id
}

const mods = (ids: string[], extra: Record<string, Record<string, unknown>> = {}) =>
  ids.map((moduleId, i) => ({ moduleId, titleAr: `المحور ${i + 1}`, bodyAr: BODY, ...(extra[moduleId] ?? {}) }))

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  enrollments = new EnrollmentService(prisma)
  assessments = new AssessmentService(prisma)
  files = new CohortFileService(prisma)

  const t = await new AuthService(prisma).register(`gate-trainer-${STAMP}@test.local`, 'Trainer#12345', 'مدرّبُ الخطّ')
  trainerUserId = t.userId
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `WJ-TR-GATE-${STAMP}`, email: `gate-trainer-${STAMP}@test.local`, fullName: 'مدرّبُ الخطّ',
      phoneCountryCode: '+962', phone: '779000222', country: 'الأردن', status: 'active',
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: app.id, userId: trainerUserId, legalNameAr: 'الاسمُ القانونيُّ السرّيّ' },
  })
  profileId = profile.id
  courseId = (await prisma.course.findFirstOrThrow({ select: { id: true } })).id
}, 240_000)

/* ═══ ① شعبةٌ جارية: موعدٌ مضى، وموعدٌ جارٍ لقاؤه قادم، وموعدٌ لم يبدأ ═══ */
describe('① الشعبةُ الجارية — ما فُتح يصل وما لم يُفتح عنوانٌ وموعد', () => {
  const IDS = ['GM1', 'GM2', 'GM3', 'GM4']
  let cohortId = ''
  let me = { userId: '', enrollmentId: '' }
  let pastDue = '' // مهمّةُ المحور الأوّل — فات موعدُها، ولقاؤها انعقد
  let onTime = ''  // مهمّةُ المحور الأوّل — موعدُها قادم
  let lockedQuiz = '' // اختبارُ المحور الثاني — لقاؤه لم ينعقد
  const K = { wb1: `k-wb1-${STAMP}`, wb3: `k-wb3-${STAMP}`, body1: `k-b1-${STAMP}`, body3: `k-b3-${STAMP}`, draft: `k-draft-${STAMP}` }

  beforeAll(async () => {
    cohortId = await cohortWithPlan('شعبةُ الخطّ الجارية', {
      startsOn: day(-14), endsOn: day(27),
      modules: mods(IDS, { GM1: { bodyFileKey: K.body1, bodyFileName: 'م١.pdf' }, GM3: { bodyFileKey: K.body3, bodyFileName: 'م٣.pdf' } }),
      slots: [
        { startsOn: day(-14), endsOn: day(-8), moduleIds: ['GM1'], workbook: { bodyFileKey: K.wb1, bodyFileName: 'كرّاسة١.pdf' } },
        { startsOn: day(-7), endsOn: day(6), moduleIds: ['GM2'], workbook: { url: 'https://x.test/wb2' } },
        { startsOn: day(7), endsOn: day(13), moduleIds: ['GM3'], workbook: { bodyFileKey: K.wb3, bodyFileName: 'كرّاسة٣.pdf' } },
        { startsOn: day(14), endsOn: day(27), moduleIds: ['GM4'], workbook: { url: 'https://x.test/wb4' } },
      ],
      resources: [
        { title: 'مصدرُ المحور الأوّل', url: 'https://x.test/r1', moduleId: 'GM1' },
        { title: 'مصدرُ المحور الثالث', url: 'https://x.test/r3', moduleId: 'GM3' },
        { title: 'قراءةٌ مسبقةٌ للثاني', url: 'https://x.test/pre2', moduleId: 'GM2', preReading: true },
        { title: 'مصدرُ المحور الثاني بعد لقائه', url: 'https://x.test/r2', moduleId: 'GM2' },
        { title: 'للشعبة كلِّها', url: 'https://x.test/all' },
      ],
    }, { from: -14, to: 27 })

    const mk = (title: string, n: number, moduleIds: string[], status = 'scheduled') => prisma.cohortSession.create({
      data: { cohortId, title, startsAt: at(n), endsAt: at(n, 17), moduleId: moduleIds[0], moduleIds, status },
    })
    const s1 = await mk('لقاءُ الأوّل', -13, ['GM1'], 'done')
    await prisma.zoomMeeting.create({ data: { sessionId: s1.id, joinUrl: 'https://zoom.us/j/1', meetingId: '111', passcodeEnc: 'old' } })
    const s2 = await mk('لقاءُ الثاني', 2, ['GM2'])
    await prisma.zoomMeeting.create({ data: { sessionId: s2.id, joinUrl: 'https://zoom.us/j/2', meetingId: '222', passcodeEnc: 'next' } })
    await mk('لقاءُ الثالث', 8, ['GM3'])
    await mk('لقاءُ الرابع', 15, ['GM4'])
    /* لقاءٌ للثاني انقضى ولم تعتمده الإدارة — لا يراه المتعلّمُ فلا يفتح مهامَّ محوره */
    await prisma.cohortSession.create({
      data: { cohortId, title: 'لقاءٌ لم يُعتمد', startsAt: at(-3), endsAt: at(-3, 17), moduleId: 'GM2', moduleIds: ['GM2'], approvalState: 'pending' },
    })

    pastDue = (await prisma.cohortAssessment.create({
      data: { cohortId, moduleId: 'GM1', type: 'assignment', title: 'تطبيقُ الأوّل', briefAr: 'اكتب خطّتك', maxScore: 10, status: 'published', dueAt: at(-8, 20) },
    })).id
    onTime = (await prisma.cohortAssessment.create({
      data: { cohortId, moduleId: 'GM1', type: 'assignment', title: 'تطبيقٌ ثانٍ للأوّل', maxScore: 10, status: 'published', dueAt: at(20) },
    })).id
    lockedQuiz = (await prisma.cohortAssessment.create({
      data: {
        cohortId, moduleId: 'GM2', type: 'quiz', title: 'اختبارُ الثاني', briefAr: 'أجب عن الأسئلة', maxScore: 10, status: 'published',
        items: { create: [{ sequence: 1, prompt: 'السؤالُ السرّيّ قبل أوانه', maxScore: 10 }] },
      },
    })).id

    for (const [key, refId] of [[K.wb1, 'wb-1'], [K.wb3, 'wb-3'], [K.body1, 'GM1'], [K.body3, 'GM3'], [K.draft, 'GM4']] as const) {
      await prisma.cohortFile.create({ data: { cohortId, purpose: 'plan_resource', refId, storageKey: key, originalName: `${refId}.pdf`, mime: 'application/pdf' } })
    }
    /* ملفٌّ في مسودّةٍ أحدثَ لم تُعتمد — لا يصل المتعلّمَ وإن كانت الخطّةُ المعتمَدةُ قائمة */
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId, trainerId: profileId, status: 'draft', content: { kind: 'trainer', modules: mods(IDS, { GM4: { bodyFileKey: K.draft } }) } as never },
    })
    me = await learner('current', cohortId)
  }, 120_000)

  const view = () => enrollments.learnerCohortView(me.enrollmentId)

  it('الشعبةُ مفتوحة، ولها آخرٌ معلَن', async () => {
    const v = await view()
    expect(v.access.state).toBe('open')
    expect(v.access.closesAt).not.toBeNull()
    expect(v.access.accessEndsAt).not.toBeNull()
  })

  it('⚠️ متنُ المحور الذي لم يبدأ موعدُه لا يصل — عنوانُه وموعدُه وحدَهما', async () => {
    const plan = (await view()).cohort.trainerPlan!
    const m3 = plan.modules.find((m) => m.moduleId === 'GM3')!
    expect(m3.locked, 'محورٌ لم يحن موعدُه غيرُ محجوب').toBe(true)
    expect(m3.bodyAr, 'متنُ المحور القادم وصل المتعلّم').toBeNull()
    expect(m3.bodyFileKey, 'مفتاحُ ملفّ المحور القادم وصل المتعلّم').toBeNull()
    expect(m3.opensAt).toBeTruthy()
    expect(m3.titleAr).toBe('المحور 3')
    const m2 = plan.modules.find((m) => m.moduleId === 'GM2')!
    expect(m2.locked, 'الموعدُ الجاري محجوب').toBe(false)
    expect(m2.bodyAr).toBe(BODY)
  })

  it('⚠️ وكرّاسةُ الموعد القادم لا يصل رابطُها ولا ملفُّها — ويُقال إنّ لها كرّاسة', async () => {
    const slots = (await view()).cohort.trainerPlan!.slots!
    expect(slots).toHaveLength(4)
    expect(slots[0].workbook?.bodyFileKey).toBe(K.wb1)
    expect(slots[1].workbook?.url).toBe('https://x.test/wb2')
    expect(slots[2].locked).toBe(true)
    expect(slots[2].hasWorkbook).toBe(true)
    expect(slots[2].workbook, 'كرّاسةُ موعدٍ لم يبدأ وصلت').toBeNull()
  })

  it('⚠️ والمصادرُ على الخطّ: بعد لقاء محورها، والمسبقةُ مع كرّاسته، والعامّةُ مع أوّل يوم', async () => {
    const titles = (await view()).cohort.trainerPlan!.resources.map((r) => r.title)
    expect(titles).toContain('مصدرُ المحور الأوّل')
    expect(titles).toContain('قراءةٌ مسبقةٌ للثاني')
    expect(titles).toContain('للشعبة كلِّها')
    expect(titles, 'مصدرُ محورٍ لم ينعقد لقاؤه وصل').not.toContain('مصدرُ المحور الثاني بعد لقائه')
    expect(titles, 'مصدرُ محورٍ لم يبدأ موعدُه وصل').not.toContain('مصدرُ المحور الثالث')
  })

  it('⚠️ والمهمّةُ قبل لقاء محورها عنوانٌ وموعدٌ — بلا تعليماتٍ ولا أسئلة (ولا يفتحها لقاءٌ لم يُعتمد)', async () => {
    const list = (await view()).cohort.assessments
    const quiz = list.find((a) => a.id === lockedQuiz)!
    expect(quiz.locked).toBe(true)
    expect(quiz.opensAt).toBeTruthy()
    expect(quiz.items, 'أسئلةُ اختبارٍ لم يُفتح وصلت').toEqual([])
    expect(quiz.briefAr).toBeNull()
    expect(JSON.stringify(list)).not.toContain('السؤالُ السرّيّ قبل أوانه')
    const open = list.find((a) => a.id === pastDue)!
    expect(open.locked).toBe(false)
    expect(open.briefAr).toBe('اكتب خطّتك')
  })

  it('⚠️ ولقاءٌ انتهى يسقط رابطُه ورمزُه — والقادمُ باقٍ', async () => {
    const sessions = (await view()).cohort.sessions
    expect(sessions.find((s) => s.title === 'لقاءُ الأوّل')!.zoom, 'رابطُ لقاءٍ انعقد وصل').toBeNull()
    expect(sessions.find((s) => s.title === 'لقاءُ الثاني')!.zoom?.passcodeEnc).toBe('next')
  })

  it('⚠️ ومدرّبُ الشعبة يصل اسمُه لا ملفُّه', async () => {
    const v = await view()
    const t = v.cohort.trainers[0] as unknown as Record<string, unknown> & { profile: Record<string, unknown> }
    expect(Object.keys(t.profile), 'ملفُّ المدرّب كاملا في حمولة المتعلّم').toEqual(['application'])
    expect(JSON.stringify(v)).not.toContain('الاسمُ القانونيُّ السرّيّ')
    const list = await enrollments.myEnrollments(me.userId)
    expect(JSON.stringify(list), 'وفي «تعلُّمي» كذلك').not.toContain('الاسمُ القانونيُّ السرّيّ')
  })

  it('⚠️ والتسليمُ قبل لقاء المحور يُردّ — بعربيّةٍ تقول متى', async () => {
    await expect(assessments.submitAttempt(me.userId, lockedQuiz, [{ itemId: 'x', answer: 'a' }]))
      .rejects.toMatchObject({ code: 'bad_item' })
    const item = await prisma.assessmentItem.findFirstOrThrow({ where: { assessmentId: lockedQuiz } })
    await expect(assessments.submitAttempt(me.userId, lockedQuiz, [{ itemId: item.id, answer: 'a' }]))
      .rejects.toMatchObject({ code: 'not_open_yet', status: 409 })
  })

  it('⚠️ والمتأخّرُ يُقبل ويُعلَّم — وفي موعده لا يُعلَّم', async () => {
    const late = await assessments.submitAssignment(me.userId, pastDue, { textAnswer: 'بعد الموعد' })
    expect(late.submission.late, 'تسليمٌ بعد آخر موعده لم يُعلَّم').toBe(true)
    const fine = await assessments.submitAssignment(me.userId, onTime, { textAnswer: 'في موعده' })
    expect(fine.submission.late).toBe(false)
  })

  it('⚠️ وملفُّ ما فُتح يُقرأ — وما لم يُفتح أو لم يُعتمد يُردّ بـ٤٠٤', async () => {
    const read = (key: string) => files.assertCanRead(key, { userId: me.userId, permissions: [] })
    await expect(read(K.wb1)).resolves.toBeTruthy()
    await expect(read(K.body1)).resolves.toBeTruthy()
    await expect(read(K.wb3), 'كرّاسةُ موعدٍ قادمٍ قُرئت').rejects.toMatchObject({ status: 404 })
    await expect(read(K.body3), 'متنُ محورٍ قادمٍ قُرئ').rejects.toMatchObject({ status: 404 })
    await expect(read(K.draft), 'ملفُّ مسودّةٍ لم تُعتمد قُرئ').rejects.toMatchObject({ status: 404 })
    /* والمدرّبُ يقرأ ما في شعبته كلَّه — القادمَ والمسودّة */
    await expect(files.assertCanRead(K.draft, { userId: trainerUserId, permissions: [] })).resolves.toBeTruthy()
  })

  it('⚠️ والمنسحبُ والمنتظرُ لا يقرآن — وإن كان الملفُّ مفتوحا', async () => {
    for (const status of ['dropped', 'waitlisted']) {
      const other = await learner(`files-${status}`, cohortId, status)
      await expect(
        files.assertCanRead(K.wb1, { userId: other.userId, permissions: [] }),
        `${status} يقرأ ملفَّ الشعبة`,
      ).rejects.toMatchObject({ status: 404 })
    }
  })
})

/* ═══ ② شعبةٌ انتهت منذ شهر — للقراءة لا للتسليم ═══ */
describe('② بعد انتهاء الشعبة: يقرأ ما فُتح ولا يُسلِّم — إلّا ما طلب المدرّبُ إعادتَه', () => {
  let cohortId = ''
  let me = { userId: '', enrollmentId: '' }
  let task = ''

  beforeAll(async () => {
    cohortId = await cohortWithPlan('شعبةٌ انتهت', {
      startsOn: day(-70), endsOn: day(-31),
      modules: mods(['RM1', 'RM2', 'RM3', 'RM4']),
      slots: [
        { startsOn: day(-70), endsOn: day(-61), moduleIds: ['RM1'], workbook: { url: 'https://x.test/r-wb1' } },
        { startsOn: day(-60), endsOn: day(-51), moduleIds: ['RM2'], workbook: { url: 'https://x.test/r-wb2' } },
        { startsOn: day(-50), endsOn: day(-41), moduleIds: ['RM3'], workbook: { url: 'https://x.test/r-wb3' } },
        { startsOn: day(-40), endsOn: day(-31), moduleIds: ['RM4'], workbook: { url: 'https://x.test/r-wb4' } },
      ],
      resources: [],
    }, { from: -70, to: -31 })
    await prisma.cohortSession.create({
      data: { cohortId, title: 'لقاءٌ مضى', startsAt: at(-69), endsAt: at(-69, 17), moduleId: 'RM1', moduleIds: ['RM1'], status: 'done' },
    })
    task = (await prisma.cohortAssessment.create({
      data: { cohortId, moduleId: 'RM1', type: 'assignment', title: 'تطبيقٌ قديم', maxScore: 10, status: 'published', dueAt: at(-61, 20) },
    })).id
    me = await learner('readonly', cohortId)
  }, 120_000)

  it('الوصولُ للقراءة — والمتنُ والكرّاسةُ يصلان', async () => {
    const v = await enrollments.learnerCohortView(me.enrollmentId)
    expect(v.access.state).toBe('readonly')
    expect(v.cohort.trainerPlan!.modules.every((m) => !m.locked)).toBe(true)
    expect(v.cohort.trainerPlan!.slots![0].workbook?.url).toBe('https://x.test/r-wb1')
  })

  it('⚠️ والتسليمُ الجديدُ يُردّ بعد انتهائها', async () => {
    await expect(assessments.submitAssignment(me.userId, task, { textAnswer: 'متأخّرٌ جدّا' }))
      .rejects.toMatchObject({ code: 'cohort_closed', status: 409 })
  })

  it('⚠️ وإعادةٌ طلبها المدرّبُ تُقبل — ولا تُعلَّم متأخّرة', async () => {
    /* تسليمٌ سبق الانتهاءَ ثمّ طُلبت إعادتُه */
    await prisma.assignmentSubmission.create({
      data: { assessmentId: task, enrollmentId: me.enrollmentId, textAnswer: 'الأوّل', status: 'resubmit_requested', submittedAt: at(-62) },
    })
    const again = await assessments.resubmit(me.userId, task, { textAnswer: 'بعد الملاحظات' })
    expect(again.submission.late, 'إعادةٌ بطلبٍ عُلّمت متأخّرة').toBe(false)
  })
})

/* ═══ ③ شعبةٌ انتهت منذ ثمانية أشهر — انتهى الوصول ═══ */
describe('③ بعد ستّة أشهرٍ من انتهائها: عناوينُ ما درسه، بلا متنٍ ولا كرّاسةٍ ولا مصدر', () => {
  let cohortId = ''
  let me = { userId: '', enrollmentId: '' }
  let task = ''
  const KEY = `k-old-${STAMP}`

  beforeAll(async () => {
    cohortId = await cohortWithPlan('شعبةٌ قديمة', {
      startsOn: day(-290), endsOn: day(-250),
      modules: mods(['OM1', 'OM2', 'OM3', 'OM4'], { OM1: { bodyFileKey: KEY } }),
      slots: [
        { startsOn: day(-290), endsOn: day(-281), moduleIds: ['OM1'], workbook: { url: 'https://x.test/o-wb1' } },
        { startsOn: day(-280), endsOn: day(-271), moduleIds: ['OM2'], workbook: { url: 'https://x.test/o-wb2' } },
        { startsOn: day(-270), endsOn: day(-261), moduleIds: ['OM3'], workbook: { url: 'https://x.test/o-wb3' } },
        { startsOn: day(-260), endsOn: day(-250), moduleIds: ['OM4'], workbook: { url: 'https://x.test/o-wb4' } },
      ],
      resources: [{ title: 'مصدرٌ قديم', url: 'https://x.test/old' }],
    }, { from: -290, to: -250 })
    await prisma.learningMaterial.create({ data: { cohortId, title: 'مادّةٌ قديمة', kind: 'link', externalUrl: 'https://x.test/m' } })
    task = (await prisma.cohortAssessment.create({
      data: { cohortId, moduleId: 'OM1', type: 'assignment', title: 'تطبيقٌ منسيّ', briefAr: 'تعليماتٌ قديمة', maxScore: 10, status: 'published' },
    })).id
    await prisma.cohortFile.create({ data: { cohortId, purpose: 'module_body', refId: 'OM1', storageKey: KEY, originalName: 'o.pdf', mime: 'application/pdf' } })
    me = await learner('ended', cohortId)
  }, 120_000)

  it('⚠️ لا متنَ ولا كرّاسةَ ولا مصدرَ ولا مادّة — والعناوينُ باقية', async () => {
    const v = await enrollments.learnerCohortView(me.enrollmentId)
    expect(v.access.state).toBe('ended')
    const plan = v.cohort.trainerPlan!
    expect(plan.modules.map((m) => m.titleAr)).toEqual(['المحور 1', 'المحور 2', 'المحور 3', 'المحور 4'])
    expect(plan.modules.every((m) => m.locked && m.bodyAr === null && m.opensAt === null)).toBe(true)
    expect(plan.slots!.every((s) => s.workbook === null)).toBe(true)
    expect(plan.resources).toEqual([])
    expect(v.cohort.materials).toEqual([])
    const a = v.cohort.assessments.find((x) => x.id === task)!
    expect(a.locked).toBe(true)
    expect(a.briefAr).toBeNull()
  })

  it('⚠️ ولا تسليمَ ولا ملفّ', async () => {
    await expect(assessments.submitAssignment(me.userId, task, { textAnswer: 'بعد سنة' }))
      .rejects.toMatchObject({ code: 'access_ended', status: 409 })
    await expect(files.assertCanRead(KEY, { userId: me.userId, permissions: [] })).rejects.toMatchObject({ status: 404 })
  })
})

/* ═══ ④ وما اعتُمد بلا مواعيدَ يمضي كما بدأ ═══ */
describe('④ الشعبةُ التي اعتُمدت قبل المواعيد: لا بوّابةَ ولا أجل', () => {
  it('كلُّ شيءٍ مفتوح، ولا آخرَ يُعلَن — والمتأخّرُ يُقبل ويُعلَّم', async () => {
    const cohortId = await cohortWithPlan('شعبةٌ قبل المواعيد', {
      modules: mods(['LM1', 'LM2']), resources: [{ title: 'مصدر', url: 'https://x.test/l' }],
    }, { from: -300, to: -250 })
    const task = (await prisma.cohortAssessment.create({
      data: { cohortId, moduleId: 'LM2', type: 'assignment', title: 'تطبيق', maxScore: 10, status: 'published', dueAt: at(-260) },
    })).id
    const me = await learner('legacy', cohortId)
    const v = await enrollments.learnerCohortView(me.enrollmentId)
    expect(v.access).toEqual({ state: 'open', closesAt: null, accessEndsAt: null })
    expect(v.cohort.trainerPlan!.modules.every((m) => !m.locked && m.bodyAr === BODY)).toBe(true)
    expect(v.cohort.trainerPlan!.slots).toEqual([])
    const sub = await assessments.submitAssignment(me.userId, task, { textAnswer: 'بعد أشهر' })
    expect(sub.submission.late).toBe(true)
  })
})

/* ═══ ⑤ كرّاسةُ الدورة الواحدة (٣٠ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «اجعل الكرّاسةَ واحدةً فقط وليس لكلّ محور… وأن يتأكّد أن
   تكون سهلةً على الطالب يتبعها محورا محورا». فتُفتح أوّلَ يومٍ في الموعد الأوّل
   — وقبله لا يصل ملفُّها ولا يُقرأ من مساره المحروس — وخريطتُها (أين يبدأ كلُّ
   محور) تصل مع العناوين. ومتى وُجدت سقطت كرّاساتُ المواعيد القديمة من العرض. */
describe('⑤ كرّاسةُ الدورة الواحدة', () => {
  const IDS = ['WM1', 'WM2', 'WM3', 'WM4']
  const KEY = `k-cwb-${STAMP}`
  const OLD = `k-old-${STAMP}`
  const content = (from: number) => ({
    startsOn: day(from), endsOn: day(from + 27),
    modules: mods(IDS),
    slots: IDS.map((id, i) => ({
      startsOn: day(from + i * 7), endsOn: day(from + i * 7 + 6), moduleIds: [id],
      /* كرّاسةُ موعدٍ قديمةٌ بقيت في الخطّة — لا تُعرض بجانب كرّاسة الدورة */
      workbook: i === 0 ? { bodyFileKey: OLD, bodyFileName: 'قديمة.pdf' } : null,
    })),
    workbook: { title: 'كرّاسةُ الدورة', bodyFileKey: KEY, bodyFileName: 'الكرّاسة.pdf', parts: IDS.map((moduleId, i) => ({ moduleId, whereAr: `ص ${i * 6 + 1}` })) },
  })

  it('⚠️ قبل أوّل يومٍ في الشعبة: خريطتُها تصل، وملفُّها لا يصل ولا يُقرأ', async () => {
    const cohortId = await cohortWithPlan('كرّاسةٌ لم تُفتح', content(5), { from: 5, to: 32 })
    await prisma.cohortFile.create({ data: { cohortId, purpose: 'plan_resource', refId: 'workbook-cohort', storageKey: KEY, originalName: 'الكرّاسة.pdf', mime: 'application/pdf' } })
    const me = await learner('cwb-early', cohortId)
    const wb = (await enrollments.learnerCohortView(me.enrollmentId)).cohort.trainerPlan!.workbook!
    expect(wb.locked).toBe(true)
    expect(wb.file, 'ملفُّ الكرّاسة وصل قبل أوانه').toBeNull()
    expect(wb.parts.map((p) => p.whereAr)).toEqual(['ص 1', 'ص 7', 'ص 13', 'ص 19'])
    await expect(files.assertCanRead(KEY, { userId: me.userId, permissions: [] }), 'قُرئ ملفُّ الكرّاسة قبل أوانه').rejects.toThrow()
  })

  it('⚠️ ومن أوّل يوم: الملفُّ يصل ويُقرأ — وكرّاسةُ الموعد القديمة لا تُعرض معها', async () => {
    const cohortId = await cohortWithPlan('كرّاسةٌ مفتوحة', content(-3), { from: -3, to: 24 })
    for (const [key, refId] of [[`${KEY}-open`, 'workbook-cohort'], [`${OLD}-open`, 'wb-old']] as const) {
      await prisma.cohortFile.create({ data: { cohortId, purpose: 'plan_resource', refId, storageKey: key, originalName: `${refId}.pdf`, mime: 'application/pdf' } })
    }
    await prisma.cohortDeliveryPlan.updateMany({
      where: { cohortId },
      data: { content: { kind: 'trainer', ...content(-3), workbook: { ...content(-3).workbook, bodyFileKey: `${KEY}-open` },
        slots: content(-3).slots.map((s, i) => (i === 0 ? { ...s, workbook: { bodyFileKey: `${OLD}-open` } } : s)) } as never },
    })
    const me = await learner('cwb-open', cohortId)
    const plan = (await enrollments.learnerCohortView(me.enrollmentId)).cohort.trainerPlan!
    expect(plan.workbook!.locked).toBe(false)
    expect(plan.workbook!.file?.bodyFileKey).toBe(`${KEY}-open`)
    await expect(files.assertCanRead(`${KEY}-open`, { userId: me.userId, permissions: [] })).resolves.toBeTruthy()
    expect(plan.slots![0].workbook, 'كرّاسةُ موعدٍ قديمةٌ عُرضت بجانب كرّاسة الدورة').toBeNull()
    await expect(files.assertCanRead(`${OLD}-open`, { userId: me.userId, permissions: [] })).rejects.toThrow()
  })
})

/* ═══ ⑥ مرفقُ المهمّة المرفوع (٣٠ سبتمبر ٢٠٢٦) ═══

   «عندما يختار ملفّا… يظهر له ما يوازيه» — فصار للمهمّة مرفقٌ يُرفع إلى مخزن
   الشعبة لا رابطٌ وحدَه. ويُقرأ بالبوّابة التي تُرى بها مهمّتُه: قبل فتحها لا. */
describe('⑥ مرفقُ المهمّة المرفوع', () => {
  it('⚠️ يُقرأ لمهمّةٍ فُتحت، ولا يُقرأ لمهمّةٍ لم تُفتح', async () => {
    const IDS = ['AM1', 'AM2', 'AM3', 'AM4']
    const cohortId = await cohortWithPlan('مرفقُ مهمّة', {
      startsOn: day(-10), endsOn: day(17), modules: mods(IDS),
      slots: IDS.map((id, i) => ({ startsOn: day(-10 + i * 7), endsOn: day(-4 + i * 7), moduleIds: [id] })),
    }, { from: -10, to: 17 })
    await prisma.cohortSession.create({
      data: { cohortId, title: 'لقاءُ الأوّل', startsAt: at(-9), endsAt: at(-9, 17), moduleId: 'AM1', moduleIds: ['AM1'], status: 'done' },
    })
    const OPEN = `k-att-open-${STAMP}`
    const SHUT = `k-att-shut-${STAMP}`
    for (const [moduleId, key] of [['AM1', OPEN], ['AM3', SHUT]] as const) {
      await prisma.cohortFile.create({ data: { cohortId, purpose: 'plan_resource', refId: `task-att-${key}`, storageKey: key, originalName: 'نموذج.pdf', mime: 'application/pdf' } })
      await prisma.cohortAssessment.create({
        data: {
          cohortId, moduleId, type: 'assignment', title: `مهمّةُ ${moduleId}`, maxScore: 10, status: 'published',
          attachments: [{ title: 'نموذجُ التسليم', kind: 'file', bodyFileKey: key, bodyFileName: 'نموذج.pdf' }],
        },
      })
    }
    const me = await learner('att', cohortId)
    await expect(files.assertCanRead(OPEN, { userId: me.userId, permissions: [] })).resolves.toBeTruthy()
    await expect(files.assertCanRead(SHUT, { userId: me.userId, permissions: [] }), 'قُرئ مرفقُ مهمّةٍ لم تُفتح').rejects.toThrow()
  })
})
