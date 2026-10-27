/* طلبُ الانضمام مستشارا — ما يُسأل عنه، وما يُحسب منه (٢٧ أكتوبر ٢٠٢٦، خطة لوحة الإدارة — المرحلة السابعة).

   ═══ قراراتُ صاحب المنصّة ═══

   · **لا اتّفاقيّةَ للمستشار** («b»): يُقبَل الطلبُ بنسبة عمولةٍ فيُفعَّل في خطوةٍ واحدة — يُنشأ حسابُه بدوره
     ويصله رابطُ تفعيله. والشروطُ يقبلها في النموذج نفسِه (`ADVISOR_TERMS_AR`)، وكلُّ تغييرٍ في نسبته يُكتب من
     غيّره ومتى (`advisor.commission.set`).
   · **والنموذجُ** («A» مع الوصول الرقميّ): بياناتُه وعملُه وخبرتُه وساعاتُه، ومن يصل إليهم، وحساباتُه على وسائل
     التواصل بمتابعيها، والمجموعاتُ التي يديرها بأعضائها، وهل روّج لشيءٍ من قبل، ولماذا وجيز.
   · **ونسبتُه الافتراضيّة ٥٪** («5%»): تُقترح في شاشة القبول، وتُعدَّل لكلّ مستشارٍ قبل قبوله.

   والقيمُ هنا تُكتب في القاعدة كما هي (`freelance` و`6+`)، والأسماءُ للشاشة والبريد. والخادمُ يتحقّق بالقيم نفسِها
   (`server/http/routes/advisor-applications.routes.ts`) — فلا تفترق قائمتان. */

export interface Choice<V extends string = string> {
  value: V
  label: string
}

const choices = <const T extends readonly Choice[]>(xs: T) => xs

export const ADVISOR_EMPLOYMENT = choices([
  { value: 'employed', label: 'موظف' },
  { value: 'freelance', label: 'عمل حر' },
  { value: 'student', label: 'طالب' },
  { value: 'other', label: 'غير ذلك' },
] as const)

export const ADVISOR_EXPERIENCE = choices([
  { value: 'none', label: 'لا خبرة بعد' },
  { value: '1-2', label: '١–٢ سنة' },
  { value: '3-5', label: '٣–٥ سنوات' },
  { value: '6+', label: 'أكثر من ٥ سنوات' },
] as const)

export const ADVISOR_HOURS = choices([
  { value: 'lt5', label: 'أقل من ٥ ساعات' },
  { value: '5-10', label: '٥–١٠ ساعات' },
  { value: '10-20', label: '١٠–٢٠ ساعة' },
  { value: '20+', label: 'أكثر من ٢٠ ساعة' },
] as const)

export const ADVISOR_AUDIENCES = choices([
  { value: 'university_students', label: 'طلاب جامعات' },
  { value: 'employees', label: 'موظفون' },
  { value: 'business_owners', label: 'أصحاب أعمال' },
  { value: 'social_audience', label: 'جمهور على وسائل التواصل' },
  { value: 'other', label: 'غير ذلك' },
] as const)

/** المنصّاتُ التي يُكتب فيها حسابٌ بمتابعيه */
export const ADVISOR_PLATFORMS = choices([
  { value: 'instagram', label: 'إنستغرام' },
  { value: 'tiktok', label: 'تيك توك' },
  { value: 'x', label: 'إكس' },
  { value: 'youtube', label: 'يوتيوب' },
  { value: 'linkedin', label: 'لينكدإن' },
  { value: 'facebook', label: 'فيسبوك' },
  { value: 'snapchat', label: 'سناب شات' },
  { value: 'telegram', label: 'تيليغرام' },
] as const)

/** والمجموعاتُ التي يديرها بأعضائها */
export const ADVISOR_COMMUNITY_KINDS = choices([
  { value: 'whatsapp', label: 'واتساب' },
  { value: 'telegram', label: 'تيليغرام' },
  { value: 'discord', label: 'ديسكورد' },
  { value: 'facebook_group', label: 'مجموعة فيسبوك' },
  { value: 'other', label: 'غير ذلك' },
] as const)

