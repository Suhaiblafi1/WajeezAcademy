#!/usr/bin/env node
/* حذف بيانات الديمو والاختبار من قاعدةٍ حيّة.
 *
 * `seed:demo` مكتوبٌ لبيئة العرض المحلية («لا تُشغَّل في الإنتاج» في رأس
 * الملف) — وقد شُغّل على الإنتاج. فصار الزائر يرى على صفحة الدورة شعبةً
 * اسمها «شعبة ديمو»، ومدرّبا اسمه «أستاذ رامي — مدرب ديمو»، وجلسةً عنوانها
 * «بيانات ديمو». واسمُ مدرّبٍ مُختلَق يُعرض كحقيقة هو أخطرها: القاعدة في هذه
 * المنصّة أن لا اسم مدرّب يُعرض قبل توثيقه واعتماده.
 *
 * وتعريف «الديمو» هنا لا يُخمَّن: حسابات البذر كلّها على نطاق wajeez.local،
 * وشعبه تحمل «ديمو» في عنوانها. وما سوى ذلك يُطلب صراحةً بـ--title.
 *
 *   npx tsx scripts/purge-demo-data.ts                    يعرض ولا يحذف
 *   npx tsx scripts/purge-demo-data.ts --apply            ينفّذ
 *   npx tsx scripts/purge-demo-data.ts --title "شعبة اختبار" --apply
 *
 * ولا يحذف ما دفع فيه حسابٌ حقيقيّ: شعبةٌ لها طلبٌ من مستخدمٍ خارج نطاق
 * الديمو تُترك ويُقال ذلك — حذفُ سجلٍّ ماليٍّ لحسابٍ حقيقيّ لا يُصحَّح بعده.
 */

import { getPrisma } from '../server/db/client'

const APPLY = process.argv.includes('--apply')
const DEMO_DOMAIN = '@wajeez.local'
const TITLE_MARKS = ['ديمو', 'تجريبي', 'تجربة']
const extra = process.argv.indexOf('--title')
if (extra !== -1 && process.argv[extra + 1]) TITLE_MARKS.push(process.argv[extra + 1])

const main = async () => {
  const prisma = await getPrisma()
  const say = (s: string) => console.log(s)

  /* ١) الحسابات: نطاق wajeez.local وحده — لا تخمين على الأسماء */
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
    select: { id: true, email: true, displayName: true },
  })
  const demoIds = new Set(demoUsers.map((u) => u.id))

  /* ٢) الشعب: عنوانٌ يحمل علامة، أو كلّ طلباتها من حسابات ديمو */
  const cohorts = await prisma.cohort.findMany({
    include: { enrollmentRequests: { select: { userId: true, orderId: true, status: true } } },
  })
  const marked = cohorts.filter((c) => TITLE_MARKS.some((m) => c.title.includes(m)))

  say(`حسابات ديمو (${DEMO_DOMAIN}): ${demoUsers.length}`)
  for (const u of demoUsers) say(`   · ${u.displayName} <${u.email}>`)
  say('')
  say(`شعب موسومة: ${marked.length}`)

  let blocked = 0
  let deletedUsers = 0
  const removable: typeof marked = []
  for (const c of marked) {
    const outsiders = c.enrollmentRequests.filter((r) => !demoIds.has(r.userId))
    if (outsiders.length > 0) {
      say(`   ⛔ «${c.title}» — ${outsiders.length} طلبا من حسابٍ حقيقيّ: تُترك. عالجها يدويا.`)
      blocked++
      continue
    }
    say(`   ${APPLY ? '✔' : '·'} «${c.title}» (${c.courseId}) — ${c.enrollmentRequests.length} طلبا ديمو`)
    removable.push(c)
  }

  if (APPLY) {
    for (const c of removable) {
      /* العلاقات غير المتتالية تُنظَّف يدويا قبل الشعبة */
      await prisma.enrollmentRequest.deleteMany({ where: { cohortId: c.id } })
      await prisma.trainerCourseAssignment.deleteMany({ where: { cohortId: c.id } })
      await prisma.trainerChangeRequest.deleteMany({ where: { cohortId: c.id } })
      await prisma.cohort.delete({ where: { id: c.id } })
    }
    /* الحسابات آخرا: سجلّاتها تتتالى معها، وحذفُها قبل الشعب يترك يتامى.

       وأربع علاقاتٍ على User وُضعت RESTRICT بقصد — الحذف يُمنع بها لا يُتتالى:
       AdvisorAssignment · Enrollment · Rating · SupportTicket. وهي تمنع أن
       يُمحى مستشارٌ من تحت حالةٍ قائمة أو مقيّمٌ من تحت تقييمٍ معلَن. فلحساب
       الديمو تُحذف صراحةً وبترتيبها، ولحسابٍ حقيقيّ لا يصل السكربت أصلا. */
    for (const u of demoUsers) {
      await prisma.advisorAssignment.deleteMany({ where: { advisorId: u.id } })
      await prisma.enrollment.deleteMany({ where: { userId: u.id } })
      await prisma.rating.deleteMany({ where: { raterId: u.id } })
      await prisma.supportTicket.deleteMany({ where: { userId: u.id } })
      /* الفاتورة تمنع حذف طلبها، والطلب يمنع حذف صاحبه. وهذا صواب: سجلٌّ
         ماليٌّ لا يُمحى تبعا لحذف حساب. ولحساب الديمو تُحذف صراحةً وبترتيبها
         — فاتورتُه ديمو مثله، وبقاؤها يُبقي الحساب ويُبقي اسمه على الشاشة. */
      const orders = await prisma.order.findMany({ where: { userId: u.id }, select: { id: true } })
      if (orders.length > 0) {
        const ids = orders.map((o) => o.id)
        const invoices = await prisma.invoice.findMany({ where: { orderId: { in: ids } }, select: { id: true } })
        /* السلسلة كاملةً بترتيبها: دفعة ← فاتورة ← طلب ← حساب. كلٌّ منها
           يمنع سابقه بقصد، فلا يُمحى سجلٌّ ماليّ تبعا لحذف حساب. */
        if (invoices.length > 0) {
          await prisma.payment.deleteMany({ where: { invoiceId: { in: invoices.map((i) => i.id) } } })
          await prisma.invoice.deleteMany({ where: { id: { in: invoices.map((i) => i.id) } } })
        }
        await prisma.order.deleteMany({ where: { id: { in: ids } } })
      }
      try {
        await prisma.user.delete({ where: { id: u.id } })
        deletedUsers++
      } catch (e) {
        /* يبقى مانعٌ لم نعرفه — يُقال صراحةً ولا يُعدّ محذوفا */
        console.error(`   ⚠️  تعذّر حذف ${u.email}: ${String(e).replace(/\s+/g, ' ').slice(0, 120)}`)
      }
    }
  }

  say('')
  /* العدد المعلن هو ما وقع فعلا لا ما نُوي: قال التقرير مرّة «٥ حسابا» وقد
     حُذف ثلاثة، فبدا التنظيف تامّا وهو ناقص. */
  say(`${APPLY ? 'حُذف' : 'سيُحذف'}: ${removable.length} شعبة · ${APPLY ? deletedUsers : demoUsers.length} حسابا · مُتروك ${blocked}`)
  if (APPLY && deletedUsers < demoUsers.length) {
    say(`⚠️  بقي ${demoUsers.length - deletedUsers} حسابا لم يُحذف — انظر التحذيرات أعلاه.`)
  }
  if (!APPLY && (removable.length > 0 || demoUsers.length > 0)) {
    say('لم يُحذف شيء. للتنفيذ: npx tsx scripts/purge-demo-data.ts --apply')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
