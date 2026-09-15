/* مرجعُ طلب المدرّب — `WJ-TR-<سنة>-<خمسة أرقام>`، ومصدرُه أعلى رقمٍ صُرف.

   ═══ لماذا لا يُعدّ من الصفوف ═══

   كان المرجعُ `count() + 1` في موضعَين (التقديمُ العامّ، والإضافةُ المباشرةُ
   من الإدارة). والعدُّ ينقص بالحذف النهائيّ (`purge`) ولا ينقص أعلى رقمٍ
   صُرف: يُحذف طلبٌ في الوسط فيصير «العددُ + ١» رقمَ طلبٍ قائم، ويسقط كلُّ
   تقديمٍ جديدٍ على قيد التفرّد بـ`P2002` — ويقرأ المتقدّمُ «خطأ داخلي غير
   متوقع» بينما الدخولُ يعمل، لأنّ الدخولَ لا يصرف مرجعا.

   وقع في الإنتاج في ١٥ سبتمبر ٢٠٢٦: حُذفت طلباتُ الاختبار بقرار صاحب المنصّة
   (١٤ سبتمبر)، فأُغلق «انضم كمدرّب» على كلّ من طرقه حتّى يعود العدُّ فوق
   أعلى رقم. وحارسُه `server/tests/trainer/reference-after-purge.test.ts`.

   ═══ ولماذا تُقرأ الأرقامُ كلُّها لا «الأعلى» نصّا ═══

   `orderBy: reference desc` يقيس نصّا، ومرجعٌ على غير الصيغة (تكتبه بعضُ
   الاختبارات مثل `WJ-TR-OTHER-…`) تسبق حروفُه الأرقامَ فيُقرأ «أعلى» وهو ليس
   رقما — فيسقط المولّدُ إلى ١ ويتصادم. فتُقرأ مراجعُ السنة كلُّها ويُؤخذ
   أكبرُ ما كان رقما؛ والجدولُ بحجم طلبات الانضمام لا بحجم السجلّات.

   ═══ والموضعان يأخذان من هنا ═══

   مولّدٌ واحد، فلا يفترق الطريقان بعد شهر: ما يُصلَح هنا يُصلَح فيهما معا. */

import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

const PREFIX = 'WJ-TR-'
const WIDTH = 5

/** يصرف المرجعَ التالي لهذه السنة — أعلى رقمٍ قائمٍ + ١، ولو حُذف ما بينهما */
export async function nextTrainerApplicationReference(db: Db): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `${PREFIX}${year}-`
  const rows = await db.trainerApplication.findMany({
    where: { reference: { startsWith: prefix } },
    select: { reference: true },
  })
  let highest = 0
  for (const { reference } of rows) {
    const tail = reference.slice(prefix.length)
    if (!/^\d+$/.test(tail)) continue
    highest = Math.max(highest, Number(tail))
  }
  return `${prefix}${String(highest + 1).padStart(WIDTH, '0')}`
}

/* ═══ تصادمٌ نادرٌ لا يُترك للصدفة ═══

   طلبان يُقدَّمان في اللحظة نفسِها يقرآن أعلى رقمٍ واحدا ويصرفان مرجعا واحدا،
   فيمرّ أحدُهما ويسقط الآخرُ على قيد التفرّد. والعلاجُ أن يُعاد ما سقط لهذا
   السبب بعينه — مرّةً أو مرّتين — لا أن يقرأ المتقدّمُ «خطأ داخلي». والحدُّ
   ثلاثٌ: ما يتصادم ثلاثا متتاليةً ليس صدفةً بل عطبٌ يجب أن يُرى. */
export const REFERENCE_ATTEMPTS = 3

/** أهذا سقوطُ تفرّدٍ على عمود المرجع بعينه؟ — لا أيُّ `P2002` كان */
export function isReferenceCollision(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: unknown; meta?: { target?: unknown } }
  if (e.code !== 'P2002') return false
  const target = e.meta?.target
  if (Array.isArray(target)) return target.includes('reference')
  return typeof target === 'string' && target.includes('reference')
}
