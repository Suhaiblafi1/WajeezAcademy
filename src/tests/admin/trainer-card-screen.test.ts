/* بطاقةُ المدرّب في «المدربون» — بنيةٌ لا نصّ (١٩ أكتوبر ٢٠٢٦).

   كان عمودُ «مسند إلى» يقرأ `assignments` — جدولَ الإسناد القديم — فيقول «لا إسناد نشط» لمدرّبةٍ لها شعبٌ
   قائمة. فالبطاقةُ تقرأ `cohorts` تحت كلّ دورة، والملفُّ العامُّ يقول من وضع الصورةَ ومن كتب النبذة.
   والتعليقاتُ تُنزع قبل الفحص: ذكرُ «assignments» في تعليقٍ لا يُسقطه، وغيابُ النداء يُسقطه. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const screen = readFileSync(join(process.cwd(), 'src/pages/admin/TrainerRunOps.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('بطاقة المدرب', () => {
  it('شعبه تحت دوراته في كل بطاقة — لا جدول الإسناد القديم', () => {
    expect(screen).toMatch(/<TrainerCourses\s+trainer=\{t\}\s*\/>/)
    expect(screen, 'رجع عمود «مسند إلى» القديم').not.toMatch(/\bt\.assignments\b/)
    expect(screen).toMatch(/t\.cohorts\.filter\(\(c\) => c\.courseId === x\.courseId\)/)
  })

  it('وكل شعبة بسطرها ووسم خطتها، والعداد في رأسها', () => {
    expect(screen).toMatch(/cohortLineAr\(c, fmtDate\)/)
    expect(screen).toMatch(/planMarkAr\(c, fmtDate\)/)
    expect(screen).toMatch(/cohortsTallyAr\(t\.cohorts\)/)
  })

  it('والملف العام يقول من وضع الصورة ومن كتب النبذة', () => {
    expect(screen).toMatch(/photoTrailAr\(\{[^}]*trail: trainer\.trail \}/)
    expect(screen).toMatch(/textTrailAr\(\{[^}]*trail: trainer\.trail \}/)
  })
})
