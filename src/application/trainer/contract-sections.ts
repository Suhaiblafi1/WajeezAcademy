/* ═══ بنيةُ العقد — تُقرأ من متنه لا تُكتب إلى جانبه ═══

   ─────────── لمَ يُقرأ المتنُ ولا يُبنى مرّتين ───────────

   المتنُ يُجمَّد نصّا في `bodyAr` وتُحفظ بصمتُه، ويُوقَّع على ما عُرض. فلو
   بُني الشكلُ من مصدرٍ ثانٍ — قائمةِ بنودٍ مكتوبةٍ في الواجهة — لافترق
   المعروضُ عن المهشَّم يومَ يُعدَّل أحدُهما، فيوقّع المدرّبُ على غير ما رأى.
   فالبنيةُ هنا **مشتقّةٌ من المتن نفسِه**: مصدرٌ واحدٌ لا اثنان.

   ─────────── والقيدُ الذي يحكم هذا الملفّ كلَّه ───────────

   **لا يسقط سطر.** محلّلٌ يُسقط سطرا لا يطابق أنماطَه يُخفيه عن عين
   الموقِّع ويُبقيه في المهشَّم — فيوقّع إنسانٌ على نصٍّ لم يُعرَض له قطّ.
   ولذلك المحلّلُ **تامٌّ بالبناء**: كلُّ سطرٍ غيرِ فارغٍ يخرج في كتلةٍ ما،
   وما لا يطابق نمطا يصير نصّا كما هو — لا يُهمَل.

   و`documentLinesAr` تردّ ما ستعرضه الوثيقةُ سطرا سطرا، فيُقابَل بالمصدر
   في الحارس (`src/tests/trainer/contract-document.test.ts`). وهي ليست
   زينةً: هي الدليلُ على أنّ المعروضَ هو الموقَّعُ عليه.

   ─────────── ولمَ السطرُ فقرةٌ بلا ضمّ ───────────

   متنُ `contract-body.ts` يكتب الفقرةَ في سطرٍ واحدٍ لا يلفّه بيده (١٠٩
   بنودٍ مرقّمة · ٢٥ سطرا عاديّا · ٥ نقاط). فلا يُضَمّ سطرٌ إلى سطر: الضمُّ
   يلزم متنا ملفوفا بعرضٍ ثابت، وضمُّ ما ليس ملفوفا يُلصق فقرتَين. */

/** كتلةٌ داخل قسم — والترقيمُ يُفصَل ليُبرَز في الشكل لا ليُحذَف */
export type ContractBlock =
  | { kind: 'clause'; numAr: string; textAr: string }
  | { kind: 'bullet'; textAr: string }
  | { kind: 'text'; textAr: string }

export interface ContractSection {
  kind: 'summary' | 'preamble' | 'clause' | 'annex'
  /** رقمُ البند («4») أو حرفُ الملحق («أ») — و`null` لما لا رقمَ له */
  numAr: string | null
  titleAr: string
  blocks: ContractBlock[]
}

export interface ContractMeta { labelAr: string; valueAr: string }

export interface ContractDoc {
  titleAr: string
  meta: ContractMeta[]
  sections: ContractSection[]
}

/* ترويسةُ الصدر — ثلاثةٌ بأسمائها لا كلُّ سطرٍ فيه نقطتان.

   فـ«label:» يرد ثمانيَ مرّاتٍ في المتن، خمسٌ منها **داخل** البنود. ولو
   أُخذ كلُّ ما فيه نقطتان ترويسةً لَانتُزعت جملٌ من أماكنها. */
const META_KEYS = ['المرجع', 'تاريخ الإصدار', 'إصدار الصياغة'] as const
const META_RE = new RegExp(`^(${META_KEYS.join('|')}):\\s*(.*)$`)

