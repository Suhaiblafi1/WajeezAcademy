/* خطّةُ المدرّب تصل المتعلّمَ — وكانت لا تصله.

   ═══ ما كان ═══

   المدرّبُ يؤلّف خطّةَ شعبته كاملةً: عناوينَ المحاور ومخرجاتِها وأنشطتَها
   ونواتجَها ومتونَها (`bodyAr`)، ومصادرَها. ثمّ يرسلها فيعتمدها المديرُ
   الأكاديميّ. و`plan.content` بعد ذلك يُقرأ في أربعةِ مواضعَ لا خامسَ لها:
   شاشةُ المدرّب، وقائمةُ التجهيز، وشاشةُ المعتمِد، وقرارُ الاقتراحات.

   **ولا سطحَ متعلّمٍ يقرؤه.** درسُ المتعلّم يأتي من `full.modules` — وهي
   وحداتُ **الكتالوج**. فالمدرّبُ يكتب ويُعتمَد، ولا يرى متعلّمٌ حرفا ممّا
   كتب. وقالها صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «تأكّد أنّه يستطيع تعديل
   المتون التدريبيّة».

   ═══ القرار ═══

   قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): **خطّةُ المدرّب تعلو الكتالوج.**
   درسُ متعلّمِ الشعبة يُقرأ من خطّتها المعتمَدة حيث كتب مدرّبُها، ومن
   الكتالوج حيث لم يكتب. ومصدرٌ واحدٌ بلا نسخ: لا تُنسَخ الخطّةُ صفوفا عند
   الاعتماد فتفترقَ النسختان عند كلّ إعادة اعتماد.

   ═══ ثلاثةُ حدودٍ لا تُتجاوز ═══

   ① **الاعتمادُ هو البوّابة.** لا يعلو إلّا `approved` أو `published`. ما
      زال مسودّةً أو مردودا أو منتظِرا لا يُقرأ — وإلّا صار المدرّبُ ينشر
      على متعلّميه بلا مراجعة، وهو نقضُ حاكميّة الاعتماد كلِّها.

   ② **الفارغُ لا يمحو.** حقلٌ تركه المدرّبُ فارغا يعني «لم أكتب» لا
      «امحُ ما في الكتالوج». وإلّا لأفرغ محورا كاملا بحذفِ سطر.

   ③ **لا يُخفى محورُ كتالوج.** للمدرّب أن يحذف محورا من خطّته، لكنّ
      `ModuleProgress` مفاتيحُه مفاتيحُ الكتالوج و`totalModules` عددُ وحداته
      (`progress.service.ts`). فإخفاءُ محذوفٍ يجعل المائةَ في المائة **غيرَ
      بالغة** — ويُحبَس المتعلّمُ دون شهادته بلا أن يعرف لماذا. فالمحذوفُ
      يبقى بمتنِ الكتالوج حتّى يصير التقدّمُ واعيا بالخطّة، وذلك تغييرٌ
      يمسّ أرقاما رآها الناسُ فلا يُركَب هنا. */

import { workbookDone, workbookWhere, type CohortWorkbook } from './axis-timeline'
import { workbookGroups, workbookModeOf, type ModuleWorkbook } from './cohort-workbooks'
import type { LearnerGate } from '../learning/cohort-gate'

/** أنواعُ المصدر التي يعرفها المتعلّم — وما عداها يُعرض رابطا */
export const RESOURCE_KINDS = ['link', 'video', 'book', 'audiobook', 'social', 'file'] as const
export type ResourceKind = (typeof RESOURCE_KINDS)[number]

export function resourceKind(v: string | null | undefined): ResourceKind {
  return (RESOURCE_KINDS as readonly string[]).includes(v ?? '') ? (v as ResourceKind) : 'link'
}

