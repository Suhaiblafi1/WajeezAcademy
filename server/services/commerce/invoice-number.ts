/* رقمُ الفاتورة — يُحجز في معاملة الطلب بقفلٍ، لا بعدٍّ يسبق الكتابة.

   ═══ العطبُ الذي كُتب له ═══

   كان الرقمُ `count + 1` يُقرأ في كلّ معاملةٍ وحدَها. فشراءان في اللحظة نفسِها
   يقرآن العددَ نفسَه ويكتبان الرقمَ نفسَه، فيسقط الثاني بخطأ فرادةٍ خامٍ لا يفهمه
   المشتري — ويضيع طلبُه ومقعدُه. وأُمسك في المرحلة ٤(أ): شراءان متزامنان على كودٍ
   واحد لم يبلغ ثانيهما الكوبونَ أصلا، سقط على رقم الفاتورة.

   وعطبٌ ثانٍ في `count` نفسِه: رقمٌ يقع فوق العدد (فاتورةٌ حُذفت، أو رقمٌ كُتب
   خارج التسلسل) يجعل `count + 1` رقما محجوزا — فيصطدم به كلُّ شراءٍ بعده.

   ═══ فصار: قفلٌ في المعاملة، ثمّ أوّلُ رقمٍ خالٍ من `count + 1` ═══

   `pg_advisory_xact_lock` يُمسك حتّى تُثبَّت المعاملةُ أو تُردّ: الثاني ينتظر
   الأوّلَ ثمّ يعدّ ففاتورتُه فيه. ولا ثغرةَ في التسلسل: معاملةٌ رُدّت لم تكتب
   رقما، فيأخذه من بعدها.

   والتسلسلُ هو القائمُ بعينه — عددُ الفواتير كلِّها ثمّ واحد، والسنةُ سنةُ
   الإصدار — فلا يقفز رقمٌ في الدفتر بهذا الإصلاح. وإنّما يُتخطّى المحجوزُ إلى
   ما بعده بدل أن يُصطدم به. */

import type { Prisma } from '@prisma/client'

/** فضاءُ أقفال التجارة في القاعدة — بالصيغة الثنائيّة، فلا يلتقي بقفل العامل
    الخلفيّ (`server/worker/index.ts`، مفتاحٌ واحدٌ من ٦٤ بتا) */
export const COMMERCE_LOCKS = 7101

/** قفلُ تسلسل الفواتير داخلَ ذلك الفضاء */
const INVOICE_SEQUENCE = 1

/** أبعدُ ما يُتخطّى من أرقامٍ محجوزةٍ متتالية — حارسٌ لا حالةٌ متوقَّعة */
const MAX_SKIP = 1000

export async function nextInvoiceNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${COMMERCE_LOCKS}::int, ${INVOICE_SEQUENCE}::int)`
  const year = now.getFullYear()
  let n = (await tx.invoice.count()) + 1
  for (let skipped = 0; skipped < MAX_SKIP; skipped += 1, n += 1) {
    const number = `WJ-INV-${year}-${String(n).padStart(5, '0')}`
    const taken = await tx.invoice.findUnique({ where: { number }, select: { id: true } })
    if (!taken) return number
  }
  throw new Error(`تعذّر حجزُ رقم فاتورة — ${MAX_SKIP} رقمٍ متتالٍ محجوزةٌ بعد العدد`)
}
