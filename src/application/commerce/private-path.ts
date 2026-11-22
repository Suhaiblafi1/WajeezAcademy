/* «مسارٌ خاصّ» باسم المتعلّم — `/go/<رمز>` (٥ نوفمبر ٢٠٢٦).

   ═══ طلبُ صاحب المنصّة ═══

   «نحتاج إلى صفحة "مسار خاص" باسم كل متعلم، بدل أن يبدأ رابط الحملة من صفحة دورة». فالصفحةُ «مسار {الاسم الأول}»:
   دوراتُه مرقّمةً بسبب كلٍّ منها ومدرّبها وأوّل لقائها، وسعرُها قبل المنحة وبعدها وآخرُ يومها، وزرٌّ واحد «أكمل التسجيل»
   إلى مسار الدفع القائم بالدورات والكود نفسيهما. ولا اقتراحَ لغيرها، ولا «ابنِ مسارك».

   ═══ ولا بنيةَ جديدة — قرارُه («عمود جديد في جدول الروابط القصيرة») ═══

   المسارُ رابطٌ قصيرٌ (`ShortLink`) غرضُه `private_path`، وتفاصيلُه في عمودٍ واحد (`payload`). فرمزُه العشوائيّ،
   وعدُّ فتحاته بلا زاحف (`ShortLinkOpen`)، وإبطالُه بلا محو — كلُّها ما كان للرابط القصير. ويولّده زرُّ «جهز رابط شراء»
   نفسُه بصلاحيّاته (`buy-link.service.ts`): السوبر أدمن لكلّ متعلّم، والمستشارُ لحالاته المسندة وحدَها.

   وهنا ما تقرؤه الشاشةُ والخادمُ معا: البادئةُ وطولُ الرمز وحدُّ السبب، وشكلُ ما يُحفظ، والاسمُ الأوّل. */

/** بادئةُ صفحة المسار الخاصّ */
export const GO_PREFIX = '/go/'
/** ثمانيةُ أحرفٍ من اثنين وثلاثين — نحوُ ألفِ مليار، فلا يُخمَّن رمزُ مسارٍ فيه اسمُ صاحبه */
export const GO_CODE_LENGTH = 8
/** غرضُ الرابط القصير حين يكون مسارا خاصّا */
export const PRIVATE_PATH_PURPOSE = 'private_path'
/** أطولُ سببٍ للدورة — سطرٌ أو سطران يُقرآن على الهاتف */
export const PATH_REASON_MAX = 160
/** شكلُ الرمز كما يُقبل في الرابط — يُردّ ما سواه قبل أن تُسأل القاعدة */
export const GO_CODE_RE = /^[A-Z0-9]{6,12}$/

export const goPath = (code: string): string => `${GO_PREFIX}${code}`

/** ما يُحفظ مع رابط المسار (`ShortLink.payload`) */
export interface PrivatePathPayload {
  v: 1
  /** أثرُ توليده (`buy_link.generate`) ورمزُه الموقَّع — به يُنسب الطلبُ إلى مولّده (`buyLinkForOrder`) */
  linkId: string
  token: string
  kind: 'admin' | 'advisor'
  /** لمن — والمفتاحُ يجمع نسخَ مسارٍ واحد: حسابُه، أو نموذجُه إن لم يكن له حساب */
  learnerKey: string
  firstName: string
  courses: { courseId: string; cohortId: string; reasonAr: string | null }[]
  /** دورةٌ هديّة — يختارها السوبر أدمن وحدَه، وتُضاف بصفرٍ إن تحقّق شرطُها (`private-path-gift.ts`) */
  gift?: PrivatePathGift
  code: string | null
  whatsapp: boolean
  /** نسخةٌ أحدثُ منه — فيُحوَّل إليها من فتحه */
  supersededBy?: string
}