/* ═══ أصنافُ المصادر الثلاثة — يختار المدرّبُ الصنفَ لا النوع ═══

   قال صاحبُ المنصّة (١٥ سبتمبر ٢٠٢٦): «في صفحة المصادر للشعبة هنا عشوائيّة.
   يجب أن تكون مصنّفةً بدلا أن يختار نوعا لكلّ ملفٍّ بنفسه: دوراتٌ مسجّلةٌ
   للمدرّب — وهي جلساتٌ تدريبيّةٌ مسجّلة — ويحدّد متى تفتح للطالب طيلةَ
   الفصل؛ كتبٌ وملفّاتٌ ويكتب ما الهدف؛ فيديوهاتٌ وروابطُ عامّةٌ للفائدة مثل
   فيديوهات وبودكاست وأيّ مصدرٍ مفتوحٍ قد يفيد الطلبة».

   وكان لكلّ صفٍّ قائمةُ أنواعٍ من ستّة (`RESOURCE_KINDS`) يختار منها المدرّبُ
   بنفسه — فتصير الصفحةُ كومةً لا تصنيفا، ويختلف ترتيبُ شعبتين لمدرّبٍ واحد.

   والنوعُ لم يُلغَ: هو ما يراه المتعلّمُ أيقونةً واسما، وما زال في العمود
   وفي شاشته. لكنّه صار **يُشتقّ من الصنف** لا يُسأل عنه — إلّا في «كتبٌ
   وملفّات» حيث يفرّق المرفوعُ عن المُلصَق، وذاك يُعرف من وجود الملفّ.

   ── والقديمُ يُقرأ ولا يُلفَّق له صنفٌ لم يختره صاحبُه ──

   ما حُفظ قبل هذا العمود لا `category` فيه. فيُشتقّ من نوعه: ما كان كتابا
   أو صوتيًّا أو ملفًّا فهو «كتبٌ وملفّات»، وما عداه «عامّ». و**لا شيءَ
   يُشتقّ «مسجّلا»**: تلك خانةٌ لها بوّابةُ فتحٍ زمنيّة، ولو وُضع فيها
   فيديوٌ قديمٌ لاحتجب عن متعلّمٍ كان يراه. والقاعدةُ: الترحيلُ لا يحجب. */
export const RESOURCE_CATEGORIES = ['recorded', 'reading', 'public'] as const
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number]

/** صنفُ المصدر — ويُشتقُّ من النوع لما حُفظ قبل العمود */
export function resourceCategory(r: { category?: string | null; kind?: string | null }): ResourceCategory {
  if ((RESOURCE_CATEGORIES as readonly string[]).includes(r.category ?? '')) return r.category as ResourceCategory
  return ['book', 'audiobook', 'file'].includes(r.kind ?? '') ? 'reading' : 'public'
}

/** النوعُ الذي يراه المتعلّم — يُشتقُّ من الصنف فلا يُسأل عنه المدرّب */
export function kindForCategory(category: ResourceCategory, hasFile: boolean): ResourceKind {
  if (category === 'recorded') return 'video'
  if (category === 'reading') return hasFile ? 'file' : 'book'
  return 'link'
}

/* ═══ والنوعُ الذي يُعرض يُشتقّ لا يُصدَّق ═══

   النوعُ كان يُكتب مرّةً حين يُنشأ الصفُّ ولا يُعاد: صفُّ «كتبٌ وملفّات»
   يولد نوعُه `book`، ثمّ يرفع صاحبُه ملفًّا فيبقى `book` مدى الحياة —
   فيراه المتعلّمُ **كتابا وهو مستند**. وعطبٌ صامت: لا يسقط شيء، بل يُعرض
   اسمٌ خاطئٌ لا يُكذّبه شيءٌ في الشاشة.

   وأُصلحت الكتابةُ في الشاشة، ولا يكفي: صفوفٌ حُفظت بالنوع الخاطئ قبل
   الإصلاح باقيةٌ في القاعدة. فالاشتقاقُ هنا — في الإسقاط الذي يبني ما
   يصل المتعلّمَ — يشفيها كلَّها بلا ترحيل.

   ── وما لا يُشتقّ ──

   الصفُّ الذي **لا صنفَ صريحَ فيه** حُفظ قبل عمود `category`، ونوعُه هو
   ما اختاره صاحبُه من الستّة. واشتقاقُه يُحوّل `audiobook` إلى `book`
   ويُضيّع تمييزا قصده صاحبُه. فالقاعدةُ: يُشتقُّ لمن له صنفٌ صريح،
   ويُصدَّق نوعُ من لا صنفَ له. */
export function displayKind(r: {
  category?: string | null; kind?: string | null; bodyFileKey?: string | null
}): ResourceKind {
  if (!(RESOURCE_CATEGORIES as readonly string[]).includes(r.category ?? '')) return resourceKind(r.kind)
  return kindForCategory(r.category as ResourceCategory, (r.bodyFileKey ?? '').trim().length > 0)
}

