/* قالبا كرّاسة وجيز — كرّاسةُ الدورة وكرّاسةُ المحور، بصيغة Word.

   ═══ القرار (٦ أكتوبر ٢٠٢٦) ═══

   طلب صاحبُ المنصّة أن يُعطى المدرّبُ «قالبنا الخاصّ بصيغة Word، يملؤه بموادّ
   المحور أو الدورة بما يوافق معاييرنا — الـtouch and feel». واختار: قالبين
   مختلفين (للدورة كاملةً، وللمحور الواحد)، بالأقسام المقترحة — الغلاف، وما
   سيخرج به، والأفكارُ الأساسيّة، ومثالٌ محلول، وتمرينٌ عمليّ، وأسئلةٌ للتأمّل،
   ومصادر — والرفعُ PDF وحدَه والقالبُ Word.

   ═══ وثلاثةُ قراراتِ صنعةٍ فيه ═══

   ① **ما يُستبدل بشكله النهائيّ لا رماديّا.** في Word ما يُكتب فوق نصٍّ مظلَّلٍ
      يأخذ شكلَه — فلو كان النصُّ البديلُ رماديّا لصار كلامُ المدرّب رماديّا
      في الكرّاسة المنشورة. فيُعرف بقوسَيه [ هكذا ] لا بلونه.
   ② **ما للمدرّب في صناديقَ صفراءَ يحذفها**، وصفحةٌ أولى له وحدَه. وما للمتعلّم
      بلون الهويّة.
   ③ **الخطُّ مضمَّنٌ في الملفّ** — IBM Plex Sans Arabic، خطُّ واجهة المنصّة،
      برخصة OFL التي تبيح تضمينَه. ولولاه لفتحه المدرّبُ بخطٍّ بديلٍ على جهازه
      وصدّر PDF بغير هويّتنا. والعريضُ مضمَّنٌ مع العاديّ (`embedBold`) — وإلّا
      رسم Word العريضَ من العاديّ تقليدا.
      ولا يُعتمد في الاتّجاه على يمينٍ ويسار: الجداولُ `bidiVisual` والمسافاتُ
      `start` والمحاذاةُ بلا تحديدٍ أو وسط — فلا يختلف Word وLibreOffice عليه.

   الاستعمال (أداةٌ محلّيّةٌ خارجَ البناء، كـ`scripts/catalog-xlsx`):

     NODE_PATH=<حيث docx@9> node scripts/workbook-template/build.mjs

   تحتاج `docx` (npm، الإصدار ٩) — ولا تُضاف إلى `package.json`. وتنزّل الخطَّ
   من Google Fonts إلى مجلّدٍ مؤقّتٍ أوّلَ مرّة. وتكتب الملفّين في
   `public/templates/` حيث تنزّلهما الخطوةُ الثالثة. */

import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const D = require('docx')
const JSZip = require('jszip')
const {
  AlignmentType, BorderStyle, CharacterSet, Document, Footer, Header, HeightRule, ImageRun, LevelFormat,
  LineRuleType, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Tab, Table, TableCell, TableLayoutType,
  TableRow, TextRun, WidthType,
} = D

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'public', 'templates')

/* ─── الهويّة: ألوانُ `src/index.css` نفسُها ─── */
const C = {
  teal: '38A7B4', deep: '247B84', ink: '1A5C64', gold: 'FABC05', goldInk: '6B5200',
  goldTint: 'FFF6D9', tealTint: 'EAF6F7', text: '1F2A2E', muted: '5F6B6E', line: 'C5D1D3', white: 'FFFFFF',
}
const FONT = 'IBM Plex Sans Arabic'
const PAGE = { w: 11906, h: 16838 } // A4
const MARGIN = 1134 // سنتيمتران
const W = PAGE.w - 2 * MARGIN // عرضُ المتن

