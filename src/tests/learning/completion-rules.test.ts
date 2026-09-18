/* قاعدةُ الدورة أرضيّةٌ لا تُمحى بقاعدةِ شعبة (ك-١٤).

   العطب: `evaluateCompletion` كانت تقول `cohortRules.length ? cohortRules :
   courseRules` — فقاعدةٌ واحدةٌ تُضاف على شعبةٍ **تُسقط قواعدَ الدورة كلَّها**.
   من كتب على شعبةٍ «محورٌ واحدٌ مكتمل» أسقط معه شرطَ الحضور وشرطَ التكاليف
   وشرطَ التقييم، بلا أن يقصد ولا أن يُقال له.

   فتصير «شهادة من وجيز» عن الرمز نفسِه تعني شيئا في شعبةٍ وشيئا في جارتها.

   والفحصُ على القسمة نفسِها — وحدةٌ نقيّةٌ بلا قاعدةِ بيانات، فالحالاتُ
   تُستوفى هنا ولا تُختبَر بجولةِ خادمٍ لكلّ واحدة. وللأثر الحقيقيِّ اختبارُه
   في `server/tests/learning`. */

import { describe, expect, it } from 'vitest'
import { DEFAULT_COMPLETION_RULES, resolveCompletionRules } from '../../application/learning/completion-rules'

const rule = (type: string, threshold: number, required = true) => ({ type, threshold, required })

describe('قواعدُ الإكمال تُدمج ولا تُستبدَل', () => {
  it('قاعدةُ شعبةٍ واحدةٌ لا تُسقط قواعدَ الدورة — وهو العطبُ بعينه', () => {
    const course = [rule('attendance_pct', 70), rule('assignment_accepted', 2), rule('assessment_passed', 1)]
    const cohort = [rule('modules_completed', 1)]
    const out = resolveCompletionRules(course, cohort)
    const types = out.map((r) => r.type).sort()
    expect(types).toEqual(['assessment_passed', 'assignment_accepted', 'attendance_pct', 'modules_completed'])
    /* والقديمُ كان يعيد نوعا واحدا — فلو عاد الاستبدالُ سقط هذا الصفّ */
    expect(out).toHaveLength(4)
  })

  it('والشعبةُ تُشدِّد: الأعلى يفوز', () => {
    const out = resolveCompletionRules([rule('attendance_pct', 70)], [rule('attendance_pct', 90)])
    expect(out).toEqual([{ type: 'attendance_pct', threshold: 90, source: 'tightened' }])
  })

  it('ولا تُرخي: الأدنى لا يفوز', () => {
    const out = resolveCompletionRules([rule('attendance_pct', 80)], [rule('attendance_pct', 40)])
    expect(out).toEqual([{ type: 'attendance_pct', threshold: 80, source: 'course' }])
  })

  it('ونوعٌ تعرفه الشعبةُ وحدَها يسري', () => {
    const out = resolveCompletionRules([rule('attendance_pct', 70)], [rule('project_accepted', 1)])
    expect(out.find((r) => r.type === 'project_accepted')).toEqual(
      { type: 'project_accepted', threshold: 1, source: 'cohort' },
    )
  })

  /* البابُ الوحيدُ إلى الإرخاء — صريحٌ ومكتوبٌ في صفٍّ يبقى */
  it('والإسقاطُ الصريحُ يرفع النوعَ عن هذه الشعبة وحدَها', () => {
    const course = [rule('attendance_pct', 80), rule('assignment_accepted', 2)]
    const cohort = [rule('attendance_pct', 0, false)]
    const out = resolveCompletionRules(course, cohort)
    expect(out.map((r) => r.type)).toEqual(['assignment_accepted'])
  })

  it('والإسقاطُ يعلو التشديدَ لو كُتبا معا — الصريحُ أولى', () => {
    const out = resolveCompletionRules(
      [rule('attendance_pct', 80)],
      [rule('attendance_pct', 95), rule('attendance_pct', 0, false)],
    )
    expect(out).toEqual([])
  })

  /* `setCompletionRule` تُنشئ ولا تُحدّث — فالنوعُ يتكرّر في القاعدة فعلا */
  it('وتكرارُ النوع يُؤخَذ بأشدّه لا بأوّله ولا بآخره', () => {
    const out = resolveCompletionRules(
      [rule('modules_completed', 3), rule('modules_completed', 8), rule('modules_completed', 5)],
      [],
    )
    expect(out).toEqual([{ type: 'modules_completed', threshold: 8, source: 'course' }])
  })

  it('وغيرُ اللازم على الدورة لا يصير لازما بالدمج', () => {
    const out = resolveCompletionRules([rule('attendance_pct', 70, false)], [])
    expect(out).toEqual([])
  })

  /* ═══ نُقض بقرارٍ لا بتنازل (م٤ · ١٧ سبتمبر ٢٠٢٦) ═══

     كان هنا: «ولا قواعدَ يعني لا شرطَ — لا شرطا مُختلَقا». وعلّتُه وجيهةٌ
     في ظاهرها: لا تُخترَع قاعدةٌ لم يكتبها أحد.

     لكنّ القراءةَ الأخرى أثقل: `evaluateCompletion` تحكم «تمّ إن لم يسقط
     شرط»، فلا شرطَ تعني **الشهادةُ لكلّ ملتحق** — حضر أو لم يحضر، سلّم أو
     لم يسلّم. وذاك اختراعُ إذنٍ لم يكتبه أحدٌ كذلك، وهو أخطرُ: الشهادةُ
     الدعوى الوحيدةُ التي لا تحتمل المرونة.

     فصار الصمتُ يملؤه حدٌّ أدنى مكتوبٌ في موضعٍ واحد، والقولُ يعلوه. */
  it('⚠️ ولا قواعدَ يملؤها حدٌّ أدنى — ولا تعني الشهادةَ لكلّ ملتحق', () => {
    expect(resolveCompletionRules([], [])).toEqual([...DEFAULT_COMPLETION_RULES])
    /* والحدُّ مهمّةٌ واحدةٌ مقبولة — لا حضورٌ ولا نسبة */
    expect(DEFAULT_COMPLETION_RULES).toEqual([
      { type: 'assignment_accepted', threshold: 1, source: 'default' },
    ])
  })

  it('⚠️ والافتراضيُّ يملأ الصمتَ لا يعلو القول — إسقاطٌ صريحٌ يبقى إسقاطا', () => {
    /* من أسقط نوعا صراحةً قرّر وبقي قرارُه في السجلّ. ولو عاد الافتراضيُّ
       فوقه لصار البابُ الوحيدُ إلى الإرخاء مغلقا من حيث لا يُرى. */
    expect(resolveCompletionRules([rule('assignment_accepted', 1, false)], [])).toEqual([])
    expect(resolveCompletionRules([], [rule('assignment_accepted', 1, false)])).toEqual([])
  })

  it('ولا يُزاحم الافتراضيُّ قاعدةً مكتوبةً من أيّ جهة', () => {
    expect(resolveCompletionRules([rule('attendance_pct', 70)], []))
      .toEqual([{ type: 'attendance_pct', threshold: 70, source: 'course' }])
    expect(resolveCompletionRules([], [rule('attendance_pct', 70)]))
      .toEqual([{ type: 'attendance_pct', threshold: 70, source: 'cohort' }])
  })
})
