/* ═══ استبدالُ دورةٍ في المسار الجاهز — وأوّلُها التي تتعارض (٣١ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «امنحه حقَّ استبدال دورةٍ من المسار الجاهز الذي يختاره، وخاصّةً للدورات التي تتعارض».
   كان الاستبدالُ لمن اعتمد خطّةً من التشخيص وحدَه، والمسارُ الجاهزُ يُشترى كما هو — فإن تعارضت دورتان منه ولا
   موعدَ آخرَ لإحداهما بقي أمامه أن يدفع لما لا يحضره، أو يترك المسار.

   · **يستبدل ولا يحذف**: العددُ ثابت، فخصمُ المسار باقٍ (`pathwayOffer` بعدد الدورات).
   · **وما شاء من دوراته** — سُئل صاحبُ المنصّة: دورةٌ واحدةٌ كـ«أضف دورة»، أم أيُّ عدد؟ فقال: «Any».
   · **والبدائلُ ما يُشترى الآن**: دورةٌ لها شعبةٌ تُلتحق — في فصل المسار إن سمّاه (`startTermKey`) — خارج المسار.
   · **وما لا يتعارض أوّلا**: شعبةٌ لقاءاتُها لا تقع على لقاءات ما بقي في المسار، ثمّ ما لم يُعلن جدولُه بعد، ثمّ
     ما يتعارض بسببه. والقرارُ له («لا إجبار»): المتعارضُ يُعرض بسببه ولا يُخفى.
   · **والشعبةُ التي لا تتعارض تُختار معه** — فلا يستبدل دورةً ليجد البديلةَ على أقرب شعبةٍ تتعارض.
   · **والدورةُ العالقةُ** — شعبتُها المختارةُ تتعارض ولا شعبةَ لها لا تتعارض — يُدلّ فيها على الاستبدال. */

import { clashesOf, freeAlternative, type TimedCohort, type TimedSession } from '../learning/cohort-overlap'
import { startTermKey } from '../terms/start-term'

/** شعبةٌ كما يقرؤها الاستبدال — من `useCourseCohorts` */
export interface SwapCohortOption {
  id: string
  startsAt: string | null
  sessions: readonly TimedSession[]
}

/** مقترحٌ مرتّبٌ مع سببه — من `pathwayExtraOptions` */
export interface RankedCourse {
  courseId: string
  reason_ar: string
}

/** بديلٌ يُعرض: الدورةُ، وشعبتُها التي تُختار معها، وحالُها مع ما بقي */
export interface SwapCandidate {
  courseId: string
  cohortId: string
  reasonAr: string
  fit: 'free' | 'unknown' | 'clash'
  /** سطرٌ تحت اسمها: لماذا هي، ومع الجدول */
  noteAr: string
}

/** كم بديلا يُعرض — من يستبدل يبحث عن واحد، والقائمةُ الطويلةُ تؤجّل القرار */
export const SWAP_CHOICES = 4

/** شعبةُ كلّ دورةٍ في المسار — المختارةُ، أو أولى شعبها وهي ما يشتريه إن لم يبدّل */
export function chosenCohorts(
  courseIds: readonly string[],
  cohortsOf: (courseId: string) => readonly SwapCohortOption[],
  picked: Readonly<Record<string, string>>,
  titleOf: (courseId: string) => string,
): TimedCohort[] {
  return courseIds.flatMap((courseId) => {
    const options = cohortsOf(courseId)
    const opt = options.find((x) => x.id === picked[courseId]) ?? options[0]
    return opt ? [{ cohortId: opt.id, courseId, titleAr: titleOf(courseId), sessions: opt.sessions }] : []
  })
}

const timed = (courseId: string, o: SwapCohortOption): TimedCohort =>
  ({ cohortId: o.id, courseId, titleAr: '', sessions: o.sessions })

/** أعالقةٌ هذه الدورة؟ شعبتُها المختارةُ تتعارض مع ما معها، ولا شعبةَ لها لا تتعارض */
export function stuckInClash(
  courseId: string,
  chosen: readonly TimedCohort[],
  cohortsOf: (courseId: string) => readonly SwapCohortOption[],
): boolean {
  const mine = chosen.find((c) => c.courseId === courseId)
  if (!mine) return false
  const others = chosen.filter((c) => c.courseId !== courseId)
  if (clashesOf(mine, others).length === 0) return false
  return freeAlternative(cohortsOf(courseId).map((o) => timed(courseId, o)), others) === null
}

