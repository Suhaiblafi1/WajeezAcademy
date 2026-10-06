/* ═══ ما تغيّر عن المعتمَد — مراجعةُ الخطّة كما يقرؤها المعتمِد (المرحلة ٣ج-٤) ═══

   «بالتأكيد يحقّ للمدرّب لاحقا أن يضيف ويعدّل كلَّ شيءٍ براحته بموافقة الإدارة»
   (صاحب المنصّة، ٢٧ سبتمبر ٢٠٢٦). فيعود المدرّبُ بعد الاعتماد فيعدّل ويرسل مراجعة،
   ويقرأ المعتمِدُ المنهجَ كاملا كما سيكون (`curriculum-view.ts`) — لكنّه لا يقول ما
   الذي تغيّر: فإمّا يقرأ عشرين موعدا ليجد التعديلَ الواحد، وإمّا يعتمد ما لم يره.

   فصار في بطاقته «ما تغيّر عن المعتمَد»: لكلّ خطوةٍ من خطوات المدرّب سطورُها
   بأسمائها في شريطه (`STAGE_LABELS`) — حيث يكتب ملاحظتَه إن ردّ — ولا شيءَ لما لم
   يتغيّر. والمهامُّ واللقاءاتُ المباشرةُ لها قوائمُها بما ينتظر فيها (٣ب، ٣ج-٣)؛
   وهنا ما في الخطّة نفسِها: المدّةُ والوصف، والمحاورُ ومواعيدُها، والكرّاسات،
   والجلساتُ المسجّلة، والمصادر.

   والقاعدةُ محضةٌ هنا (`plan-diff.test.ts`). */

import { REVIEW_SECTIONS, STAGE_LABELS, type ReviewNotes, type ReviewSection } from './review-notes'
import { resourceCategory } from './plan-overlay'
import { asLevelRange, levelRangeAr } from './cohort-level'
import { asAudience, goalsAr, stagesAr } from './cohort-audience'

interface DiffModule {
  moduleId: string
  titleAr?: string | null
  outcomeAr?: string | null
  activityAr?: string | null
  artifactAr?: string | null
  bodyAr?: string | null
  bodyFileKey?: string | null
}
interface DiffSlot {
  startsOn: string
  endsOn: string
  moduleIds: string[]
  workbook?: { title?: string | null; url?: string | null; bodyFileKey?: string | null } | null
}
interface DiffResource {
  title?: string | null
  url?: string | null
  bodyFileKey?: string | null
  kind?: string | null
  category?: string | null
  moduleId?: string | null
  opensAt?: string | null
  preReading?: boolean | null
  noteAr?: string | null
}
interface DiffPlan {
  summaryAr?: string | null
  /** مستوى الشعبة (٦ أكتوبر ٢٠٢٦) — يُقرأ بـ`asLevelRange` */
  level?: unknown
  /** لمن هي وماذا يريد متعلّمُها (٦ أكتوبر ٢٠٢٦) — يُقرأ بـ`asAudience` */
  audience?: unknown
  startsOn?: string | null
  endsOn?: string | null
  modules?: DiffModule[] | null
  slots?: DiffSlot[] | null
  resources?: DiffResource[] | null
  /** كرّاسةُ الشعبة الواحدة وخريطتُها (٣٠ سبتمبر ٢٠٢٦) */
  workbook?: (NonNullable<DiffSlot['workbook']> & { parts?: { moduleId: string; whereAr?: string | null }[] | null }) | null
}

export interface PlanDiffSection { section: ReviewSection; label: string; lines: string[] }

/** «٥ أكتوبر» — والشاشةُ تعطي صيغتَها، فالقاعدةُ لا تعرف لغةَ التاريخ */
export interface PlanDiffFormat { date: (ymd: string) => string }

const text = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s : null
}
const asPlan = (raw: unknown): DiffPlan => (raw && typeof raw === 'object' ? raw as DiffPlan : {})
const list = <T>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : [])

const range = (p: { startsOn?: string | null; endsOn?: string | null }, fmt: PlanDiffFormat) =>
  p.startsOn && p.endsOn ? `من ${fmt.date(p.startsOn)} إلى ${fmt.date(p.endsOn)}` : 'بلا مدّة'

const MODULE_FIELDS: readonly [keyof DiffModule, string][] = [
  ['outcomeAr', 'المخرَج'],
  ['activityAr', 'التطبيقُ العمليّ'],
  ['artifactAr', 'ما يُسلّمه المتعلّم'],
  ['bodyAr', 'المحتوى'],
  ['bodyFileKey', 'ملفُّ المحتوى'],
]

