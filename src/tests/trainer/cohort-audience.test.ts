/* ═══ لمن هذه الشعبة، وماذا يريد متعلّمُها — بمفردات التشخيص (٦ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة عن سؤالٍ للمدرّبين يساعد التشخيصَ أن يصل المتعلّمَ الصحيح،
   واختار: سؤالين (المرحلةُ المهنيّةُ والهدف) يُجمعان الآن ولا يُوصَلان بالمطابقة
   بعد (C)، إلزاميّين كالمستوى (1A)، بحدّ ثلاثٍ واثنين (2A)، والأهدافُ تضيق
   بالمراحل المختارة (3A).

   وما يُحرس هنا:
     ① القوائمُ قوائمُ التشخيص نفسُها — تُقرأ من `maps.ts` ولا تُنسخ.
     ② الحدُّ والتضييقُ والقراءةُ الآمنةُ لما حُفظ.
     ③ الإلزامُ بحال الخطّة (وحكمُه على `buildChecklist` نفسِها في
        `cohort-term-and-sessions.test.ts`).
     ④ المخطّطُ يحمله برموزٍ معروفةٍ وحدَها، والشاشةُ تنقر بالقاعدة وتسمّي بها.
     ⑤ والمعتمِدُ يقرؤه في المنهج وفيما تغيّر عن المعتمَد.

   والفحصُ على البنية لا على ورودِ حرفٍ في تعليق: التعليقاتُ تُنزع قبل المطابقة. */
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AUDIENCE_GOALS, AUDIENCE_STAGES, MAX_AUDIENCE_GOALS, MAX_AUDIENCE_STAGES,
  asAudience, audienceProblem, goalsAr, goalsFor, stagesAr, toggleIn, withStages,
} from '@/application/trainer/cohort-audience'
import { CAREER_STAGE_LABELS_AR, GOALS_V21 } from '@/domain/diagnostic/v2_1/maps'
import { curriculumView } from '@/application/trainer/curriculum-view'
import { planDiff } from '@/application/trainer/plan-diff'
import CurriculumReview from '@/components/CurriculumReview'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① القوائمُ قوائمُ التشخيص نفسُها', () => {
  it('⚠️ المراحلُ مراحلُ التشخيص بترتيبها — بلا «غير ذلك / غير متأكد»', () => {
    expect(AUDIENCE_STAGES).toEqual(Object.keys(CAREER_STAGE_LABELS_AR).filter((s) => s !== 'other_unsure'))
  })

  it('⚠️ والأهدافُ أهدافُ التشخيص بترتيبها — بلا «غير متأكد»', () => {
    expect(AUDIENCE_GOALS.map((g) => g.code)).toEqual(GOALS_V21.map((g) => g.code).filter((c) => c !== 'unsure_goal'))
  })

  it('والأسماءُ أسماؤه — فيقرأ المدرّبُ ما يقرؤه المتعلّم', () => {
    expect(stagesAr({ stages: ['university_student'], goals: [] })).toBe(CAREER_STAGE_LABELS_AR.university_student)
    expect(goalsAr({ stages: [], goals: ['first_job'] })).toBe(GOALS_V21.find((g) => g.code === 'first_job')!.label_ar)
  })
})

describe('② الحدُّ والتضييقُ والقراءة', () => {
  it('⚠️ ما حُفظ يُقرأ رموزا معروفةً بلا تكرارٍ وفي حدّها — وما عداها يسقط', () => {
    const a = asAudience({
      stages: ['manager', 'astronaut', 'manager', 'experienced', 'founder', 'freelancer', 7],
      goals: ['promotion', 'unsure_goal', 'promotion', 'leadership_prep', 'career_change'],
    })
    expect(a.stages).toEqual(['manager', 'experienced', 'founder'])
    expect(a.goals).toEqual(['promotion', 'leadership_prep'])
    expect(asAudience(null)).toEqual({ stages: [], goals: [] })
    expect(asAudience('manager')).toEqual({ stages: [], goals: [] })
  })

  it('⚠️ الحدُّ يُقال ولا يُبتلع — نقرٌ فوقه لا يستبدل الأقدمَ صامتا', () => {
    const full = ['university_student', 'fresh_graduate', 'early_career']
    expect(toggleIn(full, 'manager', MAX_AUDIENCE_STAGES), 'استُبدل مختارٌ بلا علم').toEqual(full)
    expect(toggleIn(full, 'fresh_graduate', MAX_AUDIENCE_STAGES)).toEqual(['university_student', 'early_career'])
    expect(toggleIn(['first_job'], 'build_portfolio', MAX_AUDIENCE_GOALS)).toEqual(['first_job', 'build_portfolio'])
  })

  it('⚠️ والأهدافُ تضيق بالمراحل المختارة — فلا يُعرض على الطالب «تنمية مشروعي القائم»', () => {
    const forStudents = goalsFor(['university_student']).map((g) => g.code)
    expect(forStudents).toContain('first_job')
    expect(forStudents, 'عُرض على الطالب هدفُ صاحب المشروع').not.toContain('grow_business')
    expect(goalsFor([]).length, 'بلا مرحلةٍ مختارةٍ تُعرض كلُّها').toBe(AUDIENCE_GOALS.length)
  })

  it('وتبديلُ المراحل يُسقط من الأهداف ما لم يعد يناسبها', () => {
    const a = { stages: ['founder' as const], goals: ['grow_business', 'ai_better'] }
    expect(withStages(a, ['university_student']).goals).toEqual(['ai_better'])
  })
})

