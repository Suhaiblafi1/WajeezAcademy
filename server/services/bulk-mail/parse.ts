/* ═══ قراءةُ ملفّ القائمة — Excel أو CSV (٢٢ نوفمبر ٢٠٢٦) ═══

   صاحبُ المنصّة عنده نحوُ عشرين ألفَ بريدٍ لأعضاء تطبيق وجيز في ملفّ Excel. والملفّاتُ لا تأتي بشكلٍ واحد: عمودُ
   البريد اسمُه «Email» أو «البريد الإلكتروني» أو «الإيميل»، أو لا رأسَ للملفّ أصلا. فيُقرأ هكذا:

   ١) **عمودُ البريد برأسه** إن كان في الرأس ما يدلّ عليه (email · mail · بريد · ايميل)، وإلّا **فأوّلُ عمودٍ
      أكثرُ ما فيه بريد** — والصفُّ الأوّلُ رأسٌ إن لم يكن بريدا.
   ٢) **وعمودُ الاسم اختياريّ** (first name · name · الاسم): به تُحيّا الرسالة، وبلاه «مرحبا،».
   ٣) **وما ليس بريدا صالحا يُعدّ ولا يُحفظ**، والمكرّرُ يُحفظ مرّةً — والصفُّ الفارغُ كلُّه لا يُعدّ.

   والملفُّ نفسُه لا يُحفظ: يُقرأ في الذاكرة وتُحفظ صفوفُه. والحارس: `server/tests/commerce/bulk-mail.test.ts`. */

import ExcelJS from 'exceljs'
import { AuthError } from '../auth.service'
import { BULK_LIST_MAX_ROWS } from '../../../src/application/marketing/bulk-mail'

export interface ParsedEntry { email: string; name: string | null }

export interface ParsedList {
  /** صفوفُ البيانات غيرُ الفارغة — بلا الرأس */
  totalRows: number
  entries: ParsedEntry[]
  invalid: number
  duplicates: number
  /** أمثلةٌ ممّا سقط: رقمُ صفّه في الملفّ وما كان فيه */
  invalidSamples: { row: number; value: string }[]
  emailColumn: string
  nameColumn: string | null
}

const EMAIL_RE = /^[^\s@<>()[\],;:"'\\]+@[^\s@<>()[\],;:"'\\]+\.[a-z]{2,}$/i

/* ═══ ونطاقٌ مكتوبٌ خطأً يسقط كغير الصالح (٢٣ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «make an option to the admin that checks wrong emails or duplicated». ووُجد في قائمة تطبيق وجيز
   ستّةَ عشرَ عنوانا بنطاقٍ مخطوء (`gmial.com`، `gmail.con`): صحيحٌ شكلُه ولا يصل — فيرتدّ ويضرّ سمعةَ المرسل. فهذه
   الأخطاءُ الشائعةُ لأشهر النطاقات تسقط هنا، في القائمة المرفوعة وفي ليدات الموقع معا. */
export const TYPO_DOMAINS: ReadonlySet<string> = new Set([
  'gmial.com', 'gmai.com', 'gmal.com', 'gmil.com', 'gmail.co', 'gmail.con', 'gmail.cm', 'gmail.om', 'gmaill.com', 'gamil.com', 'gnail.com', 'gmail.comm',
  'hotmial.com', 'hotmai.com', 'hotmal.com', 'hotmail.co', 'hotmail.con', 'homail.com', 'hotmil.com', 'hotmaill.com',
  'yaho.com', 'yahoo.co', 'yahoo.con', 'yhoo.com', 'yahooo.com',
  'outlok.com', 'outlook.co', 'outlook.con', 'outllok.com', 'iclod.com', 'icloud.co', 'icould.com', 'icloud.con',
])

/** البريدُ نظيفا بحروفٍ صغيرة — أو لا شيء إن لم يكن بريدا، أو كان نطاقُه خطأً شائعا (`TYPO_DOMAINS`) */
export function cleanEmail(raw: string): string | null {
  const v = raw
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .trim()
    .replace(/^mailto:/i, '')
    .replace(/^<(.*)>$/, '$1')
    .trim()
    .toLowerCase()
  if (!v || v.length > 254 || v.includes('..') || !EMAIL_RE.test(v)) return null
  if (TYPO_DOMAINS.has(v.slice(v.lastIndexOf('@') + 1))) return null
  return v
}

/* ─────────── الصفوف من الملفّ ─────────── */

type Rows = string[][]

function cellText(v: ExcelJS.CellValue | undefined): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    if ('richText' in v && Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('')
    /* رابطٌ (كثيرا ما يكون البريدُ نفسُه mailto:) — نصُّه، وإلّا عنوانُه */
    if ('hyperlink' in v) {
      const t = (v as { text?: unknown }).text
      if (typeof t === 'string' && t.trim()) return t
      if (t && typeof t === 'object' && 'richText' in t) return cellText(t as ExcelJS.CellValue)
      return String(v.hyperlink ?? '')
    }
    if ('result' in v) return cellText((v as { result?: ExcelJS.CellValue }).result)
    if ('text' in v && typeof (v as { text?: unknown }).text === 'string') return (v as { text: string }).text
  }
  return ''
}