/** أمفتوحٌ هذا المصدرُ للمتعلّم الآن؟ — «متى تفتح للطالب» تخصّ المسجّلَ وحدَه */
export function resourceOpen(r: { category?: string | null; kind?: string | null; opensAt?: string | Date | null }, now = new Date()): boolean {
  if (resourceCategory(r) !== 'recorded' || !r.opensAt) return true
  const at = r.opensAt instanceof Date ? r.opensAt : new Date(r.opensAt)
  return Number.isNaN(at.getTime()) ? true : at <= now
}

/** مرفقٌ أو مصدرٌ — الشكلُ واحدٌ في خطّة الشعبة وفي التكليف */
export interface TypedLink {
  title: string
  /** الرابط — أو فارغٌ لمرفقٍ مرفوع (`bodyFileKey`) */
  url: string
  /** مرفقُ مهمّةٍ مرفوعٌ في مخزن الشعبة (٣٠ سبتمبر ٢٠٢٦) — يُقرأ من المسار المحروس */
  bodyFileKey?: string | null
  bodyFileName?: string | null
  bodyFileMime?: string | null
  kind?: string | null
  noteAr?: string | null
  /** صنفُ المصدر — مسجَّلٌ للمدرّب، أو كتبٌ وملفّات، أو عامٌّ للفائدة */
  category?: string | null
  /** متى يُفتح للمتعلّم — للمسجَّل وحدَه، وفارغٌ يعني «مع أوّل يوم» */
  opensAt?: string | null
}

/**
 * قراءةُ مرفقاتٍ محفوظةٍ في عمود JSON — دفاعيّةٌ بقصد.
 *
 * العمودُ `Json?`، فما فيه ما كتبه أيُّ إصدارٍ من الخادم: `null` لما سبق
 * العمود، ومصفوفةٌ صحيحةٌ اليوم، وأيُّ شيءٍ لو كُتب بيدٍ في قاعدةٍ يوما.
 * وصفٌّ واحدٌ مشوّهٌ لا يُسقط شاشةَ تكليفٍ على متعلّمٍ ينتظر موعدَ تسليم.
 */
export function readTypedLinks(raw: unknown): TypedLink[] {
  if (!Array.isArray(raw)) return []
  const out: TypedLink[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const title = typeof r.title === 'string' ? r.title.trim() : ''
    const url = typeof r.url === 'string' ? r.url.trim() : ''
    /* والمرفقُ المرفوعُ بلا رابط (٣٠ سبتمبر ٢٠٢٦): «ملفٌّ» يُرفع لا يُلصق */
    const key = typeof r.bodyFileKey === 'string' ? r.bodyFileKey.trim() : ''
    if (!title || (!url && !key)) continue
    out.push({
      title,
      url: key ? '' : url,
      ...(key ? {
        bodyFileKey: key,
        bodyFileName: typeof r.bodyFileName === 'string' ? r.bodyFileName : null,
        bodyFileMime: typeof r.bodyFileMime === 'string' ? r.bodyFileMime : null,
      } : {}),
      kind: resourceKind(typeof r.kind === 'string' ? r.kind : null),
      noteAr: typeof r.noteAr === 'string' && r.noteAr.trim() ? r.noteAr.trim() : null,
    })
  }
  return out
}

/** ما يلزم من وحدة الكتالوج — والزائدُ يمرّ كما هو */
export interface CatalogModuleLike {
  id: string
  title: string
  outcome?: string | null
  activity?: string | null
  artifact?: string | null
  body?: string | null
  /** ع-٢: يأتي من الخطّة وحدَها — لا ملفَّ متنٍ في الكتالوج */
  bodyFileKey?: string | null
  bodyFileName?: string | null
  bodyFileMime?: string | null
}

/** ما يعلو به المدرّب — الشكلُ نفسُه الذي يحفظه في خطّته */
export interface PlanModuleLike {
  moduleId: string
  titleAr: string
  outcomeAr?: string | null
  activityAr?: string | null
  artifactAr?: string | null
  bodyAr?: string | null
  /** ع-٢: ملفٌّ يقرؤه المتعلّمُ بدلا من متنٍ مكتوب */
  bodyFileKey?: string | null
  /* واسمُه ونوعُه لقطةٌ تسكن الخطّةَ لا تُقرأ من صفٍّ عند كلّ فتحة: الشاشةُ
     تحتاج النوعَ لتعرف أيُعرض في مكانه أم يُنزَّل، وطلبٌ ثانٍ لأجل ذلك
     يؤخّر أوّلَ ما يراه المتعلّم. والصفُّ يبقى مالكَ البايتات وحارسَها. */
  bodyFileName?: string | null
  bodyFileMime?: string | null
}

