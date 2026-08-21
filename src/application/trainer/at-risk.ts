/* إنذار المتعثرين (البند ف-٢) — أهم معلومة عند المدرب، ولم تكن معروضة إطلاقا.
   القاعدة الحاكمة: **نعرض الأسباب لا درجة**. «متعثر ٧٢٪» رقم لا يقود إلى فعل،
   أما «غاب ٣ جلسات ولم يسلّم واجبين» فيقود. ولا نصنّف أحدا متعثرا بلا سبب
   قابل للقراءة والتحقق.

   المصدر: /api/trainer/my-cohorts وحده — الحضور والتقدم والتسليمات كلها فيه. */

export type RiskReasonKind = 'absences' | 'behind_pace' | 'overdue' | 'no_activity'

export interface RiskReason {
  kind: RiskReasonKind
  /** نص السبب كما يُقرأ للمدرب — يذكر الرقم لا التصنيف */
  textAr: string
  /** القيمة المقيسة التي بنى عليها السبب — للشفافية والاختبار */
  value: number
}

export interface AtRiskLearner {
  enrollmentId: string
  nameAr: string
  email: string | null
  cohortId: string
  cohortTitleAr: string
  reasons: RiskReason[]
  /** ترتيب العرض: عدد الأسباب ثم أشدّها — لا «درجة خطر» تُعرض للمدرب */
  rank: number
}

/** حدود مُعلنة — تُعرض للمدرب في الواجهة كي يعرف ما يعنيه «متعثر» */
export const ABSENCE_THRESHOLD = 2
/** التأخر عن الوتيرة: فرق نقاط مئوية بين التقدم المتوقع والفعلي */
export const PACE_GAP_POINTS = 25
/** أدنى عدد جلسات منتهية قبل الحكم على الوتيرة — لا حكم على شعبة لم تبدأ */
export const MIN_SESSIONS_FOR_PACE = 2

export interface ARSession { id: string; startsAt: string; endsAt?: string | null; status: string }
export interface ARAttendance { sessionId: string; status: string }
export interface ARAssessment {
  id: string
  title: string
  dueAt?: string | null
  status?: string
  submissions?: { enrollmentId: string; status: string }[] | null
}
export interface AREnrollment {
  id: string
  status: string
  courseProgress?: { percent?: number } | null
  attendance?: ARAttendance[] | null
  user?: { displayName?: string; email?: string } | null
}
export interface ARCohort {
  id: string
  title: string
  sessions?: ARSession[] | null
  enrollments?: AREnrollment[] | null
  assessments?: ARAssessment[] | null
}

/** الجلسات المنتهية فعلا حتى الآن */
function sessionsDone(sessions: ARSession[], now: number): ARSession[] {
  return sessions.filter((s) => {
    if (s.status === 'cancelled') return false
    const start = new Date(s.startsAt).getTime()
    if (!Number.isFinite(start)) return false
    const end = s.endsAt ? new Date(s.endsAt).getTime() : start + 2 * 3600_000
    return now > end
  })
}

/**
 * يرصد المتعثرين بأسباب مقروءة.
 * @param rows رد /api/trainer/my-cohorts
 * @param now الوقت الآن بالمللي — صريح كي يكون الاشتقاق نقيا
 */
export function findAtRisk(rows: unknown, now: number): AtRiskLearner[] {
  const out: AtRiskLearner[] = []
  const cohorts: ARCohort[] = Array.isArray(rows)
    ? (rows as { cohort?: ARCohort | null }[]).map((r) => r?.cohort).filter((c): c is ARCohort => Boolean(c && c.id))
    : []

  for (const c of cohorts) {
    const sessions = c.sessions ?? []
    const done = sessionsDone(sessions, now)
    const enrollments = (c.enrollments ?? []).filter((e) => e.status !== 'dropped' && e.status !== 'waitlisted')

    /* التقييمات المستحقة فعلا */
    const dueAssessments = (c.assessments ?? []).filter((a) => {
      if (a.status && a.status !== 'published') return false
      if (!a.dueAt) return false
      const due = new Date(a.dueAt).getTime()
      return Number.isFinite(due) && due <= now
    })

    for (const e of enrollments) {
      const reasons: RiskReason[] = []
      const attendance = e.attendance ?? []
      const absences = attendance.filter((a) => a.status === 'absent').length
      const percent = typeof e.courseProgress?.percent === 'number' ? e.courseProgress.percent : 0

      if (absences >= ABSENCE_THRESHOLD) {
        reasons.push({ kind: 'absences', textAr: `غاب ${absences} ${absences === 1 ? 'جلسة' : 'جلسات'}`, value: absences })
      }

      /* التأخر عن الوتيرة — لا يُحكم إلا بعد جلستين منتهيتين على الأقل */
      if (done.length >= MIN_SESSIONS_FOR_PACE && sessions.length > 0) {
        const expected = Math.round((done.length / sessions.length) * 100)
        const gap = expected - percent
        if (gap >= PACE_GAP_POINTS) {
          reasons.push({
            kind: 'behind_pace',
            textAr: `تقدمه ${percent}٪ والمتوقع ${expected}٪ عند هذه الجلسة`,
            value: gap,
          })
        }
      }

      const missed = dueAssessments.filter(
        (a) => !(a.submissions ?? []).some((s) => s.enrollmentId === e.id),
      )
      if (missed.length > 0) {
        reasons.push({
          kind: 'overdue',
          textAr: `لم يسلّم ${missed.length === 1 ? `«${missed[0].title}»` : `${missed.length} تقييمات مستحقة`}`,
          value: missed.length,
        })
      }

      /* لا أثر إطلاقا مع وجود جلسات منتهية — أخطر الحالات وأخفاها */
      if (done.length >= MIN_SESSIONS_FOR_PACE && attendance.length === 0 && percent === 0) {
        reasons.push({ kind: 'no_activity', textAr: 'لا حضور ولا تسليم بعد بدء الشعبة', value: done.length })
      }

      if (reasons.length === 0) continue
      out.push({
        enrollmentId: e.id,
        nameAr: e.user?.displayName?.trim() || 'متعلم بلا اسم معروض',
        email: e.user?.email ?? null,
        cohortId: c.id,
        cohortTitleAr: c.title,
        reasons,
        rank: reasons.length * 100 + reasons.reduce((s, r) => s + Math.min(50, r.value), 0),
      })
    }
  }

  return out.sort((a, b) => b.rank - a.rank || a.nameAr.localeCompare(b.nameAr, 'ar'))
}

/** جملة تشرح للمدرب ما يعنيه «متعثر» — تُعرض دائما بجانب القائمة، لا تُخفى */
export const RISK_RULE_AR =
  `يُرصد المتعثر بأسباب مقيسة لا بدرجة: غياب ${ABSENCE_THRESHOLD} جلسات أو أكثر · ` +
  `تأخر ${PACE_GAP_POINTS} نقطة أو أكثر عن الوتيرة المتوقعة عند الجلسة الحالية · ` +
  `تقييم مستحق بلا تسليم · أو لا حضور ولا تسليم بعد ${MIN_SESSIONS_FOR_PACE} جلسات.`
