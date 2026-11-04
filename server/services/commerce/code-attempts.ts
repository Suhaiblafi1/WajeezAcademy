/* حارسُ تجربة الأكواد في معاينة رابط الشراء (٤ نوفمبر ٢٠٢٦).

   المعاينةُ عامّةٌ بلا حساب (`CommerceService.preview`)، فهي بابٌ يُجرَّب منه كودٌ بعد كود حتى يُصاب كودُ
   منحةٍ حقيقيّ. وسقفُ الطلبات على المسار (`rateLimit`) يحدّ عددَ النداءات كلِّها — ومن يبني مسارَه يضيف ويحذف
   فينادي كثيرا بكودٍ واحد. فالحدُّ هنا على **الأكواد المختلفة المردودة** من عنوانٍ واحد في ساعة: من تجاوزه
   لا يُسأل عن كودٍ جديد، ويُسعَّر بلا كود ويُقال له السبب. وما قُبل من الأكواد لا يُعدّ، ولا الكودُ نفسُه
   إن أُعيد.

   والعدُّ في ذاكرة الخادم: نسخةٌ واحدةٌ تخدم الموقع (`deploy/compose.prod.yml`)، وإعادةُ تشغيلها تُصفّره —
   وذلك مقبولٌ لحارسٍ غايتُه أن يجعل التجربةَ بطيئةً لا مستحيلة. والحارس: `server/tests/commerce/buy-link-preview.test.ts`. */

export const CODE_ATTEMPTS_PER_HOUR = 10
const WINDOW_MS = 3_600_000
/** أقصى عددٍ من العناوين يُحفظ — فلا تكبر الذاكرةُ بلا حدّ تحت سيلٍ من العناوين */
const MAX_KEYS = 10_000

export const CODE_ATTEMPTS_AR = 'جربت أكوادا كثيرة. أعد المحاولة بعد ساعة، والسعر المعروض بدون كود.'

export class CodeAttemptGuard {
  private seen = new Map<string, { codes: Set<string>; since: number }>()

  private readonly limit: number
  private readonly now: () => number
  constructor(limit = CODE_ATTEMPTS_PER_HOUR, now = () => Date.now()) {
    this.limit = limit
    this.now = now
  }

  private entry(key: string) {
    const t = this.now()
    let e = this.seen.get(key)
    if (e && t - e.since > WINDOW_MS) { this.seen.delete(key); e = undefined }
    return e
  }

  /** أيُسأل عن هذا الكود من هذا العنوان؟ — الكودُ المردودُ من قبل يُسأل ثانيةً (لا يزيد العدّ) */
  allows(key: string, code: string): boolean {
    const e = this.entry(key)
    if (!e) return true
    return e.codes.has(code) || e.codes.size < this.limit
  }

  /** كودٌ رُدّ — يُعدّ على عنوانه */
  reject(key: string, code: string): void {
    let e = this.entry(key)
    if (!e) {
      if (this.seen.size >= MAX_KEYS) {
        const oldest = this.seen.keys().next().value
        if (oldest !== undefined) this.seen.delete(oldest)
      }
      e = { codes: new Set(), since: this.now() }
      this.seen.set(key, e)
    }
    e.codes.add(code)
  }
}
