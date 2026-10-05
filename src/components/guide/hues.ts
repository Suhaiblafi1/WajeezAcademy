/* ألوانُ التمييز الأربعة في الدليل وأخواته — بالتناوب، ومعها رقمُ القسم بخانتين.

   كانت في `pages/trainer/Guide.tsx` وحدَه. ثمّ صارت لها أختٌ — «التدريبُ معنا»
   (`TrainerBrief.tsx`) — تأخذ ألوانَه وترقيمَه، فانتقلت إلى وحدةٍ بلا React:
   ملفُّ مكوّنٍ يصدّر دوالَّ يكسر التحديثَ الحيَّ (`react-refresh`)، ونسختان
   منها تفترقان عند أوّل لونٍ يُضاف. */

export const HUES = ['amber', 'coral', 'sky', 'blush'] as const
export type Hue = (typeof HUES)[number]

/** لونُ القسم بترتيبه — مربّعُ الرقم وشارتُه بلونٍ واحد */
export const hueOf = (i: number): Hue => HUES[i % HUES.length]

/** «01» لا «1» — كما في مربّعات الرقم */
export const pad2 = (n: number) => String(n).padStart(2, '0')
