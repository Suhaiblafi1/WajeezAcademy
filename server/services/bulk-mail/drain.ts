/* ═══ تفريغُ البريد الجماعيّ — بابٌ وحدَه بمهلته (٢٢ نوفمبر ٢٠٢٦) ═══

   حملةُ عشرين ألفا لا تُفرَّغ من باب الطابور العامّ (`drainOutbox`): ذاك ستّون رسالةً في الدقيقة داخلَ دورة العامل
   المتتابعة، فتأخذ الحملةُ خمسَ ساعاتٍ ونصفا، ولو كانت فيه لوقف العاجلُ خلفها. فلها حلقةٌ في العامل تجري إلى جانب
   دورته (`server/worker/index.ts`)، وكلُّ رسالةٍ منها تنتظر دورَها من مهلة العامل المشتركة (`mail-pacer.ts`) بأولويّةٍ
   دون العاجل. فلا يخرج من العامل كلِّه أكثرُ من ثمانٍ في الثانية، والعاجلُ يسبق.

   · **وما أُوقف لا يخرج**: الإيقافُ يحذف ما لم يخرج (`stopCampaign`)، فيُسأل عن الصفّ قبل إرساله لا عند جلبه —
     دفعةٌ جُلبت قبل الإيقاف لا تُرسَل بعده.
   · **وحدُّ الثانية ليس سقوطا**: ردُّ Resend «تجاوزت الحدّ» لا يرفع عدّادَ المحاولات — الرسالةُ لم يرفضها أحد — وتقف
     الدورةُ وتعود بعد مهلة. فإن كانت خطّةُ Resend أبطأَ ممّا ظُنّ لم تُحرق الحملة.
   · **والمتنُ يُمحى ساعةَ تخرج** كما في الطابور كلِّه.
   · **ومن مُرسِل حملته** (`MailCampaign.fromEmail`، نطاقٌ فرعيّ) لا من مُرسِل الأكاديميّة — ولا يُرسَل بلا مُرسِلٍ صريح:
     حملةٌ بلا مُرسِلٍ محفوظٍ تأخذ إعدادَ الحملات (`sender.ts`) لا نطاقَ الحساب.
   · **ولا قبل موعد مرحلته** (`notBefore`): اليومُ الثاني ينتظر يومَه.

   والحارس: `server/tests/commerce/bulk-mail.test.ts` و`server/tests/notifications/bulk-mail-pacing.test.ts`. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { OUTBOX_MAX_ATTEMPTS, type OutboxSender } from '../outbox.service'
import { sendDirectEmail } from '../notification.service'
import { RESEND_RATE_LIMIT_AR } from '../mail'
import { bulkSender } from './sender'
import { BULK_MAIL_PURPOSE } from '../../../src/application/marketing/bulk-mail'

export interface BulkRun {
  sent: number
  failed: number
  /** ردّه حدُّ الثانية — فتقف الحلقةُ قليلا */
  rateLimited: boolean
  remaining: number
}

const defaultSend = (prisma: PrismaClient): OutboxSender => (to, subject, text, html, _ics, unsubscribeUrl, from) =>
  sendDirectEmail(prisma, { to, subject, text, html, ...(unsubscribeUrl ? { unsubscribeUrl } : {}), ...(from ? { from } : {}) })

/** ما حلّ موعدُه من البريد الجماعيّ — بلا موعدٍ أو موعدُه مضى */
const dueNow = (now: Date) => ({
  purpose: BULK_MAIL_PURPOSE, status: 'queued', attempts: { lt: OUTBOX_MAX_ATTEMPTS },
  OR: [{ notBefore: null }, { notBefore: { lte: now } }],
}) satisfies Prisma.OutboxMailWhereInput

export async function drainBulkMail(
  prisma: PrismaClient,
  opts: { limit: number; pace?: () => Promise<void>; send?: OutboxSender; now?: Date },
): Promise<BulkRun> {
  const send = opts.send ?? defaultSend(prisma)
  const now = opts.now ?? new Date()
  const due = await prisma.outboxMail.findMany({
    where: dueNow(now),
    orderBy: { createdAt: 'asc' },
    take: opts.limit,
    select: { id: true, to: true, subject: true, text: true, html: true, unsubscribeUrl: true, attempts: true, batchId: true },
  })
  /* مُرسِلُ كلّ دفعة — من حملتها، وإلّا فإعدادُ الحملات: لا نطاقُ الحساب أبدا */
  const batches = [...new Set(due.map((r) => r.batchId).filter((b): b is string => !!b))]
  const campaigns = batches.length === 0 ? [] : await prisma.mailCampaign.findMany({
    where: { batchId: { in: batches } }, select: { batchId: true, fromName: true, fromEmail: true },
  })
  const fallback = await bulkSender(prisma)
  const fromOf = (batchId: string | null) => {
    const c = campaigns.find((x) => x.batchId === batchId)
    return c?.fromEmail ? { name: c.fromName ?? fallback.name, email: c.fromEmail } : { name: fallback.name, email: fallback.email }
  }

  let sent = 0
  let failed = 0
  let rateLimited = false
  for (const row of due) {
    if (opts.pace) await opts.pace()
    /* أُوقفت حملتُه بعد أن جُلب؟ */
    if ((await prisma.outboxMail.count({ where: { id: row.id, status: 'queued' } })) === 0) continue

    const out = await send(row.to, row.subject, row.text ?? '', row.html ?? undefined, undefined, row.unsubscribeUrl ?? undefined, fromOf(row.batchId))
    if (out.status === 'sent') {
      await prisma.outboxMail.updateMany({
        where: { id: row.id },
        data: { status: 'sent', sentAt: new Date(), attempts: { increment: 1 }, lastError: null, text: null, html: null },
      })
      sent += 1
      continue
    }
    if (out.status === 'not_configured') break
    if (out.error === RESEND_RATE_LIMIT_AR) {
      await prisma.outboxMail.updateMany({ where: { id: row.id }, data: { lastError: out.error } })
      rateLimited = true
      break
    }
    const attempts = row.attempts + 1
    await prisma.outboxMail.updateMany({
      where: { id: row.id },
      data: { attempts, lastError: out.error ?? 'سقط الإرسال', status: attempts >= OUTBOX_MAX_ATTEMPTS ? 'failed' : 'queued' },
    })
    failed += 1
  }

  /* ما حلّ موعدُه وحدَه — يومٌ ثانٍ ينتظر غدا ليس «باقيا» تُسرع له الحلقة */
  const remaining = await prisma.outboxMail.count({ where: dueNow(new Date()) })
  return { sent, failed, rateLimited, remaining }
}
