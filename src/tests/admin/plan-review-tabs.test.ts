/* بطاقةُ الخطّة بألسنة — والمنهاجُ في لسانه وفي صفحته (١١ أكتوبر ٢٠٢٦، ثمّ ٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «حسّن التصميم.. فهو كثيرُ الكلام.. اجعله على شكل تابات: تابٌ للمنهاج وتابٌ
   لي كأدمن فيه التعديلاتُ والملفُّ والإرسال.. أو على الأقلّ يمكن فتحُ منهاجه منفصلا وتنزيلُه». ثمّ «خطّةُ
   لوحة الإدارة» (٣د): لسانُ الإدارة صار لسانين — «اقتراحات Claude» و«بطاقات للمدرب» — والملفُّ في «أدوات Claude»،
   والقرارُ تحت الألسنة (`plan-workspace.test.ts`).

   ① ألسنةٌ، والمنهاجُ آخرُها.
   ② المنهجُ في لسانه وحده — لا يمرّ عليه من جاء ليقرّر — ومعه فتحُه منفصلا، وتنزيلُه في «أدوات Claude».
   ③ وما يُقرَّر خارجَ «المنهاج»: المعاييرُ والتقريرُ والتعديلاتُ والقرارُ واللقاءاتُ والمهامّ.
   ④ والصفحةُ المنفصلةُ تقرأ الخطّةَ من المسار نفسِه وتعرضها بالمكوّن نفسِه.

   والفحصُ على الشيفرة بلا تعليقاتها. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WORKSPACE_TABS } from '@/application/trainer/plan-workspace'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const REVIEW = code('src/components/admin/TrainerPlanReview.tsx')
const MAIN = REVIEW.slice(REVIEW.indexOf('export default function TrainerPlanReview'), REVIEW.indexOf('export function PlanCurriculum'))
const PLAN_AT = MAIN.indexOf('{tab === "plan" && (')
/* لسانُ «المنهاج» آخرُ الألسنة: من رأسه إلى إغلاق شرط الخطّة في أوّل السطر */
const PLAN_PANEL = MAIN.slice(PLAN_AT, MAIN.indexOf('\n      )}\n', PLAN_AT))
/* وما سواه في البطاقة — الرأسُ والألسنةُ الأخرى والأدواتُ والقرار */
const REST = MAIN.slice(0, PLAN_AT) + MAIN.slice(PLAN_AT + PLAN_PANEL.length)
const CURRICULUM = REVIEW.slice(REVIEW.indexOf('export function PlanCurriculum'))
const PAGE = code('src/pages/admin/PlanCurriculumPage.tsx')
const APP = code('src/App.tsx')

