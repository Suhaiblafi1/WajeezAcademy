/* السطرُ يقول «مقيس» حين بُنيت الخطّةُ على مستوى الاختبار — و«موصوف» حين لا.

   قرارُ صاحب المنصّة (الإصدارُ الثالث، ٨ أكتوبر ٢٠٢٦): «قُل إنّه مقيس» — فإن حدّث
   المتعلّمُ خطّتَه بمستوى الاختبار قال سطرُ مستواه «بناءً على اختبار تحديد المستوى
   المجانيّ»، وإن أبقى مستواه الموصوف بقي السطرُ على جوابه بنصّه.

   ⚠ أُثبت سقوطُه: (أ) عُلِّم السطرُ مقيسا بلا مقابلة المستويين فسقط الثاني والثالث،
   (ب) لم يُمرَّر المقيسُ إلى بناء النتيجة فسقط الثالث — ثمّ أُعيد كلٌّ فخضرّ. */

import { describe, expect, it } from 'vitest'
import { createEngineV21, Q } from '../../domain/diagnostic/v2_1'
import { ENGLISH_LEVELS, ENGLISH_PURPOSES } from '../../domain/diagnostic/v2_1/english'
import { levelLineText, levelSummaryOf } from '../../application/diagnostic/level-summary'
import { recommendationToDiagResult } from '../../application/diagnostic/view-model'
import type { LevelSummary } from '../../application/diagnostic/level-summary'

const facts = (level: string) => ({ need_id: { value: 'need_english' }, english_level: { value: level } })

function englishResult(level: string, measured: string | null) {
  const engine = createEngineV21(`measured-${level}`)
  for (let i = 0; i < 20; i++) {
    const step = engine.nextQuestion()
    if (step.stop.shouldStop || !step.question) break
    const q = step.question
    const label =
      q.question_id === Q.STAGE ? 'موظف في بداية مساري المهني'
      : q.question_id === Q.GOAL ? 'تطوير مهارة محددة أعرفها'
      : q.question_id === Q.NEED ? 'اللغة الإنجليزية'
      : q.question_id === Q.ENGLISH_PURPOSE ? ENGLISH_PURPOSES[0].label_ar
      : q.question_id === Q.ENGLISH_LEVEL ? ENGLISH_LEVELS.find((l) => l.code === level)!.label_ar
      : q.options_ar[0]
    const idx = q.options_ar.indexOf(label)
    engine.answer({ questionId: q.question_id, value: label, optionIds: [q.active_option_ids?.[idx] ?? `o${idx + 1}`] })
  }
  const st = engine.getState()
  return recommendationToDiagResult(engine.recommend(), st.skillVector, st.facts as never, st.factsRaw, st.interestVector, undefined, measured)
}

describe('سطرُ المستوى: مقيسٌ أم موصوف', () => {
  it('طابق المقيسُ مستوى الخطّة: «بناءً على اختبار تحديد المستوى»', () => {
    const s = levelSummaryOf(facts('b1'), 'b1')!
    expect(s.measured).toBe(true)
    expect(levelLineText(s).why_ar).toBe('بناءً على اختبار تحديد المستوى المجانيّ')
  })

  it('وخالفه (أبقى مستواه الموصوف) أو لم يُختبَر: السطرُ على جوابه بنصّه', () => {
    for (const m of ['a2', null]) {
      const s = levelSummaryOf(facts('b1'), m)!
      expect(s.measured, String(m)).toBeUndefined()
      expect(levelLineText(s).why_ar).toContain(ENGLISH_LEVELS[2].label_ar)
    }
  })

  it('والنتيجةُ المبنيّةُ تحمله — فيقرؤه سطرُ الخطّة وصفحةُ الدورة معا', () => {
    const tested = englishResult('a2', 'a2').resultJson.level_summary as LevelSummary
    expect(tested.measured).toBe(true)
    const kept = englishResult('a2', 'b1').resultJson.level_summary as LevelSummary
    expect(kept.measured).toBeUndefined()
  })

  it('ومستوى المجال لا يتأثّر بمقيس الإنجليزيّة', () => {
    const s = levelSummaryOf({ need_id: { value: 'need_data' }, field_level: { value: 'basics' } }, 'a1')!
    expect(s.measured).toBeUndefined()
  })
})
