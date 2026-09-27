/* شاشتا المتعلّم على خطّ المحاور — ما يراه فعلا (٢(ب-٢)).

   الحجبُ في الخادم (`learner-timeline-gate.test.ts`)، والقاعدةُ محضةٌ في
   `cohort-gate.test.ts`. وهنا **ما تعرضه الشاشةُ** ممّا يصلها: الخطُّ مواعيدَ
   بكرّاساتها، والمحجوبُ بموعده لا «قيد التأليف»، والمهمّةُ المحجوبةُ بلا
   نموذج، وبعد انتهاء الشعبة لا نموذجَ جديد. تُرسَم الشاشةُ رسما ساكنا
   (`renderToStaticMarkup`) كما تُرسَم أخواتُها هنا — فالحارسُ على ما يُعرض لا
   على حروفٍ في الملفّ. */

import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import type { EnrollmentDetail } from '@/services/enrollment-detail'
import type { JourneyStage } from '@/application/student/journey'

vi.mock('@/services/cohort-prices', () => ({ useCourseCohorts: () => ({ cohorts: new Map() }) }))
const { default: StageWork } = await import('@/components/journey/StageWork')

const stage = { courseId: 'C-T', titleAr: 'دورةُ الخطّ', hours: 0, percent: 0 } as unknown as JourneyStage
const handlers = { answers: {}, setAnswers: () => undefined, busy: null, onSubmit: () => undefined, onSubmitQuiz: () => undefined, onChanged: () => undefined }
const FUTURE = '2099-02-20T21:00:00.000Z'
const PAST = '2020-01-01T00:00:00.000Z'

function detail(over: { assessments?: unknown[]; submissions?: unknown[]; access?: EnrollmentDetail['access']; slots?: unknown[] } = {}): EnrollmentDetail {
  return {
    id: 'e-1', status: 'enrolled',
    cohort: {
      id: 'c-1', title: 'الشعبة', startsAt: null, course: { id: 'C-T', versions: [] }, trainers: [],
      sessions: [], materials: [], assessments: (over.assessments ?? []) as never,
      trainerPlan: {
        summaryAr: null,
        modules: [
          { moduleId: 'M1', titleAr: 'المحورُ المفتوح', bodyAr: '## درسٌ أوّل\nنصٌّ مكتوبٌ بما يكفي ليُعدّ درسا واحدا في هذه الوحدة.', locked: false, opensAt: PAST },
          { moduleId: 'M2', titleAr: 'المحورُ المحجوب', bodyAr: null, locked: true, opensAt: FUTURE },
        ],
        resources: [],
        slots: (over.slots ?? [
          { startsOn: '2020-01-01', endsOn: '2020-01-07', moduleIds: ['M1'], opensAt: PAST, closesAt: PAST, locked: false, hasWorkbook: true, workbook: { title: null, url: null, bodyFileKey: 'k-wb1', bodyFileName: 'wb.pdf', bodyFileMime: 'application/pdf' } },
          { startsOn: '2099-02-21', endsOn: '2099-02-27', moduleIds: ['M2'], opensAt: FUTURE, closesAt: FUTURE, locked: true, hasWorkbook: true, workbook: null },
        ]) as never,
      },
    },
    attendance: [], submissions: (over.submissions ?? []) as never, moduleProgress: [], courseProgress: null, certificates: [],
    access: over.access,
  } as unknown as EnrollmentDetail
}

const render = (d: EnrollmentDetail) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, createElement(StageWork, { stage, detail: d, full: null, request: null, handlers })))

const lockedQuiz = { id: 'q-locked', title: 'اختبارُ المحجوب', type: 'quiz', moduleId: 'M2', dueAt: null, maxScore: 10, briefAr: null, attachments: [], items: [], rubric: null, locked: true, opensAt: FUTURE }
const openTask = { id: 't-open', title: 'تطبيقُ المفتوح', type: 'assignment', moduleId: 'M1', dueAt: null, maxScore: 10, briefAr: 'اكتب خطّتك', attachments: null, items: [], rubric: null, locked: false, opensAt: PAST }

describe('خطُّ المواعيد في «الدروس»', () => {
  const html = render(detail({ assessments: [lockedQuiz] }))

  it('⚠️ الشعبةُ ذاتُ المواعيد تُقرأ مواعيدَ بتاريخيها', () => {
    expect(html).toContain('الموعد 1')
    expect(html).toContain('الموعد 2')
  })

  it('⚠️ والكرّاسةُ المفتوحةُ رابطُها من المسار المحروس — والمحجوبةُ يُقال متى', () => {
    expect(html).toContain('/api/v1/cohort-files/k-wb1')
    expect(html).toContain('كرّاستُه تُفتح أوّلَ يومٍ في موعده')
  })

  it('⚠️ والمحورُ المحجوبُ يُقال متى يُفتح — لا «قيد التأليف» ولا رابطَ إليه', () => {
    expect(html).toContain('يُفتح')
    expect(html).not.toContain('قيد التأليف')
    expect(html, 'رابطٌ إلى محورٍ محجوب').not.toContain('/module/M2')
    expect(html).toContain('/module/M1')
  })

  it('⚠️ ومهمّةُ المحور المحجوب تُذكر بموعد فتحها تحت موعدها', () => {
    expect(html).toContain('اختبارُ المحجوب')
    expect(html).toContain('بعد لقاء محورها')
  })
})

