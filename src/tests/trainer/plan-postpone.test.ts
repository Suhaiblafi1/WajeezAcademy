/* تأجيلُ الشعبة إلى موسمٍ قادم (٨ أكتوبر ٢٠٢٦) — المواسمُ تدور، والإرسالُ لا يمرّ قبل موسمها،
   والرسالةُ تقول صريحا إنّها لم تُقبل لهذا الفصل. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { boardNextStep } from '@/application/trainer/plan-gate'
import { buildChecklist } from '../../../server/services/cohort-plan.service'
import {
  nextSeason, plannedSeason, postponeChoices, postponeMessageAr, postponeProblem, postponedLineAr,
  seasonAr, seasonStart, validPostponeTarget,
} from '@/application/trainer/plan-postpone'

const TODAY = '2026-10-08'

describe('المواسمُ تدور', () => {
  it('الشتاءُ يتلوه ربيعُ السنة التالية، والخريفُ يتلوه شتاءُ سنته', () => {
    expect(nextSeason({ year: 2026, season: 'nov_jan' })).toEqual({ year: 2027, season: 'feb_apr' })
    expect(nextSeason({ year: 2027, season: 'feb_apr' })).toEqual({ year: 2027, season: 'may_jul' })
    expect(nextSeason({ year: 2027, season: 'may_jul' })).toEqual({ year: 2027, season: 'aug_oct' })
    expect(nextSeason({ year: 2027, season: 'aug_oct' })).toEqual({ year: 2027, season: 'nov_jan' })
  })

  it('وأوّلُ يومٍ في الموسم واسمُه', () => {
    expect(seasonStart({ year: 2027, season: 'feb_apr' })).toBe('2027-02-01')
    expect(seasonStart({ year: 2026, season: 'nov_jan' })).toBe('2026-11-01')
    expect(seasonAr({ year: 2027, season: 'feb_apr' })).toBe('موسم الربيع 2027')
  })

  it('موسمُ الشعبة من بدايتها — وشعبةٌ تبدأ في يناير شتويّةٌ من السنة السابقة', () => {
    expect(plannedSeason({ startsOn: '2026-12-06' }, TODAY)).toEqual({ year: 2026, season: 'nov_jan' })
    expect(plannedSeason({ startsOn: '2027-01-10' }, TODAY)).toEqual({ year: 2026, season: 'nov_jan' })
    /* وبلا مدّةٍ فموسمُ اليوم */
    expect(plannedSeason(null, TODAY)).toEqual({ year: 2026, season: 'aug_oct' })
  })
})

describe('ما يُختار منه', () => {
  it('الموسمان التاليان لموسمها — والأوّلُ المقترَح', () => {
    expect(postponeChoices({ startsOn: '2026-12-06' }, TODAY)).toEqual([
      { year: 2027, season: 'feb_apr' }, { year: 2027, season: 'may_jul' },
    ])
  })

  it('⚠️ ولا يُؤجَّل إلى موسمها ولا إلى ما قبله', () => {
    const p = { startsOn: '2026-12-06' }
    expect(validPostponeTarget({ year: 2026, season: 'nov_jan' }, p, TODAY)).toBe(false)
    expect(validPostponeTarget({ year: 2026, season: 'aug_oct' }, p, TODAY)).toBe(false)
    expect(validPostponeTarget({ year: 2027, season: 'feb_apr' }, p, TODAY)).toBe(true)
  })
})

describe('حاجزُ الإرسال', () => {
  it('⚠️ مؤجّلةٌ تبدأ قبل موسمها لا تُرسَل — وتُرسَل حين تبدأ فيه أو بعده', () => {
    const to = '2027-02-01'
    expect(postponeProblem(to, { startsOn: '2026-12-06', endsOn: '2027-01-30' })).toMatch(/^مؤجّلةٌ إلى موسم الربيع 2027 — اجعل بدايتَها في/)
    expect(postponeProblem(to, { startsOn: '2027-02-01', endsOn: '2027-04-20' })).toBeNull()
    expect(postponeProblem(to, { startsOn: '2027-05-03', endsOn: '2027-06-20' })).toBeNull()
  })

  it('وغيرُ المؤجّلة لا يمسّها — وبلا مدّةٍ يطلبها صفُّ المعلومات الأساسيّة لا هذا', () => {
    expect(postponeProblem(null, { startsOn: '2026-12-06', endsOn: '2027-01-30' })).toBeNull()
    expect(postponeProblem('2027-02-01', null)).toBeNull()
  })

  it('وسطرُ الحال', () => {
    expect(postponedLineAr('2027-02-01')).toBe('مؤجّلةٌ إلى موسم الربيع 2027')
  })
})

