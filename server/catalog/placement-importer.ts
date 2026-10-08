/* استيرادُ أسئلة اختبارات المستوى — إنشاءٌ لا تحديث.

   ملفّان كتبتُهما بقرار صاحب المنصّة:
   · `src/data/placement/english-placement.draft.v1.json` — يُستورَد **مسوّدة**: يراجعه
     مدرّبُ الإنجليزيّة في بوّابته، ولا يُعرض قبل الاعتماد.
   · `src/data/placement/field-checks.draft.v1.json` — فحوصُ المجالات، تُستورَد **معتمَدة**:
     «تُفتح فورا وتُراجَع بعدُ» (٨ أكتوبر ٢٠٢٦).

   وما في القاعدة بعد أوّل استيرادٍ **ملكُ المراجع لا الملفّ**: لو حدّث الاستيرادُ الصفوفَ
   في كلّ نشرٍ لمحا كلَّ تعديلٍ وكلَّ اعتمادٍ وكلَّ إسقاطٍ بنصّ المسوّدة الأولى، بلا أن
   يقول شيئا. فيُنشأ ما ليس موجودا ويُترك ما وُجد كما هو — `upsert` بلا `update`. */

import type { PrismaClient } from '@prisma/client'
import english from '../../src/data/placement/english-placement.draft.v1.json'
import fields from '../../src/data/placement/field-checks.draft.v1.json'
import type { PlacementItem } from '../../src/domain/placement/english-placement'
import type { FieldItem } from '../../src/domain/placement/field-check'

export interface PlacementImportSummary {
  created: number
  kept: number
}

interface Row {
  id: string
  subject: string
  level: string
  skill: string
  passage: string | null
  stem: string
  options: string[]
  answerIndex: number
  position: number
  status: 'draft' | 'approved'
}

export function placementRows(): Row[] {
  const en = (english as { items: PlacementItem[] }).items.map((i, position): Row => ({
    id: i.id, subject: 'english', level: i.level.toLowerCase(), skill: i.skill, passage: i.passage,
    stem: i.stem, options: i.options, answerIndex: i.answer_index, position, status: 'draft',
  }))
  const fx = (fields as { items: FieldItem[] }).items.map((i, position): Row => ({
    id: i.id, subject: i.subject, level: i.level, skill: 'knowledge', passage: null,
    stem: i.stem, options: i.options, answerIndex: i.answer_index, position, status: 'approved',
  }))
  return [...en, ...fx]
}

export async function importPlacementDraft(prisma: PrismaClient): Promise<PlacementImportSummary> {
  const rows = placementRows()
  const existing = new Set(
    (await prisma.placementQuestion.findMany({ select: { id: true } })).map((r) => r.id),
  )
  let created = 0
  for (const r of rows) {
    if (existing.has(r.id)) continue
    await prisma.placementQuestion.upsert({ where: { id: r.id }, update: {}, create: r })
    created += 1
  }
  return { created, kept: rows.length - created }
}
