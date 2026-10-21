/* ═══ «شعبي» للحاليّة، و«دوراتي» لما يُعدّ (٢٠ أكتوبر ٢٠٢٦) — `board-place.ts` ═══

   اقتراحُ صاحب المنصّة: «أن يكون داخل شعبي فقط الشعب الحاليّة المعتمدة، وصفحة دوراتي فيها كلّ الدورات ليوافق
   عليها ويرفضها أو يؤجّلها، وتظهر كلّ دورة بحالتها هناك، وتبقى صفحة شعبي نظيفة لما هو حالي».

   ① القسمةُ: الحاليّةُ قائمةٌ أو اعتُمدت خطّتُها قطّ، والمنتهيةُ وحدَها، والباقي يُعدّ.
   ② و«شعبي» تعرض الحاليّةَ وتطوي المنتهيةَ وتدلّ على «دوراتي» بعدد ما فيها.
   ③ و«دوراتي» تعرض ما يُعدّ تحت دورته: خطوتُه، و«جهّزها»، وبابُ تأجيله.
   ④ ولسانُ «دوراتي» يعدّ ما ينتظر قرارَه — بكلمته لا بكلمة التصحيح.

   ورُئي ساقطا: أُخرج `approvedOnce` من القسمة فسقط ①، وأُعيدت «شعبي» إلى كلّ الصفوف فسقط ②، وأُسقط زرُّ
   «جهّزها» فسقط ③، وأُعيدت كلمةُ الإطار لكلّ لسان فسقط ④. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { boardPlace } from '@/application/trainer/board-place'
import { PortalTabs } from '@/components/ui/PortalTabs'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① القسمة', () => {
  it('⚠️ الحاليّة قائمة أو اعتمدت خطّتها قطّ — والمنتهية وحدها — والباقي يعدّ', () => {
    expect(['open', 'full', 'active'].map((status) => boardPlace({ status }))).toEqual(['current', 'current', 'current'])
    expect(boardPlace({ status: 'draft', approvedOnce: true }), 'معتمدة تنتظر فتحها').toBe('current')
    expect(boardPlace({ status: 'draft', approvedOnce: false })).toBe('courses')
    expect(boardPlace({ status: 'draft' })).toBe('courses')
    expect(boardPlace({ status: 'completed', approvedOnce: true })).toBe('finished')
  })
})

describe('② «شعبي»', () => {
  const board = code('src/pages/trainer/CohortBoard.tsx')
  it('⚠️ الحاليّة وحدها بطاقات — والمنتهية مطويّة — وما يعدّ عدد ورابط إلى «دوراتي»', () => {
    expect(board).toMatch(/const current = rows\.filter\(\(c\) => boardPlace\(c\) === "current"\);/)
    expect(board).toMatch(/\{current\.map\(\(c\) => card\(c, true\)\)\}/)
    expect(board).toMatch(/<details className="mt-6">\s*<summary[^>]*>منتهية \(\{finished\.length\}\)<\/summary>/)
    expect(board).toMatch(/to="\/trainer\/qualifications"/)
    expect(board, 'عادت كلّ الصفوف بطاقات').not.toMatch(/\{rows\.map\(\(c\) =>/)
  })
})

describe('③ «دوراتي»', () => {
  const page = code('src/pages/trainer/Qualifications.tsx')
  it('⚠️ ما يعدّ تحت دورته: خطوته، و«جهّزها»، وباب تأجيله', () => {
    expect(page).toMatch(/const preparing = r\.cohorts\.filter\(\(c\) => boardPlace\(c\) === "courses"\);/)
    expect(page).toMatch(/<Button as=\{Link\} to=\{`\/trainer\/cohort\/\$\{c\.id\}`\} size="sm" icon=\{PencilLine\} tone="confirm">جهّزها<\/Button>/)
    expect(page).toMatch(/<CohortMoveBox cohortId=\{c\.id\}/)
    expect(page).toContain('apiGet<MoveRequestRow[]>("/api/trainer/cohort-moves")')
  })
})

describe('④ لسان «دوراتي»', () => {
  it('⚠️ يعدّ بكلمته — لا «ينتظر تصحيحك» لغير التصحيح', () => {
    expect(code('src/pages/trainer/TrainerLayout.tsx'))
      .toMatch(/label: "دوراتي", icon: BookCheck, count: me\?\.coursesWaiting \?\? 0, countLabel: "تنتظر قرارك: "/)
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(PortalTabs, {
      label: 'تبويبات', countLabel: 'ينتظر تصحيحك: ',
      tabs: [{ to: '/a', label: 'طابور', count: 2 }, { to: '/b', label: 'دوراتي', count: 1, countLabel: 'تنتظر قرارك: ' }],
    })))
    expect(html).toMatch(/<span[^>]*class="sr-only"[^>]*>ينتظر تصحيحك: <\/span>2/)
    expect(html).toMatch(/<span[^>]*class="sr-only"[^>]*>تنتظر قرارك: <\/span>1/)
  })
})

/* ═══ ⑤ الفصول القادمة (٢١ أكتوبر ٢٠٢٦) ═══
   بلاغُ صاحب المنصّة: شعبتان أُجّلتا بقيتا في «شعبي» بين شعب هذا الفصل. فاختار «إلى دوراتي بقسمٍ منفصل يقول دورات
   الفصول القادمة». ورُئي ساقطا: أُسقط فحصُ الفصل من القسمة فبقيت المؤجَّلةُ «حاليّة»، وأُعيدت «دوراتي» إلى الشعب
   كلّها فعادت المؤجَّلةُ تحت دورتها. */
describe('⑤ الفصول القادمة', () => {
  const now = new Date('2026-10-21T10:00:00Z')
  const spring = { year: 2027, season: 'feb_apr' }
  it('⚠️ ما لم يبدأ وفصله بعد الذي نعمل له — معتمدا أو مؤجّلا أو مفتوحا — للفصول القادمة', () => {
    expect(boardPlace({ status: 'draft', approvedOnce: true, term: spring }, now), 'معتمدة نقلت إلى الربيع').toBe('later')
    expect(boardPlace({ status: 'open', term: spring }, now)).toBe('later')
    /* والمؤجَّلةُ خطّتُها: فصلُها الجديد في صفّه ويومُها المقترحُ من القديم — والصفُّ يحكم */
    expect(boardPlace({ status: 'draft', term: spring, proposedStartsOn: '2026-11-22' }, now)).toBe('later')
    expect(boardPlace({ status: 'draft', proposedStartsOn: '2027-03-01' }, now), 'بلا صفّ — من يومها').toBe('later')
  })
  it('⚠️ والفصل الذي نعمل له وما بدأ حاليّان — وحين يقترب فصلها تعود', () => {
    const winter = { year: 2026, season: 'nov_jan' }
    expect(boardPlace({ status: 'draft', approvedOnce: true, term: winter }, now)).toBe('current')
    expect(boardPlace({ status: 'active', term: spring }, now), 'جارية').toBe('current')
    expect(boardPlace({ status: 'draft', approvedOnce: true, term: spring }, new Date('2026-11-02T10:00:00Z')), 'بدأ الشتاء').toBe('current')
  })
  it('⚠️ «دوراتي» تخرجها من صفوف الدورات وتعرضها في قسمها', () => {
    const page = code('src/pages/trainer/Qualifications.tsx')
    expect(page).toMatch(/cohorts: cohorts\.filter\(\(c\) => !away\.has\(c\.id\)\)/)
    expect(page).toMatch(/\{later\.length > 0 && <LaterTerms cohorts=\{later\}/)
    expect(page).toMatch(/دورات الفصول القادمة/)
  })
})
