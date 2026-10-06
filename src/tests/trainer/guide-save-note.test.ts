/* ملاحظةُ «ما تكتبه يُحفظ وأنت تتنقّل» في الدليل (٥ أكتوبر ٢٠٢٦).

   طلبُ صاحب المنصّة: أن يقول الدليلُ إنّ التنقّلَ بين الخطوات والخروجَ من الشعبة
   يحفظان، وإنّ «احفظ — لم تكتمل بعد» يحفظ ولا يُتمّ — بعلامة «جديد». والعلامةُ
   كانت للقسم وحدَه، والقسمُ قائمٌ («مساحةُ الشعبة»): فتعليمُه كلِّه جديدا كذب، وقسمٌ
   يُزاد يبدّل أرقامَ ما بعده في نسخٍ طُبعت. فصارت الملاحظةُ تحمل «جديد» بنفسها.

   ① الملاحظةُ «جديد» شهرا من يومها — في كتلتها وحدَها، لا في الفهرس ولا رأسِ القسم.
   ② وما تقوله قائمٌ في الشاشة: اسمُ الزرّ كما يُكتب فيها، والحفظُ عند التنقّل والخروج.
      فإن حُذف شيءٌ منه هناك سقط هنا — ولا يبقى الدليلُ يَعِد بما ذهب. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TrainerGuide from '@/pages/trainer/Guide'
import { GUIDE_SECTIONS } from '@/data/trainer-guide/content'
import { guideToc } from '@/data/trainer-guide/toc'
import type { GuideBlock } from '@/data/trainer-guide/types'

const TITLE = 'ما تكتبه يُحفظ وأنت تتنقّل'
const NEW = /data-hue="coral">جديد</
const section = GUIDE_SECTIONS.find((s) => s.id === 'workspace')!
const note = section?.blocks.find((b): b is Extract<GuideBlock, { kind: 'callout' }> => b.kind === 'callout' && b.title === TITLE)

afterEach(() => { vi.useRealTimers() })

function page(iso: string): string {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(iso))
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(TrainerGuide)))
}
/** ما بين فتح القسم وأوّلِ `<section` بعده */
const slice = (html: string, id: string) => {
  const start = html.indexOf(`id="${id}"`)
  const end = html.indexOf('<section', start)
  return start < 0 ? '' : html.slice(start, end < 0 ? undefined : end)
}
/** بطاقةُ الملاحظة: من فتح البطاقة التي فيها عنوانُها إلى آخرها */
const card = (html: string) => {
  const at = html.indexOf(TITLE)
  const open = html.lastIndexOf('guide-callout', at)
  return at < 0 || open < 0 ? '' : html.slice(open, html.indexOf('</div></div>', at))
}

describe('① الملاحظةُ «جديد» شهرا — وحدَها', () => {
  it('في «مساحة الشعبة»، بيومها', () => {
    expect(note, 'لا ملاحظةَ عن الحفظ في «مساحة الشعبة»').toBeTruthy()
    expect(note!.added).toBe('2026-10-05')
  })

  it('في أوّل شهرها تحمل «جديد» — والقسمُ في الفهرس ورأسه لا', () => {
    const html = page('2026-10-06T09:00:00Z')
    expect(card(html), 'الملاحظةُ بلا «جديد» في شهرها').toMatch(NEW)
    const head = slice(html, 'workspace').split('</h2>')[1]?.split('</p>')[0] ?? ''
    expect(head, 'عُلّم القسمُ كلُّه جديدا لملاحظةٍ فيه').not.toMatch(NEW)
    const item = guideToc(new Date('2026-10-06T09:00:00Z')).flatMap((g) => g.items).find((t) => t.id === 'workspace')
    expect(item?.isNew, 'عُلّم القسمُ في الفهرس لملاحظةٍ فيه').toBeFalsy()
  })

  it('وبعد الشهر تبقى بلا علامة — وقبل يومها لا علامة', () => {
    expect(card(page('2026-11-10T09:00:00Z')), 'بقيت «جديد» بعد الشهر').not.toMatch(NEW)
    expect(card(page('2026-10-04T09:00:00Z')), '«جديد» قبل يوم الإضافة').not.toMatch(NEW)
  })

  it('والملاحظةُ بلا يومٍ لا تحمل علامة', () => {
    const html = page('2026-10-06T09:00:00Z')
    const plain = html.indexOf('قبل أن تبدأ', html.indexOf('id="workspace"'))
    expect(plain, 'لم يُعثر على «قبل أن تبدأ» في القسم').toBeGreaterThan(-1)
    const open = html.lastIndexOf('guide-callout', plain)
    expect(html.slice(open, html.indexOf('</div></div>', plain))).not.toMatch(NEW)
  })
})

describe('② وما تقوله قائمٌ في الشاشة', () => {
  const screen = readFileSync(join(process.cwd(), 'src/pages/trainer/CohortWorkspace.tsx'), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

  it('كلُّ زرٍّ تسمّيه «…» مكتوبٌ في الشاشة حرفا', () => {
    const names = [...(note?.text ?? '').matchAll(/«([^»]+)»/g)].map((m) => m[1])
    expect(names, 'الملاحظةُ لا تسمّي الزرّ').toContain('احفظ — لم تكتمل بعد')
    for (const n of names) expect(screen, `«${n}» ليس في الشاشة`).toContain(`"${n}"`)
  })

  it('والتنقّلُ يحفظ، والخروجُ يحفظ — كما تقول', () => {
    const open = screen.slice(screen.indexOf('const openStage = async (s: Stage) => {'))
    expect(open.slice(0, open.indexOf('\n  };')), 'التنقّلُ لا يحفظ — والدليلُ يقول إنّه يحفظ').toContain('await persist()')
    expect(screen, 'الخروجُ لا يحفظ — والدليلُ يقول إنّه يحفظ').toMatch(/leaveSave\.current = [\s\S]*?apiPut\(`\/api\/trainer\/cohorts\/\$\{cohortId\}\/plan`/)
  })
})
