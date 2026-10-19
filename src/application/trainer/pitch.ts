/* ═══ «لماذا اخترناه» — سطورٌ نكتبها نحن عن المدرّب، ويقبلها هو ═══
 *
 * قرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦): «أضف كلماتٍ تشجّع الناس لهذا المدرّب،
 * والمدرّب يوافق أو يرفض التعديل». واختار لها موضعَ النبذة في البطاقة، والنبذةُ
 * تنتقل إلى ما يُفتح بالزرّ (`pages/Trainers.tsx`).
 *
 * والسطورُ **حقائقُ من نبذته هو** لا مديحٌ عامّ: «درّب أكثر من 250 متدربا مع
 * اليونيسف» لا «مدرّبٌ مميّز». وقاعدةُ المستودَع أقدم: لا قصّةَ تُعرض حقيقةً قبل
 * توثيقها — فلا يُكتب هنا ما لم يقله هو أو ما لم يقع عندنا.
 *
 * والقواعدُ هنا لا في الشاشة ولا في الخادم وحدَه: الشاشةُ تعدّ وتمنع قبل
 * الإرسال، والخادمُ يردّ ما تجاوزها — بالحكم نفسِه.
 */

/** ثلاثةُ أسطرٍ على الأكثر — ما يُقرأ بنظرةٍ في البطاقة */
export const PITCH_MAX_LINES = 3
/** وكلُّ سطرٍ جملةٌ واحدة — لا فقرة */
export const PITCH_MAX_CHARS = 120

/** السطورُ كما تُحفظ: مقصوصةُ الأطراف، بلا فراغ */
export function cleanPitchLines(raw: readonly string[]): string[] {
  return raw.map((l) => l.trim().replace(/\s+/g, ' ')).filter(Boolean)
}

/** ما يمنع الإرسال — `null` حين يصلح */
export function pitchProblemAr(lines: readonly string[]): string | null {
  if (lines.length === 0) return 'اكتب سطرا واحدا على الأقل'
  if (lines.length > PITCH_MAX_LINES) return `${PITCH_MAX_LINES} أسطر على الأكثر`
  if (lines.some((l) => l.length > PITCH_MAX_CHARS)) return `السطر أطول من ${PITCH_MAX_CHARS} حرفا`
  return null
}

/** «لماذا اخترنا منار» — باسمه الأوّل كما كتبه هو، عربيّا كان أو لاتينيّا */
export function pitchHeadingAr(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? ''
  return `لماذا اخترنا ${first}`
}