/** ما تعلو به الخطّةُ — المشروعُ من محتواها إلى المتعلّم لا كلُّه */
export interface LearnerPlanView {
  modules: LearnerPlanModule[]
  resources: LearnerPlanResource[]
  summaryAr?: string | null
  /** مواعيدُ المحاور بكرّاساتها — فارغةٌ لما اعتُمد بلا مواعيد (٢(ب-٢)) */
  slots?: LearnerSlot[]
  /** كرّاسةُ الشعبة الواحدة وخريطتُها — `null` لما لا كرّاسةَ شعبةٍ فيه */
  workbook?: LearnerCohortWorkbook | null
  /** أو كرّاساتُ المحاور — لمحورٍ أو لمحاورَ متجاورة (٦ أكتوبر ٢٠٢٦)؛ فارغةٌ في غير ذلك */
  moduleWorkbooks?: LearnerModuleWorkbook[]
}

/** كرّاسةُ محورٍ أو محاورَ متجاورة كما تصل المتعلّم (٦ أكتوبر ٢٠٢٦) */
export interface LearnerModuleWorkbook {
  moduleIds: string[]
  /** لم يحن أوّلُ يومٍ في موعد أسبق محاورها، أو انتهى الوصول */
  locked: boolean
  /** متى تُفتح — `null`: بلا بوّابة، أو انتهى الوصول */
  opensAt: string | null
  /** الملفُّ أو الرابط — `null` حتّى تُفتح */
  file: LearnerWorkbook | null
}

/** كرّاسةُ الشعبة كما تصل المتعلّم (٣٠ سبتمبر ٢٠٢٦) */
export interface LearnerCohortWorkbook {
  /** لم يحن أوّلُ يومٍ في الشعبة، أو انتهى الوصول */
  locked: boolean
  /** متى تُفتح — أوّلُ يوم الموعد الأوّل (`null`: بلا بوّابة، أو انتهى الوصول) */
  opensAt: string | null
  /** الملفُّ أو الرابط — `null` حتّى تُفتح */
  file: LearnerWorkbook | null
  /** أين يبدأ كلُّ محورٍ فيها — يصل مع العناوين، فهو خريطةٌ لا متن */
  parts: { moduleId: string; whereAr: string }[]
}

/** محورُ الخطّة كما يصل المتعلّم — والمحجوبُ عنوانٌ وموعدٌ بلا متن */
export interface LearnerPlanModule extends PlanModuleLike {
  /** لم يحن موعدُه بعد، أو انتهى الوصولُ إلى الشعبة — فلا متنَ فيه ولا ملفّ */
  locked?: boolean
  /** متى يُفتح متنُه — أوّلَ يوم موعده (`null`: بلا بوّابة، أو انتهى الوصول) */
  opensAt?: string | null
}

/** كرّاسةُ الموعد حين تُفتح — ملفٌّ يُقرأ من المسار المحروس، أو رابط */
export interface LearnerWorkbook {
  title: string | null
  url: string | null
  bodyFileKey: string | null
  bodyFileName: string | null
  bodyFileMime: string | null
}

/** موعدٌ على خطّ الشعبة كما يراه المتعلّم */
export interface LearnerSlot {
  startsOn: string
  endsOn: string
  moduleIds: string[]
  /** أوّلُ لحظةٍ فيه — فيها تُفتح كرّاستُه ومادّتُه النظريّة */
  opensAt: string
  /** آخرُ لحظةٍ فيه — آخرُ موعدٍ افتراضيٌّ لتسليم مهامّه */
  closesAt: string
  locked: boolean
  /** أثمّ كرّاسةٌ — فتقول الشاشةُ «تُفتح كرّاستُه» قبل موعده لا «لا كرّاسة» */
  hasWorkbook: boolean
  /** الكرّاسةُ نفسُها — `null` حتّى يُفتح الموعد: لا رابطَ يصل قبل أوانه */
  workbook: LearnerWorkbook | null
}

