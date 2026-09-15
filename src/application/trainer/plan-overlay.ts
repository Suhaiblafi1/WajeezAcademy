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

/** أمفتوحٌ هذا المصدرُ للمتعلّم الآن؟ — «متى تفتح للطالب» تخصّ المسجّلَ وحدَه */
export function resourceOpen(r: { category?: string | null; kind?: string | null; opensAt?: string | Date | null }, now = new Date()): boolean {
  if (resourceCategory(r) !== 'recorded' || !r.opensAt) return true
  const at = r.opensAt instanceof Date ? r.opensAt : new Date(r.opensAt)
  return Number.isNaN(at.getTime()) ? true : at <= now
}

/** مرفقٌ أو مصدرٌ — الشكلُ واحدٌ في خطّة الشعبة وفي التكليف */
export interface TypedLink {
  title: string
  url: string
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
    if (!title || !url) continue
    out.push({
      title,
      url,
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
  modules: PlanModuleLike[]
  resources: LearnerPlanResource[]
  summaryAr?: string | null
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
}

export function overlayModules<T extends CatalogModuleLike>(
  catalog: readonly T[],
  plan: LearnerPlanView | null,
): Overlaid<T>[] {
  /* بلا خطّةٍ لا ملفَّ متن: الكتالوجُ لا يحمله. وتُكتب `null` صراحةً فلا
     يتسرّب `undefined` إلى شاشةٍ تسأل «أثمّ ملفّ؟». */
  const bare = (m: T): Overlaid<T> =>
    ({ ...m, fromTrainer: false, bodyFileKey: null, bodyFileName: null, bodyFileMime: null })

  if (!plan || plan.modules.length === 0) return catalog.map(bare)
  const byId = new Map<string, PlanModuleLike>()
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
    return {
      ...m,
      title: title ?? m.title,
      outcome: outcome ?? m.outcome ?? null,
      activity: activity ?? m.activity ?? null,
      artifact: artifact ?? m.artifact ?? null,
      body: body ?? m.body ?? null,
      bodyFileKey,
      bodyFileName: written(over.bodyFileName),
      bodyFileMime: written(over.bodyFileMime),
      /* «من مدرّبك» تُقال حين كتب شيئا فعلا — لا لمجرّد بقاءِ المحور
         في خطّته بحقولٍ فارغة. وملفٌّ رفعه كتابةٌ منه أيضا. */
      fromTrainer: Boolean(title ?? outcome ?? activity ?? artifact ?? body ?? bodyFileKey),
    } as Overlaid<T>
  })

  /* ما أضافه المدرّبُ ممّا ليس في الكتالوج — في ذيل القائمة بترتيب خطّته */
  const catalogIds = new Set(catalog.map((m) => m.id))
  for (const m of plan.modules) {
    if (catalogIds.has(m.moduleId)) continue
    out.push({
      id: m.moduleId,
      title: written(m.titleAr) ?? m.moduleId,
      outcome: written(m.outcomeAr),
      activity: written(m.activityAr),
      artifact: written(m.artifactAr),
      body: written(m.bodyAr),
      fromTrainer: true,
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
): LearnerPlanView | null {
  if (!plan || !planIsVisible(plan.status)) return null
  const c = plan.content as
    | { modules?: PlanModuleLike[]; resources?: LearnerPlanResource[]; summaryAr?: string | null }
    | null
  if (!c || typeof c !== 'object') return null
  return {
    summaryAr: written(c.summaryAr),
    modules: Array.isArray(c.modules)
      ? c.modules.map((m) => ({
          moduleId: m.moduleId,
          titleAr: m.titleAr,
          outcomeAr: m.outcomeAr ?? null,
          activityAr: m.activityAr ?? null,
          artifactAr: m.artifactAr ?? null,
          bodyAr: m.bodyAr ?? null,
          /* ع-٢: يصل المتعلّمَ مفتاحُ الملفّ لا الملفّ — وقراءتُه تمرّ
             بحارسٍ يتحقّق من التحاقه بالشعبة. */
          bodyFileKey: m.bodyFileKey ?? null,
          bodyFileName: m.bodyFileName ?? null,
          bodyFileMime: m.bodyFileMime ?? null,
        }))
      : [],
    /* ═══ والمسجَّلُ الذي لم يحن وقتُه لا يصل المتعلّمَ أصلا ═══

       «ويحدّد متى تفتح للطالب طيلةَ الفصل» — وبوّابةٌ تُطبَّق في الشاشة
       وحدَها ليست بوّابة: الرابطُ يصل الجهازَ فيُقرأ من أدوات المتصفّح، أو
       من نداءٍ مباشر. فالحجبُ هنا — في الإسقاط الذي يبني ما يُرسَل.

       والفارغُ لا يحجب: مصدرٌ بلا تاريخِ فتحٍ مفتوحٌ مع أوّل يوم. */
    resources: Array.isArray(c.resources)
      ? c.resources
          .filter((r) => resourceOpen(r, now))
          .map((r) => ({
            title: r.title,
            url: r.url,
            kind: resourceKind(r.kind),
            category: resourceCategory(r),
            opensAt: typeof r.opensAt === 'string' ? r.opensAt : null,
            noteAr: written(r.noteAr),
            bodyFileKey: written(r.bodyFileKey),
            bodyFileName: written(r.bodyFileName),
            bodyFileMime: written(r.bodyFileMime),
          }))
      : [],
  }
}
