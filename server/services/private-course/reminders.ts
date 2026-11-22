/* ═══ تذكيرُ من حجز ولم يدفع — وظيفةُ العامل كلَّ ساعة (٢١ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «if they haven't paid, remind them next day as reminder, after three days last chance».

   - **من**: حجزٌ «بانتظار الدفع» — قيدُ المراجعة بلا صورة حوالةٍ ولا دفعِ بطاقةٍ أخبر به Stripe. فمن دفع لا يُذكَّر (نحن من يتأخّر لا هو)،
     ومن رُفض أو تأكّد لا يُذكَّر. ومن ضغط «ادفع بالبطاقة» يُذكَّر، وتقول له الرسالةُ إنّه لا يفعل شيئا إن دفع.
   - **متى**: «تذكير» بعد يومٍ من الحجز، و«آخر فرصة» بعد ثلاثة أيّام — وبعد يومٍ من التذكير على الأقلّ، فمن حجز
     قبل هذه الوظيفة لا تصله الرسالتان في ساعة. ومن فاته اليومُ الأوّل حتى بلغ الثالث تصله «آخر فرصة» وحدَها.
     ولا شيءَ بعد بدء شعبته، ولا شيءَ ليلا: بين التاسعة صباحا والتاسعة مساء بتوقيت عمّان.
   - **مرّةً واحدة**: `remindedAt` و`lastChanceAt` يُكتبان بعد الإرسال. والإخفاقُ يُكتب في `reminderError` ويُعاد في
     الساعة التالية — إلّا أن يرفض Gmail المستلمَ نفسَه، فلا تغيّر الإعادةُ شيئا: يُكتب الخطأ ويُعدّ مرسلا.
     وإخفاقٌ غيرُه (الدخول أو الشبكة) يوقف الدورة: لا خمسون محاولةً فاشلةً على Gmail في دقيقة.

   ⚠️ **ولا أثرَ في سجلّ الأكاديميّة** — المساحةُ الخاصّة لا تمرّ بجداولها ولا أثرِها (CLAUDE.md). فالوظيفةُ في
   `JOBS` بعلامة `private`، و`runJob` لا يكتب لها أثرا. وما فعلته يُقرأ في لوحة `/private` على بطاقة كلّ حاجز. */

import type { PrismaClient } from '@prisma/client'
import { AI_JOBS_SLUG, aiJobsSection, seatsLeft, type AiJobsSectionKey } from '../../../src/application/private-course/ai-jobs'
import { publicSiteUrl } from '../site-url'
import { amountJodOf, cardOn, partnerOf } from './registration.service'
import { privateMailReady, sendPrivateMail } from './mailer'
import { reminderHtml, reminderSubject, reminderText, type ReminderKind } from './reminder-mail'

const HOUR = 3_600_000
const DAY = 24 * HOUR

export const REMIND_AFTER_MS = DAY
export const LAST_CHANCE_AFTER_MS = 3 * DAY
/** ساعاتُ الإرسال بتوقيت عمّان — من التاسعة حتى ما قبل التاسعة مساء */
export const SEND_HOURS = { from: 9, to: 21 } as const
const BATCH = 50

export interface ReminderCandidate {
  status: string
  proofKey: string | null
  /** دفع بالبطاقة وأخبر به Stripe — ولو بقي للمراجعة فقد دفع */
  cardPaidAt: Date | null
  /** سجّلا معا: `friend` يدفع عنه صديقُه — فلا يُذكَّر هو، ويُذكَّر من يدفع (٢١ نوفمبر ٢٠٢٦) */
  pairRole: string | null
  sectionKey: string
  createdAt: Date
  remindedAt: Date | null
  lastChanceAt: Date | null
}

/** ساعةُ عمّان (+3 طوال السنة) */
function ammanHour(now: Date): number {
  return (now.getUTCHours() + 3) % 24
}

export function inSendHours(now: Date): boolean {
  const h = ammanHour(now)
  return h >= SEND_HOURS.from && h < SEND_HOURS.to
}

/** أيُّ رسالةٍ حان موعدُها لهذا الحجز — أو لا شيء */
export function dueReminder(r: ReminderCandidate, now: Date): ReminderKind | null {
  if (r.status !== 'pending' || r.proofKey || r.cardPaidAt || r.pairRole === 'friend') return null
  const section = aiJobsSection(r.sectionKey)
  if (!section || now.getTime() >= Date.parse(section.startsAt)) return null
  const age = now.getTime() - r.createdAt.getTime()
  if (!r.lastChanceAt && age >= LAST_CHANCE_AFTER_MS && (!r.remindedAt || now.getTime() - r.remindedAt.getTime() >= DAY)) {
    return 'last_chance'
  }
  if (!r.remindedAt && !r.lastChanceAt && age >= REMIND_AFTER_MS && age < LAST_CHANCE_AFTER_MS) return 'reminder'
  return null
}

