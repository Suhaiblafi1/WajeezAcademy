/* صيغُ الحسابات البنكيّة بحسب الدولة — ليُملأ الفورمُ صحيحا من أيّ بلد.

   ═══ ولمَ (٢٩ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «تأكّد أنّ الفورمَ احترافيٌّ لكلّ الدول». وكانت
   الخانةُ IBAN وحدَه بمثالٍ أردنيّ، فمدرّبٌ في أمريكا أو كندا أو الهند —
   ولا IBAN في مصارفها — لا يجد ما يكتبه. فالدولةُ تُختار أوّلا، ومنها
   يُقترَح النوعُ (IBAN أو رقمٌ محلّيّ) واسمُ رمز التوجيه الذي يطلبه
   مصرفُها. والاقتراحُ لا يُلزم: النوعُ يُبدَّل بيده إن كان مصرفُه غيرَ ذلك.

   والتحقّقُ من رقم IBAN (باقي القسمة على ٩٧) يقع في الشاشة قبل الإرسال:
   خطأُ خانةٍ واحدةٍ في رقمٍ لا يُعاد إليه بعد حفظه لا يُكتشف إلّا يومَ
   تُردّ الحوالة. */

/** الدولُ التي تعمل مصارفُها بـIBAN — ما لم يُذكر فالرقمُ المحلّيُّ أقرب */
const IBAN_COUNTRIES = new Set([
  // العربيّة
  'AE', 'BH', 'EG', 'IQ', 'JO', 'KW', 'LB', 'LY', 'MR', 'OM', 'PS', 'QA', 'SA', 'SD', 'TN',
  // أوروبا وجوارُها
  'AD', 'AL', 'AT', 'AZ', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES',
  'FI', 'FO', 'FR', 'GB', 'GE', 'GI', 'GL', 'GR', 'HR', 'HU', 'IE', 'IL', 'IS', 'IT', 'KZ',
  'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS',
  'SE', 'SI', 'SK', 'SM', 'TR', 'UA', 'VA', 'XK',
  // وغيرُها
  'BR', 'CR', 'DO', 'GT', 'MU', 'PK', 'SC', 'TL', 'VG',
])

/** اسمُ رمز التوجيه المحلّيّ ومثالُه — حيث يطلبه المصرف */
const ROUTING: Record<string, { labelAr: string; example: string }> = {
  US: { labelAr: 'رقمُ التوجيه ABA', example: '021000021' },
  CA: { labelAr: 'رقمُ الفرع والمؤسّسة (Transit)', example: '00012-003' },
  IN: { labelAr: 'رمزُ IFSC', example: 'SBIN0000300' },
  AU: { labelAr: 'رمزُ BSB', example: '062-000' },
  NZ: { labelAr: 'رمزُ البنك والفرع', example: '01-0102' },
  MY: { labelAr: 'رمزُ البنك', example: 'MBBEMYKL' },
  SG: { labelAr: 'رمزُ البنك والفرع', example: '7171-001' },
  ZA: { labelAr: 'رمزُ الفرع', example: '250655' },
  MA: { labelAr: 'رمزُ البنك والمدينة (RIB)', example: '011780' },
  DZ: { labelAr: 'رمزُ البنك والوكالة (RIB)', example: '00100' },
}

export function isIbanCountry(iso2: string): boolean {
  return IBAN_COUNTRIES.has(iso2)
}

export function routingOf(iso2: string): { labelAr: string; example: string } {
  return ROUTING[iso2] ?? { labelAr: 'رمزُ التوجيه أو الفرع', example: '' }
}

/** يُطبَّع كما يحفظه الخادم: بلا مسافاتٍ ولا شَرطات، بحروفٍ كبيرة */
export function normalizeAccount(v: string): string {
  return v.replace(/[\s-]+/g, '').toUpperCase()
}

/** صحّةُ IBAN بباقي القسمة على ٩٧ (ISO 13616) — لا بطولِه وحدَه */
export function ibanChecksumOk(raw: string): boolean {
  const iban = normalizeAccount(raw)
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  const moved = iban.slice(4) + iban.slice(0, 4)
  let rem = 0
  for (const ch of moved) {
    const n = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch
    for (const d of n) rem = (rem * 10 + Number(d)) % 97
  }
  return rem === 1
}

/** صيغةُ SWIFT/BIC: ثماني خاناتٍ أو إحدى عشرة */
export function swiftOk(raw: string): boolean {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(normalizeAccount(raw))
}
