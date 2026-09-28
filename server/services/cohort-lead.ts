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

import type { PrismaClient } from '@prisma/client'

/** مدرّبُ شعبةٍ واحدة — أو `null` إن لم يكن لها من تُحتسب له */
export async function cohortLeadTrainer(prisma: PrismaClient, cohortId: string): Promise<string | null> {
  return (await cohortLeadTrainers(prisma, [cohortId])).get(cohortId) ?? null
}

/** مدرّبو شعبٍ كثيرة في استعلامين لا في استعلامٍ لكلّ شعبة — للسلّة */
export async function cohortLeadTrainers(prisma: PrismaClient, cohortIds: readonly string[]): Promise<Map<string, string>> {
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
