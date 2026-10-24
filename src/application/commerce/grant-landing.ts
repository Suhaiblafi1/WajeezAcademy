/* صفحةُ «منحة أعضاء وجيز» — ما تشترك فيه الصفحةُ والخادم (٢٠ أكتوبر ٢٠٢٦).

   قراراتُ صاحب المنصّة: النموذجُ يعطي الكودَ فورا ويعرض الدورات في الصفحة نفسِها («A»)، والمنحةُ
   مفتوحةٌ لكلّ من يعبّئه حتّى تنتهي، والحسابُ يُنشأ حين يدفع. والعلّةُ في
   `server/services/grant-landing.service.ts`.

   وهنا ما يُعرض ويُحفظ معا: نصُّ الموافقة، وقائمةُ مجالات العمل والمستويات، وقراءةُ القناة والدفعة من
   الرابط — فلا تقبل الشاشةُ ما يردّه الخادم. والملفُّ يقرؤه الخادمُ أيضا، فلا يستورد بـ`@/`.

   ═══ ونبذةٌ وأسئلةٌ أحترف (٢٠ أكتوبر ٢٠٢٦) ═══

   رأى صاحبُ المنصّة النموذجَ فقال: «غير احترافيّة.. يجب أن نعطيه نبذةً عن الأكاديمية وقوّتها وماذا سيحصل
   … والأسئلةُ تكون أكثرَ احترافيّة». وخُيّر بين أربعة أسئلةٍ بصياغةٍ أوضح وستّةٍ وسبعة، فاختار **الستّة
   والجديدُ منها اختياريّ**: المستوى الوظيفيّ، وما يريد تطويرَه. والثاني يُختار من مجالات الدورات المفتوحة
   نفسِها لا من قائمةٍ تُكتب — فبه تُرتَّب له الدورات (`rankByInterest`)، ويقرؤه المستشار. */

import { COURSE_DOMAIN_FAMILIES, courseDomainByFamily } from '../catalog/course-domain'
import { zonedClock, zonedDay, zonedInstant } from '../trainer/cohort-period'

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

/* ═══ سطرُ السعر فوق زرّ الدفع (٢٤ أكتوبر ٢٠٢٦) ═══

   كان «تدفع كذا فقط، ووجيز تتحمّل كذا»، فقال صاحبُ المنصّة: «غيرُ تسويقيّ». وخُيّر بين أربعة، فاختار أن يبدأ بما
   يكسبه — «لكن بدلَ "وفّرت": "قيمة المنحة"». فالكبيرُ «قيمة المنحة $321.00»، وتحته صغيرا «4 دورات بـ$214.00 بدل
   $535.00». والمبالغُ تُعزَل في الصفحة (`bdi`) فلا ينقلب «$321.00» إلى «321.00$» آخرَ السطر. */

/** عنوانُ السطر الكبير — يتبعه المبلغ */
export const GRANT_VALUE_AR = 'قيمة المنحة'

/** «دورة واحدة» و«دورتان» و«4 دورات» و«11 دورة» — العددُ مع معدوده */
export function grantCountAr(n: number): string {
  if (n === 1) return 'دورة واحدة'
  if (n === 2) return 'دورتان'
  return n >= 3 && n <= 10 ? `${n} دورات` : `${n} دورة`
}

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

/** ما يحصل عليه — ثلاثٌ بكلمتين، فوق النموذج. وكلُّه قائمٌ في المنصّة لا وعدٌ يُختلق.

    وأوّلُها أنّها **مباشرةٌ على Zoom** — قرارُ صاحب المنصّة (٢٠ أكتوبر ٢٠٢٦): «يجب أن يقال له إنّها دوراتٌ
    مباشرةٌ عبر زوم». والتسجيلُ قائم: يصل من Zoom وحدَه بعد اللقاء فيظهر تحته لمتعلّميه (`zoom-recording.ts`)،
    والشهادةُ برقمٍ يُتحقَّق منه (`/verify`). وكانت ستّا بشرحٍ تحت كلٍّ، فقال (٢١ أكتوبر ٢٠٢٦): «مكتظّةٌ كثيرا..
    اجعلها أنعمَ وأقلَّ محتوى» — فبقي أشدُّها جذبا بلا شرح.
    ومع الشهادة خطابُ توصيةٍ لمن التزم (٢٢ أكتوبر ٢٠٢٦، `endorsement.ts`) — في بندها لا بندا رابعا، فتبقى ثلاثا. */
export const GRANT_GAINS_AR: readonly { id: 'live' | 'recording' | 'certificate'; title: string }[] = [
  { id: 'live', title: 'لقاءات مباشرة على Zoom' },
  { id: 'recording', title: 'تسجيل كل لقاء' },
  { id: 'certificate', title: 'شهادة وخطاب توصية لمن يلتزم' },
]

