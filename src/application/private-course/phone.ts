/* ═══ رقمُ المتعلّم بمفتاح دولته — صيغةٌ واحدةٌ تُحفظ (١٩ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «الرقم يجب أن يكون بمفتاح الدولة». فالنموذجُ يسأل عن الدولة أوّلا ثمّ الرقم، والمحفوظُ
   `+962797708080` لا «0797708080» — فيُفتح واتساب منه بنقرةٍ ولا يُخمَّن بلدُه.

   ويقبل ما يكتبه الناسُ فعلا: صفرَ البداية، والمسافات، والأرقامَ الهنديّة، ومن لصق رقمَه كاملا بمفتاحه
   (`+962…` أو `00962…`). والطولُ يُقاس بجدول `MOBILE_FORMATS` حيث نعرفه يقينا، وبحدٍّ عامٍّ حيث لا نعرفه —
   فلا يُردّ رقمٌ صحيح من بلدٍ لا نعرف أطوالَه.

   ويقرؤه الخادمُ والصفحةُ معا، فلا يقبل أحدُهما ما يردّه الآخر. */

import { COUNTRIES, MOBILE_FORMATS, type Country } from '../../data/countries'

export type PhoneCheck =
  | { ok: true; e164: string; country: Country }
  | { ok: false; error: string }

const HINDI = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹'

/** الأرقامُ الهنديّةُ والفارسيّةُ إلى لاتينيّة — ولا يبقى غيرُ الأرقام و`+` في أوّله */
function latinDigits(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String(HINDI.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d)))
}

export function countryByIso(iso2: string): Country | null {
  return COUNTRIES.find((c) => c.iso2 === iso2) ?? null
}

export function normalizePhone(iso2: string, local: string): PhoneCheck {
  const country = countryByIso(iso2)
  if (!country) return { ok: false, error: 'اختر الدولة' }
  const dial = country.dial.replace('+', '')
  let digits = latinDigits(local).trim()
  const intl = digits.startsWith('+') || digits.startsWith('00')
  digits = digits.replace(/\D/g, '')
  if (intl) {
    digits = digits.replace(/^00/, '')
    /* لصق رقمَه كاملا بمفتاحه — والمفتاحُ غيرُ ما اختار: يُقال له، لا يُحفظ رقمُ بلدٍ آخر باسم بلده */
    if (!digits.startsWith(dial)) return { ok: false, error: `الرقم لا يبدأ بمفتاح ${country.ar} (${country.dial})` }
    digits = digits.slice(dial.length)
  }
  digits = digits.replace(/^0+/, '')
  if (!digits) return { ok: false, error: 'اكتب رقم الهاتف' }
  const format = MOBILE_FORMATS[country.iso2]
  if (format && !format.digits.includes(digits.length)) {
    return { ok: false, error: `رقم ${country.ar} ${format.digits.join(' أو ')} خانات بعد المفتاح — مثل ${format.example}` }
  }
  if (!format && (digits.length < 6 || digits.length > 12)) return { ok: false, error: 'رقم الهاتف غير صحيح' }
  if (dial.length + digits.length > 15) return { ok: false, error: 'رقم الهاتف أطول من المعتاد' }
  return { ok: true, e164: `+${dial}${digits}`, country }
}

/** رابطُ واتساب للرقم المحفوظ — `wa.me` يقبل الأرقامَ وحدَها */
export function whatsappLink(e164: string, text?: string): string {
  const base = `https://wa.me/${e164.replace(/\D/g, '')}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}
