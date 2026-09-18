/* ═══ طولُ اللقاء — ساعتان حدًّا أدنى، وساعاتُه تُنتقى لا تُكتب ═══

   ── الحكمُ ولماذا ──

   قرارُ صاحب المنصّة (١٧ سبتمبر ٢٠٢٦): «كلُّ لقاءٍ ساعتان على الأقلّ —
   أربعةُ لقاءاتٍ تعني ثماني ساعاتٍ حدًّا أدنى». وهو حكمٌ على **المنتَج**
   لا على الشكل: متعلّمٌ يشتري دورةً بأربعة محاورَ يشتري معها زمنا، فلقاءٌ
   من عشر دقائق يفي بالعدد ولا يفي بالدورة.

   وكان المفحوصُ الوحيدُ أنّ النهايةَ بعد البداية. فلقاءٌ من عشر دقائق يمرّ،
   ويصير اجتماعَ زووم، ويصل المسجَّلين بتاريخه.

   والفحصُ **في التحقّق وفي البوّابة معا**: الشاشةُ تمنع قبل النقر، والمسلكُ
   يمنع من ينادي بلا شاشة. وقاعدةٌ في موضعَين بيدها تفترق يوما — وهي علّةُ
   `schedule-window.ts` نفسِها — فهي هنا مرّةً واحدة.

   ── ولمَ السلالمُ في هذا الملفّ ──

   لأنّ سلّم «إلى الساعة» **مشتقٌّ من الحدّ**: أوّلُ خيارٍ فيه هو البدايةُ
   زائدَ ساعتين. فلو كُتب السلّمُ في الشاشة والحدُّ هنا، أمكن أن يعرض
   السلّمُ خيارا يردّه الحدّ — فيختاره المدرّبُ ثمّ يُقال له لا.

   والقاعدةُ التي يُبنى عليها هذا كلُّه: **الحالةُ الخاطئةُ لا يُعبَّر عنها
   بدل أن تُشرَح بجملة.**

   ── ولمَ قائمةٌ لا حقلُ وقت ──

   `<input type="time">` يعرض «ص/م» حرفا واحدا لاصقا بالرقم، ويختلف رسمُه
   بين متصفّحٍ وآخر وبين لغةِ نظامٍ وأخرى. فتُعتمَد جلسةٌ في السادسة صباحا
   وصاحبُها يظنّها السادسة مساءً — ولا شيءَ في الشاشة يُنبّه: كلاهما وقتٌ
   صحيحٌ في يومٍ صحيح. والقائمةُ تكتب «صباحا» و«مساءً» بحروفها. */

/** ساعتان — بالدقائق */
export const MIN_SESSION_MINUTES = 120
const MINUTE_MS = 60_000
export const MIN_SESSION_MS = MIN_SESSION_MINUTES * MINUTE_MS

/** أوّلُ ساعةٍ تُعرض وآخرُها — بالدقائق من منتصف الليل */
export const EARLIEST_MINUTES = 6 * 60
export const LATEST_MINUTES = 23 * 60 + 30
/** درجةُ السلّم: نصفُ ساعة */
export const SLOT_STEP_MINUTES = 30

type DateLike = Date | string | number

function ms(v: DateLike): number {
  return v instanceof Date ? v.getTime() : new Date(v).getTime()
}

/** طولُ اللقاء بالدقائق — و`null` حين لا يُقرأ أحدُ طرفَيه */
export function sessionMinutes(startsAt: DateLike, endsAt: DateLike): number | null {
  const a = ms(startsAt)
  const b = ms(endsAt)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return (b - a) / MINUTE_MS
}

/** أقصرُ من الحدّ؟ — وما لا يُقرأ ليس قصيرا، بل غيرُ صالحٍ يردّه فحصٌ آخر */
export function sessionTooShort(startsAt: DateLike, endsAt: DateLike): boolean {
  const mins = sessionMinutes(startsAt, endsAt)
  return mins !== null && mins < MIN_SESSION_MINUTES
}

/** ما يُقال لمن قصّر — العلّةُ والحدُّ في جملةٍ واحدة */
export const SHORT_SESSION_AR =
  'اللقاءُ ساعتان على الأقلّ — لكلّ محورٍ لقاء، ولكلّ لقاءٍ ساعتان'

/* ─────────── سلالمُ الساعات ─────────── */

/** «18:30» ← ١١١٠ دقيقة */
export function toClock(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** ١١١٠ ← «18:30» */
export function toMinutes(clock: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(clock.trim())
  if (!m) return null
  const h = Number(m[1])
  const mm = Number(m[2])
  if (h > 23 || mm > 59) return null
  return h * 60 + mm
}

/** «6:30 مساءً» — الفترةُ بحروفها، فلا يُقرأ الصبحُ مساءً */
export function slotLabelAr(clock: string): string {
  const total = toMinutes(clock)
  if (total === null) return clock
  const h = Math.floor(total / 60)
  const mm = String(total % 60).padStart(2, '0')
  const h12 = h % 12 === 0 ? 12 : h % 12
  /* والظهرُ ساعتُه: «١٢ مساءً» تُقرأ خطأً، و«١٢ صباحا» أشدّ */
  const period = h < 12 ? 'صباحا' : h < 13 ? 'ظهرا' : 'مساءً'
  return `${h12}:${mm} ${period}`
}

function ladder(fromMinutes: number, toMinutes_: number): string[] {
  const out: string[] = []
  for (let m = fromMinutes; m <= toMinutes_; m += SLOT_STEP_MINUTES) out.push(toClock(m))
  return out
}

/** ساعاتُ البدء — ويُقطَع السلّمُ حيث لا يبقى للحدّ متّسع */
export function fromSlots(): string[] {
  return ladder(EARLIEST_MINUTES, LATEST_MINUTES - MIN_SESSION_MINUTES)
}

/** ساعاتُ الانتهاء لبدايةٍ بعينها — أوّلُها البدايةُ زائدَ الحدّ */
export function toSlotsFor(from: string): string[] {
  const start = toMinutes(from)
  if (start === null) return []
  return ladder(Math.min(start + MIN_SESSION_MINUTES, LATEST_MINUTES), LATEST_MINUTES)
}

/** ما يُملأ به «إلى الساعة» حين تتبدّل البداية — أوّلُ خيارٍ صالح */
export function firstToFor(from: string): string {
  return toSlotsFor(from)[0] ?? toClock(LATEST_MINUTES)
}
