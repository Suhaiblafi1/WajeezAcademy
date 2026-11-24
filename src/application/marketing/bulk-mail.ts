/* ═══ البريدُ الجماعيّ — ما تقرؤه الشاشةُ والخادمُ معا (٢٢ نوفمبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: «i need to send emails to all leads from my website or leads from excel sheet i upload..
   using resend»، ثمّ «ok i need to be easy like i choose which list and what email to them.. multi campaign same
   place». فالشاشةُ حملاتٌ في مكانٍ واحد: لكلٍّ قائمةٌ ورسالة، والقوائمُ تُرفع مرّةً وتُعاد.

   وهنا ما لا يحتاج قاعدة: نصُّ التأكيد وأرقامُه، ومتى يُطلب كتابةُ العدد، وكم يأخذ الإرسال، والتحيّةُ بالاسم الأوّل.
   والخادمُ في `server/services/bulk-mail/`. والحارس: `src/tests/marketing/bulk-mail-confirm.test.ts`. */

import { countAr } from '../text/count-ar'

/** غرضُ رسالة الحملة في طابور البريد — به يُفرَّغ وحدَه، وبه يُلغى الاشتراك */
export const BULK_MAIL_PURPOSE = 'bulk.message'

/** السرعةُ التي يُحسب بها الوقت — افتراضُ العامل (`server/services/mail-pacer.ts`) */
export const BULK_MAIL_PER_SECOND = 8

/** أقصى صفوف الملفّ الواحد */
export const BULK_LIST_MAX_ROWS = 60_000

/** فوق هذا العدد يُكتب العددُ قبل الإرسال — خطأٌ في القائمة لا يُصلَح بعد أن يصل الناس */
export const BULK_TYPE_COUNT_OVER = 1_000

export const BULK_SUBJECT_MAX = 150
export const BULK_BODY_MAX = 10_000
export const BULK_BUTTON_LABEL_MAX = 40
export const BULK_LIST_NAME_MAX = 80

export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'stopped'

export const CAMPAIGN_STATUS_AR: Record<CampaignStatus, string> = {
  draft: 'مسودة',
  sending: 'يرسل الآن',
  sent: 'أرسلت',
  stopped: 'أوقفت',
}

const PEOPLE = { one: 'شخص', two: 'شخصان', few: 'أشخاص', many: 'شخصا' }
const MINUTES = { one: 'دقيقة', two: 'دقيقتان', few: 'دقائق', many: 'دقيقة' }
const HOURS = { one: 'ساعة', two: 'ساعتان', few: 'ساعات', many: 'ساعة' }

export const peopleAr = (n: number) => countAr(n, PEOPLE)

/** كم دقيقةً يأخذ الإرسال — بالسرعة المعلنة، ودقيقةٌ على الأقلّ */
export function etaMinutes(recipients: number, perSecond = BULK_MAIL_PER_SECOND): number {
  if (recipients <= 0) return 0
  return Math.max(1, Math.ceil(recipients / perSecond / 60))
}

/** «نحو 42 دقيقة» · «نحو ساعة و10 دقائق» · «أقل من دقيقة» */
export function etaAr(recipients: number, perSecond = BULK_MAIL_PER_SECOND): string {
  if (recipients <= 0) return 'لا وقت'
  if (recipients / perSecond < 60) return 'أقل من دقيقة'
  const m = etaMinutes(recipients, perSecond)
  if (m < 60) return `نحو ${countAr(m, MINUTES)}`
  const h = Math.floor(m / 60)
  const rest = m % 60
  const hours = h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : countAr(h, HOURS)
  return rest === 0 ? `نحو ${hours}` : `نحو ${hours} و${countAr(rest, MINUTES)}`
}

/** أيُطلب كتابةُ العدد قبل الإرسال */
export const needsTypedCount = (recipients: number) => recipients > BULK_TYPE_COUNT_OVER

/** ما كتبه يطابق العدد — بأرقامٍ عربيّةٍ أو هنديّة، وبفواصل أو بلا */
export function typedCountMatches(typed: string, recipients: number): boolean {
  const digits = typed
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s,،٬.]/g, '')
  return /^\d+$/.test(digits) && Number(digits) === recipients
}