/** سطرٌ واحدٌ عن الأكاديمية تحت النموذج — بدل نبذة «من نحن» كاملة، وادّعاؤه منها (`data/about.ts`) */
export const GRANT_ACADEMY_LINE_AR = 'أكاديمية وجيز من وجيز، التي يعرفها الملايين بتطبيق ملخصات الكتب المسموعة.'

/* ═══ أربعُ دوراتٍ مختارةٌ له سلفا (٢١ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «لنعد لفكرة اقتراح ٤ دوراتٍ له، ويمكنه أن يحذف ويستبدل كيفما شاء، وبعدها يدفع، ويضيف
   للحدّ ٥ فقط». وخُيّر كيف تُختار، فاختار **حسب مجاله واهتمامه**: ما اختاره في «ما الذي تريد تطويره» أوّلا، ثمّ
   مجالاتُ مجال عمله، ثمّ الأقربُ موعدا يُكمل الأربع. فلكلٍّ اقتراحٌ يناسبه بلا أن يُعدّ صاحبُ المنصّة شيئا. */

/** كم دورةً تُختار له سلفا — ويضيف حتّى حدّ المنحة (`maxCourses`) */
export const GRANT_SUGGESTED_COURSES = 4

/** مجالاتُ الدورات الأقربُ لكلّ مجال عمل — بعائلات المعرّفات (`course-domain.ts`)، فلا يفترق اسمٌ عن اسم */
const WORK_FIELD_FAMILIES: Readonly<Record<string, readonly string[]>> = {
  'الإدارة والقيادة': ['MGR', 'PM', 'OPS', 'PRD'],
  'الموارد البشرية': ['HR', 'MGR', 'LND'],
  'المالية والمحاسبة': ['FINM', 'DAT', 'FIN'],
  'التسويق والمبيعات': ['MKT', 'SAL', 'SVC', 'BIZ'],
  'خدمة العملاء': ['SVC', 'COMX', 'SAL'],
  'تقنية المعلومات': ['AI', 'DAT', 'CYB', 'WEB', 'AUT'],
  'التعليم والتدريب': ['LND', 'EDU', 'COMX'],
  'الهندسة': ['ENGR', 'PM', 'INTR', 'OPS'],
  'الصحة': ['PSY', 'WEL', 'COMX'],
  'طالب جامعي': ['CAR', 'JOB', 'AI', 'COMX'],
  'أبحث عن عمل': ['JOB', 'CAR', 'COMX'],
  'أخرى': [],
}

/** مجالاتُ الدورات الأقربُ لمجال عمله — بأسمائها كما تُعرض */
export function workFieldDomains(workField: string): string[] {
  return (WORK_FIELD_FAMILIES[workField] ?? []).map(courseDomainByFamily).filter(Boolean)
}

/** ملاءمةُ دورةٍ له: ٢ لما يريد تطويرَه، و١ لمجال عمله، و٠ لغيرهما */
function courseFit(interests: readonly string[], workField: string): (domainAr: string | null | undefined) => number {
  const want = new Set(interests)
  const near = new Set(workFieldDomains(workField))
  return (d) => (d && want.has(d) ? 2 : d && near.has(d) ? 1 : 0)
}

/** الدوراتُ المختارةُ له سلفا — ما يريد تطويرَه، ثمّ مجالُ عمله، ثمّ الأقربُ موعدا، حتّى `n` */
export function suggestCourses(
  courses: readonly { courseId: string; domainAr?: string | null; startsAt: string | Date | null }[],
  interests: readonly string[],
  workField: string,
  n: number,
): string[] {
  const score = courseFit(interests, workField)
  const at = (x: string | Date | null) => (x ? new Date(x).getTime() : Number.POSITIVE_INFINITY)
  return courses
    .map((c, i) => ({ id: c.courseId, s: score(c.domainAr), t: at(c.startsAt), i }))
    .sort((a, b) => b.s - a.s || a.t - b.t || a.i - b.i)
    .slice(0, Math.max(0, n))
    .map((x) => x.id)
}

