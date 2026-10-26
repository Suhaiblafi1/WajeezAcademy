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
   (`TrainerContracts.tsx`، `personalChangesAr`). فصار التركيبُ مثلَهما. */

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

/** خاناتُ الشاشة كما تُكتب */
export interface FeeForm { rate: string; referralRate: string; minSeats: string }

/** أسماءُ الخانات بنوع القاعدة — ومقعدُ الرابط للمقعد وحدَه، فلا خانةَ له في غيره */
export const FEE_FIELDS_AR: Record<FeeType, { rate: string; referral: string | null; minSeats: string }> = {
  per_seat: { rate: 'سعر المقعد العام', referral: 'سعر المقعد عبر رابطه', minSeats: 'الحد الأدنى للمقاعد' },
  fixed_per_cohort: { rate: 'أجر الشعبة الواحدة', referral: null, minSeats: 'الحد الأدنى للمقاعد' },
  revenue_share: { rate: 'النسبة من الإيراد %', referral: null, minSeats: 'الحد الأدنى للمقاعد' },
}

const asNumber = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' && v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const feeTypeOf = (rule: Pick<FeeRuleLike, 'type'> | null): FeeType =>
  (rule && rule.type in FEE_FIELDS_AR ? rule.type : 'per_seat') as FeeType

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
  return `نوع الأجر الحالي «${now}». غيّره من «أتعاب المدربين» أولا، أو اترك خانات الأجر كما هي.`
}

/** خاناتُ الشاشة من القاعدة السارية — بأرقامها ونوعها */
export function feeFormOf(rule: FeeRuleLike | null): FeeForm {
  if (!rule) return { rate: '', referralRate: '', minSeats: '' }
  return {
    rate: String(rule.rate),
    referralRate: rule.type === 'per_seat' && rule.referralRate !== null ? String(rule.referralRate) : '',
    minSeats: rule.minSeats !== null ? String(rule.minSeats) : '',
  }
}

/** ما يُرسَل مع العقد من الخانات: بنوع القاعدة السارية، ولا شيءَ إن لم يتغيّر رقم.
    والسعرُ الفارغُ أو غيرُ الموجب يعني «اترك القاعدةَ كما هي» لا «اجعلها صفرا». */
export function composerFeeInput(rule: FeeRuleLike | null, form: FeeForm): FeeInput | null {
  const type = feeTypeOf(rule)
  const rate = asNumber(form.rate)
  if (rate === null || !(rate > 0)) return null
  const referral = type === 'per_seat' ? asNumber(form.referralRate) : null
  const input: FeeInput = {
    type,
    rate,
    minSeats: form.minSeats.trim() === '' ? undefined : Number(form.minSeats),
    referralRate: referral !== null && referral > 0 ? referral : null,
  }
  return rule && sameFeeAsRule(rule, input) ? null : input
}

/* ═══ وعقدٌ خرج ولم ينفذ — نصُّه مجمَّدٌ بأجره (٢٦ أكتوبر ٢٠٢٦) ═══

   خطوةُ الأجر في «الاتفاقية» تكتب القاعدةَ وحدَها، ونصُّ عقدٍ خرج لا يتغيّر بها: يوقّع المدرّبُ على ما فيه ويُحسب له
   ما في القاعدة. وتركيبُ العقد وإعادتُه يكتبان الاثنين معا (`setRule` في المعاملة نفسِها). وكانت الخطوةُ للماليّة
   وحدَها، فصارت للمدير الأكاديميّ معها (قرارُ «C») — وهو من يركّب العقد. فما دام له عقدٌ خرج ولم ينفذ يُقال ذلك قبل
   الحفظ، والخياران: هنا وحدَه، أو مع العقد في «العقود».

   والنافذُ ليس منه: أجرُ النشط يُغيَّر بالقاعدة، والعقدُ لا يُعاد بأجرٍ جديدٍ له (`fee_active_trainer`). */
const OUT_PHRASE_AR: Record<string, string> = {
  draft: 'جاهز ولم يرسل',
  sent: 'أرسل ولم يوقعه',
  signed: 'وقعه وينتظر اعتمادك',
  [CONTRACT_AMENDMENT_REQUESTED]: 'طلب تعديله',
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
export function outContractOf<T extends OutContractLike>(contracts: readonly T[]): { contract: T; phraseAr: string; feeAr: string } | null {
  const time = (c: T) => (c.createdAt ? new Date(c.createdAt).getTime() : 0)
  const contract = contracts.filter((c) => Object.hasOwn(OUT_PHRASE_AR, c.status)).sort((a, b) => time(b) - time(a))[0]
  if (!contract) return null
  const type = contract.compensationType
  const feeAr = type
    ? `بأجر ${RULE_TYPE_AR[type] ?? type} ${String(contract.compensationRate ?? 0)} ${type === 'revenue_share' ? '%' : contract.currency ?? ''}`.trim()
    : 'بلا أجر'
  return { contract, phraseAr: OUT_PHRASE_AR[contract.status], feeAr }
}