/** ما يسقط قبل الإرسال ولماذا */
export interface Skipped {
  optedOut: number
  invalid: number
  duplicate: number
  /** من وصلته حملةٌ في الأيّام الأخيرة — إن اختير تخطّيه (`SKIP_RECENT_DAYS`) */
  recent?: number
  /** من قال إنّه غيرُ مهتمّ: حالةُ مستشارٍ «غير مهتم»، أو «توقّف» على واتساب — يُتخطّى دائما (`notInterestedEmails`) */
  notInterested?: number
  /** من هو في المنصّة (حسابٌ أو نموذج) — إن اختير تخطّيه، لقائمةٍ مرفوعة */
  onPlatform?: number
  /** من هو في قائمةٍ مرفوعةٍ أخرى — إن اختير تخطّيه */
  inOtherLists?: number
  /** أهي قائمةٌ مرفوعة — فيُعرض خيارا المنصّة والقوائم الأخرى */
  uploadedList?: boolean
}

/* ═══ تخطّي من وصلته حملةٌ قريبا (٢٣ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «take out … the 80 we sent today» ثمّ «yes» لبابٍ يفعله في الموقع. فقبل الإرسال خيار: لا يصل من
   خرجت إليه رسالةُ حملةٍ (أو تنتظر مرحلتَها) في آخر ٣ أو ٧ أو ١٤ يوما. والحدُّ ١٤ لأنّ ما خرج من الطابور يُحذف بعدها
   (`RETENTION_DAYS.outboxSent`) — فأبعدُ منه لا يُعرف. والافتراضُ ٧. */
export const SKIP_RECENT_DAYS = [0, 3, 7, 14] as const
export type SkipRecentDays = (typeof SKIP_RECENT_DAYS)[number]
export const SKIP_RECENT_DEFAULT: SkipRecentDays = 7
export const skipRecentAr = (d: SkipRecentDays) => (d === 0 ? 'لا تتخط أحدا' : d === 14 ? 'آخر 14 يوما' : `آخر ${d} أيام`)

export interface SendCheck extends Skipped {
  recipients: number
  audienceAr: string
}

/** أسطرُ التأكيد: من تصله، ومن لا تصله ولماذا، وكم يأخذ */
export function confirmLinesAr(c: SendCheck): string[] {
  const lines = [`تصل ${peopleAr(c.recipients)} في «${c.audienceAr}»`]
  const skipped = c.optedOut + c.invalid + c.duplicate + (c.recent ?? 0) + (c.notInterested ?? 0) + (c.onPlatform ?? 0) + (c.inOtherLists ?? 0)
  if (skipped > 0) {
    const why = [
      c.optedOut > 0 ? `${c.optedOut} ألغوا الاشتراك` : null,
      c.invalid > 0 ? `${c.invalid} بريد غير صالح` : null,
      c.duplicate > 0 ? `${c.duplicate} مكرر` : null,
      c.recent ? `${c.recent} وصلتهم حملة قريبا` : null,
      c.notInterested ? `${c.notInterested} قالوا غير مهتم` : null,
      c.onPlatform ? `${c.onPlatform} موجودون في المنصة` : null,
      c.inOtherLists ? `${c.inOtherLists} في قائمة أخرى` : null,
    ].filter(Boolean).join(' · ')
    lines.push(`ولا تصل ${skipped}: ${why}`)
  }
  lines.push(`يأخذ الإرسال ${etaAr(c.recipients)}`)
  return lines
}

/* ═══ حذفُ حملةٍ لم تصل أحدا (٢٤ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «إن فشلت الحملةُ فأعطني خيارَ حذفها». فالحذفُ لما لم يصل أحدا: المسودّة، وما انتهى أو أُوقف ولم يصل منه
   شيء، وما يُرسَل ولم يصل منه شيءٌ وقد تعذّر منه — ويُلغى معه ما بقي في الطابور من مراحله. وما وصل منه واحدٌ يبقى أثرُه. */
export function campaignDeletable(c: { status: string; sent: number; failed: number }): boolean {
  if (c.status === 'draft') return true
  if (c.sent > 0) return false
  return c.status === 'sending' ? c.failed > 0 : true
}

/** لماذا يُكتب العدد — يُقال ولا يُفرض بلا سبب */
export const TYPE_COUNT_WHY_AR = 'القائمة كبيرة. اكتب العدد لتتأكد أنها القائمة الصحيحة، فالرسالة لا ترجع بعد أن تصل.'

/* ═══ المُرسِل: نطاقٌ فرعيٌّ للحملات (٢٢ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: رسائلُ الحملات من نطاقٍ فرعيّ، فإن شكا منها أحدٌ أو ارتدّ منها كثيرٌ لم يمسّ ذلك نطاقَ رسائل
   الحساب والدفع وكلمة السرّ. والمُرسِلُ يُغيَّر من صفحة الحملات، ورسائلُ الحساب تبقى من مُرسِلها كما هي. */