describe('«الواجبات» على الخطّ', () => {
  it('⚠️ المحجوبةُ بلا نموذجٍ ولا تعليمات — والمفتوحةُ بنموذجها', () => {
    /* الخادمُ يُفرغها أصلا؛ وتُعطى هنا أسئلةً وتعليماتٍ ليُرى أنّ الشاشةَ
       نفسَها لا ترسمها للمحجوبة — لا أنّها لم تجد ما ترسمه */
    const leaky = { ...lockedQuiz, briefAr: 'تعليماتٌ قبل أوانها', items: [{ id: 'i1', prompt: 'سؤالٌ قبل أوانه' }] }
    const html = render(detail({ assessments: [leaky, openTask] }))
    expect(html).toContain('سلّم الواجب')
    expect(html).toContain('اكتب خطّتك')
    expect(html, 'نموذجُ اختبارٍ محجوب').not.toContain('سلّم الاختبار')
    expect(html).not.toContain('سؤالٌ قبل أوانه')
    expect(html).not.toContain('تعليماتٌ قبل أوانها')
    expect(html).toContain('تُفتح بعد انتهاء أوّل لقاءٍ لمحورها')
  })

  it('⚠️ وبعد انتهاء الشعبة: الإعادةُ بطلبٍ وحدَها بنموذجها — والجديدةُ بلا نموذجٍ ويُقال لماذا', () => {
    /* والتبويبُ يُفتح على ما ينقصه — فالإعادةُ المطلوبةُ هي ما يفتح «الواجبات»
       هنا، وبدونها لا يُرسم التبويبُ أصلا فيمرّ «لا نموذج» بلا معنى */
    const access = { state: 'readonly' as const, closesAt: '2021-01-01T00:00:00.000Z', accessEndsAt: '2099-01-01T00:00:00.000Z' }
    const again = { id: 's-1', assessmentId: 't-again', status: 'resubmit_requested', reviewNote: 'أكمِل', submittedAt: '2020-12-01T00:00:00Z', grades: [], feedback: [] }
    const html = render(detail({ assessments: [openTask, { ...openTask, id: 't-again', title: 'مطلوبةٌ إعادتُه' }], submissions: [again], access, slots: [] }))
    expect(html).toContain('أعد التسليم')
    expect(html, 'نموذجُ تسليمٍ جديدٍ بعد انتهاء الشعبة').not.toContain('سلّم الواجب')
    expect(html).toContain('والتسليمُ يتوقّف بانتهائها')
    expect(html).toContain('انتهت هذه الشعبة')
  })

  it('⚠️ والمتأخّرُ يُعلَّم', () => {
    const late = { id: 's-2', assessmentId: 't-open', status: 'submitted', reviewNote: null, submittedAt: '2020-12-01T00:00:00Z', late: true, grades: [], feedback: [] }
    const html = render(detail({ assessments: [openTask, { ...openTask, id: 't-2', title: 'ثانٍ' }], submissions: [late], slots: [] }))
    expect(html).toContain('سُلّم متأخّرا')
  })
})

/* ═══ وشاشةُ الدراسة ═══

   تصلها الخطّةُ بعد أوّل رسمٍ بنداء (`useEffect`)، فالرسمُ الساكنُ لا يبلغ
   حالَها المحجوبة. فيُحرس ترتيبُها في الشيفرة نفسِها بعد نزع التعليقات: لا
   تُرسم قبل وصول الخطّة، والمحجوبُ يُردّ قبل أن يُسأل عن متنٍ أو ملفّ. */
describe('شاشةُ الدراسة لا تعرض المحجوب', () => {
  const src = readFileSync(join(process.cwd(), 'src/pages/student/ModuleStudy.tsx'), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

  it('⚠️ لا متنَ يُرسم قبل أن تصل الخطّة — فلا يومض المحجوبُ ثمّ يُطوى', () => {
    expect(src).toMatch(/if \(!checked \|\| planPending\)/)
    expect(src).toMatch(/const planPending = enrollmentId !== "" && planFor !== enrollmentId/)
  })

  it('⚠️ والمحجوبُ يُردّ قبل الملفّ وقبل «قيد التأليف»', () => {
    const locked = src.indexOf('if (mod.locked) {')
    expect(locked, 'لا فرعَ للمحجوب').toBeGreaterThan(-1)
    expect(locked).toBeLessThan(src.indexOf('if (!mod.body?.trim() && mod.bodyFileKey)'))
    expect(locked).toBeLessThan(src.indexOf('if (!mod.body?.trim()) {'))
  })
})
