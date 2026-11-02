/* دورةٌ في نتيجة التشخيص لا شعبةَ لها هذا الموسم — بديلان لتختار منهما، ومسارٌ جاهزٌ تحت الخطّة (٢ نوفمبر ٢٠٢٦).
   القاعدةُ في `application/catalog/season-replacements.ts`. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { closestReadyPathway, seasonReplacements, type ReplaceableCourse } from '@/application/catalog/season-replacements'
import { availableThisSeason, type ListedCourses } from '@/application/catalog/listed-courses'
import { termTitleOfKey } from '@/application/terms/season'

const course = (id: string, pathwayId: string, skills: string[], category = 'موظفون ومختصون'): ReplaceableCourse =>
  ({ id, pathwayId, category, skill: skills[0] ?? '', skills })

const CATALOG: ReplaceableCourse[] = [
  course('P1', 'PW-A', ['تفاوض']),
  course('P2', 'PW-B', ['تصميم']),
  /* أختُ «P1» في مسارها — تتنافسان على البديلين نفسيهما */
  course('P3', 'PW-A', ['تفاوض']),
  /* المتاحة */
  course('X-far', 'PW-Z', ['محاسبة'], 'حكومي'),
  course('X-dom', 'PW-A2', ['إقناع']),
  course('X-path', 'PW-A', ['وساطة']),
  course('X-skill', 'PW-Q', ['تفاوض']),
  course('Y-b', 'PW-B', ['ألوان']),
]
const DOMAIN: Record<string, string> = { 'PW-A': 'تواصل', 'PW-A2': 'تواصل', 'PW-B': 'تصميم', 'PW-Q': 'أخرى', 'PW-Z': 'مالية' }
const OPEN = new Set(['X-far', 'X-dom', 'X-path', 'X-skill', 'Y-b'])
const run = (planIds: string[], open = OPEN) => seasonReplacements({
  planIds, catalog: CATALOG, domainOf: (p) => DOMAIN[p] ?? 'أخرى',
  available: (id) => open.has(id),
})

describe('بديلان لما لا يُشترى هذا الموسم', () => {
  it('⚠️ لكلّ دورةٍ غير متاحة بديلان متاحان: من مسارها، ثمّ مجالها، ثمّ مهارتها', () => {
    expect(run(['P1']).get('P1')).toEqual(['X-path', 'X-dom'])
  })

  it('⚠️ والمتاحةُ لا تُمسّ، والبديلُ لا يتكرّر بين دورتين ما وُجد غيرُه', () => {
    const out = run(['P1', 'P2', 'X-skill'])
    expect(out.has('X-skill')).toBe(false)
    expect(out.get('P1')).toEqual(['X-path', 'X-dom'])
    expect(out.get('P2')![0]).toBe('Y-b')
    expect(out.get('P2')).not.toContain('X-path')
    expect(out.get('P2')).not.toContain('X-skill')
  })

  it('⚠️ ودورتان من مسارٍ واحدٍ لا تأخذان البديلين نفسيهما', () => {
    const out = run(['P1', 'P3'])
    expect(out.get('P1')).toEqual(['X-path', 'X-dom'])
    expect(out.get('P3')).toHaveLength(2)
    for (const x of out.get('P3')!) expect(['X-path', 'X-dom']).not.toContain(x)
  })

  it('ولا يُقال عن شيءٍ إنّه غير متاح حين لا يُعرف', () => {
    const out = seasonReplacements({ planIds: ['P1'], catalog: CATALOG, domainOf: () => 'x', available: () => null })
    expect(out.size).toBe(0)
  })
})

describe('أتُشترى هذا الموسم؟', () => {
  const ready = (season?: string): ListedCourses => ({
    state: 'ready', ids: new Set(['A', 'B']), season,
    seasons: new Map([['A', new Set(['2026-nov_jan'])], ['B', new Set(['2027-feb_apr'])]]),
  })
  it('⚠️ لها شعبةٌ في موسم البيع — لا في أيّ موسم', () => {
    expect(availableThisSeason('A', ready('2026-nov_jan'))).toBe(true)
    expect(availableThisSeason('B', ready('2026-nov_jan'))).toBe(false)
    expect(availableThisSeason('C', ready('2026-nov_jan'))).toBe(false)
  })
  it('وقبل الجواب لا يُعرف، والخادمُ الأقدمُ بلا موسمٍ يكتفي بالشعبة', () => {
    expect(availableThisSeason('A', { state: 'loading' })).toBeNull()
    expect(availableThisSeason('B', ready())).toBe(true)
  })
  it('واسمُ الموسم من مفتاحه', () => {
    expect(termTitleOfKey('2026-nov_jan')).toBe('موسم الشتاء 2026/2027')
    expect(termTitleOfKey('winter')).toBeNull()
  })
})

describe('أقربُ مسارٍ جاهز', () => {
  const shown = [
    { id: 'R1', courseIds: ['Q1', 'Q2'], domain: 'تواصل' },
    { id: 'R2', courseIds: ['P1', 'Q3'], domain: 'مالية' },
  ]
  it('⚠️ بما يشارك الخطّةَ من دورات أوّلا، ثمّ بمجالها', () => {
    expect(closestReadyPathway(['P1', 'P2'], shown, ['تواصل'])?.id).toBe('R2')
    expect(closestReadyPathway(['P9'], shown, ['تواصل'])?.id).toBe('R1')
  })
  it('ولا شيءَ حين لا قربَ أصلا', () => {
    expect(closestReadyPathway(['P9'], shown, ['هندسة'])).toBeNull()
  })
})

describe('شاشةُ النتيجة', () => {
  const plan = readFileSync(new URL('../../pages/diagnostic/ResultPlanCards.tsx', import.meta.url), 'utf8')
  const journey = readFileSync(new URL('../../components/CourseJourney.tsx', import.meta.url), 'utf8')
  it('⚠️ الخطّتان تمرّران البدائل وتعرضان المسارَ الجاهز تحتهما', () => {
    expect(plan.match(/useSeasonReplacements\(chosenIds, gaps\)/g)).toHaveLength(2)
    expect(plan.match(/<ReadySeasonPathway courseIds=\{chosenIds\}/g)).toHaveLength(2)
  })
  it('⚠️ وصفحةُ المسار — وإليها ينتهي التشخيص — تمرّرها في الحالتين، والمسارَ الجاهزَ لغير الجاهز', () => {
    const page = readFileSync(new URL('../../pages/Pathway.tsx', import.meta.url), 'utf8')
    expect(page).toMatch(/useSeasonReplacements\(courseIds\)/)
    expect(page.match(/^\s*unavailable,\n\s*seasonTitleAr,$/gm)).toHaveLength(2)
    expect(page).toMatch(/!publicPathwayById\(pathway\.id\) && Object\.keys\(unavailable\)\.length > 0 && \(\s*<ReadySeasonPathway/)
  })

  it('⚠️ والدورةُ غيرُ المتاحة يُقال ذلك فيها، والبديلُ يحلّ محلّها بالاستبدال', () => {
    expect(journey).toMatch(/هذه الدورة غير متاحة/)
    expect(journey).toMatch(/onClick=\{\(\) => edit\.onSwapPick\(c\.id, p\.id\)\}\s*\n\s*aria-label=\{`استبدل/)
  })
})
