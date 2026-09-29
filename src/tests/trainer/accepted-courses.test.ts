/* دوراتُ المدرّبين المقبولين — قواعدُ الصفّ (`accepted-courses.ts`).

   ═══ ما يُحرَس ═══

   ① **ما لم يدخل الطابورَ يُقال** — الفقرةُ الحرّةُ القديمة، واقتراحُ الطلب
      الذي لا مقابلَ له. وهما العطبُ الذي وُضع له التقرير: كانا يغيبان بلا أثر.
   ② **وما دخله لا يُكرَّر ولا يُبعَث** — المبذورُ لا يُعاد صفّا ثانيا، وما
      أُعيدت تسميتُه أو حذفه صاحبُه لا يعود كأنّه لم يُبذَر.
   ③ **ومن لا بندَ له صفٌّ لا غياب.**
   ④ **والقوائمُ لا تفترق عن الخادم** — المفتوحُ هنا هو المفتوحُ في الطابور،
      والمقبولُ حالاتٌ موجودةٌ فعلا.

   والفحصُ على **الصفوف الخارجة** لا على نصّ الملفّ: تُبنى مدخلاتٌ ويُقرأ ما
   خرج. وما يحتاج قاعدةً — أنّ أفعالَ الأثر تُكتب حيث يقرؤها هذا — في
   `server/tests/reports/accepted-trainer-courses.test.ts`. */

import { describe, expect, it } from 'vitest'
import {
  ACCEPTED_TRAINER_STATUSES, ENDED_TRAINER_STATUSES, OPEN_PROPOSAL_STATUSES, PAST_TITLE_ACTIONS,
  PROPOSAL_STATUS_LABELS, SOURCE_LABELS, acceptedCourseRows, pastTitleFromAudit,
  type AcceptedTrainerIn, type CatalogLens, type QueueProposalIn,
} from '../../application/trainer/accepted-courses'
import { STATUS_LABELS } from '../../application/trainer/application-status'
import { DECIDED_PROPOSAL, OPEN_PROPOSAL } from '../../../server/services/course-proposal.service'
import { TRAINER_STATUSES } from '../../../server/services/trainer-application.service'

const CATALOG: Record<string, string> = {
  'C-DATA-101': 'تحليلُ البيانات بالجداول',
  'C-LEAD-201': 'قيادةُ الفرق',
}

/** عدسةٌ تسجّل من سُئل عنه أقربُ رمز — به يُعرف أين يُحسب الترشيح */
function lens(): CatalogLens & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    titleOf: (id) => CATALOG[id] ?? null,
    nearest: (p) => {
      asked.push(p.titleAr)
      return { courseId: 'C-LEAD-201', titleAr: CATALOG['C-LEAD-201'] }
    },
  }
}

const proposal = (over: Partial<QueueProposalIn>): QueueProposalIn => ({
  id: 'p-' + Math.random().toString(36).slice(2), titleAr: 'عنوان', summaryAr: null, status: 'submitted',
  courseId: null, questionAr: null, answerAr: null, decisionNoteAr: null, ...over,
})

const trainer = (over: Partial<AcceptedTrainerIn>): AcceptedTrainerIn => ({
  fullName: 'مدرّبٌ', reference: 'WJ-TR-2026-00001', status: 'conditionally_approved', infoRequestedFrom: null,
  teachableCourseIds: [], teachableOther: null, teachableProposals: null,
  profile: { proposals: [], qualifications: [], pastQueueTitles: [] },
  ...over,
})

const bySource = (rows: ReturnType<typeof acceptedCourseRows>, source: string) =>
  rows.filter((r) => r.source === source)

