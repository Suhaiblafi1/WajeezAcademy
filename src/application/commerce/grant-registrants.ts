/* من عبّأ نموذج المنحة — مصدرُه، ورسائلُه، وإحصاءاتُ القائمة (٣١ أكتوبر ٢٠٢٦).

   طلبُ صاحب المنصّة: «أريد تفاصيلَ أكثر عن كلّ شخص مثل وقت فتح الرابط والمصدر (أيُّ منحة، سواءٌ منحةُ الأكاديميّة
   أو إعلاناتُ المدرّبين أو مباشرٌ من الموقع أو من مؤثّر) … وأن أعلم ما يصلهم من إيميلات ومواعيدَها … وfull statistics».

   ═══ المصدرُ: ما فتح به صفحةَ المنحة أوّلا، ثمّ أوّلُ زيارةٍ للموقع ═══

   يُرسل المتصفّحُ مع النموذج زيارتين (`server/services/grant-landing.service.ts#apply`): **الزيارةَ التي فتح فيها صفحةَ
   المنحة** — ومنها «وقتُ فتح الرابط» — و**أوّلَ زيارةٍ للموقع** كما يحفظها لإنشاء الحساب (`signup-source.ts`). ويُسمّى
   المصدرُ بأوضح ما فيهما، بهذا الترتيب:
     ١) منحةُ المؤثّرين ← «مؤثر» بكوده.
     ٢) رابطُ مدرّب (`?ref=`) في إحدى الزيارتين ← «رابط مدرب» باسمه — وهي إعلاناتُ المدرّبين من «شارك دوراتك».
     ٣) `?ch=share` ← «هدية من صديق» (`GRANT_SHARE_PATH`).
     ٤) قناةٌ أخرى في رابط الحملة (`?ch=email`) ← «رسائل الأكاديمية» بمنصّتها — الروابطُ التي نرسلها نحن.
     ٥) وسمُ حملةٍ أو منصّةٌ أحالته ← «منصات وإعلانات»، وموقعٌ آخر أو بحث ← «مواقع وبحث».
     ٦) زيارةٌ بلا إشارة ← «مباشر من الموقع». ومن عبّأ قبل هذا التتبّع ← «غير معروف»، إلّا أن يكون له حسابٌ حُفظ مصدرُه.

   والملفُّ يقرؤه الخادمُ أيضا (التصديرُ إلى Excel)، فلا يستورد بـ`@/`. والحارس: `src/tests/commerce/grant-registrants.test.ts`. */

import { hasSignal, sourceLabelAr, type FirstTouch } from '../marketing/signup-source'
import { zonedClock, zonedDay } from '../trainer/cohort-period'

export type SourceGroup = 'influencer' | 'trainer' | 'share' | 'academy' | 'platform' | 'site' | 'direct' | 'unknown'

/** أسماءُ المجموعات في الإحصاءات وعمود «المصدر» — بالترتيب الذي تُعرض به */
export const SOURCE_GROUP_AR: Record<SourceGroup, string> = {
  academy: 'رسائل الأكاديمية',
  influencer: 'مؤثر',
  trainer: 'رابط مدرب',
  share: 'هدية من صديق',
  platform: 'منصات وإعلانات',
  site: 'مواقع وبحث',
  direct: 'مباشر من الموقع',
  unknown: 'غير معروف',
}

/** مواقعُ التواصل المُحيلة — منصّاتٌ لا مواقعُ ولا بحث. وجوجل وبينغ بحثٌ لا منصّة */
const SOCIAL_HOST_RE = /(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|whatsapp\.com|wa\.me|linkedin\.com|lnkd\.in|x\.com|t\.co|twitter\.com|youtube\.com|youtu\.be|tiktok\.com|snapchat\.com|t\.me|telegram\.org)$/

export interface SourceInput {
  influencer: boolean
  influencerCode: string | null
  /** قناةُ رابط الحملة كما حُفظت مع العميل (`Lead.channel`) */
  channel: string | null
  wave: string | null
  pageTouch: FirstTouch | null
  firstTouch: FirstTouch | null
  /** اسمُ صاحب رابط المدرّب برمزه — إن عُرف */
  trainerName?: (refCode: string) => string | null
}