const CLAUSE_HEAD_RE = /^البند (\d+) — (.+)$/
const ANNEX_HEAD_RE = /^الملحق \((.)\) — (.+)$/
const SUMMARY_HEAD = 'الخلاصة في سطور'
/* و«ما تعنيه الكلمات» قسمٌ برأسه (v8): يُفتَح له قسمٌ كما يُفتَح للديباجة،
   وإلّا انضمّت بنودُه إلى الخلاصة قبله فقُرئت منها. */
/** رأسُ قسم المعجم — يُصدَّر لأنّ العارضَ يعلّق عليه شكلَه، ونسخةٌ ثانيةٌ
    من النصّ هناك تفترق عنه يومَ يُحرَّر أحدُهما. */
export const GLOSSARY_HEAD = 'ما تعنيه الكلمات في هذا العقد'
const PREAMBLE_HEADS = ['الديباجة', 'تمهيد', GLOSSARY_HEAD] as const
/** بندٌ مرقّم داخل قسم: «4-10 ويتحمل…» — والرقمُ يُبرَز ولا يُطرَح */
const NUMBERED_RE = /^(\d+-\d+)\s+(.+)$/
const BULLET_RE = /^·\s*(.+)$/

/** يُعاد بناءُ سطرِ العنوان كما هو في المتن — فيُقابَل به حرفا بحرف */
export function sectionHeadingAr(s: ContractSection): string {
  if (s.kind === 'clause') return `البند ${s.numAr} — ${s.titleAr}`
  if (s.kind === 'annex') return `الملحق (${s.numAr}) — ${s.titleAr}`
  return s.titleAr
}

export function parseContractDoc(bodyAr: string): ContractDoc {
  const lines = bodyAr.split('\n')
  const titleAr = (lines[0] ?? '').trim()
  const meta: ContractMeta[] = []
  const sections: ContractSection[] = []
  let cur: ContractSection | null = null

  const open = (s: ContractSection) => { sections.push(s); cur = s }
  /* وما ورد قبل أوّل عنوانٍ لا يُهمَل: يُفتح له قسمٌ بلا عنوان فيُعرَض */
  const sink = (): ContractSection => {
    if (!cur) open({ kind: 'preamble', numAr: null, titleAr: '', blocks: [] })
    return cur!
  }

  for (const raw of lines.slice(1)) {
    const l = raw.trim()
    if (!l) continue

    if (!cur) {
      const m = META_RE.exec(l)
      if (m) { meta.push({ labelAr: m[1], valueAr: m[2].trim() }); continue }
    }

    let m: RegExpExecArray | null
    if ((m = CLAUSE_HEAD_RE.exec(l))) { open({ kind: 'clause', numAr: m[1], titleAr: m[2], blocks: [] }); continue }
    if ((m = ANNEX_HEAD_RE.exec(l))) { open({ kind: 'annex', numAr: m[1], titleAr: m[2], blocks: [] }); continue }
    if (l === SUMMARY_HEAD) { open({ kind: 'summary', numAr: null, titleAr: l, blocks: [] }); continue }
    if ((PREAMBLE_HEADS as readonly string[]).includes(l)) { open({ kind: 'preamble', numAr: null, titleAr: l, blocks: [] }); continue }

    const s = sink()
    if ((m = NUMBERED_RE.exec(l))) { s.blocks.push({ kind: 'clause', numAr: m[1], textAr: m[2] }); continue }
    if ((m = BULLET_RE.exec(l))) { s.blocks.push({ kind: 'bullet', textAr: m[1] }); continue }
    s.blocks.push({ kind: 'text', textAr: l })
  }

  return { titleAr, meta, sections }
}

/** نصُّ الكتلة كما يُعرَض — والرقمُ جزءٌ منه، فإبرازُه شكلٌ لا حذف */
export function blockLineAr(b: ContractBlock): string {
  if (b.kind === 'clause') return `${b.numAr} ${b.textAr}`
  if (b.kind === 'bullet') return `· ${b.textAr}`
  return b.textAr
}

