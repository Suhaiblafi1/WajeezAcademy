/* ذيلُ رقم الهاتف — به يُطابَق رقمٌ وصل من واتساب برقمٍ كُتب عندنا (١٩ أكتوبر ٢٠٢٦).

   واتساب يرسل الرقمَ دوليّا بلا «+» (`962791234567`)، والزائرُ يكتبه كما يعرفه (`0791234567`)،
   والمستشارُ يُدخله بمسافاتٍ أو شرطات. ولا يُخمَّن مفتاحُ بلدٍ لرقمٍ محلّيّ (`normalizePhone`)،
   فلا يتساوى الرقمان حرفا بحرف. والذي يتساوى فيهما **آخرُ تسعة أرقام** — رقمُ الجوّال بلا
   مفتاح البلد ولا الصفر المحلّيّ، في الأردنّ والخليج ومصر. وما كان أقصرَ من سبعةٍ ليس رقما. */

const TAIL = 9

export function phoneTail(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw
    .replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) - (d.charCodeAt(0) >= 0x06F0 ? 0x06F0 : 0x0660)))
    .replace(/\D/g, '')
  return digits.length >= 7 ? digits.slice(-TAIL) : null
}
