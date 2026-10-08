/* النتيجةُ تقول المستوى وسببَه وبابَ تعديله — وخطّةُ الإنجليزيّة بخياريها تبقى شاشة.

   قراراتُ صاحب المنصّة (٨ أكتوبر ٢٠٢٦): «المستوى + السبب + التعديل»، و«اعرض
   الخيارين، ويختار هو». فيُحرس هنا:
     ١) سطرُ المستوى يُبنى من الحقائق بنصّ الجواب الذي اختاره.
     ٢) رابطُ التعديل يُقرأ لسؤالَي المستوى وحدَهما — وما سواه يُتجاهَل.
     ٣) خطّةٌ بخيارين لا تهبط على صفحة دورةٍ واحدة تختار عنه، وتبقى محفوظةً.
     ٤) وسطرُ المستوى في صفحة الدورة لنتيجةٍ قادت إليها وحدَها.

   ⚠ أُثبت سقوطُه: (أ) نُزع فحصُ `englishChoiceOf` من `singleCourseOf` فسقط ٣،
   (ب) قُبل في الرابط أيُّ سؤال فسقط ٢ — ثمّ أُعيد كلٌّ فخضرّ. */

import { describe, expect, it } from 'vitest'
import { createEngineV21, Q } from '../../domain/diagnostic/v2_1'
import { ENGLISH_LEVELS, ENGLISH_PURPOSES } from '../../domain/diagnostic/v2_1/english'
import { FIELD_LEVELS } from '../../domain/diagnostic/v2_1/focus'
import {
  levelLabelOf,
  levelSummaryForCourse,
  levelSummaryOf,
  parseReviseRequest,
  reviseLevelHref,
} from '../../application/diagnostic/level-summary'
import { englishChoiceOf, singleCourseOf } from '../../application/diagnostic/landing'
import { recommendationToDiagResult } from '../../application/diagnostic/view-model'
import { readStoredResult, wrapResultForStorage } from '../../application/diagnostic/result-schema'

function englishResult(purpose: string, level: string) {
  const engine = createEngineV21(`res-${purpose}-${level}`)
  for (let i = 0; i < 20; i++) {
    const step = engine.nextQuestion()
    if (step.stop.shouldStop || !step.question) break
    const q = step.question
    const label =
      q.question_id === Q.STAGE ? 'موظف في بداية مساري المهني'
      : q.question_id === Q.GOAL ? 'تطوير مهارة محددة أعرفها'
      : q.question_id === Q.NEED ? 'اللغة الإنجليزية'
      : q.question_id === Q.ENGLISH_PURPOSE ? ENGLISH_PURPOSES.find((p) => p.code === purpose)!.label_ar
      : q.question_id === Q.ENGLISH_LEVEL ? ENGLISH_LEVELS.find((l) => l.code === level)!.label_ar
      : q.options_ar[0]
    const idx = q.options_ar.indexOf(label)
    engine.answer({ questionId: q.question_id, value: label, optionIds: [q.active_option_ids?.[idx] ?? `o${idx + 1}`] })
  }
  const st = engine.getState()
  return recommendationToDiagResult(engine.recommend(), st.skillVector, st.facts as never, st.factsRaw, st.interestVector)
}

describe('١) سطرُ المستوى', () => {
  it('من المستوى في المجال: اسمُ المجال، والمستوى، والجوابُ بنصّه', () => {
    const s = levelSummaryOf({
      need_id: { value: 'need_data' },
      field_level: { value: 'independent' },
    })!
    expect(s.question_id).toBe(Q.FIELD_LEVEL)
    expect(s.field_ar).toBe('تحليل البيانات واتخاذ القرار')
    expect(s.level_name_ar).toBe(FIELD_LEVELS[2].name_ar)
    expect(s.answer_ar).toBe(FIELD_LEVELS[2].label_ar)
    expect(s.current_option_id).toBe('o3')
    expect(s.options).toHaveLength(4)
  })

  it('ومن الإنجليزيّة: CEFR ووصفُه', () => {
    const r = englishResult('general', 'a2')
    const s = r.resultJson.level_summary as ReturnType<typeof levelSummaryOf>
    expect(s?.question_id).toBe(Q.ENGLISH_LEVEL)
    expect(s?.level_name_ar).toBe('A2')
  })
})

describe('٢) رابطُ التعديل', () => {
  it('يُبنى ويُقرأ لسؤالَي المستوى — وما سواهما يُتجاهَل', () => {
    const href = reviseLevelHref(Q.FIELD_LEVEL, 'o2')
    const params = new URLSearchParams(href.split('?')[1])
    expect(parseReviseRequest(params)).toEqual({ questionId: Q.FIELD_LEVEL, optionId: 'o2' })
    expect(parseReviseRequest(new URLSearchParams('revise=QC-N3-001&to=o2'))).toBeNull()
    expect(parseReviseRequest(new URLSearchParams(`revise=${Q.FIELD_LEVEL}&to=x1`))).toBeNull()
    expect(levelLabelOf(Q.ENGLISH_LEVEL, 'o1')).toBe(ENGLISH_LEVELS[0].label_ar)
    expect(levelLabelOf(Q.FIELD_LEVEL, 'o9')).toBeNull()
  })
})

describe('٣) خطّةُ الإنجليزيّة بخياريها شاشةٌ لا هبوط', () => {
  it('المبتدئُ بغرض العمل: يبقى ليختار — والمحفوظةُ تُقرأ', () => {
    const r = englishResult('work', 'a1')
    expect(englishChoiceOf(r.resultJson)?.options).toHaveLength(2)
    expect(singleCourseOf(r.resultJson)).toBeNull()
    expect(readStoredResult(wrapResultForStorage(r)).status).toBe('ok')
  })

  it('ومن له خيارٌ واحدٌ بدورةٍ واحدة يهبط على صفحتها', () => {
    const r = englishResult('exam', 'b1')
    expect(englishChoiceOf(r.resultJson)).toBeNull()
    expect(singleCourseOf(r.resultJson)).toBe('C-COMX-113')
  })
})

describe('٤) سطرُ المستوى في صفحة الدورة', () => {
  it('لدورةٍ قادت إليها النتيجة — أو أحدِ خياري خطّتها — لا لغيرها', () => {
    const r = englishResult('work', 'a1')
    expect(levelSummaryForCourse('C-COMX-111', r.resultJson)).not.toBeNull()
    expect(levelSummaryForCourse('C-COMX-106', r.resultJson)).not.toBeNull()
    expect(levelSummaryForCourse('C-CYB-106', r.resultJson)).toBeNull()
  })
})