/* ═══ الدليلُ على أنّ المعروضَ هو الموقَّعُ عليه ═══

   تردّ كلَّ سطرٍ ستعرضه الوثيقةُ بترتيبه. ويُقابَل في الحارس بأسطر المتن
   غيرِ الفارغة — فإن نقص سطرٌ سقط الحارس، وهو ما يمنع أن يوقّع إنسانٌ على
   ما لم يره. */
export function documentLinesAr(doc: ContractDoc): string[] {
  const out: string[] = [doc.titleAr]
  for (const m of doc.meta) out.push(`${m.labelAr}: ${m.valueAr}`)
  for (const s of doc.sections) {
    if (s.titleAr) out.push(sectionHeadingAr(s))
    for (const b of s.blocks) out.push(blockLineAr(b))
  }
  return out
}

/* ═══ قراءاتٌ ثانيةٌ للكتلة — شكلٌ أوضحُ لنصٍّ لا يتغيّر ═══

   ─────────── القاعدةُ التي تحكمها جميعا ───────────

   **تُشتقّ من السطر، ولا تُكتب إلى جانبه.** عيّنةُ التصميم بنت جدولَ الأتعاب
   وشبكةَ الخلاصة نصّا مكتوبا باليد فيه ٤٥ و٣٠ و٨ — ولو نُقل كما هو لَطبع
   العقدُ أرقاما ثابتةً مهما كان ما وُقّع عليه. فهذه تقرأ السطرَ وتردّ `null`
   إن لم يطابق شكلَه، فيرتدّ العارضُ إلى الفقرة العاديّة.

   والسلامةُ مبنيّةٌ لا موعودة: أيُّ قراءةٍ تُسقط حرفا أو تبدّله يسقط عليها
   حارسُ التمام (`documentLinesAr`) وحارسُ التصيير معا. */

/** بندُ الخلاصة: «· الصفة: عمل حر — والمدرب متعاقد… (البند 1)» */
export interface SummaryItem {
  keyAr: string
  valueAr: string
  /** ما بعد الشرطة — و`''` لبندٍ بلا تفصيل */
  noteAr: string
  /** «(البند 1)» — و`''` لبندٍ بلا إحالة */
  refAr: string
}

const REF_RE = /\s*(\((?:البند|البندان|الملحق)[^)]*\))\s*$/

export function summaryItem(b: ContractBlock): SummaryItem | null {
  if (b.kind !== 'bullet') return null
  let rest = b.textAr
  let refAr = ''
  const r = REF_RE.exec(rest)
  if (r) { refAr = r[1]; rest = rest.slice(0, r.index) }
  const c = rest.indexOf(':')
  if (c < 1) return null
  const keyAr = rest.slice(0, c).trim()
  let valueAr = rest.slice(c + 1).trim()
  let noteAr = ''
  /* والشرطةُ تفصل القيمةَ عن تفصيلها — وليست كلُّ بنودِ الخلاصة بشرطة */
  const d = valueAr.indexOf(' — ')
  if (d > 0) { noteAr = valueAr.slice(d + 3).trim(); valueAr = valueAr.slice(0, d).trim() }
  if (!keyAr || !valueAr) return null
  return { keyAr, valueAr, noteAr, refAr }
}