export type AdvisorEmployment = (typeof ADVISOR_EMPLOYMENT)[number]['value']
export type AdvisorExperience = (typeof ADVISOR_EXPERIENCE)[number]['value']
export type AdvisorHours = (typeof ADVISOR_HOURS)[number]['value']
export type AdvisorAudience = (typeof ADVISOR_AUDIENCES)[number]['value']
export type AdvisorPlatform = (typeof ADVISOR_PLATFORMS)[number]['value']
export type AdvisorCommunityKind = (typeof ADVISOR_COMMUNITY_KINDS)[number]['value']

/** قيمُ قائمةٍ — يتحقّق بها الخادمُ والنموذجُ معا */
export const valuesOf = <V extends string>(xs: readonly Choice<V>[]): [V, ...V[]] => xs.map((x) => x.value) as [V, ...V[]]

/** اسمُ القيمة — أو القيمةُ نفسُها إن لم تكن في القائمة (طلبٌ قديمٌ بقيمةٍ أُخرجت) */
export const labelOf = (xs: readonly Choice[], value: string): string => xs.find((x) => x.value === value)?.label ?? value

export interface AdvisorAccount {
  platform: AdvisorPlatform
  url: string
  followers: number
}

export interface AdvisorCommunity {
  kind: AdvisorCommunityKind
  name: string
  members: number
}

/** أقصى ما يُكتب من حساباتٍ ومن مجموعات — ما زاد لا يُقرأ */
export const MAX_ADVISOR_ACCOUNTS = 10
export const MAX_ADVISOR_COMMUNITIES = 10

/** نسبةُ العمولة التي تُقترح عند القبول — قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦) */
export const ADVISOR_DEFAULT_COMMISSION_PCT = 5

/** «٥٪» — النسبةُ بأرقامٍ عربيّةٍ كما في النصّ حولها */
export const pctAr = (n: number): string => `${n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}٪`

/** الشروطُ التي يقبلها في النموذج — تُعرض فيه، وتُعاد إليه في بريد استلام طلبه */
export const ADVISOR_TERMS_AR = [
  'العمولة نسبة مما يدفعه المتعلمون الذين يسجلون عن طريقك، وتصرف شهريا عما دفع فعلا.',
  'ما يسترد من دفعة يخصم من عمولتها.',
  'بيانات المتعلمين سرية، لا تشاركها ولا تستعملها لغير عملك معنا.',
  'نسبتك نحددها عند قبول طلبك، ونخبرك إن تغيرت.',
] as const

/** وصولُه كلُّه: متابعو حساباته وأعضاءُ مجموعاته — به يُرتَّب الطابور */
export function reachTotal(accounts: readonly { followers: number }[], communities: readonly { members: number }[]): number {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? Math.floor(b) : 0), 0)
  return sum(accounts.map((a) => a.followers)) + sum(communities.map((c) => c.members))
}

/** أكبرُ حساباته — يُقال بجانب المجموع في الطابور */
export function biggestAccount(accounts: readonly AdvisorAccount[]): AdvisorAccount | null {
  return accounts.reduce<AdvisorAccount | null>((best, a) => (!best || a.followers > best.followers ? a : best), null)
}

/** «٤٣٬٠٠٠ متابع وعضو · أكبرها إنستغرام ٣٠٬٠٠٠» — أو «لم يكتب حسابا ولا مجموعة» */
export function reachLineAr(accounts: readonly AdvisorAccount[], communities: readonly AdvisorCommunity[]): string {
  const total = reachTotal(accounts, communities)
  if (accounts.length === 0 && communities.length === 0) return 'لم يكتب حسابا ولا مجموعة'
  const fmt = (n: number) => n.toLocaleString('ar-EG')
  const top = biggestAccount(accounts)
  const head = `${fmt(total)} متابع وعضو`
  return top && top.followers > 0 ? `${head} · أكبرها ${labelOf(ADVISOR_PLATFORMS, top.platform)} ${fmt(top.followers)}` : head
}