/* ═══ «دورةٌ هديّة» في رابط المسار (٨ نوفمبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: في «جهز رابط شراء» خيارُ «أضف دورة هدية» — الدورةُ وشعبتُها وشرطُ تفعيلها (المسارُ كاملا، أو دورتان
   منه على الأقلّ). وفي ‎/go بطاقتُها بعد دورات المسار: «مجانية»، وسعرُها الأصليّ مشطوبٌ والحاليّ صفر، وسطرٌ بشرطها. وعند الدفع
   تُضاف بصفرٍ إن تحقّق الشرط، وإلّا لا تُضاف ويُقال كم دورةً تنقصه. وتعارضُ المواعيد يشملها.
   وقرارا صاحب المنصّة: **للسوبر أدمن وحدَه** («Super admin only»)، و**مقعدُها يُحتسب في أجر المدرّب** كأيّ مقعد
   («Pay trainer»). ولا تمسّ «الهديّةَ في الخطّة» التي أُلغيت (٢٦ أكتوبر ٢٠٢٦): تلك شارةٌ لكلّ زائرٍ على كلّ مسار، وهذه
   هديّةُ رابطٍ لمتعلّمٍ بعينه يفي بها الخادم. */

/** شرطُ تفعيل الهديّة: المسارُ كاملا، أو دورتان منه على الأقلّ */
export type GiftRule = 'all' | 'two'
export const GIFT_RULES: readonly GiftRule[] = ['all', 'two']

export interface PrivatePathGift {
  courseId: string
  /** الشعبةُ التي اختارها المولّد — وللمتعلّم أن يختار غيرَها من الدورة نفسِها (تعارضُ المواعيد) */
  cohortId: string
  rule: GiftRule
  /** كم دورةً مدفوعةً تلزم — يُحسب عند التوليد: عددُ دورات المسار، أو ٢ */
  minCourses: number
}

/** كم دورةً تلزم لشرطٍ في مسارٍ بعدد دوراته — أو `null` لشرطٍ لا يسعه المسار */
export function giftMinCourses(rule: GiftRule, pathCourses: number): number | null {
  if (rule === 'all') return pathCourses >= 1 ? pathCourses : null
  return pathCourses >= 2 ? 2 : null
}

/** سطرُ الشرط تحت بطاقة الهديّة — «مجانية إن اشتريت المسار كاملا (3 دورات)» */
export function giftRuleAr(gift: Pick<PrivatePathGift, 'rule' | 'minCourses'>): string {
  return gift.rule === 'all'
    ? `مجانية إن اشتريت المسار كاملا (${gift.minCourses === 2 ? 'دورتان' : gift.minCourses === 1 ? 'دورة واحدة' : `${gift.minCourses} دورات`})`
    : 'مجانية إن اشتريت دورتين من المسار على الأقل'
}

/** «ينقصك دورة واحدة لتحصل على الهدية» — وصفرٌ لا شيء */
export function giftMissingAr(missing: number): string | null {
  if (missing <= 0) return null
  const n = missing === 1 ? 'دورة واحدة' : missing === 2 ? 'دورتان' : `${missing} دورات`
  return `ينقصك ${n} لتحصل على الدورة الهدية`
}

/** الاسمُ الأوّلُ كما في ملفّ المتعلّم — «مسار صهيب»، ولا شيءَ بعده */
export function firstNameAr(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? ''
  return first.slice(0, 40)
}

/** الاسمُ الأوّلُ والأخير — «صهيب الخوالدة» من «صهيب عبد الله الخوالدة». قرارُ صاحب المنصّة (٨ نوفمبر ٢٠٢٦): «اجعلها
    مسار صهيب الخوالدة الشخصي». ولا اسمَ أوسطَ ولا شيءَ بعده */
export function firstLastNameAr(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const out = words.length === 1 ? words[0] : `${words[0]} ${words[words.length - 1]}`
  return out.slice(0, 60)
}

/** سببُ الدورة نظيفا: سطرٌ واحدٌ بحدّه، وفارغُه لا شيء */
export function cleanReason(raw: string | null | undefined): string | null {
  const v = (raw ?? '').replace(/\s+/g, ' ').trim()
  return v ? v.slice(0, PATH_REASON_MAX) : null
}