describe('ما يُقال للمدرّب', () => {
  const m = postponeMessageAr({
    cohortTitle: 'التفاوض', from: { year: 2026, season: 'nov_jan' }, to: { year: 2027, season: 'feb_apr' }, note: 'اخترنا لك ثلاثا هذا الفصل.',
  })

  it('⚠️ صريحا: لم تُقبل لهذا الفصل، وإلى أيّ موسمٍ أُجّلت، ومن أيّ يومٍ يُرسلها', () => {
    expect(m.title).toBe('«التفاوض» مؤجّلةٌ إلى موسم الربيع 2027')
    expect(m.heading).toBe('لم تُقبل هذه الشعبةُ لموسم الشتاء 2026 — وأُجّلت إلى موسم الربيع 2027')
    expect(m.body).toContain('لم تُقبل «التفاوض» لموسم الشتاء 2026، وأُجّلت إلى موسم الربيع 2027')
    expect(m.body).toContain('وليس هذا رفضا للدورة')
    expect(m.body).toMatch(/حين تجعل بدايتَها في .+ أو بعده/)
    expect(m.body).toContain('وكلمةُ الإدارة: اخترنا لك ثلاثا هذا الفصل.')
  })

  it('والزرُّ يدلّ ولا يأمر', () => {
    expect(m.cta).toBe('افتح الشعبة')
  })
})

/* ═══ وتقرؤه القائمةُ والبطاقةُ والشاشتان (٨ أكتوبر ٢٠٢٦) ═══ */

describe('حاجزُ الإرسال في القائمة نفسِها', () => {
  /* وخطوتُها الأولى تامّةٌ بغير التأجيل — اسمٌ ومدّةٌ ومستوًى ولمن هي — فلا يسقط الصفُّ لسببٍ آخر */
  const list = (postponedTo: string | null, period = { startsOn: '2026-12-06', endsOn: '2027-01-30' }) => buildChecklist({
    cohort: { title: 'الشعبة' }, period,
    content: {
      kind: 'trainer', modules: [], resources: [], level: { from: 'beginner', to: 'beginner' },
      audience: { stages: ['early_career'], goals: ['improve_performance'] },
    } as never,
    sessions: [], assessmentsCount: 0, planStatus: 'changes_requested', postponedTo,
  }).find((c) => c.key === 'identity')!

  it('⚠️ المؤجّلةُ يُسمّى موسمُها في صفّ خطوتها الأولى — وغيرُها لا', () => {
    expect(list('2027-02-01').labelAr).toContain('مؤجّلةٌ إلى موسم الربيع 2027')
    expect(list('2027-02-01').done).toBe(false)
    expect(list(null).done, 'الخطوةُ الأولى ناقصةٌ لسببٍ غيرِ التأجيل').toBe(true)
    expect(list(null).labelAr).not.toContain('مؤجّلةٌ')
    expect(list('2027-02-01', { startsOn: '2027-02-07', endsOn: '2027-04-10' }).labelAr).not.toContain('مؤجّلةٌ')
  })
})

describe('بطاقةُ «شعبي»', () => {
  it('⚠️ المؤجّلةُ تُسمّى بموسمها لا «اقرأ ملاحظةَ الإدارة»', () => {
    const next = boardNextStep({ planStatus: 'changes_requested', registrationOpen: false, checklist: [], postponedTo: '2027-02-01' })
    expect(next?.key).toBe('postponed')
    expect(next?.labelAr).toMatch(/^مؤجّلةٌ إلى موسم الربيع 2027 — لم تُقبل لهذا الفصل/)
    expect(boardNextStep({ planStatus: 'changes_requested', registrationOpen: false, checklist: [] })?.key).toBe('address_notes')
  })
})

describe('الشاشتان', () => {
  const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
  const admin = code('src/components/admin/TrainerPlanReview.tsx')
  const trainer = code('src/pages/trainer/CohortWorkspace.tsx')

  it('بطاقةُ المراجعة: زرٌّ ثالثٌ يرسل إلى مسلك التأجيل بالموسم المختار', () => {
    expect(admin).toContain('أجّلها إلى الفصل القادم')
    expect(admin).toMatch(/apiPost\(`\/api\/admin\/cohort-plans\/\$\{trainerPlan\.id\}\/postpone`, \{ year: to\.year, season: to\.season/)
    expect(admin).toMatch(/postponeChoices\(trainerPlan\.period,/)
  })

  it('⚠️ ولا يُعرض لشعبةٍ تعمل — مراجعتُها تُعتمَد أو تُردّ', () => {
    const at = admin.indexOf('أجّلها إلى الفصل القادم')
    expect(admin.slice(at - 300, at)).toContain('!trainerPlan.approvedOnce')
  })

  it('⚠️ وما يقع به يُقال قبل النقر — لم تُقبل لهذا الفصل', () => {
    expect(admin).toContain('لم تُقبل لهذا الفصل</b>')
  })

  it('وصفحةُ المدرّب تقولها في رأسها وفي حالها', () => {
    expect(trainer).toMatch(/لم تُقبل هذه الشعبةُ لهذا الفصل — \{postponedLineAr\(postponedTo\)\}/)
    expect(trainer).toMatch(/const postponedTo = planStatus === "changes_requested" \? ws\.plan\?\.postponedTo \?\? null : null/)
  })
})
