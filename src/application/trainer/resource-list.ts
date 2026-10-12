/* ═══ صفحةُ المصادر قائمةٌ مضغوطةٌ مجمّعةٌ بالمحور (١١ أكتوبر ٢٠٢٦) ═══

   من ملفّ صاحب المنصّة «تحسينات بوابة مدرّب وجيز»: «اليومَ كلُّ مصدرٍ بطاقةٌ كبيرةٌ
   من خمسة صفوف: اسمٌ، وملفّ، وزرّا حذف، وجملةٌ مساعدة، ووصف، وقائمةُ محورٍ بشرحها.
   مع ثمانية مصادرَ تصبح الصفحةُ طويلةً يصعب مسحُها. المقترح: قائمةٌ مضغوطةٌ مجمّعةٌ
   حسب المحور، مع منطقةِ رفعٍ واحدةٍ لعدّة ملفّات». و«رفعنا ٩ ملفّاتٍ واحدا واحدا،
   بأربع نقراتٍ لكلّ ملفّ».

   فهنا المحضُ الذي تقرؤه الشاشة: التجميعُ بالمحور، والاسمُ الأوّلُ من اسم الملفّ أو
   الرابط (يُعدَّل في مكانه)، وشارةُ النوع. والصنفُ والنوعُ كما كانا (`plan-overlay`):
   الملفُّ في «كتبٌ وملفّات»، والرابطُ «عامّ» — والنوعُ يُشتقّ من الصنف لا يُسأل عنه. */

import { kindForCategory, resourceCategory, type ResourceCategory } from './plan-overlay'
import { PLAN_TITLE_MIN } from './plan-limits'

export interface ListResource {
  title: string
  url?: string | null
  kind?: string | null
  category?: string | null
  noteAr?: string | null
  moduleId?: string | null
  preReading?: boolean | null
  bodyFileKey?: string | null
  bodyFileName?: string | null
  bodyFileMime?: string | null
}

/** مجموعةٌ في القائمة: للشعبة كلّها، أو لمحور، أو لمحورٍ حُذف */
export interface ResourceGroup {
  key: string
  /** `null` للشعبة كلّها، و`orphan` لما رُبط بمحورٍ لم يعد في الخطّة */
  moduleId: string | null | 'orphan'
  labelAr: string
  /** المصادرُ بموضعها في مصفوفة الخطّة الواحدة — التعديلُ والحذفُ يقعان عليها */
  rows: { r: ListResource; i: number }[]
}

/**
 * المصادرُ (غيرُ المسجَّلة) مجمّعةً: للشعبة كلّها أوّلا، ثمّ بترتيب المحاور، ثمّ ما رُبط
 * بمحورٍ حُذف. والمجموعةُ الفارغةُ لا تُعرض.
 */
export function groupResources(
  resources: readonly ListResource[],
  modules: readonly { moduleId: string; titleAr: string }[],
): ResourceGroup[] {
  const rows = resources.map((r, i) => ({ r, i })).filter(({ r }) => resourceCategory(r) !== 'recorded')
  const ids = modules.map((m) => m.moduleId)
  const out: ResourceGroup[] = []
  const whole = rows.filter(({ r }) => !r.moduleId)
  if (whole.length) out.push({ key: 'all', moduleId: null, labelAr: 'للشعبة كلّها', rows: whole })
  modules.forEach((m, k) => {
    const own = rows.filter(({ r }) => r.moduleId === m.moduleId)
    if (own.length) {
      const t = m.titleAr.trim()
      out.push({ key: m.moduleId, moduleId: m.moduleId, labelAr: `المحور ${k + 1}${t ? ` · ${t}` : ''}`, rows: own })
    }
  })
  const lost = rows.filter(({ r }) => r.moduleId && !ids.includes(r.moduleId))
  if (lost.length) out.push({ key: 'orphan', moduleId: 'orphan', labelAr: 'مربوط بمحور حذف — اختر له محورا', rows: lost })
  return out
}

/** الاسمُ الأوّلُ من اسم الملفّ — بلا امتداد، والفواصلُ مسافات. والمدرّبُ يعدّله في مكانه */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return padTitle(base || name.trim() || 'ملفّ')
}

/** الاسمُ الأوّلُ من الرابط — نطاقُه وأوّلُ مسارِه */
export function titleFromUrl(url: string): string {
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^www\./, '')
    const first = u.pathname.split('/').filter(Boolean)[0] ?? ''
    return padTitle(first ? `${host}/${decodeURIComponent(first)}`.slice(0, 80) : host)
  } catch {
    return padTitle(url.trim().slice(0, 80))
  }
}

/* اسمٌ أقصرُ من حدّ الخطّة يمنع حفظَها — فيُكمَّل بما يقوله */
const padTitle = (t: string) => (t.length >= PLAN_TITLE_MIN ? t : `مصدر: ${t}`.trim())

/** رابطٌ يُقبل مصدرا — https أو http بنطاق */
export function isResourceUrl(text: string): boolean {
  try {
    const u = new URL(text.trim())
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.')
  } catch {
    return false
  }
}

/** صفٌّ جديدٌ من ملفٍّ رُفع — كاملٌ من لحظته، فلا يمنع صفٌّ ناقصٌ الحفظ */
export function rowFromFile(file: { key: string; name: string; mime: string }): ListResource {
  const category: ResourceCategory = 'reading'
  return {
    title: titleFromFileName(file.name), url: null, noteAr: null, moduleId: null,
    category, kind: kindForCategory(category, true),
    bodyFileKey: file.key, bodyFileName: file.name, bodyFileMime: file.mime,
  }
}

/** صفٌّ جديدٌ من رابطٍ لُصق */
export function rowFromUrl(url: string): ListResource {
  const category: ResourceCategory = 'public'
  return {
    title: titleFromUrl(url), url: url.trim(), noteAr: null, moduleId: null,
    category, kind: kindForCategory(category, false),
  }
}

/** شارةُ النوع في الصفّ — «PDF» · «DOC» · «صورة» · «رابط» */
export function resourceBadge(r: ListResource): string {
  const mime = r.bodyFileMime ?? ''
  if ((r.bodyFileKey ?? '').trim()) {
    if (mime === 'application/pdf') return 'PDF'
    if (mime.includes('wordprocessingml')) return 'DOC'
    if (mime.includes('presentationml')) return 'PPT'
    if (mime.includes('spreadsheetml')) return 'XLS'
    if (mime.startsWith('image/')) return 'صورة'
    return 'ملفّ'
  }
  return 'رابط'
}