describe('④ القوائمُ لا تفترق عن الخادم', () => {
  it('المفتوحُ هنا هو المفتوحُ في الطابور — ولكلّ حالٍ لفظ', () => {
    /* لو افترقتا لحُسب أقربُ رمزٍ لمبتوتٍ فيه، أو سكت عن مفتوح */
    expect([...OPEN_PROPOSAL_STATUSES].sort()).toEqual([...OPEN_PROPOSAL].sort())
    for (const s of [...OPEN_PROPOSAL, ...DECIDED_PROPOSAL]) {
      expect(PROPOSAL_STATUS_LABELS[s], `حالُ اقتراحٍ بلا لفظ: ${s}`).toBeTruthy()
    }
  })

  it('المقبولُ حالاتٌ موجودةٌ فعلا — والموقوفُ والمردودُ والمنتظِرُ خارجُها', () => {
    for (const s of ACCEPTED_TRAINER_STATUSES) {
      expect((TRAINER_STATUSES as readonly string[]).includes(s), `حالةٌ لا وجودَ لها: ${s}`).toBe(true)
    }
    for (const s of ['suspended', 'rejected', 'withdrawn', 'waitlisted', 'under_review']) {
      expect((ACCEPTED_TRAINER_STATUSES as readonly string[]).includes(s), `${s} ليست قبولا`).toBe(false)
    }
    /* وما يُخرج صاحبَ الملفّ من الجرد حالاتٌ موجودةٌ كذلك، ولا تتقاطع مع القبول */
    for (const s of ENDED_TRAINER_STATUSES) {
      expect((TRAINER_STATUSES as readonly string[]).includes(s), `حالةٌ لا وجودَ لها: ${s}`).toBe(true)
      expect((ACCEPTED_TRAINER_STATUSES as readonly string[]).includes(s), `${s} قبولٌ ونهايةٌ معا`).toBe(false)
    }
  })
})

describe('⑤ ومقبولٌ تغيّر حالُه بعد قبوله يُقال لمَ هو في الجرد', () => {
  it('من طُلبت منه معلوماتٌ بعد قبوله: حالُه، والحالُ التي يعود إليها', () => {
    const [row] = acceptedCourseRows([trainer({ status: 'information_requested', infoRequestedFrom: 'onboarding' })], lens())
    expect(row.trainerStatus.startsWith(STATUS_LABELS.information_requested)).toBe(true)
    expect(row.trainerStatus, 'لم يُقل أين كان ولا إلى أين يعود').toContain(`«${STATUS_LABELS.onboarding}»`)
  })

  it('وحالٌ حيّةٌ أخرى وله ملفّ: يُقال إنّ ملفَّه من قبولٍ سابق — وحالُ القبول تُقرأ كما هي', () => {
    const [moved] = acceptedCourseRows([trainer({ status: 'under_review' })], lens())
    expect(moved.trainerStatus).toBe(`${STATUS_LABELS.under_review} — وله ملفُّ مدرّبٍ من قبولٍ سابق`)
    /* وبلا ملفٍّ لا يُدّعى قبولٌ سابق — ولو طُلبت منه معلوماتٌ قبل أن يُقبَل */
    const [early] = acceptedCourseRows([trainer({ status: 'information_requested', profile: null })], lens())
    expect(early.trainerStatus).toBe(STATUS_LABELS.information_requested)
    const [plain] = acceptedCourseRows([trainer({ status: 'active' })], lens())
    expect(plain.trainerStatus).toBe(STATUS_LABELS.active)
  })
})

