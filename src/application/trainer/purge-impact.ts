/* ═══ ما يقع بحذف المدرّب على شعبه — كما يُقال في حوار الحذف (٢٨ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «Warn, remove for all». والخادمُ يقرأ ما يقع (`TrainerApplicationService.purgeImpact`) ويفعله
   (`CohortService.clearSessionsOfDeletedTrainer`)، والحوارُ يعرضه (`src/components/admin/PurgeImpact.tsx`). وهنا سطرُه. */

import { countAr } from '../text/count-ar'

/** شعبةٌ فيها طلابٌ للمدرّب الذي يُحذف */
export interface ImpactCohort {
  id: string
  title: string
  /** من لم يترك — صاحبُ مقعدٍ أو منتظِرٌ في القائمة */
  learners: number
  /** ما يُرفع من لقاءاتها القادمة إن لم يبقَ فيها مدرّب */
  upcoming: number
  /** يبقى فيها مدرّبٌ غيرُه — فتبقى لقاءاتُها */
  keepsSessions: boolean
}

const STUDENT_FORMS = { one: 'طالب', two: 'طالبان', few: 'طلاب', many: 'طالبا' } as const
const SESSION_FORMS = { one: 'لقاء قادم', two: 'لقاءان قادمان', few: 'لقاءات قادمة', many: 'لقاء قادما' } as const

/** سطرُ الشعبة: طلابُها، وما يقع على لقاءاتها */
export function impactLineAr(c: ImpactCohort): string {
  const who = `«${c.title}» — ${countAr(c.learners, STUDENT_FORMS)}`
  if (c.keepsSessions) return `${who}، وفيها مدرّب غيره فتبقى لقاءاتها`
  return c.upcoming > 0 ? `${who}، ويرفع منها ${countAr(c.upcoming, SESSION_FORMS)}` : who
}
