/* ═══ مستوى الشعبة — مدًى متّصلٌ من مبتدئ إلى متقدّم (٦ أكتوبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: «سؤالٌ لكلّ شعبةٍ يسأل المدرّبَ عن مستوى هذه الدورة — من
   المبتدئين إلى المتقدّمين». واختار من الخيارات المعروضة: **مدًى** لا مستوًى
   واحد، و**إلزاميٌّ ما دامت الخطّةُ في يد المدرّب**، و**يراه المدرّبُ
   والمعتمِدُ وحدَهما**.

   وما يُحرس هنا أربعة:
     ① القاعدةُ المحضة: المدى مرتَّبٌ متّصل، والنقرُ لا يصنع ثغرة.
     ② والمخطّطُ يحمله — وإلّا اختاره المدرّبُ ولم يُحفظ (المخطّطُ يُسقط الزائدَ صامتا).
     ③ والشاشةُ تنقر بالقاعدة نفسِها، وتسمّي ما ينقص بها.
     ④ والمعتمِدُ يقرؤه — في رأس المراجعة، وفي المنهج، وفيما تغيّر عن المعتمَد.

   وإلزامُه بحال الخطّة مفحوصٌ على `buildChecklist` نفسِها في
   `cohort-term-and-sessions.test.ts` (① الهُويّة). والفحصُ على البنية لا على
   ورودِ حرفٍ في تعليق: التعليقاتُ تُنزع قبل المطابقة. */
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  COHORT_LEVELS, asLevelRange, levelProblem, levelRangeAr, levelRequired, levelsIn, toggleLevel, type LevelRange,
} from '@/application/trainer/cohort-level'
import { curriculumView } from '@/application/trainer/curriculum-view'
import { planDiff } from '@/application/trainer/plan-diff'
import CurriculumReview from '@/components/CurriculumReview'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const B = 'beginner' as const
const I = 'intermediate' as const
const A = 'advanced' as const
const r = (from: LevelRange['from'], to: LevelRange['to']): LevelRange => ({ from, to })

describe('① المدى — مرتّب متّصل', () => {
  it('ثلاثة مستويات بترتيبها: من المبتدئ إلى المتقدّم', () => {
    expect([...COHORT_LEVELS]).toEqual([B, I, A])
  })

  it('⚠️ يقرأ المدى الصالح، ويرتّب طرفاه إن انقلبا', () => {
    expect(asLevelRange({ from: B, to: I })).toEqual(r(B, I))
    expect(asLevelRange({ from: A, to: B }), 'مدى مقلوب لم يرتّب').toEqual(r(B, A))
  })

  it('⚠️ وما ليس مدى يقرأ غيابا — لا مستوى مخترع ولا طرف واحد ولا نصّ', () => {
    for (const bad of [null, undefined, 'beginner', { from: B }, { from: 'expert', to: A }, { from: B, to: 3 }]) {
      expect(asLevelRange(bad), `قرئ «${JSON.stringify(bad)}» مستوى`).toBeNull()
    }
  })

  it('والمستويات داخله بترتيبها — والمتقدّم مع المبتدئ يأخذ الأوسط', () => {
    expect(levelsIn(r(B, A))).toEqual([B, I, A])
    expect(levelsIn(r(I, I))).toEqual([I])
    expect(levelsIn(null)).toEqual([])
  })

  it('ويقال بجملة: مستوى واحد باسمه، والمدى «من … إلى …»', () => {
    expect(levelRangeAr(r(I, I))).toBe('متوسّط')
    expect(levelRangeAr(r(B, I))).toBe('من مبتدئ إلى متوسّط')
    expect(levelRangeAr(null)).toBeNull()
  })
})

describe('① والنقر على البطاقة لا يصنع ثغرة', () => {
  it('أوّل نقرة تختار مستوى واحدا', () => {
    expect(toggleLevel(null, I)).toEqual(r(I, I))
  })

  it('⚠️ ونقر ما خارج المدى يمدّه إليه — «مبتدئ» ثمّ «متقدّم» تأخذ الثلاثة', () => {
    expect(toggleLevel(r(B, B), A), 'بقيت ثغرة في الوسط').toEqual(r(B, A))
    expect(toggleLevel(r(I, I), B)).toEqual(r(B, I))
  })

  it('وطرف المدى ينزع منه — والوحيد ينزع فلا يبقى شيء', () => {
    expect(toggleLevel(r(B, A), B)).toEqual(r(I, A))
    expect(toggleLevel(r(B, A), A)).toEqual(r(B, I))
    expect(toggleLevel(r(I, I), I)).toBeNull()
  })

  it('⚠️ وأوسط الثلاثة يصير وحده — نزعه يقطع المدى', () => {
    const next = toggleLevel(r(B, A), I)
    expect(next).toEqual(r(I, I))
  })

  it('⚠️ ولا نقرة — في أيّ حال وعلى أيّ بطاقة — تخرج مدى مقطوعا', () => {
    const states: (LevelRange | null)[] = [null]
    for (const f of COHORT_LEVELS) for (const t of COHORT_LEVELS) if (COHORT_LEVELS.indexOf(f) <= COHORT_LEVELS.indexOf(t)) states.push(r(f, t))
    for (const s of states) {
      for (const lv of COHORT_LEVELS) {
        const out = toggleLevel(s, lv)
        if (out) expect(asLevelRange(out), `${JSON.stringify(s)} + ${lv}`).toEqual(out)
      }
    }
  })
})