export interface RegistrantSource {
  group: SourceGroup
  labelAr: string
  /** تفصيلٌ في سطرٍ ثانٍ: الدفعة، والحملة، والزيارةُ الأولى إن كانت غيرَ التي فتح بها الصفحة */
  detailAr: string | null
}

const at = (t: FirstTouch | null) => (t?.at ? Date.parse(t.at) : NaN)

export function registrantSource(i: SourceInput): RegistrantSource {
  const details: string[] = []
  if (i.wave) details.push(`دفعة ${i.wave}`)
  const page = i.pageTouch
  const first = i.firstTouch
  /* الزيارةُ التي تُسمّي: ما فتح به الصفحةَ إن حمل إشارة، وإلّا أوّلُ زيارةٍ حملت إشارة، وإلّا ما كان */
  const touch = hasSignal(page) ? page : hasSignal(first) ? first : page ?? first
  const ref = page?.refCode ?? first?.refCode
  if (touch?.utmCampaign) details.push(`حملة ${touch.utmCampaign}`)
  /* والزيارةُ الأولى تُقال إن سبقت فتحَ الصفحة بيوم أو أكثر — فيُعرف أنّه عرفنا قبل المنحة */
  if (first && page && at(page) - at(first) >= 86_400_000) {
    details.push(`أول زيارة ${zonedDay(new Date(at(first)))} من ${sourceLabelAr({ via: 'self', ...first }).labelAr}`)
  }
  const detailAr = details.length > 0 ? details.join(' · ') : null

  if (i.influencer) return { group: 'influencer', labelAr: i.influencerCode ? `مؤثر · كود ${i.influencerCode}` : 'مؤثر', detailAr }
  if (ref) {
    const name = i.trainerName?.(ref) ?? null
    return { group: 'trainer', labelAr: name ? `رابط المدرب ${name}` : 'رابط مدرب', detailAr }
  }
  const channel = i.channel ?? touch?.channel ?? null
  if (channel === 'share') return { group: 'share', labelAr: 'هدية من صديق', detailAr }
  if (channel) {
    return { group: 'academy', labelAr: `رسائل الأكاديمية · ${sourceLabelAr({ via: 'self', channel }).labelAr}`, detailAr }
  }
  if (!touch) return { group: 'unknown', labelAr: SOURCE_GROUP_AR.unknown, detailAr: detailAr ?? 'عبأ قبل تتبع المصدر' }
  const named = sourceLabelAr({ via: 'self', ...touch })
  if (touch.utmSource || touch.utmCampaign) return { group: 'platform', labelAr: named.labelAr, detailAr }
  if (touch.referrerHost) {
    return { group: SOCIAL_HOST_RE.test(touch.referrerHost) ? 'platform' : 'site', labelAr: named.labelAr, detailAr }
  }
  return { group: 'direct', labelAr: SOURCE_GROUP_AR.direct, detailAr }
}

/* ─────────── الرسائلُ التي تصله ─────────── */

/** ما كُتبت له رسالةٌ من رسائل المنحة — وما سواه يُقال بموضوعه */
export const GRANT_MAIL_PURPOSE_AR: Record<string, string> = {
  'grant.code': 'كود المنحة',
  'grant.reminder': 'تذكير قبل انتهاء المنحة',
  'grant.message': 'رسالة منك',
}
export const mailPurposeAr = (purpose: string | null): string =>
  (purpose && GRANT_MAIL_PURPOSE_AR[purpose]) || 'رسالة من المنصة'

export type MailState = 'queued' | 'sent' | 'failed'
export const MAIL_STATE_AR: Record<MailState, string> = { queued: 'في الطريق', sent: 'أرسلت', failed: 'تعذر إرسالها' }

/** موعدٌ قادم: تذكيرٌ مجدول، أو مكالمةُ مستشار */
export interface Upcoming {
  kind: 'reminder' | 'call'
  at: string
  labelAr: string
}

/* ─────────── رسالةٌ يكتبها صاحبُ المنصّة ─────────── */

