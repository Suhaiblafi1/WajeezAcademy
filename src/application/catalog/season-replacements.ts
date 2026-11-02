/* ═══ دورةٌ في نتيجة التشخيص لا شعبةَ لها هذا الموسم — بديلان لتختار منهما (٢ نوفمبر ٢٠٢٦) ═══

   كان قرارُ ٢١ أكتوبر: «ما يُشترى أوّلا، والباقي "لم تفتح شعبتُه بعد"». ثمّ رأى صاحبُ المنصّة أنّ أكثرَ ما يرشّحه
   التشخيصُ لا شعبةَ له (خمسةَ عشرَ مسارا من سبعةٍ وعشرين بلا دورةٍ واحدةٍ تُشترى)، فخُيّر واختار «C»: تبقى النتيجةُ
   كما رشّحها المحرّك، و«قل بوضوح إنّ هذه الدورة غير متاحة هذا الموسم، فنقترح هذين لتختار منهما بديلا». ومعها
   تحت الخطّة أقربُ مسارٍ جاهزٍ لهذا الموسم (`closestReadyPathway`).

   · **البديلان ممّا يُشترى هذا الموسم** (`availableThisSeason`)، وخارج الخطّة.
   · **والأقربُ إلى الدورة نفسِها**: من مسارها، ثمّ من مجالها، ثمّ بما تشاركه من مهارات، ثمّ بما يسدّ فجوةً قاسها
     التشخيص، ثمّ من فئتها. والتعادلُ بترتيب الكتالوج.
   · **ولا يتكرّر بديلٌ بين دورتين** ما وُجد غيرُه — فلا تُعرض الدورةُ نفسُها بديلا لكلّ دورة. */

/** الدورةُ كما يقرؤها الاقتراح — من `data/courses` */
export interface ReplaceableCourse {
  id: string
  pathwayId: string
  category: string
  skill: string
  skills: readonly string[]
}

/** كم بديلا لكلّ دورة */
export const REPLACEMENTS_PER_COURSE = 2

/** قربُ المرشَّح من الدورة — والأكبرُ أقرب */
function closeness(
  c: ReplaceableCourse,
  of: ReplaceableCourse,
  domainOf: (pathwayId: string) => string,
  gaps: readonly string[],
): number {
  const shared = c.skills.filter((x) => of.skills.includes(x)).length
  const closesGap = c.skill && gaps.some((g) => g.includes(c.skill.slice(0, 8))) ? 1 : 0
  return (c.pathwayId === of.pathwayId ? 8 : 0)
    + (domainOf(c.pathwayId) === domainOf(of.pathwayId) ? 4 : 0)
    + Math.min(shared, 3)
    + closesGap
    + (c.category === of.category ? 1 : 0)
}

/** لكلّ دورةٍ في الخطّة لا تُشترى هذا الموسم: بديلان يُشتريان — بترتيب قربهما */
export function seasonReplacements(input: {
  planIds: readonly string[]
  catalog: readonly ReplaceableCourse[]
  /** أتُشترى هذا الموسم؟ — و`null` حين لا يُعرف: لا يُقال عن شيءٍ إنّه غير متاح */
  available: (courseId: string) => boolean | null
  domainOf: (pathwayId: string) => string
  gaps?: readonly string[]
  per?: number
}): Map<string, string[]> {
  const { planIds, catalog, available, domainOf, gaps = [], per = REPLACEMENTS_PER_COURSE } = input
  const plan = new Set(planIds)
  const byId = new Map(catalog.map((c) => [c.id, c]))
  const pool = catalog.filter((c) => !plan.has(c.id) && available(c.id) === true)
  const used = new Set<string>()
  const out = new Map<string, string[]>()
  for (const id of planIds) {
    const of = byId.get(id)
    if (!of || available(id) !== false) continue
    const ranked = pool
      .map((c, i) => ({ c, i, s: closeness(c, of, domainOf, gaps) }))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((x) => x.c.id)
    const fresh = ranked.filter((x) => !used.has(x))
    const picks = [...fresh, ...ranked.filter((x) => used.has(x))].slice(0, per)
    for (const x of picks) used.add(x)
    out.set(id, picks)
  }
  return out
}

/** أقربُ مسارٍ جاهزٍ معروضٍ إلى الخطّة — بما يشاركها من دورات، ثمّ بمجالها. و`null` حين لا قربَ أصلا */
export function closestReadyPathway<P extends { id: string; courseIds: readonly string[]; domain: string }>(
  planIds: readonly string[],
  shown: readonly P[],
  planDomains: readonly string[],
): P | null {
  const plan = new Set(planIds)
  let best: { p: P; s: number } | null = null
  for (const p of shown) {
    const s = p.courseIds.filter((id) => plan.has(id)).length * 3 + (planDomains.includes(p.domain) ? 2 : 0)
    if (s > 0 && (!best || s > best.s)) best = { p, s }
  }
  return best?.p ?? null
}
