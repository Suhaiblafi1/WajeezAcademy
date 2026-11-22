/* ═══ حلقةُ البريد الجماعيّ — إلى جانب دورة العامل لا داخلها (٢٢ نوفمبر ٢٠٢٦) ═══

   دورةُ العامل (`tick`) تُجري وظائفَها واحدةً بعد واحدة كلَّ دقيقة. وحملةُ عشرين ألفا بثمانٍ في الثانية تأخذ نحوَ
   ثلاثٍ وأربعين دقيقةً متّصلة — فلو كانت وظيفةً في الدورة لأمسكتها عن تذكير الجلسات وطابور الإشعارات طوالَها. فهي
   حلقةٌ وحدَها تجري معها، وتتقاسمان مهلةً واحدة (`workerMailPacer`): العاجلُ أوّلا، والمجموعُ لا يتجاوز الحدّ.

   ودورةُ الحلقة الواحدة (`bulkMailCycle`) تقول كم تنتظر قبل التالية: لا شيءَ إن كان في الطابور ما يُرسل، وخمسَ
   ثوانٍ إن فرغ، وعشرا إن ردّها حدُّ الثانية، ونصفَ دقيقةٍ إن كانت قناةُ البريد غيرَ موصولة. */

import type { PrismaClient } from '@prisma/client'
import { liveChannels } from '../services/notification.service'
import { drainBulkMail } from '../services/bulk-mail/drain'
import { finalizeCampaigns } from '../services/bulk-mail/bulk-mail.service'
import { workerMailPacer } from '../services/mail-pacer'

/** ما يُجلب في الدورة الواحدة — خمسُ ثوانٍ بثمانٍ في الثانية، فالإيقافُ يُرى سريعا */
export const BULK_CYCLE_LIMIT = 40

export interface BulkCycle {
  sent: number
  failed: number
  /** كم تنتظر الحلقةُ قبل الدورة التالية */
  waitMs: number
  /** حملاتٌ انتهت في هذه الدورة */
  finished: string[]
}

export async function bulkMailCycle(prisma: PrismaClient): Promise<BulkCycle> {
  if (!(await liveChannels(prisma)).includes('email')) return { sent: 0, failed: 0, waitMs: 30_000, finished: [] }
  const run = await drainBulkMail(prisma, { limit: BULK_CYCLE_LIMIT, pace: () => workerMailPacer.acquire('bulk') })
  const finished = await finalizeCampaigns(prisma)
  const waitMs = run.rateLimited ? 10_000 : run.remaining > 0 ? 0 : 5_000
  return { sent: run.sent, failed: run.failed, waitMs, finished }
}

/** الحلقةُ نفسُها — تعمل حتّى يُطلب الوقوف، وسقوطُ دورةٍ لا يُسقطها */
export async function runBulkMailLoop(
  prisma: PrismaClient,
  opts: { stopping: () => boolean; log: (line: string) => void },
): Promise<void> {
  const sleep = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms) })
  while (!opts.stopping()) {
    let wait = 5_000
    try {
      const out = await bulkMailCycle(prisma)
      wait = out.waitMs
      if (out.finished.length > 0) opts.log(`البريد الجماعي: انتهت ${out.finished.length} حملة`)
    } catch (e) {
      opts.log(`⚠ البريد الجماعي سقطت دورته: ${e instanceof Error ? e.message : String(e)}`)
      wait = 30_000
    }
    if (wait > 0) await sleep(wait)
  }
}