/* ═══ بندُ المعجم: «· الشعبة: مجموعة من المتعلمين…» ═══

   طلبُ صاحب المنصّة (٢٦ سبتمبر ٢٠٢٦): «ما تعنيه الكلمات مرتّبه كما في
   الملخّص أعلاه لتوضيح الكلمة الرئيسيّة بدلا من أنّها ضمن النصّ».

   والمصطلحُ كان يُقرأ **داخل** الجملة: «· الشعبة: مجموعة من المتعلمين…» سطرا
   واحدا لا يُميَّز فيه المعرَّفُ من تعريفه. ومن يبحث عن معنى «الإسناد» يمسح
   ثماني فقراتٍ متشابهةٍ بعينه. والخلاصةُ فوقَه تفصل المفتاحَ عن قيمته منذ
   بُنيت، فيُعطى المعجمُ نَسَقَها.

   ── ولمَ لا تُستعمل `summaryItem` وهي قريبة ──

   لأنّها تقطع القيمةَ عند « — » وتنتزع «(البند ن)» من آخرها — وذلك صوابٌ في
   الخلاصة: سطرُها «قيمةٌ ثمّ تفصيلٌ ثمّ إحالة». وتعريفُ المعجم جملةٌ تامّةٌ
   قد تحمل شرطةً في وسطها وإحالةً في وسطها («…ويحسم من مستحقاته (البند 4-10).
   وهو غير خصوم الأكاديمية…»)، فقطعُها يمزّق الجملةَ ويُقدّم آخرَها على أوّلها.

   فالتعريفُ يبقى كما كُتب، والمقطوعُ هو المصطلحُ وحدَه عند أوّل نقطتَين. */

/** بندُ المعجم: مصطلحٌ ثمّ تعريفُه كما كُتب */
export interface GlossaryItem {
  termAr: string
  defAr: string
}

export function glossaryItem(b: ContractBlock): GlossaryItem | null {
  if (b.kind !== 'bullet') return null
  /* وأوّلُ نقطتَين لا آخرُها: «رابط الدعوة (referral link): رابط خاص…»
     فيه نقطتان واحدة، وغيرُه قد يحمل في تعريفه ما يشبهها. */
  const c = b.textAr.indexOf(':')
  if (c < 1) return null
  const termAr = b.textAr.slice(0, c).trim()
  const defAr = b.textAr.slice(c + 1).trim()
  if (!termAr || !defAr) return null
  return { termAr, defAr }
}

/** صفٌّ من المثال الحسابيّ: «1. الشعبة الأولى — 20 مسجلا…: 600 USD» */
export interface ExampleRow {
  numAr: string
  labelAr: string
  byAr: string
  amountAr: string
}

const EXAMPLE_RE = /^(\d+)\.\s+(.+?)\s+—\s+(.+):\s*([^:]+)$/

export function exampleRow(b: ContractBlock): ExampleRow | null {
  if (b.kind !== 'text') return null
  const m = EXAMPLE_RE.exec(b.textAr)
  if (!m) return null
  return { numAr: m[1], labelAr: m[2].trim(), byAr: m[3].trim(), amountAr: m[4].trim() }
}

/** «مجموع هذا المثال: 2250 USD» — ذيلُ الجدول */
export interface ExampleTotal { labelAr: string; amountAr: string }

export function exampleTotal(b: ContractBlock): ExampleTotal | null {
  if (b.kind !== 'text') return null
  /* ذيلان لا واحد: «مجموع…» للأجر الثابت عن الشعبة (وجمعُها صحيح)،
     و«وعلى فرض… في الموسم…» لأجر المقعد — فصفوفُه حالاتٌ متنافيةٌ
     لدورةٍ واحدةٍ لا تُجمَع. */
  const m = /^(مجموع[^:]*|وعلى فرض[^:]*):\s*(.+)$/.exec(b.textAr)
  return m ? { labelAr: m[1].trim(), amountAr: m[2].trim() } : null
}

/* رأسُ المثال الحسابيّ ونبذتُه — شكلٌ يُعطى لهما، وإن تبدّل النصُّ ارتدّا
   فقرتَين عاديّتَين بلا نقصٍ في حرف. */
export function isExampleHeading(b: ContractBlock): boolean {
  return b.kind === 'text' && /^مثال حسابي/.test(b.textAr)
}

export function isAdvisoryNote(b: ContractBlock): boolean {
  return b.kind === 'text' && b.textAr.includes('استرشادي') && b.textAr.length > 80
}

