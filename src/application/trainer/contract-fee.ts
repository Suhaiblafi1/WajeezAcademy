/* أتعابُ العقد الجديد — نوعُها نوعُ القاعدة السارية، ولا تُكتب قاعدةٌ إلّا إن تغيّر رقم (٢٤ أكتوبر ٢٠٢٦).

   ═══ ما كان ═══

   كانت شاشةُ تركيب العقد تملأ خاناتِ «سعر المقعد» من القاعدة السارية **أيًّا كان نوعُها**، ثمّ ترسل ما فيها
   بنوع `per_seat` دائما. فمدرّبٌ أجرُه «ثابتٌ لكلّ شعبة: 400» يُركَّب له عقدٌ والخاناتُ كما مُلئت، فتُكتب له قاعدةٌ
   جديدة: «400 لكلّ متعلّم» — وتُطبَع في متن عقده. ومن أجرُه بالمقعد تُكتب له قاعدةٌ ثانيةٌ بالأرقام نفسِها مع كلّ عقد.
   وفوق الخانات سطرٌ يقول «تُقرأ هنا ولا تُحرَّر». ظهر ذلك في دراسة لوحة الإدارة، ولم يُبلَّغ عن وقوعه.

   ═══ والقاعدة ═══

   · النوعُ نوعُ القاعدة السارية — ومن لا قاعدةَ له فبالمقعد كما كان. وتبديلُ النوع من «أتعاب المدربين» وحدَها،
     والخادمُ يردّ تبديلَه من العقد (`feeTypeChangeAr`).
   · وما لم يتغيّر رقمٌ فيه لا يُرسَل، ولا يكتب الخادمُ قاعدةً ثانيةً بالأرقام نفسِها (`sameFeeAsRule`).

   وإعادةُ العقد للتوقيع وقبولُ التعديل كانا على هذا من قبل: يُبقيان نوعَ الصفّ ولا يرسلان إلّا ما تغيّر
   (`TrainerContracts.tsx`، `personalChangesAr`). فصار التركيبُ مثلَهما.

   ═══ ثمّ لم تعد الشاشاتُ تكتب أجرا هنا (قرارُ «a»، ٢٦ أكتوبر ٢٠٢٦) ═══

   الأجرُ يُضبط في «الاتفاقية» من ملفّ المدرّب وحدَها. فذهبت خاناتُ الأجر من التركيب والإعادة ومعها ما كان يملؤها
   ويقيسها في المتصفّح: التركيبُ يأخذ القاعدةَ السارية، والإعادةُ تُبقي أجرَ العقد أو تأخذ أجرَ «الاتفاقية» (`feeFromRule`).
   وبقي ما يقيس به الخادمُ أجرا يصله مكتوبا من غير الشاشات (`sameFeeAsRule` و`feeTypeChangeAr`). */

import { RULE_TYPE_AR } from './compensation-labels'
import { CONTRACT_AMENDMENT_REQUESTED } from './contract-endings'

export type FeeType = 'per_seat' | 'fixed_per_cohort' | 'revenue_share'

/** القاعدةُ السارية كما تصل الشاشةَ والخادم — والأرقامُ نصوصٌ من `Decimal` أو أعداد */
export interface FeeRuleLike {
  type: string
  rate: string | number
  minSeats: number | null
  referralRate: string | number | null
}

/** ما يُرسَل مع العقد — والغيابُ يعني «تبقى القاعدةُ السارية كما هي» */
export interface FeeInput {
  type: string
  rate: number
  minSeats?: number
  referralRate?: number | null
}

const asNumber = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' && v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** هل يقول المُرسَلُ ما تقوله القاعدةُ السارية؟ — بمقياس `setRule` نفسِه: الحدُّ الغائبُ صفر،
    ومقعدُ الرابط للمقعد وحدَه */
export function sameFeeAsRule(rule: FeeRuleLike, input: FeeInput): boolean {
  if (rule.type !== input.type) return false
  if (asNumber(rule.rate) !== asNumber(input.rate)) return false
  if ((rule.minSeats ?? 0) !== (input.minSeats ?? 0)) return false
  if (rule.type !== 'per_seat') return true
  return asNumber(rule.referralRate) === asNumber(input.referralRate ?? null)
}

/** تبديلُ النوع من شاشة العقد — يُردّ ويُقال أين يُبدَّل. و`null` = لا تبديل */
export function feeTypeChangeAr(rule: Pick<FeeRuleLike, 'type'> | null, input: Pick<FeeInput, 'type'> | null | undefined): string | null {
  if (!rule || !input || rule.type === input.type) return null
  const now = RULE_TYPE_AR[rule.type] ?? rule.type
  return `نوع الأجر الحالي «${now}». غيّره في «الاتفاقية» من ملفه أولا.`
}

/** الأجرُ في سطرٍ يُقرأ — نوعُه ورقمُه، والحدُّ الأدنى ومقعدُ الرابط إن كانا. و«بلا أجر» لعقدٍ بلا أجر.
    تقرؤه نافذةُ الإعادة حين تقول أجرَ عقده وأجرَ «الاتفاقية» — فلا تكتب كلٌّ منهما الأجرَ بصيغتها. */