function identityLines(a: DiffPlan, b: DiffPlan, fmt: PlanDiffFormat): string[] {
  const out: string[] = []
  if ((a.startsOn ?? null) !== (b.startsOn ?? null) || (a.endsOn ?? null) !== (b.endsOn ?? null)) {
    out.push(`المدّة: ${range(a, fmt)} ← ${range(b, fmt)}`)
  }
  if (text(a.summaryAr) !== text(b.summaryAr)) out.push('تغيّر وصفُ الشعبة')
  const la = levelRangeAr(asLevelRange(a.level))
  const lb = levelRangeAr(asLevelRange(b.level))
  if (la !== lb) out.push(`المستوى: ${la ?? 'لم يُحدَّد'} ← ${lb ?? 'لم يُحدَّد'}`)
  const aa = asAudience(a.audience)
  const ab = asAudience(b.audience)
  if (stagesAr(aa) !== stagesAr(ab)) out.push(`لمن: ${stagesAr(aa) ?? 'لم يُحدَّد'} ← ${stagesAr(ab) ?? 'لم يُحدَّد'}`)
  if (goalsAr(aa) !== goalsAr(ab)) out.push(`الهدف: ${goalsAr(aa) ?? 'لم يُحدَّد'} ← ${goalsAr(ab) ?? 'لم يُحدَّد'}`)
  return out
}

function moduleLines(a: DiffPlan, b: DiffPlan, fmt: PlanDiffFormat): string[] {
  const out: string[] = []
  const before = list(a.modules)
  const after = list(b.modules)
  const old = new Map(before.map((m) => [m.moduleId, m]))
  const now = new Map(after.map((m) => [m.moduleId, m]))
  const title = (m: DiffModule) => text(m.titleAr) ?? m.moduleId
  for (const m of after) if (!old.has(m.moduleId)) out.push(`أُضيف محور: «${title(m)}»`)
  for (const m of before) if (!now.has(m.moduleId)) out.push(`حُذف محور: «${title(m)}»`)
  for (const m of after) {
    const o = old.get(m.moduleId)
    if (!o) continue
    if (title(o) !== title(m)) out.push(`«${title(o)}» صار «${title(m)}»`)
    const changed = MODULE_FIELDS.filter(([k]) => text(o[k]) !== text(m[k])).map(([, label]) => label)
    if (changed.length) out.push(`تغيّر في «${title(m)}»: ${changed.join('، ')}`)
  }
  /* والترتيبُ وحدَه تغييرٌ — منه أرقامُ المحاور التي يقرؤها المتعلّم */
  const kept = (ids: string[], other: Map<string, unknown>) => ids.filter((id) => other.has(id)).join('|')
  if (kept(before.map((m) => m.moduleId), now) !== kept(after.map((m) => m.moduleId), old)) out.push('تغيّر ترتيبُ المحاور')

  /* والمواعيدُ بترتيبها — «الموعد ٢» هو ما يقرؤه المعتمِدُ في المنهج */
  const sa = list(a.slots)
  const sb = list(b.slots)
  if (sa.length !== sb.length) out.push(`صارت المواعيدُ ${sb.length} بعد ${sa.length}`)
  const pos = new Map(after.map((m, i) => [m.moduleId, i + 1]))
  const axes = (s: DiffSlot) => {
    const ns = s.moduleIds.map((id) => pos.get(id)).filter((n): n is number => n !== undefined).sort((x, y) => x - y)
    return ns.length ? `المحور ${ns.join(' + ')}` : 'بلا محور'
  }
  for (let i = 0; i < Math.min(sa.length, sb.length); i += 1) {
    if (sa[i].startsOn !== sb[i].startsOn || sa[i].endsOn !== sb[i].endsOn) {
      out.push(`الموعد ${i + 1}: ${range(sa[i], fmt)} ← ${range(sb[i], fmt)}`)
    }
    if ([...sa[i].moduleIds].sort().join('|') !== [...sb[i].moduleIds].sort().join('|')) {
      out.push(`محاورُ الموعد ${i + 1}: ${axes(sa[i])} ← ${axes(sb[i])}`)
    }
  }
  return out
}

const workbookKey = (w: DiffSlot['workbook']) => {
  if (!w) return null
  const source = text(w.url) ?? text(w.bodyFileKey)
  return source ? `${source}|${text(w.title) ?? ''}` : null
}

function workbookLines(a: DiffPlan, b: DiffPlan): string[] {
  const out: string[] = []
  /* كرّاسةُ الدورة الواحدة، ثمّ موضعُ كلّ محورٍ فيها */
  const ca = workbookKey(a.workbook ?? null)
  const cb = workbookKey(b.workbook ?? null)
  if (ca !== cb) out.push(!ca ? 'أُضيفت كرّاسةُ الدورة' : !cb ? 'حُذفت كرّاسةُ الدورة' : 'تغيّرت كرّاسةُ الدورة')
  const pos = new Map(list(b.modules).map((m, i) => [m.moduleId, i + 1]))
  const whereOf = (p: DiffPlan) => new Map(list(p.workbook?.parts).map((x) => [x.moduleId, text(x.whereAr)]))
  const wa = whereOf(a)
  const wb = whereOf(b)
  for (const m of list(b.modules)) {
    const before = wa.get(m.moduleId) ?? null
    const after = wb.get(m.moduleId) ?? null
    if (before !== after && (before || after)) {
      out.push(`موضعُ المحور ${pos.get(m.moduleId)} في الكرّاسة: ${before ?? '—'} ← ${after ?? '—'}`)
    }
  }
  const sa = list(a.slots)
  const sb = list(b.slots)
  /* وكرّاساتُ المواعيد — ما دامت في المراجعة (خطّةٌ قبل الكرّاسة الواحدة) */
  for (let i = 0; i < sb.length; i += 1) {
    const before = workbookKey(sa[i]?.workbook)
    const after = workbookKey(sb[i].workbook)
    if (before === after) continue
    out.push(!before ? `أُضيفت كرّاسةُ الموعد ${i + 1}` : !after ? `حُذفت كرّاسةُ الموعد ${i + 1}` : `تغيّرت كرّاسةُ الموعد ${i + 1}`)
  }
  return out
}

