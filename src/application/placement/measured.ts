/* المستوى المقيس — ما قاله اختبارُ تحديد المستوى على هذا الجهاز (٨ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة (الإصدارُ الثالث): حين يُحدِّث المتعلّمُ خطّتَه بمستوى الاختبار
   يقول سطرُ المستوى «بناءً على اختبار تحديد المستوى المجانيّ» — لا «بناءً على جوابك»
   كأنّه وصفه بنفسه. فيُحفظ المستوى المقيسُ عند التصحيح، ويُقابَل به المستوى الذي
   بُنيت عليه الخطّة: إن طابقه فهو مقيسٌ لا موصوف، وإن خالفه (اختار «أبقِ مستواي
   الموصوف») بقي السطرُ على جوابه.

   والحفظُ على الجهاز كجلسة التشخيص نفسِها — لا حسابَ ولا خادم، فالاختبارُ بلا دخول. */

import { ENGLISH_LEVELS, type EnglishLevel } from '../../domain/diagnostic/v2_1/english'

export const MEASURED_ENGLISH_KEY = 'wajeez_placement_english_v1'

export function rememberMeasuredEnglish(level: EnglishLevel, at = new Date()): void {
  try {
    localStorage.setItem(MEASURED_ENGLISH_KEY, JSON.stringify({ level, at: at.toISOString() }))
  } catch { /* بلا تخزين يبقى السطرُ على الجواب — وهو صادقٌ أيضا */ }
}

export function measuredEnglish(): EnglishLevel | null {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(MEASURED_ENGLISH_KEY)
    const level = raw ? (JSON.parse(raw) as { level?: unknown }).level : null
    return ENGLISH_LEVELS.some((l) => l.code === level) ? (level as EnglishLevel) : null
  } catch {
    return null
  }
}

/* ── ومستوى المجال المقيس بفحص المهارة — لكلّ احتياجٍ مستواه ── */

export const MEASURED_FIELDS_KEY = 'wajeez_placement_fields_v1'

const FIELD_CODES = ['none', 'basics', 'independent', 'lead']

export function measuredFields(): Record<string, string> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(MEASURED_FIELDS_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, { level?: unknown }>) : {}
    const out: Record<string, string> = {}
    for (const [need, v] of Object.entries(all)) {
      if (typeof v?.level === 'string' && FIELD_CODES.includes(v.level)) out[need] = v.level
    }
    return out
  } catch {
    return {}
  }
}

export function rememberMeasuredField(need: string, level: string, at = new Date()): void {
  try {
    const raw = localStorage.getItem(MEASURED_FIELDS_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    all[need] = { level, at: at.toISOString() }
    localStorage.setItem(MEASURED_FIELDS_KEY, JSON.stringify(all))
  } catch { /* بلا تخزين يبقى السطرُ على الجواب */ }
}