/* ═══ وسعرُ المسار كما يُعرض — من معاينة الخادم لا من حسابٍ هنا (٨ نوفمبر ٢٠٢٦) ═══
   كان يُكتب في `private-path.service.ts` وحدَه. ثمّ صار في الصفحة استبدالُ دورةٍ وتبديلُ شعبتها، والسعرُ بعدهما يُسأل
   عنه الخادمُ (`/api/public/checkout/preview` ← `CommerceService.preview`) — فالقراءةُ نفسُها هنا للاثنين: السعرُ قبل
   المنحة، وما طُرح منه كلُّه، وما يُدفع. ولا جمعَ ولا طرحَ غيرُ ما فعله الخادم. */

/** ما تقرؤه الصفحةُ من معاينة الخادم */
export interface PathPreviewNumbers {
  currency: string
  subtotal: number
  couponDiscount: number
  bundleDiscount: number
  capDiscount: number
  planCredit: number
  total: number
  grantNameAr?: string | null
  grantPct?: number | null
}

/** السعرُ الأصليّ، وقيمةُ المنحة، وما يدفعه */
export interface PrivatePathPrice {
  currency: string
  before: number
  grant: number
  grantNameAr: string | null
  /** نسبةُ المنحة — تُقال بجانب اسمها (١٧ نوفمبر ٢٠٢٦: «لماذا لا تذكر النسبة هنا؟») */
  grantPct: number | null
  total: number
}

export function privatePathPrice(p: PathPreviewNumbers): PrivatePathPrice {
  return {
    currency: p.currency,
    before: p.subtotal,
    grant: p.couponDiscount + p.bundleDiscount + p.capDiscount + p.planCredit,
    grantNameAr: p.grantNameAr ?? null,
    grantPct: p.grantPct ?? null,
    total: p.total,
  }
}

/** السطرُ تحت «مسار {الاسم الأوّل}» — نصُّ صاحب المنصّة. وصار احتياطا: لمسارٍ لا مجالَ معروفا لدوراته (`privatePathHeadline`) */
export const PATH_SUBTITLE_AR = 'دورات اخترناها لك بناءً على خبرتك'

/* ═══ العنوانُ «مسار {الاسم الأوّل والأخير} الشخصي» وسطرٌ أعمقُ تحته — آليّان (٨ نوفمبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: «اكتب نصّا أكثرَ عمقا وشرحا في السطر الثاني، وأعطني عنوانا أطولَ للمسار». واختار الآليَّ على حقولٍ
   في أداة الرابط، ثمّ قال في العنوان: «غيّرت رأيي.. اجعلها "مسار صهيب الخوالدة الشخصي"». فالعنوانُ اسمُه الأوّلُ والأخيرُ
   (`firstLastNameAr`) من ملفّه — لا اسمَ أوسطَ ولا بريدَ ولا هاتف.

   · **السطرُ تحته**: ممّا كتبه في نموذج المنحة — مستواه الوظيفيّ (`CAREER_LEVELS`) ومجالُ عمله (`WORK_FIELDS`) — ثمّ
     أكثرُ مجالين في دوراته (`courseDomain`، وبترتيب المسار عند التعادل)، ثمّ أوّلُ دورةٍ وآخرُها. ولا وعدَ بنتيجة.
   · وما لا يُعرف لا يُخترع: بلا نموذجٍ يبقى «تبني على خبرتك»، وبلا مجالٍ معروفٍ يعود السطرُ `PATH_SUBTITLE_AR`.
   · ويصل الروابطَ المرسلةَ قبله، ويتبدّل مع «استبدالها».
   ونصوصُه بلا تشكيلٍ إعرابيّ (قرارُ ١١ أكتوبر ٢٠٢٦). والحارس: `src/tests/commerce/private-path-headline.test.ts`. */

