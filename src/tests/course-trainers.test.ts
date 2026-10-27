/* من يقدّم الدورة — اسمُه من شعبها المفتوحة حيث يُعرض، لا تخصّصٌ ساكنٌ يقول «لم يُعلن».

   ═══ ما كان ═══

   رأسُ صفحة الدورة، ونافذةُ «الفريق التدريبي» وقائمةُ «دورة أو أكثر» في صفحة المسار، كانت تقرأ
   `TRAINER_POOLS` وحدَها. فقِيس في الإنتاج (١٩ أكتوبر ٢٠٢٦): ثمانٍ وعشرون شعبةً مفتوحةً بمدرّبٍ معلَن،
   وكلُّ هذه السطوح تقول «يُعلن المدرب بعد اعتماد الشعبة» — ومنتقي الشعبة تحتها يقول «مع فلان».

   ═══ وما يُحرَس ═══

   ١) الدالّتان بمدخلاتهما: الأسماءُ بلا تكرار، والفريقُ معلَنوه أوّلا، والتخصّصُ يسقط متى أُعلن مدرّبُ دوراته.
   ٢) والصفحتان تقرآن الاسمَ من الشعب بالدالّة — لا من `.name` قائمة التخصّصات.

   ═══ وكيف رُئي ساقطا ═══

   أُعيدت الصفحتان إلى ما كانتا عليه، فسقط حارسا الربط. وأُبقي التخصّصُ في الفريق بعد إعلان مدرّب
   دوراته، فسقط حارسُه. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CARD_FACES_MAX, pathwayTeam, trainerFacesOf, trainerLineAr, trainerNamesOf } from '@/application/catalog/course-trainers'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const PENDING = 'يعلن المدرب بعد اعتماد الشعبة'

describe('اسم مدرب الدورة من شعبها المفتوحة', () => {
  it('الأسماء بلا تكرار وبترتيب الشعب — وبلا شعبة لا اسم', () => {
    expect(trainerNamesOf([{ trainers: ['ريم'] }, { trainers: ['سامر', 'ريم'] }])).toEqual(['ريم', 'سامر'])
    expect(trainerNamesOf(undefined)).toEqual([])
    expect(trainerNamesOf([{ trainers: [] }])).toEqual([])
  })

  it('السطر يقول الاسم حين يعلن، وجملة الانتظار حين لا', () => {
    expect(trainerLineAr(['ريم', 'سامر'], PENDING)).toBe('ريم، سامر')
    expect(trainerLineAr([], PENDING)).toBe(PENDING)
  })

  it('⚠️ الفريق: المعلن باسمه ودوراته أولا، والتخصص يسقط متى أعلن مدرب دوراته', () => {
    const team = pathwayTeam([
      { name: 'دورة أ', role: 'مدرب الأمن', names: ['ريم'] },
      { name: 'دورة ب', role: 'مدرب السحابة', names: [] },
      { name: 'دورة ج', role: 'مدرب الأمن', names: ['ريم'] },
      { name: 'دورة د', role: 'مدرب السحابة', names: [] },
    ], PENDING)
    expect(team.map((t) => [t.title, t.detail])).toEqual([
      ['ريم', 'دورة أ، دورة ج'],
      ['مدرب السحابة', PENDING],
    ])
  })
})

describe('الصفحتان تقرآن الاسم من الشعب — لا من قائمة التخصصات', () => {
  const coursePage = read('src/pages/CoursePath.tsx')
  const pathwayPage = read('src/pages/Pathway.tsx')

  it('⚠️ رأس صفحة الدورة', () => {
    expect(coursePage, 'الرأس لا يقرأ مدرّبي الشعب').toMatch(/trainerNamesOf\(cohorts\.get\(anchor\.id\)\)/)
    expect(coursePage, 'الرأس يعرض التخصص الساكن').not.toMatch(/details\.trainer\.name/)
  })

  it('⚠️ نافذة الفريق وقائمة «دورة أو أكثر» في صفحة المسار', () => {
    expect(pathwayPage, 'الفريق لا يبنى من شعب دوراته').toMatch(/pathwayTeam\(\s*pathwayCoursesList\.map[\s\S]*?trainerNamesOf\(cohorts\.get\(c\.id\)\)/)
    expect(pathwayPage, 'القائمة تعرض التخصص الساكن').not.toMatch(/courseTrainer\(c\)\.name/)
    expect(pathwayPage, 'الفريق يقرأ قائمة التخصصات وحدها').not.toMatch(/pathwayTrainers\(/)
  })
})

/* ═══ ووجوهُهم في بطاقات الرئيسة (٢٦ أكتوبر ٢٠٢٦) ═══
   رُئي ساقطا: أُسقط شرطُ الصورة فرُسم من لا صورةَ له، وأُسقط الدمجُ فتكرّر مدرّبُ دورتين، ونُزع
   الربطُ من شريطٍ فسقط حارسُه. */
