/* استيرادُ مسوّدة اختبار تحديد مستوى الإنجليزيّة — إنشاءٌ لا تحديث.

   الملفُّ `src/data/placement/english-placement.draft.v1.json` مسوّدةٌ كتبتُها بقرار
   صاحب المنصّة، ويراجعها مدرّبُ الإنجليزيّة في بوّابته: يعدّل النصَّ ويعتمد أو يُسقط.
   فما في القاعدة بعد أوّل استيرادٍ **ملكُ المراجع لا الملفّ**: لو حدّث الاستيرادُ
   الصفوفَ في كلّ نشرٍ لمحا كلَّ تعديلٍ وكلَّ اعتمادٍ بنصّ المسوّدة الأولى، بلا أن
   يقول شيئا.

   فيُنشأ ما ليس موجودا ويُترك ما وُجد كما هو — `upsert` بلا `update`. وسؤالٌ جديدٌ
   يُضاف إلى الملفّ غدا يدخل مسوّدةً ينتظر المراجعة كغيره. */

import type { PrismaClient } from '@prisma/client'
import draft from '../../src/data/placement/english-placement.draft.v1.json'
import type { PlacementItem } from '../../src/domain/placement/english-placement'

export interface PlacementImportSummary {
  created: number
  kept: number
}

export async function importPlacementDraft(prisma: PrismaClient): Promise<PlacementImportSummary> {
  const items = (draft as { items: PlacementItem[] }).items
  const existing = new Set(
    (await prisma.placementQuestion.findMany({ select: { id: true } })).map((r) => r.id),
  )
  let created = 0
  for (const [position, i] of items.entries()) {
    if (existing.has(i.id)) continue
    await prisma.placementQuestion.upsert({
      where: { id: i.id },
      update: {},
      create: {
        id: i.id,
        level: i.level.toLowerCase(),
        skill: i.skill,
        passageEn: i.passage,
        stemEn: i.stem,
        options: i.options,
        answerIndex: i.answer_index,
        position,
      },
    })
    created += 1
  }
  return { created, kept: items.length - created }
}
