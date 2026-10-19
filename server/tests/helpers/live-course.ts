/* شعبةٌ منشورةٌ يقودها المدرّب — ما يلزمه ليظهر للعامّة.

   قرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦): لا يظهر للعامّة اسمُ مدرّبٍ ولا صورتُه
   إلّا وله دوراتٌ منشورةٌ هذا الفصلَ أو بعده (`trainer-visibility.ts`). فكلُّ
   اختبارٍ يعتمد نشرَ مدرّبٍ ثمّ ينتظر ظهورَه يحتاج له شعبةً كهذه — وإلّا سقط
   لسببٍ غيرِ ما يحرسه. */

import type { PrismaClient } from '@prisma/client'

/** دورةٌ في الكتالوج المبذور — المفتاحُ الخارجيُّ للشعبة يشترط وجودَها */
const COURSE = 'C-BIZ-101'

/** شعبةٌ مفتوحةٌ للتسجيل، والمدرّبُ أصيلُها */
export async function giveLiveCourse(prisma: PrismaClient, profileId: string): Promise<string> {
  const cohort = await prisma.cohort.create({
    data: {
      courseId: COURSE, title: `شعبةٌ منشورةٌ ${profileId.slice(0, 8)}`, status: 'open',
      startsAt: new Date(Date.now() + 14 * 86_400_000),
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
  return cohort.id
}