export function feeLineAr(fee: {
  type: string; rate: string | number; currency?: string | null
  minSeats?: number | null; referralRate?: string | number | null
} | null): string {
  if (!fee) return 'بلا أجر'
  const unit = fee.type === 'revenue_share' ? '%' : fee.currency ?? ''
  const parts = [`${RULE_TYPE_AR[fee.type] ?? fee.type} ${String(fee.rate)} ${unit}`.trim()]
  if (fee.minSeats) parts.push(`حد أدنى ${fee.minSeats} مقعدا`)
  if (fee.type === 'per_seat' && asNumber(fee.referralRate ?? null) !== null) parts.push(`بالإحالة ${String(fee.referralRate)}`)
  return parts.join(' · ')
}

/* ═══ وعقدٌ خرج ولم ينفذ — نصُّه مجمَّدٌ بأجره (٢٦ أكتوبر ٢٠٢٦) ═══

   خطوةُ الأجر في «الاتفاقية» تكتب القاعدةَ وحدَها، ونصُّ عقدٍ خرج لا يتغيّر بها: يوقّع المدرّبُ على ما فيه ويُحسب له
   ما في القاعدة. وتركيبُ العقد وإعادتُه يكتبان الاثنين معا (`setRule` في المعاملة نفسِها). وكانت الخطوةُ للماليّة
   وحدَها، فصارت للمدير الأكاديميّ معها (قرارُ «C») — وهو من يركّب العقد. فما دام له عقدٌ خرج ولم ينفذ يُقال ذلك قبل
   الحفظ، والخياران: هنا وحدَه، أو مع العقد في «العقود».

   والنافذُ ليس منه: أجرُ النشط يُغيَّر بالقاعدة، والعقدُ لا يُعاد بأجرٍ جديدٍ له (`fee_active_trainer`).

   ── ثمّ صار الأجرُ في «الاتفاقية» وحدَها (قرارُ «a»، ٢٦ أكتوبر ٢٠٢٦) ──

   فلا يُغيَّر «مع العقد في «العقود»» بعدُ: يُحفظ هنا، ثمّ يحمله نصُّه إن أُعيد إصدارُه — وطريقُه بحاله (`HOW_AR`):
   المفتوحُ يُلغى ويُركَّب غيرُه فيأخذ القاعدة، والموقَّعُ يُعاد للتوقيع، وطالبُ التعديل يُقبل طلبُه — وفي الأخيرين
   يُختار أجرُ «الاتفاقية». و«ينتظر اعتمادك» صار «ينتظر اعتماد توقيعه»: تقرؤه الماليّةُ ولا تعتمد. */
const OUT_PHRASE_AR: Record<string, string> = {
  draft: 'جاهز ولم يرسل',
  sent: 'أرسل ولم يوقعه',
  signed: 'وقعه وينتظر اعتماد توقيعه',
  [CONTRACT_AMENDMENT_REQUESTED]: 'طلب تعديله',
}

/** كيف يحمل نصُّه الأجرَ الجديد — بحاله، من «العقود» */
const HOW_AR: Record<string, string> = {
  draft: 'ولتحمله نصه: ألغه في «العقود» وجهّز غيره، فيأخذ الجديد أجر «الاتفاقية».',
  sent: 'ولتحمله نصه: ألغه في «العقود» وجهّز غيره، فيأخذ الجديد أجر «الاتفاقية».',
  signed: 'ولتحمله نصه: أعده للتوقيع من «العقود» واختر أجر «الاتفاقية».',
  [CONTRACT_AMENDMENT_REQUESTED]: 'ولتحمله نصه: اقبل طلب تعديله من «العقود» واختر أجر «الاتفاقية».',
}

export interface OutContractLike {
  title: string
  status: string
  createdAt?: string | Date | null
  compensationType?: string | null
  compensationRate?: string | number | null
  currency?: string | null
}

/** أحدثُ عقدٍ خرج ولم ينفذ — بحاله وأجره كما في نصّه. و`null` = لا عقدَ يفترق عن القاعدة بحفظها */
export function outContractOf<T extends OutContractLike>(contracts: readonly T[]): { contract: T; phraseAr: string; feeAr: string; howAr: string } | null {
  const time = (c: T) => (c.createdAt ? new Date(c.createdAt).getTime() : 0)
  const contract = contracts.filter((c) => Object.hasOwn(OUT_PHRASE_AR, c.status)).sort((a, b) => time(b) - time(a))[0]
  if (!contract) return null
  const type = contract.compensationType
  const feeAr = type
    ? `بأجر ${RULE_TYPE_AR[type] ?? type} ${String(contract.compensationRate ?? 0)} ${type === 'revenue_share' ? '%' : contract.currency ?? ''}`.trim()
    : 'بلا أجر'
  return { contract, phraseAr: OUT_PHRASE_AR[contract.status], feeAr, howAr: HOW_AR[contract.status] }
}
