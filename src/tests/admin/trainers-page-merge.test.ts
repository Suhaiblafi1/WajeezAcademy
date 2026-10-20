/* «المدربون» — شاشتا المدرّبين صارتا واحدة (١٨ أكتوبر ٢٠٢٦).

   سأل صاحبُ المنصّة: «لماذا هناك تكرار في صفحات أخرى مثل صفحة التأهيل والإسناد وإسناد من المدرب؟»،
   واختار ضمَّهما. وهنا يُحرَس:

   ① **بابٌ واحدٌ في القائمة** باسم «المدربون» — ولا بابَ لـ«إسناد من المدرب»، ورابطُها القديمُ يحوَّل.
   ② **ولا يتكرّر فيها فعلٌ له بابُه**: لا «أهّله مباشرة» (التصنيفُ يؤهّل — والخادمُ في
      `server/tests/trainer/course-proposals.test.ts`) ولا «أسنده» (صفحةُ الشعبة تؤهّل وتسند).
   ③ **وما لا يقع إلّا فيها باقٍ**: طلباتُ التأهيل، وإضافةُ مدرّب، والظهورُ العامّ، والإيقاف.
   ④ **وصفحةُ الشعبة باقيةٌ بابا للإسناد** — وإلّا لم يبقَ له باب.
   ⑤ **ونصوصُها تقول الحقّ**: «اعتمدها دون انتظار الخطة» يفعّله إن لم يكن نشطا — فدورةٌ واحدةٌ تكفي منذ ٢٠ أكتوبر
      ٢٠٢٦ (`activateWhenCoursesDone`)،
      ولا «تبويب الطلبات» ولا «التأهيل والإسناد» في نصٍّ يراه أحد.

   والفحصُ على الشيفرة بلا تعليقاتها. */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const ops = code('src/pages/admin/TrainerRunOps.tsx')

describe('① بابٌ واحدٌ في القائمة', () => {
  it('⚠️ «المدربون» بصلاحيّة أوّلِ ما تقرؤه — ولا بابَ لـ«إسناد من المدرب»', () => {
    const nav = code('src/pages/admin/nav-map.ts')
    expect(nav).toMatch(/\{ to: "\/admin\/trainer-run", label: "المدربون", icon: GraduationCap, need: "trainer\.qualify",/)
    expect(nav).not.toContain('/admin/assign-by-trainer')
  })

  it('⚠️ ورابطُها القديمُ يحوَّل إليها — والشاشةُ لا تبقى', () => {
    const app = code('src/App.tsx')
    expect(app).toMatch(/<Route path="\/admin\/assign-by-trainer" element=\{<Navigate to="\/admin\/trainer-run" replace \/>\} \/>/)
    expect(app).not.toMatch(/AssignByTrainer/)
    expect(existsSync(join(root, 'src/pages/admin/AssignByTrainer.tsx'))).toBe(false)
    expect(code('src/pages/admin/TrainerRun.tsx')).toContain('<AdminLayout title="المدربون">')
  })
})

describe('② ولا يتكرّر فيها فعلٌ له بابُه', () => {
  it('⚠️ لا تأهيلَ مباشرا ولا إسناد — ولا تقرأ الشعب', () => {
    expect(ops, 'بقي «أهّله مباشرة»').not.toMatch(/\/qualifications`/)
    expect(ops, 'بقي «أسنده»').not.toMatch(/\/assignments`/)
    expect(ops).not.toContain('"/api/admin/cohorts"')
  })
})

describe('③ وما لا يقع إلّا فيها باقٍ', () => {
  it('⚠️ طلباتُ التأهيل، وإضافةُ مدرّب، والظهورُ العامّ، والإيقاف', () => {
    expect(ops).toMatch(/apiPost\(`\/api\/admin\/qualification-requests\/\$\{r\.id\}\/decide`, \{ approve: true,/)
    expect(ops).toContain('apiPost<{ noteAr: string }>("/api/admin/trainers/direct"')
    expect(ops).toContain('/publish-approval`')
    expect(ops).toContain('/suspend`')
    expect(ops).toContain('<PublicProfileEditor trainer={t} onSaved={load} />')
  })
})

describe('④ وصفحةُ الشعبة بابُ الإسناد', () => {
  it('⚠️ تطلب التأهيلَ وتقرّر فيه — فتؤهّل وتسند معا', () => {
    const cohort = code('src/pages/admin/CohortOps.tsx')
    expect(cohort).toMatch(/apiPost\(`\/api\/admin\/cohorts\/\$\{cohort\.id\}\/qualification-requests`/)
    expect(cohort).toMatch(/apiPost\(`\/api\/admin\/qualification-requests\/\$\{picked\.qualificationId\}\/decide`, \{ approve: true \}\)/)
  })
})

describe('⑤ ونصوصُها تقول الحقّ', () => {
  it('⚠️ «اعتمدها دون انتظار الخطة» يقول إنّها قد تفعّله', () => {
    const dialog = ops.slice(ops.indexOf('titleAr="اعتمدها دون انتظار الخطة؟"'))
    expect(dialog).toContain('<li>وإن لم يكن نشطا، يفعّل حسابه ويوقّع عقده من جهتنا.</li>')
    expect(dialog, 'يقال إنّه ينتظر آخر دوراته ودورةٌ واحدةٌ تفعّله').not.toMatch(/آخر دوراته/)
    expect(dialog).not.toMatch(/لا يفعل حسابه/)
  })

  it('⚠️ ولا «تبويب الطلبات» ولا اسمٌ قديمٌ في نصٍّ يراه أحد', () => {
    expect(ops).not.toMatch(/تبويب «الطلبات»/)
    const files: string[] = []
    const walk = (d: string) => {
      for (const n of readdirSync(join(root, d))) {
        const p = `${d}/${n}`
        if (statSync(join(root, p)).isDirectory()) { if (n !== 'tests') walk(p) }
        else if (/\.tsx?$/.test(n)) files.push(p)
      }
    }
    walk('src')
    walk('server/services')
    const stale = files.filter((f) => /التأهيلُ? والإسناد|إسنادٌ? من المدرّ?ب/.test(code(f)))
    expect(stale, 'اسمٌ قديم في نصّ').toEqual([])
  })
})
