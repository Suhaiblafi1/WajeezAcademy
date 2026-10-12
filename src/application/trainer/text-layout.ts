/* ═══ النصُّ الطويلُ مرتّبا — لا جريدةً مكتظّة (١١ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة بلقطتين — تعليماتُ مشروع التخرّج كتلةً واحدة، وملاحظةُ «عمق المحتوى» سطرا
   واحدا لثمانية محاور: «لماذا النصوصُ تبدو جريدةً مكتظّةً بالنصوص، لا شيئا مرتّبا منسّقا بتصميمٍ
   جميل؟ اختر تصميما بسيطا لا يغيّر مسارَ العمل، بل يحسّن الشكلَ فقط. والملاحظاتُ أيضا مكتظّةٌ جدّا».

   فهنا قراءةٌ محضةٌ لما في النصّ نفسِه — لا يُكتب شيءٌ ولا يُغيَّر: الشاشةُ ترسم ما تجده.

   ① **التعليمات** (`briefBlocks`): الخطواتُ المرقّمة («١) …»، «2. …») قائمةٌ مرقّمة، و«المُسلَّم: …» و
      «التقييم: …» حقلٌ باسمه، و«مستوياتُ المعايير:» ثمّ «المعيار. المستوى 3: … المستوى 2: …» جدولُ
      مستويات، وما سواها فقرةٌ كما كُتبت.
   ② **قائمةُ النواقص** (`gapLayout`): «المحور 1: 152 كلمةً — اشرح…؛ المحور 1: بلا مثالٍ محلول — أضف…؛
      المحور 2: …» تصير محورا محورا بنواقصه، و«كيف تُصلحه» مرّةً واحدةً لا مكرّرةً مع كلّ محور.

   وما لا يُقرأ هكذا يبقى نصّا كما هو — فلا يضيع حرفٌ ممّا كتبه صاحبُه. */

export type BriefBlock =
  | { kind: 'steps'; items: string[] }
  | { kind: 'field'; labelAr: string; textAr: string }
  | { kind: 'rubric'; titleAr: string | null; rows: RubricRow[] }
  | { kind: 'text'; textAr: string }

export interface RubricRow {
  criterionAr: string
  levels: { level: string; textAr: string }[]
}

const STEP = /^([0-9٠-٩]{1,2})\s*[).\-–]\s+(.+)$/
const LEVEL = /المستوى\s*([0-9٠-٩]+)\s*[:：]\s*/g
const hasLevel = (l: string) => { LEVEL.lastIndex = 0; return LEVEL.test(l) }
/** «المُسلَّم: …» — اسمٌ قصيرٌ بلا أرقام، ثمّ نقطتان */
const FIELD = /^([^:：\d٠-٩]{2,30}?)\s*[:：]\s+(.+)$/

/** صفُّ المعيار ومستوياته — أو مستوياتٌ تكمل الصفَّ الذي قبله */
function rubricRow(line: string): RubricRow {
  const parts = line.split(LEVEL)
  const criterionAr = parts[0]!.trim().replace(/[.،:]\s*$/, '').trim()
  const levels: RubricRow['levels'] = []
  for (let i = 1; i + 1 < parts.length; i += 2) {
    levels.push({ level: parts[i]!, textAr: parts[i + 1]!.trim() })
  }
  return { criterionAr, levels }
}

export function briefBlocks(text: string | null | undefined): BriefBlock[] {
  const lines = (text ?? '').replace(/\r/g, '').split('\n').map((l) => l.trim())
  const out: BriefBlock[] = []
  const last = () => out[out.length - 1]
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (!line) continue
    const step = STEP.exec(line)
    if (step) {
      const b = last()
      if (b?.kind === 'steps') b.items.push(step[2]!.trim())
      else out.push({ kind: 'steps', items: [step[2]!.trim()] })
      continue
    }
    /* عنوانُ جدول المستويات: سطرٌ ينتهي بنقطتين، وبعده سطرٌ فيه «المستوى N:» */
    const next = lines.slice(i + 1).find((l) => l) ?? ''
    if (/[:：]$/.test(line) && line.length <= 80 && hasLevel(next)) {
      out.push({ kind: 'rubric', titleAr: line.replace(/[:：]$/, '').trim(), rows: [] })
      continue
    }
    if (hasLevel(line)) {
      const row = rubricRow(line)
      const b = last()
      if (b?.kind === 'rubric') {
        if (!row.criterionAr && b.rows.length > 0) b.rows[b.rows.length - 1]!.levels.push(...row.levels)
        else b.rows.push(row)
      } else {
        out.push({ kind: 'rubric', titleAr: null, rows: [row] })
      }
      continue
    }
    const field = FIELD.exec(line)
    if (field && field[1]!.trim().split(/\s+/).length <= 4) {
      out.push({ kind: 'field', labelAr: field[1]!.trim(), textAr: field[2]!.trim() })
      continue
    }
    /* والفقرةُ تتّصل بما قبلها حتّى سطرٍ فارغ — كما كُتبت */
    const b = last()
    if (b?.kind === 'text' && lines[i - 1]) b.textAr += `\n${line}`
    else out.push({ kind: 'text', textAr: line })
  }
  return out
}

/** أفي النصّ ما يُرتَّب؟ — وإلّا فالفقرةُ الواحدةُ تُعرض كما كانت */
export const briefHasLayout = (blocks: readonly BriefBlock[]): boolean => blocks.some((b) => b.kind !== 'text')

/* ─────────── قائمةُ النواقص ─────────── */

export interface GapGroup {
  /** «المحور 1» أو «الأربعاء، 2 ديسمبر في 6:00 م» */
  whereAr: string
  issuesAr: string[]
}
export interface GapLayout {
  groups: GapGroup[]
  /** كيف يُصلَح — مرّةً واحدةً لكلّ إصلاح، بترتيب ظهوره */
  fixesAr: string[]
}

/** «X: مشكلة — إصلاح؛ X: …» — أو `null` إن لم يكن قائمةً من اثنين فأكثر يُقرأ كلُّها هكذا */
export function gapLayout(text: string | null | undefined): GapLayout | null {
  const items = (text ?? '').split(/\s*[؛;]\s*/).map((s) => s.trim()).filter(Boolean)
  if (items.length < 2) return null
  const groups: GapGroup[] = []
  const fixes: string[] = []
  for (const item of items) {
    /* ونقطتا الساعة «6:00» لا تفصلان: الفاصلُ نقطتان ثمّ مسافة */
    const at = item.indexOf(': ')
    if (at <= 0 || at > 50) return null
    const whereAr = item.slice(0, at).trim()
    const rest = item.slice(at + 2).trim()
    const dash = rest.indexOf(' — ')
    const issue = (dash < 0 ? rest : rest.slice(0, dash)).trim()
    const fix = dash < 0 ? '' : rest.slice(dash + 3).trim()
    if (!issue) return null
    let g = groups.find((x) => x.whereAr === whereAr)
    if (!g) { g = { whereAr, issuesAr: [] }; groups.push(g) }
    if (!g.issuesAr.includes(issue)) g.issuesAr.push(issue)
    if (fix && !fixes.includes(fix)) fixes.push(fix)
  }
  return { groups, fixesAr: fixes }
}