describe('① ما لم يدخل الطابورَ يُقال', () => {
  it('الفقرةُ الحرّةُ صفٌّ واحدٌ كما كُتبت — ولو كان له اقتراحاتٌ في الطابور', () => {
    const free = 'دورة في الخطابة\nللموظفين الجدد\nدورة في كتابة التقارير'
    const rows = acceptedCourseRows([trainer({
      teachableOther: `  ${free}  `,
      profile: { proposals: [proposal({ titleAr: 'إدارةُ الوقت' })], qualifications: [], pastQueueTitles: [] },
    })], lens())
    const freeRows = bySource(rows, SOURCE_LABELS.freeText)
    expect(freeRows, 'غابت الفقرةُ الحرّة — وهي ما لم يدخل الطابورَ قطّ').toHaveLength(1)
    /* لا تُقسَم أسطرا: «للموظفين الجدد» جمهورُ ما قبلها لا عنوانُ دورة */
    expect(freeRows[0].title).toBe(free)
  })

  it('اقتراحُ الطلب بلا مقابلٍ في الطابور يُعرض — وما له مقابلٌ لا يُكرَّر', () => {
    const l = lens()
    const rows = acceptedCourseRows([trainer({
      teachableProposals: [
        /* مبذورٌ — والطابورُ يحمله بالتشكيل، والطلبُ بلا تشكيل: واحد */
        { titleAr: 'تحليل البيانات للمبتدئين', summaryAr: '' },
        /* أُضيف بعد إنشاء الملفّ فلم يُبذَر */
        { titleAr: 'إدارةُ المشاريع الرشيقة', summaryAr: 'لمدراء المشاريع' },
      ],
      profile: {
        proposals: [proposal({ titleAr: 'تحليلُ البيانات للمبتدئين' })],
        qualifications: [], pastQueueTitles: [],
      },
    })], l)
    const app = bySource(rows, SOURCE_LABELS.application)
    expect(app.map((r) => r.title), 'المبذورُ عاد صفّا ثانيا، أو غاب ما لم يُبذَر').toEqual(['إدارةُ المشاريع الرشيقة'])
    expect(app[0].summary).toBe('لمدراء المشاريع')
    expect(app[0].note).toContain('بعد إنشاء ملفّه')
    expect(app[0].nearest, 'ما لم يُصنَّف يُرشَّح له كما يُرشَّح في الطابور').toContain('C-LEAD-201')
  })

  it('ومن لا ملفَّ له تُعرض اقتراحاتُ طلبه كلُّها — ويُقال إنّه لا ملفَّ له', () => {
    const rows = acceptedCourseRows([trainer({
      profile: null,
      teachableProposals: [{ titleAr: 'الخطابةُ للقادة', audienceAr: 'مدراء' }, { titleAr: 'كتابةُ التقارير', summaryAr: '' }],
    })], lens())
    const app = bySource(rows, SOURCE_LABELS.application)
    expect(app.map((r) => r.title)).toEqual(['الخطابةُ للقادة', 'كتابةُ التقارير'])
    /* `audienceAr` مفتاحُ الطلبات القديمة — وسقوطُه يُفرغ نبذتَها صامتا */
    expect(app[0].summary).toBe('مدراء')
    for (const r of app) expect(r.note).toContain('لا ملفَّ')
  })
})

describe('② وما دخله لا يُكرَّر ولا يُبعَث', () => {
  it('ما أُعيدت تسميتُه أو حذفه صاحبُه لا يعود «لم يُبذَر»', () => {
    const rows = acceptedCourseRows([trainer({
      teachableProposals: [
        { titleAr: 'قيادةُ الفرق عن بُعد', summaryAr: '' },
        { titleAr: 'التسويقُ بالمحتوى', summaryAr: '' },
      ],
      profile: {
        proposals: [proposal({ titleAr: 'قيادةُ الفرق الموزّعة' })],
        qualifications: [],
        /* الأوّلُ اسمُه قبل التصحيح، والثاني حذفه صاحبُه من بوّابته */
        pastQueueTitles: ['قيادةُ الفرق عن بُعد', 'التسويقُ بالمحتوى'],
      },
    })], lens())
    expect(bySource(rows, SOURCE_LABELS.application), 'بُعث ما أُعيدت تسميتُه أو حُذف').toHaveLength(0)
  })

  it('أقربُ رمزٍ لما لم يُبتّ فيه وحدَه — والمبتوتُ تقول خانةُ «الدورة» ما صار إليه', () => {
    const l = lens()
    const rows = acceptedCourseRows([trainer({
      profile: {
        proposals: [
          proposal({ titleAr: 'مفتوحٌ ينتظر', status: 'submitted' }),
          proposal({ titleAr: 'سُئل صاحبُه', status: 'info_requested', questionAr: 'لمن هي؟', answerAr: 'للمبتدئين' }),
          proposal({ titleAr: 'مربوطٌ', status: 'linked', courseId: 'C-DATA-101' }),
          proposal({ titleAr: 'مرفوضٌ', status: 'rejected', decisionNoteAr: 'مكرّرةٌ مع دورةٍ قائمة' }),
        ],
        qualifications: [{ courseId: 'C-DATA-101', status: 'pending' }],
        pastQueueTitles: [],
      },
    })], l)
    expect(l.asked.sort()).toEqual(['سُئل صاحبُه', 'مفتوحٌ ينتظر'].sort())
    const linked = rows.find((r) => r.title === 'مربوطٌ')!
    expect(linked.nearest).toBe('—')
    expect(linked.course).toBe('C-DATA-101 — تحليلُ البيانات بالجداول')
    expect(linked.qualification).toBe('طلبُ تأهيلٍ ينتظر قرارَك')
    expect(rows.find((r) => r.title === 'سُئل صاحبُه')!.note).toBe('سُئل: لمن هي؟ · أجاب: للمبتدئين')
    expect(rows.find((r) => r.title === 'مرفوضٌ')!.note).toContain('مكرّرةٌ مع دورةٍ قائمة')
    /* والتأهيلُ على دورةٍ قيل حالُه في صفّها لا يُعاد صفّا ثانيا */
    expect(bySource(rows, SOURCE_LABELS.qualification)).toHaveLength(0)
  })

  it('ما اختاره من الكتالوج صفٌّ بحال تأهيله — والتأهيلُ على غيره صفٌّ مستقلّ', () => {
    const rows = acceptedCourseRows([trainer({
      teachableCourseIds: ['C-DATA-101', 'C-DATA-101', 'C-GONE-999'],
      profile: {
        proposals: [],
        qualifications: [{ courseId: 'C-DATA-101', status: 'pending' }, { courseId: 'C-LEAD-201', status: 'qualified' }],
        pastQueueTitles: [],
      },
    })], lens())
    const ticked = bySource(rows, SOURCE_LABELS.ticked)
    expect(ticked.map((r) => r.title), 'المكرَّرُ في الطلب صفّان').toEqual(['تحليلُ البيانات بالجداول', 'C-GONE-999'])
    expect(ticked[0].qualification).toBe('طلبُ تأهيلٍ ينتظر قرارَك')
    expect(ticked[1].course).toContain('لا دورةَ بهذا الرمز')
    expect(ticked[1].qualification).toBe('غيرُ مؤهَّلٍ بعد')
    const q = bySource(rows, SOURCE_LABELS.qualification)
    expect(q.map((r) => r.course)).toEqual(['C-LEAD-201 — قيادةُ الفرق'])
    expect(q[0].qualification).toBe('مؤهَّل')
  })
})

