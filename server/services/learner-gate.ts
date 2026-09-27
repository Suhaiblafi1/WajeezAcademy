/* ═══ بوّابةُ المتعلّم لشعبةٍ — تُقرأ من القاعدة مرّةً بشكلٍ واحد ═══

   القاعدةُ نفسُها محضةٌ في `src/application/learning/cohort-gate.ts`، وهنا
   ما تحتاجه من القاعدة: الخطّةُ المعتمَدةُ الأحدث، وتاريخا الشعبة، ولقاءاتُها
   التي يراها المتعلّم. ويقرؤها أربعة: محتوى الشعبة للمتعلّم، وتسليمُه،
   وملفّاتُ الشعبة، وتذكرةُ اللقاء. ولو قرأ كلٌّ منها الخطّةَ بشرطه لَحكم
   أحدُها بخطّةٍ غيرِ التي يرى بها المتعلّمُ شاشتَه. */

import type { PrismaClient } from '@prisma/client'
import { learnerGate, type LearnerGate } from '../../src/application/learning/cohort-gate'
import { PLAN_VISIBLE_STATUSES } from '../../src/application/trainer/plan-overlay'
import { LEARNER_SESSION_WHERE } from './session-visibility'

/** شرطُ الخطّة التي تصل المتعلّم — خطّةُ المدرّب المعتمَدة، أحدثُها */
export const LEARNER_PLAN_QUERY = {
  where: { trainerId: { not: null }, status: { in: [...PLAN_VISIBLE_STATUSES] } },
  orderBy: { createdAt: 'desc' as const },
  take: 1,
  select: { status: true, content: true },
}

export interface LoadedLearnerGate {
  plan: { status: string; content: unknown } | null
  gate: LearnerGate
}

/** البوّابةُ لشعبةٍ في لحظة — أو `null` حين لا شعبة */
export async function loadLearnerGate(prisma: PrismaClient, cohortId: string, now = new Date()): Promise<LoadedLearnerGate | null> {
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    select: {
      startsAt: true,
      endsAt: true,
      sessions: {
        where: LEARNER_SESSION_WHERE,
        select: { startsAt: true, endsAt: true, moduleId: true, moduleIds: true, placeholder: true, status: true },
      },
      plans: LEARNER_PLAN_QUERY,
    },
  })
  if (!cohort) return null
  const plan = cohort.plans[0] ?? null
  return { plan, gate: learnerGate({ content: plan?.content ?? null, cohort, sessions: cohort.sessions, now }) }
}
