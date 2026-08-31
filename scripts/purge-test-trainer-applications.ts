#!/usr/bin/env node
/* حذفُ طلبات المدرّبين التجريبية من الإنتاج — نهائيّا لا تعطيلا.
 *
 * ستّةُ طلباتٍ خلّفتها تجارب النشر والرفع (WJ-TR-2026-00006 … 00011) باسم
 * «اختبار النشر — يُتجاهل». هي مسحوبةٌ فلا تُعرض، لكنّها في القاعدة —
 * وقاعدةُ الإنتاج ليست مكانا لآثار الاختبار.
 *
 * ويمرّ الحذف بالخدمة نفسِها التي يمرّ بها زرُّ اللوحة، فتنطبق حرّاسُها:
 * لا يُحذف من صار مدرّبا، ولا طلبٌ قيد النظر، ولا حذفَ بلا سببٍ يُسجَّل.
 *
 *   npx tsx scripts/purge-test-trainer-applications.ts              يعرض ولا يحذف
 *   npx tsx scripts/purge-test-trainer-applications.ts --apply      ينفّذ
 *   npx tsx scripts/purge-test-trainer-applications.ts --ref WJ-…   طلبٌ بعينه
 */

import { getPrisma } from '../server/db/client'
import { TrainerApplicationService } from '../server/services/trainer-application.service'

const APPLY = process.argv.includes('--apply')
const ri = process.argv.indexOf('--ref')
const ONE = ri !== -1 ? process.argv[ri + 1] : undefined

/* ما يميّز طلبَ اختبارٍ عن طلبٍ حقيقيّ: الاسمُ الذي كُتب به عمدا. ولا يُحذف
   شيءٌ بالتخمين — من أراد غيرَها مرّرها بـ`--ref` واحدةً واحدة. */
const TEST_NAME_MARKERS = ['اختبار النشر', 'اختبار الرفع', 'يُتجاهل']

const main = async () => {
  const prisma = await getPrisma()
  const svc = new TrainerApplicationService(prisma)

  const candidates = ONE
    ? await prisma.trainerApplication.findMany({ where: { reference: ONE } })
    : await prisma.trainerApplication.findMany({
        where: {
          status: { in: ['withdrawn', 'rejected', 'draft', 'email_verification_pending'] },
          OR: TEST_NAME_MARKERS.map((m) => ({ fullName: { contains: m } })),
        },
        orderBy: { reference: 'asc' },
      })

  if (candidates.length === 0) {
    console.log('لا طلبَ اختبارٍ مطابقا. لا شيء يُحذف.')
    return
  }

  console.log(`${candidates.length} طلبا مرشَّحا للحذف:\n`)
  for (const a of candidates) {
    console.log(`${APPLY ? '✔' : '·'} ${a.reference} — ${a.fullName} · ${a.status} · ${a.email}`)
  }

  if (!APPLY) {
    console.log('\nلم يُحذف شيء. للتنفيذ: npx tsx scripts/purge-test-trainer-applications.ts --apply')
    return
  }

  let done = 0
  for (const a of candidates) {
    try {
      /* actorId فارغ: الحذفُ من سكربتِ صيانةٍ لا من إنسانٍ في اللوحة، والسببُ
         يُسجَّل كما هو في `AuditEvent` بـ`actorId = null` أي «فعلٌ نظاميّ». */
      await svc.purge(a.reference, null, 'تنظيفُ آثار تجارب النشر — طلبٌ تجريبيّ لا قيمة له')
      done++
    } catch (e) {
      console.error(`⛔ ${a.reference} — ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  console.log(`\nحُذف ${done} من ${candidates.length}.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