export interface PrivateReminderResult {
  job: string
  summaryAr: string
  done: number
  failed: number
  ms: number
}

export async function runPrivateCourseReminders(prisma: PrismaClient, now = new Date()): Promise<PrivateReminderResult> {
  const started = Date.now()
  const out = (summaryAr: string, done = 0, failed = 0): PrivateReminderResult =>
    ({ job: 'private_course_reminders', summaryAr, done, failed, ms: Date.now() - started })

  if (!inSendHours(now)) return out('خارج ساعات الإرسال')
  const ago = (ms: number) => new Date(now.getTime() - ms)
  /* الشرطُ نفسُه في الاستعلام لا بعده — كي لا يملأ الدفعةَ من ينتظر موعدَه فلا يُبلغ من حان */
  const rows = await prisma.privateRegistration.findMany({
    where: {
      courseSlug: AI_JOBS_SLUG, status: 'pending', proofKey: null, cardPaidAt: null, lastChanceAt: null,
      AND: [{ OR: [{ pairRole: null }, { pairRole: 'lead' }] }],
      OR: [
        { remindedAt: null, createdAt: { lte: ago(REMIND_AFTER_MS), gt: ago(LAST_CHANCE_AFTER_MS) } },
        { createdAt: { lte: ago(LAST_CHANCE_AFTER_MS) }, OR: [{ remindedAt: null }, { remindedAt: { lte: ago(DAY) } }] },
      ],
    },
    include: { course: true },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
  })
  const due = rows.map((r) => ({ r, kind: dueReminder(r, now) })).filter((x): x is { r: typeof rows[number]; kind: ReminderKind } => x.kind !== null)
  if (!due.length) return out('لا أحد')
  /* بلا Gmail لا محاولة ولا خطأ يُكتب كلَّ ساعة — ينتظر ضبطه، ثمّ يلحق من حان موعدُه */
  if (!(await privateMailReady(prisma))) return out(`${due.length} بانتظار ضبط Gmail`)

  let reminders = 0
  let lastChances = 0
  let failed = 0
  for (const { r, kind } of due) {
    /* وإن رفع صديقُه الحوالةَ عنهما فقد دُفع — لا يُقال له «لم تدفع» */
    const partner = await partnerOf(prisma, r)
    if (partner?.proofKey || partner?.cardPaidAt) continue
    const section = aiJobsSection(r.sectionKey)!
    const input = {
      kind,
      fullName: r.fullName,
      section,
      payUrl: `${publicSiteUrl()}/ai-jobs/pay/${r.payToken}`,
      card: cardOn(r.course),
      cardChosen: cardOn(r.course) && r.payMethod === 'card',
      seats: seatsLeft(r.sectionKey as AiJobsSectionKey, now.getTime()),
      abroad: r.phoneCountry !== 'JO',
      reference: r.id.slice(0, 8).toUpperCase(),
      amountJod: amountJodOf(r),
      friendName: partner ? partner.fullName.split(' ')[0] : null,
    }
    const sent = await sendPrivateMail(prisma, {
      to: r.email, toName: r.fullName, subject: reminderSubject(kind), html: reminderHtml(input), text: reminderText(input),
    })
    const stamp = kind === 'last_chance' ? { lastChanceAt: now } : { remindedAt: now }
    if (sent.ok) {
      await prisma.privateRegistration.update({ where: { id: r.id }, data: { ...stamp, reminderError: null } })
      if (kind === 'last_chance') lastChances += 1
      else reminders += 1
      continue
    }
    failed += 1
    await prisma.privateRegistration.update({
      where: { id: r.id },
      data: { reminderError: sent.error, ...(sent.recipient ? stamp : {}) },
    })
    if (!sent.recipient) break
  }
  const parts = [
    reminders ? `تذكير ${reminders}` : '',
    lastChances ? `آخر فرصة ${lastChances}` : '',
    failed ? `تعذر ${failed}` : '',
  ].filter(Boolean)
  return out(parts.join(' — ') || 'لا أحد', reminders + lastChances, failed)
}
