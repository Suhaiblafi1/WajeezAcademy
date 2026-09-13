/* اسمُ المدرّب في العنوان — كيف يصير اسمٌ عربيٌّ مسارا يُقرأ ويُنسخ.

   قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): «عند العميل يجب أن يظهر مسارٌ خاصٌّ
   باسم المدرّب للعامّة في الرابط ليقوموا بالتسجيل فيه». فالعنوانُ يحمل اسمَه
   لا رمزا: `/t/محمد-العتيبي` لا `/t/WJ-K7P2M9QX`.

   والحروفُ العربيّةُ تبقى عربيّةً في العنوان — لا تُنقحر. فالمتصفّحُ يعرضها
   كما هي ويرمّزها عند الإرسال، والقارئُ العربيُّ يقرأ اسمَ مدرّبه. ونقحرتُها
   إلى اللاتينيّة تُخرج `mhmd-alatyby` — لا يعرفه صاحبُه ولا يثق به قارئُه.

   وما يُنزع: التشكيلُ والتطويلُ (فـ`محمّد` و`محمد` مسارٌ واحد لا مساران)، وكلُّ
   ما ليس حرفا ولا رقما ولا فاصلة. */

/** التشكيلُ والتطويل — يُنزعان قبل أيّ شيء */
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g
/** ما يُسمح به في المسار: عربيّةٌ ولاتينيّةٌ وأرقامٌ لاتينيّةٌ وعربيّة */
const KEEP = /[ء-غف-يٮ-ۓ۰-۹٠-٩a-z0-9]/

/** حدُّ الطول — عنوانٌ أطولَ من هذا لا يُنسخ في رسالة */
export const SLUG_MAX = 60

/**
 * اسمٌ إلى مسار. يعيد `null` حين لا يبقى من الاسم حرفٌ صالح — فلا يُختلق
 * مسارٌ فارغٌ ولا مسارٌ من شرطاتٍ وحدَها، والنداءُ هو من يقرّر البديل.
 */
export function slugifyName(name: string): string | null {
  const cleaned = name.normalize('NFKC').replace(MARKS, '').toLowerCase()
  let out = ''
  for (const ch of cleaned) {
    if (KEEP.test(ch)) out += ch
    else if (out.length > 0 && !out.endsWith('-')) out += '-'
  }
  out = out.replace(/-+$/, '').slice(0, SLUG_MAX).replace(/-+$/, '')
  return out.length > 0 ? out : null
}

/**
 * مسارٌ لا يصطدم بمأخوذ. الأوّلُ بلا لاحقة — فمن سبق له اسمُه مجرّدا، ومن
 * تلاه يأخذ `-2` ثمّ `-3`. واللاحقةُ تُقتطع من الاسم لا تُزاد عليه كي لا
 * يتجاوز الحدَّ.
 */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `-${n}`
    const candidate = base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '') + suffix
    if (!taken.has(candidate)) return candidate
  }
  throw new Error('تعذّر اشتقاقُ مسارٍ فريد')
}
