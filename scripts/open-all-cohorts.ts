#!/usr/bin/env node
/* فتحُ شعبةٍ لكلّ دورة منشورة — بتاريخٍ افتراضيّ وسعرِ القائمة.
 *
 * الأسعار لا تظهر للزائر لأنّ الصفحة تقرؤها من الشعب لا من الكتالوج: رقمٌ
 * لا تسنده شعبةٌ قابلة للتسجيل وعدٌ يفترق عن الفاتورة. فما لا شعبة له لا
 * سعر له، وهذا مقصود.
 *
 * فحتّى تظهر الأسعار تُفتح الشعب. وهذا السكربت يفتح واحدةً لكلّ دورة
 * منشورة ليست لها شعبةٌ مفتوحة، ببداية بعد ستّة أسابيع من اليوم.
 *
 *   npx tsx scripts/open-all-cohorts.ts              يعرض ولا يكتب
 *   npx tsx scripts/open-all-cohorts.ts --apply      ينفّذ
 *   npx tsx scripts/open-all-cohorts.ts --weeks 8    يغيّر البعد الزمني
 */

import { getPrisma } from '../server/db/client'

const APPLY = process.argv.includes('--apply')
const wi = process.argv.indexOf('--weeks')
const WEEKS = wi !== -1 && process.argv[wi + 1] ? Number(process.argv[wi + 1]) : 6
const CAPACITY = 20

if (!Number.isFinite(WEEKS) || WEEKS < 1) {
  console.error('‏--weeks يحتاج عددا موجبا')
  process.exit(1)
}

const main = async () => {
  const prisma = await getPrisma()
  const courses = await prisma.course.findMany({
    where: { status: 'published' },
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 },
      cohorts: { select: { id: true, status: true, registrationOpen: true } },
    },
    orderBy: { id: 'asc' },
  })

  const startsAt = new Date(Date.now() + WEEKS * 7 * 86_400_000)
  startsAt.setUTCHours(15, 0, 0, 0) // ١٨:٠٠ بتوقيت عمّان

  let opened = 0
  let already = 0
  let skipped = 0

  for (const c of courses) {
    const live = c.cohorts.some((h) => ['open', 'full', 'active'].includes(h.status) && h.registrationOpen)
    if (live) { already++; continue }
    if (c.listPrice === null) {
      console.log(`⏭  ${c.id} — بلا سعر قائمة، لا تُفتح بسعرٍ مُختلَق`)
      skipped++
      continue
    }
    const title = c.versions[0]?.titleAr ?? c.id
    console.log(`${APPLY ? '✔' : '·'} ${c.id} — ${Number(c.listPrice)} ${c.listCurrency} · تبدأ ${startsAt.toISOString().slice(0, 10)}`)
    if (APPLY) {
      await prisma.cohort.create({
        data: {
          courseId: c.id,
          title: `${title} — الدفعة الأولى`,
          status: 'open',
          startsAt,
          daysOfWeek: ['tue', 'thu'],
          startTime: '18:00',
          timezone: 'Asia/Amman',
          capacity: CAPACITY,
          price: Number(c.listPrice),
          currency: c.listCurrency ?? 'USD',
          language: 'العربية',
          deliveryMode: 'remote',
          registrationOpen: true,
          financialReady: true,
        },
      })
    }
    opened++
  }

  console.log('')
  console.log(`دورات منشورة: ${courses.length} · ${APPLY ? 'فُتحت' : 'ستُفتح'} ${opened} · لها شعبةٌ أصلا ${already} · مُتخطّاة ${skipped}`)
  if (!APPLY && opened > 0) console.log('لم يُكتب شيء. للتنفيذ: npx tsx scripts/open-all-cohorts.ts --apply')
}

main().catch((e) => { console.error(e); process.exit(1) })