export interface LearnerPlanResource {
  title: string
  url: string
  kind?: string | null
  noteAr?: string | null
  /** صنفُه — تعرضه شاشةُ المتعلّم مجموعا لا كومةً واحدة */
  category?: string | null
  /** متى فُتح — يُقرأ للعرض، والمحجوبُ لا يصل أصلا */
  opensAt?: string | null
  /** محورُه — فتجمعه الشاشةُ تحت موعده. `null`: للشعبة كلِّها */
  moduleId?: string | null
  /* د-٣: مصدرٌ مرفوعٌ — يُفتح من مسارٍ محروسٍ لا من رابطٍ خارجيّ. واسمُه
     ونوعُه لقطةٌ تسكن الخطّةَ، فتعرف الشاشةُ أتعرضه أم تُنزّله بلا طلبٍ ثانٍ. */
  bodyFileKey?: string | null
  bodyFileName?: string | null
  bodyFileMime?: string | null
}

/** حالاتُ الخطّة التي تُقرأ — وما عداها لا يُعلي شيئا */
export const PLAN_VISIBLE_STATUSES = ['approved', 'published'] as const

export function planIsVisible(status: string | null | undefined): boolean {
  return (PLAN_VISIBLE_STATUSES as readonly string[]).includes(status ?? '')
}

/* ── ونُقلت أرضيّةُ المتن إلى `module-body.ts` (ع-٢) ──

   صار للمتن بديلٌ: ملفٌّ يُرفق. فقاعدةُ «متى يتمّ المحور» لم تعد رقما بل
   قسمةً بين المكتوب والمرفوع، ومسكنُها مع القسمة. وتُصدَّر من هنا كما كانت
   فلا يُكسَر مستوردٌ قائم — والقيمةُ واحدةٌ في الموضعَين لأنّها واحدة. */
export { MIN_MODULE_BODY } from './module-body'

/** نصٌّ ذو معنى — والفراغُ والمسافاتُ وحدَها ليست كتابة */
function written(v: string | null | undefined): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s.length > 0 ? s : null
}

/** رابطٌ يُفتح — http(s) وحدَه، وما عداه `null` */
function httpUrl(v: string | null | undefined): string | null {
  const s = written(v)
  return s && /^https?:\/\/\S+$/i.test(s) ? s : null
}

/**
 * وحداتُ المتعلّم بعد علوّ الخطّة.
 *
 * يعيد وحداتِ الكتالوج بترتيبها، كلٌّ منها بما كتبه المدرّبُ فوقها، ثمّ
 * ما أضافه المدرّبُ من محاورَ ليست في الكتالوج بترتيب خطّته. و`fromTrainer`
 * تقول عن كلّ حقلٍ مَن كتبه — تستعملها الشاشةُ لتنسب المتنَ إلى مدرّبه.
 */
/* ع-٢: الخارجُ يحمل ملفَّ المتن صراحةً — تضيفه هذه الدالّةُ فعلا، فلو
   بقي النوعُ `T` وحدَه لَقرأته الشاشةُ بـ`as any` أو لم تقرأه أصلا. */
type Overlaid<T> = T & {
  fromTrainer: boolean
  bodyFileKey: string | null
  bodyFileName: string | null
  bodyFileMime: string | null
  /** ٢(ب-٢): محجوبٌ حتّى موعده — فلا متن، ولا يُقرأ متنُ الكتالوج بدلا منه */
  locked: boolean
  opensAt: string | null
}

