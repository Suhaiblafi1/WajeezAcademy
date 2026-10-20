/* صفحةُ «منحة أعضاء وجيز» — ما تشترك فيه الصفحةُ والخادم (٢٠ أكتوبر ٢٠٢٦).

   قراراتُ صاحب المنصّة: النموذجُ يعطي الكودَ فورا ويعرض المسارات في الصفحة نفسِها («A»)، والمنحةُ
   مفتوحةٌ لكلّ من يعبّئه حتّى تنتهي، والحسابُ يُنشأ حين يختار المسار. والعلّةُ في
   `server/services/grant-landing.service.ts`.

   وهنا ما يُعرض ويُحفظ معا: نصُّ الموافقة، وقائمةُ مجالات العمل والمستويات، وقراءةُ القناة والدفعة من
   الرابط — فلا تقبل الشاشةُ ما يردّه الخادم. والملفُّ يقرؤه الخادمُ أيضا، فلا يستورد بـ`@/`.

   ═══ ونبذةٌ وأسئلةٌ أحترف (٢٠ أكتوبر ٢٠٢٦) ═══

   رأى صاحبُ المنصّة النموذجَ فقال: «غير احترافيّة.. يجب أن نعطيه نبذةً عن الأكاديمية وقوّتها وماذا سيحصل
   … والأسئلةُ تكون أكثرَ احترافيّة». وخُيّر بين أربعة أسئلةٍ بصياغةٍ أوضح وستّةٍ وسبعة، فاختار **الستّة
   والجديدُ منها اختياريّ**: المستوى الوظيفيّ، وما يريد تطويرَه. والثاني يُختار من مجالات الدورات المفتوحة
   نفسِها لا من قائمةٍ تُكتب — فبه تُرتَّب له الدوراتُ والاقتراحات (`rankByInterest`)، ويقرؤه المستشار. */

import { COURSE_DOMAIN_FAMILIES, courseDomainByFamily } from '../catalog/course-domain'

/** ما يوافق عليه بالإرسال — يُعرض تحت الزرّ ويُحفظ مع العميل المحتمل */
export const GRANT_CONSENT_AR =
  'بالإرسال توافق أن نحفظ بياناتك لنعطيك كود المنحة، وأن نتواصل معك بخصوصها بالبريد أو الواتساب. ومن لا يشتري تحذف بياناته بعد ستة أشهر بلا نشاط.'

/** مجالاتُ العمل في النموذج — ومنها يُختار، فلا يكتب كلٌّ مجالَه بلفظه فلا يُعدّ */
export const WORK_FIELDS: readonly string[] = [
  'الإدارة والقيادة', 'الموارد البشرية', 'المالية والمحاسبة', 'التسويق والمبيعات', 'خدمة العملاء',
  'تقنية المعلومات', 'التعليم والتدريب', 'الهندسة', 'الصحة', 'طالب جامعي', 'أبحث عن عمل', 'أخرى',
]

/** وسمُ القناة أو الدفعة كما يأتي في الرابط — حروفٌ لاتينيّةٌ وأرقامٌ قصيرة، وما سواه يُترك */
const TAG_RE = /^[a-z0-9_-]{1,30}$/i

export function campaignTag(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? ''
  return TAG_RE.test(v) ? v : null
}

/** القناةُ والدفعةُ من رابط الحملة — `?ch=whatsapp&w=1` */
export function campaignParams(search: string): { channel: string | null; wave: string | null } {
  const q = new URLSearchParams(search)
  return { channel: campaignTag(q.get('ch')), wave: campaignTag(q.get('w')) }
}

/** ما توفّره المنحةُ على مسار — يُقال للزائر بالمال لا بالنسبة: «تدفع كذا، ووجيز تتحمّل كذا» */
export const grantSavingAr = (pay: string, covers: string) => `تدفع ${pay} فقط، ووجيز تتحمل ${covers}`

/** رسالةُ متابعة من عبّأ النموذج ولم يشترِ — تُفتح في واتساب جاهزةً ويرسلها فريقُ الأكاديميّة */
export const grantFollowupAr = (name: string) =>
  `مرحبا ${name}، معك أكاديمية وجيز. أخذت كود منحة أعضاء وجيز، هل تحتاج مساعدة في اختيار دوراتك؟`

