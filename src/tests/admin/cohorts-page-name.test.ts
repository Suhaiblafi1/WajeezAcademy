/* «تشغيل الشعب» — اسمٌ يقول ما تفعله الصفحة (١٨ أكتوبر ٢٠٢٦).

   سأل صاحبُ المنصّة: «وصفحة الشعب ما فائدتها إن كان بإمكاني أن أفتح الشعب فورا من الصفحات الأخرى؟».
   والفتحُ صار من «خطط تنتظر اعتمادك»، وهذه موضعُ ما بعده: اللقاءات والمتعلّمون والموادّ والشهادات
   والإنهاءُ والإلغاءُ وطلباتُ النقل. فاختار تسميتَها «تشغيل الشعب» — ولا يسقط منها شيء.

   ① اسمُها في القائمة وعنوانِها، ووصفُها ما تفعله.
   ② ولا نصٌّ يراه أحدٌ يسمّيها «الشعب» — فيُبحث عن اسمٍ لا يجده في القائمة.
   ③ ولم يسقط منها شيء: الانتقالُ (إنهاءٌ وإلغاء) والتشغيلُ كلُّه باقيان.

   والفحصُ على الشيفرة بلا تعليقاتها. */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const page = code('src/pages/admin/AdminCohorts.tsx')

describe('① اسمها ما تفعله', () => {
  it('⚠️ «تشغيل الشعب» في القائمة — ووصفها التشغيل لا الفتح', () => {
    const nav = code('src/pages/admin/nav-map.ts')
    /* ووصفُها صار المتابعةَ لا صناعةَ اللقاءات (٢٢ أكتوبر ٢٠٢٦): «اللقاءات يضعها المدرّب لا نحن» */
    /* ولسانُها في قسم «الشعب» قصيرٌ (٢٤ أكتوبر ٢٠٢٦، `nav-map.ts`): القسمُ يقول نصفَ الاسم، والاسمُ الكاملُ في الدليل */
    expect(nav).toMatch(/\{ to: "\/admin\/cohorts", label: "تشغيل الشعب", tab: "الشعب", icon: CalendarCog, need: "cohort\.manage",\s*descAr: "متابعة كل شعبة: الحضور والتسليمات ورسائل المدرب، والمال، وما يبدأ قريبا، وإنهاؤها أو إلغاؤها" \}/)
  })

  it('⚠️ وعنوانها كذلك — في الحالين', () => {
    const titles = [...page.matchAll(/<AdminLayout title="([^"]*)">/g)].map((m) => m[1])
    expect(titles).toEqual(['تشغيل الشعب', 'تشغيل الشعب'])
  })
})

describe('② ولا نصّ يسمّيها باسمها القديم', () => {
  it('⚠️ لا «الشعب» اسما لصفحة في نصّ يراه أحد', () => {
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
    expect(files.filter((f) => /«الشعب»|عمليات الشعب/.test(code(f))), 'اسمٌ قديم للصفحة').toEqual([])
  })
})

describe('③ ولم يسقط منها شيء', () => {
  it('⚠️ الانتقال والتشغيل باقيان فيها', () => {
    for (const to of ['{ to: "active" }', '{ to: "completed" }']) {
      expect(page, `سقط ${to}`).toContain(`apiPost(\`/api/admin/cohorts/\${c.id}/transition\`, ${to}`)
    }
    /* والإلغاءُ صار صندوقا بسببه وأثره (٢٢ أكتوبر ٢٠٢٦) — في البطاقة وفي «تبدأ قريبا» */
    const box = code('src/components/admin/CancelCohortBox.tsx')
    expect(box).toContain('apiPost(`/api/admin/cohorts/${cohortId}/transition`, { to: "cancelled",')
    expect(page).toMatch(/\{!\["completed", "cancelled"\]\.includes\(c\.status\) && \(\s*<CancelCohortBox cohortId=\{c\.id\}/)
    expect(page).toMatch(/<CohortOps cohort=\{c\} tab=\{tab\}/)
  })
})