/* ─── الخطّ: من Google Fonts بشريحته العربيّة — وإلّا جاء لاتينيّا وحدَه ─── */
function ensureFonts() {
  const dir = join(tmpdir(), 'wajeez-workbook-fonts')
  const files = { regular: join(dir, 'IBMPlexSansArabic-Regular.ttf'), bold: join(dir, 'IBMPlexSansArabic-Bold.ttf') }
  if (existsSync(files.regular) && existsSync(files.bold)) return files
  mkdirSync(dir, { recursive: true })
  /* وكيلُ مستخدمٍ قديم: فيُجاب بـ`ttf` لا `woff2` — وWord لا يضمّن إلّا TrueType */
  const css = execFileSync('curl', ['-sS', '-A', 'Mozilla/4.0',
    'https://fonts.googleapis.com/css?family=IBM+Plex+Sans+Arabic:400,700&subset=arabic,latin']).toString()
  const urls = [...css.matchAll(/font-weight: (\d+);\s*src: url\(([^)]+\.ttf)\)/g)]
  for (const [, weight, url] of urls) {
    const to = weight === '700' ? files.bold : files.regular
    execFileSync('curl', ['-sS', '-o', to, url])
  }
  if (!existsSync(files.regular) || !existsSync(files.bold)) throw new Error('تعذّر تنزيلُ الخطّ')
  return files
}

/* ─── لبناتُ النصّ ─── */
const run = (text, o = {}) => new TextRun({ text, rightToLeft: true, font: FONT, color: C.text, ...o })
/* وتباعدُ الأسطر «تلقائيٌّ» صريحا: بلا `lineRule` يقرؤه LibreOffice ارتفاعا ثابتا
   فيقصّ العنوانَ الكبيرَ والشعار */
const P = (children, o = {}) => {
  const spacing = o.spacing?.line ? { lineRule: LineRuleType.AUTO, ...o.spacing } : o.spacing
  return new Paragraph({ bidirectional: true, children: typeof children === 'string' ? [run(children)] : children, ...o, spacing })
}
const gap = (after = 120) => new Paragraph({ bidirectional: true, spacing: { before: 0, after }, children: [] })
const pageBreak = () => new Paragraph({ bidirectional: true, children: [new PageBreak()] })

const NONE = { style: BorderStyle.NONE, size: 0, color: C.white }
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE }
const cellNone = { top: NONE, bottom: NONE, left: NONE, right: NONE }

/** جدولٌ يُقرأ من اليمين — `bidiVisual` فلا يُعتمد على يمينٍ ويسار */
const table = (rows, widths, o = {}) =>
  new Table({
    visuallyRightToLeft: true,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows,
    ...o,
  })

const cell = (children, width, o = {}) =>
  new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 100, bottom: 100, left: 160, right: 160 },
    borders: cellNone,
    children,
    ...o,
  })

/** صندوقٌ بلونٍ واحد — للمتعلّم بلون الهويّة، وللمدرّب أصفر */
function box(children, { fill, border }) {
  const b = { style: BorderStyle.SINGLE, size: 6, color: border }
  return table([
    new TableRow({ children: [cell(children, W, {
      shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
      borders: { top: b, bottom: b, left: b, right: b },
      margins: { top: 160, bottom: 160, left: 240, right: 240 },
    })] }),
  ], [W])
}

/** ملاحظةٌ للمدرّب — صندوقٌ أصفرُ يحذفه قبل التصدير */
const note = (text) => [
  gap(60),
  box([P([run('للمدرّب — ', { bold: true, color: C.goldInk, size: 19 }), run(text, { color: C.goldInk, size: 19 }),
    run('  (احذف هذا الصندوق)', { color: C.goldInk, size: 17 })], { spacing: { after: 0, line: 300 } })],
  { fill: C.goldTint, border: C.gold }),
  gap(120),
]

/** أسطرُ كتابةٍ للمتعلّم — صفوفٌ بخطٍّ سفليٍّ وحدَه.
    لا فقراتٌ بحدٍّ سفليّ: Word يدمج الفقراتِ المتتاليةَ المتماثلةَ الحدودِ في صندوقٍ واحد. */
const lines = (n) => {
  const b = { style: BorderStyle.DOTTED, size: 6, color: C.line }
  return table(Array.from({ length: n }, () => new TableRow({
    height: { value: 520, rule: HeightRule.EXACT },
    children: [cell([P('')], W, { borders: { top: NONE, left: NONE, right: NONE, bottom: b } })],
  })), [W])
}

/** عنوانُ قسمٍ في المحور: رقمٌ على الذهبيّ ثمّ اسمُه */
const h2 = (num, title) =>
  P([run(` ${num} `, { bold: true, size: 26, shading: { type: ShadingType.CLEAR, fill: C.gold, color: 'auto' } }),
    run('  ' + title, { bold: true, size: 28, color: C.ink })],
  { heading: 'Heading2', spacing: { before: 360, after: 140 }, keepNext: true })

