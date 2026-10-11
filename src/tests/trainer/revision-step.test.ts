/* «المراجعة» — الخطوةُ السابعةُ في صفحة الشعبة (١١ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة لمّا رأى صفحةَ المدرّب بعد الردّ: «كثيرُ الكلام… أريد عنوانا سابعا بعد الأخير
   اسمُه المراجعة، يرى فيه ما أريده أن يقبله أو يرفضه فقط، مرقّما سهلَ القراءة: واحد — نقترح هذا بدلَ
   هذا — اقبل أو ارفض. صندوقٌ ثمّ الثاني ثمّ الثالث… منصّةٌ محترفةٌ لا جريدة». والتقريرُ للقراءة إن
   شاء — «فكلُّ التعديلات تحته». ثمّ يُرسل مراجعتَه فتعود إلى الإدارة.

   ① الدائرةُ السابعةُ تظهر حين يكون فيها شيء، وتُفتح من الرابط وحين ينتظره بند.
   ② فيها البنودُ وحدَها — بطاقاتٌ مرقّمة — والتقريرُ تحتها للقراءة.
   ③ وحين يقرّر في كلّها يؤكّد ويرسل من موضعه، بالمربّع نفسِه الذي في «الاعتماد».
   ④ وفي الخطوات الأخرى سطرٌ يدلّ عليها لا القائمةُ نفسُها.

   والفحصُ على الشيفرة بلا تعليقاتها: حارسٌ طابق جملةً في تعليقٍ مرّ أخضرَ لسببٍ خاطئ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const WS = code('src/pages/trainer/CohortWorkspace.tsx')
const PANEL = code('src/components/PlanEdits.tsx')
const TRAINER_PANEL = PANEL.slice(PANEL.indexOf('export function PlanEditsPanel'))
const REVIEW = WS.slice(WS.indexOf('{stage === "review" ? ('), WS.indexOf(') : revision.pending > 0 && inHand ? ('))
const REPORTS = code('src/components/ReviewReports.tsx')

describe('① الدائرةُ السابعة', () => {
  it('⚠️ تظهر بعد الستّ حين يكون فيها بندٌ أو تقرير — وعددُ الخطوات يزيد بها', () => {
    expect(WS).toMatch(/const hasReview = revision\.total > 0 \|\| \(ws\.reviewReports\?\.length \?\? 0\) > 0;/)
    expect(WS).toMatch(/const stepsTotal = STAGES\.length \+ \(hasReview \? 1 : 0\);/)
    const circle = WS.slice(WS.indexOf('{hasReview && (() => {'))
    expect(circle.length, 'لا دائرةَ سابعة').toBeLessThan(WS.length)
    expect(circle).toMatch(/^\{hasReview && \(\(\) => \{[\s\S]{0,600}<li key="review"[\s\S]{0,200}onClick=\{\(\) => openStage\("review"\)\}/)
    expect(WS.indexOf('{hasReview && (() => {'), 'قبل الستّ لا بعدها').toBeGreaterThan(WS.indexOf('{STAGES.map((s, i) => {'))
  })

  it('⚠️ وعليها عددُ ما ينتظر قرارَه', () => {
    const circle = WS.slice(WS.indexOf('{hasReview && (() => {'), WS.indexOf('})()}', WS.indexOf('{hasReview && (() => {')))
    expect(circle).toMatch(/\{revision\.pending > 0 && \(\s*<span[^>]*>\s*\{revision\.pending\}\s*<\/span>/)
  })

  it('⚠️ وتُفتح عليها الصفحةُ من رابط البريد، أو حين ينتظره فيها بندٌ وخطّتُه في يده', () => {
    expect(WS).toMatch(/const requestedReview = useRef\(params\.get\(STEP_PARAM\) === "review"\);/)
    expect(WS).toMatch(/const reviewWaits = editable && revItems\.some\(\(x\) => x\.status === "pending"\);/)
    expect(WS).toMatch(/if \(reviewHas && \(requestedReview\.current \|\| \(!requestedStep\.current && reviewWaits\)\)\) setStage\("review"\);\s*else setStage\(firstStep\(/)
  })
})

describe('② البنودُ وحدَها، والتقريرُ للقراءة', () => {
  it('⚠️ قائمةُ التعديلات في «المراجعة» وحدَها — لا فوق كلّ خطوة', () => {
    expect(REVIEW).toMatch(/<PlanEditsPanel[\s\S]{0,400}onCounts=\{setRevision\}/)
    expect(WS.match(/<PlanEditsPanel/g)?.length, 'القائمةُ في موضعين').toBe(1)
  })

  it('⚠️ كلُّ بندٍ ينتظر بطاقةٌ مرقّمة: «نقترح» ثمّ «بدلَ»، واقبل أو ارفض', () => {
    expect(TRAINER_PANEL).toMatch(/const editCard = \(x: PlanEditItem\) => \(\s*<Card as="li" key=\{x\.id\}[\s\S]{0,300}\{numberOf\(x\)\}/)
    expect(TRAINER_PANEL).toMatch(/\{pendingEdits\.map\(\(x\) => editCard\(x\)\)\}/)
    expect(TRAINER_PANEL).toMatch(/<SuggestRows view=\{x\.view\} \/>/)
    expect(PANEL).toMatch(/<Cell label=\{r\.beforeAr === null \? "نضيف" : "نقترح"\} text=\{r\.afterAr\}/)
    expect(PANEL).toMatch(/\{r\.beforeAr !== null && <Cell label="بدلَ" text=\{r\.beforeAr\}/)
  })

  it('⚠️ وما قرّر فيه مطويٌّ تحتها سطرا لكلّ — لا يزاحم ما ينتظر', () => {
    /* مطويٌّ ولو قرّر في كلّها — فزرُّ الإرسال تحته يُرى بلا نزولٍ على ستّةٍ وعشرين سطرا */
    const at = TRAINER_PANEL.indexOf('ما قرّرتَ فيه ({decided.length})')
    expect(at, 'لا قائمةَ لما قرّر فيه').toBeGreaterThan(0)
    const tag = TRAINER_PANEL.slice(TRAINER_PANEL.lastIndexOf('<Inset as="details"', at), at)
    expect(tag).toMatch(/^<Inset as="details"[^>]*>\s*<summary/)
    expect(tag, 'يُفتح بنفسه').not.toMatch(/\bopen\b/)
  })

  it('⚠️ والعدُّ يعود إلى الصفحة بعد كلّ قراءة — فالرفضُ وحدَه يكفي ليظهر زرُّ الإرسال', () => {
    expect(TRAINER_PANEL).toMatch(/setItems\(list\);\s*onCounts\?\.\(\{ total: list\.length, pending: list\.filter\(\(x\) => x\.status === "pending"\)\.length \}\);/)
  })

  it('⚠️ والتقريرُ تحت البنود للقراءة إن شاء — بعنوانه لا باسم الحزمة', () => {
    expect(REVIEW.indexOf('<ReviewReportList'), 'التقريرُ قبل البنود').toBeGreaterThan(REVIEW.indexOf('<PlanEditsPanel'))
    expect(REPORTS).toMatch(/تقريرُ المراجعة — للقراءة إن شئت/)
    expect(REPORTS).toMatch(/\{reportTitleAr\(r\.originalName\)\}/)
  })
})

