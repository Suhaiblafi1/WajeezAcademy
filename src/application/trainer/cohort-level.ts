/* مستوى الشعبة — من أين يبدأ متعلّمُها وإلى أين يصل: مبتدئٌ ومتوسّطٌ ومتقدّم.

   ═══ القرار (٥–٦ أكتوبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: «سؤالٌ لكلّ شعبةٍ يسأل المدرّبَ عن مستوى هذه الدورة —
   من المبتدئين إلى المتقدّمين». ثمّ اختار من الخيارات المعروضة:

   · **مدًى لا مستوًى واحد** — مستوًى، أو مستويان متجاوران، أو الثلاثة:
     «من مبتدئ إلى متوسّط» شعبةٌ تبدأ من الصفر وتنتهي عند المتوسّط.
   · **إلزاميٌّ ما دامت الخطّةُ في يد المدرّب** — مسودّةً أو مردودةً بتعديلات.
     ومن أرسل موادَّه قبل القرار لا يُطالَب به («تجاهَل من أرسل»)، فإن رُدّت
     إليه خطّتُه صار شرطا كغيره («إن أرجعناها له فالتعديلُ واجب»).
   · **يراه المدرّبُ والمعتمِدُ وحدَهما** — لا يُعرض على المتعلّم بعد.

   والمستوى للشعبة لا للدورة: الدورةُ نفسُها تُدرَّس لمبتدئين في شعبةٍ ولمتقدّمين
   في أخرى، والمدرّبُ أعلمُ بمن يخاطب. ويُحفظ في محتوى الخطّة (`content.level`)
   مع الاسم والنبذة والمدّة — فيُعتمَد معها ويُردّ معها، بلا عمودٍ جديد.

   والقاعدةُ هنا محضةٌ يقرؤها الخادمُ (قائمةُ التجهيز) والشاشةُ (ما ينقص الخطوة)
   معا: رقمان يقولان الشيءَ نفسَه يفترقان، فيُقال للمدرّب «تمّ» ويُردّ إرسالُه. */

export const COHORT_LEVELS = ['beginner', 'intermediate', 'advanced'] as const
export type CohortLevel = (typeof COHORT_LEVELS)[number]

/** مدى الشعبة — طرفاه مرتّبان دائما: `from` لا يتجاوز `to` */
export interface LevelRange { from: CohortLevel; to: CohortLevel }

export const COHORT_LEVEL_AR: Record<CohortLevel, { label: string; hint: string }> = {
  beginner: { label: 'مبتدئ', hint: 'يبدأ من الصفر — لا يُفترض أنّه يعرف شيئا عن الموضوع.' },
  intermediate: { label: 'متوسّط', hint: 'عرف الأساسيّات أو مارسها قليلا، ويريد أن يُتقنها.' },
  advanced: { label: 'متقدّم', hint: 'يمارسها في عمله، ويريد عمقا وحالاتٍ صعبة.' },
}

const rank = (lv: CohortLevel) => COHORT_LEVELS.indexOf(lv)
const isLevel = (v: unknown): v is CohortLevel =>
  typeof v === 'string' && (COHORT_LEVELS as readonly string[]).includes(v)

/** المدى إن كان صالحا، مرتَّبَ الطرفين — وما عداه (غائبٌ أو معطوبٌ أو مخترَع) `null` */
export function asLevelRange(v: unknown): LevelRange | null {
  if (!v || typeof v !== 'object') return null
  const { from, to } = v as { from?: unknown; to?: unknown }
  if (!isLevel(from) || !isLevel(to)) return null
  return rank(from) <= rank(to) ? { from, to } : { from: to, to: from }
}

/** المستوياتُ التي يشملها المدى، بترتيبها */
export function levelsIn(r: LevelRange | null): CohortLevel[] {
  if (!r) return []
  return COHORT_LEVELS.slice(rank(r.from), rank(r.to) + 1)
}

/* ═══ النقرُ على بطاقة — والمدى يبقى متّصلا ═══

   · بطاقةٌ خارجَ المدى تمدّه إليها، وما بينهما يدخل معها: «مبتدئ» ثمّ «متقدّم»
     تعني الثلاثة — فلا يُحفظ مدًى فيه ثغرة.
   · وطرفُ المدى يُنزع منه، والمستوى الوحيدُ يُنزع فلا يبقى شيء.
   · وأوسطُ الثلاثة يصير وحدَه: نزعُه يقطع المدى، والأقربُ إلى من نقره أنّه
     أراده هو. */
export function toggleLevel(r: LevelRange | null, lv: CohortLevel): LevelRange | null {
  if (!r) return { from: lv, to: lv }
  const i = rank(lv)
  const lo = rank(r.from)
  const hi = rank(r.to)
  if (i < lo) return { from: lv, to: r.to }
  if (i > hi) return { from: r.from, to: lv }
  if (lo === hi) return null
  if (i === lo) return { from: COHORT_LEVELS[lo + 1], to: r.to }
  if (i === hi) return { from: r.from, to: COHORT_LEVELS[hi - 1] }
  return { from: lv, to: lv }
}

/** «متوسّط» أو «من مبتدئ إلى متوسّط» — وبلا مدًى `null` */
export function levelRangeAr(r: LevelRange | null): string | null {
  if (!r) return null
  return r.from === r.to
    ? COHORT_LEVEL_AR[r.from].label
    : `من ${COHORT_LEVEL_AR[r.from].label} إلى ${COHORT_LEVEL_AR[r.to].label}`
}

/** أيُطالَب المدرّبُ بالمستوى؟ ما دامت الخطّةُ في يده — مسودّةً أو مردودة.
    والمرسَلةُ والمعتمَدةُ قبل القرار تمضي كما هي حتّى تُعدَّل. */
export const levelRequired = (planStatus: string): boolean =>
  planStatus === 'draft' || planStatus === 'changes_requested'

/** ما ينقص الخطوةَ الأولى من جهة المستوى — بلغة من يصحّحه، أو `null` */
export function levelProblem(content: { level?: unknown } | null | undefined, planStatus: string): string | null {
  if (!levelRequired(planStatus)) return null
  return asLevelRange(content?.level) ? null : 'اختر مستوى الشعبة — مستوًى واحدا، أو مستويين متجاورين'
}