describe('③ ومن لا بندَ له صفٌّ لا غياب', () => {
  it('مقبولٌ لم يقترح ولم يختر ولم يُؤهَّل — صفٌّ واحدٌ يقول ذلك', () => {
    const rows = acceptedCourseRows([trainer({ fullName: 'بلا بنود' })], lens())
    expect(rows).toHaveLength(1)
    expect(rows[0].source).toBe(SOURCE_LABELS.nothing)
    expect(rows[0].trainerStatus).toBe('قبولٌ داخليّ — قيد التجهيز')
  })
})

describe('شكلُ الجدول', () => {
  it('كلُّ صفٍّ بالمفاتيح نفسِها وترتيبِها — فالأعمدةُ في التصدير لا تنزاح', () => {
    const rows = acceptedCourseRows([
      trainer({ fullName: 'ب', teachableOther: 'نصّ', teachableCourseIds: ['C-DATA-101'] }),
      trainer({ fullName: 'أ', profile: null, teachableProposals: [{ titleAr: 'عنوانٌ ما' }] }),
      trainer({ fullName: 'ج' }),
    ], lens())
    const keys = Object.keys(rows[0])
    for (const r of rows) expect(Object.keys(r)).toEqual(keys)
    /* والمدرّبون بترتيب أسمائهم */
    expect([...new Set(rows.map((r) => r.trainer))]).toEqual(['أ', 'ب', 'ج'])
  })
})

describe('العنوانُ الذي فارقه الاقتراحُ — من سطر الأثر', () => {
  it('كلُّ فعلٍ يُقرأ من موضعه — وما سواها لا يحمل عنوانا', () => {
    expect(pastTitleFromAudit({ action: PAST_TITLE_ACTIONS.ownerEdit, meta: null, before: { titleAr: ' قبلُ ' } })).toBe('قبلُ')
    expect(pastTitleFromAudit({ action: PAST_TITLE_ACTIONS.staffEdit, meta: { beforeTitleAr: 'قبلَ التصحيح' }, before: null })).toBe('قبلَ التصحيح')
    expect(pastTitleFromAudit({ action: PAST_TITLE_ACTIONS.ownerDelete, meta: { titleAr: 'المحذوف' }, before: null })).toBe('المحذوف')
    expect(pastTitleFromAudit({ action: 'trainer.course_proposal.link', meta: { titleAr: 'ليس فراقا' }, before: null })).toBe('')
    expect(pastTitleFromAudit({ action: PAST_TITLE_ACTIONS.ownerEdit, meta: null, before: 'ليس كائنا' })).toBe('')
  })
})