describe('③ الإلزامُ بحال الخطّة — إلزامُ المستوى نفسُه', () => {
  const both = { audience: { stages: ['manager'], goals: ['leadership_prep'] } }
  it('⚠️ في يده يُطالَب بالاثنين — ويسمّي ما ينقص منهما', () => {
    expect(audienceProblem({}, 'draft')).toContain('لمن هذه الشعبة')
    expect(audienceProblem({ audience: { stages: ['manager'], goals: [] } }, 'changes_requested')).toContain('هدفا واحدا')
    expect(audienceProblem({ audience: { stages: [], goals: ['promotion'] } }, 'draft')).toContain('مرحلةً واحدة')
    expect(audienceProblem(both, 'draft')).toBeNull()
  })

  it('⚠️ ومن أرسل قبل القرار يمضي', () => {
    for (const st of ['submitted', 'approved', 'published']) expect(audienceProblem({}, st), st).toBeNull()
  })
})

describe('④ المخطّطُ يحمله، والشاشةُ تنقر بالقاعدة', () => {
  it('⚠️ في مخطّط حفظ الخطّة: رموزُ التشخيص وحدَها وفي حدّها — وإلّا ضاع صامتا', () => {
    const ROUTES = code('server/http/routes/learning-portal.routes.ts')
    const schema = ROUTES.slice(ROUTES.indexOf('const planContent'), ROUTES.indexOf("app.get('/api/trainer/cohorts/:id/workspace'"))
    expect(schema, 'المخطّطُ لا يعرف الجمهور').toMatch(/audience: z\.object\(\{/)
    expect(schema, 'المراحلُ تُقبل بلا قائمة').toMatch(/stages: z\.array\(z\.enum\(AUDIENCE_STAGES[^)]*\)\)\.max\(MAX_AUDIENCE_STAGES\)/)
    expect(schema, 'الأهدافُ تُقبل بلا قائمة').toMatch(/goals: z\.array\(z\.enum\(AUDIENCE_GOALS\.map[^\n]*\)\.max\(MAX_AUDIENCE_GOALS\)/)
  })

  it('⚠️ وقائمةُ الخادم تحكم به بالقاعدة نفسِها', () => {
    const SVC = code('server/services/cohort-plan.service.ts')
    expect(SVC).toMatch(/const identityDone = [\s\S]{0,200}&& audienceProblem\(input\.content, input\.planStatus\) === null/)
  })

  it('⚠️ والشاشةُ تنقر بالحدّ وتضيّق بالمراحل وتسمّي ما ينقص', () => {
    const WS = code('src/pages/trainer/CohortWorkspace.tsx')
    expect(WS, 'المراحلُ لا تُنقر بالحدّ ولا تُسقط ما لم يعد يناسبها')
      .toMatch(/setAud\(withStages\(aud, toggleIn\(aud\.stages, [^)]*MAX_AUDIENCE_STAGES\)\)\)/)
    expect(WS, 'الأهدافُ لا تُنقر بالحدّ').toMatch(/toggleIn\(aud\.goals, v, MAX_AUDIENCE_GOALS\)/)
    expect(WS, 'الأهدافُ المعروضةُ لا تضيق بالمراحل').toMatch(/const goals = goalsFor\(aud\.stages\)/)
    const gaps = WS.slice(WS.indexOf('const gapsFor'), WS.indexOf('if (k === "modules")', WS.indexOf('const gapsFor')))
    expect(gaps, 'لم تتمّ الخطوةُ ولا يُقال إنّ الجمهورَ ينقصها').toMatch(/audienceProblem\(saved, w\.plan\?\.status \?\? "draft"\)/)
    const key = WS.slice(WS.indexOf('const basicsKey'), WS.indexOf('\n', WS.indexOf('const basicsKey')))
    expect(key, 'الجمهورُ خارجَ بصمة الخطوة الأولى — فلا يُعلَّم «لم يُحفَظ»').toContain('c.audience')
  })
})

describe('⑤ والمعتمِدُ يقرؤه', () => {
  const audience = { stages: ['university_student', 'fresh_graduate'], goals: ['first_job'] }
  const content = { kind: 'trainer', modules: [], resources: [], audience }
  const view = curriculumView({ title: 'الدفعة الأولى', period: null, content, sessions: [], assessments: [], fileKey: null, fileName: null } as never)

  it('⚠️ في المنهج الذي يقرؤه المدرّبُ والمعتمِدُ معا', () => {
    const html = renderToStaticMarkup(createElement(CurriculumReview, { view }))
    expect(html, 'المنهجُ لا يقول لمن هي').toContain('طالب جامعي · خريج حديث')
    expect(html, 'المنهجُ لا يقول الهدف').toContain('الحصول على أول وظيفة')
  })

  it('⚠️ وفيما تغيّر عن المعتمَد — تحت «المعلومات الأساسيّة»', () => {
    const fmt = { date: (d: string) => d }
    const lines = planDiff({ ...content, audience: null }, content, fmt).find((s) => s.section === 'identity')?.lines ?? []
    expect(lines).toContain('لمن: لم يُحدَّد ← طالب جامعي · خريج حديث')
    expect(lines).toContain('الهدف: لم يُحدَّد ← الحصول على أول وظيفة')
    expect(planDiff(content, content, fmt)).toEqual([])
  })
})
