#!/usr/bin/env node
/* فتحُ شعبةٍ لكلّ دورة منشورة — بتاريخٍ افتراضيّ وسعرِ القائمة.
 *
 * الأسعار لا تظهر للزائر لأنّ الصفحة تقرؤها من الشعب لا من الكتالوج: رقمٌ
 * لا تسنده شعبةٌ قابلة للتسجيل وعدٌ يفترق عن الفاتورة. فما لا شعبة له لا
 * سعر له، وهذا مقصود.
 *
 * والمنطق في `server/services/catalog-readiness.service.ts` — يستدعيه هذا
 * السكربت وتستدعيه لوحةُ الإدارة، فلا يفترق ما يفعله السطر عمّا يفعله الزرّ.
 * ومن لا يملك طرفيّةً على الإنتاج يفعلها من اللوحة: /admin/cohorts.
 *
 *   npx tsx scripts/open-all-cohorts.ts              يعرض ولا يكتب
 *   npx tsx scripts/open-all-cohorts.ts --apply      ينفّذ
 *   npx tsx scripts/open-all-cohorts.ts --weeks 8    يرفع أقلَّ مهلةٍ للتسجيل
 *
 * ومواعيدُ البدء موزّعةٌ على الفصل الأوّل (موجةٌ كلَّ أسبوع، ستّةُ مواعيدَ
 * متناوبة) لا تاريخٌ واحدٌ للجميع — والتفصيل في الخدمة.
 */

import { getPrisma } from '../server/db/client'
import { openAllCohorts } from '../server/services/catalog-readiness.service'

const APPLY = process.argv.includes('--apply')
const wi = process.argv.indexOf('--weeks')
const WEEKS = wi !== -1 && process.argv[wi + 1] ? Number(process.argv[wi + 1]) : undefined

if (WEEKS !== undefined && (!Number.isFinite(WEEKS) || WEEKS < 1)) {
  console.error('‏--weeks يحتاج عددا موجبا')
  process.exit(1)
}

const main = async () => {
  const prisma = await getPrisma()
  const r = await openAllCohorts(prisma, { apply: APPLY, weeks: WEEKS })

  for (const row of r.rows) {
    if (row.reason) console.log(`⏭  ${row.courseId} — ${row.reason}`)
    else console.log(`${APPLY ? '✔' : '·'} ${row.courseId} — ${row.price} ${row.currency} · تبدأ ${(row.startsAt ?? r.startsAt).slice(0, 10)}`)
  }

  console.log('')
  console.log(
    `دورات منشورة: ${r.publishedCourses} · ${APPLY ? 'هُيّئت' : 'ستُهيّأ'} ${APPLY ? r.opened + r.prepared : r.opened}`
    + (APPLY ? ` (فُتحت ${r.opened} · بقيت مسوّدةً ${r.prepared})` : '')
    + ` · لها شعبةٌ أصلا ${r.alreadyLive} · مُتخطّاة ${r.skippedNoListPrice}`,
  )
  /* ما هُيّئ ولم يُفتح: الشرطُ الناقص يُطبع، فلا يُترك أحدٌ يظنّ أنّ الشعبةَ للبيع */
  const blocked = r.rows.filter((x) => x.blocked?.length)
  if (blocked.length > 0) {
    console.log(`\nهُيّئت ولم تُفتح (${blocked.length}) — وما ينقصها:`)
    for (const x of blocked) console.log(`  · ${x.titleAr}: ${x.blocked!.join(' — ')}`)
  }
  if (!APPLY && r.opened > 0) console.log('لم يُكتب شيء. للتنفيذ: npx tsx scripts/open-all-cohorts.ts --apply')
}

main().catch((e) => { console.error(e); process.exit(1) })