const h1 = (title, o = {}) =>
  P([run(title, { bold: true, size: 40, color: C.deep })], {
    heading: 'Heading1', spacing: { before: 0, after: 120 }, keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.teal, space: 6 } }, ...o,
  })

const label = (text, o = {}) => P([run(text, { bold: true, size: 22, color: C.goldInk })], { spacing: { after: 40 }, keepNext: true, ...o })

const bullet = (text, o = {}) =>
  P(typeof text === 'string' ? [run(text)] : text, { numbering: { reference: 'wz-bullet', level: 0 }, spacing: { after: 80 }, ...o })

/** سطرٌ مرقَّمٌ بأرقامٍ تُكتب لا تُولَّد — `hindiNumbers` في الترقيم الآليّ لا يتّفق
    عليه Word وLibreOffice، والأرقامُ في المنصّة كلِّها ١ ٢ ٣ */
const AR = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
const numbered = (i, text) =>
  P([run(AR[i], { bold: true, color: C.deep }), new TextRun({ children: [new Tab()], rightToLeft: true }),
    ...(typeof text === 'string' ? [run(text)] : text)],
  { indent: { start: 400, hanging: 400 }, spacing: { after: 80 } })
const numberedList = (items) => items.map((t, i) => numbered(i, t))

/* ─── الغلاف ─── */
function cover({ logo, kind, title, sub, facts }) {
  const factRow = ([k, v]) => {
    const b = { style: BorderStyle.SINGLE, size: 4, color: C.line }
    const borders = { top: NONE, left: NONE, right: NONE, bottom: b }
    return new TableRow({ children: [
      cell([P([run(k, { bold: true, color: C.ink })], { spacing: { after: 0 } })], 2400, { borders }),
      cell([P([run(v)], { spacing: { after: 0 } })], W - 2400, { borders }),
    ] })
  }
  const nameB = { style: BorderStyle.SINGLE, size: 8, color: C.teal }
  return [
    P([new ImageRun({ type: 'png', data: logo.full, transformation: { width: 104, height: 178 },
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

/* ─── صفحةُ المدرّب ─── */
function trainerPage(extra) {
  const pt = (b, t) => [run(b + ' ', { bold: true, color: C.goldInk }), run(t, { color: C.text })]
  return [
    box([
      P([run('قبل أن تكتب — للمدرّب', { bold: true, size: 34, color: C.goldInk })], { spacing: { after: 80 } }),
      P([run('هذه الصفحةُ لك وحدَك: اقرأها ثمّ احذفها، واحذف الصناديقَ الصفراءَ كلَّها، قبل أن تحفظ الكرّاسةَ PDF.', { color: C.goldInk })],
        { spacing: { after: 240 } }),
      ...numberedList([pt('ما بين قوسين اكتب مكانَه.', 'كلُّ نصٍّ [ هكذا ] مكانٌ لكلامك: ظلِّله من القوس إلى القوس واكتب فوقه، فيأخذ كلامُك شكلَه.'),
      pt('الشكلُ واحدٌ في كرّاسات وجيز كلِّها.', 'لا تغيّر الخطَّ ولا الألوانَ ولا ترتيبَ الأقسام — بها يعرف المتعلّمُ طريقَه في كلّ دورة. وزِد ما شئت داخلَ الأقسام: صورا وجداولَ ونماذج.'),
      pt('اكتب لمن يقرأ وحدَه.', 'جملٌ قصيرة، ومثالٌ من عمل المتعلّم لا من كتاب، والمصطلحُ الإنجليزيُّ بين قوسين أوّلَ مرّةٍ فقط.'),
      pt('الكرّاسةُ للعمل لا للقراءة وحدَها.', 'في كلّ محورٍ ما يملؤه المتعلّم: جدولٌ يعمل عليه، ومساحةٌ يكتب فيها، فيفتحها في اللقاء وبعده.'),
      pt(extra[0], extra[1]),
      pt('احفظها PDF وارفعها.', 'من «ملف» اختر «حفظ باسم» ثمّ PDF، وارفعها في الخطوة الثالثة «الكرّاسة» في مساحة شعبتك. والمنصّةُ تقبل PDF وحدَه: يُفتح في الصفحة على أيّ جهاز، ولا يتغيّر شكلُه.'),
      pt('الخطّ.', 'الكرّاسةُ بخطّ IBM Plex Sans Arabic، وهو مضمَّنٌ فيها. فإن ظهر لك خطٌّ غيرُه فثبّته مجّانا من fonts.google.com ثمّ أعد فتحها.')]),
    ], { fill: C.goldTint, border: C.gold }),
  ]
}

/* ─── كيف تستعمل هذه الكرّاسة — للمتعلّم ─── */
const howTo = () => [
  box([
    P([run('كيف تستعمل هذه الكرّاسة', { bold: true, size: 24, color: C.ink })], { spacing: { after: 100 } }),
    ...numberedList([
      'اقرأ «الأفكارَ الأساسيّة» قبل اللقاء المباشر.',
      'احملها إلى اللقاء: فيه نحلّ المثالَ معا ونبدأ التمرين.',
      'أكمل التمرينَ وأسئلةَ التأمّل بعد اللقاء — وعليها تبني مهمّةَ المحور.',
    ]),
  ], { fill: C.tealTint, border: C.tealTint }),
]

/* ─── المحور: ستّةُ أقسامٍ بترتيبٍ واحدٍ في كلّ كرّاسة ─── */
function moduleBlock(n, { opener = true } = {}) {
  const idea = (k) => [
    P([run(`${k} · `, { bold: true, color: C.deep }), run('[عنوانُ الفكرة في سطرٍ واحد]', { bold: true })], { spacing: { before: 160, after: 60 }, keepNext: true }),
    P('[اشرحها في ثلاثة أسطرٍ أو أربعة، بلغةِ من يقرأ وحدَه.]'),
    P([run('في عملك: ', { bold: true, color: C.ink }), run('[أين يلقاها المتعلّمُ في يومه.]')]),
  ]
  const exRow = (k, children) => {
    const b = { style: BorderStyle.SINGLE, size: 4, color: C.line }
    const borders = { top: b, bottom: b, left: b, right: b }
    return new TableRow({ cantSplit: true, children: [
      cell([P([run(k, { bold: true, color: C.ink })], { spacing: { after: 0 }, keepNext: true })], 2200, {
        borders, shading: { type: ShadingType.CLEAR, fill: C.tealTint, color: 'auto' } }),
      cell(children, W - 2200, { borders }),
    ] })
  }
  const grid = (cols, rows) => {
    const b = { style: BorderStyle.SINGLE, size: 4, color: C.line }
    const borders = { top: b, bottom: b, left: b, right: b }
    const w = Math.floor(W / cols.length)
    const widths = cols.map((_, i) => (i === cols.length - 1 ? W - w * (cols.length - 1) : w))
    return table([
      new TableRow({ tableHeader: true, cantSplit: true, children: cols.map((t, i) => cell([P([run(t, { bold: true, color: C.white })], { spacing: { after: 0 }, keepNext: true })], widths[i], {
        borders, shading: { type: ShadingType.CLEAR, fill: C.deep, color: 'auto' } })) }),
      /* الجدولُ لا يُشطَر على صفحتين — «مع التالي» في كلّ صفٍّ إلّا الأخير */
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, height: { value: 640, rule: HeightRule.ATLEAST },
        children: widths.map((wd, i) => cell([P(r[i] ?? '', { spacing: { after: 0 }, keepNext: ri < rows.length - 1 })], wd, { borders })) })),
    ], widths)
  }
  const question = (k, q) => [
    P([run(`${k}  `, { bold: true, color: C.deep }), run(q, { bold: true })], { spacing: { before: 160, after: 40 }, keepNext: true }),
    lines(3),
  ]
  return [
    ...(opener ? [
      label(`المحور ${n}`),
      h1('[اسمُ المحور]'),
      P([run('الموعد: ', { bold: true, color: C.ink }), run('[من … إلى …]'), run('   ·   ', { color: C.muted }),
        run('اللقاءُ المباشر: ', { bold: true, color: C.ink }), run('[اليومُ والساعة]')], { spacing: { after: 200 } }),
    ] : []),

    h2('١', 'ما ستخرج به'),
    box([
      P([run('في آخر هذا المحور تستطيع أن:', { bold: true, color: C.ink })], { spacing: { after: 80 } }),
      bullet('[فعلٌ يُرى ويُقاس — مثلا: تكتب مذكّرةَ تحضيرٍ لتفاوضٍ قادم]'),
      bullet('[الفعلُ الثاني]'),
      bullet('[الفعلُ الثالث — إن كان]', { spacing: { after: 0 } }),
    ], { fill: C.tealTint, border: C.tealTint }),
    ...note('اكتب ما يستطيع المتعلّمُ أن يفعله، لا ما سيعرفه: «تكتب مذكّرةَ تحضير» لا «يفهم التفاوض». وأوّلُها جملةُ «ما يخرج به» التي كتبتها لهذا المحور في المنصّة.'),

    h2('٢', 'الأفكارُ الأساسيّة'),
    ...note('من ثلاث أفكارٍ إلى خمس، لكلٍّ عنوانُها. والفكرةُ التي لا يستعملها التمرينُ لا مكانَ لها هنا.'),
    ...idea('١'), ...idea('٢'), ...idea('٣'),

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
    ...numberedList(['[اختر موقفا من عملك …]', '[طبّق عليه …]', '[اكتب ما خرجت به في الجدول.]']),
    gap(80),
    grid(['[العمودُ الأوّل]', '[الثاني]', '[الثالث]'], [[], [], [], []]),
    ...note('التمرينُ على موقفٍ من عمل المتعلّم نفسِه، وما يكتبه هنا يبني عليه مهمّةَ المحور في المنصّة. وغيّر أعمدةَ الجدول بما يحتاجه تمرينُك.'),

    h2('٥', 'أسئلةٌ للتأمّل'),
    ...question('١', '[سؤالٌ يربط الفكرةَ بعمله: أين …؟]'),
    ...question('٢', '[سؤالٌ عمّا سيفعله بعد اللقاء: ما أوّلُ …؟]'),
    ...question('٣', '[سؤالٌ عمّا يقيس به تقدّمَه: كيف ستعرف …؟]'),
    ...note('أسئلةٌ لا جوابَ صحيحا لها — يكتب المتعلّمُ فيها عن نفسه.'),

    h2('٦', 'مصادرُ للاستزادة'),
    grid(['المصدر', 'نوعُه', 'لماذا يستحقّ وقتَك'], [
      ['[اسمُ المصدر ورابطُه]', '[قراءة / فيديو / أداة]', '[سطرٌ واحد]'],
      ['[…]', '[…]', '[…]'],
      ['[…]', '[…]', '[…]'],
    ]),
    ...note('هي المصادرُ نفسُها التي تضيفها لهذا المحور في «المهامّ والمصادر» — اذكرها هنا ليجدها من يطبع الكرّاسة.'),
  ]
}

const notesPage = () => [h1('ملاحظاتي'), gap(120), lines(22)]

/* ─── الترويسة والتذييل: في الوسط، فلا يُعتمد على يمينٍ ويسار ─── */
const header = (kind) => new Header({ children: [
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
const blank = () => new Header({ children: [new Paragraph({ children: [] })] })

/* ─── المستند ─── */
function numbering() {
  const level = (format, text) => ({
    level: 0, format, text, alignment: AlignmentType.START,
    style: {
      paragraph: { indent: { start: 440, hanging: 360 } },
      run: { font: FONT, bold: format !== LevelFormat.BULLET, color: C.deep },
    },
  })
  return { config: [
    { reference: 'wz-bullet', levels: [level(LevelFormat.BULLET, '•')] },
  ] }
}

function doc({ title, kind, fonts, sections }) {
  return new Document({
    creator: 'أكاديمية وجيز',
    title,
    description: 'قالبُ كرّاسة أكاديمية وجيز — يُملأ ثمّ يُحفظ PDF ويُرفع في مساحة الشعبة.',
    fonts: [{ name: FONT, data: fonts.regular, characterSet: CharacterSet.ARABIC }],
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
    numbering: numbering(),
    sections: sections.map((children, i) => ({
      properties: {
        page: { size: { width: PAGE.w, height: PAGE.h }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 560, footer: 560 } },
        titlePage: i === 0,
      },
      headers: i === 0 ? { first: blank(), default: header(kind) } : { default: header(kind) },
      footers: i === 0 ? { first: blank(), default: footer() } : { default: footer() },
      children,
    })),
  })
}

/* ─── تضمينُ العريض — `docx` يضمّن العاديَّ وحدَه ─── */
function obfuscate(buf, key) {
  const bytes = key.replace(/[{}-]/g, '').match(/../g).map((h) => parseInt(h, 16)).reverse()
  const out = Buffer.from(buf)
  for (let i = 0; i < 32; i++) out[i] ^= bytes[i % bytes.length]
  return out
}

async function embedBold(buffer, boldData) {
  const zip = await JSZip.loadAsync(buffer)
  const key = `{${randomUUID().toUpperCase()}}`
  zip.file('word/fonts/font-bold.odttf', obfuscate(boldData, key))
  const relsPath = 'word/_rels/fontTable.xml.rels'
  const rels = await zip.file(relsPath).async('string')
  zip.file(relsPath, rels.replace('</Relationships>',
    '<Relationship Id="rIdWzBold" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font-bold.odttf"/></Relationships>'))
  const table = await zip.file('word/fontTable.xml').async('string')
  const withBold = table.replace(/(<w:font w:name="IBM Plex Sans Arabic">[\s\S]*?<w:embedRegular [^>]*\/>)/,
    `$1<w:embedBold r:id="rIdWzBold" w:fontKey="${key}"/>`)
  if (withBold === table) throw new Error('لم يُعثر على الخطّ المضمَّن في fontTable.xml')
  zip.file('word/fontTable.xml', withBold)
  /* وبلا `embedTrueTypeFonts` يُسقط Word الخطَّ أوّلَ ما يحفظ المدرّبُ الملفّ */
  const settings = await zip.file('word/settings.xml').async('string')
  if (!settings.includes('w:embedTrueTypeFonts')) {
    /* موضعُه في المخطّط بعد `displayBackgroundShape` — وهو أوّلُ ما يكتبه `docx` */
    const anchor = '<w:displayBackgroundShape/>'
    const pos = settings.includes(anchor) ? settings.indexOf(anchor) + anchor.length : settings.indexOf('>', settings.indexOf('<w:settings')) + 1
    zip.file('word/settings.xml', settings.slice(0, pos) + '<w:embedTrueTypeFonts/>' + settings.slice(pos))
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

/* ─── القالبان ─── */
async function build() {
  const files = ensureFonts()
  const fonts = { regular: readFileSync(files.regular), bold: readFileSync(files.bold) }
  const logo = { full: readFileSync(join(ROOT, 'public', 'logo-full.png')) }
  mkdirSync(OUT, { recursive: true })

  /* ① كرّاسةُ الدورة: الغلاف · للمدرّب · قبل أن تبدأ · ثلاثةُ محاور · مشروعُ التخرّج · ملاحظاتي */
  const mapRow = (k) => {
    const b = { style: BorderStyle.SINGLE, size: 4, color: C.line }
    const borders = { top: b, bottom: b, left: b, right: b }
    return new TableRow({ children: [
      cell([P([run(k, { bold: true, color: C.deep })], { alignment: AlignmentType.CENTER, spacing: { after: 0 } })], 1000, { borders }),
      cell([P('[اسمُ المحور]', { spacing: { after: 0 } })], 4438, { borders }),
      cell([P('[من … إلى …]', { spacing: { after: 0 } })], 2600, { borders }),
      cell([P('[ص …]', { alignment: AlignmentType.CENTER, spacing: { after: 0 } })], 1600, { borders }),
    ] })
  }
  const headRow = (cols, widths) => {
    const b = { style: BorderStyle.SINGLE, size: 4, color: C.line }
    return new TableRow({ tableHeader: true, children: cols.map((t, i) => cell([P([run(t, { bold: true, color: C.white })],
      { alignment: AlignmentType.CENTER, spacing: { after: 0 } })], widths[i], {
      borders: { top: b, bottom: b, left: b, right: b }, shading: { type: ShadingType.CLEAR, fill: C.deep, color: 'auto' } })) })
  }
  const mapWidths = [1000, 4438, 2600, 1600]

  const course = doc({
    title: 'قالبُ كرّاسة الدورة — أكاديمية وجيز',
    kind: 'كرّاسةُ الدورة',
    fonts,
    sections: [[
      ...cover({ logo, kind: 'كرّاسةُ الدورة', title: '[اسمُ الدورة]', sub: '[اسمُ الشعبة]', facts: [
        ['المدرّب', '[اسمُك كما يراه المتعلّم]'],
        ['المدّة', '[من … إلى …]'],
        ['المستوى', '[مبتدئ — متوسّط]'],
        ['المحاور', '[عددُها]'],
      ] }),
      pageBreak(),
      ...trainerPage(['محورٌ في كلّ صفحةٍ جديدة.', 'في القالب ثلاثةُ محاور. لمحورٍ زائدٍ انسخ قسمَ محورٍ كاملا — من «المحور» إلى «مصادرُ للاستزادة» — والصقه بعده، ولمحورٍ ناقصٍ احذف قسمَه. ثمّ اكتب في «خريطة المحاور» صفحةَ بداية كلّ محور.']),
      pageBreak(),
      h1('قبل أن تبدأ'),
      label('عن الدورة', { spacing: { before: 200, after: 40 } }),
      P('[نبذةُ الدورة في ثلاثة أسطر: لمن هي، وما المشكلةُ التي تحلّها.]'),
      label('ما ستخرج به من الدورة', { spacing: { before: 200, after: 80 } }),
      box([P([run('[جملةُ «ما يخرج به المتعلّم» التي كتبتها في المنصّة — مثلا: تخرج بخطّة تفاوضٍ مكتوبةٍ لموقفٍ حقيقيٍّ من عملك.]', { bold: true, color: C.ink })], { spacing: { after: 0 } })],
        { fill: C.tealTint, border: C.tealTint }),
      gap(200),
      ...howTo(),
      label('خريطةُ المحاور', { spacing: { before: 280, after: 80 } }),
      table([headRow(['المحور', 'العنوان', 'الموعد', 'يبدأ في'], mapWidths), mapRow('١'), mapRow('٢'), mapRow('٣')], mapWidths),
      ...note('صفحةُ بداية كلّ محورٍ هي ما تكتبه — إن شئت — في المنصّة في «أين يبدأ كلُّ محور»، فيفتح المتعلّمُ الكرّاسةَ على محوره.'),
      pageBreak(), ...moduleBlock('١'),
      pageBreak(), ...moduleBlock('٢'),
      pageBreak(), ...moduleBlock('٣'),
      pageBreak(),
      h1('مشروعُ التخرّج'),
      label('ما تسلّمه في آخر الدورة', { spacing: { before: 200, after: 80 } }),
      box([P([run('[وصفُ المشروع في ثلاثة أسطر: ماذا يسلّم المتعلّم، وبأيّ شكل، ومتى.]', { bold: true, color: C.ink })], { spacing: { after: 0 } })],
        { fill: C.tealTint, border: C.tealTint }),
      label('كيف يُقيَّم', { spacing: { before: 240, after: 60 } }),
      bullet('[المعيارُ الأوّل]'), bullet('[الثاني]'), bullet('[الثالث]'),
      ...note('هو مشروعُ التخرّج نفسُه الذي تكتبه في «المهامّ والمصادر» — بوصفه ومعاييره.'),
      label('خطّتي للمشروع', { spacing: { before: 200, after: 60 } }),
      lines(8),
      pageBreak(),
      ...notesPage(),
    ]],
  })

  /* ② كرّاسةُ المحور: الغلاف · للمدرّب · المحورُ بأقسامه · ملاحظاتي */
  const moduleDoc = doc({
    title: 'قالبُ كرّاسة المحور — أكاديمية وجيز',
    kind: 'كرّاسةُ المحور',
    fonts,
    sections: [[
      ...cover({ logo, kind: 'كرّاسةُ المحور', title: '[اسمُ المحور]', sub: 'المحور [رقمُه] من دورة [اسمُ الدورة]', facts: [
        ['الدورة', '[اسمُ الدورة]'],
        ['الشعبة', '[اسمُ الشعبة]'],
        ['المدرّب', '[اسمُك كما يراه المتعلّم]'],
        ['الموعد', '[من … إلى …]'],
      ] }),
      pageBreak(),
      ...trainerPage(['محورٌ أو أكثر.', 'إن جمعت في هذه الكرّاسة محورين متجاورين فانسخ أقسامَ المحور كاملةً — من «المحور» إلى «مصادرُ للاستزادة» — والصقها بعدها للمحور الثاني، واكتب على الغلاف «المحوران [١ و٢]».']),
      pageBreak(),
      ...howTo(),
      gap(240),
      ...moduleBlock('١'),
      pageBreak(),
      ...notesPage(),
    ]],
  })

  const write = async (name, d) => {
    const raw = await Packer.toBuffer(d)
    const out = await embedBold(raw, fonts.bold)
    writeFileSync(join(OUT, name), out)
    console.log(`${name}: ${(out.length / 1024).toFixed(0)} KB`)
  }
  await write('wajeez-workbook-course.docx', course)
  await write('wajeez-workbook-module.docx', moduleDoc)
}

build().catch((e) => { console.error(e); process.exit(1) })