export function overlayModules<T extends CatalogModuleLike>(
  catalog: readonly T[],
  plan: LearnerPlanView | null,
): Overlaid<T>[] {
  /* بلا خطّةٍ لا ملفَّ متن: الكتالوجُ لا يحمله. وتُكتب `null` صراحةً فلا
     يتسرّب `undefined` إلى شاشةٍ تسأل «أثمّ ملفّ؟». */
  const bare = (m: T): Overlaid<T> =>
    ({ ...m, fromTrainer: false, bodyFileKey: null, bodyFileName: null, bodyFileMime: null, locked: false, opensAt: null })

  if (!plan || plan.modules.length === 0) return catalog.map(bare)
  const byId = new Map<string, LearnerPlanModule>()
  for (const m of plan.modules) byId.set(m.moduleId, m)

  const out: Overlaid<T>[] = catalog.map((m) => {
    const over = byId.get(m.id)
    if (!over) return bare(m)
    const title = written(over.titleAr)
    const outcome = written(over.outcomeAr)
    const activity = written(over.activityAr)
    const artifact = written(over.artifactAr)
    const body = written(over.bodyAr)
    /* ع-٢: الملفُّ من الخطّة وحدَها — والكتالوجُ لا يحمل ملفَّ متن */
    const bodyFileKey = written(over.bodyFileKey)
    /* ═══ والمحجوبُ لا يُملأ من الكتالوج (٢(ب-٢)) ═══

       الخادمُ يُفرغ متنَ المحور الذي لم يحن موعدُه. ولو بقي «الفارغُ لا
       يمحو» (②) على حاله لَقرأت الشاشةُ متنَ الكتالوج مكانه — فيُقال
       للمتعلّم «يُفتح الأحد» ويُعرض له المتنُ اليوم. فالحجبُ أعلى من العلوّ. */
    const locked = over.locked === true
    return {
      ...m,
      title: title ?? m.title,
      outcome: outcome ?? m.outcome ?? null,
      activity: activity ?? m.activity ?? null,
      artifact: artifact ?? m.artifact ?? null,
      body: locked ? null : body ?? m.body ?? null,
      bodyFileKey: locked ? null : bodyFileKey,
      bodyFileName: locked ? null : written(over.bodyFileName),
      bodyFileMime: locked ? null : written(over.bodyFileMime),
      /* «من مدرّبك» تُقال حين كتب شيئا فعلا — لا لمجرّد بقاءِ المحور
         في خطّته بحقولٍ فارغة. وملفٌّ رفعه كتابةٌ منه أيضا. */
      fromTrainer: Boolean(title ?? outcome ?? activity ?? artifact ?? body ?? bodyFileKey),
      locked,
      opensAt: over.opensAt ?? null,
    } as Overlaid<T>
  })

  /* ما أضافه المدرّبُ ممّا ليس في الكتالوج — في ذيل القائمة بترتيب خطّته */
  const catalogIds = new Set(catalog.map((m) => m.id))
  for (const m of plan.modules) {
    if (catalogIds.has(m.moduleId)) continue
    const locked = m.locked === true
    out.push({
      id: m.moduleId,
      title: written(m.titleAr) ?? m.moduleId,
      outcome: written(m.outcomeAr),
      activity: written(m.activityAr),
      artifact: written(m.artifactAr),
      body: locked ? null : written(m.bodyAr),
      bodyFileKey: locked ? null : written(m.bodyFileKey),
      bodyFileName: locked ? null : written(m.bodyFileName),
      bodyFileMime: locked ? null : written(m.bodyFileMime),
      fromTrainer: true,
      locked,
      opensAt: m.opensAt ?? null,
    } as unknown as Overlaid<T>)
  }
  return out
}

/** المحورُ الواحدُ بعد العلوّ — لشاشةِ دراسته، بالمنطق نفسِه لا بنسخةٍ ثانية */
export function overlayModule<T extends CatalogModuleLike>(
  catalogModule: T | null | undefined,
  plan: LearnerPlanView | null,
  moduleId: string,
): Overlaid<T> | null {
  const catalog = catalogModule ? [catalogModule] : []
  return overlayModules(catalog, plan).find((m) => m.id === moduleId) ?? null
}

/* ─────────── ما يخرج من الخطّة إلى المتعلّم ─────────── */

/**
 * مشروعُ الخطّة للمتعلّم — **انتقاءٌ لا حذف**.
 *
 * والفرقُ ليس أسلوبا: `content` يحمل `proposals` — ما يقترحه المدرّبُ على
 * الإدارة من تغييرِ اسم الدورة أو المسار. وهو حوارٌ بين المدرّب والإدارة لا
 * شأنَ للمتعلّم به، ولو خرج لرأى المتعلّمُ اسما مقترَحا لم يُعتمد بعد.
 * فالحقولُ تُذكَر بأسمائها هنا: حقلٌ جديدٌ في `content` غدا لا يتسرّب
 * بنشرِ كائنٍ كاملٍ نسي أحدٌ أن يستثنيَ منه.
 */