/** كيف تُقدَّم الدوراتُ لكلّ مستوى في نموذج المنحة — وما سواه «تبني على خبرتك» */
const LEVEL_AR: Readonly<Record<string, string>> = {
  'طالب أو حديث تخرج': 'تناسب بداية طريقك',
  'موظف في بداية مسيرتي': 'تناسب بداية مسيرتك',
  'موظف بخبرة': 'تبني على خبرتك',
  'مشرف أو قائد فريق': 'تناسب دورك في قيادة فريقك',
  'مدير': 'تناسب دورك كمدير',
  'صاحب عمل': 'تخدم عملك الخاص',
}
const DEFAULT_LEVEL_AR = 'تبني على خبرتك'
/** مجالاتُ عملٍ لا تُقال «في …»: ليست مجالا (`WORK_FIELDS`) */
const NOT_A_FIELD = new Set(['أخرى', 'طالب جامعي', 'أبحث عن عمل'])

export interface PathHeadlineInput {
  /** الاسمُ الأوّلُ والأخير (`firstLastNameAr`) */
  name: string
  /** من نموذج المنحة — وقد لا يكون */
  workField: string | null
  careerLevel: string | null
  /** دوراتُ المسار بترتيبه — معرّفُها وعنوانُها ومجالُها (`courseDomain`) */
  courses: { courseId: string; titleAr: string; domainAr: string }[]
}

/** «دورة واحدة» · «دورتين» · «3 دورات» — مفعولا به بعد «اخترنا لك» */
function countAr(n: number): string {
  if (n === 1) return 'دورة واحدة'
  if (n === 2) return 'دورتين'
  return `${n} ${n <= 10 ? 'دورات' : 'دورة'}`
}

/** العنوانُ والسطرُ تحته — آليّان من اسمه ودوراته ونموذجه */
export function privatePathHeadline(input: PathHeadlineInput): { titleAr: string; subtitleAr: string } {
  const name = input.name.trim()
  const titleAr = name ? `مسار ${name} الشخصي` : 'مسارك الشخصي'

  /* مجالاتُه: أكثرُها دوراتٍ أوّلا، وبترتيب المسار عند التعادل — و«أخرى» لا تُعدّ */
  const tally = new Map<string, { domainAr: string; n: number; first: number }>()
  input.courses.forEach((c, i) => {
    if (!c.domainAr || c.domainAr === 'أخرى') return
    const t = tally.get(c.domainAr) ?? { domainAr: c.domainAr, n: 0, first: i }
    t.n += 1
    tally.set(c.domainAr, t)
  })
  const top = [...tally.values()].sort((a, b) => b.n - a.n || a.first - b.first).slice(0, 2)
  if (top.length === 0 || input.courses.length === 0) return { titleAr, subtitleAr: PATH_SUBTITLE_AR }

  const level = (input.careerLevel && LEVEL_AR[input.careerLevel]) || DEFAULT_LEVEL_AR
  const field = input.workField?.trim() && !NOT_A_FIELD.has(input.workField.trim()) ? ` في ${input.workField.trim()}` : ''
  const domains = top.length === 1 ? `«${top[0].domainAr}»` : `«${top[0].domainAr}» و«${top[1].domainAr}»`
  const parts = [`اخترنا لك ${countAr(input.courses.length)} ${level}${field}، لتطور مهاراتك في ${domains}.`]
  if (input.courses.length >= 2) {
    const first = input.courses[0].titleAr
    const last = input.courses[input.courses.length - 1].titleAr
    parts.push(`تبدأ بـ«${first}» وتنتهي بـ«${last}»، وكل دورة لقاءات مباشرة مع مدربها.`)
  } else {
    parts.push(`تبدأ بـ«${input.courses[0].titleAr}»، بلقاءات مباشرة مع مدربها.`)
  }
  return { titleAr, subtitleAr: parts.join(' ') }
}

/** عنوانُ السبب البارز تحت كلّ دورة */
export const REASON_LABEL_AR = 'سبب اختيارها لك'

