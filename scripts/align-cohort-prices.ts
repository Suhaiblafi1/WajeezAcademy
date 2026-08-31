#!/usr/bin/env node
/* توحيد أسعار الشعب على سعر قائمة دورتها.
 *
 * سعر القائمة أُضيف بعد أن كانت شعبٌ مفتوحةً بأسعار وعملات كُتبت يدا. والشعبة
 * الجديدة ترثه عند إنشائها (cohort.service.ts)، أمّا القائمة فلا يمسّها شيء —
 * فتقول الصفحة سعرا وتُطالب الفاتورة بغيره، وربّما بعملةٍ أخرى.
 *
 * ويرفض شعبةً دفع فيها أحد: إعادةُ تسعير مقعدٍ مدفوع تُغيّر ما اتُّفق عليه
 * بعد الاتفاق. فالشعبة التي لها طلبٌ مدفوع أو محجوز تُترك ويُقال ذلك صراحةً.
 *
 * والمنطق في `server/services/catalog-readiness.service.ts` — تستدعيه اللوحة
 * أيضا، فلا يفترق الزرّ عن السطر.
 *
 *   npx tsx scripts/align-cohort-prices.ts            يعرض ما سيتغيّر ولا يغيّر
 *   npx tsx scripts/align-cohort-prices.ts --apply    ينفّذ
 */

import { getPrisma } from '../server/db/client'
import { alignCohortPrices } from '../server/services/catalog-readiness.service'

const APPLY = process.argv.includes('--apply')

const main = async () => {
  const prisma = await getPrisma()
  const r = await alignCohortPrices(prisma, { apply: APPLY })

  for (const row of r.rows) {
    if (row.blocked) console.log(`⛔ ${row.title} (${row.courseId}) — ${row.blocked}`)
    else console.log(`${APPLY ? '✔' : '·'} ${row.title} (${row.courseId}) — ${row.from} ← ${row.to}`)
  }

  console.log('')
  console.log(`شعب: ${r.cohorts} · ${APPLY ? 'وُحّدت' : 'ستُوحَّد'} ${r.changed} · مطابقة أصلا ${r.alreadyAligned} · متروكة ${r.skippedCommitted + r.skippedNoListPrice}`)
  if (!APPLY && r.changed > 0) console.log('لم يُكتب شيء. للتنفيذ: npx tsx scripts/align-cohort-prices.ts --apply')
}

main().catch((e) => { console.error(e); process.exit(1) })
