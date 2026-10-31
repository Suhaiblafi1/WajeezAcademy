/* «انضم كمؤثر» — ما تقوله صفحةُ الاتّفاق، وما يُسأل عنه في طلبه (٣١ أكتوبر ٢٠٢٦).

   ═══ طلبُ صاحب المنصّة ═══

   «جهّز رابطا لاتّفاقيّة المؤثّر بكلّ التفاصيل: كيف يفعّل منصّته، وماذا يجد فيها، والاتّفاقُ الماليّ. والاتّفاقُ
   لكلّ فصل، وضع الشروط. باختصارٍ ووضوحٍ شديد. ومنها يتقدّم، فيظهر في قائمة المتقدّمين باسمه وبريده وحسابٍ
   ينتظر تفعيلي».

   ═══ والأرقامُ تُقرأ حيّةً لا تُكتب ═══

   نسبةُ الخصم وعددُ الدورات من إعدادات «منحة مؤثرين وجيز» (`GrantService(…, INFLUENCER_GRANT_SLUG).settings()`)،
   والعمولةُ من `INFLUENCER_COMMISSION_DEFAULT`. فصاحبُ المنصّة يغيّر النسبةَ في شاشته فتتغيّر الصفحةُ معها —
   ولا يقرأ متقدّمٌ ٤٥٪ في صفحةٍ وقد صارت ٤٠٪. والشروطُ نفسُها تُحفظ في طلبه يومَ قبلها (`termsAr`)، بأرقامها ذلك اليوم.

   والحساباتُ بشكل حسابات المستشار (`[{ platform, url, followers }]`) ومجموعُها يرتّب الطابور (`reachTotal`). */

import { ADVISOR_PLATFORMS, reachTotal, type AdvisorAccount } from '../advisor/application'
import { normalizeInfluencerCode } from './influencer'

export type InfluencerAccount = AdvisorAccount

/** المنصّاتُ — قائمةُ المستشار نفسُها، فلا تفترق قائمتان */
export const INFLUENCER_PLATFORMS = ADVISOR_PLATFORMS

/** أقصى ما يُكتب من حسابات — ما زاد لا يُقرأ */
export const MAX_INFLUENCER_ACCOUNTS = 10

/** متابعو حساباته كلّها — به يُرتَّب الطابور */
export const influencerReach = (accounts: readonly { followers: number }[]): number => reachTotal(accounts, [])

/** أرقامُ الاتّفاق كما تُقرأ ساعتَها */
export interface InfluencerDealNumbers {
  /** أعلى نسبة خصمٍ لمتابعه */
  percentOff: number
  /** أقصى عدد دوراتٍ بالكود الواحد */
  maxCourses: number
  /** عمولتُه من سعر الدورات قبل الخصم */
  commissionPercent: number
}

/** «ما هي» — سطران */
export function influencerWhatAr(n: InfluencerDealNumbers): string[] {
  return [
    `متابعوك يأخذون خصما حتى ${n.percentOff}% على أسعار الدورات بكودك، حتى ${n.maxCourses} دورات.`,
    `ولك ${n.commissionPercent}% من سعر الدورات العام عن كل شراء بكودك.`,
  ]
}

/** مثالٌ بمئة — يُحسب من الأرقام نفسِها */
export function influencerExampleAr(n: InfluencerDealNumbers): string {
  const pays = Math.max(0, 100 - n.percentOff)
  return `مثال: دورة سعرها 100 دولار. يدفع متابعك ${pays}، ولك ${n.commissionPercent}.`
}

/** «كيف تفعل حسابك» — خطوةٌ في كلّ سطر */
export const INFLUENCER_ACTIVATION_STEPS_AR = [
  'قدم طلبك من هذه الصفحة.',
  'نراجع طلبك ونرد عليك بالبريد.',
  'إن قبلناك يصلك بريد فيه رابط التفعيل.',
  'تختار كلمة مرورك من الرابط.',
  'يفتح حسابك على صفحة المؤثر.',
] as const

/** «ما تجده في حسابك» */
export const INFLUENCER_PORTAL_AR = [
  'كودك ورابطك، جاهزين للنشر.',
  'تصاميم جاهزة ونص منشور لكل منصة، ومنها تصميم بصورتك.',
  'من سجل بكودك ومن اشترى.',
  'عمولتك عن كل شراء.',
  'ما دفعناه لك وما بقي.',
] as const

/** «الاتفاق المالي — لكل فصل»: شرطٌ في كلّ سطر. وهي ما يقبله بعلامته، وتُحفظ في طلبه بأرقام يومها */
export function influencerTermsAr(n: InfluencerDealNumbers): string[] {
  return [
    'الاتفاق لفصل واحد، ويتجدد مع كل فصل جديد.',
    `عمولتك ${n.commissionPercent}% من سعر الدورات قبل الخصم، على الطلبات المدفوعة فقط.`,
    'ما يرد من ثمن طلب ينقص من عمولته بنسبته.',
    'شراؤك أنت بكودك يأخذ الخصم، ولا عمولة عليه.',
    'نسجل كل دفعة نحولها لك، وتراها في حسابك.',
    'إن تغيرت نسبتك فالجديدة على الأكواد التي تعطى بعد التغيير فقط.',
    'لنا أن نوقف كودك، وتبقى لك عمولة ما أعطي قبل الإيقاف.',
  ]
}

/** بابُ أرقام الاتّفاق — تقرؤه الصفحةُ العامّة، ولا رقمَ يُكتب فيها */
export const INFLUENCER_DEAL_PATH = '/api/v1/influencer-applications/deal'

/** كودٌ يُقترح من بريده — حروفُه وأرقامُه قبل «@»، ويُعدَّل قبل القبول. وما لا يصلح كودا يُترك فارغا */
export function suggestInfluencerCode(email: string): string {
  return normalizeInfluencerCode((email.split('@')[0] ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20)) ?? ''
}

/** الطابورُ: الأوسعُ وصولا أوّلا، والأحدثُ بين المتساويَين */
export function byReach<T extends { reachTotal: number; createdAt: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.reachTotal - a.reachTotal || b.createdAt.localeCompare(a.createdAt))
}

/** ما يقرؤه النموذجُ من الخادم — والأرقامُ منه وحدَه */
export interface InfluencerDealView extends InfluencerDealNumbers {
  /** الحملةُ مفتوحةٌ الآن — وإن لم تكن فالطلبُ يُقبل ويبدأ كودُه حين تُفتح */
  open: boolean
}
