/* ═══ «تبدأ قريبا» — الشعبُ التي يُقرَّر فيها قبل أن تبدأ (٢٢ أكتوبر ٢٠٢٦) ═══

   سؤالُ صاحب المنصّة: «كيف أعلم أيّ الدورات قريبة وكم فيها تسجيل، لأقرّر إيقافَها وإبلاغَ المدرّب
   بأنّنا ألغيناها كي لا نتحمّل أيّ كلفة؟». واختار (ب): قائمةٌ بما يبدأ خلال أيّام، بتاريخ البدء،
   وبعدد المسجّلين، وبجانبها الإلغاء.

   والشرطُ واحدٌ هنا يقرؤه الخادمُ والشاشة: لم تبدأ (مسوّدةٌ أو مفتوحةٌ أو ممتلئة)، وأوّلُ لقاءٍ
   فيها بين الآن وبعد `days` يوما. وما مضى موعدُه ولم تنتقل حالتُه ليس «قريبا» — يُصلحه «زامن
   الحالات». و«أوّلُ لقاء» أوّلُ لقاءٍ غيرِ ملغى، أو بدايةُ مدّتها إن لم يُجدوَل لقاء. */

export const UPCOMING_STATUSES = ['draft', 'open', 'full'] as const

/** المدى الافتراضيّ — وما تختاره الشاشةُ أضيقُ منه أو مثلُه */
export const UPCOMING_MAX_DAYS = 60
export const UPCOMING_DAY_CHOICES = [7, 14, 30, 60] as const

const DAY = 86_400_000

export function isUpcoming(
  c: { status: string; firstAt: string | Date | null },
  now: Date,
  days: number = UPCOMING_MAX_DAYS,
): boolean {
  if (!(UPCOMING_STATUSES as readonly string[]).includes(c.status) || !c.firstAt) return false
  const at = new Date(c.firstAt).getTime()
  return at >= now.getTime() && at <= now.getTime() + days * DAY
}

/** كم يوما بقي على البدء — للعرض: «بعد 5 أيام» */
export function daysUntil(firstAt: string | Date, now: Date): number {
  return Math.max(0, Math.ceil((new Date(firstAt).getTime() - now.getTime()) / DAY))
}
