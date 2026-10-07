/* قالبُ كرّاسة وجيز بصيغة Word — فارغا، أو مملوءا بخطّة الشعبة.

   ═══ القراران (٦ و٧ أكتوبر ٢٠٢٦) ═══

   ① طلب صاحبُ المنصّة «قالبَنا الخاصَّ بصيغة Word يملؤه المدرّبُ بما يوافق
      معاييرنا»، واختار قالبين (الدورة والمحور) بستّة أقسامٍ لكلّ محور.
   ② ثمّ سأل: «أنجعله PDF قابلا للتعبئة ليسهل عليهم؟». فعُرضت عليه ثلاثةُ
      طرقٍ بفروقها — PDF بخاناتٍ ثابتة (ولا تتّصل العربيّةُ فيها في بعض العارضات)،
      أو الكتابةُ في المنصّة، أو **Word مملوءٌ بما كتبه المدرّبُ في الخطوات قبلها** —
      فاختار الثالثة: القالبُ نفسُه، يُنزَّل وفيه اسمُ الدورة ومدرّبُها ومدّتُها
      ومستواها ومحاورُها ومواعيدُها، ولكلّ محورٍ ما يخرج به ومحتواه النظريُّ وتطبيقُه
      ومصادرُه، ومشروعُ التخرّج — ما كان منها قد كُتب. والباقي بين قوسين كما كان.

   فمولّدٌ واحدٌ يكتب الاثنين: `blankFill` للقالب الفارغ في `public/templates/`
   (يبنيه `scripts/workbook-template/build.ts`)، وما تبنيه `CohortPlanService`
   من الخطّة لمسار التنزيل. فلا يفترق شكلُ المملوء عن الفارغ يوما.

   ═══ وثلاثةُ قراراتِ صنعة ═══

   ① ما يُستبدل بشكله النهائيّ لا رماديّا — في Word ما يُكتب فوق نصٍّ مظلَّلٍ
      يأخذ شكلَه، فيُعرف بقوسَيه [ هكذا ] لا بلونه.
   ② الخطُّ مضمَّنٌ في الملفّ — IBM Plex Sans Arabic بملفّيه الأصليّين في
      `server/assets/fonts/` (برخصة OFL معهما). والعريضُ مضمَّنٌ مع العاديّ
      (`embedBold`) — `docx` يضمّن العاديَّ وحدَه.
   ③ ولا يُعتمد في الاتّجاه على يمينٍ ويسار: الجداولُ `bidiVisual` والمسافاتُ
      `start` والمحاذاةُ بلا تحديدٍ أو وسط — فلا يختلف Word وLibreOffice عليه.
      والترقيمُ أرقامٌ تُكتب لا تُولَّد: `hindiNumbers` لا يتّفقان عليه. */

import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import JSZip from 'jszip'
import {
  AlignmentType, BorderStyle, CharacterSet, Document, Footer, Header, HeightRule, ImageRun, LevelFormat,
  LineRuleType, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Tab, Table, TableCell, TableLayoutType,
  TableRow, TextRun, WidthType, type FileChild, type IParagraphOptions, type IRunOptions, type ITableCellOptions,
} from 'docx'
import { dayLabelAr } from '../../src/application/trainer/axis-timeline'
import { ACADEMY_ZONE } from '../../src/application/trainer/cohort-period'
import { asLevelRange, levelRangeAr } from '../../src/application/trainer/cohort-level'
import { resourceCategory, resourceKind, type ResourceKind } from '../../src/application/trainer/plan-overlay'
import { fmtDateWith } from '../../src/application/text/format-ar'

/* ─────────── ما يُملأ به ─────────── */

export interface WorkbookModuleFill {
  /** رقمُه في الدورة — ١ لأوّلها */
  n: number
  title: string | null
  /** موعدُه — يومان `YYYY-MM-DD`، ومنهما «1 ديسمبر – 7 ديسمبر» */
  startsOn: string | null
  endsOn: string | null
  /** أوّلُ لقاءٍ مباشرٍ له — «الثلاثاء 2 ديسمبر، 7:00 م» */
  liveAr: string | null
  outcome: string | null
  /** المحتوى النظريّ — Markdown المنصّة المقيَّد (`LessonBody`) */
  body: string | null
  activity: string | null
  artifact: string | null
  resources: { title: string; kindAr: string; url: string | null }[]
}

export interface WorkbookFill {
  kind: 'course' | 'module'
  courseTitle: string | null
  cohortTitle: string | null
  trainerName: string | null
  periodAr: string | null
  levelAr: string | null
  summaryAr: string | null
  /** للدورة محاورُها كلُّها، وللمحور محورُه — أو محاورُه المتجاورةُ المجموعة */
  modules: WorkbookModuleFill[]
  project: { title: string; brief: string | null } | null
}

const emptyModule = (n: number): WorkbookModuleFill => ({
  n, title: null, startsOn: null, endsOn: null, liveAr: null, outcome: null, body: null, activity: null, artifact: null, resources: [],
})

/** القالبُ الفارغ — للدورة ثلاثةُ محاور، وللمحور واحد */
export function blankFill(kind: 'course' | 'module'): WorkbookFill {
  return {
    kind, courseTitle: null, cohortTitle: null, trainerName: null, periodAr: null, levelAr: null, summaryAr: null,
    modules: kind === 'course' ? [1, 2, 3].map(emptyModule) : [emptyModule(1)],
    project: null,
  }
}

/** أفي الملفّ شيءٌ من الخطّة؟ — فتقول صفحةُ المدرّب ما مُلئ له */
const isFilled = (f: WorkbookFill) =>
  Boolean(f.courseTitle || f.trainerName || f.modules.some((m) => m.title || m.outcome || m.body))

/* ─────────── الهويّة: ألوانُ `src/index.css` نفسُها ─────────── */

const C = {
  teal: '38A7B4', deep: '247B84', ink: '1A5C64', gold: 'FABC05', goldInk: '6B5200',
  goldTint: 'FFF6D9', tealTint: 'EAF6F7', text: '1F2A2E', muted: '5F6B6E', line: 'C5D1D3', white: 'FFFFFF',
}
const FONT = 'IBM Plex Sans Arabic'
const PAGE = { w: 11906, h: 16838 } // A4
const MARGIN = 1134 // سنتيمتران
const W = PAGE.w - 2 * MARGIN // عرضُ المتن

