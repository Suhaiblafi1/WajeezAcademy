/* حارسٌ على وعدٍ يُقنِع ثمّ لا يوجد.

   كانت ثلاثٌ من خمس قصص تبيع مساراتٍ لا وجودَ لها في الكتالوج: «مسار تجربة
   المستخدم الاحترافي» و«SQL واستخراج البيانات» و«موظف خدمة الجمهور (ترشيح
   حكومي)». فالزائر يقرأ القصّة فيقتنع، ثمّ يبحث عمّا اقتنع به فلا يجده.
   وذلك أسوأُ من قصّةٍ ضعيفة: وعدٌ لا يُوفى.

   ولا يكفي تصحيحُها مرّة: يكفي أن يُضاف نموذجٌ جديد بعنوانٍ جميل لتعود
   الفجوة. فالحارس بنيويّ — كلُّ `pathwayId` وكلُّ `id` دورةٍ في كلّ قصّة
   يجب أن يوجد في الكتالوج، وأن تكون الدورةُ من مسار القصّة نفسِه، وأن
   يُنقَل مشروعُ التخرّج عن الكتالوج حرفا لا صياغةً قريبة. */

import '../setup-catalog'
import { describe, expect, it } from 'vitest'
import { stories } from '@/data/stories'
import { pathwayById } from '@/data/pathways'
import { courseById, pathwayCourses } from '@/data/courses'
import { getCoreCatalogRaw } from '@/data/core-catalog-source'

describe('كل قصّة مربوطة بالكتالوج', () => {
  it('١) لا قصّةَ بلا مسارٍ موجود', () => {
    for (const s of stories) {
      expect(pathwayById(s.pathwayId), `مسار القصّة «${s.name}» غير موجود: ${s.pathwayId}`).toBeTruthy()
    }
  })

  it('٢) اسم المسار المعروض هو اسمه في الكتالوج', () => {
    for (const s of stories) {
      expect(pathwayById(s.pathwayId)?.name, `اسم مسار «${s.name}» يفارق الكتالوج`).toBe(s.pathway)
    }
  })

  it('٣) كل دورةٍ في القصّة موجودة، ومن مسار القصّة نفسِه', () => {
    for (const s of stories) {
      const ofPathway = pathwayCourses[s.pathwayId] ?? []
      for (const c of s.courses) {
        expect(courseById(c.id), `دورة «${c.name}» في قصّة ${s.name} غير موجودة: ${c.id}`).toBeTruthy()
        expect(ofPathway, `دورة ${c.id} ليست من مسار ${s.pathwayId}`).toContain(c.id)
        expect(courseById(c.id)?.name, `اسم الدورة ${c.id} يفارق الكتالوج`).toBe(c.name)
      }
    }
  })

  it('٤) مشروع التخرّج منقولٌ عن الكتالوج حرفا', () => {
    const raw = getCoreCatalogRaw()
    for (const s of stories) {
      const p = raw.launch_pathways.find((x) => x.id === s.pathwayId)
      expect(p?.capstone, `مشروع تخرّج قصّة ${s.name} يفارق الكتالوج`).toBe(s.capstone)
    }
  })

  it('٥) المدّة وساعاتها من الكتالوج لا من الخيال', () => {
    const raw = getCoreCatalogRaw()
    for (const s of stories) {
      const p = raw.launch_pathways.find((x) => x.id === s.pathwayId)
      expect(p?.duration_weeks, `مدّة قصّة ${s.name} تفارق الكتالوج`).toBe(s.weeks)
    }
  })

  it('٦) لكلّ قصّةٍ قياسُ قبل/بعد — فالنتيجةُ تُروى وهذا يُقاس', () => {
    for (const s of stories) {
      expect(s.measure.length, `قصّة ${s.name} بلا قياس`).toBeGreaterThanOrEqual(2)
      for (const m of s.measure) {
        expect(m.before.trim().length).toBeGreaterThan(3)
        expect(m.after.trim().length).toBeGreaterThan(3)
      }
    }
  })

  it('٧) لا اسمَ مدرّبٍ في نصوص القصص — القاعدة لم تتغيّر', () => {
    const blob = JSON.stringify(stories)
    expect(blob).not.toContain('المدرب:')
    expect(blob).not.toContain('trainer')
  })
})
