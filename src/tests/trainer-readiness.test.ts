/* جاهزيّةُ المدرّب — الحكمُ وحدَه، بلا قاعدةِ بيانات.

   وهذه هي علّةُ كون `computeReadiness` دالّةً خالصةً: الخادمُ يمنع بها
   والشاشةُ تعرض بها، وما يُقرأ في موضعَين يُختبَر في موضعٍ واحدٍ سريع.

   ═══ وكلُّ حارسٍ هنا نُقض ما يحرسه مرّةً ليُرى وهو يسقط ═══

   لا يكفي أن يخضرّ: يُبنى مُدخلٌ تامٌّ أوّلا، ثمّ يُنقص منه ما تحرسه الحالةُ
   وحدَه — فلو لم يفحص الشرطَ فعلا لبقي أخضرَ وقد نُقض. */

import { describe, expect, it } from 'vitest'
import { APPLICANT_STATUS } from '../application/trainer/application-options'
import {
  computeReadiness, overrideReasonProblemAr, readinessBlockMessageAr,
  OVERRIDE_MIN_REASON, READINESS_STEPS,
  type ReadinessInput,
} from '../application/trainer/readiness'

const NOW = new Date('2026-09-20T10:00:00.000Z')
const YESTERDAY = new Date('2026-09-19T10:00:00.000Z')
const TOMORROW = new Date('2026-09-21T10:00:00.000Z')

/** مُدخلٌ تامُّ الخطوات — يُنقص منه في كلّ حالة */
const ready = (): ReadinessInput => ({
  compensationRules: [
    { type: 'per_seat', rate: 25, courseId: null, cohortId: null, effectiveFrom: YESTERDAY, effectiveTo: null },
  ],
  qualifiedCourses: 2,
  openProposals: 0,
  contracts: [{ status: 'signed' }],
  now: NOW,
})

const stepOf = (input: ReadinessInput, key: string) =>
  computeReadiness(input).steps.find((s) => s.key === key)!