describe('① ألسنة، والمنهاج آخرها', () => {
  it('⚠️ شريط بألسنة العمل — والمنهاج آخرها', () => {
    expect(MAIN).toMatch(/<TabBar[\s\S]{0,120}items=\{WORKSPACE_TABS\.map\(/)
    expect(WORKSPACE_TABS.at(-1)).toBe('plan')
    expect(PLAN_AT, 'لوح المنهاج مفقود').toBeGreaterThan(-1)
    expect(PLAN_PANEL.length, 'لوح المنهاج مفقود').toBeGreaterThan(50)
  })
})

describe('② المنهج في لسانه وحده', () => {
  it('⚠️ لوح المنهاج يعرضه ويفتحه منفصلا — وتنزيله في «أدوات Claude»', () => {
    expect(PLAN_PANEL).toMatch(/<PlanCurriculum trainerPlan=\{trainerPlan\} cohortTitle=\{cohortTitle\} \/>/)
    expect(PLAN_PANEL).toMatch(/to=\{`\/admin\/plans\/\$\{cohortId\}`\} target="_blank"/)
    const tools = MAIN.slice(MAIN.indexOf('aria-label="أدوات Claude"'))
    expect(tools.slice(0, tools.indexOf('</Inset>'))).toMatch(/onClick=\{\(\) => void downloadBundle\(\)\}/)
  })

  it('⚠️ وما سوى لوح المنهاج بلا منهج — لا يمرّ عليه من جاء ليقرّر', () => {
    expect(REST).not.toMatch(/<PlanCurriculum|<CurriculumReview/)
    expect(MAIN.match(/<CurriculumReview/g), 'المنهج مكتوب في البطاقة خارج مكوّنه').toBeNull()
  })

  it('والمكوّن يعرض المدّة والمستوى والقالب ثمّ المنهج كما قرأه المدرّب', () => {
    expect(CURRICULUM).toMatch(/trainerPlan\.content\?\.startsOn && trainerPlan\.content\?\.endsOn/)
    expect(CURRICULUM).toMatch(/levelRangeAr\(asLevelRange\(trainerPlan\.content\?\.level\)\)/)
    expect(CURRICULUM).toMatch(/<CurriculumReview\s+view=\{curriculumView\(\{/)
  })
})

describe('③ وما يقرّر خارج «المنهاج»', () => {
  it('⚠️ المعايير والتقرير والتعديلات وأزرار القرار والردّ والتأجيل والمهامّ واللقاءات', () => {
    for (const [what, re] of [
      ['بطاقة المعايير', /<PlanScorecard\s+items=\{scorecard\}/],
      ['تقرير المراجعة', /reports\.upload\(f\)/],
      ['التعديلات', /<PlanEditsDrafts/],
      ['الاعتماد', /approvalBody\(approveNote\)/],
      ['الردّ', /cohort-plans\/\$\{trainerPlan\.id\}\/decide`, \{ approve: false \}/],
      ['التأجيل', /\/postpone`/],
      ['المهامّ', /<PendingTasks/],
      ['اللقاءات', /cohort-sessions\/\$\{ps\.id\}\/decide/],
    ] as const) expect(REST, `${what} ليس في البطاقة خارج «المنهاج»`).toMatch(re)
    expect(PLAN_PANEL).not.toMatch(/\/decide`|<PlanEditsDrafts|<PlanEditsSent|\.upload\(|<PlanScorecard/)
  })
})

describe('③ب وقليل الكلام فوق الألسنة', () => {
  /* وكانت تُفتح وحدَها إن سقط مطلوب (١١ أكتوبر) — وصار سطرُها يسمّي ما سقط فتبقى مطويّة (٢٦ أكتوبر ٢٠٢٦) */
  it('⚠️ بطاقة المعايير سطر بعدّها يفتحها بنقرة — والمطلوب الساقط باسمه فيه', () => {
    const tiles = MAIN.slice(MAIN.indexOf('aria-label="الخطة في ثلاثة أسطر"'), MAIN.indexOf('<TabBar'))
    expect(tiles, 'الأسطر الثلاثة ليست فوق الألسنة').toMatch(/scoreLineAr\(\{ ok: [^}]*required: blocked\.length \}\)/)
    expect(tiles, 'المطلوب الساقط لا يسمّى في السطر').toMatch(/\{blocked\.length > 0 && <p[^>]*>المطلوب: \{blocked\.map\(\(b\) => b\.labelAr\)\.join\(" · "\)\}<\/p>\}/)
    expect(tiles).toMatch(/aria-expanded=\{cardShown\} onClick=\{\(\) => setCardOpen\(!cardShown\)\}/)
    expect(MAIN).toMatch(/const \[cardShown, setCardOpen\] = useState\(false\);/)
    /* ويسمّيه تحذيرُ القرار قبل الاعتماد كذلك — فلا يخفى بطيّها */
    expect(MAIN).toMatch(/\{blocked\.length === 1 \? "معيار ملزم لم يتحقّق" : `\$\{blocked\.length\} معايير ملزمة لم تتحقّق`\}: \{blocked\.map\(\(b\) => b\.labelAr\)\.join\(" · "\)\}/)
    expect(MAIN).toMatch(/\{cardShown && \(\s*<PlanScorecard\s+items=\{scorecard\}/)
    expect(MAIN.indexOf('<PlanScorecard'), 'البطاقة تحت الألسنة').toBeLessThan(MAIN.indexOf('<TabBar'))
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

/* «اعتمد وافتح للتسجيل» — اعتمادٌ ثمّ فتحٌ من بابه بشروطه، بنقرةٍ واحدة (٢٠ أكتوبر ٢٠٢٦) */
describe('اعتمد وافتح للتسجيل', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/admin/TrainerPlanReview.tsx'), 'utf8')
  it('يعتمد ثم يفتح — وما ينقص يقال والاعتماد يبقى', () => {
    const btn = src.slice(src.indexOf('{!trainerPlan.approvedOnce && (\n                  <Button tone="confirm"'))
    const body = btn.slice(0, btn.indexOf('اعتمد وافتح للتسجيل'))
    expect(body.indexOf('/decide`'), 'لا اعتماد').toBeGreaterThan(-1)
    expect(body.indexOf('/open`'), 'لا فتح بعد الاعتماد').toBeGreaterThan(body.indexOf('/decide`'))
    expect(body).toMatch(/catch \(e\) \{ openedAr = `ولم تفتح:/)
  })
})