/** المستوى الوظيفيّ — سؤالٌ اختياريّ */
export const CAREER_LEVELS: readonly string[] = [
  'طالب أو حديث تخرج', 'موظف في بداية مسيرتي', 'موظف بخبرة', 'مشرف أو قائد فريق', 'مدير', 'صاحب عمل',
]

/** كم مجالا يختار فيما يريد تطويرَه — ثلاثةٌ تكفي لترتيبٍ له معنى، وأكثرُ منها «كلُّ شيء» */
export const GRANT_MAX_INTERESTS = 3

/** المجالاتُ المسمّاةُ كلُّها — ما يُقبل في «ما الذي تريد تطويره» */
export const GRANT_INTEREST_DOMAINS: ReadonlySet<string> = new Set(COURSE_DOMAIN_FAMILIES.map(courseDomainByFamily))

/** ما يحصل عليه مع كلّ دورة — من «من نحن» (`data/about.ts`) بأقصر عبارة، وكلُّه قائمٌ في المنصّة لا وعدٌ يُختلق.
    والمستشارُ «عند حاجتك» لا «يرافقك»: في المنحة يأتي من يطلبه. */
export const GRANT_GAINS_AR: readonly { id: 'live' | 'sources' | 'experts' | 'certificate' | 'advisor'; title: string; body: string }[] = [
  { id: 'live', title: 'تدريب عملي مباشر', body: 'ورش مباشرة مع مدربك وزملائك، تمارس فيها ما تتعلمه.' },
  { id: 'sources', title: 'مصادر لكل دورة', body: 'دروس مسجلة وكتب ومقالات يختارها مدربك، تتعلم منها في وقتك.' },
  { id: 'experts', title: 'تطبيق يقيمه خبراء', body: 'تطبيق عملي تسلمه، يقيمه خبراء من كبرى الشركات بمعايير تعرفها مسبقا.' },
  { id: 'certificate', title: 'شهادة إتمام موثقة', body: 'لكل دورة تكملها شهادة برقم يتحقق منه أي أحد.' },
  { id: 'advisor', title: 'مستشار عند حاجتك', body: 'يساعدك تختار دوراتك ويجيب عن أسئلتك.' },
]

/** كيف تعمل المنحة — ثلاثُ خطواتٍ بأرقامها من الخادم */
export const grantStepsAr = (percentOff: number, maxCourses: number): readonly { title: string; body: string }[] => [
  { title: 'عبئ النموذج', body: 'وتأخذ كود منحتك فورا، على الشاشة وفي بريدك.' },
  { title: 'اختر دوراتك', body: `دورة واحدة أو أكثر، حتى ${maxCourses} دورات من الدورات المفتوحة الآن.` },
  { title: `ادفع ${100 - percentOff}% فقط`, body: 'ووجيز تتحمل الباقي، وتبدأ مع شعبتك في موعدها.' },
]

/** ما يريد تطويرَه أوّلا — ترتيبٌ ثابت: ما في اهتمامه قبل غيره، وكلٌّ على ترتيبه. ومعه الاقتراحاتُ بعدد
    ما فيها من اهتمامه */
export function rankByInterest<T>(items: readonly T[], hits: (x: T) => number): T[] {
  return items.map((x, i) => ({ x, i, h: hits(x) })).sort((a, b) => b.h - a.h || a.i - b.i).map((r) => r.x)
}

/** ما يُكتب للمستشار عن صاحب النموذج — مجالُه ومستواه وما يريد، بما أجاب منها */
export function leadProfileAr(l: { workField: string | null; careerLevel: string | null; interests: readonly string[] }): string {
  return [
    l.workField && `مجاله: ${l.workField}`,
    l.careerLevel && `مستواه: ${l.careerLevel}`,
    l.interests.length > 0 && `يريد: ${l.interests.join('، ')}`,
  ].filter(Boolean).join(' · ')
}

/** يختار دورةً أو يتركها — ولا يتجاوز حدَّ المنحة: الزائدةُ تُردّ بلا أن تمحو ما اختاره */
export function toggleCourse(picked: readonly string[], id: string, max: number): string[] {
  if (picked.includes(id)) return picked.filter((x) => x !== id)
  return picked.length < max ? [...picked, id] : [...picked]
}
