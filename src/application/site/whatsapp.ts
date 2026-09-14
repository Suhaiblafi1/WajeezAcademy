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