export const GRANT_MESSAGE_SUBJECT_MAX = 150
export const GRANT_MESSAGE_BODY_MAX = 5000
/** أقصى من تصلهم رسالةٌ واحدة — فوق كلّ من عبّأ النموذجَ اليوم بكثير */
export const GRANT_MESSAGE_MAX_TO = 5000

/** المتنُ فقراتٌ — يفصلها سطرٌ فارغ، والأسطرُ داخل الفقرة تبقى */
export function messageParagraphs(body: string): string[] {
  return body.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
}

/* ─────────── الإحصاءات ─────────── */

export type RegistrantState = 'bought' | 'pending' | 'none'

/** ما تحتاجه الإحصاءاتُ من الصفّ — والشاشةُ تمرّر صفوفَها كما هي */
export interface StatRow {
  createdAt: string
  pageOpenedAt: string | null
  state: RegistrantState
  influencer: boolean
  code: string | null
  advisor: string | null
  workField: string | null
  careerLevel: string | null
  interests: string[]
  picks: string[]
  source: RegistrantSource
  mails: { purpose: string | null; status: string }[]
}

export interface Count { key: string; labelAr: string; n: number; bought: number }

export interface RegistrantStats {
  total: number
  withCode: number
  bought: number
  pending: number
  none: number
  /** نسبةُ من اشترى من الكلّ — بالمئة، بلا كسور */
  boughtPct: number
  withAdvisor: number
  member: number
  influencer: number
  bySource: Count[]
  byDay: { day: string; n: number }[]
  byHour: { hour: number; n: number }[]
  byField: Count[]
  byLevel: Count[]
  byInterest: Count[]
  byPick: Count[]
  /** بين فتح صفحة المنحة والتعبئة — الوسيطُ بالدقائق، لمن عُرف وقتُ فتحه */
  openToFormMedianMin: number | null
  opened: number
  mails: { total: number; sent: number; queued: number; failed: number; byPurpose: Count[] }
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

function tally(rows: StatRow[], keys: (r: StatRow) => (string | null)[], label: (k: string) => string = (k) => k): Count[] {
  const m = new Map<string, Count>()
  for (const r of rows) {
    for (const k of new Set(keys(r).filter((x): x is string => !!x))) {
      const c = m.get(k) ?? { key: k, labelAr: label(k), n: 0, bought: 0 }
      c.n += 1
      if (r.state === 'bought') c.bought += 1
      m.set(k, c)
    }
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.labelAr.localeCompare(b.labelAr, 'ar'))
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return Math.round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2)
}

export function registrantStats(rows: StatRow[]): RegistrantStats {
  const count = (f: (r: StatRow) => boolean) => rows.filter(f).length
  const bought = count((r) => r.state === 'bought')

  const days = new Map<string, number>()
  const hours = new Array<number>(24).fill(0)
  const gaps: number[] = []
  for (const r of rows) {
    const t = new Date(r.createdAt)
    const day = zonedDay(t)
    days.set(day, (days.get(day) ?? 0) + 1)
    hours[Number(zonedClock(t).slice(0, 2))] += 1
    if (r.pageOpenedAt) {
      const gap = (t.getTime() - Date.parse(r.pageOpenedAt)) / 60_000
      if (gap >= 0) gaps.push(gap)
    }
  }
  const order = Object.keys(SOURCE_GROUP_AR)
  const bySource = tally(rows, (r) => [r.source.group], (k) => SOURCE_GROUP_AR[k as SourceGroup])
    .sort((a, b) => b.n - a.n || order.indexOf(a.key) - order.indexOf(b.key))
  const mails = rows.flatMap((r) => r.mails)
  const byPurpose = new Map<string, Count>()
  for (const m of mails) {
    const label = mailPurposeAr(m.purpose)
    const c = byPurpose.get(label) ?? { key: label, labelAr: label, n: 0, bought: 0 }
    c.n += 1
    byPurpose.set(label, c)
  }

  return {
    total: rows.length,
    withCode: count((r) => !!r.code),
    bought,
    pending: count((r) => r.state === 'pending'),
    none: count((r) => r.state === 'none'),
    boughtPct: pct(bought, rows.length),
    withAdvisor: count((r) => !!r.advisor),
    member: count((r) => !r.influencer),
    influencer: count((r) => r.influencer),
    bySource,
    byDay: [...days.entries()].map(([day, n]) => ({ day, n })).sort((a, b) => a.day.localeCompare(b.day)),
    byHour: hours.map((n, hour) => ({ hour, n })),
    byField: tally(rows, (r) => [r.workField]),
    byLevel: tally(rows, (r) => [r.careerLevel]),
    byInterest: tally(rows, (r) => r.interests),
    byPick: tally(rows, (r) => r.picks),
    openToFormMedianMin: median(gaps),
    opened: gaps.length,
    mails: {
      total: mails.length,
      sent: mails.filter((m) => m.status === 'sent').length,
      queued: mails.filter((m) => m.status === 'queued').length,
      failed: mails.filter((m) => m.status === 'failed').length,
      byPurpose: [...byPurpose.values()].sort((a, b) => b.n - a.n),
    },
  }
}