/** أرقامُ الأقسام — ١ ٢ ٣ كما في كرّاسات وجيز كلِّها */
const AR = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])

/* ─────────── لبناتُ النصّ ─────────── */

const run = (text: string, o: IRunOptions = {}) => new TextRun({ text, rightToLeft: true, font: FONT, color: C.text, ...o })
type Kids = IParagraphOptions['children']
/* وتباعدُ الأسطر «تلقائيٌّ» صريحا: بلا `lineRule` يقرؤه LibreOffice ارتفاعا ثابتا فيقصّ العنوانَ الكبير */
const P = (children: string | Kids, o: Omit<IParagraphOptions, 'children'> = {}) => {
  const spacing = o.spacing?.line ? { lineRule: LineRuleType.AUTO, ...o.spacing } : o.spacing
  return new Paragraph({ bidirectional: true, children: typeof children === 'string' ? [run(children)] : children, ...o, spacing })
}
const gap = (after = 120) => new Paragraph({ bidirectional: true, spacing: { before: 0, after }, children: [] })
const pageBreak = () => new Paragraph({ bidirectional: true, children: [new PageBreak()] })

const NONE = { style: BorderStyle.NONE, size: 0, color: C.white }
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE }
const cellNone = { top: NONE, bottom: NONE, left: NONE, right: NONE }
const thin = { style: BorderStyle.SINGLE, size: 4, color: C.line }
const boxed = { top: thin, bottom: thin, left: thin, right: thin }

/** جدولٌ يُقرأ من اليمين — `bidiVisual` فلا يُعتمد على يمينٍ ويسار */
const table = (rows: TableRow[], widths: number[]) =>
  new Table({
    visuallyRightToLeft: true,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows,
  })

const cell = (children: (Paragraph | Table)[], width: number, o: Partial<ITableCellOptions> = {}) =>
  new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 100, bottom: 100, left: 160, right: 160 },
    borders: cellNone,
    ...o,
    children,
  })

/** صندوقٌ بلونٍ واحد — للمتعلّم بلون الهويّة، وللمدرّب أصفر */
function box(children: (Paragraph | Table)[], { fill, border }: { fill: string; border: string }) {
  const b = { style: BorderStyle.SINGLE, size: 6, color: border }
  return table([
    new TableRow({ children: [cell(children, W, {
      shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
      borders: { top: b, bottom: b, left: b, right: b },
      margins: { top: 160, bottom: 160, left: 240, right: 240 },
    })] }),
  ], [W])
}

/** ملاحظةٌ للمدرّب — صندوقٌ أصفرُ يحذفه قبل التصدير.
    و`tail: false` لآخر ما في الصفحة: سطرُه الفارغُ بعده يسقط إلى صفحةٍ جديدةٍ حين
    يملأ القسمُ صفحتَه، فتبقى صفحةٌ بيضاءُ قبل القسم التالي. */
const note = (text: string, { tail = true }: { tail?: boolean } = {}): FileChild[] => [
  /* «مع التالي»: الملاحظةُ تلحق ما قبلها إلى صفحته — لا صندوقٌ أصفرُ وحدَه في صفحة */
  new Paragraph({ bidirectional: true, spacing: { before: 0, after: 60 }, keepNext: true, children: [] }),
  box([P([run('للمدرّب — ', { bold: true, color: C.goldInk, size: 19 }), run(text, { color: C.goldInk, size: 19 }),
    run('  (احذف هذا الصندوق)', { color: C.goldInk, size: 17 })], { spacing: { after: 0, line: 300 } })],
  { fill: C.goldTint, border: C.gold }),
  ...(tail ? [gap(120)] : []),
]

/** أسطرُ كتابةٍ للمتعلّم — صفوفٌ بخطٍّ سفليٍّ وحدَه.
    لا فقراتٌ بحدٍّ سفليّ: Word يدمج الفقراتِ المتتاليةَ المتماثلةَ الحدودِ في صندوقٍ واحد. */
const lines = (n: number) => {
  const b = { style: BorderStyle.DOTTED, size: 6, color: C.line }
  return table(Array.from({ length: n }, () => new TableRow({
    height: { value: 520, rule: HeightRule.EXACT },
    children: [cell([P('')], W, { borders: { top: NONE, left: NONE, right: NONE, bottom: b } })],
  })), [W])
}

/** عنوانُ قسمٍ في المحور: رقمٌ على الذهبيّ ثمّ اسمُه */
const h2 = (num: string, title: string) =>
  P([run(` ${num} `, { bold: true, size: 26, shading: { type: ShadingType.CLEAR, fill: C.gold, color: 'auto' } }),
    run('  ' + title, { bold: true, size: 28, color: C.ink })],
  { heading: 'Heading2', spacing: { before: 360, after: 140 }, keepNext: true })

/* والقسمُ الذي يبدأ صفحتَه يبدأها بعنوانه (`pageBreakBefore`) لا بفقرة فاصلٍ قبله:
   الفقرةُ الفاصلةُ تسقط إلى أوّل الصفحة التالية إن امتلأت هذه، فتصنع صفحةً بيضاء */
const h1 = (title: string, o: { pageBreakBefore?: boolean } = {}) =>
  P([run(title, { bold: true, size: 40, color: C.deep })], {
    heading: 'Heading1', spacing: { before: 0, after: 120 }, keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.teal, space: 6 } }, ...o,
  })

const label = (text: string, o: Omit<IParagraphOptions, 'children'> = {}) =>
  P([run(text, { bold: true, size: 22, color: C.goldInk })], { spacing: { after: 40 }, keepNext: true, ...o })

const bullet = (text: string | Kids, o: Omit<IParagraphOptions, 'children'> = {}) =>
  P(typeof text === 'string' ? [run(text)] : text, { numbering: { reference: 'wz-bullet', level: 0 }, spacing: { after: 80 }, ...o })

const numbered = (i: number, text: string | Kids) =>
  P([run(AR(i + 1), { bold: true, color: C.deep }), new TextRun({ children: [new Tab()], rightToLeft: true }),
    ...(typeof text === 'string' ? [run(text)] : text ?? [])],
  { indent: { start: 400, hanging: 400 }, spacing: { after: 80 } })