describe('جاهزيّةُ المدرّب للقبول الكامل', () => {
  it('التامُّ جاهزٌ، وخطواتُه الثلاثُ خضراء', () => {
    const r = computeReadiness(ready())
    expect(r.ready).toBe(true)
    expect(r.blockersAr).toEqual([])
    expect(r.steps.map((s) => s.key)).toEqual([...READINESS_STEPS])
    expect(r.steps.every((s) => s.done)).toBe(true)
  })

  /* ─────────── ① الاتفاقُ الماليّ ─────────── */

  it('ولا جاهزيّةَ بلا اتّفاقٍ ماليّ', () => {
    expect(stepOf({ ...ready(), compensationRules: [] }, 'compensation').done).toBe(false)
    expect(computeReadiness({ ...ready(), compensationRules: [] }).ready).toBe(false)
  })

  it('وقاعدةٌ أُغلقت ليست سارية — فالمنتهيةُ لا تُحتسب', () => {
    const closed = ready()
    closed.compensationRules = [{
      type: 'per_seat', rate: 25, courseId: null, cohortId: null,
      effectiveFrom: new Date('2026-01-01'), effectiveTo: YESTERDAY,
    }]
    expect(stepOf(closed, 'compensation').done).toBe(false)
  })

  it('وقاعدةٌ يبدأ سريانُها غدا لا تُحتسب اليوم', () => {
    const future = ready()
    future.compensationRules = [{
      type: 'per_seat', rate: 25, courseId: null, cohortId: null,
      effectiveFrom: TOMORROW, effectiveTo: null,
    }]
    expect(stepOf(future, 'compensation').done).toBe(false)
  })

  /* ═══ وهذا هو الحارسُ الذي من أجله كُتب الملفّ كلُّه ═══

     `activeRule` تسقط إلى القاعدة العامّة حين لا قاعدةَ لشعبةٍ ولا لدورة.
     فمن له قاعدةُ دورةٍ واحدةٍ فحسب يُحسب أجرُه فيها، ويُرمى `no_rule` في
     كلّ ما عداها — و«مستحقّاتي» عنده صفرٌ ولا أحدَ يعلم لماذا. */
  it('وقاعدةُ دورةٍ وحدَها لا تكفي — العامّةُ هي التي تمنع «لا قاعدةَ سارية»', () => {
    const scoped = ready()
    scoped.compensationRules = [{
      type: 'per_seat', rate: 25, courseId: 'C-MKT-101', cohortId: null,
      effectiveFrom: YESTERDAY, effectiveTo: null,
    }]
    expect(stepOf(scoped, 'compensation').done).toBe(false)
  })

  it('وقاعدةٌ بأجرٍ صفرٍ ليست اتّفاقا', () => {
    const zero = ready()
    zero.compensationRules = [{
      type: 'per_seat', rate: 0, courseId: null, cohortId: null,
      effectiveFrom: YESTERDAY, effectiveTo: null,
    }]
    expect(stepOf(zero, 'compensation').done).toBe(false)
  })

  /* ─────────── ② المؤهّلاتُ والدورات ─────────── */

  it('ولا جاهزيّةَ بلا دورةٍ مؤهَّلٍ لها', () => {
    expect(stepOf({ ...ready(), qualifiedCourses: 0 }, 'qualifications').done).toBe(false)
  })

  /* ═══ والاقتراحُ غيرُ المصنَّف يُرى ولا يحبس ═══

     كاد يُجعل مانعا، وثلاثةٌ تنقضه: النظامُ يبذره بيده عند القبول الداخليّ،
     وتصنيفُه قد يعني إنشاءَ دورةٍ كاملةٍ في الكتالوج، والمدرّبُ يضيف غيرَه
     من بوّابته في اليوم التالي — فشرطٌ يُنقض غدا ليس شرطا. وتفصيلُه في رأس
     `noticeAr`. */
  it('واقتراحُ دورةٍ لم يُصنَّف يُرى ولا يحبس — والعددُ في نصّه', () => {
    const pending = { ...ready(), openProposals: 2 }
    const step = stepOf(pending, 'qualifications')
    expect(step.done, 'حبس اقتراحٌ غيرُ مصنَّفٍ اعتمادَ صاحبه').toBe(true)
    expect(computeReadiness(pending).ready).toBe(true)
    expect(step.noticeAr, 'لا يُقال شيءٌ عن اقتراحَين ينتظران').toContain('2')
  })

  it('ولا ملحوظةَ حين لا اقتراحَ ينتظر', () => {
    expect(stepOf(ready(), 'qualifications').noticeAr).toBeNull()
  })

  it('والملحوظةُ ليست مانعا — فلا تدخل قائمةَ ما ينقص', () => {
    const r = computeReadiness({ ...ready(), openProposals: 3 })
    expect(r.blockersAr).toEqual([])
  })

  /* ─────────── ③ العقد ─────────── */

  it('ولا جاهزيّةَ بلا عقدٍ وقّعه', () => {
    expect(stepOf({ ...ready(), contracts: [] }, 'contract').done).toBe(false)
  })

  it('والنافذُ يُعدّ كالموقَّع — فكلاهما يُثبت أنّه وقّع', () => {
    expect(stepOf({ ...ready(), contracts: [{ status: 'countersigned' }] }, 'contract').done).toBe(true)
  })

  it('وما لم يُوقَّع لا يُعدّ — مُرسَلا كان أو معتذَرا عنه أو ملغًى أو منقضيا', () => {
    for (const status of ['draft', 'sent', 'declined', 'revoked', 'expired', 'terminated']) {
      expect(
        stepOf({ ...ready(), contracts: [{ status }] }, 'contract').done,
        `«${status}» عُدّ توقيعا وليس توقيعا`,
      ).toBe(false)
    }
  })

  it('وعقدٌ فُسخ بعد نفاذه لا يُبقي الخطوةَ خضراءَ وحدَه — ويبقى الموقَّعُ إن وُجد معه', () => {
    expect(stepOf({ ...ready(), contracts: [{ status: 'terminated' }] }, 'contract').done).toBe(false)
    expect(
      stepOf({ ...ready(), contracts: [{ status: 'terminated' }, { status: 'countersigned' }] }, 'contract').done,
    ).toBe(true)
  })

  /* ─────────── رسالةُ المنع ─────────── */

  it('ورسالةُ المنع تعدّد ما ينقص بنصّه — لا «لا يمكن» وسكوت', () => {
    const none = computeReadiness({
      compensationRules: [], qualifiedCourses: 0, openProposals: 0, contracts: [], now: NOW,
    })
    expect(none.blockersAr).toHaveLength(3)
    const msg = readinessBlockMessageAr(none)
    for (const b of none.blockersAr) expect(msg).toContain(b)
  })
})