async function xlsxRows(buffer: Buffer): Promise<Rows> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  } catch {
    throw new AuthError('bad_file', 'تعذرت قراءة ملف Excel. احفظه من جديد بصيغة xlsx أو csv', 400)
  }
  /* أوّلُ ورقةٍ فيها صفوف — ملفٌّ بورقةٍ فارغةٍ أولى ليس نادرا */
  const sheet = wb.worksheets.find((ws) => ws.actualRowCount > 0)
  if (!sheet) return []
  if (sheet.actualRowCount > BULK_LIST_MAX_ROWS + 1) tooMany()
  const rows: Rows = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[]
    /* `values` تبدأ من ١ */
    rows.push(values.slice(1).map((c) => cellText(c).trim()))
  })
  return rows
}

function decodeText(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '')
  } catch {
    /* Excel على ويندوز العربيّ يحفظ CSV بترميز 1256 */
    return new TextDecoder('windows-1256').decode(buffer)
  }
}

/** CSV كما يكتبه Excel وGoogle Sheets: فاصلةٌ أو فاصلةٌ منقوطةٌ أو جدولة، والمقتبسُ بين مزدوجين */
export function csvRows(text: string): Rows {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [',', ';', '\t'].map((d) => ({ d, n: firstLine.split(d).length })).sort((a, b) => b.n - a.n)[0].d
  const rows: Rows = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1 } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"' && cell === '') { quoted = true; continue }
    if (ch === delimiter) { row.push(cell.trim()); cell = ''; continue }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell.trim()); rows.push(row); row = []; cell = ''
      continue
    }
    cell += ch
  }
  if (cell !== '' || row.length > 0) { row.push(cell.trim()); rows.push(row) }
  return rows
}

function tooMany(): never {
  throw new AuthError('too_many_rows', `الملف أكبر من ${BULK_LIST_MAX_ROWS} صف. قسمه إلى ملفين وارفع كلا منهما قائمة`, 400)
}

/* ─────────── الأعمدة ─────────── */