const numberedList = (items: (string | Kids)[]) => items.map((t, i) => numbered(i, t))

/** القيمةُ إن كُتبت، وإلّا مكانُها بين قوسين */
const v = (value: string | null | undefined, placeholder: string) => value?.trim() || placeholder

/** «1 ديسمبر – 7 ديسمبر» — من أوّل محورٍ إلى آخرِ ما بعده، أو `null` إن لم يُوزَّع */
const rangeAr = (from: WorkbookModuleFill, to: WorkbookModuleFill = from) =>
  from.startsOn && to.endsOn ? `${dayLabelAr(from.startsOn)} – ${dayLabelAr(to.endsOn)}` : null

/* ─────────── المحتوى النظريّ: Markdown المنصّة المقيَّد إلى فقرات ───────────

   ما يقرؤه `LessonBody`: عناوين (#)، وقوائم (- و1.)، واقتباس (>)، وعريض (**)،
   وروابط [نص](رابط)، وفاصل (---)، والسطرُ الفارغُ فقرةٌ جديدة. والمائلُ يُكتب
   بلا ميل: العربيّةُ المائلةُ تُقرأ بصعوبة. */
function inlineRuns(text: string, base: IRunOptions = {}): TextRun[] {
  const out: TextRun[] = []
  const re = /(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\s]+\))/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(run(text.slice(last, m.index), base))
    const tok = m[0]
    if (tok.startsWith('**')) out.push(run(tok.slice(2, -2), { ...base, bold: true }))
    else if (tok.startsWith('[')) {
      const cut = tok.indexOf('](')
      out.push(run(`${tok.slice(1, cut)} (${tok.slice(cut + 2, -1)})`, base))
    } else out.push(run(tok.slice(1, -1), base))
    last = m.index + tok.length
  }
  if (last < text.length) out.push(run(text.slice(last), base))
  return out
}

