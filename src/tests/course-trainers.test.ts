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
import { pathwayTeam, trainerLineAr, trainerNamesOf } from '@/application/catalog/course-trainers'

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