export function projectPlanForLearner(
  plan: { status: string | null | undefined; content: unknown } | null | undefined,
  /* واللحظةُ تُمرَّر ولا تُؤخذ من الساعة داخلَ الدالّة: بوّابةٌ زمنيّةٌ لا
     تُختبَر إلّا بانتظارٍ حقيقيٍّ بوّابةٌ لا يحرسها أحد. */
  now = new Date(),
  /* ٢(ب-٢): خطُّ المحاور ونافذةُ الشعبة — يبنيهما المستدعي من خطّتها
     ولقاءاتها (`learnerGate` في `learning/cohort-gate.ts`). وبلا خطٍّ تُسقَط
     الخطّةُ كما كانت قبله: ما اعتُمد بلا مواعيد يمضي كما بدأ. */
  gate: LearnerGate | null = null,
): LearnerPlanView | null {
  if (!plan || !planIsVisible(plan.status)) return null
  const c = plan.content as
    | {
        modules?: PlanModuleLike[]
        resources?: (LearnerPlanResource & { preReading?: boolean | null })[]
        summaryAr?: string | null
        workbook?: CohortWorkbook | null
        workbookMode?: string | null
        workbooks?: ModuleWorkbook[] | null
      }
    | null
  if (!c || typeof c !== 'object') return null
  const timeline = gate?.timeline ?? null
  /* ④ بعد ستّة أشهرٍ من انتهاء الشعبة ينتهي الوصول: عناوينُ ما درسه تبقى
     خريطةً لما مضى، ولا متنَ ولا كرّاسةَ ولا مصدر. */
  const ended = gate?.access === 'ended'
  const iso = (d: Date | null) => (d ? d.toISOString() : null)
  const notYet = (at: Date | null) => at !== null && at.getTime() > now.getTime()
  /* ═══ كرّاسةُ الشعبة الواحدة (٣٠ سبتمبر ٢٠٢٦) ═══

     تُفتح أوّلَ يوم الموعد الأوّل — وهي كاملةٌ للمحاور كلِّها، فمن فُتح له
     محورُه الأوّلُ فُتحت له. وخريطتُها (أين يبدأ كلُّ محور) تصل قبل ذلك مع
     العناوين: موضعٌ لا متن. ومتى وُجدت سقطت كرّاساتُ المواعيد القديمة من
     العرض، فلا يرى المتعلّمُ كرّاستَين لشيءٍ واحد. */
  /* ═══ أو لكلّ محورٍ كرّاستُه (٦ أكتوبر ٢٠٢٦) ═══

     يصل ما في الطريقة التي اختارها المدرّبُ وحدَها — والأخرى محفوظةٌ لا تصل.
     وكرّاسةُ المحاور تُفتح أوّلَ يومٍ في موعد أسبق محاورها، كمتن المحور نفسِه
     (`theoryOpensAt`)؛ وقبله يُقال متى، ولا يصل رابطُها ولا مفتاحُ ملفّها. */
  const byModule = workbookModeOf(c) === 'modules'
  const cohortWb = !byModule && workbookDone(c.workbook) ? c.workbook! : null
  const planModuleIds = (Array.isArray(c.modules) ? c.modules : []).map((m) => m.moduleId)
  const moduleWorkbooks: LearnerModuleWorkbook[] = byModule
    ? workbookGroups(c.workbooks, planModuleIds).filter((g) => workbookDone(g)).map((g) => {
        const opens = g.moduleIds
          .map((id) => timeline?.theoryOpensAt(id) ?? null)
          .filter((d): d is Date => d !== null)
          .sort((a, b) => a.getTime() - b.getTime())[0] ?? null
        const locked = ended || notYet(opens)
        return {
          moduleIds: [...g.moduleIds],
          locked,
          opensAt: ended ? null : iso(opens),
          file: locked
            ? null
            : {
                title: written(g.title),
                url: httpUrl(g.url),
                bodyFileKey: written(g.bodyFileKey),
                bodyFileName: written(g.bodyFileName),
                bodyFileMime: written(g.bodyFileMime),
              },
        }
      })
    : []
  const wbOpensAt = timeline?.slots[0]?.opensAt ?? null
  const wbLocked = ended || notYet(wbOpensAt)
  const workbook: LearnerCohortWorkbook | null = cohortWb
    ? {
        locked: wbLocked,
        opensAt: ended ? null : iso(wbOpensAt),
        file: wbLocked
          ? null
          : {
              title: written(cohortWb.title),
              url: httpUrl(cohortWb.url),
              bodyFileKey: written(cohortWb.bodyFileKey),
              bodyFileName: written(cohortWb.bodyFileName),
              bodyFileMime: written(cohortWb.bodyFileMime),
            },
        parts: (Array.isArray(c.modules) ? c.modules : [])
          .map((m) => ({ moduleId: m.moduleId, whereAr: workbookWhere(cohortWb, m.moduleId) }))
          .filter((x): x is { moduleId: string; whereAr: string } => x.whereAr !== null),
      }
    : null
  return {
    workbook,
    moduleWorkbooks,
    summaryAr: written(c.summaryAr),
    modules: Array.isArray(c.modules)
      ? c.modules.map((m) => {
          /* «الكرّاسةُ والمادّةُ النظريّةُ تُفتح مباشرةً قبل اللقاء» — أوّلَ يوم
             موعده. وقبله يصل عنوانُه وما يخرج به ليرى المتعلّمُ طريقَه، ولا
             يصل متنُه ولا ملفُّه: بوّابةٌ في الشاشة وحدَها يقرؤها المتصفّح. */
          const opensAt = timeline?.theoryOpensAt(m.moduleId) ?? null
          const locked = ended || notYet(opensAt)
          return {
            moduleId: m.moduleId,
            titleAr: m.titleAr,
            outcomeAr: m.outcomeAr ?? null,
            activityAr: m.activityAr ?? null,
            artifactAr: m.artifactAr ?? null,
            bodyAr: locked ? null : m.bodyAr ?? null,
            /* ع-٢: يصل المتعلّمَ مفتاحُ الملفّ لا الملفّ — وقراءتُه تمرّ
               بحارسٍ يتحقّق من التحاقه بالشعبة. */
            bodyFileKey: locked ? null : m.bodyFileKey ?? null,
            bodyFileName: locked ? null : m.bodyFileName ?? null,
            bodyFileMime: locked ? null : m.bodyFileMime ?? null,
            locked,
            opensAt: ended ? null : iso(opensAt),
          }
        })
      : [],
    /* ═══ ومواعيدُ المحاور بكرّاساتها ═══

       الكرّاسةُ تُفتح أوّلَ يوم موعدها (⑦)، وقبله يُقال إنّ لها كرّاسةً ومتى
       تُفتح — ولا يصل رابطُها ولا مفتاحُ ملفّها. */
    slots: timeline
      ? timeline.slots.map((s) => {
          const open = !ended && !notYet(s.opensAt)
          const hasWorkbook = !cohortWb && !byModule && workbookDone(s.workbook)
          return {
            startsOn: s.startsOn,
            endsOn: s.endsOn,
            moduleIds: [...s.moduleIds],
            opensAt: s.opensAt.toISOString(),
            closesAt: s.closesAt.toISOString(),
            locked: !open,
            hasWorkbook,
            workbook: open && hasWorkbook
              ? {
                  title: written(s.workbook?.title),
                  /* والرابطُ ما كان http(s) وحدَه — لا يصير `javascript:` زرّا */
                  url: httpUrl(s.workbook?.url),
                  bodyFileKey: written(s.workbook?.bodyFileKey),
                  bodyFileName: written(s.workbook?.bodyFileName),
                  bodyFileMime: written(s.workbook?.bodyFileMime),
                }
              : null,
          }
        })
      : [],
    /* ═══ والمسجَّلُ الذي لم يحن وقتُه لا يصل المتعلّمَ أصلا ═══

       «ويحدّد متى تفتح للطالب طيلةَ الفصل» — وبوّابةٌ تُطبَّق في الشاشة
       وحدَها ليست بوّابة: الرابطُ يصل الجهازَ فيُقرأ من أدوات المتصفّح، أو
       من نداءٍ مباشر. فالحجبُ هنا — في الإسقاط الذي يبني ما يُرسَل.

       والفارغُ لا يحجب: مصدرٌ بلا تاريخِ فتحٍ مفتوحٌ مع أوّل يوم.

       ٢(ب-٢): وعلى خطّ المحاور يحكم الخطُّ نفسُه — مصادرُ المحور بعد أوّل
       لقاءٍ له، والقراءةُ المسبقةُ مع كرّاسته، وما لا محورَ له مع أوّل يومٍ
       في الشعبة (`resourceOpensAt`). */
    resources: Array.isArray(c.resources) && !ended
      ? c.resources
          .filter((r) => (timeline ? !notYet(timeline.resourceOpensAt(r)) : resourceOpen(r, now)))
          .map((r) => ({
            title: r.title,
            url: r.url,
            /* والنوعُ يُشتقّ لمن له صنفٌ صريح — فيُشفى ما حُفظ خطأً */
            kind: displayKind(r),
            category: resourceCategory(r),
            opensAt: timeline ? iso(timeline.resourceOpensAt(r)) : typeof r.opensAt === 'string' ? r.opensAt : null,
            moduleId: written(r.moduleId),
            noteAr: written(r.noteAr),
            bodyFileKey: written(r.bodyFileKey),
            bodyFileName: written(r.bodyFileName),
            bodyFileMime: written(r.bodyFileMime),
          }))
      : [],
  }
}
