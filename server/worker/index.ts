#!/usr/bin/env node
/* مُشغِّلُ العامل الخلفيّ — يُكتب اليومَ ويُشغَّل يومَ يوجد خادمٌ دائم.

   لماذا لا يعمل الآن: المنصّةُ على Vercel، ودالّتُها تستيقظ للطلب وتنام
   بعده — فلا موضعَ لحلقةٍ تعمل كلَّ دقيقة. ولذلك بقيت الوعودُ في الطابور.
   والحلُّ خادمٌ دائم (المرحلة ٤ في الخطّة)، وهذا الملفُّ ما سيُشغَّل عليه:
   عمليّةٌ واحدةٌ إلى جانب الخادم، لا خدمةٌ خارجيّةٌ ولا مكتبةُ طوابير.

   ولماذا بلا مكتبةِ طوابير (pg-boss وما شابه): الوظائفُ الخمسُ كلُّها
   **تُعاد بلا ضرر** وتُقاس بالحالة لا بالرسالة — فلا حاجةَ إلى طابورٍ
   دائمٍ يحفظ ما لم يُعمَل. وطابورٌ ثالثٌ بين القاعدةِ والعامل تعقيدٌ يُدار
   ويُراقَب ويُهاجَر. فإن ظهرت وظيفةٌ لا تصلح إعادتُها — إرسالُ مالٍ مثلا —
   فعندها يُعاد النظر، لا قبله.

   ولا يعمل إلّا بعلمٍ صريح: `WORKER_ENABLED=on`. وبلا العلمِ يطبع سببَ
   توقّفه ويخرج بنجاحٍ — لا سقوطٌ يُقلق من شغّله بالخطأ.

   والقفلُ في القاعدة (`pg_advisory_lock`): نسختان من العامل تعملان معا
   تُرسلان تذكيرا مرّتَين. والحرّاسُ داخلَ الوظائف يمنعون ذلك أيضا، لكنّ
   القفلَ أرخصُ من الاعتماد على حارسٍ في كلّ سطر.

   التشغيل:
     WORKER_ENABLED=on DATABASE_URL=… node --import tsx server/worker/index.ts
   ودورةٌ واحدةٌ للفحص:
     WORKER_ENABLED=on npx tsx server/worker/index.ts --once */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { JOBS, runJob, type JobResult } from './jobs'

/** رقمُ القفل — ثابتٌ لهذا العامل وحدَه */
const LOCK_KEY = 918_273_645

/** أقصرُ دورةٍ في القائمة: نبضُ الحلقة */
const TICK_MS = Math.min(...JOBS.map((j) => j.everyMs))

function log(line: string): void {
  process.stdout.write(`[worker ${new Date().toISOString()}] ${line}\n`)
}

/** دورةٌ واحدةٌ لكلّ وظيفةٍ حلَّ موعدُها */
export async function tick(
  prisma: PrismaClient,
  lastRun: Map<string, number>,
  now = new Date(),
): Promise<JobResult[]> {
  const out: JobResult[] = []
  for (const job of JOBS) {
    const last = lastRun.get(job.key) ?? 0
    if (now.getTime() - last < job.everyMs) continue
    lastRun.set(job.key, now.getTime())
    try {
      const result = await runJob(prisma, job.key, now)
      out.push(result)
      /* لا يُطبع إلّا ما عمل: سطرٌ فارغٌ كلَّ دقيقةٍ يُغرق السجلّ */
      if (result.done > 0 || result.failed > 0) log(`${job.titleAr}: ${result.summaryAr} (${result.ms}ms)`)
    } catch (e) {
      /* سقوطُ وظيفةٍ لا يُسقط العامل: الباقياتُ تعمل، وتُعاد هي في الدورة التالية */
      log(`⚠ ${job.titleAr} سقطت: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return out
}

async function main(): Promise<void> {
  if (process.env.WORKER_ENABLED !== 'on') {
    log('غيرُ مفعَّل — يُشغَّل بـ WORKER_ENABLED=on على خادمٍ دائم. لا شيءَ يعمل الآن.')
    return
  }
  const url = process.env.DATABASE_URL
  if (!url) {
    log('لا DATABASE_URL — لا يعمل بلا قاعدة.')
    process.exitCode = 1
    return
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

  /* القفلُ غيرُ الحاجب: إن كانت نسخةٌ أخرى تعمل، نخرج بلا ضجيج */
  const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(${LOCK_KEY}::bigint) AS locked`
  if (!locked) {
    log('نسخةٌ أخرى من العامل تعمل بالفعل — نخرج.')
    await prisma.$disconnect()
    return
  }

  const lastRun = new Map<string, number>()
  const once = process.argv.includes('--once')
  log(`يعمل: ${JOBS.length} وظيفةً، نبضُ الحلقة ${TICK_MS / 1000} ثانية${once ? ' — دورةٌ واحدةٌ ثمّ خروج' : ''}`)

  if (once) {
    const results = await tick(prisma, lastRun)
    for (const r of results) log(`${r.job}: ${r.summaryAr}`)
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_KEY}::bigint)`
    await prisma.$disconnect()
    return
  }

  let stopping = false
  const stop = async () => {
    if (stopping) return
    stopping = true
    log('توقّفٌ مرتَّب — ننهي الدورةَ الحاليّةَ ونُفرج عن القفل.')
    clearInterval(timer)
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_KEY}::bigint)`.catch(() => {})
    await prisma.$disconnect().catch(() => {})
  }
  process.on('SIGTERM', () => void stop())
  process.on('SIGINT', () => void stop())

  let running = false
  const timer = setInterval(() => {
    /* لا دورتان متراكبتان: دورةٌ طويلةٌ لا تُستبق بأخرى */
    if (running || stopping) return
    running = true
    void tick(prisma, lastRun).finally(() => { running = false })
  }, TICK_MS)
  await tick(prisma, lastRun)
}

/* لا يُقلَع عند الاستيراد — كي تُختبَر الوظائفُ والدورةُ بلا تشغيلِ حلقة */
if (process.argv[1]?.includes('worker/index')) void main()
