/* مدرّبُ الشعبة الذي تُحتسب له — موضعٌ واحدٌ لسؤالين ماليّين.

   السؤالُ الأوّل قديم: **لمن تُحتسب أتعابُ هذه الشعبة؟** (`earnings.service`).
   والثاني جديد (٢٧ سبتمبر ٢٠٢٦): **أهذه الدورةُ من دورات صاحب الكود؟** —
   فكودُ المدرّب يقع على دوراته وحدَها ويُحسم من مستحقّاته.

   وهما سؤالٌ واحدٌ بعينه، ويجب أن يُجابا جوابا واحدا: من تُحتسب له الشعبةُ
   هو من «دوراتُه» هي. فلو افترقا لوقع كودُه على شعبةٍ تُحتسب أتعابُها لغيره
   — فيتحمّل خصما عن مالٍ لا يقبضه — أو امتنع عن شعبةٍ يقبض أتعابَها.

   ═══ الأصيلُ يُرشَّح بدوره لا بترتيبٍ أبجديّ ═══

   كان في `earnings.service` `orderBy: { role: 'asc' }` وفي تعليقه «lead قبل
   assistant أبجدياً» — **والتعليقُ خاطئ**: `'assistant' < 'lead'`. فكلُّ شعبةٍ
   فيها مساعدٌ كانت تُحتسب أتعابُها بقاعدة المساعد وبإحالاته هو، والأصيلُ الذي
   وقّع العقدَ لا يرى مقاعدَ رابطه. وبقيّةُ المستودَع كلُّها ترشّح
   `role: 'lead'` صراحةً (التقارير · تقويمُ الفصل · خطّةُ الشعبة).

   وشعبةٌ بلا أصيلٍ لا تُحتسب لمساعدٍ سهوا: تسقط إلى الإسناد النشط، ثمّ إلى
   لا أحد — وخطأٌ يُقرأ خيرٌ من صرفٍ لغير صاحبه. */

import type { Prisma, PrismaClient } from '@prisma/client'

/** القاعدةُ أو معاملةٌ مفتوحةٌ عليها — رصيدُ الكود يُقرأ في معاملة الطلب */
type Db = PrismaClient | Prisma.TransactionClient

/** مدرّبُ شعبةٍ واحدة — أو `null` إن لم يكن لها من تُحتسب له */
export async function cohortLeadTrainer(prisma: PrismaClient, cohortId: string): Promise<string | null> {
  return (await cohortLeadTrainers(prisma, [cohortId])).get(cohortId) ?? null
}

/** مدرّبو شعبٍ كثيرة في استعلامين لا في استعلامٍ لكلّ شعبة — للسلّة */
export async function cohortLeadTrainers(prisma: Db, cohortIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (cohortIds.length === 0) return out
  const leads = await prisma.cohortTrainer.findMany({
    where: { cohortId: { in: [...cohortIds] }, role: 'lead' },
    select: { cohortId: true, profileId: true },
  })
  /* الأوّلُ يغلب كما كان `findFirst` يُعيده — لا آخرُ ما قُرئ */
  for (const l of leads) if (!out.has(l.cohortId)) out.set(l.cohortId, l.profileId)
  const missing = cohortIds.filter((id) => !out.has(id))
  if (missing.length > 0) {
    const assignments = await prisma.trainerCourseAssignment.findMany({
      where: { cohortId: { in: missing }, status: 'active' },
      select: { cohortId: true, profileId: true },
    })
    for (const a of assignments) if (a.cohortId && !out.has(a.cohortId)) out.set(a.cohortId, a.profileId)
  }
  return out
}

/** شعبُ مدرّبٍ التي تُحتسب له — بالقاعدة نفسِها معكوسة: أصيلٌ فيها، أو إسنادُه
    النشطُ في شعبةٍ لا أصيلَ لها. ولرصيد أكواده: «له عندنا» ما يُتوقَّع منها */
export async function leadCohortsOf(
  prisma: Db,
  profileId: string,
  statuses: readonly string[],
): Promise<{ id: string; courseId: string }[]> {
  const [leads, assignments] = await Promise.all([
    prisma.cohortTrainer.findMany({
      where: { profileId, role: 'lead', cohort: { status: { in: [...statuses] } } },
      select: { cohort: { select: { id: true, courseId: true } } },
    }),
    prisma.trainerCourseAssignment.findMany({
      where: { profileId, status: 'active', cohortId: { not: null }, cohort: { status: { in: [...statuses] } } },
      select: { cohort: { select: { id: true, courseId: true } } },
    }),
  ])
  const out = new Map(leads.map((l) => [l.cohort.id, l.cohort]))
  const orphan = assignments.map((a) => a.cohort).filter((c): c is { id: string; courseId: string } => c !== null && !out.has(c.id))
  if (orphan.length > 0) {
    /* والإسنادُ يُحتسب له حيث لا أصيلَ للشعبة وحدَها — كما في `cohortLeadTrainers` */
    const owners = await cohortLeadTrainers(prisma, orphan.map((c) => c.id))
    for (const c of orphan) if (owners.get(c.id) === profileId) out.set(c.id, c)
  }
  return [...out.values()]
}
