/* ═══ «دوراتي» قائمةٌ واحدة — الخطوة F (١٩ أكتوبر ٢٠٢٦) ═══

   درس صاحبُ المنصّة جانبَ المدرّب واختار («All, in order»): كانت الدورةُ تصل المدرّبَ من ثلاثة أبواب،
   ولكلٍّ أزرارُه وكلماتُ حاله، وما أُسند إليه مباشرةً لا يُرى في «دوراتي» أصلا — فيقرأ المدرّبُ النشطُ
   «لا دورة بعد» وهو يدرّس (العطبُ الرابعُ في دراسة جانب المدرّب).

   ① صفٌّ لكلّ دورةٍ من الأبواب كلّها، وحالُها كلمةٌ واحدة — ومنها ما له شعبةٌ بلا عرض.
   ② والصفحةُ تبني صفوفَها من ذلك وحدَه، ولا لوحَ ثانيا للدورات فوقها.
   ③ و«دوراتي المقترحة» و«مساراتي» قسمان فيها لا لسانان في القائمة — ومساراهما القديمان يُحالان إليهما.

   والفحصُ على البنية: الدالّةُ تُنادى، والشيفرةُ تُقرأ بلا تعليقاتها. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildMyCourses, type MyCourseCohort, type MyCourseOffer, type MyCoursePrep } from '@/application/trainer/my-courses'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const NOW = Date.parse('2026-10-19T10:00:00Z')
const qual = (courseId: string, title = courseId) => ({ courseId, title, currentVersion: 1, qualifiedAt: '2026-09-01T00:00:00Z' })
const cohort = (courseId: string, status: string, planStatus = 'approved', id = `${courseId}-${status}`): MyCourseCohort =>
  ({ id, title: `شعبة ${courseId}`, courseId, courseTitle: courseId, status, planStatus })
const offer = (courseId: string, status: string, expiresAt = '2026-10-25T00:00:00Z', offeredAt = '2026-10-10T00:00:00Z'): MyCourseOffer =>
  ({ id: `${courseId}-${status}-${offeredAt}`, status, courseId, courseTitleAr: courseId, expiresAt, offeredAt })
const prep = (courseId: string, state: MyCoursePrep['state'], cohortId: string | null = null): MyCoursePrep =>
  ({ courseId, titleAr: courseId, state, cohortId })
const build = (x: { quals?: ReturnType<typeof qual>[]; offers?: MyCourseOffer[]; prep?: MyCoursePrep[]; cohorts?: MyCourseCohort[] }) =>
  buildMyCourses({ quals: x.quals ?? [], offers: x.offers ?? [], prep: x.prep ?? [], cohorts: x.cohorts ?? [], now: NOW })

describe('① صفٌّ لكلّ دورة، وحالٌ واحدة', () => {
  it('⚠️ الدورةُ التي له فيها شعبةٌ بلا عرضٍ ولا إعداد — تُرى «تدرّسها» (كانت تغيب فيقرأ «لا دورة بعد»)', () => {
    const rows = build({ quals: [qual('ai')], cohorts: [cohort('ai', 'active')] })
    expect(rows.map((r) => [r.courseId, r.labelAr])).toEqual([['ai', 'تدرّسها']])
    expect(rows[0].cohorts.map((c) => c.id)).toEqual(['ai-active'])
  })

  it('والتي انتهت شعبُها كلُّها — «درّستها»، والملغاةُ لا تُعدّ', () => {
    expect(build({ cohorts: [cohort('a', 'completed')] })[0].labelAr).toBe('درّستها')
    expect(build({ quals: [qual('b')], cohorts: [cohort('b', 'cancelled')] })[0].labelAr).toBe('معتمدة لك')
  })

  it('والمسوّدةُ بحال خطّتها: تعدّها · أرسلت · ردّت', () => {
    expect(build({ cohorts: [cohort('a', 'draft', 'draft')] })[0].state).toBe('preparing')
    expect(build({ cohorts: [cohort('a', 'draft', 'submitted')] })[0].state).toBe('submitted')
    expect(build({ cohorts: [cohort('a', 'draft', 'changes_requested')] })[0].state).toBe('returned')
  })

  it('العرضُ المفتوحُ يحكم — ولو كانت له شعبةٌ في الدورة', () => {
    const rows = build({ cohorts: [cohort('a', 'active')], offers: [offer('a', 'offered')] })
    expect(rows[0].state).toBe('decide')
    expect(rows[0].openOffer?.status).toBe('offered')
    /* وكذلك على دورة الإعداد: العرضُ ينتظر جوابا، والإعدادُ يُكمَل بعده */
    expect(build({ prep: [prep('a', 'preparing', 'c1')], offers: [offer('a', 'offered')] })[0].state).toBe('decide')
  })

  it('ودورةُ الإعداد بحالها، والمعتذَرُ عنها سابقة', () => {
    expect(build({ prep: [prep('a', 'to_decide')] })[0].labelAr).toBe('تنتظر قرارك')
    expect(build({ prep: [prep('a', 'preparing', 'c1')] })[0].labelAr).toBe('تعدّها في «شعبي»')
    const declined = build({ prep: [prep('a', 'declined')] })[0]
    expect([declined.state, declined.labelAr]).toEqual(['closed', 'اعتذرت عنها'])
  })

  it('والعرضُ الذي بُتّ فيه بسببه: سحبت (بلون الخطر) · اعتذرت · انقضت', () => {
    const w = build({ offers: [offer('a', 'withdrawn')] })[0]
    expect([w.labelAr, w.tone]).toEqual(['سحبت', 'danger'])
    expect(build({ offers: [offer('a', 'declined')] })[0].labelAr).toBe('اعتذرت عنها')
    expect(build({ offers: [offer('a', 'offered', '2026-10-01T00:00:00Z')] })[0].labelAr).toBe('انقضت مهلتها')
  })

  it('صفٌّ واحدٌ للدورة من الأبواب كلّها — وما ينتظره أوّلا', () => {
    const rows = build({
      quals: [qual('a'), qual('b'), qual('c')],
      cohorts: [cohort('a', 'active'), cohort('a', 'open', 'approved', 'a2')],
      offers: [offer('b', 'offered'), offer('b', 'declined', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')],
      prep: [prep('c', 'preparing', 'c1')],
    })
    expect(rows.map((r) => r.courseId)).toEqual(['b', 'c', 'a'])
    expect(rows.find((r) => r.courseId === 'a')!.cohorts).toHaveLength(2)
    expect(rows.find((r) => r.courseId === 'b')!.offers).toHaveLength(2)
  })
})

