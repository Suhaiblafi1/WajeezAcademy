/* ═══ ما يُفتح للمتعلّم على خطّ المحاور — يُقال له حين يُفتح (٢(ب-٣)) ═══

   صار لكلّ شيءٍ وقتُه (`cohort-gate.ts`): الكرّاسةُ والمتنُ أوّلَ يوم الموعد،
   والمهامُّ بعد أوّل لقاءٍ للمحور. وما يُفتح ولا يُقال لصاحبه يُكتشف صدفةً —
   أو لا يُكتشف: من لم يفتح رحلتَه يومَ فُتحت مهمّتُه عرف بها يومَ فات موعدُها.

   فثلاثةُ أخبار، ولكلٍّ لحظتُه من الخطّ نفسِه لا من ساعةٍ ثانية:
   · **فُتح موعد** — لحظةَ `opensAt` للموعد: كرّاستُه ومتنُ محاوره.
   · **فُتحت مهامُّ محور** — لحظةَ `workOpensAt` للمحور، ولمحورٍ عليه مهمّةٌ منشورة.
   · **آخرُ موعد مهمّةٍ غدا** — لمهمّةٍ مفتوحةٍ آخرُ موعدها خلال يوم.

   ── ولمَ نافذةٌ خلفيّة ──

   الدورةُ تمرّ كلَّ ربع ساعة، والخبرُ يُحسب «وقع بين الأمس والآن». فلو غابت
   دورةٌ أو تأخّرت لم يسقط خبر، ولو نُشر هذا الملفُّ اليومَ لم يصل متعلّما
   خبرُ موعدٍ فُتح قبل شهر. وما لا يتكرّر حرسُه في الدورة لا هنا: مفتاحٌ لكلّ
   خبرٍ (`dedupe`) يُسأل عنه قبل الإرسال.

   ولا ساعةَ تُقرأ هنا: اللحظةُ تُمرَّر. */

import { assessmentOpensAt, type LearnerGate } from './cohort-gate'

/** كم يُنظر خلفا — يومٌ يسع أيَّ دورةٍ تأخّرت، ولا يُحيي خبرا قديما */
export const TIMELINE_LOOKBACK_MS = 24 * 60 * 60_000
/** «غدا» — ما آخرُ موعده خلال هذه المدّة */
export const DUE_SOON_MS = 24 * 60 * 60_000

export interface TimelineAssessment {
  id: string
  title: string
  moduleId: string | null
  dueAt: Date | null
}

export interface SlotOpened { kind: 'slot_opened'; dedupe: string; slotIndex: number; moduleIds: string[]; at: Date }
export interface TasksOpened { kind: 'tasks_opened'; dedupe: string; moduleId: string; assessmentIds: string[]; at: Date }
export interface DueSoon { kind: 'due_soon'; dedupe: string; assessmentId: string; dueAt: Date }
export type TimelineEvent = SlotOpened | TasksOpened | DueSoon

/** أخبارُ شعبةٍ في لحظة — `[]` لما لا خطَّ له، أو لشعبةٍ انتهت */
export function timelineEvents(input: {
  cohortId: string
  gate: LearnerGate
  assessments: readonly TimelineAssessment[]
  now: Date
}): TimelineEvent[] {
  const { gate, now } = input
  /* ما اعتُمد بلا مواعيدَ يمضي كما بدأ — لا أخبارَ خطٍّ لما لا خطَّ له.
     وبعد انتهاء الشعبة لا «فُتح» ولا «غدا»: لا تسليمَ يُنتظر. */
  if (!gate.timeline || gate.access !== 'open') return []
  const t = now.getTime()
  const justNow = (at: Date | null) => at !== null && at.getTime() <= t && at.getTime() > t - TIMELINE_LOOKBACK_MS
  const out: TimelineEvent[] = []

  for (const s of gate.timeline.slots) {
    if (justNow(s.opensAt)) {
      out.push({ kind: 'slot_opened', dedupe: `${input.cohortId}:slot:${s.startsOn}`, slotIndex: s.index, moduleIds: [...s.moduleIds], at: s.opensAt })
    }
  }

  const byModule = new Map<string, TimelineAssessment[]>()
  for (const a of input.assessments) {
    if (!a.moduleId || !gate.timeline.slotOf(a.moduleId)) continue
    byModule.set(a.moduleId, [...(byModule.get(a.moduleId) ?? []), a])
  }
  for (const [moduleId, list] of byModule) {
    const at = gate.timeline.workOpensAt(moduleId)
    if (justNow(at)) {
      out.push({ kind: 'tasks_opened', dedupe: `${input.cohortId}:tasks:${moduleId}`, moduleId, assessmentIds: list.map((a) => a.id), at: at! })
    }
  }

  for (const a of input.assessments) {
    if (!a.dueAt) continue
    const due = a.dueAt.getTime()
    if (due <= t || due > t + DUE_SOON_MS) continue
    /* مهمّةٌ لم تُفتح بعد لا يُقال عنها «غدا» — يُقال حين تُفتح */
    const opens = assessmentOpensAt(gate, a.moduleId)
    if (opens && opens.getTime() > t) continue
    out.push({ kind: 'due_soon', dedupe: `due:${a.id}`, assessmentId: a.id, dueAt: a.dueAt })
  }
  return out
}
