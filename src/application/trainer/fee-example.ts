/* المثالُ الحسابيُّ — صفحةٌ ترافق رابطَ التوقيع، **ولا تدخل العقد**.

   ── لماذا خارجَ الوثيقة الموقَّعة ──

   قُرئت مسوّدةُ هذا المثال بخمس قراءاتٍ مضادّة، وأمتنُ ما خرج منها أنّ موضعَه
   هو المسألة لا صياغتُه. فالبندُ 18-4 يجعل «الاتفاقيةَ **وملاحقها**» كاملَ ما
   اتّفق عليه الطرفان — فجدولٌ وُضع ليُقنع، إن دخل الملحق، صار **بندا** يُحتجّ
   به يومَ يخيب التسجيل، ولا يُصلحه تنويه. وهو نفسُه في بريدٍ سابقٍ للتوقيع
   لا يرتّب شيئا: البندُ ذاته يُسقط كلَّ تفاهمٍ سابقٍ «شفهيّا كان أو مكتوبا».

   فالإقناعُ في البريد، والالتزامُ في الملحق (ب) — وهما لا يلتقيان.

   ── وثلاثةٌ لا يُكتب فيها مثالٌ أصلا ──

   · **بلا قاعدةِ أتعابٍ** أو بأجرٍ مُعفًى: لا رقمَ يُبنى عليه.
   · **ونسبةُ الإيراد**: الرقمُ فيها دالّةٌ في سعرِ المقعد وهو رقمُنا نحن لا
     رقمُه، وإخراجُه يثبّت سعرَ الدورة في ذهنه قبل أن يوقّع.
   · **وبلا سعرٍ للإحالة**: يسقط ذكرُ الرابط كلُّه، فلا يُوعَد بقناةٍ لا
     تُحتسب له.

   ── وما لا يُسمّى هنا بقصد ──

   لا تُسمّى المقاعدُ العامّةُ «من تسويق الأكاديميّة». المحرّكُ لا يعرف ذلك:
   `general = total − referred` — كلُّ ما لم يسجّل عبر رابط **هذا** المدرّب،
   ومنه ما جاء به هو بلا رابطه، وما جاء برابط مدرّبٍ آخر. والحدُّ الأدنى
   يُكمَّل من هذه الخانة، فقد تحمل مقاعدَ لا يقابلها مسجَّلٌ أصلا. */

import type { ContractCompensation } from './contract-body'
import { perSeatBreakdown } from './seat-fee'

/** الشعبُ المفترَضةُ في المثال — أعدادٌ تُعلَن أنّها افتراض، لا توقُّعُ تسجيل */
const SCENARIO = [
  { seats: 20, referred: 10 },
  { seats: 12, referred: 3 },
  { seats: 5, referred: 2 },
] as const

export interface FeeExampleRow {
  labelAr: string
  amount: number
}

export interface FeeExample {
  rows: FeeExampleRow[]
  total: number
  currency: string
  noteAr: string
}

/** رقمٌ يُقرأ: منزلتان عند الحاجة، وبلا أصفارٍ معلّقة */
function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

export function buildFeeExampleAr(c: ContractCompensation | null): FeeExample | null {
  if (!c) return null
  const rate = Number(c.rate)
  if (!Number.isFinite(rate) || rate <= 0) return null

  if (c.type === 'fixed_per_cohort') {
    const rows = SCENARIO.map((_, i) => ({
      labelAr: `الشعبة ${['الأولى', 'الثانية', 'الثالثة'][i]}`,
      amount: rate,
    }))
    return {
      rows,
      total: rate * rows.length,
      currency: c.currency,
      noteAr: 'أتعابُك مبلغٌ ثابتٌ عن الشعبة، فلا يتغيّر بعدد المسجّلين. وعددُ الشعب أعلاه '
        + 'مفترضٌ للإيضاح وحدَه: لا تعِد هذه الصفحةُ بإسناد دورة ولا بفتح شعبة، '
        + 'والذي يلزم الطرفين هو الاتفاقيةُ وملاحقُها.',
    }
  }

  if (c.type !== 'per_seat') return null

  const referralRate = c.referralRate === null ? null : Number(c.referralRate)
  const minSeats = c.minSeats ?? 0
  const rows: FeeExampleRow[] = []

  for (const [i, s] of SCENARIO.entries()) {
    const referred = referralRate === null ? 0 : s.referred
    const b = perSeatBreakdown({
      general: s.seats - referred, referred, rate, referralRate, minSeats,
    })
    const parts: string[] = []
    if (referred > 0) parts.push(`${referred} عبر رابط إحالتك`)
    parts.push(`${b.generalSeats} مقعدا عامّا${b.floorApplied ? ` (احتُسبت على الحدّ الأدنى ${minSeats} مقعدا)` : ''}`)
    rows.push({
      labelAr: `الشعبة ${['الأولى', 'الثانية', 'الثالثة'][i]} — ${s.seats} مسجّلا: ${parts.join('، و')}`,
      amount: b.total,
    })
  }

  const referralNote = referralRate === null ? '' : ' والمقعدُ العامُّ هو كلُّ مقعدٍ لم يسجّل عبر رابطك.'
  return {
    rows,
    total: rows.reduce((t, r) => t + r.amount, 0),
    currency: c.currency,
    noteAr: `الأسعارُ أعلاه هي المثبتةُ في قاعدة أتعابك (${num(rate)} ${c.currency} للمقعد`
      + `${referralRate === null ? '' : `، و${num(referralRate)} للمقعد عبر رابطك`}`
      + `${minSeats > 0 ? `، وحدٌّ أدنى ${minSeats} مقعدا` : ''}).${referralNote}`
      + ' وأعدادُ المسجّلين مفترضةٌ للإيضاح وحدَها: لا تعِد هذه الصفحةُ بعددِ مسجّلين،'
      + ' ولا بإسناد دورة، ولا بفتح شعبة. والذي يلزم الطرفين هو الاتفاقيةُ وملاحقُها.',
  }
}

/** صفوفُ «حقائق» جاهزةٌ للبريد — نصٌّ لا حساب، فالحسابُ تمّ أعلاه */
export function feeExampleFactsAr(ex: FeeExample): { label: string; value: string }[] {
  return [
    ...ex.rows.map((r) => ({ label: r.labelAr, value: `${num(r.amount)} ${ex.currency}` })),
    { label: 'مجموعُ هذا المثال', value: `${num(ex.total)} ${ex.currency}` },
  ]
}
