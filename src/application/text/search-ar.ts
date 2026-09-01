/* بحثٌ عربيٌّ يتسامح مع ما يتسامح معه الكاتب.

   من يبحث عن «احمد» يقصد «أحمد»، ومن يكتب «مصطفي» يقصد «مصطفى»، ومن ينسخ
   اسما من مستندٍ قد يجرّ معه تشكيلا أو تطويلا لا يراه. والمطابقةُ الحرفيّة
   تردّ هؤلاء كلَّهم بـ«لا نتائج» — وهي أسوأُ إجابةٍ حين تكون النتيجةُ
   موجودةً فعلا.

   فالتطبيع يقع على الطرفين معا قبل المقارنة:
   · الهمزات (أ إ آ ٱ) ← ا، والألف المقصورة ى ← ي، والتاء المربوطة ة ← ه
   · التشكيل والتطويل يُحذفان
   · الأرقام العربيّة-الهنديّة (٠١٢…) ← لاتينيّة، فيُطابَق رقمُ فاتورةٍ كيفما كُتب
   · والحروف اللاتينيّة تُصغَّر، والمسافاتُ تُطوى

   والاستعلامُ يُشقّ كلماتٍ: كلُّ كلمةٍ يجب أن توجد في حقلٍ ما — لا في الحقل
   نفسِه — فيصحّ البحثُ بـ«أحمد المالية» عن اسمٍ في حقلٍ ودورٍ في آخر. */

const AR_DIACRITICS = /[ً-ٰٟـ]/g

const FOLD: Record<string, string> = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا',
  'ى': 'ي', 'ة': 'ه',
}

/** يُوحّد النصّ قبل المقارنة — يُطبَّق على الاستعلام وعلى الحقل معا */
export function normalizeAr(input: string): string {
  const digits = input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
  return digits
    .replace(AR_DIACRITICS, '')
    .replace(/[أإآٱىة]/g, (c) => FOLD[c] ?? c)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** أتطابق كلُّ كلمةٍ من الاستعلام مع حقلٍ من الحقول؟ واستعلامٌ فارغ يطابق الكلّ */
export function matchesQuery(query: string, fields: readonly (string | null | undefined)[]): boolean {
  const terms = normalizeAr(query).split(' ').filter(Boolean)
  if (terms.length === 0) return true
  const hay = fields.filter((f): f is string => Boolean(f)).map(normalizeAr)
  return terms.every((t) => hay.some((h) => h.includes(t)))
}
