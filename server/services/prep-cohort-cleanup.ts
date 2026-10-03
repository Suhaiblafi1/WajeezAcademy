/* شعبُ الإعداد التي يخلّفها حذفُ مدرّب — تُلغى معه (٣ أكتوبر ٢٠٢٦).

   بلاغُ صاحب المنصّة: «حذفتُ مدرّبا نهائيّا ومازالت دورتُه هنا». وشعبةُ
   الإعداد مسوّدةٌ قامت له وحدَه (`trainer-prep.service.ts`): لا متعلّمَ فيها
   ولا تُنشَر. فإن ذهب صاحبُها بقيت مسوّدةً لا يعبّئها أحد، وخطّتُها في طابور
   الاعتماد تنتظر قرارا لن يقرأه أحد.

   فتُلغى — لا تُمحى: المسوّدةُ يقودها هو وحدَه، ولا تسجيلَ فيها ولا طلبَ
   تسجيل. وما سوى ذلك (شعبةٌ فُتحت، أو فيها متعلّم) لا يُمَسّ هنا: ذاك طريقُه
   الرحيلُ (`trainer-departure.service.ts`) الذي يفتح لكلّ متعلّمٍ صفّا. */

import type { Prisma } from '@prisma/client'

export async function retireOrphanPrepCohorts(tx: Prisma.TransactionClient, profileId: string): Promise<number> {
  const led = await tx.cohortTrainer.findMany({
    where: { profileId, role: 'lead', cohort: { status: 'draft' } },
    select: { cohortId: true },
  })
  if (led.length === 0) return 0
  const ids = led.map((l) => l.cohortId)
  const [enrolled, requested, others] = await Promise.all([
    tx.enrollment.findMany({ where: { cohortId: { in: ids } }, select: { cohortId: true } }),
    tx.enrollmentRequest.findMany({ where: { cohortId: { in: ids } }, select: { cohortId: true } }),
    tx.cohortTrainer.findMany({ where: { cohortId: { in: ids }, profileId: { not: profileId } }, select: { cohortId: true } }),
  ])
  const keep = new Set([...enrolled, ...requested, ...others].map((r) => r.cohortId))
  const orphan = ids.filter((id) => !keep.has(id))
  if (orphan.length === 0) return 0
  const r = await tx.cohort.updateMany({ where: { id: { in: orphan } }, data: { status: 'cancelled' } })
  return r.count
}