describe('② الصفحةُ تبني صفوفَها من القائمة الواحدة', () => {
  const Q = code('src/pages/trainer/Qualifications.tsx')
  const PANEL = code('src/pages/trainer/CourseMaterialsPanel.tsx')

  it('⚠️ الصفوفُ من `buildMyCourses` ومعها شعبُه من «شعبي»', () => {
    expect(Q).toMatch(/buildMyCourses\(\{ quals: quals \?\? \[\], offers, prep, cohorts, now \}\)/)
    expect(Q).toMatch(/apiGet<MyCourseCohort\[\]>\("\/api\/trainer\/cohorts\/summary"\)/)
  })

  it('ولا لوحَ ثانيا للدورات فوق القائمة — اللوحُ القديمُ قرارٌ في الصفّ وملاحظةُ طور', () => {
    expect(PANEL, 'عاد اللوح قائمة دورات بعنوانها').not.toMatch(/<ul|<h2|rows\.map\(/)
    expect(PANEL).toMatch(/export function PrepDecision\(/)
    expect(Q).toMatch(/r\.prep\?\.state === "to_decide" && <PrepDecision row=\{r\.prep\}/)
  })

  it('والخادمُ يعطي دورةَ كلّ شعبة — بها تُجمع إلى دوراته', () => {
    const svc = code('server/services/cohort-plan.service.ts')
    const summaries = svc.slice(svc.indexOf('async summaries('), svc.indexOf('async savePlan('))
    expect(summaries).toMatch(/courseId: c\.courseId,/)
  })
})

describe('③ «دوراتي المقترحة» و«مساراتي» قسمان في «دوراتي»', () => {
  const Q = code('src/pages/trainer/Qualifications.tsx')
  const LAYOUT = code('src/pages/trainer/TrainerLayout.tsx')
  const APP = code('src/App.tsx')

  it('لا لسانَ لهما في قائمة المدرّب', () => {
    expect(LAYOUT).not.toMatch(/to: "\/trainer\/course-proposals"/)
    expect(LAYOUT).not.toMatch(/to: "\/trainer\/paths"/)
    expect(LAYOUT).toMatch(/to: "\/trainer\/qualifications", label: "دوراتي"/)
  })

  it('وهما قسمان في الصفحة بلسانٍ يحفظ القسمَ في الرابط', () => {
    expect(Q).toMatch(/\{ id: "proposals", label: "دوراتي المقترحة" \}/)
    expect(Q).toMatch(/\{ id: "paths", label: "مساراتي" \}/)
    expect(Q).toMatch(/section === "proposals" && <CourseProposalsSection \/>/)
    expect(Q).toMatch(/section === "paths" && <MyPathsSection \/>/)
    expect(Q).toMatch(/params\.get\("tab"\)/)
  })

  it('ولا إطارَ ثانيا داخل الإطار', () => {
    for (const p of ['src/pages/trainer/MyCourseProposals.tsx', 'src/pages/trainer/MyPaths.tsx']) {
      expect(code(p), p).not.toMatch(/<TrainerLayout/)
    }
  })

  it('⚠️ والمساران القديمان يُحالان إلى قسميهما — رسائلُ مضت تحملهما', () => {
    expect(APP).toMatch(/<Route path="\/trainer\/course-proposals" element=\{<Navigate to="\/trainer\/qualifications\?tab=proposals" replace \/>\} \/>/)
    expect(APP).toMatch(/<Route path="\/trainer\/paths" element=\{<Navigate to="\/trainer\/qualifications\?tab=paths" replace \/>\} \/>/)
  })
})