/** سطرُ المنحة في سعر المسار: «بلاك فرايدي وجيز 70%» — والنسبةُ بجانب اسمها، وبلا اسمٍ «الخصم» */
export function privatePathGrantLabelAr(p: Pick<PrivatePathPrice, 'grantNameAr' | 'grantPct'>): string {
  const name = p.grantNameAr ?? 'الخصم'
  return p.grantPct ? `${name} ${p.grantPct}%` : name
}

/* ═══ «أضف دورة» في المسار الخاصّ بما بقي على الكود (٢١ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «Allow adding» — نسخا لـ«لا أضف دورة» في الصفحة. فمن كان كودُ منحته يسع أكثرَ من دورات مساره
   (مثلا: مسارٌ بدورتين على كودٍ لأربع) يضيف حتّى حدّ الكود، ويختفي الزرُّ عند الحدّ.
   · **العددُ من الخادم** (`coursesLeft` في جواب `/api/public/go/:code`): ما بقي على كود المنحة في كلّ مشترياته ناقصا دوراتِ
     المسار. ولا يُحسب هنا شيءٌ غيرُ طرح ما أضافه منه.
   · **وبلا كود منحةٍ لا إضافة** (`coursesLeft: null`): لم يُطلب أن يضيف بسعرها الكامل، فالمسارُ يبقى بعدده.
   · **ويحذف ما أضافه وحدَه**: دوراتُ المستشار تُستبدل ولا تُحذف، والمضافةُ آخرُ القائمة (الاستبدالُ في مكانه لا يحرّكها).
   · والسعرُ بعد كلّ إضافةٍ أو حذفٍ من الخادم بالكود نفسِه كالاستبدال — وما لا يسعه الكودُ يقوله الخادم ويتعطّل الزرّ. */

/** كم دورةً يضيفها الآن — حدُّ الخادم ناقصا ما أضافه. وبلا كود منحةٍ صفر */
export function pathAddsLeft(input: { coursesLeft: number | null | undefined; baseCount: number; current: number }): number {
  if (input.coursesLeft === null || input.coursesLeft === undefined) return 0
  const added = Math.max(0, input.current - input.baseCount)
  return Math.max(0, Math.floor(input.coursesLeft) - added)
}

/** أيُحذف هذا الموضع؟ — المضافُ وحدَه، وهو ما بعد دورات المسار */
export const pathCourseRemovable = (index: number, baseCount: number): boolean => index >= baseCount

/** ومن خرج قبل الدفع وعاد: قائمتُه المحفوظةُ إن كانت دوراتِ المسار وما أضافه في حدّه — وإلّا `null` فتعود دوراتُ المسار */
export function restoredPathCourses(saved: readonly string[] | undefined, baseCount: number, coursesLeft: number | null | undefined): string[] | null {
  if (!saved || new Set(saved).size !== saved.length) return null
  const extra = saved.length - baseCount
  if (extra < 0) return null
  if (extra > 0 && extra > (coursesLeft ?? 0)) return null
  return [...saved]
}

/** السطرُ فوق «أضف دورة» — «تضيف حتى دورتين بالكود نفسه» */
export function pathAddsLeftAr(n: number): string {
  return `تضيف حتى ${countAr(n)} بالكود نفسه`
}

/* ═══ والبدائلُ من دورات صفحة المنحة وحدَها (٢١ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «Only Black Friday courses». فما يُستبدل به أو يُضاف في مسارٍ على كود حملةٍ هو ما تعرضه صفحةُ
   حملته (`grantCourseIds` من الخادم ← `pageCourses`). وبلا كود منحةٍ (`null`) كلُّ ما يُشترى كما كان. والترتيبُ يبقى
   ترتيبَه (مجالُ الدورة أوّلا، وما لا يتعارض أوّلا يرتّبه `swapCandidates` بعده). ودوراتُ المسار نفسُها لا تُمسّ: هذا
   للمرشّحين وحدَهم. */

/** المرشّحون ممّا تسعه قائمةُ المنحة — بترتيبهم. و`null` لا قيد */
export function pathCandidatesWithin<T extends { courseId: string }>(ranked: readonly T[], grantCourseIds: readonly string[] | null | undefined): T[] {
  if (grantCourseIds === null || grantCourseIds === undefined) return [...ranked]
  const allowed = new Set(grantCourseIds)
  return ranked.filter((r) => allowed.has(r.courseId))
}

