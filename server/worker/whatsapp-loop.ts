/* حلقةُ الإرسال على واتساب — إلى جانب دورة العامل لا داخلها، كالبريد الجماعيّ (٢٤ نوفمبر ٢٠٢٦).
   وسرعتُها أربعٌ في الثانية: دون حدّ Meta بكثير، فالإيقافُ يُرى سريعا. */

import type { PrismaClient } from '@prisma/client'
import { drainWhatsApp, finishCampaigns, pruneMessages } from '../services/whatsapp/send.service'

export const WHATSAPP_CYCLE_LIMIT = 20
const PACE_MS = 250
const PRUNE_EVERY_MS = 6 * 3_600_000

export async function runWhatsAppLoop(prisma: PrismaClient, opts: { stopping: () => boolean; log: (line: string) => void }): Promise<void> {
  const sleep = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms) })
  let pruned = 0
  while (!opts.stopping()) {
    let wait = 5_000
    try {
      const out = await drainWhatsApp(prisma, { limit: WHATSAPP_CYCLE_LIMIT, pace: () => sleep(PACE_MS) })
      wait = out.waitMs
      const done = await finishCampaigns(prisma)
      if (done > 0) opts.log(`واتساب: انتهى ${done} إرسال`)
      if (Date.now() - pruned > PRUNE_EVERY_MS) { await pruneMessages(prisma); pruned = Date.now() }
    } catch (e) {
      opts.log(`⚠ واتساب سقطت دورته: ${e instanceof Error ? e.message : String(e)}`)
      wait = 30_000
    }
    if (wait > 0) await sleep(wait)
  }
}