const norm = (h: string) => h.toLowerCase().replace(/[\s_\-.:()]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه')

const isEmailHeader = (h: string) => /e?mail|بريد|ايميل|اميل/.test(norm(h))

/** رتبةُ عمود الاسم: الاسمُ الأوّل أوّلا، ثمّ الاسمُ الكامل — وما ليس اسمَ إنسانٍ لا يُعدّ */
function nameRank(h: string): number {
  const n = norm(h)
  if (!n || /mail|بريد|ايميل|user|last|surname|family|company|file|عائله|العائله|شركه|مستخدم/.test(n)) return 0
  if (/^(firstname|first|givenname|الاسمالاول|اسمالاول|الاسماول)$/.test(n)) return 3
  if (/^(name|fullname|الاسم|اسم|الاسمالكامل|الاسمالثلاثي)$/.test(n)) return 2
  if (/name|اسم/.test(n)) return 1
  return 0
}

function emailShare(rows: Rows, col: number, from: number): number {
  const sample = rows.slice(from, from + 200).map((r) => r[col] ?? '').filter(Boolean)
  if (sample.length === 0) return 0
  return sample.filter((v) => cleanEmail(v)).length / sample.length
}

interface Columns { email: number; name: number | null; header: boolean }

export function detectColumns(rows: Rows): Columns | null {
  if (rows.length === 0) return null
  const head = rows[0]
  const width = Math.max(...rows.slice(0, 200).map((r) => r.length))
  const headerEmails = head.map((h, i) => (isEmailHeader(h) && !cleanEmail(h) ? i : -1)).filter((i) => i >= 0)
  if (headerEmails.length > 0) {
    /* أكثرُ من عمودٍ يُسمّى بريدا: أكثرُها بريدا */
    const email = headerEmails.sort((a, b) => emailShare(rows, b, 1) - emailShare(rows, a, 1))[0]
    const ranked = head.map((h, i) => ({ i, r: i === email ? 0 : nameRank(h) })).filter((x) => x.r > 0).sort((a, b) => b.r - a.r)
    return { email, name: ranked[0]?.i ?? null, header: true }
  }
  /* بلا رأسٍ يدلّ: أوّلُ عمودٍ أكثرُ ما فيه بريد */
  for (let col = 0; col < width; col += 1) {
    if (emailShare(rows, col, 0) >= 0.5) {
      const header = !cleanEmail(head[col] ?? '')
      const ranked = header
        ? head.map((h, i) => ({ i, r: i === col ? 0 : nameRank(h) })).filter((x) => x.r > 0).sort((a, b) => b.r - a.r)
        : []
      return { email: col, name: ranked[0]?.i ?? null, header }
    }
  }
  return null
}

const columnLabel = (rows: Rows, cols: Columns, i: number) => (cols.header && rows[0][i]?.trim()) || `العمود ${i + 1}`

/** يقرأ الملفَّ قائمةً: الصالحُ مرّةً، وما سقط معدود */
export async function parseMailFile(buffer: Buffer): Promise<ParsedList> {
  if (buffer.length === 0) throw new AuthError('empty_file', 'الملف فارغ', 400)
  const zip = buffer[0] === 0x50 && buffer[1] === 0x4b
  const ole = buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0
  if (ole) throw new AuthError('old_excel', 'هذا ملف Excel قديم (xls). احفظه بصيغة xlsx أو csv ثم ارفعه', 400)
  const rows = zip ? await xlsxRows(buffer) : csvRows(decodeText(buffer))

  const cols = detectColumns(rows)
  if (!cols) throw new AuthError('no_email_column', 'لم نجد عمود البريد. اجعل في الصف الأول عنوانا مثل Email أو البريد', 400)

  const data = (cols.header ? rows.slice(1) : rows)
  const seen = new Set<string>()
  const entries: ParsedEntry[] = []
  const invalidSamples: { row: number; value: string }[] = []
  let total = 0
  let invalid = 0
  let duplicates = 0
  data.forEach((r, n) => {
    if (!r.some((c) => c && c.trim())) return
    total += 1
    if (total > BULK_LIST_MAX_ROWS) tooMany()
    const raw = r[cols.email] ?? ''
    const email = cleanEmail(raw)
    if (!email) {
      invalid += 1
      if (invalidSamples.length < 5) invalidSamples.push({ row: n + (cols.header ? 2 : 1), value: raw.slice(0, 80) })
      return
    }
    if (seen.has(email)) { duplicates += 1; return }
    seen.add(email)
    const rawName = cols.name === null ? '' : (r[cols.name] ?? '').replace(/\s+/g, ' ').trim()
    entries.push({ email, name: rawName && !rawName.includes('@') ? rawName.slice(0, 120) : null })
  })

  return {
    totalRows: total, entries, invalid, duplicates, invalidSamples,
    emailColumn: columnLabel(rows, cols, cols.email),
    nameColumn: cols.name === null ? null : columnLabel(rows, cols, cols.name),
  }
}