/* ═══ قاعدةُ الأتعاب صفوفا — تقطيعٌ لا إعادةَ صوغ ═══

   ─────────── ما رُفض من العيّنة، ولمَ ───────────

   عيّنةُ التصميم بنت القاعدةَ جدولا بثلاثة أعمدة: عنوانٌ («المقعد عبر رابط
   إحالتك») وقيمةٌ («٤٥ USD») ومتى يُحتسب («كلُّ مسجّلٍ دخل من رابطك»).
   والعنوانُ والعمودُ الثالثُ **كلامٌ ليس في العقد**: كتبتهما العيّنةُ من
   عندها. وطبعُهما في وثيقةٍ يوقّعها إنسانٌ يجعل المعروضَ غيرَ الموقَّع عليه
   — وهو العطبُ نفسُه الذي رُدّ به ملحقُ العيّنة كلُّه.

   وإعادةُ الترتيب كذلك: القاعدةُ في المتن «وتحتسب الأتعاب على 8 مقعدا على
   الأقل…»، فنقلُ «8 مقعدا» إلى خانةٍ أولى يترك «وتحتسب الأتعاب على … على
   الأقل» جملةً مكسورة.

   ─────────── فما بُني ───────────

   صفٌّ لكلِّ جملةٍ من القاعدة، ومبلغُها مُبرَزٌ **في موضعه**. والصفوفُ
   **مقتطَعةٌ** من النصّ بمؤشّرات: `beforeAr + amountAr + afterAr` يردّ
   الجملةَ حرفا بحرف، وجمعُ الجمل يردّ القاعدةَ — لا بالوعد بل بالبناء.

   وحدُّ الجملة: نقطةٌ أو فاصلةٌ يتلوها فراغٌ أو آخرُ النصّ. وشرطُ القبول أنّ
   **كلَّ** جملةٍ فيها رقمٌ وحرف — فالقاعدةُ أرقامٌ ومنطوقُ شروطِها. وبه
   ترتدّ فقرةً عاديّةً: نثرٌ لا أرقامَ فيه («لم يتفق الطرفان بعد…» شطرُها
   الثاني بلا رقم)، وترقيمُ قائمةٍ لا نطقَ فيه («1. » في ملحق الوثائق).

   ولا يُميَّز الملحقُ بعنوانه: عنوانُه من كلام العقد، وكتابتُه هنا مصدرٌ
   ثانٍ يفترق عن المتن يومَ يُعدَّل — يحرسه `contract-document.test.ts`.
   فالتمييزُ بالشكل والموضع وحدَهما. */

/** جملةٌ من قاعدة الأتعاب، مقتطعةٌ بمؤشّرات لا مُعادا صوغُها */
export interface FeeRuleRow {
  /** ما قبل المبلغ — و`''` حين يتصدّر الجملة */
  beforeAr: string
  /** المبلغُ كما كُتب: «45 USD» أو «8 مقعدا» */
  amountAr: string
  /** ما بعده إلى آخر الجملة، بعلامتها وفراغِها */
  afterAr: string
}

/** حدُّ الجملة وما يتلوه من فراغ — والنقطةُ داخل «45.5» ليست حدّا */
const STATEMENT_END_RE = /[.،](?=\s|$)\s*/g
/** العددُ ووحدتُه إن تلتْه كلمةٌ بلا علامة — «45 USD» و«8 مقعدا» و«15%» */
const AMOUNT_RE = /\d+(?:[.,]\d+)*%?(?:\s+[^\s.،]+)?/
/** حرفٌ عربيّ — فالجملةُ شرطٌ منطوقٌ لا ترقيمَ قائمة */
const LETTER_RE = /[\u0621-\u064A]/