/** نسبةُ الشراء في مجموعة — «٣ من ١٠ · ٣٠%» */
export const conversionAr = (c: { n: number; bought: number }): string => `${c.bought} من ${c.n} · ${pct(c.bought, c.n)}%`

/* ─────────── من فتح الرابط ← عبّأ ← اشترى (٣١ أكتوبر ٢٠٢٦) ───────────

   كانت القائمةُ لا ترى إلّا من عبّأ. فصفحةُ المنحة تسجّل كلَّ متصفّحٍ يفتحها مرّةً لكلّ حملة (`GrantVisit`)، ويُربط بمن عبّأ
   منه. فيُقرأ لكلّ مصدرٍ: كم فتح الرابط، وكم عبّأ منهم، وكم اشترى. ويُعدّ من أوّل زيارةٍ سُجّلت (`since`) — ومن عبّأ قبلها
   ليس فيه. */

export interface FunnelVisit {
  group: SourceGroup
  /** يومُ أوّل فتحٍ بتوقيت عمّان */
  day: string
  /** عبّأ النموذجَ من المتصفّح نفسِه */
  filled: boolean
  /** حالُه إن عبّأ وما زال في القائمة */
  state: RegistrantState | null
}

export interface FunnelCount { key: string; labelAr: string; visitors: number; filled: number; bought: number }

export interface GrantFunnel {
  /** أوّلُ زيارةٍ سُجّلت — ومنها يُعدّ */
  since: string | null
  visitors: number
  filled: number
  bought: number
  /** نسبةُ من عبّأ ممّن فتح الرابط — بالمئة */
  filledPct: number
  bySource: FunnelCount[]
  byDay: { day: string; visitors: number; filled: number }[]
}

export function grantFunnel(visits: FunnelVisit[], since: Date | string | null): GrantFunnel {
  const groups = new Map<string, FunnelCount>()
  const days = new Map<string, { day: string; visitors: number; filled: number }>()
  for (const v of visits) {
    const g = groups.get(v.group) ?? { key: v.group, labelAr: SOURCE_GROUP_AR[v.group], visitors: 0, filled: 0, bought: 0 }
    g.visitors += 1
    if (v.filled) g.filled += 1
    if (v.state === 'bought') g.bought += 1
    groups.set(v.group, g)
    const d = days.get(v.day) ?? { day: v.day, visitors: 0, filled: 0 }
    d.visitors += 1
    if (v.filled) d.filled += 1
    days.set(v.day, d)
  }
  const order = Object.keys(SOURCE_GROUP_AR)
  const filled = visits.filter((v) => v.filled).length
  return {
    since: since ? new Date(since).toISOString() : null,
    visitors: visits.length,
    filled,
    bought: visits.filter((v) => v.state === 'bought').length,
    filledPct: pct(filled, visits.length),
    bySource: [...groups.values()].sort((a, b) => b.visitors - a.visitors || order.indexOf(a.key) - order.indexOf(b.key)),
    byDay: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
  }
}

/** «فتح ١٠ · عبأ ٣ (٣٠%) · اشترى ١» */
export const funnelAr = (c: { visitors: number; filled: number; bought: number }): string =>
  `فتح ${c.visitors} · عبأ ${c.filled} (${pct(c.filled, c.visitors)}%) · اشترى ${c.bought}`