/* ═══ «مسارٌ عامّ» برابطٍ واحدٍ للجميع — `/go/BF80` (٢٢ نوفمبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: «ضع هذه الدورات الثلاث في الرابط … ولكن اجعل الرابط عامّا: يسجّل دخوله أو ينشئ حسابا إن لم يكن له،
   فيظهر المسارُ باسمه». ومن دخل ولا كودَ له في بلاك فرايدي اختار له **«Give code instantly»**: يُعطى كودَها على حسابه فورا،
   بلا هاتف (`publicPathCode` في `private-path.service.ts`).
   ثمّ قرارُه في اليوم نفسِه: **لا «استبدالها» ولا «أضف دورة»** في المسار العامّ (ثمّ عاد فأذن بالإضافة من دورات المنحة —
   «أضف دورة في المسار العامّ» أدناه) — يختار ما يشتريه من دوراته الثلاث وحدَها:
   واحدةً أو اثنتين أو كلَّها، ولا يتابع بلا واحدة. والسعرُ للمختار من الخادم بكوده، والدفعُ بالمختار وحدَه. والمسارُ الخاصّ
   (`/go/<رمز عشوائي>`) باقٍ باستبداله وإضافته.

   · الرمزُ هنا ثابتٌ قصير (أربعةُ أحرف) — لا يصطدم برموز المسارات الخاصّة (ثمانيةٌ عشوائيّة، `GO_CODE_LENGTH`)، ولا يمرّ
     بحارس تجربة الرموز: ليس سرّا.
   · والحارس: `src/tests/commerce/public-path.test.ts` و`server/tests/commerce/public-path.test.ts`. */

export interface PublicPathDef {
  code: string
  /** معرّفُ الحملة التي يُعطى كودُها — `wajeez-black-friday` (`BLACK_FRIDAY_GRANT_SLUG`) */
  campaign: string
  courseIds: readonly string[]
}

/** المساراتُ العامّة برموزها — والرمزُ بحروفٍ كبيرة */
export const PUBLIC_PATHS: Readonly<Record<string, PublicPathDef>> = {
  BF80: { code: 'BF80', campaign: 'wajeez-black-friday', courseIds: ['C-JOB-104', 'C-MGR-107', 'C-BIZ-107'] },
}

/** المسارُ العامّ برمزه — بأيّ حالةٍ للحروف — أو `null` */
export function publicPathOf(raw: string | null | undefined): PublicPathDef | null {
  const code = (raw ?? '').trim().toUpperCase()
  return Object.prototype.hasOwnProperty.call(PUBLIC_PATHS, code) ? PUBLIC_PATHS[code] : null
}

/** أيُفتح هذا الرمزُ في `/go/` — مسارٌ خاصّ بشكله، أو مسارٌ عامّ باسمه */
export const isGoCode = (raw: string): boolean => GO_CODE_RE.test(raw.trim().toUpperCase()) || publicPathOf(raw) !== null

/** لا استبدالَ في المسار العامّ — قرارُ صاحب المنصّة (٢٢ نوفمبر ٢٠٢٦). والإضافةُ فيه بحدّ كوده (`publicPathAddsLeft`) */
export const pathSwappable = (isPublic: boolean): boolean => !isPublic