function markdownParagraphs(md: string): Paragraph[] {
  const out: Paragraph[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) out.push(P(inlineRuns(para.join(' '))))
    para = []
  }
  for (const raw of md.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    if (!line || /^```/.test(line)) { flush(); continue }
    if (/^-{3,}$/.test(line)) { flush(); continue }
    const head = /^(#{1,3})\s+(.*)$/.exec(line)
    if (head) {
      flush()
      out.push(P(inlineRuns(head[2], { bold: true, color: C.deep, size: head[1].length === 1 ? 26 : 24 }), { spacing: { before: 160, after: 60 }, keepNext: true }))
      continue
    }
    const item = /^[-*]\s+(.*)$/.exec(line) ?? /^\d+[.)]\s+(.*)$/.exec(line)
    if (item) { flush(); out.push(bullet(inlineRuns(item[1]))); continue }
    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) { flush(); out.push(P(inlineRuns(quote[1], { color: C.ink }), { indent: { start: 360 } })); continue }
    para.push(line)
  }
  flush()
  return out
}

/* ─────────── الغلاف ─────────── */

function cover(logo: Buffer, { kind, title, sub, facts }: { kind: string; title: string; sub: string; facts: [string, string][] }): FileChild[] {
  const factRow = ([k, val]: [string, string]) => {
    const borders = { top: NONE, left: NONE, right: NONE, bottom: thin }
    return new TableRow({ children: [
      cell([P([run(k, { bold: true, color: C.ink })], { spacing: { after: 0 } })], 2400, { borders }),
      cell([P([run(val)], { spacing: { after: 0 } })], W - 2400, { borders }),
    ] })
  }
  const nameB = { style: BorderStyle.SINGLE, size: 8, color: C.teal }
  return [
    P([new ImageRun({ type: 'png', data: logo, transformation: { width: 104, height: 178 },
      altText: { title: 'أكاديمية وجيز', description: 'شعار أكاديمية وجيز', name: 'logo' } })],
    { alignment: AlignmentType.CENTER, spacing: { before: 240, after: 600 } }),
    P([run(kind, { bold: true, size: 24, color: C.goldInk })], { alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
    P([run(title, { bold: true, size: 56, color: C.deep })], { alignment: AlignmentType.CENTER, spacing: { after: 120, line: 360 } }),
    P([run(sub, { size: 26, color: C.muted })], { alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
    P([run('')], {
      alignment: AlignmentType.CENTER, spacing: { after: 560 }, indent: { start: 4000, end: 4000 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: C.gold, space: 1 } },
    }),
    table(facts.map(factRow), [2400, W - 2400]),
    gap(560),
    table([new TableRow({ children: [
      cell([P([run('هذه الكرّاسةُ لـ', { bold: true, color: C.ink })], { spacing: { after: 0 } })], 2400),
      cell([P('', { spacing: { after: 0 } })], W - 2400, { borders: { top: NONE, left: NONE, right: NONE, bottom: nameB } }),
    ] })], [2400, W - 2400]),
  ]
}

/* ─────────── صفحةُ المدرّب ─────────── */

function trainerPage(extra: [string, string], filled: boolean): FileChild[] {
  const pt = (b: string, t: string): Kids => [run(b + ' ', { bold: true, color: C.goldInk }), run(t, { color: C.text })]
  return [
    box([
      P([run('قبل أن تكتب — للمدرّب', { bold: true, size: 34, color: C.goldInk })], { spacing: { after: 80 } }),
      P([run('هذه الصفحةُ لك وحدَك: اقرأها ثمّ احذفها، واحذف الصناديقَ الصفراءَ كلَّها، قبل أن تحفظ الكرّاسةَ PDF.', { color: C.goldInk })],
        { spacing: { after: 240 } }),
      ...numberedList([
        ...(filled ? [pt('ملأناها لك من خطّتك.', 'اسمُ الدورة ومدّتُها ومحاورُها ومواعيدُها، وما يخرج به المتعلّمُ من كلّ محور، ومحتواه النظريُّ وتطبيقُه ومصادرُه — كما حفظتها في المنصّة لحظةَ التنزيل. راجِعها، وأكمِل ما بقي بين قوسين.')] : []),
        pt('ما بين قوسين اكتب مكانَه.', 'كلُّ نصٍّ [ هكذا ] مكانٌ لكلامك: ظلِّله من القوس إلى القوس واكتب فوقه، فيأخذ كلامُك شكلَه.'),
        pt('الشكلُ واحدٌ في كرّاسات وجيز كلِّها.', 'لا تغيّر الخطَّ ولا الألوانَ ولا ترتيبَ الأقسام — بها يعرف المتعلّمُ طريقَه في كلّ دورة. وزِد ما شئت داخلَ الأقسام: صورا وجداولَ ونماذج.'),
        pt('اكتب لمن يقرأ وحدَه.', 'جملٌ قصيرة، ومثالٌ من عمل المتعلّم لا من كتاب، والمصطلحُ الإنجليزيُّ بين قوسين أوّلَ مرّةٍ فقط.'),
        pt('الكرّاسةُ للعمل لا للقراءة وحدَها.', 'في كلّ محورٍ ما يملؤه المتعلّم: جدولٌ يعمل عليه، ومساحةٌ يكتب فيها، فيفتحها في اللقاء وبعده.'),
        pt(extra[0], extra[1]),
        pt('احفظها PDF وارفعها.', 'من «ملف» اختر «حفظ باسم» ثمّ PDF، وارفعها في الخطوة الثالثة «الكرّاسة» في مساحة شعبتك. والمنصّةُ تقبل PDF وحدَه: يُفتح في الصفحة على أيّ جهاز، ولا يتغيّر شكلُه.'),
        pt('الخطّ.', 'الكرّاسةُ بخطّ IBM Plex Sans Arabic، وهو مضمَّنٌ فيها. فإن ظهر لك خطٌّ غيرُه فثبّته مجّانا من fonts.google.com ثمّ أعد فتحها.'),
      ]),
    ], { fill: C.goldTint, border: C.gold }),
  ]
}

/* ─────────── كيف تستعمل هذه الكرّاسة — للمتعلّم ─────────── */

const howTo = (): FileChild[] => [
  box([
    P([run('كيف تستعمل هذه الكرّاسة', { bold: true, size: 24, color: C.ink })], { spacing: { after: 100 } }),
    ...numberedList([
      'اقرأ «الأفكارَ الأساسيّة» قبل اللقاء المباشر.',
      'احملها إلى اللقاء: فيه نحلّ المثالَ معا ونبدأ التمرين.',
      'أكمل التمرينَ وأسئلةَ التأمّل بعد اللقاء — وعليها تبني مهمّةَ المحور.',
    ]),
  ], { fill: C.tealTint, border: C.tealTint }),
]

/* ─────────── جدولٌ برأسٍ فيروزيّ ─────────── */

function grid(cols: string[], rows: (string | Paragraph[])[][], { keepWithNext = false }: { keepWithNext?: boolean } = {}) {
  const w = Math.floor(W / cols.length)
  const widths = cols.map((_, i) => (i === cols.length - 1 ? W - w * (cols.length - 1) : w))
  return table([
    new TableRow({ tableHeader: true, cantSplit: true, children: cols.map((t, i) => cell([P([run(t, { bold: true, color: C.white })], { spacing: { after: 0 }, keepNext: true })], widths[i], {
      borders: boxed, shading: { type: ShadingType.CLEAR, fill: C.deep, color: 'auto' } })) }),
    /* الجدولُ لا يُشطَر على صفحتين — «مع التالي» في كلّ صفٍّ إلّا الأخير */
    ...rows.map((r, ri) => new TableRow({ cantSplit: true, height: { value: 640, rule: HeightRule.ATLEAST },
      children: widths.map((wd, i) => {
        const c = r[i] ?? ''
        return cell(typeof c === 'string' ? [P(c, { spacing: { after: 0 }, keepNext: keepWithNext || ri < rows.length - 1 })] : c, wd, { borders: boxed })
      }) })),
  ], widths)
}

/* ─────────── المحور: ستّةُ أقسامٍ بترتيبٍ واحدٍ في كلّ كرّاسة ─────────── */

function moduleBlock(m: WorkbookModuleFill, { breakBefore = false }: { breakBefore?: boolean } = {}): FileChild[] {
  const idea = (k: string): FileChild[] => [
    P([run(`${k} · `, { bold: true, color: C.deep }), run('[عنوانُ الفكرة في سطرٍ واحد]', { bold: true })], { spacing: { before: 160, after: 60 }, keepNext: true }),
    P('[اشرحها في ثلاثة أسطرٍ أو أربعة، بلغةِ من يقرأ وحدَه.]'),
    P([run('في عملك: ', { bold: true, color: C.ink }), run('[أين يلقاها المتعلّمُ في يومه.]')]),
  ]
  const exRow = (k: string, children: Paragraph[]) =>
    new TableRow({ cantSplit: true, children: [
      cell([P([run(k, { bold: true, color: C.ink })], { spacing: { after: 0 }, keepNext: true })], 2200, {
        borders: boxed, shading: { type: ShadingType.CLEAR, fill: C.tealTint, color: 'auto' } }),
      cell(children, W - 2200, { borders: boxed }),
    ] })
  const question = (k: string, q: string): FileChild[] => [
    P([run(`${k}  `, { bold: true, color: C.deep }), run(q, { bold: true })], { spacing: { before: 160, after: 40 }, keepNext: true }),
    lines(3),
  ]
  const body = m.body?.trim() ? markdownParagraphs(m.body) : []
  /* والرابطُ سطرٌ وحدَه تحت اسمه، صغيرا من اليسار — لا يتكسّر حرفا حرفا في عمودٍ ضيّق */
  const resources = m.resources.length > 0
    ? m.resources.map((r) => [
        [P(r.title, { spacing: { after: r.url ? 40 : 0 }, keepNext: true }),
          ...(r.url ? [new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 0 }, children: [new TextRun({ text: r.url, font: FONT, size: 16, color: C.muted })] })] : [])],
        r.kindAr, '[سطرٌ واحد]',
      ])
    : [['[اسمُ المصدر ورابطُه]', '[قراءة / فيديو / أداة]', '[سطرٌ واحد]'], ['[…]', '[…]', '[…]'], ['[…]', '[…]', '[…]']]
  return [
    label(`المحور ${AR(m.n)}`, { pageBreakBefore: breakBefore }),
    h1(v(m.title, '[اسمُ المحور]')),
    P([run('الموعد: ', { bold: true, color: C.ink }), run(v(rangeAr(m), '[من … إلى …]')), run('   ·   ', { color: C.muted }),
      run('اللقاءُ المباشر: ', { bold: true, color: C.ink }), run(v(m.liveAr, '[اليومُ والساعة]'))], { spacing: { after: 200 } }),

    h2('١', 'ما ستخرج به'),
    box([
      P([run('في آخر هذا المحور تستطيع أن:', { bold: true, color: C.ink })], { spacing: { after: 80 } }),
      ...(m.outcome?.trim()
        ? [bullet(m.outcome.trim()), bullet('[فعلٌ آخرُ — إن كان]', { spacing: { after: 0 } })]
        : [bullet('[فعلٌ يُرى ويُقاس — مثلا: تكتب مذكّرةَ تحضيرٍ لتفاوضٍ قادم]'), bullet('[الفعلُ الثاني]'),
            bullet('[الفعلُ الثالث — إن كان]', { spacing: { after: 0 } })]),
    ], { fill: C.tealTint, border: C.tealTint }),
    ...note('اكتب ما يستطيع المتعلّمُ أن يفعله، لا ما سيعرفه: «تكتب مذكّرةَ تحضير» لا «يفهم التفاوض». وأوّلُها جملةُ «ما يخرج به» التي كتبتها لهذا المحور في المنصّة.'),

    h2('٢', 'الأفكارُ الأساسيّة'),
    ...(body.length > 0
      ? [...note('هذا محتواك النظريُّ كما كتبته في المنصّة. قسّمه إلى ثلاث أفكارٍ إلى خمس، لكلٍّ عنوانُها وسطرُ «في عملك»، واحذف ما لا يستعمله التمرين.'), ...body]
      : [...note('من ثلاث أفكارٍ إلى خمس، لكلٍّ عنوانُها. والفكرةُ التي لا يستعملها التمرينُ لا مكانَ لها هنا.'), ...idea('١'), ...idea('٢'), ...idea('٣')]),

    h2('٣', 'مثالٌ محلول'),
    table([
      exRow('الموقف', [P('[صِف الموقفَ في سطرين: من، وماذا يريد، وما الذي يعيقه.]', { spacing: { after: 0 } })]),
      exRow('الحلُّ خطوةً خطوة', numberedList(['[الخطوةُ الأولى]', '[الثانية]', '[الثالثة]'])),
      exRow('النتيجة', [P('[ما الذي تحقّق — برقمٍ إن أمكن.]', { spacing: { after: 0 } })]),
      exRow('لماذا نجح', [P('[الفكرةُ من «الأفكار الأساسيّة» التي صنعت الفرق.]', { spacing: { after: 0 } })]),
    ], [2200, W - 2200]),
    ...note('موقفٌ واقعيٌّ من سوق المتعلّم وبيئة عمله، محلولٌ خطوةً خطوة — وهو ما تحلّونه معا في اللقاء.'),

    h2('٤', 'تمرينٌ عمليّ'),
    P([run('المدّة: ', { bold: true, color: C.ink }), run('[٢٠ دقيقة]'), run('   ·   ', { color: C.muted }), run('[فرديّ / في مجموعة]')]),
    P([run('المطلوب:', { bold: true, color: C.ink })], { spacing: { after: 60 }, keepNext: true }),
    ...(m.activity?.trim()
      ? markdownParagraphs(m.activity)
      : numberedList(['[اختر موقفا من عملك …]', '[طبّق عليه …]', '[اكتب ما خرجت به في الجدول.]'])),
    ...(m.artifact?.trim() ? [P([run('ما تسلّمه: ', { bold: true, color: C.ink }), ...inlineRuns(m.artifact.trim())])] : []),
    gap(80),
    grid(['[العمودُ الأوّل]', '[الثاني]', '[الثالث]'], [[], [], [], []]),
    ...note('التمرينُ على موقفٍ من عمل المتعلّم نفسِه، وما يكتبه هنا يبني عليه مهمّةَ المحور في المنصّة. وغيّر أعمدةَ الجدول بما يحتاجه تمرينُك.'),

    h2('٥', 'أسئلةٌ للتأمّل'),
    ...question('١', '[سؤالٌ يربط الفكرةَ بعمله: أين …؟]'),
    ...question('٢', '[سؤالٌ عمّا سيفعله بعد اللقاء: ما أوّلُ …؟]'),
    ...question('٣', '[سؤالٌ عمّا يقيس به تقدّمَه: كيف ستعرف …؟]'),
    ...note('أسئلةٌ لا جوابَ صحيحا لها — يكتب المتعلّمُ فيها عن نفسه.'),

    h2('٦', 'مصادرُ للاستزادة'),
    grid(['المصدر', 'نوعُه', 'لماذا يستحقّ وقتَك'], resources, { keepWithNext: true }),
    ...note('هي المصادرُ نفسُها التي تضيفها لهذا المحور في «المهامّ والمصادر» — اذكرها هنا ليجدها من يطبع الكرّاسة.', { tail: false }),
  ]
}

const notesPage = (): FileChild[] => [h1('ملاحظاتي', { pageBreakBefore: true }), gap(120), lines(22)]

/* ─────────── الترويسة والتذييل: في الوسط، فلا يُعتمد على يمينٍ ويسار ─────────── */

const header = (kind: string) => new Header({ children: [
  P([run('أكاديمية وجيز', { bold: true, size: 18, color: C.deep }), run(`  ·  ${kind}`, { size: 18, color: C.muted })], {
    alignment: AlignmentType.CENTER, spacing: { after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 6 } },
  }),
] })
const footer = () => new Footer({ children: [
  P([new TextRun({ children: [PageNumber.CURRENT], rightToLeft: true, font: FONT, bold: true, size: 20, color: C.deep })],
    { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
  P([run('wajeezacademy.com', { size: 16, color: C.muted })], { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
] })
const blankHeader = () => new Header({ children: [new Paragraph({ children: [] })] })

/* ─────────── المستند ─────────── */

function document({ title, kind, regular, children }: { title: string; kind: string; regular: Buffer; children: FileChild[] }) {
  const bulletLevel = {
    level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.START,
    style: { paragraph: { indent: { start: 440, hanging: 360 } }, run: { font: FONT, color: C.deep } },
  }
  return new Document({
    creator: 'أكاديمية وجيز',
    title,
    description: 'كرّاسة أكاديمية وجيز — تُملأ ثمّ تُحفظ PDF وتُرفع في مساحة الشعبة.',
    fonts: [{ name: FONT, data: regular, characterSet: CharacterSet.ARABIC }],
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22, color: C.text, language: { value: 'ar-JO', bidirectional: 'ar-JO' } },
          paragraph: { spacing: { after: 120, line: 320, lineRule: LineRuleType.AUTO } },
        },
      },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: FONT, size: 40, bold: true, color: C.deep }, paragraph: { outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: FONT, size: 28, bold: true, color: C.ink }, paragraph: { outlineLevel: 1 } },
      ],
    },
    numbering: { config: [{ reference: 'wz-bullet', levels: [bulletLevel] }] },
    sections: [{
      properties: {
        page: { size: { width: PAGE.w, height: PAGE.h }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 560, footer: 560 } },
        titlePage: true,
      },
      headers: { first: blankHeader(), default: header(kind) },
      footers: { first: blankHeader(), default: footer() },
      children,
    }],
  })
}

/* ─────────── تضمينُ العريض — `docx` يضمّن العاديَّ وحدَه ─────────── */

function obfuscate(buf: Buffer, key: string): Buffer {
  const bytes = (key.replace(/[{}-]/g, '').match(/../g) ?? []).map((h) => parseInt(h, 16)).reverse()
  const out = Buffer.from(buf)
  for (let i = 0; i < 32; i++) out[i] ^= bytes[i % bytes.length]
  return out
}

async function embedBold(buffer: Buffer, bold: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer)
  const key = `{${randomUUID().toUpperCase()}}`
  zip.file('word/fonts/font-bold.odttf', obfuscate(bold, key))
  const relsPath = 'word/_rels/fontTable.xml.rels'
  const rels = await zip.file(relsPath)!.async('string')
  zip.file(relsPath, rels.replace('</Relationships>',
    '<Relationship Id="rIdWzBold" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font-bold.odttf"/></Relationships>'))
  const fontTable = await zip.file('word/fontTable.xml')!.async('string')
  const withBold = fontTable.replace(/(<w:font w:name="IBM Plex Sans Arabic">[\s\S]*?<w:embedRegular [^>]*\/>)/,
    `$1<w:embedBold r:id="rIdWzBold" w:fontKey="${key}"/>`)
  if (withBold === fontTable) throw new Error('لم يُعثر على الخطّ المضمَّن في fontTable.xml')
  zip.file('word/fontTable.xml', withBold)
  /* وبلا `embedTrueTypeFonts` يُسقط Word الخطَّ أوّلَ ما يحفظ المدرّبُ الملفّ.
     وموضعُه في المخطّط بعد `displayBackgroundShape` — وهو أوّلُ ما يكتبه `docx` */
  const settings = await zip.file('word/settings.xml')!.async('string')
  if (!settings.includes('w:embedTrueTypeFonts')) {
    const anchor = '<w:displayBackgroundShape/>'
    const pos = settings.includes(anchor) ? settings.indexOf(anchor) + anchor.length : settings.indexOf('>', settings.indexOf('<w:settings')) + 1
    zip.file('word/settings.xml', settings.slice(0, pos) + '<w:embedTrueTypeFonts/>' + settings.slice(pos))
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

/* ─────────── الأصول: الخطّان والشعار — تُقرأ مرّةً ─────────── */

export interface WorkbookAssets { regular: Buffer; bold: Buffer; logo: Buffer }
let cached: WorkbookAssets | null = null
export function workbookAssets(root = process.cwd()): WorkbookAssets {
  if (!cached || root !== process.cwd()) {
    cached = {
      regular: readFileSync(join(root, 'server/assets/fonts/IBMPlexSansArabic-Regular.ttf')),
      bold: readFileSync(join(root, 'server/assets/fonts/IBMPlexSansArabic-Bold.ttf')),
      logo: readFileSync(join(root, 'public/logo-full.png')),
    }
  }
  return cached
}

/* ─────────── الكرّاسة ─────────── */

/** «المحور 2» أو «المحوران 2 و3» أو «المحاور 2–4» — للغلاف */
function axesAr(mods: WorkbookModuleFill[]): string {
  const ns = mods.map((m) => AR(m.n))
  if (ns.length === 1) return `المحور ${ns[0]}`
  if (ns.length === 2) return `المحوران ${ns[0]} و${ns[1]}`
  return `المحاور ${ns[0]}–${ns[ns.length - 1]}`
}

export async function workbookDocx(fill: WorkbookFill, assets: WorkbookAssets = workbookAssets()): Promise<Buffer> {
  const filled = isFilled(fill)
  let children: FileChild[]
  let title: string
  let kind: string
  if (fill.kind === 'course') {
    kind = 'كرّاسةُ الدورة'
    title = filled ? `كرّاسةُ ${v(fill.courseTitle, 'الدورة')} — أكاديمية وجيز` : 'قالبُ كرّاسة الدورة — أكاديمية وجيز'
    const mapWidths = [1000, 4438, 2600, 1600]
    const headRow = new TableRow({ tableHeader: true, children: ['المحور', 'العنوان', 'الموعد', 'يبدأ في'].map((t, i) => cell(
      [P([run(t, { bold: true, color: C.white })], { alignment: AlignmentType.CENTER, spacing: { after: 0 } })], mapWidths[i],
      { borders: boxed, shading: { type: ShadingType.CLEAR, fill: C.deep, color: 'auto' } })) })
    const mapRow = (m: WorkbookModuleFill) => new TableRow({ children: [
      cell([P([run(AR(m.n), { bold: true, color: C.deep })], { alignment: AlignmentType.CENTER, spacing: { after: 0 } })], mapWidths[0], { borders: boxed }),
      cell([P(v(m.title, '[اسمُ المحور]'), { spacing: { after: 0 } })], mapWidths[1], { borders: boxed }),
      cell([P(v(rangeAr(m), '[من … إلى …]'), { spacing: { after: 0 } })], mapWidths[2], { borders: boxed }),
      cell([P('[ص …]', { alignment: AlignmentType.CENTER, spacing: { after: 0 } })], mapWidths[3], { borders: boxed }),
    ] })
    const outcomes = fill.modules.map((m) => m.outcome?.trim()).filter((x): x is string => Boolean(x))
    children = [
      ...cover(assets.logo, { kind, title: v(fill.courseTitle, '[اسمُ الدورة]'), sub: v(fill.cohortTitle, '[اسمُ الشعبة]'), facts: [
        ['المدرّب', v(fill.trainerName, '[اسمُك كما يراه المتعلّم]')],
        ['المدّة', v(fill.periodAr, '[من … إلى …]')],
        ['المستوى', v(fill.levelAr, '[مبتدئ — متوسّط]')],
        ['المحاور', filled ? AR(fill.modules.length) : '[عددُها]'],
      ] }),
      pageBreak(),
      ...trainerPage(filled
        ? ['محورٌ في كلّ صفحةٍ جديدة.', `فيها محاورُك كلُّها (${AR(fill.modules.length)}) بترتيبها في خطّتك. ثمّ اكتب في «خريطة المحاور» صفحةَ بداية كلّ محور.`]
        : ['محورٌ في كلّ صفحةٍ جديدة.', 'في القالب ثلاثةُ محاور. لمحورٍ زائدٍ انسخ قسمَ محورٍ كاملا — من «المحور» إلى «مصادرُ للاستزادة» — والصقه بعده، ولمحورٍ ناقصٍ احذف قسمَه. ثمّ اكتب في «خريطة المحاور» صفحةَ بداية كلّ محور.'],
      filled),
      h1('قبل أن تبدأ', { pageBreakBefore: true }),
      label('عن الدورة', { spacing: { before: 200, after: 40 } }),
      ...(fill.summaryAr?.trim() ? markdownParagraphs(fill.summaryAr) : [P('[نبذةُ الدورة في ثلاثة أسطر: لمن هي، وما المشكلةُ التي تحلّها.]')]),
      label('ما ستخرج به من الدورة', { spacing: { before: 200, after: 80 } }),
      box(outcomes.length > 0
        ? [P([run('في آخر الدورة تستطيع أن:', { bold: true, color: C.ink })], { spacing: { after: 80 } }),
            ...outcomes.map((o, i) => bullet([run(o, { bold: true, color: C.ink })], i === outcomes.length - 1 ? { spacing: { after: 0 } } : {}))]
        : [P([run('[جملةُ «ما يخرج به المتعلّم» التي كتبتها في المنصّة — مثلا: تخرج بخطّة تفاوضٍ مكتوبةٍ لموقفٍ حقيقيٍّ من عملك.]', { bold: true, color: C.ink })], { spacing: { after: 0 } })],
      { fill: C.tealTint, border: C.tealTint }),
      gap(200),
      ...howTo(),
      label('خريطةُ المحاور', { spacing: { before: 280, after: 80 } }),
      table([headRow, ...fill.modules.map(mapRow)], mapWidths),
      ...note('صفحةُ بداية كلّ محورٍ هي ما تكتبه — إن شئت — في المنصّة في «أين يبدأ كلُّ محور»، فيفتح المتعلّمُ الكرّاسةَ على محوره.', { tail: false }),
      ...fill.modules.flatMap((m) => moduleBlock(m, { breakBefore: true })),
      h1('مشروعُ التخرّج', { pageBreakBefore: true }),
      label('ما تسلّمه في آخر الدورة', { spacing: { before: 200, after: 80 } }),
      box(fill.project
        ? [P([run(fill.project.title, { bold: true, color: C.ink })], { spacing: { after: fill.project.brief ? 80 : 0 } }),
            ...(fill.project.brief?.trim() ? markdownParagraphs(fill.project.brief) : [])]
        : [P([run('[وصفُ المشروع في ثلاثة أسطر: ماذا يسلّم المتعلّم، وبأيّ شكل، ومتى.]', { bold: true, color: C.ink })], { spacing: { after: 0 } })],
      { fill: C.tealTint, border: C.tealTint }),
      label('كيف يُقيَّم', { spacing: { before: 240, after: 60 } }),
      bullet('[المعيارُ الأوّل]'), bullet('[الثاني]'), bullet('[الثالث]'),
      ...note('هو مشروعُ التخرّج نفسُه الذي تكتبه في «المهامّ والمصادر» — بوصفه ومعاييره.'),
      label('خطّتي للمشروع', { spacing: { before: 200, after: 60 } }),
      lines(8),
      ...notesPage(),
    ]
  } else {
    kind = 'كرّاسةُ المحور'
    const mods = fill.modules
    const one = mods.length === 1
    const titles = mods.map((m) => m.title?.trim()).filter(Boolean) as string[]
    title = filled ? `كرّاسةُ ${axesAr(mods)} — ${v(fill.courseTitle, 'الدورة')}` : 'قالبُ كرّاسة المحور — أكاديمية وجيز'
    children = [
      ...cover(assets.logo, {
        kind,
        title: filled && titles.length > 0 ? titles.join(' · ') : '[اسمُ المحور]',
        sub: filled ? `${axesAr(mods)} من دورة ${v(fill.courseTitle, '[اسمُ الدورة]')}` : 'المحور [رقمُه] من دورة [اسمُ الدورة]',
        facts: [
          ['الدورة', v(fill.courseTitle, '[اسمُ الدورة]')],
          ['الشعبة', v(fill.cohortTitle, '[اسمُ الشعبة]')],
          ['المدرّب', v(fill.trainerName, '[اسمُك كما يراه المتعلّم]')],
          ['الموعد', v(rangeAr(mods[0], mods[mods.length - 1]), '[من … إلى …]')],
        ],
      }),
      pageBreak(),
      ...trainerPage(one && filled
        ? ['محورٌ أو أكثر.', 'هذه كرّاستُه وحدَه. وإن جمعته في المنصّة مع محورٍ مجاور فنزّل قالبَ الكرّاسة المجموعة من بطاقتها هناك — تأتي بالمحورين معا.']
        : one
          ? ['محورٌ أو أكثر.', 'إن جمعت في هذه الكرّاسة محورين متجاورين فانسخ أقسامَ المحور كاملةً — من «المحور» إلى «مصادرُ للاستزادة» — والصقها بعدها للمحور الثاني، واكتب على الغلاف «المحوران [١ و٢]».']
          : ['محاورُ مجموعة.', `فيها ${axesAr(mods)} كما جمعتها في المنصّة — كلُّ محورٍ بأقسامه الستّة، يبدأ بصفحةٍ جديدة.`],
      filled),
      pageBreak(),
      ...howTo(),
      gap(240),
      ...mods.flatMap((m, i) => moduleBlock(m, { breakBefore: i > 0 })),
      ...notesPage(),
    ]
  }
  const raw = await Packer.toBuffer(document({ title, kind, regular: assets.regular, children }))
  return embedBold(raw, assets.bold)
}

/* ─────────── من الورشة إلى ما يُملأ — محضٌ بلا قاعدة ───────────

   ما يُكتب في الكرّاسة هو ما في الخطّة المحفوظة لحظةَ التنزيل، لا ما على
   الشاشة: تنزيلٌ يقرأ الخادمَ لا المتصفّح. والمحاورُ محاورُ الخطّة، أو محاورُ
   الدورة إن لم يُرتّبها بعد — كما تعرضها الورشةُ نفسُها. */

/** أسماءُ أنواع المصادر — كما في `src/components/resource-kind-meta.ts` (وحارسُ تطابقهما
    في `workbook-docx.test.ts`): ذاك يحمل أيقوناتٍ فلا يُستورد هنا */
export const RESOURCE_KIND_AR: Record<ResourceKind, string> = {
  link: 'رابط', video: 'فيديو', book: 'كتاب', audiobook: 'كتاب صوتيّ', social: 'منشور', file: 'ملفّ',
}

interface FillModule {
  moduleId: string; titleAr?: string | null; outcomeAr?: string | null; activityAr?: string | null
  artifactAr?: string | null; bodyAr?: string | null
}
export interface WorkbookFillInput {
  courseTitle: string | null
  cohortTitle: string | null
  trainerName: string | null
  period: { startsOn: string; endsOn: string } | null
  content: {
    summaryAr?: string | null; modules?: FillModule[] | null; level?: unknown
    slots?: { startsOn: string; endsOn: string; moduleIds: string[] }[] | null
    resources?: { title?: string | null; url?: string | null; kind?: string | null; category?: string | null; moduleId?: string | null }[] | null
  } | null
  baseModules: FillModule[]
  sessions: { startsAt: Date | string; status: string; placeholder: boolean; moduleIds?: string[] | null }[]
  assessments: { title: string; type: string; briefAr: string | null }[]
}

const ymdAr = (ymd: string) => fmtDateWith(`${ymd}T12:00:00Z`, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** ما يُملأ به — للدورة كلِّها، أو لمحاورَ بعينها (كرّاسةُ محورٍ أو مجموعة).
    و`null` إن سُمّيت محاورُ ليست في الخطّة. */
export function workbookFill(input: WorkbookFillInput, moduleIds?: readonly string[]): WorkbookFill | null {
  const c = input.content
  const modules = c?.modules?.length ? c.modules : input.baseModules
  const order = modules.map((m) => m.moduleId)
  const picked = moduleIds?.length ? order.filter((id) => moduleIds.includes(id)) : order
  if (moduleIds?.length && picked.length === 0) return null
  const slots = c?.slots ?? []
  const live = (id: string) => input.sessions
    .filter((x) => !x.placeholder && x.status !== 'cancelled' && (x.moduleIds ?? []).includes(id))
    .map((x) => new Date(x.startsAt))
    .sort((a, b) => a.getTime() - b.getTime())[0]
  const fillModule = (id: string): WorkbookModuleFill => {
    const m = modules.find((x) => x.moduleId === id)!
    const slot = slots.find((s) => s.moduleIds.includes(id))
    const at = live(id)
    return {
      n: order.indexOf(id) + 1,
      title: m.titleAr?.trim() || null,
      startsOn: slot?.startsOn ?? null,
      endsOn: slot?.endsOn ?? null,
      liveAr: at ? fmtDateWith(at, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: ACADEMY_ZONE }) : null,
      outcome: m.outcomeAr?.trim() || null,
      body: m.bodyAr?.trim() || null,
      activity: m.activityAr?.trim() || null,
      artifact: m.artifactAr?.trim() || null,
      /* المسجَّلُ جلسةٌ لا مصدرُ قراءة — يبقى في «اللقاءات» */
      resources: (c?.resources ?? [])
        .filter((r) => r.moduleId === id && resourceCategory(r) !== 'recorded' && r.title?.trim())
        .map((r) => ({ title: r.title!.trim(), kindAr: RESOURCE_KIND_AR[resourceKind(r.kind)], url: r.url?.trim() || null })),
    }
  }
  const project = input.assessments.find((a) => a.type === 'project')
  return {
    kind: moduleIds?.length ? 'module' : 'course',
    courseTitle: input.courseTitle?.trim() || null,
    cohortTitle: input.cohortTitle?.trim() || null,
    trainerName: input.trainerName?.trim() || null,
    periodAr: input.period ? `من ${ymdAr(input.period.startsOn)} إلى ${ymdAr(input.period.endsOn)}` : null,
    levelAr: levelRangeAr(asLevelRange(c?.level)),
    summaryAr: c?.summaryAr?.trim() || null,
    modules: picked.map(fillModule),
    project: project ? { title: project.title, brief: project.briefAr?.trim() || null } : null,
  }
}

/** اسمُ الملفّ كما يُنزَّل — «كرّاسة التفاوض.docx» أو «كرّاسة المحور ٢ — التفاوض.docx» */
export function workbookFileName(fill: WorkbookFill): string {
  const course = fill.courseTitle ?? 'الدورة'
  const name = fill.kind === 'course' ? `كرّاسة ${course}` : `كرّاسة ${axesAr(fill.modules).replace(/ـ/g, '')} — ${course}`
  return `${name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()}.docx`
}