/** صفوفُ القاعدة، أو `null` فترتدّ فقرةً — والكتلةُ أولى الملحق لا غير */
export function feeRuleRows(s: ContractSection, blockIndex: number): FeeRuleRow[] | null {
  if (s.kind !== 'annex' || blockIndex !== 0) return null
  const b = s.blocks[0]
  if (!b || b.kind !== 'text') return null

  const text = b.textAr
  const rows: FeeRuleRow[] = []
  let at = 0
  STATEMENT_END_RE.lastIndex = 0
  for (let m = STATEMENT_END_RE.exec(text); m; m = STATEMENT_END_RE.exec(text)) {
    const cut = m.index + m[0].length
    const stmt = text.slice(at, cut)
    const a = AMOUNT_RE.exec(stmt)
    /* جملةٌ بلا رقم — فليست قاعدةَ أتعابٍ تُصفّ، والنصُّ أولى به أن يُقرأ نثرا.
       وجملةٌ بلا حرفٍ كذلك: «1. » في قائمة الوثائق رقمٌ وترقيمُ سطرٍ لا
       شرطُ مالٍ، ولولا هذا لَصارت القائمةُ جدولَ أتعاب. */
    if (!a || !LETTER_RE.test(stmt)) return null
    rows.push({
      beforeAr: stmt.slice(0, a.index),
      amountAr: a[0],
      afterAr: stmt.slice(a.index + a[0].length),
    })
    at = cut
  }
  /* ذيلٌ بلا حدٍّ يُغلقه: لا يُقتطَع نصفُ نصٍّ ويُترَك نصفُه */
  if (at !== text.length || rows.length === 0) return null
  return rows
}

/* ═══ وقاعدةُ `v7` صفوفٌ معنونةٌ في المتن نفسِه ═══

   `v6` وما قبله يكتب القاعدةَ جملةً، فتُقرأ بـ`feeRuleRows` أعلاه صفّا
   لكلّ جملةٍ بعمودٍ واحد — وهو أقصى ما تحتمله جملة.

   و`v7` يكتبها «عنوان — قيمة: متى» بأمر صاحب المنصّة، فصار للعنوان
   والشرح موضعٌ **في العقد** لا في العارض، وصحّت الأعمدةُ الثلاثةُ التي
   أقرّتها العيّنة. والنحوُ هو نحوُ المثال الحسابيّ نفسُه («عنوان — حساب:
   مبلغ») فلا يُخترع في وثيقةٍ واحدةٍ نحوان.

   والقارئتان تبقيان معا: متونُ `v6` مجمَّدةٌ في عقودٍ وُقّعت، فلو نُزعت
   الأولى لَارتدّ ملحقُها فقرةً — لا نقصَ فيها، لكنّها تُفقِد من وقّع
   شكلا كان له. */

/** خاناتُ صفٍّ من قاعدة `v7`: «المقعد العام — 30 USD: عن كل متعلم…» */
export interface FeeRuleCells {
  labelAr: string
  amountAr: string
  whenAr: string
}

/* العنوانُ بلا شرطةٍ ولا نقطتين، والقيمةُ بلا نقطتين — وما بعدهما الشرح.
   وبه تُردّ الأسطرُ التي فيها شرطةٌ ونقطتان لغير هذا المعنى. */
const FEE_CELLS_RE = /^([^—:]+) — ([^:—]+): (.+)$/
/** صفُّ المثال يبدأ برقمٍ ونقطة — وذاك جدولٌ آخرُ في الملحق نفسِه */
const EXAMPLE_PREFIX_RE = /^\d+\.\s/

export function feeRuleCells(b: ContractBlock): FeeRuleCells | null {
  if (b.kind !== 'text' || EXAMPLE_PREFIX_RE.test(b.textAr)) return null
  const m = FEE_CELLS_RE.exec(b.textAr)
  if (!m) return null
  const [, labelAr, amountAr, whenAr] = m
  /* والقيمةُ رقمٌ: عنوانٌ وشرحٌ بلا مبلغٍ ليسا قاعدةَ أتعاب */
  if (!/\d/.test(amountAr)) return null
  return { labelAr: labelAr.trim(), amountAr: amountAr.trim(), whenAr: whenAr.trim() }
}
