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

/* ─────────── «أل» التعريف — تُوسَّع ولا تُحذف ───────────

   المطابقةُ باحتواء النصّ تكفي في اتّجاهٍ واحد: من كتب «قيادة» يجد «القيادة»
   لأنّها تحتويها. **والعكسُ يسقط**: من كتب «القيادة» لا يجد «قيادة الذات»
   ولا «قيادة التغيير» — والفرقُ مقيسٌ على الكتالوج: **خمسُ دوراتٍ بدل واحدة**.

   والحذفُ الأعمى للألف واللام يُفسد أكثرَ ممّا يُصلح: «التزام» ليست «ال» +
   «تزام»، و«الكل» ليست «ال» + «كل».

   فالكلمةُ تُجرَّب بأشكالها الثلاثة — كما كُتبت، وبلا «ال»، وبـ«ال» — ويكفي
   أن يطابق أحدُها. توسعةٌ لا تُتلف شيئا: أسوأُ ما فيها مطابقةٌ زائدةٌ نادرة،
   وأسوأُ ما في الحذف نتيجةٌ تضيع. */
export function termVariantsAr(term: string): string[] {
  const out = new Set([term])
  if (term.startsWith('ال') && term.length > 3) out.add(term.slice(2))
  else if (term.length > 1) out.add(`ال${term}`)
  return [...out]
}

/** أتطابق كلُّ كلمةٍ من الاستعلام مع حقلٍ من الحقول؟ واستعلامٌ فارغ يطابق الكلّ */
export function matchesQuery(query: string, fields: readonly (string | null | undefined)[]): boolean {
  return matchesTerms(normalizeAr(query).split(' ').filter(Boolean), fields)
}

/** المطابقةُ نفسُها بكلماتٍ مُطبَّعةٍ سلفا — لمن وسّع الاستعلامَ بمرادفاته */
export function matchesTerms(
  terms: readonly string[], fields: readonly (string | null | undefined)[],
): boolean {
  if (terms.length === 0) return true
  const hay = fields.filter((f): f is string => Boolean(f)).map(normalizeAr)
  return terms.every((t) => termVariantsAr(t).some((v) => hay.some((h) => h.includes(v))))
}
