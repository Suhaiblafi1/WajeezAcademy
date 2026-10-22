/* مواضعُ واتساب في الموقع — سجلٌّ واحدٌ تقرؤه الشاشةُ والإدارةُ معا.

   ═══ العطبُ الذي كُتب له ═══

   كان الرقمُ حرفا في الشيفرة: `CONTACT.whatsapp = '962771052222'` في
   `data/stories.ts`، تقرؤه **خمسةُ مواضع**. فتغييرُ رقمِ مستشارٍ يقتضي تعديلَ
   شيفرةٍ ونشرةً كاملة — والرقمُ أكثرُ ما يتغيّر في منصّةٍ فتيّة.

   وقرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «ابنِ لي صفحةً تسهّل عليّ إدخالَ رقم
   واتساب لكلّ مكانٍ فيه تواصلٌ مع واتساب».

   ═══ ولماذا سجلٌّ لا حقلٌ واحد ═══

   المواضعُ ليست واحدا: من يراسل مستشارا قبل الدفع غيرُ من يرسل صورةَ إثباتِ
   خصمِ فئة. وقد يكونان رقمَين يوما، وقد يكونان اليومَ واحدا. فالسجلُّ يسمّي
   كلَّ موضعٍ **وأين يظهر** — فمن يملأ الحقلَ في الإدارة يعرف ما الذي يغيّره،
   ولا يخمّن.

   وإضافةُ موضعٍ جديدٍ سطرٌ هنا: تظهر له خانتُه في الإدارة من نفسها. */

export interface WhatsAppSpot {
  key: string
  /** ما يُسمّى به في شاشة الإدارة */
  labelAr: string
  /** أين يظهر هذا الزرُّ فعلا — فمن يغيّره يعرف ما الذي يمسّه */
  whereAr: string
}

export const WHATSAPP_SPOTS: WhatsAppSpot[] = [
  {
    key: 'advisor',
    labelAr: 'مراسلة مستشار وجيز',
    whereAr: 'الصفحة الرئيسية · صفحة المسار · صفحة الدورة',
  },
  {
    key: 'advisor_brief',
    labelAr: 'مستشار قبل الدفع — مع ورقة الملخّص',
    whereAr: 'صفحة المسار، بعد حفظ الورقة',
  },
  {
    key: 'discount_proof',
    labelAr: 'إثبات أهليّة خصم الفئة',
    whereAr: 'صفحة المسار · صفحة الدورة — تحت السعر',
  },
  /* ردُّ المدرّب على إعلانٍ منّا (٢١ أكتوبر ٢٠٢٦) — وما خلا منه رجع إلى رقم المستشار */
  {
    key: 'trainer_reply',
    labelAr: 'ردّ المدرّبين على رسائلنا',
    whereAr: 'بوابة المدرب · الرسائل والتنبيهات',
  },
]

export type WhatsAppNumbers = Record<string, string>

/* ═══ الأرقامُ تُطبَّع قبل أن تُحفظ ═══

   من نسخ رقما من هاتفه جاء بـ«+962 77 105 2222» أو «00962…» أو بفواصل.
   و`wa.me` لا يقبل إلّا الأرقامَ مجرّدةً بلا صفرٍ دوليٍّ ولا زائد. فرقمٌ
   يُحفظ كما نُسخ يُنتج رابطا لا يفتح — ولا يقول أحدٌ لماذا. */
export function normalizeWhatsApp(raw: string): string {
  const digits = (raw ?? '').replace(/[^\d+]/g, '')
  if (!digits) return ''
  /* «00» بادئةُ الاتّصال الدوليّ في أكثر العالم، و«+» صورتُها المكتوبة */
  return digits.replace(/^\+/, '').replace(/^00/, '')
}

/** أصالحٌ للاستعمال؟ — أرقامٌ فقط، وطولٌ معقولٌ لرقمٍ دوليّ */
export function isValidWhatsApp(raw: string): boolean {
  const n = normalizeWhatsApp(raw)
  return /^\d{8,15}$/.test(n)
}

/* ═══ والرجوعُ إلى موضعٍ آخرَ خيرٌ من زرٍّ لا يفتح ═══

   إن خلا موضعٌ رجعنا إلى «مراسلة مستشار»، وإن خلا هو رجعنا إلى الرقم
   المدمج. فزرُّ واتسابٍ يفتح رقما عامّا خيرٌ من زرٍّ يفتح `wa.me/` فارغا
   — ومن ضبط رقما واحدا لا يُعاقَب بأربعة أزرارٍ معطَّلة. */
export function whatsAppFor(numbers: WhatsAppNumbers, key: string, fallback: string): string {
  return normalizeWhatsApp(numbers[key] || numbers.advisor || fallback)
}

/** رابطُ المحادثة — ولا يُبنى إن لا رقمَ، فيُعرض بديلُه */
export function waHref(numbers: WhatsAppNumbers, key: string, fallback: string, text: string): string | null {
  const n = whatsAppFor(numbers, key, fallback)
  if (!n) return null
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}

/** رابطُ واتساب **إلى إنسانٍ** برقمه كما حُفظ (لا إلى أرقام الأكاديميّة) — متابعةُ من عبّأ نموذج المنحة
    (`GrantRegistrants`). بمفتاحه الدوليّ (+ أو 00)، أو جوّالٍ أردنيٍّ محلّيّ (07[789]…) يُكمَل
    بـ962. ولا يُخمَّن مفتاحٌ لغيره: رابطٌ بمفتاحٍ مختلَقٍ يفتح محادثةً مع غير صاحب الرقم — فبلا رابط. */
export function waToPerson(phone: string | null | undefined, text: string): string | null {
  const raw = phone?.trim() ?? ''
  let digits: string | null = null
  if (/^\+\d{7,15}$/.test(raw)) digits = raw.slice(1)
  else if (/^00\d{7,15}$/.test(raw)) digits = raw.slice(2)
  else if (/^07[789]\d{7}$/.test(raw)) digits = `962${raw.slice(1)}`
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null
}

/** رابطُ مشاركةٍ في واتساب **بلا رقم** — يختار صاحبُه لمن يرسله. «أهد منحة لصديق» في صفحة المنحة (٢١ أكتوبر ٢٠٢٦) */
export function waShare(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