/* المصدرُ يُعرف بعنوانه ومصدره — فمن غيّر رابطَه بقي اسمُه، فيُقال «تغيّر» لا «حُذف وأُضيف» */
const sourceOf = (r: DiffResource) => text(r.url) ?? text(r.bodyFileKey) ?? ''
const placeOf = (r: DiffResource) => `${r.moduleId ?? ''}|${text(r.opensAt) ?? ''}|${r.preReading === true}`

function resourceLines(a: DiffPlan, b: DiffPlan, recorded: boolean): string[] {
  const pick = (p: DiffPlan) => list(p.resources).filter((r) => (resourceCategory(r) === 'recorded') === recorded)
  const before = pick(a)
  const after = pick(b)
  const out: string[] = []
  const noun = recorded ? 'تسجيل' : 'مصدر'
  const title = (r: DiffResource) => text(r.title) ?? (recorded ? 'جلسةٌ مسجّلة' : 'مصدر')
  const byTitle = (rs: DiffResource[]) => new Map(rs.map((r) => [title(r), r]))
  const old = byTitle(before)
  const now = byTitle(after)
  for (const [t, r] of now) {
    const o = old.get(t)
    if (!o) { out.push(`أُضيف ${noun}: «${t}»`); continue }
    if (sourceOf(o) !== sourceOf(r)) out.push(`تغيّر رابطُ «${t}»`)
    else if (placeOf(o) !== placeOf(r)) out.push(`تغيّر موضعُ «${t}» أو موعدُ ظهوره`)
  }
  for (const t of old.keys()) if (!now.has(t)) out.push(`حُذف ${noun}: «${t}»`)
  return out
}

/** ما تغيّر في المراجعة عن المعتمَد — بخطوات المدرّب، وما لم يتغيّر لا يُذكر */
export function planDiff(approved: unknown, revision: unknown, fmt: PlanDiffFormat): PlanDiffSection[] {
  const a = asPlan(approved)
  const b = asPlan(revision)
  const sections: [ReviewSection, string[]][] = [
    ['identity', identityLines(a, b, fmt)],
    ['modules', moduleLines(a, b, fmt)],
    ['workbooks', workbookLines(a, b)],
    ['sessions', resourceLines(a, b, true)],
    ['assignments', resourceLines(a, b, false)],
  ]
  return sections.filter(([, lines]) => lines.length > 0).map(([section, lines]) => ({ section, label: STAGE_LABELS[section], lines }))
}

/* ═══ «ما تغيّر منذ ردّك» — ما طلبه المعتمِدُ بجانب ما عُدّل، خطوةً خطوة (٣ أكتوبر ٢٠٢٦، ⑦) ═══

   سار صاحبُ المنصّة في المسار: ردّ خطّةً بملاحظاتٍ فأعاد المدرّبُ إرسالَها، فرأى
   ما طلبه ولم يرَ ما تغيّر — يعيد قراءةَ المنهج كلِّه ليعرف أأُجيبت ملاحظتُه.
   فتُقابَل المرسَلةُ بالتي رُدّت (`returnedContent`) بالقاعدة نفسِها التي تقابل
   المراجعةَ بالمعتمَدة (`planDiff`)، وتوضَع كلُّ ملاحظةٍ في خطوتها بجانب ما تغيّر
   فيها: فملاحظةٌ لا تغيّرَ بجانبها تُرى في مكانها — لا تُستنتَج من غيابٍ يُبحث عنه.

   وما لا يحمله المحتوى — اللقاءاتُ المباشرةُ والمهامّ — له قوائمُه في البطاقة؛
   فـ«لا تغيّر» هنا معناه في الخطّة نفسِها، والشاشةُ تقول ذلك. */
export interface SinceReturnRow {
  section: ReviewSection
  label: string
  /** ما طلبه المعتمِدُ في هذه الخطوة — أو `null` */
  note: string | null
  /** ما تغيّر فيها منذ الردّ */
  lines: string[]
}

export function sinceReturn(
  returned: unknown,
  resent: unknown,
  notes: ReviewNotes,
  fmt: PlanDiffFormat,
): { general: string | null; rows: SinceReturnRow[] } {
  const changed = new Map(planDiff(returned, resent, fmt).map((s) => [s.section, s.lines]))
  const rows = REVIEW_SECTIONS
    .map(({ key, label }) => ({ section: key, label, note: notes[key] ?? null, lines: changed.get(key) ?? [] }))
    .filter((r) => r.note !== null || r.lines.length > 0)
  return { general: notes.general ?? null, rows }
}
