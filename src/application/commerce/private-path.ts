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

/** السطرُ تحت «مسار {الاسم الأوّل}» — نصُّ صاحب المنصّة */
export const PATH_SUBTITLE_AR = 'دورات اخترناها لك بناءً على خبرتك'
/** عنوانُ السبب البارز تحت كلّ دورة */
export const REASON_LABEL_AR = 'سبب اختيارها لك'
