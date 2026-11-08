/* عنوانُ «مسار {الاسم الأوّل والأخير} الشخصي» والسطرُ تحته — آليّان (٨ نوفمبر ٢٠٢٦).
   طلبُ صاحب المنصّة: «نصٌّ أكثرُ عمقا وشرحا في السطر الثاني» — واختار الآليَّ على الحقول — ثمّ في العنوان: «غيّرت
   رأيي.. اجعلها "مسار صهيب الخوالدة الشخصي"». والشرحُ في `private-path.ts`. */
import { describe, expect, it } from 'vitest'
import { firstLastNameAr, PATH_SUBTITLE_AR, privatePathHeadline } from '@/application/commerce/private-path'
import { courseDomain } from '@/application/catalog/course-domain'
import { CAREER_LEVELS } from '@/application/commerce/grant-landing'

const c = (courseId: string, titleAr: string) => ({ courseId, titleAr, domainAr: courseDomain(courseId) })
/* حركاتُ الإعراب — الشدّةُ وحدَها تبقى (قرارُ ١١ أكتوبر ٢٠٢٦) */
const HARAKAT = /[ً-ِْ]/

describe('عنوان المسار الخاص والسطر تحته', () => {
  it('⚠️ العنوان «مسار {الأول والأخير} الشخصي» — بلا اسم أوسط', () => {
    expect(firstLastNameAr('  صهيب   عبد الله  الخوالدة ')).toBe('صهيب الخوالدة')
    expect(firstLastNameAr('صهيب')).toBe('صهيب')
    expect(firstLastNameAr(null)).toBe('')
    const h = privatePathHeadline({ name: 'صهيب الخوالدة', workField: null, careerLevel: null, courses: [c('C-MGR-101', 'قيادة الفريق')] })
    expect(h.titleAr).toBe('مسار صهيب الخوالدة الشخصي')
  })

  it('السطر تحته يقول مستواه ومجال عمله وأكثر مجالين في دوراته وأولها وآخرها', () => {
    const h = privatePathHeadline({
      name: 'صهيب الخوالدة', workField: 'الإدارة والقيادة', careerLevel: 'مدير',
      courses: [c('C-MGR-101', 'قيادة الفريق'), c('C-DAT-101', 'لوحات المؤشرات'), c('C-MGR-102', 'إدارة الأداء'), c('C-AI-101', 'نموذج العمل')],
    })
    expect(h.subtitleAr).toContain('اخترنا لك 4 دورات تناسب دورك كمدير في الإدارة والقيادة')
    expect(h.subtitleAr).toContain(`«${courseDomain('C-MGR-101')}» و«${courseDomain('C-DAT-101')}»`)
    expect(h.subtitleAr).not.toContain(courseDomain('C-AI-101'))
    expect(h.subtitleAr).toContain('تبدأ بـ«قيادة الفريق» وتنتهي بـ«نموذج العمل»')
  })

  it('بلا نموذج منحة: «تبني على خبرتك» ولا مجال عمل يخترع', () => {
    const h = privatePathHeadline({ name: 'سارة', workField: null, careerLevel: null, courses: [c('C-MKT-101', 'التسويق الرقمي')] })
    expect(h.subtitleAr).toMatch(/^اخترنا لك دورة واحدة تبني على خبرتك، /)
    const other = privatePathHeadline({ name: 'سارة', workField: 'أبحث عن عمل', careerLevel: null, courses: [c('C-JOB-101', 'المقابلة')] })
    expect(other.subtitleAr).not.toContain('في أبحث عن عمل')
  })

  it('ولا مجال معروفا لدوراته: السطر يعود كما كان والعنوان باق', () => {
    const h = privatePathHeadline({ name: 'سارة', workField: null, careerLevel: null, courses: [c('C-ZZZ-101', 'دورة')] })
    expect(h).toEqual({ titleAr: 'مسار سارة الشخصي', subtitleAr: PATH_SUBTITLE_AR })
  })

  it('لكل مستوى في نموذج المنحة جملته، وكلها بلا تشكيل', () => {
    for (const level of CAREER_LEVELS) {
      const h = privatePathHeadline({ name: 'أ ب', workField: 'الصحة', careerLevel: level, courses: [c('C-HR-101', 'أ'), c('C-HR-102', 'ب')] })
      expect(h.subtitleAr, level).not.toMatch(HARAKAT)
      expect(h.titleAr, level).not.toMatch(HARAKAT)
    }
  })
})
