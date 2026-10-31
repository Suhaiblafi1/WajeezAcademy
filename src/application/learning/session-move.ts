/* ═══ لقاءٌ تغيّر موعدُه — من طلبه ولماذا، يُقال لكلٍّ بلغته (٢٨ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «if I change the timing of the sessions from the trainer side or from my side or
   automatic from clashes … they should receive an email, everyone … and tell them the reason why have we
   changed it, based on who receives this email, whether a student or a trainer. Trainer would receive that
   based on your request or based on the clashes … We have changed the session time from X to Y, and we should
   write the reason. These reasons that the student would read must be written by who has asked for the change».
   وخُيّر بين رسالةٍ واحدةٍ يتحرّك بها الموعدُ نفسُه في التقويم، ورسالتين (رفعٌ ثمّ دعوةٌ جديدة)، فاختار الأولى:
   «One email, entry moves».

   فالسببُ بقلم من طلب النقل، لا نصٌّ نكتبه نحن عنه:
   · **المدرّبُ** — يكتبه حين ينقل لقاءه المعتمَد (لا يُنقل بدونه)، أو في طلب نقل شعبته.
   · **والإدارةُ** — في بطاقة «قبل/بعد» يقبلها المدرّب (وموعدُ «بلا تعارض» منها)، وفي اقتراح التأجيل، وفي
     نقلها الشعبةَ بنفسها.
   ويقرؤه المتعلّمون والعنوانان كما كُتب ومعه من كتبه، والمدرّبُ يُقال له أكان بطلبه أم بطلب الإدارة.
   والرسالةُ التي تحمله في `server/services/calendar/session-invite.ts` (`moved`). */

import { CLASH_REASON_PREFIX } from '../terms/schedule-clash'
import { PROPOSAL_TAIL_AR } from '../trainer/schedule-proposal'

/** من طلب النقل */
export type MoveOrigin =
  /** المدرّبُ بنفسه — نقل لقاءه، أو طلب نقل شعبته فاعتمدته الإدارة */
  | 'trainer'
  /** الإدارةُ فقبله المدرّب — بطاقةٌ (ومنها موعدٌ بلا تعارض)، أو اقتراحُ تأجيل */
  | 'accepted'
  /** الإدارةُ بنفسها — نقلت الشعبة */
  | 'staff'

/** ما يُقال مع الموعد الجديد: للمتعلّمين والعنوانين، وللمدرّب */
export interface MoveWhy {
  learnerAr: string
  trainerAr: string
}

/** أقصرُ سببٍ يكتبه المدرّبُ لنقل لقائه — كأقصر سببٍ لنقل الشعبة */
export const MOVE_WHY_MIN = 3
/** وأطولُه — يُقرأ في بريدٍ وجرس */
export const MOVE_WHY_MAX = 500

/** جملةٌ تامّة تُختم بنقطة — فيُلحق بها ما بعدها («ويراجع موعده الجديد…») ولا يلتصق بها */
function sentence(s: string): string {
  const t = s.trim()
  return /[.!؟]$/.test(t) ? t : `${t}.`
}

/** سببُ الإدارة كما يُقرأ بعد أن وقع: بلا ذيل الاقتراح («— نقترح …»)، و«موعدها الآن يتعارض» صار «كان موعدها يتعارض» */
export function doneWhyAr(reasonAr: string): string {
  const cut = reasonAr.indexOf(PROPOSAL_TAIL_AR)
  const why = (cut > 0 ? reasonAr.slice(0, cut) : reasonAr).trim()
  return why.startsWith(CLASH_REASON_PREFIX) ? `كان موعدها يتعارض${why.slice(CLASH_REASON_PREFIX.length)}` : why
}

/** من طلب ولماذا — لكلٍّ بلغته */
export function moveWhy(origin: MoveOrigin, reasonAr: string): MoveWhy {
  const r = reasonAr.trim()
  if (origin === 'trainer') {
    /* بين علامتَي التنصيص كما كتبه — بلا نقطةٍ في آخره تلي النقطةَ بعده */
    const q = r.replace(/[.،]+$/u, '')
    return { learnerAr: `نقله مدرّبك، وكتب: «${q}».`, trainerAr: `نقلته بطلبك، وكتبت لطلابك: «${q}».` }
  }
  const why = sentence(doneWhyAr(r))
  return {
    learnerAr: `نقلته إدارة الأكاديمية: ${why}`,
    trainerAr: origin === 'accepted' ? `نقل بطلب الإدارة وقبلته: ${why}` : `نقلته الإدارة: ${why}`,
  }
}

/** وجدولٌ سقط نصفُه فعاد ما نُقل منه إلى موعده (`PlanEditService.applySchedule`) — لا سببَ نقلٍ يُنسب إلى أحد */
export const MOVE_UNDONE: MoveWhy = {
  learnerAr: 'تعذّر نقل جدول الشعبة كاملا، فعاد هذا اللقاء إلى موعده.',
  trainerAr: 'تعذّر نقل الجدول كاملا، فعاد هذا اللقاء إلى موعده.',
}

/* ═══ ونقلٌ عاد ينتظر الإدارة ثمّ اعتمدته (٣١ أكتوبر ٢٠٢٦) ═══
   رُفع من تقاويمهم ساعةَ نُقل بسببه، ويُحفظ معه موعدُه قبل النقل وسببُه (`CohortSession.movedFromAt` و`moveWhy`).
   فحين يُعتمد تقول دعوتُه «كان … وصار …» وسببَه كما كُتب، ومعه أنّه اعتُمد — لا دعوةً جديدةً كأنّه لم يكن. */

/** سببُ النقل كما حُفظ على اللقاء — وما لا يُقرأ منه لا يُختلَق */
export function readMoveWhy(json: unknown): MoveWhy | null {
  const w = json as Partial<MoveWhy> | null
  return w && typeof w.learnerAr === 'string' && typeof w.trainerAr === 'string' && w.learnerAr && w.trainerAr
    ? { learnerAr: w.learnerAr, trainerAr: w.trainerAr }
    : null
}

/** وسببُه حين تعتمده الإدارة — كما كُتب، ومعه أنّه اعتُمد */
export function approvedMoveWhy(why: MoveWhy): MoveWhy {
  return { learnerAr: `${why.learnerAr} واعتمدته الإدارة.`, trainerAr: `${why.trainerAr} واعتمدته الإدارة.` }
}
