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
