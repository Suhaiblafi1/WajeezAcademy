#!/usr/bin/env node
/* توحيد أسعار الشعب على سعر قائمة دورتها.
 *
 * سعر القائمة أُضيف بعد أن كانت شعبٌ مفتوحةً بأسعار وعملات كُتبت يدا. والشعبة
 * الجديدة ترثه عند إنشائها (cohort.service.ts)، أمّا القائمة فلا يمسّها شيء —
 * فتقول الصفحة سعرا وتُطالب الفاتورة بغيره، وربّما بعملةٍ أخرى.
 *
 * وهذا السكربت يوحّدها، ويرفض شعبةً دفع فيها أحد: إعادةُ تسعير مقعدٍ مدفوع
 * تُغيّر ما اتُّفق عليه بعد الاتفاق. فالشعبة التي لها طلبٌ مدفوع أو محجوز
 * تُترك ويُقال ذلك صراحةً.
 *
 *   npx tsx scripts/align-cohort-prices.ts            يعرض ما سيتغيّر ولا يغيّر
 *   npx tsx scripts/align-cohort-prices.ts --apply    ينفّذ
 */

import { getPrisma } from '../server/db/client'

const APPLY = process.argv.includes('--apply')

const main = async () => {
  const prisma = await getPrisma()
  const cohorts = await prisma.cohort.findMany({
    include: {
      course: { select: { id: true, listPrice: true, listCurrency: true } },
      enrollmentRequests: { select: { status: true, orderId: true } },
    },
    orderBy: { id: 'asc' },
  })

  let changed = 0
  let skipped = 0
  let already = 0

  for (const c of cohorts) {
    const list = c.course?.listPrice
    if (list === null || list === undefined) {
      console.log(`⏭  ${c.title} (${c.courseId}) — دورتها بلا سعر قائمة`)
      skipped++
      continue
    }
    const target = Number(list)
    const targetCur = c.course?.listCurrency ?? 'USD'
    const current = c.price === null ? null : Number(c.price)

    if (current === target && c.currency === targetCur) { already++; continue }

    /* مقعدٌ محجوز أو مدفوع = اتفاقٌ قائم على سعرٍ بعينه */
    const committed = c.enrollmentRequests.filter((r) => r.status === 'seat_held' || r.status === 'converted' || r.orderId)
    if (committed.length > 0) {
      console.log(`⛔ ${c.title} (${c.courseId}) — ${committed.length} مقعدا محجوزا/مدفوعا: لا يُعاد تسعيرها. عالجها يدويا.`)
      skipped++
      continue
    }

    console.log(`${APPLY ? '✔' : '·'} ${c.title} (${c.courseId}) — ${current ?? 'بلا سعر'} ${c.currency} ← ${target} ${targetCur}`)
    if (APPLY) {
      await prisma.cohort.update({
        where: { id: c.id },
        data: { price: target, currency: targetCur, financialReady: true },
      })
    }
    changed++
  }

  console.log('')
  console.log(`الشعب: ${cohorts.length} · ${APPLY ? 'حُدّثت' : 'ستُحدَّث'} ${changed} · مطابقة أصلا ${already} · مُتخطّاة ${skipped}`)
  if (!APPLY && changed > 0) console.log('لم يُكتب شيء. للتنفيذ: npx tsx scripts/align-cohort-prices.ts --apply')
}

main().catch((e) => { console.error(e); process.exit(1) })
