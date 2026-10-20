/* اقتراحُ اسمِ الدورة من أسماء شعبها — `course-name-suggest.ts`.

   يحرس ثلاثا: أنّ ما يخصّ الشعبةَ يُنزع (رقمُها وشهرُها وسنتُها وفصلُها)، وأنّ
   ما يساوي الاسمَ الحاليَّ لا يُعرض اقتراحا، وأنّ الجامعَ يجمع الكلماتِ المشتركةَ
   بترتيبها ولا يُعرض قلبا من كلمةٍ واحدة. */

import { describe, expect, it } from 'vitest'
import {
  cleanSectionNameAr, suggestCourseNames, tidyCourseTitleAr,
} from '../../application/catalog/course-name-suggest'
import { cohortTitleAr } from '../../application/learning/cohort-title'

describe('تنظيفُ اسم الشعبة', () => {
  it('ينزع الاسمَ الافتراضيّ «— شعبة N» فيبقى اسمُ الدورة', () => {
    expect(cleanSectionNameAr(cohortTitleAr('إدارة المشاريع', 3))).toBe('إدارة المشاريع')
  })

  it('ينزع الدفعةَ والشهرَ والسنةَ والفصلَ وإن تتابعت', () => {
    expect(cleanSectionNameAr('التسويق الرقمي - الدفعة الثانية (أكتوبر 2026)')).toBe('التسويق الرقمي')
    expect(cleanSectionNameAr('القيادة التحويلية | فصل الخريف ٢٠٢٦')).toBe('القيادة التحويلية')
    expect(cleanSectionNameAr('تحليل البيانات تشرين الأول')).toBe('تحليل البيانات')
  })

  it('ينزع «دورة» من رأس الاسم والتشكيلَ من حروفه', () => {
    expect(cleanSectionNameAr('دورة في إدارةِ الوقتِ')).toBe('إدارة الوقت')
  })

  it('لا يمسّ اسما ليس فيه ما يخصّ الشعبة', () => {
    expect(cleanSectionNameAr('مهارات العرض والإلقاء')).toBe('مهارات العرض والإلقاء')
  })
})

describe('اقتراحاتُ الاسم', () => {
  it('لا يقترح شيئا حين تحمل الشعبُ اسمَ الدورة الافتراضيَّ وحدَه', () => {
    const titles = [cohortTitleAr('إدارة المشاريع', 1), cohortTitleAr('إدارة المشاريع', 2)]
    expect(suggestCourseNames('إدارة المشاريع', titles)).toEqual([])
  })

  it('يعرض اسمَ كلّ شعبةٍ مرّةً، والأكثرُ شعبا أوّلا', () => {
    const out = suggestCourseNames('أساسيات التسويق', [
      'التسويق الرقمي للمشاريع الصغيرة — شعبة ١',
      'تسويق المحتوى — شعبة ٢',
      'تسويق المحتوى - الدفعة الثالثة',
    ])
    expect(out.filter((s) => s.kind === 'cohort').map((s) => [s.titleAr, s.cohortCount])).toEqual([
      ['تسويق المحتوى', 2],
      ['التسويق الرقمي للمشاريع الصغيرة', 1],
    ])
  })

  it('يقترح اسما جامعا من الكلمات المشتركة بترتيبها — وأوّلا', () => {
    const out = suggestCourseNames('الدورة ١٠١', [
      'إدارة المشاريع الاحترافية — شعبة ١',
      'إدارة المشاريع الاحترافية بمنهجية أجايل',
    ])
    expect(out[0]).toEqual({ titleAr: 'إدارة المشاريع الاحترافية', kind: 'combined', cohortCount: 2 })
  })

  it('يطابق «القيادة» و«قيادة» في الجمع ولا يُبقي حرفَ جرٍّ في طرفه', () => {
    const out = suggestCourseNames('دورة أ', ['مهارات القيادة في العمل', 'مهارات قيادة الفرق في'])
    expect(out[0]?.titleAr).toBe('مهارات القيادة')
  })

  it('لا يعرض جامعا من كلمةٍ واحدة', () => {
    const out = suggestCourseNames('دورة أ', ['فن العرض', 'العرض المؤثر'])
    expect(out.some((s) => s.kind === 'combined')).toBe(false)
  })

  it('لا يعرض جامعا يساوي اسمَ الدورة الحاليّ', () => {
    const out = suggestCourseNames('إدارة المشاريع', [
      'إدارة المشاريع الاحترافية', 'إدارة المشاريع بأجايل',
    ])
    expect(out.map((s) => s.kind)).toEqual(['cohort', 'cohort'])
  })
})

describe('ترتيبُ الاسم المكتوب', () => {
  it('يطوي المسافاتِ وينزع التشكيلَ ويُبقي الشدّة', () => {
    expect(tidyCourseTitleAr('  إدارةُ   المشاريعِ الفعّالة ')).toBe('إدارة المشاريع الفعّالة')
  })
  it('يردّ القصيرَ والطويلَ جدّا', () => {
    expect(tidyCourseTitleAr('ab')).toBeNull()
    expect(tidyCourseTitleAr('x'.repeat(121))).toBeNull()
  })
})
