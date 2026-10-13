/* بطاقةُ الخطّة بلسانين — «الإدارة» و«المنهاج» — والمنهاجُ في صفحته (١١ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «حسّن التصميم.. فهو كثيرُ الكلام.. اجعله على شكل تابات: تابٌ للمنهاج وتابٌ
   لي كأدمن فيه التعديلاتُ والملفُّ والإرسال.. أو على الأقلّ يمكن فتحُ منهاجه منفصلا وتنزيلُه».

   ① لسانان، والإدارةُ أوّلا.
   ② المنهجُ في لسانه وحدَه — لا يمرّ عليه من جاء ليقرّر — ومعه فتحُه منفصلا وتنزيلُه.
   ③ وما يُقرَّر كلُّه في «الإدارة»: المعاييرُ والتقريرُ والتعديلاتُ والقرارُ واللقاءاتُ والمهامّ.
   ④ والصفحةُ المنفصلةُ تقرأ الخطّةَ من المسار نفسِه وتعرضها بالمكوّن نفسِه.

   والفحصُ على الشيفرة بلا تعليقاتها. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const REVIEW = code('src/components/admin/TrainerPlanReview.tsx')
const MAIN = REVIEW.slice(REVIEW.indexOf('export default function TrainerPlanReview'), REVIEW.indexOf('export function PlanCurriculum'))
const PLAN_PANEL = MAIN.slice(MAIN.indexOf('{trainerPlan && tab === "plan" && ('), MAIN.indexOf('{(!trainerPlan || tab === "admin") && ('))
const ADMIN_PANEL = MAIN.slice(MAIN.indexOf('{(!trainerPlan || tab === "admin") && ('))
const CURRICULUM = REVIEW.slice(REVIEW.indexOf('export function PlanCurriculum'))
const PAGE = code('src/pages/admin/PlanCurriculumPage.tsx')
const APP = code('src/App.tsx')

describe('① لسانان، والإدارة أوّلا', () => {
  it('⚠️ شريط بلسانين — «الإدارة» ثمّ «المنهاج» — ويفتح على الإدارة', () => {
    expect(MAIN).toMatch(/<TabBar[\s\S]{0,120}items=\{\[\{ id: "admin", label: "الإدارة" \}, \{ id: "plan", label: "المنهاج" \}\]\}/)
    expect(MAIN).toMatch(/const \[tab, setTab\] = useState<"admin" \| "plan">\("admin"\);/)
    expect(PLAN_PANEL.length, 'لوح المنهاج مفقود').toBeGreaterThan(50)
    expect(ADMIN_PANEL.length, 'لوح الإدارة مفقود').toBeGreaterThan(50)
  })
})

describe('② المنهج في لسانه وحده', () => {
  it('⚠️ لوح المنهاج يعرضه، ويفتحه منفصلا، وينزّله', () => {
    expect(PLAN_PANEL).toMatch(/<PlanCurriculum trainerPlan=\{trainerPlan\} cohortTitle=\{cohortTitle\} \/>/)
    expect(PLAN_PANEL).toMatch(/to=\{`\/admin\/plans\/\$\{cohortId\}`\} target="_blank"/)
    expect(PLAN_PANEL).toMatch(/onClick=\{\(\) => void downloadBundle\(\)\}/)
  })

  it('⚠️ ولوح الإدارة بلا منهج — لا يمرّ عليه من جاء ليقرّر', () => {
    expect(ADMIN_PANEL).not.toMatch(/<PlanCurriculum|<CurriculumReview/)
    expect(MAIN.match(/<CurriculumReview/g), 'المنهج مكتوب في البطاقة خارج مكوّنه').toBeNull()
  })

  it('والمكوّن يعرض المدّة والمستوى والقالب ثمّ المنهج كما قرأه المدرّب', () => {
    expect(CURRICULUM).toMatch(/trainerPlan\.content\?\.startsOn && trainerPlan\.content\?\.endsOn/)
    expect(CURRICULUM).toMatch(/levelRangeAr\(asLevelRange\(trainerPlan\.content\?\.level\)\)/)
    expect(CURRICULUM).toMatch(/<CurriculumReview\s+view=\{curriculumView\(\{/)
  })
})

describe('③ وما يقرّر كلّه في «الإدارة»', () => {
  it('⚠️ المعايير والتقرير والتعديلات وأزرار القرار والردّ والتأجيل والمهامّ واللقاءات', () => {
    for (const [what, re] of [
      ['بطاقة المعايير', /<PlanScorecard\s+items=\{scorecard\}/],
      ['تقرير المراجعة', /<ReviewReportUploader planId=\{trainerPlan\.id\}/],
      ['التعديلات', /<PlanEditsUploader/],
      ['الاعتماد', /approvalBody\(approveNote\)/],
      ['الردّ', /cohort-plans\/\$\{trainerPlan\.id\}\/decide`, \{ approve: false \}/],
      ['التأجيل', /\/postpone`/],
      ['المهامّ', /<PendingTasks/],
      ['اللقاءات', /cohort-sessions\/\$\{ps\.id\}\/decide/],
    ] as const) expect(ADMIN_PANEL, `${what} ليس في لوح الإدارة`).toMatch(re)
    expect(PLAN_PANEL).not.toMatch(/\/decide`|<PlanEditsUploader|<ReviewReportUploader/)
  })
})

describe('③ب وقليل الكلام في «الإدارة»', () => {
  it('⚠️ بطاقة المعايير سطر بعدّها يفتح بنقرة — ومفتوحة إن سقط مطلوب', () => {
    const at = ADMIN_PANEL.indexOf('<PlanScorecard')
    const before = ADMIN_PANEL.slice(0, at)
    expect(before.slice(before.lastIndexOf('<details')), 'البطاقة خارج سطرها').toMatch(/^<details className="mt-3" open=\{blocked\.length > 0\}>\s*<summary[^>]*>\s*بطاقة المعايير — /)
  })
})

describe('④ والصفحة المنفصلة', () => {
  it('⚠️ مسارها في App.tsx، وتقرأ الخطّة من مسار البطاقة، وتعرضها بالمكوّن نفسه، وتنزّل', () => {
    expect(APP).toMatch(/<Route path="\/admin\/plans\/:cohortId" element=\{<AdminPlanCurriculum \/>\} \/>/)
    expect(APP).toMatch(/const AdminPlanCurriculum = lazy\(\(\) => import\('\.\/pages\/admin\/PlanCurriculumPage'\)\)/)
    expect(PAGE).toMatch(/apiGet<TrainerPlan \| null>\(`\/api\/admin\/cohorts\/\$\{cohortId\}\/trainer-plan`\)/)
    expect(PAGE).toMatch(/<PlanCurriculum trainerPlan=\{plan\} cohortTitle=\{plan\.cohortTitle\} \/>/)
    expect(PAGE).toMatch(/apiDownload\(`\/api\/admin\/cohorts\/\$\{cohortId\}\/trainer-plan\/review-bundle`/)
    expect(PAGE, 'لا قرار في الصفحة المنفصلة').not.toMatch(/\/decide`|apiPost/)
  })
})