describe('③ ويرسل مراجعتَه من موضعها', () => {
  it('⚠️ حين يقرّر في كلّها وخطّتُه في يده: المربّعُ نفسُه ثمّ «أرسل المراجعة»', () => {
    const at = REVIEW.indexOf('{revision.total > 0 && revision.pending === 0 && inHand && (')
    expect(at, 'لا موضعَ للإرسال').toBeGreaterThan(-1)
    const send = REVIEW.slice(at)
    expect(send).toMatch(/^[\s\S]{0,1600}\{consentBox\}[\s\S]{0,200}<Button[^>]*tone="confirm"[^>]*\s+onClick=\{\(\) => void submitNow\("أُرسلت مراجعتُك — يصلك القرارُ هنا وبالبريد"\)\}>\s*أرسل المراجعة\s*<\/Button>/)
  })

  it('⚠️ وما ينقص الخطّةَ قبل الإرسال يُقال قبل المربّع — بزرٍّ إلى كلّ خطوةٍ فيها ما ينقص', () => {
    const send = REVIEW.slice(REVIEW.indexOf('{revision.total > 0 && revision.pending === 0 && inHand && ('))
    const at = send.indexOf('{blocking.length > 0 && (')
    expect(at, 'لا يُقال ما ينقص').toBeGreaterThan(-1)
    expect(at, 'بعد المربّع لا قبله').toBeLessThan(send.indexOf('{consentBox}'))
    expect(send.slice(at, send.indexOf('{consentBox}'))).toMatch(/\{blocking\.map\(\(b\) => <li key=\{b\.key\}>\{b\.labelAr\}<\/li>\)\}[\s\S]{0,200}STAGES\.filter\(\(s\) => STAGE_KEYS\[s\.key\]\.some\(\(k\) => blocking\.some\(\(b\) => b\.key === k\)\)\)[\s\S]{0,200}onClick=\{\(\) => void openStage\(s\.key\)\}/)
    expect(WS, 'ورأسُ ما ينقص يسمّي المراجعةَ لا «undefined»').toMatch(/: stage === "review"\s*\? "لا تُرسَل مراجعتُك بعد — ينقص خطّتَك:"/)
  })

  it('⚠️ والإرسالُ هو إرسالُ «الاعتماد» نفسُه — بحواجزه — لا مسلكٌ آخر', () => {
    expect(WS).toMatch(/const submitNow = async \(doneAr = "أُرسلت للاعتماد — يصلك القرار هنا وبالبريد"\) => \{[\s\S]{0,1200}sendBlock\(\{ confirmed: confirm[\s\S]{0,800}await act\(\(\) => apiPost\(`\/api\/trainer\/cohorts\/\$\{ws\.cohort\.id\}\/plan\/submit`, \{ confirm \}\), doneAr\);/)
  })

  it('⚠️ ومربّعُ الموافقة مكتوبٌ مرّةً ويُعرض في الدرجتين', () => {
    expect(WS.match(/const consentBox = \(/g)?.length).toBe(1)
    expect(WS.match(/\{consentBox\}/g)?.length).toBe(2)
  })

  it('⚠️ وبعد الإرسال يُقال له إنّها أُرسلت — لا قفلٌ صامت', () => {
    expect(REVIEW).toMatch(/\{revision\.total > 0 && planLocked && \([\s\S]{0,200}أُرسلت مراجعتُك/)
  })

  it('⚠️ والذهبيُّ في الشريط يغيب في «المراجعة» — فلا زرّان يرسلان', () => {
    expect(WS).toMatch(/\{stage === "review" \? null : approved && /)
  })
})

describe('④ وفي الخطوات الأخرى سطرٌ يدلّ عليها', () => {
  it('⚠️ «في «المراجعة» N بنودٍ تنتظر قرارك» بزرٍّ يفتحها', () => {
    const at = WS.indexOf(') : revision.pending > 0 && inHand ? (')
    expect(at).toBeGreaterThan(0)
    expect(WS.slice(at, at + 700)).toMatch(/في «المراجعة» \{revision\.pending\}[\s\S]{0,300}onClick=\{\(\) => void openStage\("review"\)\}>افتح «المراجعة»<\/Button>/)
  })
})
