/* أيستحقّ المدرّبُ الصرفَ الآن؟ — سطرٌ على كلّ كشفٍ في شاشة الأتعاب (١٩ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «ندفع للمدرّب بعد أن ينتهي من تقديم الدورات … فيجب أن تكون هناك خاصّيّةٌ تقول
   لي إنّه انتهى من تقديم كافّة اللقاءات الحيّة على الأقلّ، أو انتهت الدورةُ كاملةً وأُغلقت — يستحقّ
   الدفعَ الآن». والكشفُ يظهر قبل أن يُدفع، وقد يُؤجَّل صرفُه.

   فيستحقّ إذا **انتهت لقاءاتُه الحيّةُ كلُّها** (المعتمدةُ غيرُ الملغاة، وكلُّها «انتهى») **أو أُغلقت
   شعبتُه** (`completed`). وما لا شعبةَ له — الكشفُ اليدويّ — لا يُحكم عليه: يُقال إنّه يدويّ.

   والسطرُ يُخبر ولا يمنع: القرارُ لصاحب المنصّة (قرارُه في ٢ أكتوبر: «لا إجبار، والفرقُ والخيارات»). */

export interface CohortForReadiness {
  title: string
  status: string
  sessions: { status: string; approvalState: string }[]
}

export interface PayReadiness {
  cohortTitle: string
  cohortClosed: boolean
  sessionsTotal: number
  sessionsDone: number
  sessionsLeft: number
  ready: boolean
}

export function payReadiness(c: CohortForReadiness): PayReadiness {
  const live = c.sessions.filter((s) => s.approvalState === 'approved' && s.status !== 'cancelled')
  const done = live.filter((s) => s.status === 'done').length
  const left = live.length - done
  const closed = c.status === 'completed'
  return {
    cohortTitle: c.title, cohortClosed: closed,
    sessionsTotal: live.length, sessionsDone: done, sessionsLeft: left,
    ready: closed || (live.length > 0 && left === 0),
  }
}

/** ما يُقال على الكشف — سطرٌ لكلّ شعبةٍ فيه، أو أنّه يدويّ */
export function payReadinessAr(r: PayReadiness): string {
  const name = `شعبة «${r.cohortTitle}»`
  if (r.sessionsTotal === 0) {
    return r.cohortClosed ? `يستحق الصرف الآن — أغلقت ${name}.` : `لم يحن الصرف — ${name} لم تغلق ولا لقاءات لها.`
  }
  if (r.sessionsLeft === 0) {
    return r.cohortClosed
      ? `يستحق الصرف الآن — انتهت لقاءاته الحية كلها (${r.sessionsDone} من ${r.sessionsTotal}) وأغلقت ${name}.`
      : `يستحق الصرف الآن — انتهت لقاءاته الحية كلها (${r.sessionsDone} من ${r.sessionsTotal})، و${name} لم تغلق بعد.`
  }
  return r.cohortClosed
    ? `يستحق الصرف — أغلقت ${name}، وبقي ${r.sessionsLeft} لقاء لم يسجل منتهيا.`
    : `لم يحن الصرف — بقي ${r.sessionsLeft} لقاء حي من ${r.sessionsTotal} في ${name}.`
}

export const MANUAL_PAYOUT_AR = 'كشف يدوي لا يرتبط بشعبة — تحقق من انتهاء عمله قبل الصرف.'

/** شعبُ الكشف من بنوده — `cohort:<id>` وما يتفرّع منه (`:referral` · `:floor`) */
export function cohortIdsOf(items: { sourceRef: string | null }[]): string[] {
  const ids = items
    .map((i) => /^cohort:([0-9a-f-]{36})(?::|$)/i.exec(i.sourceRef ?? '')?.[1])
    .filter((x): x is string => !!x)
  return [...new Set(ids)]
}