export const DEFAULT_BULK_SENDER = { name: 'أكاديمية وجيز', email: 'news@news.wajeezacademy.com' } as const

export const senderAr = (s: { name: string; email: string }) => `${s.name} <${s.email}>`

/* ═══ الإرسالُ على مراحل (٢٢ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: نطاقٌ جديدٌ يرسل عشرين ألفا في يومه الأوّل يُقرأ إزعاجا. فما كبر يُرسل على أيّام: اليومُ الأوّلُ
   حتى ألفين، والثاني حتى خمسة آلاف، والثالثُ الباقي — والأرقامُ تُعدَّل، والخيارُ مفتوحٌ افتراضا فوق ألفين ويُغلق. */
export const STAGED_DEFAULT_OVER = 2_000
export const DEFAULT_STAGE_CAPS: readonly number[] = [2_000, 5_000]
export const MAX_STAGES = 5

/** أتُرسل على مراحل افتراضا */
export const stagedByDefault = (recipients: number) => recipients > STAGED_DEFAULT_OVER

/** عددُ كلّ يوم: الأيّامُ الأولى بحدودها، والباقي في اليوم الذي بعدها — ولا يومَ فارغ */
export function stagePlan(recipients: number, caps: readonly number[] | null): number[] {
  if (recipients <= 0) return []
  if (!caps || caps.length === 0) return [recipients]
  const out: number[] = []
  let left = recipients
  for (const cap of caps) {
    if (left <= 0) break
    const n = Math.min(Math.max(1, Math.floor(cap)), left)
    out.push(n)
    left -= n
  }
  if (left > 0) out.push(left)
  return out
}

/** «اليوم 1 (الآن): 2000» ثمّ «اليوم 2: 5000» … — الأيّامُ تُعدّ من لحظة الإرسال */
export function stageLinesAr(plan: readonly number[]): string[] {
  return plan.map((n, i) => `اليوم ${i + 1}${i === 0 ? ' (الآن)' : ''}: ${peopleAr(n)}`)
}

/* ─────────── التحيّة ─────────── */

/** أسماءٌ أوّلُها كلمتان: «عبد الله» لا «عبد» */
const COMPOUND = new Set(['عبد', 'ابو', 'أبو', 'ام', 'أم', 'abu', 'abd'])

/** الاسمُ الأوّل للتحيّة — أو لا شيء إن لم يكن اسما يُحيّا به */
export function firstNameOf(name: string | null | undefined): string | null {
  const clean = (name ?? '').replace(/\s+/g, ' ').trim()
  if (!clean || clean.includes('@') || /\d/.test(clean)) return null
  const parts = clean.split(' ')
  const first = COMPOUND.has(parts[0].toLowerCase()) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0]
  return first.length > 30 ? null : first
}

/** سطرُ التحيّة: «مرحبا سارة،» أو «مرحبا،» */
export function greetingAr(name: string | null | undefined): string {
  const first = firstNameOf(name)
  return first ? `مرحبا ${first}،` : 'مرحبا،'
}

/* ─────────── الجمهور ─────────── */

/** مفتاحُ الجمهور: قائمةٌ مرفوعة، أو ليداتُ الموقع كلُّها أو بحملتها أو بمصدرها */
export type AudienceKey =
  | { kind: 'list'; id: string }
  | { kind: 'leads'; scope: 'all' }
  | { kind: 'leads'; scope: 'campaign'; value: string }
  | { kind: 'leads'; scope: 'source'; value: string }

export function parseAudience(key: string | null | undefined): AudienceKey | null {
  if (!key) return null
  if (key === 'leads:all') return { kind: 'leads', scope: 'all' }
  const m = /^(list|leads:campaign|leads:source):(.{1,120})$/.exec(key)
  if (!m) return null
  if (m[1] === 'list') return /^[0-9a-f-]{36}$/i.test(m[2]) ? { kind: 'list', id: m[2] } : null
  return { kind: 'leads', scope: m[1] === 'leads:campaign' ? 'campaign' : 'source', value: m[2] }
}

/** أسماءُ مصادر الليدات بلا حملة */
export const LEAD_SOURCE_AR: Record<string, string> = {
  diagnostic: 'من التشخيص',
  site: 'من الموقع',
  advisor: 'من المستشارين',
  whatsapp: 'من واتساب',
  referral: 'من الإحالة',
  business: 'من الشركات',
  campaign: 'من حملة',
}
