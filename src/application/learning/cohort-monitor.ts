/* ═══ «المتابعة» — الإدارةُ تطّلع على ما يجري في الشعبة ولا تديره (٢٢ أكتوبر ٢٠٢٦) ═══

   قولُ صاحب المنصّة: «لماذا صفحةُ الشعبة فيها تفاصيلُ كثيرةٌ لن أستخدمها مثل اللقاءات، وهي يضعها
   المدرّبُ لا نحن… نحن يجب أن يكون لنا وصولٌ لمجريات العمل لديه كتقارير: من حضر ومن سلّم ومشاريعُ
   التخرّج والباقي تلقائيّ، ورسائلُه للطلاب — وكأنّنا مراقبون لكلّ مجريات الشعبة ومطّلعون على
   تفاصيلها بطريقةٍ واضحةٍ غير مزدحمة».

   فالتقريرُ يُقرأ ولا يُكتب فيه. وما ينبّه إليه هنا — لا ما يُعرض فقط — هو ما يستدعي يدَ الإدارة:
   لقاءٌ مضى بلا حضورٍ مسجَّل، وتسليمٌ ينتظر التصحيحَ طويلا، ومتعلّمٌ يغيب، ومدرّبٌ صامت. والعتباتُ
   ثوابتُ بأسمائها لا أرقامٌ مبثوثة. */

export const REVIEW_LATE_DAYS = 7
export const TRAINER_SILENT_DAYS = 14
/** يُحكَم على الغياب بعد لقاءين على الأقلّ — لقاءٌ واحدٌ فاتَ لا يصنع نمطا */
export const ABSENCE_MIN_HELD = 2
export const ABSENCE_PCT = 50

const DAY = 86_400_000

export interface MonitorAlertInput {
  status: string
  now: Date
  /** لقاءاتٌ مضت — وهل سُجّل حضورُها */
  pastSessions: { startsAt: Date; marked: boolean }[]
  /** أقدمُ ما ينتظر التصحيح في كلّ مهمّة */
  waitingSince: Date[]
  learners: { held: number; attendancePct: number | null }[]
  lastTrainerMessageAt: Date | null
  /** متى بدأت فعلا — أوّلُ لقاءٍ مضى */
  startedAt: Date | null
}

/** ما يستدعي يدَ الإدارة — جملٌ قصيرةٌ تُعرض بأعلى «المتابعة» */
export function monitorAlerts(i: MonitorAlertInput): string[] {
  const out: string[] = []
  const now = i.now.getTime()
  const unmarked = i.pastSessions.filter((s) => !s.marked && now - s.startsAt.getTime() > DAY).length
  if (unmarked > 0) out.push(unmarked === 1 ? 'لقاء مضى بلا حضور مسجل' : `${unmarked} لقاءات مضت بلا حضور مسجل`)

  const late = i.waitingSince.filter((d) => now - d.getTime() > REVIEW_LATE_DAYS * DAY).length
  if (late > 0) out.push(`${late} ${late === 1 ? 'تسليم ينتظر' : 'تسليمات تنتظر'} التصحيح منذ أكثر من ${REVIEW_LATE_DAYS} أيام`)

  const absent = i.learners.filter((l) => l.held >= ABSENCE_MIN_HELD && l.attendancePct !== null && l.attendancePct < ABSENCE_PCT).length
  if (absent > 0) out.push(`${absent} ${absent === 1 ? 'متعلم حضوره' : 'متعلمين حضورهم'} أقل من النصف`)

  if (i.status === 'active' && i.startedAt && now - i.startedAt.getTime() > TRAINER_SILENT_DAYS * DAY) {
    const last = i.lastTrainerMessageAt?.getTime() ?? 0
    if (now - last > TRAINER_SILENT_DAYS * DAY) out.push(`لم يراسل المدرب طلبته منذ أكثر من ${TRAINER_SILENT_DAYS} يوما`)
  }
  return out
}

/** نسبةُ الحضور — `null` قبل أن يُسجَّل لقاء، لا صفر: «٠٪» تُقرأ غيابا وهي غيابُ بيانات */
export function attendancePct(attended: number, marked: number): number | null {
  return marked === 0 ? null : Math.round((attended / marked) * 100)
}

export const AUDIENCE_AR: Record<string, string> = {
  cohort: 'للشعبة كلها',
  learner: 'لمتعلم',
  advisors: 'للمستشارين',
}
