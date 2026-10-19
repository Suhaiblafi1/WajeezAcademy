/* ═══ «لماذا نفتخر به» — سطورٌ نكتبها نحن عن المدرّب، ويقبلها هو ═══
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

import { BIO_MAX_CHARS, BIO_MAX_WORDS, BIO_MIN_WORDS, countWords } from './public-text'

/** ثلاثةُ أسطرٍ على الأكثر — ما يُقرأ بنظرةٍ في البطاقة */
export const PITCH_MAX_LINES = 3
/* وكلُّ سطرٍ جملةٌ واحدةٌ باثنتي عشرةَ كلمةً على الأكثر — «حدّد عدد الكلمات للتناسق»
   (صاحب المنصّة، ١٩ أكتوبر ٢٠٢٦): البطاقاتُ العشرُ بجوار بعضها، وسطرٌ بثلاثين كلمةً
   يطيل صندوقا واحدا فيختلّ الصفّ. والحروفُ سقفٌ ثانٍ لكلمةٍ لا تنتهي. */
export const PITCH_MAX_WORDS = 12
export const PITCH_MAX_CHARS = 120

/** السطورُ كما تُحفظ: مقصوصةُ الأطراف، بلا فراغ */
export function cleanPitchLines(raw: readonly string[]): string[] {
  return raw.map((l) => l.trim().replace(/\s+/g, ' ')).filter(Boolean)
}

/** ما يمنع الإرسال — `null` حين يصلح */
export function pitchProblemAr(lines: readonly string[]): string | null {
  if (lines.length === 0) return 'اكتب سطرا واحدا على الأقل'
  if (lines.length > PITCH_MAX_LINES) return `${PITCH_MAX_LINES} أسطر على الأكثر`
  if (lines.some((l) => countWords(l) > PITCH_MAX_WORDS)) return `السطر ${PITCH_MAX_WORDS} كلمة على الأكثر`
  if (lines.some((l) => l.length > PITCH_MAX_CHARS)) return `السطر أطول من ${PITCH_MAX_CHARS} حرفا`
  return null
}

/* ═══ والنبذةُ بصياغتنا — «قبل/بعد» يقبلها أو يرفضها (١٩ أكتوبر ٢٠٢٦) ═══
   بحدود نبذته هو نفسِها (`public-text.ts`): نبذةٌ واحدةٌ بسقفٍ واحد، أيًّا كاتبُها. */
export function bioSuggestionProblemAr(text: string): string | null {
  const t = text.trim()
  const words = countWords(t)
  if (words < BIO_MIN_WORDS) return `النبذة ${BIO_MIN_WORDS} كلمات على الأقل`
  if (words > BIO_MAX_WORDS) return `النبذة ${BIO_MAX_WORDS} كلمة على الأكثر`
  if (t.length > BIO_MAX_CHARS) return `النبذة أطول من ${BIO_MAX_CHARS} حرفا`
  return null
}

/* ═══ «نفتخر» لا «اخترنا» (١٩ أكتوبر ٢٠٢٦) ═══

   كان العنوانُ «لماذا اخترنا منار». وقال صاحبُ المنصّة: «لماذا نفتخر بـ — بدلا من
   اخترنا — لكي يشعر بالولاء وليس بأنّه خيارٌ من آخرين». فـ«اخترنا» تقول للمدرّب
   وللزائر معا إنّه واحدٌ من قائمةٍ فُرزت، و«نفتخر» تقول إنّه منّا. */

/** «لماذا نفتخر بمنار» — باسمه الأوّل كما كتبه هو. والباءُ تتّصل بالاسم العربيّ
    («بمنار»)، وتنفصل بكشيدةٍ عن اللاتينيّ («بـ Reine») كي لا يلتصق حرفٌ بحرفٍ من خطٍّ آخر. */
export function pitchHeadingAr(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? ''
  return /^[A-Za-z]/.test(first) ? `لماذا نفتخر بـ ${first}` : `لماذا نفتخر ب${first}`
}
