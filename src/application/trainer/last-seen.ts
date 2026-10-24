/* ═══ متى دخل المدرّبُ منصّتَه آخرَ مرّة — من فعّالٌ ومن اختفى (٢٤ أكتوبر ٢٠٢٦) ═══

   قولُ صاحب المنصّة: «أعطني مؤشّرا لمتى آخرُ دخولٍ لكلّ مدرّبٍ لمنصّته، لأعلمَ من منهم فعّالٌ ومنهم
   اختفى».

   ── ولمَ «آخرُ نشاط» لا «آخرُ دخول» ──

   الجلسةُ تبقى ثلاثين يوما (`SESSION_TTL_DAYS`) ولا تتجدّد. فمدرّبٌ دخل مرّةً قبل خمسةٍ وعشرين يوما
   ويعمل كلَّ يومٍ كان يُقرأ «دخل قبل ٢٥ يوما» — وهو أنشطُهم. فصار لكلّ جلسةٍ `lastSeenAt` يُكتب حين
   تُستعمل (كلَّ خمس دقائقَ على الأكثر، `AuthService.resolve`).

   ── ولا الجلسةُ وحدَها (٢٤ أكتوبر ٢٠٢٦، بعد ساعاتٍ من النشر) ──

   العمودُ وُلد يومَ النشر، وما قبله مُلئ بوقت الدخول. فقال صاحبُ المنصّة: «غيرُ دقيقٍ نهائيّا.. هناك
   أشخاصٌ تواصلوا معنا من المنصّة وتقول إنّهم لم يفتحوا منذ مدّة». فصار المؤشّرُ أحدثَ أثرٍ تركه: جلسةً،
   أو فعلا في الأثر، أو تذكرةَ دعم، أو رسالةً لطلبته، أو قراءةً، أو نموذجَ تواصلٍ ببريده — من حسابه وحساب
   تقديمه معا (`server/services/last-activity.ts`).

   والعتبتان ثابتتان بأسمائهما: سبعةُ أيّامٍ أسبوعُ عملٍ واحد — من غاب أكثرَ منه فاته لقاءٌ أو تسليم؛
   وثلاثون يوما شهرٌ كامل — من غابه فقد اختفى. ومن لم يدخل قطّ (أو لا حسابَ له) يُعدّ مختفيا كذلك. */

export const ACTIVE_DAYS = 7
export const GONE_DAYS = 30

export type Activity = 'active' | 'quiet' | 'gone'

export const ACTIVITY_LABELS: { id: Activity; ar: string }[] = [
  { id: 'active', ar: `نشط — آخر ${ACTIVE_DAYS} أيام` },
  { id: 'quiet', ar: 'قل نشاطه' },
  { id: 'gone', ar: `اختفى — أكثر من ${GONE_DAYS} يوما` },
]

const DAY = 86_400_000

const daysSince = (at: string | Date, now: Date) => Math.floor((now.getTime() - new Date(at).getTime()) / DAY)

export function activityOf(lastSeenAt: string | Date | null, now: Date): Activity {
  if (!lastSeenAt) return 'gone'
  const d = daysSince(lastSeenAt, now)
  if (d <= ACTIVE_DAYS) return 'active'
  return d > GONE_DAYS ? 'gone' : 'quiet'
}

/** «آخر نشاط: اليوم» · «أمس» · «قبل يومين» · «قبل 5 أيام» · «قبل 12 يوما» — بعدّ العربيّة لا «يوم(ا)» */
export function lastSeenAr(lastSeenAt: string | Date | null, now: Date): string {
  if (!lastSeenAt) return 'لم يدخل منصته قط'
  const d = Math.max(0, daysSince(lastSeenAt, now))
  if (d === 0) return 'آخر نشاط: اليوم'
  if (d === 1) return 'آخر نشاط: أمس'
  if (d === 2) return 'آخر نشاط: قبل يومين'
  if (d <= 10) return `آخر نشاط: قبل ${d} أيام`
  return `آخر نشاط: قبل ${d} يوما`
}

/* ═══ ولا مؤشّرَ لمن لم يوقّع عقدَه (٢٤ أكتوبر ٢٠٢٦) ═══
   قولُ صاحب المنصّة: «لا تشمل من لم يوقّع العقد، فهو لم يدخل أصلا للمنصّة». فمن لم يوقّع بعدُ لا يُقال عنه
   «اختفى» — لم يُطلب منه أن يحضر شيئا — ولا يُعدّ في فلتر النشاط. ويُقال حالُه بدل المؤشّر.

   ومن له المؤشّر: النشطُ دائما، ومن وقّع (وقّع · اعتُمد توقيعُه · وُقّع من الطرفين · انتهى عقدُه بعد أن عمل)، ومن له
   حسابٌ مربوطٌ بلا عقدٍ أصلا — من عُيّن مدرّبا مباشرةً فدخل بوّابتَه بلا عقد. */
export const SIGNED_CONTRACT_STATUSES = ['signed', 'signature_approved', 'countersigned', 'terminated'] as const

export function tracksActivity(t: { contract: { status: string } | null; hasAccount: boolean; applicationStatus: string }): boolean {
  /* والنشطُ نشطٌ ولو أُعيد له عقدٌ للتوقيع: آخرُ عقدٍ «مُرسَل» لا يُخرج من عمل قبله */
  if (t.applicationStatus === 'active') return true
  if (t.contract) return (SIGNED_CONTRACT_STATUSES as readonly string[]).includes(t.contract.status)
  return t.hasAccount
}

export const NOT_SIGNED_AR = 'لم يوقع العقد بعد'
