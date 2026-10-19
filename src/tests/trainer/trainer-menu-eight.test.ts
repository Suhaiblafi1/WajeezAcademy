/* ═══ قائمةُ المدرّب ثمانيةُ ألسنة — الخطوة G (١٩ أكتوبر ٢٠٢٦) ═══

   درس صاحبُ المنصّة جانبَ المدرّب واختار («All, in order»): كانت القائمةُ أربعةَ عشرَ لسانا، فلا يسعها
   الشريطُ ويخرج آخرُها إلى «المزيد». فصارت ثمانية:
   · «دوراتي المقترحة» و«مساراتي» قسمان في «دوراتي» (الخطوة F).
   · «عقدي» و«دعوتي» قسمان في «مستحقاتي» — وقرارُ ٢٥ سبتمبر قبلها: «ضمن قسم المستحقات والعقد».
   · «ما قيل عنّي» قسمٌ في «الرئيسية».
   والمساراتُ القديمةُ تُحال إلى مواضعها: رسائلُ مضت تحملها.

   والفحصُ على الشيفرة بلا تعليقاتها. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① ثمانيةُ ألسنة', () => {
  it('⚠️ بأسمائها وترتيبها — ولسانُ «اختبار المستوى» لمن مُنحه وحدَه', () => {
    const nav = code('src/pages/trainer/TrainerLayout.tsx')
    const fixed = nav.slice(nav.indexOf('const tabs: PortalTab[] = ['), nav.indexOf('...(user?.permissions.includes("placement.review")'))
    const labels = [...fixed.matchAll(/\{ to: "\/trainer[^"]*", label: "([^"]+)"/g)].map((m) => m[1])
    expect(labels).toEqual(['الرئيسية', 'شعبي', 'طلبتي', 'طابور التقييم', 'جدولي', 'دوراتي', 'التسويق', 'مستحقاتي'])
  })
})

describe('② «عقدي» و«دعوتي» قسمان في «مستحقاتي»', () => {
  const E = code('src/pages/trainer/Earnings.tsx')

  it('لسانُ الأقسام يحفظ القسمَ في الرابط', () => {
    expect(E).toMatch(/\{ id: "earnings", label: "مستحقاتي" \}/)
    expect(E).toMatch(/\{ id: "contract", label: "عقدي" \}/)
    expect(E).toMatch(/\{ id: "referral", label: "دعوتي" \}/)
    expect(E).toMatch(/params\.get\("tab"\)/)
    expect(E).toMatch(/section === "contract" && <MyContract \/>/)
  })

  it('ولا إطارَ ثانيا داخل الإطار', () => {
    expect(code('src/pages/trainer/MyContract.tsx')).not.toMatch(/<TrainerLayout|<PortalFrame/)
    expect(code('src/pages/trainer/Referral.tsx')).not.toMatch(/<TrainerLayout|<PortalFrame/)
    expect(E.match(/<TrainerLayout\b/g) ?? [], 'إطارٌ في كلّ فرعٍ من فروع الكشف').toHaveLength(1)
  })
})

describe('③ «ما قيل عنّي» في «الرئيسية»', () => {
  it('قسمٌ بمرساته — ينزل إليه الرابطُ القديم', () => {
    expect(code('src/pages/trainer/TrainerDashboard.tsx')).toMatch(/<MyRatings \/>/)
    const r = code('src/pages/trainer/MyRatings.tsx')
    expect(r).toMatch(/<section ref=\{ref\} id="ratings"/)
    expect(r).not.toMatch(/<TrainerLayout/)
    expect(r).toMatch(/hash !== "#ratings"/)
  })
})

describe('④ والمساراتُ القديمة تُحال إلى مواضعها', () => {
  const APP = code('src/App.tsx')
  it.each([
    ['/trainer/contract', '/trainer/earnings\\?tab=contract'],
    ['/trainer/referral', '/trainer/earnings\\?tab=referral'],
    ['/trainer/ratings', '/trainer#ratings'],
  ])('⚠️ %s', (from, to) => {
    expect(APP).toMatch(new RegExp(`<Route path="${from}" element=\\{<Navigate to="${to}" replace />\\} />`))
  })
})
