/* المراجعُ يقرّر على الطلب كاملا لا على نصفه.

   الخادمُ يُرسل صفَّ الطلب كلَّه (`...app`)، وكانت الشاشةُ تقرأ منه
   ستّةَ حقول وتُسقط الباقي: الهاتفَ، وحالتَه المهنيّة، وخبرةَ التدريب
   المنفصلة عن خبرة المجال، وتوفّرَه، وموافقتَه على الدرس التجريبيّ،
   ولغاتِ تدريبه ونمطَه — و**الدوراتِ التي يستطيع تدريسها**.

   وهذه الأخيرة جوابُ سؤالٍ أعدنا تصميم النموذج كلَّه لأجله، وعليها
   يُسنَد المدرّب إلى شعبةٍ بعد الاعتماد. فمن يقرّر بلا رؤيتها يقرّر بلا
   أهمّ ما في الطلب. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const SCREEN = 'src/pages/admin/TrainerApplications.tsx'
const DOSSIER = 'src/pages/admin/ApplicationDossier.tsx'

describe('ملفّ المتقدّم في شاشة المراجعة', () => {
  it('١) الشاشة تعرض الملفّ لا تقرأ حقولا بيدها', () => {
    const src = read(SCREEN)
    expect(src, 'لا ملفَّ معروضا').toContain('<ApplicationDossier')
    /* والقراءةُ اليدويّة للحقول عادت حشوا يُنسى فيه ما يُضاف */
    expect(src, 'عادت قراءةُ الحقول بالتحويل اليدويّ').not.toContain('a.targetAudiences as string[]')
  })

  it('٢) وكلُّ حقلٍ يملؤه المتقدّم له موضعٌ يُقرأ فيه', () => {
    const d = read(DOSSIER)
    const mustShow = [
      'phone', 'employmentStatus', 'trainingYears', 'domainYears',
      'teachableCourseIds', 'teachableOther', 'availability', 'demoConsent',
      'trainingLanguages', 'deliveryMode', 'hasAccreditation',
      'targetCountries', 'targetAudiences', 'youtubeUrl', 'instagramUrl',
    ]
    for (const field of mustShow) {
      expect(d, `الحقل ${field} لا يُعرض للمراجع`).toContain(field)
    }
  })

  it('٣) والدوراتُ تُعرض بأسمائها من الكتالوج لا بمعرّفاتها', () => {
    const d = read(DOSSIER)
    expect(d, 'المعرّفاتُ تُعرض خاما — لا يقرأها مراجع').toContain('courseById(id)?.name')
  })

  it('٤) وغيابُ الموافقة على الدرس التجريبيّ يُنبَّه عليه لا يُمرَّر', () => {
    const d = read(DOSSIER)
    expect(d).toContain('لم يوافق — وهو شرطُ الاعتماد')
  })

  it('٥) وما لم يذكره المتقدّم يُقال إنّه لم يذكره — لا يُترك فراغا', () => {
    const d = read(DOSSIER)
    expect(d).toContain('— لم يذكره')
    expect(d).toContain('— لم يحدّد ساعاته')
  })

  it('٦) والخادمُ ما زال يُرسل الصفَّ كاملا — وإلّا فرغ الملفّ بلا خطأ', () => {
    const svc = read('server/services/trainer-review.service.ts')
    expect(svc, 'التفصيلُ صار انتقائيّا فتختفي حقولٌ من الشاشة بلا إنذار').toMatch(/return \{\s*\n\s*\.\.\.app,/)
  })
})
