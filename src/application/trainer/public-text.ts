/* ═══ عنوانُ المدرّب ونبذتُه في «المدربون» — يكتبهما هو، ونعتمدهما نحن ═══
 *
 * قرارُ صاحب المنصّة (٣ أكتوبر ٢٠٢٦): «B — and update the guide, but let me
 * edit it in case I want to before approval». فالمدرّبُ يكتب عنوانَه المهنيَّ
 * ونبذتَه من «إعدادات الحساب»، فيسكنان عمودَين معلَّقَين لا تقرؤهما الصفحةُ
 * العامّة — كصورته سواءً بسواء (`photoPendingKey`). ثمّ يقرؤهما من يملك
 * النشرَ، **فيعدّلهما إن شاء** ثمّ يعتمد، أو يردّهما بسبب.
 *
 * وكانت النبذةُ تُبذَر مرّةً من نموذج التقديم ولا يملك المدرّبُ تحسينَها، ومن
 * تقدّم قبل ١٣ سبتمبر كتبها لمراجعٍ يفحص طلبَه لا لمتعلّمٍ يوازن بين مدرّبَين.
 *
 * والقواعدُ هنا لا في الشاشة ولا في الخادم وحدَه: الشاشةُ تعدّ وتمنع قبل
 * الإرسال، والخادمُ يردّ ما تجاوزها — بالحكم نفسِه.
 */

/* سقفُ النبذة بالكلمات — ستّون، وهو سقفُ نموذج التقديم نفسُه
   (`pages/join-trainer/options.ts` يقرؤه من هنا): نبذةٌ واحدةٌ بسقفٍ واحد. */
export const BIO_MAX_WORDS = 60
export const HEADLINE_MAX_CHARS = 160
export const BIO_MAX_CHARS = 1200
export const BIO_MIN_WORDS = 10

export const countWords = (s: string): number => (s.trim() ? s.trim().split(/\s+/).length : 0)

/** ما يمنع الإرسال — `null` حين يصلح */
export function publicTextProblemAr(headline: string, bio: string): string | null {
  const h = headline.trim()
  const b = bio.trim()
  if (h.length < 3) return 'اكتب عنوانك المهنيّ — ثلاثة أحرف على الأقلّ'
  if (h.length > HEADLINE_MAX_CHARS) return `العنوان أطول من ${HEADLINE_MAX_CHARS} حرفا`
  const words = countWords(b)
  if (words < BIO_MIN_WORDS) return `النبذة ${BIO_MIN_WORDS} كلمات على الأقلّ`
  if (words > BIO_MAX_WORDS) return `النبذة أطول من ${BIO_MAX_WORDS} كلمة`
  if (b.length > BIO_MAX_CHARS) return `النبذة أطول من ${BIO_MAX_CHARS} حرف`
  return null
}

/* ═══ واسمُه المعروض — يرسله معهما (٢١ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «لماذا لا يمكن للمدرّب تغييرُ اسمه على الصفحة الرئيسيّة؟». ولم يكن يغيّره أحد: الاسمُ
   ما كُتب في طلبه. واختار «A»: يرسله المدرّبُ مع عنوانه ونبذته، ويبقى القديمُ ظاهرا حتّى نعتمده — ونعدّله
   قبل الاعتماد إن شئنا. والحدّان حدّا «عيّنه مدرّبا» في «المدربون». */
export const NAME_MIN_CHARS = 2
export const NAME_MAX_CHARS = 120

/** ما يمنع إرسالَ الاسم — `null` حين يصلح */
export function publicNameProblemAr(name: string): string | null {
  const n = name.trim()
  if (n.length < NAME_MIN_CHARS) return 'اكتب اسمك — حرفان على الأقل'
  if (n.length > NAME_MAX_CHARS) return `الاسم أطول من ${NAME_MAX_CHARS} حرفا`
  return null
}
