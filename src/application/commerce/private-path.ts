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
  code: string | null
  whatsapp: boolean
  /** نسخةٌ أحدثُ منه — فيُحوَّل إليها من فتحه */
  supersededBy?: string
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
}

/** السعرُ الأصليّ، وقيمةُ المنحة، وما يدفعه */
export interface PrivatePathPrice {
  currency: string
  before: number
  grant: number
  grantNameAr: string | null
  total: number
}

export function privatePathPrice(p: PathPreviewNumbers): PrivatePathPrice {
  return {
    currency: p.currency,
    before: p.subtotal,
    grant: p.couponDiscount + p.bundleDiscount + p.capDiscount + p.planCredit,
    grantNameAr: p.grantNameAr ?? null,
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