describe('تجاوزُ البوّابة — بابٌ ضيّقٌ بسببٍ مكتوب', () => {
  it('والفارغُ يُردّ', () => {
    expect(overrideReasonProblemAr('')).not.toBeNull()
    expect(overrideReasonProblemAr('   ')).not.toBeNull()
  })

  it('والقصيرُ يُردّ — «استثناء» لا تشرح شيئا لمن يقرؤها بعد شهر', () => {
    expect(overrideReasonProblemAr('استثناء')).not.toBeNull()
    expect(overrideReasonProblemAr('x'.repeat(OVERRIDE_MIN_REASON - 1))).not.toBeNull()
  })

  it('والمكتوبُ يمرّ', () => {
    expect(overrideReasonProblemAr('مدرّبةٌ نعرفها ونبدأ شعبتَها الأحد، ويُستكمَل عقدُها هذا الأسبوع')).toBeNull()
  })

  it('ولا يُحتسب الفراغُ طولا — مسافاتٌ ليست سببا', () => {
    expect(overrideReasonProblemAr(' '.repeat(OVERRIDE_MIN_REASON + 5))).not.toBeNull()
  })
})

/* ═══ وما يقرؤه المتقدّمُ في طور التجهيز ═══

   `conditionally_approved` صارت طورَ التجهيز الداخليّ: تُضبط فيها أتعابُه
   وتُصنَّف دوراتُه ويُركَّب عقدُه — وقد تنتهي بردٍّ لا بقبول. وكان نصُّها
   يقول له «قُبل طلبك مبدئيا» بنبرةٍ خضراء، فمن قرأه ثمّ رُدّ بعد أسبوعَين
   قُرئ عليه وعدٌ نقضناه نحن لا قرارٌ تغيّر.

   والفحصُ على المعنى لا على ورود حرف: نبرةٌ ليست `good`، ولا لفظَ قبولٍ في
   النصّ — فإعادةُ صياغةٍ تُبشّره تسقط هنا. */
describe('ولا يُبشَّر المتقدّمُ بقبولٍ لم يقع', () => {
  const view = APPLICANT_STATUS.conditionally_approved

  it('ونبرتُها ليست «good» — فالخضرةُ وعدٌ قبل أن تُقرأ الكلمات', () => {
    expect(view.tone).not.toBe('good')
  })

  it('ولا لفظَ قبولٍ في عنوانها ولا في شرحها', () => {
    const text = `${view.label} ${view.explain}`
    for (const word of ['قُبل', 'قبلنا', 'مبروك', 'تهانينا', 'اعتُمد', 'مبدئيا']) {
      expect(text, `تقول «${word}» — وهو وعدٌ قد يُنقَض`).not.toContain(word)
    }
  })

  it('وتقول أين طلبُه — لا تسكت عنه', () => {
    expect(view.explain.length).toBeGreaterThan(20)
  })
})