describe('وجوه المدربين دوائر متراصة في بطاقات الرئيسة', () => {
  const t = (id: string, photoUrl: string | null) => ({ id, name: `م-${id}`, photoUrl })
  const cohorts = new Map([
    ['c1', [{ trainerProfiles: [t('a', '/a.jpg'), t('b', null)] }, { trainerProfiles: [t('a', '/a.jpg')] }]],
    ['c2', [{ trainerProfiles: [t('a', '/a.jpg'), t('c', '/c.jpg')] }]],
  ])

  it('⚠️ بلا تكرار عبر الدورات والشعب، ومن لا صورة له يعد ولا يرسم', () => {
    const r = trainerFacesOf(['c1', 'c2', 'c-none'], cohorts)
    expect(r.faces.map((f) => f.id)).toEqual(['a', 'c'])
    expect(r.total).toBe(3)
  })

  it('السقف يقص الوجوه ولا يقص العدد', () => {
    const many = new Map([['x', [{ trainerProfiles: Array.from({ length: 7 }, (_, i) => t(`t${i}`, `/${i}.jpg`)) }]]])
    const r = trainerFacesOf(['x'], many)
    expect(r.faces).toHaveLength(CARD_FACES_MAX)
    expect(r.total).toBe(7)
  })

  it('⚠️ شريطا الرئيسة يرسمانها', () => {
    const best = read('src/pages/home/Bestsellers.tsx').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ')
    const paths = best.slice(best.indexOf('morePaths.map'), best.indexOf('moreCourses.length'))
    const courses = best.slice(best.indexOf('moreCourses.map'))
    expect(paths, 'بطاقة المسار بلا وجوه مدربي دوراته').toMatch(/<TrainerFaces \{\.\.\.trainerFacesOf\(b\.item\.courseIds, cohorts\)\}/)
    expect(courses, 'بطاقة الدورة بلا وجوه مدربيها').toMatch(/<TrainerFaces \{\.\.\.trainerFacesOf\(\[b\.item\.id\], cohorts\)\}/)
  })

  /* «طبّق نفس الشيء لبطاقات الدورات والمسارات في صفحة الكل» — قرار صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦) */
  it('⚠️ وبطاقتا صفحة الكل ترسمانها', () => {
    const cat = read('src/pages/Catalog.tsx').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ')
    const paths = cat.slice(cat.indexOf('visiblePathways.map'), cat.indexOf('visibleCourses.map'))
    const courses = cat.slice(cat.indexOf('visibleCourses.map'))
    expect(paths, 'بطاقة المسار بلا وجوه مدربي دوراته').toMatch(/<TrainerFaces \{\.\.\.trainerFacesOf\(p\.courseIds, openCohorts\)\}/)
    expect(courses, 'بطاقة الدورة بلا وجوه مدربيها').toMatch(/<TrainerFaces \{\.\.\.trainerFacesOf\(\[c\.id\], openCohorts\)\}/)
  })
})
