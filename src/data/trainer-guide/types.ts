/* بنيةُ «دليل المدرّب» — ما يكتبه المحتوى وما تعرضه الصفحة.

   المحتوى بياناتٌ لا JSX: يُقرأ ويُراجَع ويُحرَس (كلُّ تبويبٍ في البوّابة له
   قسمٌ هنا، وكلُّ لقطةٍ يُشار إليها لها ملفّ) بلا أن يُفتح ملفُّ عرض.

   ═══ ولغةُ النصّ صغيرةٌ عن قصد ═══

   · «…» — اسمُ زرٍّ أو تبويبٍ **كما يُكتب في البوّابة حرفا**، ويُعرَض رقاقةً
     تشبه الزرّ ليُطابَق بالعين. فلا يُكتب اسمُ زرٍّ بغير لفظه.
   · [نصّ](#قسم) أو [نصّ](/trainer/...) — رابطٌ داخليّ.

   ولا نجماتِ تغليظ: قرارُ صاحب المنصّة «لا تستخدم بولد بالكلمات لتكون أنعمَ
   النصوص» — والتمييزُ باللون والرقاقة لا بالصياح. */

/** سطرٌ بلغة الدليل الصغيرة: «زرّ» و[رابط](#قسم) */
export type GuideRich = string

/** خطوةٌ مرقّمة — ورقمُها هو الدائرةُ الذهبيّةُ نفسُها على الصورة إن وُجدت */
export interface GuideStep {
  text: GuideRich
  /** تفصيلٌ تحت الخطوة: شرطٌ أو حدٌّ أو ما يحدث بعدها */
  detail?: GuideRich
}

export type CalloutTone =
  /** نصيحةٌ توفّر وقتا */
  | 'tip'
  /** ما يُفوَّت فيُكلِّف: مهلةٌ أو فعلٌ لا رجعةَ فيه */
  | 'important'
  /** ما يظهر للناس باسمك — ومن يعتمده قبل أن يظهر */
  | 'public'
  /** ما يقوله عقدُك بنصّه */
  | 'contract'

export type GuideBlock =
  | { kind: 'p'; text: GuideRich }
  | { kind: 'steps'; title?: string; items: GuideStep[] }
  | { kind: 'figure'; shot: string; alt: string; caption?: GuideRich }
  | { kind: 'callout'; tone: CalloutTone; title: string; text: GuideRich }
  | { kind: 'list'; items: GuideRich[] }
  | { kind: 'table'; head: string[]; rows: GuideRich[][] }

export interface GuideSection {
  /** مرساةُ القسم في الرابط (#…) — ثابتةٌ لأنّ الرسائلَ والإشعاراتِ قد تشير إليها */
  id: string
  title: string
  /** سطرٌ واحد: لماذا يفتح المدرّبُ هذا الباب */
  why: GuideRich
  /** اسمُ التبويب في شريط البوّابة كما يُكتب هناك */
  tab?: string
  /** المسارُ الذي يفتحه زرُّ «افتحها في بوّابتك» */
  path?: string
  blocks: GuideBlock[]
}

/** محطّةٌ في رحلة المدرّب — من التوقيع إلى أوّل مستحقّ */
export interface JourneyStop {
  title: string
  detail: string
  /** أين يُقرأ تفصيلُها في الدليل */
  anchor: string
}

/** بندٌ في قائمة الأسبوع الأوّل */
export interface ChecklistItem {
  id: string
  text: GuideRich
  /** تقديرُ الوقت بعبارةٍ عربيّة — «٥ دقائق» */
  time: string
  anchor: string
  /** اختياريّ لا شرط — يُقال ولا يُحسب في «ما بقي» */
  optional?: boolean
}

export interface FaqItem {
  q: string
  a: GuideRich
}
