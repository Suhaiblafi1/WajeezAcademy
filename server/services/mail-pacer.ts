/* ═══ مهلةُ البريد المشتركة في العامل — والعاجلُ أوّلا (٢٢ نوفمبر ٢٠٢٦) ═══

   صاحبُ المنصّة يرسل عشرين ألفَ رسالةٍ في حملة («i will upgrade the resend to be 50k per month»)، وحدُّ Resend
   في الخطّة المدفوعة نحوُ عشرة طلباتٍ في الثانية. وفي العامل ثلاثةُ أبوابٍ تطلب Resend: طابورُ الإشعارات، وطابورُ
   البريد الخارج، والبريدُ الجماعيّ — ولكلٍّ مهلتُه بين رسالتيه. ومهلتان منفصلتان تُجمعان: ثمانٍ في الثانية للحملة
   وواحدةٌ وستّةُ أعشارٍ للعاجل تقارب العشر، فيردّ المزوّدُ ما زاد.

   فهنا **عدّادٌ واحدٌ للعامل كلِّه**: لا يخرج منه أكثرُ من `perSecond` رسالةً في الثانية مهما طلبها أحد. ومن انتظر
   دورَه وفي الطابور عاجلٌ وجماعيّ، أُعطي العاجلُ أوّلا: رسالةُ كلمة سرٍّ لا تقف خلف حملة. والجماعيُّ يأخذ دورا
   واحدا كلَّ مرّة، فلا يتأخّر العاجلُ أكثرَ من دورٍ واحد (ثُمن ثانية).

   وما لا يمرّ به: ما يُرسله الخادمُ في الطلب نفسِه (رمزُ التوثيق، واستعادةُ كلمة السرّ) — قليلٌ متفرّق، وهامشُ
   الحدّ (ثمانٍ من عشر) له.

   والسرعةُ من البيئة (`MAIL_SENDS_PER_SECOND`)، وافتراضُها ثمان، ولا تُقبل فوق تسع: إن لم تُرفع خطّةُ Resend بعدُ
   كُتبت ٢ فلا يُردّ شيء. والحارس: `server/tests/notifications/bulk-mail-pacing.test.ts`. */

export type MailPriority = 'urgent' | 'bulk'

/** الافتراض: ثماني رسائلَ في الثانية — تحت حدّ Resend المدفوع (عشرة) بهامش */
export const DEFAULT_MAIL_SENDS_PER_SECOND = 8
const MAX_PER_SECOND = 9

/** السرعةُ من البيئة — رقمٌ بين ١ و٩، وما سواه يعود إلى الافتراض */
export function mailSendsPerSecond(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.MAIL_SENDS_PER_SECOND)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAIL_SENDS_PER_SECOND
  return Math.min(MAX_PER_SECOND, Math.max(1, n))
}

interface Waiter { priority: MailPriority; grant: () => void }

export class MailPacer {
  /** أقلُّ ما بين رسالتين */
  readonly intervalMs: number
  private nextFreeAt = 0
  private readonly waiting: Waiter[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly now: () => number

  constructor(perSecond: number, now: () => number = Date.now) {
    this.intervalMs = Math.ceil(1000 / Math.max(1, perSecond))
    this.now = now
  }

  /** ينتظر دورَه ثمّ يعود — فيُرسل المُنادي رسالةً واحدة */
  acquire(priority: MailPriority): Promise<void> {
    return new Promise<void>((grant) => {
      this.waiting.push({ priority, grant })
      this.pump()
    })
  }

  /** كم ينتظر دورا الآن — للفحص */
  get queued(): number { return this.waiting.length }

  private pump(): void {
    if (this.timer || this.waiting.length === 0) return
    const wait = this.nextFreeAt - this.now()
    if (wait > 0) {
      this.timer = setTimeout(() => { this.timer = null; this.pump() }, wait)
      return
    }
    /* العاجلُ أوّلا، ثمّ الأقدمُ في كلٍّ منهما */
    const urgent = this.waiting.findIndex((w) => w.priority === 'urgent')
    const [next] = this.waiting.splice(urgent >= 0 ? urgent : 0, 1)
    this.nextFreeAt = this.now() + this.intervalMs
    next.grant()
    this.pump()
  }
}

/** العدّادُ الواحدُ لعمليّة العامل — يتقاسمه الطابوران والبريدُ الجماعيّ */
export const workerMailPacer = new MailPacer(mailSendsPerSecond())