describe('① والإلزام بحال الخطّة', () => {
  it('⚠️ في يده — مسودّة أو مردودة — يطالب به', () => {
    expect(levelRequired('draft')).toBe(true)
    expect(levelRequired('changes_requested'), 'ردّت إليه فلم يطالب').toBe(true)
    expect(levelProblem({}, 'draft')).toContain('مستوى الشعبة')
    expect(levelProblem({ level: r(B, I) }, 'draft')).toBeNull()
  })

  it('⚠️ ومن أرسل قبل القرار يمضي — «تجاهل من أرسل موادّه»', () => {
    for (const st of ['submitted', 'approved', 'published']) {
      expect(levelRequired(st), st).toBe(false)
      expect(levelProblem({}, st), st).toBeNull()
    }
  })
})

describe('② المخطّط يحمله — وإلّا ضاع صامتا', () => {
  const ROUTES = code('server/http/routes/learning-portal.routes.ts')
  it('⚠️ في مخطّط حفظ الخطّة: طرفان من الثلاثة', () => {
    const schema = ROUTES.slice(ROUTES.indexOf('const planContent'), ROUTES.indexOf("app.get('/api/trainer/cohorts/:id/workspace'"))
    expect(schema, 'المخطّط لا يعرف المستوى — فيسقطه ويحفظ الخطّة بدونه')
      .toMatch(/level: z\.object\(\{ from: z\.enum\(COHORT_LEVELS\), to: z\.enum\(COHORT_LEVELS\) \}\)\.nullish\(\)/)
  })

  it('وقائمة الخادم تحكم به بالقاعدة نفسها — لا بنسخة منها', () => {
    const SVC = code('server/services/cohort-plan.service.ts')
    expect(SVC).toMatch(/const identityDone = [^\n]*\n\s*&& levelProblem\(input\.content, input\.planStatus\) === null/)
  })
})

describe('③ الشاشة تنقر بالقاعدة وتسمّي بها', () => {
  const WS = code('src/pages/trainer/CohortWorkspace.tsx')
  it('⚠️ البطاقة تنقر بـ`toggleLevel` وتقول حالها لمن لا يرى اللون', () => {
    expect(WS, 'البطاقة لا تحفظ مدى بالقاعدة').toMatch(/onClick=\{\(\) => setContent\(\{ \.\.\.content, level: toggleLevel\(range, lv\) \}\)\}/)
    expect(WS, 'حال البطاقة لا يسمع').toMatch(/aria-pressed=\{on\}/)
  })

  it('⚠️ وما ينقص الخطوة الأولى يسمّي المستوى — بحال الخطّة', () => {
    const gaps = WS.slice(WS.indexOf('const gapsFor'), WS.indexOf('if (k === "modules")', WS.indexOf('const gapsFor')))
    expect(gaps, 'لم تتمّ الخطوة ولا يقال إنّ المستوى ينقصها').toMatch(/levelProblem\(saved, w\.plan\?\.status \?\? "draft"\)/)
  })

  it('وتغيير المستوى بلا حفظ يعلّم «لم يحفظ» على الخطوة الأولى', () => {
    const key = WS.slice(WS.indexOf('const basicsKey'), WS.indexOf('\n', WS.indexOf('const basicsKey')))
    expect(key, 'المستوى خارج بصمة الخطوة الأولى').toContain('c.level')
  })
})

describe('④ والمعتمد يقرؤه', () => {
  const content = { kind: 'trainer', modules: [], resources: [], level: r(B, I) }
  const view = curriculumView({ title: 'الدفعة الأولى', period: null, content, sessions: [], assessments: [], fileKey: null, fileName: null } as never)

  it('⚠️ في المنهج الذي يقرؤه المدرّب والمعتمد معا', () => {
    expect(view.levelAr).toBe('من مبتدئ إلى متوسّط')
    const html = renderToStaticMarkup(createElement(CurriculumReview, { view }))
    expect(html, 'المنهج لا يقول المستوى').toContain('من مبتدئ إلى متوسّط')
  })

  it('وخطّة بلا مستوى تقول ذلك — لا يخفى السطر', () => {
    const bare = curriculumView({ title: 'ب', period: null, content: { ...content, level: null }, sessions: [], assessments: [], fileKey: null, fileName: null } as never)
    expect(renderToStaticMarkup(createElement(CurriculumReview, { view: bare }))).toContain('لم يحدّد')
  })

  it('⚠️ وفي رأس مراجعة الإدارة — بالقاعدة نفسها', () => {
    const REVIEW = code('src/components/admin/TrainerPlanReview.tsx')
    expect(REVIEW).toMatch(/levelRangeAr\(asLevelRange\(trainerPlan\.content\?\.level\)\)/)
  })

  it('⚠️ وفيما تغيّر عن المعتمد — تحت «المعلومات الأساسيّة»', () => {
    const fmt = { date: (d: string) => d }
    const diff = planDiff({ ...content, level: null }, content, fmt)
    const identity = diff.find((s) => s.section === 'identity')
    expect(identity?.lines, 'تغيّر المستوى ولم يقل للمعتمد').toContain('المستوى: لم يحدّد ← من مبتدئ إلى متوسّط')
    expect(planDiff(content, content, fmt), 'مستوى لم يتغيّر قيل إنّه تغيّر').toEqual([])
  })
})
