/* عنوانُ الشعبة تحت دورتها لا يكرّر اسمَها (٨ نوفمبر ٢٠٢٦) — `src/application/learning/cohort-title.ts` */
import { describe, expect, it } from 'vitest'
import { distinctCohortTitle } from '@/application/learning/cohort-title'

const COURSE = 'العلاقات العامة والاتصال المؤسسي: بناء السمعة وإدارة الرسائل والتعامل مع الإعلام'

describe('عنوان الشعبة تحت دورتها', () => {
  it('⚠️ اسم الدورة نفسه — بـ«دورة» أو بلاها، وبتشكيل أو همزات مختلفة — لا يعرض', () => {
    expect(distinctCohortTitle(`دورة ${COURSE}`, COURSE)).toBeNull()
    expect(distinctCohortTitle(COURSE, COURSE)).toBeNull()
    expect(distinctCohortTitle('دورة الإقناع والتواصل المؤثّر: بناء الحجّة ومعالجة الاعتراض', 'الاقناع والتواصل المؤثر - بناء الحجة ومعالجة الاعتراض')).toBeNull()
    expect(distinctCohortTitle('دورة خطة العمل للمشاريع الصغيرة: من نموذج العمل إلى خطةٍ مكتوبةٍ يقرؤها مموِّل', 'خطة العمل للمشاريع الصغيرة: من نموذج العمل إلى خطة مكتوبة يقرؤها ممول')).toBeNull()
  })
  it('⚠️ بعض اسم الدورة لا يزيد شيئا — لا يعرض', () => {
    expect(distinctCohortTitle('دورة العلاقات العامة', COURSE)).toBeNull()
  })
  it('⚠️ اسم الدورة وزيادة — تعرض الزيادة وحدها', () => {
    expect(distinctCohortTitle(`دورة ${COURSE} — الشعبة المسائية`, COURSE)).toBe('الشعبة المسائية')
    expect(distinctCohortTitle(`${COURSE} (للقطاع الحكومي)`, COURSE)).toBe('للقطاع الحكومي')
  })
  it('⚠️ عنوان مختلف يعرض كما هو، والفارغ لا شيء', () => {
    expect(distinctCohortTitle('شعبة رمضان المسائية', COURSE)).toBe('شعبة رمضان المسائية')
    expect(distinctCohortTitle('', COURSE)).toBeNull()
    expect(distinctCohortTitle(null, COURSE)).toBeNull()
    expect(distinctCohortTitle('شعبة الصباح', null)).toBe('شعبة الصباح')
  })
})
