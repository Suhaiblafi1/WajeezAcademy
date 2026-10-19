/* ═══ «مرآة وجيز» تصل التشخيص — وما بُذر لا يسقط بتعديل إجابة (١٩ أكتوبر ٢٠٢٦) ═══

   ① كانت المرآةُ تحفظ إجاباتها (`wajeez_mirror_v2`) ولا يقرؤها التشخيص، وهي تَعِد: «من أجاب هنا لا يُسأل
      في التشخيص». فصار `AssessmentSession` يبذر منها حقيقةَ وضوح الهدف وميولَ الأبعاد الستّة.
   ② وكان `rebuild` يمسح كلَّ ما بُذر عند أوّل تعديل إجابة — حقائقَ «مؤشر وجيز» كذلك. فصار البذرُ يُعاد قبل
      الإجابات، والإجابةُ الحقيقيّةُ تعلوه.

   والفحصُ على السلوك: محرّكٌ يُسأل ويُجاب، لا ورودُ اسمٍ في ملفّ. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEngineV21 } from '../../domain/diagnostic/v2_1'
import { questionById } from '../../domain/diagnostic/catalog'
import { RIASEC_DIMS } from '../../domain/diagnostic/v2_1/maps'
import { loadMirrorV2, MIRROR_V2_STORAGE_KEY } from '../../domain/diagnostic/mirror/bridge'

type Engine = ReturnType<typeof createEngineV21>

/** يجيب المحرّكَ حتّى يقف — ويعيد ما سُئل من بنود الميول (M5) */
function run(engine: Engine): string[] {
  const asked: string[] = []
  for (let i = 0; i < 40; i++) {
    const step = engine.nextQuestion()
    if (step.stop.shouldStop || !step.question) break
    const q = step.question
    if (questionById.get(q.question_id)?.module_id === 'M5') asked.push(q.question_id)
    const idx = q.answer_type === 'likert_5' || q.answer_type === 'skill_level_5' ? 2 : q.options_ar.length - 1
    engine.answer({ questionId: q.question_id, value: q.options_ar[idx], optionIds: [q.active_option_ids?.[idx] ?? `o${idx + 1}`] })
  }
  return asked
}

const ALL_DIMS = Object.fromEntries(RIASEC_DIMS.map((d) => [d, 4]))

describe('① ميولُ المرآة تُبذر فلا تُسأل', () => {
  it('⚠️ بلا بذرٍ يُسأل عن الميول — وببذر الأبعاد الستّة لا يُسأل عنها', () => {
    const plain = run(createEngineV21('mirror-plain'))
    expect(plain.length, 'المسارُ المختار لا يبلغ بنود الميول — فلا يثبت الفحصُ شيئا').toBeGreaterThan(0)
    const seeded = createEngineV21('mirror-seeded')
    seeded.seedInterests(ALL_DIMS, 'مرآة وجيز')
    expect(run(seeded)).toEqual([])
  })

  it('والبذرُ لا يدوس ميلا قائما', () => {
    const e = createEngineV21('mirror-keep')
    e.seedInterests({ [RIASEC_DIMS[0]]: 5 }, 'أوّل')
    e.seedInterests({ [RIASEC_DIMS[0]]: 2 }, 'ثانٍ')
    expect(e.getState().interestVector[RIASEC_DIMS[0]]).toBe(5)
  })

  it('والتشخيصُ يقرأ المرآة فعلا', () => {
    const svc = readFileSync(join(process.cwd(), 'src/application/diagnostic/assessment-service.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    /* والبذرُ تحت شرط المحفوظ وحدَه — لا شرطٌ آخرُ يُطفئه */
    expect(svc).toMatch(/const mirrorV2 = typeof window !== 'undefined' \? loadMirrorV2\(window\.localStorage\) : null\s*if \(mirrorV2\) \{/)
    expect(svc).toMatch(/this\.engine\.seedFacts\(mirrorFacts\(result\), 'مرآة وجيز'\)/)
    expect(svc).toMatch(/this\.engine\.seedInterests\(mirrorInterestVector\(result\), 'مرآة وجيز'\)/)
  })
})

describe('② وما بُذر يبقى بعد تعديل إجابة', () => {
  it('⚠️ الميولُ والحقائقُ المبذورةُ تعود بعد `popAnswer`', () => {
    const e = createEngineV21('mirror-rebuild')
    e.seedInterests(ALL_DIMS, 'مرآة وجيز')
    e.seedFacts({ goal_clarity: { value: 'high', sourceQuestionId: 'MIRROR-goal-clarity', evidenceQuality: 0.6 } }, 'مرآة وجيز')
    const step = e.nextQuestion()
    const q = step.question!
    e.answer({ questionId: q.question_id, value: q.options_ar[0], optionIds: [q.active_option_ids?.[0] ?? 'o1'] })
    e.popAnswer()
    const s = e.getState()
    for (const d of RIASEC_DIMS) expect(s.interestVector[d], d).toBe(4)
    expect(s.facts['goal_clarity']?.value).toBe('high')
  })
})

describe('③ قراءةُ المحفوظ', () => {
  const store = (raw: string | null) => ({ getItem: (k: string) => (k === MIRROR_V2_STORAGE_KEY ? raw : null) })
  it('الأرقامُ وحدَها — والتالفُ والفارغُ لا شيء', () => {
    expect(loadMirrorV2(store(JSON.stringify({ a: 4, b: 'x', c: 2 })))).toEqual({ a: 4, c: 2 })
    expect(loadMirrorV2(store('{bad'))).toBeNull()
    expect(loadMirrorV2(store('{}'))).toBeNull()
    expect(loadMirrorV2(store(null))).toBeNull()
  })
})
