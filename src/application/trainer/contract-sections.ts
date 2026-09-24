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
const PREAMBLE_HEADS = ['الديباجة', 'تمهيد'] as const
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
  const m = /^(مجموع[^:]*):\s*(.+)$/.exec(b.textAr)
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
