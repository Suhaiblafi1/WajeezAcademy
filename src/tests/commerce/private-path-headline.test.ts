/* عنوانُ «مسار {الاسم}: {هدف}» والسطرُ تحته — آليّان من دوراته ونموذج منحته (٨ نوفمبر ٢٠٢٦).
   طلبُ صاحب المنصّة: «عنوانٌ أطولُ للمسار، جملةٌ فيها ملخّصٌ عن الهدف العامّ لدوراته أو تخصّصه أو مسمّاه المهنيّ»،
   و«نصٌّ أكثرُ عمقا وشرحا في السطر الثاني» — واختار الآليَّ على الحقول. والشرحُ في `private-path.ts`. */
import { describe, expect, it } from 'vitest'
import { GOAL_BY_FAMILY, PATH_SUBTITLE_AR, privatePathHeadline } from '@/application/commerce/private-path'
import { COURSE_DOMAIN_FAMILIES, courseDomain } from '@/application/catalog/course-domain'
import { CAREER_LEVELS } from '@/application/commerce/grant-landing'

const c = (courseId: string, titleAr: string) => ({ courseId, titleAr, domainAr: courseDomain(courseId) })
/* حركاتُ الإعراب — الشدّةُ وحدَها تبقى (قرارُ ١١ أكتوبر ٢٠٢٦) */
const HARAKAT = /[ً-ِْ]/

describe('عنوان المسار الخاص والسطر تحته', () => {
  it('العنوان «مسار {الاسم}: {هدف}» من أكثر مجالات دوراته، واثنان على الأكثر', () => {
    const h = privatePathHeadline({
      firstName: 'صهيب', workField: 'الإدارة والقيادة', careerLevel: 'مدير',
      courses: [c('C-MGR-101', 'قيادة الفريق'), c('C-DAT-101', 'لوحات المؤشرات'), c('C-MGR-102', 'إدارة الأداء'), c('C-AI-101', 'الذكاء الاصطناعي للمدير')],
    })
    expect(h.titleAr).toBe(`مسار صهيب: ${GOAL_BY_FAMILY.MGR} و${GOAL_BY_FAMILY.DAT}`)
    expect(h.titleAr).not.toContain(GOAL_BY_FAMILY.AI)
  })

  it('السطر تحته يقول مستواه ومجال عمله ومجالي دوراته وأولها وآخرها', () => {
    const h = privatePathHeadline({
      firstName: 'صهيب', workField: 'الإدارة والقيادة', careerLevel: 'مدير',
      courses: [c('C-MGR-101', 'قيادة الفريق'), c('C-DAT-101', 'لوحات المؤشرات'), c('C-BIZ-101', 'نموذج العمل')],
    })
    expect(h.subtitleAr).toContain('اخترنا لك 3 دورات تناسب دورك كمدير في الإدارة والقيادة')
    expect(h.subtitleAr).toContain(`«${courseDomain('C-MGR-101')}» و«${courseDomain('C-DAT-101')}»`)
    expect(h.subtitleAr).toContain('تبدأ بـ«قيادة الفريق» وتنتهي بـ«نموذج العمل»')
  })

  it('بلا نموذج منحة: «تبني على خبرتك» ولا مجال عمل يخترع', () => {
    const h = privatePathHeadline({ firstName: 'سارة', workField: null, careerLevel: null, courses: [c('C-MKT-101', 'التسويق الرقمي')] })
    expect(h.titleAr).toBe(`مسار سارة: ${GOAL_BY_FAMILY.MKT}`)
    expect(h.subtitleAr).toMatch(/^اخترنا لك دورة واحدة تبني على خبرتك، /)
    expect(h.subtitleAr).not.toMatch(/ في (أخرى|طالب جامعي|أبحث عن عمل)/)
    const other = privatePathHeadline({ firstName: 'سارة', workField: 'أبحث عن عمل', careerLevel: null, courses: [c('C-JOB-101', 'المقابلة')] })
    expect(other.subtitleAr).not.toContain('في أبحث عن عمل')
  })

  it('ولا مجال معروفا لدوراته: يعود العنوان والسطر كما كانا', () => {
    const h = privatePathHeadline({ firstName: 'سارة', workField: null, careerLevel: null, courses: [c('C-ZZZ-101', 'دورة')] })
    expect(h).toEqual({ titleAr: 'مسار سارة', subtitleAr: PATH_SUBTITLE_AR })
  })

  it('لكل عائلة مسماة هدف، ولكل مستوى في نموذج المنحة جملته، وكلها بلا تشكيل', () => {
    for (const f of COURSE_DOMAIN_FAMILIES) expect(GOAL_BY_FAMILY[f], `عائلة ${f} بلا هدف`).toBeTruthy()
    for (const g of Object.values(GOAL_BY_FAMILY)) expect(g, g).not.toMatch(HARAKAT)
    for (const level of CAREER_LEVELS) {
      const h = privatePathHeadline({ firstName: 'أ', workField: null, careerLevel: level, courses: [c('C-HR-101', 'أ'), c('C-HR-102', 'ب')] })
      expect(h.subtitleAr, level).not.toContain('تبني على خبرتك تبني')
      expect(h.subtitleAr, level).not.toMatch(HARAKAT)
      expect(h.titleAr, level).not.toMatch(HARAKAT)
    }
  })
})
