/* ═══ قائمةُ المدرّب ثمانيةُ ألسنة — الخطوة G (١٩ أكتوبر ٢٠٢٦) ═══

   درس صاحبُ المنصّة جانبَ المدرّب واختار («All, in order»): كانت القائمةُ أربعةَ عشرَ لسانا، فلا يسعها
   الشريطُ ويخرج آخرُها إلى «المزيد». فصارت ثمانية:
   · «دوراتي المقترحة» و«مساراتي» قسمان في «دوراتي» (الخطوة F).
   · «عقدي» و«دعوتي» قسمان في «مستحقاتي» — وقرارُ ٢٥ سبتمبر قبلها: «ضمن قسم المستحقات والعقد».
   · «ما قيل عنّي» قسمٌ في «الرئيسية».
   والمساراتُ القديمةُ تُحال إلى مواضعها: رسائلُ مضت تحملها.

   ثمّ صارت تسعة (٢١ أكتوبر ٢٠٢٦): «الرسائل والتنبيهات» — اختار صاحبُ المنصّة «A» من ثلاثة مواضعَ عُرضت
   بالصور: «صفحةٌ مستقلّةٌ، بندٌ في القائمة». وهو آخرُها، فعلى الهاتف يخرج إلى «المزيد» قبل غيره، والجرسُ
   يفتحه من كلّ شاشة (`pages/trainer/Inbox.tsx`).

   والفحصُ على الشيفرة بلا تعليقاتها. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① ثمانيةُ ألسنة، والتاسعُ «الرسائل والتنبيهات»', () => {
  it('⚠️ بأسمائها وترتيبها — ولسانُ «اختبار المستوى» لمن مُنحه وحدَه', () => {
    const nav = code('src/pages/trainer/TrainerLayout.tsx')
    const fixed = nav.slice(nav.indexOf('const tabs: PortalTab[] = ['), nav.indexOf('...(user?.permissions.includes("placement.review")'))
    const labels = [...fixed.matchAll(/\{ to: "\/trainer[^"]*", label: "([^"]+)"/g)].map((m) => m[1])
    /* و«شارك دوراتك» خرجت من «مستحقاتي»، و«التسويق» صارت «موادك الإعلانية» (٢٦ أكتوبر ٢٠٢٦) */
    expect(labels).toEqual(['الرئيسية', 'شعبي', 'طلبتي', 'طابور التقييم', 'جدولي', 'دوراتي', 'شارك دوراتك', 'موادك الإعلانية', 'مستحقاتي', 'الرسائل والتنبيهات'])
  })
})

describe('② «عقدي» قسم في «مستحقاتي» — و«دعوتي» خرجت «شارك دوراتك»', () => {
  const E = code('src/pages/trainer/Earnings.tsx')

  it('لسانُ الأقسام يحفظ القسمَ في الرابط', () => {
    expect(E).toMatch(/\{ id: "earnings", label: "مستحقاتي" \}/)
    expect(E).toMatch(/\{ id: "contract", label: "عقدي" \}/)
    expect(E, 'عادت «دعوتي» قسما في «مستحقاتي»').not.toMatch(/id: "referral"/)
    expect(E, 'رابط القسم القديم لا يحال إلى «شارك دوراتك»').toMatch(/asked === "referral"\) return <Navigate to="\/trainer\/share" replace \/>/)
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
    ['/trainer/referral', '/trainer/share'],
    ['/trainer/ratings', '/trainer#ratings'],
  ])('⚠️ %s', (from, to) => {
    expect(APP).toMatch(new RegExp(`<Route path="${from}" element=\\{<Navigate to="${to}" replace />\\} />`))
  })
})