/* ═══ ومسارٌ رئيسيٌّ وبديلٌ من المسارات العامّة (٢١ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة لمّا بُنيت المساراتُ العامّةُ الثمانية (`data/catalog/public-pathways.json`، أربعُ دوراتٍ
   لكلٍّ): «هل نقترح على كلٍّ مسارا رئيسيّا وآخر، أم نعطيه أن يبني مسارَه؟». فاختار **مسارا رئيسيّا وبديلا**:
   تُختار دوراتُ الرئيسيّ له سلفا، والبديلُ بضغطة، ويحذف ويضيف حتّى الحدّ.

   · **لا يُقترح مسارٌ إلّا وكلُّ دوراته في المنحة** — لها شعبةٌ تُشترى في الفصل القادم القريب. وإلّا لاقترحنا
     مسارا يدفع نصفَه ويُترك نصفُه بلا شعبة.
   · **والرئيسيُّ أكثرُها ملاءمةً له** بمجموع ملاءمة دوراته (`courseFit`)، والتعادلُ بترتيب مختارات صاحب المنصّة
     (يمرّره المنادي). **ولا رئيسيَّ بملاءمةٍ صفر**: مسارٌ لا يمسّ مجالَه ولا اهتمامَه أبعدُ عنه من أربع دوراتٍ
     تمسّهما (`suggestCourses`) — فيُعرض حينها بديلا لا رئيسيّا.
   · **والبديلُ** التالي في الترتيب، أو أوّلُ المسارات إن لم يكن رئيسيّ. */

export interface GrantPathOption {
  id: string
  title: string
  courseIds: readonly string[]
}