/* ═══ «أضف دورة» في المسار العامّ — من دورات بلاك فرايدي وحدَها (٢٢ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة في اليوم نفسِه: «اسمح لهم بإضافة دورات، لكن من الدورات الباقية في منحة بلاك فرايدي فقط، لا غيرها» —
   نسخا لـ«لا أضف دورة» في المسار العامّ. والاستبدالُ باقٍ ممنوعا، والثلاثُ تُختار كما كانت (واحدةٌ منها على الأقلّ).
   · **العددُ من الخادم** (`coursesLeft`): ما بقي على كوده ناقصا دوراتِ المسار كلَّها — وقد يكون سالبا هنا، فمن بقي على كوده
     دورتان وأزال واحدةً من الثلاث يضيف واحدة. فما يضيفه الآن: ذلك العددُ ناقصا ما اختاره فوق دورات المسار.
   · **والمرشّحون من قائمة حملته وحدَها** (`grantCourseIds` ← صفحةُ بلاك فرايدي) خارجَ دورات المسار — وبلا قائمةٍ لا شيء،
     لا «كلُّ ما يُشترى» كما في المسار الخاصّ.
   · وما أضافه يُحذف، والسعرُ لكلّ سلّةٍ من الخادم بكوده، وهو الحَكَم عند الدفع. */

/** كم دورةً يضيف الآن في المسار العامّ — `coursesLeft` من الخادم وعددُ دورات المسار وكم اختار (من الثلاث وما أضافه) */
export function publicPathAddsLeft(input: { coursesLeft: number | null | undefined; baseCount: number; selected: number }): number {
  if (input.coursesLeft === null || input.coursesLeft === undefined) return 0
  return Math.max(0, Math.floor(input.coursesLeft) + input.baseCount - input.selected)
}

/** مرشّحو الإضافة في المسار العامّ: من قائمة المنحة وحدَها، وليسوا من دوراته ولا ممّا أضافه. وبلا قائمةٍ لا أحد */
export function publicPathCandidates<T extends { courseId: string }>(
  ranked: readonly T[], grantCourseIds: readonly string[] | null | undefined, inPath: readonly string[],
): T[] {
  if (!grantCourseIds) return []
  const taken = new Set(inPath)
  return pathCandidatesWithin(ranked, grantCourseIds).filter((r) => !taken.has(r.courseId))
}

/** ما يشتريه من المسار العامّ: ما اختاره من الثلاث بترتيبها ثمّ ما أضافه — و`null` إن لم يختر من الثلاث شيئا */
export function publicPathBuyIds(courseIds: readonly string[], chosen: readonly string[], added: readonly string[]): string[] | null {
  const own = publicPathSelection(courseIds, chosen.filter((id) => courseIds.includes(id)))
  if (!own) return null
  return [...own, ...added.filter((id, i) => !courseIds.includes(id) && added.indexOf(id) === i)]
}

/** ومن خرج قبل الدفع وعاد: ما اختاره من الثلاث وما أضافه — أو `null` فيعود المسارُ كما هو */
export function restoredPublicPath(
  saved: readonly string[] | undefined, courseIds: readonly string[], coursesLeft: number | null | undefined,
): { chosen: string[]; added: string[] } | null {
  if (!saved || new Set(saved).size !== saved.length) return null
  const chosen = courseIds.filter((id) => saved.includes(id))
  const added = saved.filter((id) => !courseIds.includes(id))
  if (chosen.length === 0) return null
  if (added.length > 0 && publicPathAddsLeft({ coursesLeft, baseCount: courseIds.length, selected: chosen.length }) < added.length) return null
  return { chosen, added }
}

/** ما اختاره من دورات المسار العامّ — بترتيب المسار ومن دوراته وحدَها. و`null` لاختيارٍ لا يُتابع به: لا شيء، أو ما ليس منه */
export function publicPathSelection(courseIds: readonly string[], selected: readonly string[]): string[] | null {
  const own = new Set(courseIds)
  if (selected.some((id) => !own.has(id))) return null
  const chosen = courseIds.filter((id) => selected.includes(id))
  return chosen.length >= 1 ? chosen : null
}

/** فوق مربّعات الاختيار */
export const PUBLIC_PATH_PICK_AR = 'اختر الدورات التي تريدها: واحدة أو أكثر'
/** ومن لم يدخل: ما يُقال فوق زرّ الدخول */
export const PUBLIC_PATH_SIGN_IN_AR = 'سجل دخولك أو أنشئ حسابا، فيظهر المسار باسمك وسعرك بالمنحة.'