/** بدائلُ دورةٍ في المسار — ما يُشترى الآن خارجه، وما لا يتعارض أوّلا */
export function swapCandidates(input: {
  /** الدورةُ التي تُستبدل */
  courseId: string
  /** دوراتُ المسار الآن — بما فيها التي تُستبدل */
  courseIds: readonly string[]
  /** المرشّحون بترتيب قربهم من المسار */
  ranked: readonly RankedCourse[]
  cohortsOf: (courseId: string) => readonly SwapCohortOption[]
  picked: Readonly<Record<string, string>>
  titleOf: (courseId: string) => string
  /** فصلُ المسار — «2026-nov_jan» — و`null` لمسارٍ لا يسمّي فصلا */
  season: string | null
  limit?: number
}): SwapCandidate[] {
  const { courseId, courseIds, ranked, cohortsOf, picked, titleOf, season, limit = SWAP_CHOICES } = input
  const taken = new Set(courseIds)
  const others = chosenCohorts(courseIds.filter((id) => id !== courseId), cohortsOf, picked, titleOf)
  const inSeason = (o: SwapCohortOption) => !season || (o.startsAt !== null && startTermKey(o.startsAt) === season)

  const out: SwapCandidate[] = []
  for (const r of ranked) {
    if (taken.has(r.courseId) || r.courseId === courseId || out.some((x) => x.courseId === r.courseId)) continue
    const options = cohortsOf(r.courseId).filter(inSeason)
    if (options.length === 0) continue
    const free = freeAlternative(options.map((o) => timed(r.courseId, o)), others)
    if (free) {
      out.push({ courseId: r.courseId, cohortId: free.cohortId, reasonAr: r.reason_ar, fit: 'free', noteAr: `${r.reason_ar} · لا تتعارض مع دوراتك` })
      continue
    }
    const unknown = options.find((o) => o.sessions.length === 0)
    if (unknown) {
      out.push({ courseId: r.courseId, cohortId: unknown.id, reasonAr: r.reason_ar, fit: 'unknown', noteAr: `${r.reason_ar} · مواعيد لقاءاتها لم تعلن بعد` })
      continue
    }
    const hit = clashesOf(timed(r.courseId, options[0]), others)[0]
    out.push({
      courseId: r.courseId, cohortId: options[0].id, reasonAr: r.reason_ar, fit: 'clash',
      noteAr: `${r.reason_ar} · تتعارض مع «${hit?.with.titleAr ?? 'دورة في مسارك'}»`,
    })
  }
  const order = { free: 0, unknown: 1, clash: 2 } as const
  return out
    .map((c, i) => ({ c, i }))
    .sort((a, b) => order[a.c.fit] - order[b.c.fit] || a.i - b.i)
    .map((x) => x.c)
    .slice(0, limit)
}

/* ═══ ومن خرج قبل الدفع وعاد يجد ما استبدله (٣١ أكتوبر ٢٠٢٦) ═══
   الشراءُ المحفوظُ (`pending-checkout.ts`) يحمل الدوراتِ كما اختارها، والصفحةُ كانت تعود بدورات المسار الأولى:
   فيرى غيرَ ما يدفع له. فتُقرأ القائمةُ المحفوظة إلى قسميها — دوراتُ المسار بعد الاستبدال، والإضافةُ الواحدةُ
   فوقها (`extraId`) وهي آخرُها. وما لا يطابق العدد (حُذف من المسار شيءٌ بعد الحفظ مثلا) لا يُستعاد. */

/** القائمةُ المحفوظةُ إلى دورات المسار والإضافة — أو `null` إن لم تطابق عددَ المسار */
export function restoredSwaps(saved: readonly string[], pathwaySize: number): { base: string[]; extra: string | null } | null {
  if (pathwaySize <= 0 || new Set(saved).size !== saved.length) return null
  if (saved.length === pathwaySize) return { base: [...saved], extra: null }
  if (saved.length === pathwaySize + 1) return { base: saved.slice(0, pathwaySize), extra: saved[pathwaySize] }
  return null
}
