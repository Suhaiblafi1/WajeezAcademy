/* بابُ الإنجليزيّة — قراراتُ صاحب المنصّة (٨ أكتوبر ٢٠٢٦) محروسةً بالجدول والرحلة.

   ١) الجدول: كلُّ غرضٍ ومستوى يعطي ما قُرِّر — المبتدئُ بغرضٍ يُعرض عليه
      الخياران، والمتقدّمُ يُوجَّه إلى دورة غرضٍ لا إلى ما دون مستواه.
   ٢) الرحلة: سؤالان بعد الاحتياج ثمّ تقف — لا وضوحَ هدف، ولا قطاع، ولا
      مهاراتِ مساراتٍ لن تُرشَّح — والنتيجةُ دورةٌ واحدةٌ بخطّتها.
   ٣) والتوصيةُ تُسمّى بوجهتها: المبتدئُ الذي يريد العملَ والذي يريد الاختبارَ
      ليسا «المستوى الأوّل» كلاهما.

   ⚠ أُثبت سقوطُه: (أ) أُعطي المبتدئُ بغرض العمل خيارا واحدا فسقط ١، (ب) نُزع
   شرطُ `isRouted` عن سؤال القطاع فسقط ٢، (ج) سُمّيت التوصيةُ بأوّل دورةٍ لا
   بوجهتها فسقط ٣ — ثمّ أُعيد كلٌّ فخضرّ. */

import { describe, expect, it } from 'vitest'
import { createEngineV21, Q } from '../../../domain/diagnostic/v2_1'
import {
  ENGLISH_COURSES as C,
  ENGLISH_LEVELS,
  ENGLISH_PURPOSES,
  englishDestinationOf,
  englishPlanOf,
  type EnglishLevel,
  type EnglishPurpose,
} from '../../../domain/diagnostic/v2_1/english'
import { courseById } from '../../../domain/diagnostic/catalog'

const ids = (p: ReturnType<typeof englishPlanOf>) => p.options.map((o) => o.course_ids.join('+'))

describe('١) جدولُ الإنجليزيّة كما قرّره صاحبُ المنصّة', () => {
  it('كلُّ دورةٍ في الجدول موجودةٌ في الكتالوج — لا معرّفَ يتيم', () => {
    for (const id of Object.values(C)) expect(courseById.get(id), id).toBeDefined()
  })

  it('الحديثُ اليوميّ: الأوّلُ لمن يبدأ، والثاني لمن يملك الأساس', () => {
    expect(ids(englishPlanOf('general', 'a1'))).toEqual([C.general1])
    expect(ids(englishPlanOf('general', 'a2'))).toEqual([C.general2])
    expect(ids(englishPlanOf('general', 'b1'))).toEqual([C.general2])
  })

  it('والمتقدّمُ فوق دوراتنا العامّة: يُقال له ذلك، ويُعرض ما يضيف إليه لا ما دونه', () => {
    for (const lvl of ['b2', 'c1'] as EnglishLevel[]) {
      const p = englishPlanOf('general', lvl)
      expect(p.above_general).toBe(true)
      expect(ids(p)).toEqual([C.business, C.exam2])
      expect(p.options.flatMap((o) => o.course_ids)).not.toContain(C.general1)
      expect(p.options.flatMap((o) => o.course_ids)).not.toContain(C.general2)
    }
  })

  it('المبتدئُ بغرض العمل يُعرض عليه الخياران معا — والفرقُ مكتوبٌ لكلٍّ منهما', () => {
    const p = englishPlanOf('work', 'a1')
    expect(ids(p)).toEqual([`${C.general1}+${C.business}`, C.business])
    expect(p.options.filter((o) => o.suggested)).toHaveLength(1)
    for (const o of p.options) expect(o.difference_ar.length).toBeGreaterThan(20)
    /* ومن يملك الحديثَ اليوميّ يدخل دورةَ غرضه مباشرةً */
    for (const lvl of ['a2', 'b1', 'b2', 'c1'] as EnglishLevel[]) expect(ids(englishPlanOf('work', lvl))).toEqual([C.business])
  })

  it('والاختبارُ كذلك: الأساسُ أوّلا للمبتدئ، والمستوى الثاني للدرجات العليا', () => {
    expect(ids(englishPlanOf('exam', 'a1'))).toEqual([`${C.general1}+${C.exam1}`, C.exam1])
    expect(ids(englishPlanOf('exam', 'a2'))).toEqual([`${C.general2}+${C.exam1}`, C.exam1])
    expect(ids(englishPlanOf('exam', 'b1'))).toEqual([C.exam1])
    expect(ids(englishPlanOf('exam', 'b2'))).toEqual([C.exam2])
    expect(ids(englishPlanOf('exam', 'c1'))).toEqual([C.exam2])
  })

  it('وكلُّ خطّةٍ تقول إنّ اختبارَ التحديد المجانيّ يحسم المستوى', () => {
    for (const p of ENGLISH_PURPOSES)
      for (const l of ENGLISH_LEVELS) expect(englishPlanOf(p.code, l.code).placement_note_ar).toContain('اختبار')
  })
})

