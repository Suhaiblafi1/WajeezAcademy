/* ═══ أين تُرى الشعبة: «شعبي» للحاليّة، و«دوراتي» لما يُعدّ (٢٠ أكتوبر ٢٠٢٦) ═══

   اقتراحُ صاحب المنصّة: «أن يكون داخل شعبي فقط الشعب الحاليّة المعتمدة، وصفحة دوراتي فيها كلّ الدورات
   ليوافق عليها ويرفضها أو يؤجّلها، وتظهر كلّ دورة بحالتها هناك، وتبقى صفحة شعبي نظيفة لما هو حالي».

     · **حاليّة** (`current`): مفتوحةٌ أو ممتلئةٌ أو جارية — أو اعتُمدت خطّتُها مرّةً وتنتظر فتحَها. وما يُراجَع
       من خطّةٍ اعتُمدت يبقى هنا: الشعبةُ قائمة، والمراجعةُ حالٌ فيها.
     · **منتهية** (`finished`): تُطوى في ذيل «شعبي» — لا تُنسى ولا تزاحم.
     · **تُعدّ** (`courses`): ما لم تُعتمد خطّتُه قطّ — في التجهيز أو أُرسلت أو رُدّت أو أُجّلت. تُرى في
       «دوراتي» تحت دورتها، ومنها تُجهَّز وتُؤجَّل.
     · **للفصول القادمة** (`later`): ما لم يبدأ وفصلُه بعد الفصل الذي نعمل له — أُجّل إليه أو نُقل أو خُطّط له.

   والملغاةُ لا تصل أيّا منهما (`summaries`).

   ═══ والمؤجَّلةُ إلى فصلٍ بعيدٍ تخرج من «شعبي» (٢١ أكتوبر ٢٠٢٦) ═══

   بلاغُ صاحب المنصّة: أجّل شعبتين لمدرّبة، فظهر التأجيلُ في الموقع وبقيتا في «شعبي» بين شعب هذا الفصل بلا
   كلمةٍ تقول إنّهما أُجّلتا — فالمعتمدةُ حاليّةٌ أينما وقع فصلُها. فاختار: «إلى دوراتي بقسمٍ منفصل يقول دورات
   الفصول القادمة». والقسمةُ بالفصل لا بفعل التأجيل: من نقلها — هو أو المدرّب — ومن أجّل خطّتها سواء، وما
   خُطّط له بعيدا من أوّله كذلك. والفصلُ الذي نعمل له هو الذي يلي الجاري (`workingTerm`)؛ فحين يبدأ يصير
   الذي بعده هو المعمولَ له، فتعود شعبُه إلى «شعبي» وحدَها بلا فعلٍ من أحد.

   وفصلُ الشعبة من صفّ فصلها أوّلا (`term`) — فالتأجيلُ قبل الاعتماد يربطها بفصلها الجديد ولا يمسّ مواعيدَ
   خطّتها (`postpone`) — ثمّ من أوّل لقائها، ثمّ من بدئها المقترح. */

import { termBounds, termOf } from '../terms/season'
import { nextTerm, type TermRef } from './cohort-move'
import { TRAINING_SEASON_VALUES } from './application-options'

export type BoardPlace = 'current' | 'finished' | 'courses' | 'later'

const LIVE = new Set(['open', 'full', 'active'])
/** ما لم يبدأ — وحدَه يُرحَّل إلى الفصول القادمة؛ والجاريةُ حاليّةٌ أينما وقع فصلُها */
const NOT_STARTED = new Set(['draft', 'open', 'full'])

export interface PlacedCohort {
  status: string
  approvedOnce?: boolean | null
  term?: { year: number; season: string } | null
  startsAt?: string | Date | null
  proposedStartsOn?: string | null
}

/** الفصلُ الذي نعمل له: الذي يلي الجاري */
export const workingTerm = (now: Date): TermRef => nextTerm(termOf(now))

const isTermRef = (t: { year: number; season: string }): t is TermRef =>
  (TRAINING_SEASON_VALUES as readonly string[]).includes(t.season)

/** فصلُ الشعبة — صفُّ فصلها، ثمّ أوّلُ لقائها، ثمّ بدؤها المقترح — أو `null` حين لا شيء منها */
export function cohortTerm(c: PlacedCohort): TermRef | null {
  if (c.term && isTermRef(c.term)) return { year: c.term.year, season: c.term.season }
  const at = c.startsAt ? new Date(c.startsAt) : c.proposedStartsOn ? new Date(`${c.proposedStartsOn}T12:00:00Z`) : null
  return at && !Number.isNaN(at.getTime()) ? termOf(at) : null
}

const startOf = (t: TermRef) => termBounds(t.year, t.season).startsOn.getTime()

/** أفصلُها بعد الفصل الذي نعمل له؟ — وما بدأ لا */
export function inLaterTerm(c: PlacedCohort, now: Date): boolean {
  if (!NOT_STARTED.has(c.status)) return false
  const t = cohortTerm(c)
  return t !== null && startOf(t) > startOf(workingTerm(now))
}

export function boardPlace(c: PlacedCohort, now: Date = new Date()): BoardPlace {
  if (c.status === 'completed') return 'finished'
  if (inLaterTerm(c, now)) return 'later'
  if (LIVE.has(c.status) || c.approvedOnce) return 'current'
  return 'courses'
}