export function suggestPaths(
  paths: readonly GrantPathOption[],
  courses: readonly { courseId: string; domainAr?: string | null }[],
  interests: readonly string[],
  workField: string,
): { main: GrantPathOption | null; alt: GrantPathOption | null } {
  const score = courseFit(interests, workField)
  const domainOf = new Map(courses.map((c) => [c.courseId, c.domainAr ?? null]))
  const ranked = paths
    .filter((p) => p.courseIds.length > 0 && p.courseIds.every((id) => domainOf.has(id)))
    .map((p, i) => ({ p, i, s: p.courseIds.reduce((n, id) => n + score(domainOf.get(id)), 0) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
  const main = ranked[0] && ranked[0].s > 0 ? ranked[0].p : null
  return { main, alt: (main ? ranked[1] : ranked[0])?.p ?? null }
}

/* ═══ وأفكارُ «الاستحواذ على العميل» (٢١ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «أيّ أفكارٍ أخرى تساعدنا بالاستحواذ على العميل؟»، واختار أربعا. ثلاثٌ منها هنا،
   والرابعةُ — تذكيرٌ قبل انتهاء المنحة — في العامل (`sendGrantReminders`) ونصُّ عنوانه هنا (`grantDaysLeftAr`):
   · **«بقي X مقاعد»** — على الشعبة حين تقلّ مقاعدُها عن ستّ، من عددها الحقيقيّ. لا رقمٌ كبيرٌ يقلّل القيمة — وهو
     ما رُدّ في عدد المنح («لا تذكر عدد المنح لأنّ العددَ الكبير قد يقلّل من قيمتها»).
   · **«أهد منحة لصديق»** — رسالةٌ جاهزةٌ في واتساب برابط المنحة ووسم قناته (`?ch=share`)، فيُعرف في
     النتائج من جاء بها. والمنحةُ مفتوحةٌ لكلّ من يعبّئ النموذج، فالصديقُ يأخذ منحتَه لا كودَ صاحبه.
   · **المدرّبُ على كلّ دورة** — يأتي من الخادم ببوّابة النشر (`grant-courses.service.ts`). */

/** من كم مقعدا فأقلّ يُقال «بقي X مقاعد» */
export const GRANT_LOW_SEATS = 5

/** «بقي 3 مقاعد» — والمثنّى والمفرد بلا رقم. وما فوق الحدّ لا يُقال */
export function seatsLeftAr(n: number | null | undefined): string | null {
  if (n == null || n <= 0 || n > GRANT_LOW_SEATS) return null
  return n === 1 ? 'بقي مقعد واحد' : n === 2 ? 'بقي مقعدان' : `بقي ${n} مقاعد`
}

/** رسالةُ «أهد منحة لصديق» — برابط المنحة ووسم قناتها */
export function grantShareAr(siteUrl: string, percentOff: number, lastDay: string | null): string {
  return `حصلت على منحة أعضاء وجيز: دورات مباشرة على Zoom بخصم ${percentOff}%. احجز منحتك${lastDay ? ` قبل ${lastDay}` : ''}: ${siteUrl}/grant?ch=share`
}

/** ما يريد تطويرَه أوّلا — ترتيبٌ ثابت: ما في اهتمامه قبل غيره، وكلٌّ على ترتيبه */
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

/** عنوانُ تذكير ما قبل انتهاء المنحة — من أيّامها الباقية بتقويم عمّان، واليومُ نفسُه منها
    (`sendGrantReminders` في `grant-followup.service.ts`) */
export function grantDaysLeftAr(days: number): string {
  if (days <= 1) return 'اليوم آخر يوم لمنحتك'
  return days === 2 ? 'بقي يومان على منحتك' : `بقي ${days} أيام على منحتك`
}

/* ═══ مكالمةُ المستشار خلال ساعتين (٢٢ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «لماذا سيشتري الطالب؟ الخصمُ وحدَه لا يكفي»، واختار من الأفكار «مكالمةَ مستشارٍ خلال
   ساعتين» بدلَ حالةٍ تُفتح بعد يومين. فمن لم يشترِ بعد ساعةٍ من النموذج تُفتح له حالةٌ عند مستشار، وفيها متابعةٌ
   هاتفيّةٌ موعدُها ساعتان بعد النموذج — والساعةُ الأولى له يشتري فيها وحدَه فلا يُتّصل بمن اشترى.
   وفي ساعات العمل بتوقيت عمّان: ما وقع قبل التاسعة صباحا أو بعد التاسعة مساء فالعاشرةُ من صباحه التالي. */

/** بعد كم ساعةٍ من النموذج تكون المكالمة */
export const GRANT_CALL_HOURS = 2
/** ساعاتُ الاتّصال بتوقيت عمّان — من التاسعة صباحا إلى التاسعة مساء */
export const GRANT_CALL_WINDOW: readonly [number, number] = [9, 21]

/** موعدُ مكالمة المستشار — ساعتان بعد النموذج في ساعات العمل، ولا موعدَ في الماضي: من فات موعدُه فالآن */
export function grantCallDueAt(formAt: Date, now: Date): Date {
  const due = new Date(Math.max(formAt.getTime() + GRANT_CALL_HOURS * 3_600_000, now.getTime()))
  const hour = Number(zonedClock(due).slice(0, 2))
  if (hour >= GRANT_CALL_WINDOW[0] && hour < GRANT_CALL_WINDOW[1]) return due
  const day = zonedDay(due)
  const [y, m, d] = day.split('-').map(Number)
  const morning = hour < GRANT_CALL_WINDOW[0] ? day : new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
  return zonedInstant(morning, [GRANT_CALL_WINDOW[0] + 1, 0, 0, 0])
}

/* ═══ الدوراتُ: ما اخترناه له فوق، والباقي أقسامٌ مطويّةٌ بمجالها (٢٤ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «الدوراتُ كثيرةٌ وتحيّر الشخص». وخُيّر بين أربعة (مختاراتُه وأقسامٌ مطويّة، أو بطاقاتُ المسارات
   أوّلا، أو تصفيةٌ بالمجال، أو ثمانٍ وزرُّ «المزيد») — فاختار **مختاراتِه فوق، والباقي أقسامًا مطويّةً بمجالها**: يرى
   أربعَ بطاقاتٍ وستّةَ أسطرٍ بدلَ خمسٍ وعشرين بطاقة، ويبقى الاختيارُ له. */

/** الدوراتُ الباقيةُ أقساما بمجالها — ما يريد تطويرَه أوّلا، ثمّ الأكثرُ دورات، و«أخرى» آخرا */
export function grantSections<T extends { domainAr?: string | null }>(
  courses: readonly T[], interests: readonly string[], other: string,
): { domain: string; items: T[] }[] {
  const by = new Map<string, T[]>()
  for (const c of courses) {
    const d = c.domainAr || other
    by.set(d, [...(by.get(d) ?? []), c])
  }
  const rank = (d: string) => (d === other ? 2 : interests.includes(d) ? 0 : 1)
  return [...by.entries()]
    .map(([domain, items]) => ({ domain, items }))
    .sort((a, b) => rank(a.domain) - rank(b.domain) || b.items.length - a.items.length || a.domain.localeCompare(b.domain, 'ar'))
}

/* ═══ عدّادُ انتهاء المنحة (٢٤ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «ضع عدّادا لانتهاء المنحة وآخرَ موعدٍ لاستغلالها». فالعدّادُ أيّامٌ وساعاتٌ ودقائقُ وثوانٍ حتّى
   نهايتها المحفوظة (`closesAt`)، وتحته آخرُ يومٍ بتاريخه. وكلُّ رقمٍ في خانته وتحته اسمُه — فلا يُعالَج تمييزُ العدد. */

/** ما بقي حتّى نهاية المنحة — أو `null` إن انتهت أو بلا نهاية */
export function grantCountdown(closesAt: string | Date | null, now: Date): { days: number; hours: number; minutes: number; seconds: number } | null {
  if (!closesAt) return null
  const left = Math.floor((new Date(closesAt).getTime() - now.getTime()) / 1000)
  if (left <= 0) return null
  return { days: Math.floor(left / 86_400), hours: Math.floor((left % 86_400) / 3600), minutes: Math.floor((left % 3600) / 60), seconds: left % 60 }
}