/* ─── رحلةٌ حقيقيّةٌ في المحرّك ─── */
function journey(stage: string, purpose: EnglishPurpose, level: EnglishLevel) {
  const engine = createEngineV21(`eng-${purpose}-${level}`)
  const asked: string[] = []
  for (let i = 0; i < 20; i++) {
    const step = engine.nextQuestion()
    if (step.stop.shouldStop || !step.question) break
    const q = step.question
    asked.push(q.question_id)
    let label: string
    if (q.question_id === Q.STAGE) label = stage
    else if (q.question_id === Q.GOAL) label = 'تطوير مهارة محددة أعرفها'
    else if (q.question_id === Q.NEED) label = 'اللغة الإنجليزية'
    else if (q.question_id === Q.ENGLISH_PURPOSE) label = ENGLISH_PURPOSES.find((p) => p.code === purpose)!.label_ar
    else if (q.question_id === Q.ENGLISH_LEVEL) label = ENGLISH_LEVELS.find((l) => l.code === level)!.label_ar
    else label = q.options_ar[0]
    const idx = q.options_ar.indexOf(label)
    expect(idx, `${q.question_id}: «${label}» ليس بين الخيارات`).toBeGreaterThanOrEqual(0)
    engine.answer({ questionId: q.question_id, value: label, optionIds: [q.active_option_ids?.[idx] ?? `o${idx + 1}`] })
  }
  return { engine, asked, rec: engine.recommend() }
}

describe('٢) الرحلة: سؤالان بعد الاحتياج ثمّ تقف', () => {
  it('لا يُسأل بعدهما ما يغذّي سباقا لن يُقرَأ', () => {
    const { asked } = journey('موظف ذو خبرة', 'work', 'b1')
    const afterNeed = asked.slice(asked.indexOf(Q.NEED) + 1)
    expect(afterNeed).toEqual([Q.ENGLISH_PURPOSE, Q.ENGLISH_LEVEL])
  })

  it('والنتيجةُ دورةٌ واحدةٌ بخطّتها — ولا جولةَ تدقيقٍ ولا شبكةَ عائلات', () => {
    const { engine, rec } = journey('مدير / قائد فريق', 'general', 'a2')
    expect(rec.kind).toBe('single_course')
    expect(rec.primaryPathway?.pathwayId).toBe(C.general2)
    expect(rec.english?.cefr).toBe('A2')
    expect(engine.startDeepening()).toBeNull()
    expect(engine.familiesToRate()).toEqual([])
  })
})

describe('٣) التوصيةُ تُسمّى بوجهتها لا بأوّل خطوة', () => {
  it('المبتدئُ: العملُ والاختبارُ والحديثُ اليوميّ ثلاثُ توصياتٍ لا واحدة', () => {
    const named = (['general', 'work', 'exam'] as EnglishPurpose[]).map(
      (p) => journey('موظف في بداية مساري المهني', p, 'a1').rec.primaryPathway?.pathwayId,
    )
    expect(named).toEqual([C.general1, C.business, C.exam1])
    expect(englishDestinationOf(englishPlanOf('work', 'a1'))).toBe(C.business)
  })
})
