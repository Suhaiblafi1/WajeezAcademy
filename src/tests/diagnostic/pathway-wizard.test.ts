/* ج-٣ — المعالج يمنع ما يمنع الترشيح فعلا، ولا يمنع ما لا يمنعه. */

import { describe, expect, it } from 'vitest'
import {
  EMPTY_DRAFT, WIZARD_STEPS, blockersOf, goalOptions, personaOptions,
  stagesOf, unreachableGoals, type WizardDraft,
} from '../../application/catalog/pathway-wizard'

const full: WizardDraft = {
  ...EMPTY_DRAFT,
  id: 'PW-TST-001',
  title: 'مسار اختبار المعالج',
  audience: 'موظف يريد الانتقال إلى إدارة فريق صغير',
  beforeText: 'ينفّذ مهامه وحده ولا يعرف كيف يوزّع العمل',
  afterText: 'يدير فريقا صغيرا بخطة أسبوعية ومتابعة مكتوبة',
  courseIds: ['C-MGR-101'],
  personas: ['employee'],
  goals: ['promotion'],
  domainIds: ['people_leadership'],
}

describe('خطوات المعالج', () => {
  it('خمس خطوات بالترتيب المطلوب', () => {
    expect(WIZARD_STEPS.map((s) => s.key)).toEqual(['basics', 'courses', 'profile', 'domains', 'review'])
  })

  it('مسودة كاملة لا مانع في أي خطوة', () => {
    for (const s of WIZARD_STEPS) expect(blockersOf(s.key, full), s.key).toEqual([])
  })
})

describe('ما يمنع', () => {
  it('البيانات: معرف بصيغة خاطئة يمنع', () => {
    expect(blockersOf('basics', { ...full, id: 'ABC' })).toContain('المعرف بصيغة PW-XXX-000')
  })

  it('البيانات: تحوّل ناقص يمنع — بلا «بعد» لا يعرف المتعلم ما يشتريه', () => {
    const b = blockersOf('basics', { ...full, afterText: '' })
    expect(b.length).toBe(1)
    expect(b[0]).toContain('الحال بعد المسار')
  })

  it('الدورات: بلا دورة يمنع', () => {
    expect(blockersOf('courses', { ...full, courseIds: [] })).toEqual([
      'دورة واحدة على الأقل — المسار وعدٌ بلا محتوى',
    ])
  })

  it('الجمهور: بلا شخصية أو بلا هدف يمنع — والسبب يقول أثر الفراغ', () => {
    expect(blockersOf('profile', { ...full, personas: [] })[0]).toContain('يطابق كل شخصية')
    expect(blockersOf('profile', { ...full, goals: [] })[0]).toContain('يطابق كل هدف')
    expect(blockersOf('profile', { ...full, personas: [], goals: [] })).toHaveLength(2)
  })

  it('المجال: بلا مجال يمنع — نفس قاعدة حاجز النشر (ج-١)', () => {
    expect(blockersOf('domains', { ...full, domainIds: [] })[0]).toContain('لا يدخل مطابقة احتياج المستخدم')
  })
})

describe('ما لا يمنع', () => {
  it('الحقول الاختيارية لا تمنع أي خطوة', () => {
    const bare = { ...full, shortTitle: '', durationWeeks: '', weeklyHours: '', level: '', capstone: '', minWeeklyLoad: '', notesAr: '' }
    for (const s of WIZARD_STEPS) expect(blockersOf(s.key, bare), s.key).toEqual([])
  })

  it('خطوة المراجعة لا تمنع بذاتها — الأثر يُفحص لا يُشترط في المسودة', () => {
    expect(blockersOf('review', EMPTY_DRAFT)).toEqual([])
  })

  it('هدف غير قابل للوصول يُنبَّه ولا يمنع', () => {
    const d = { ...full, goals: ['promotion', 'goal_that_does_not_exist'] }
    expect(blockersOf('profile', d)).toEqual([])
    expect(unreachableGoals(d)).toEqual(['goal_that_does_not_exist'])
    expect(unreachableGoals(full)).toEqual([])
  })
})

describe('المفردات مشتقة من المحرك لا مكتوبة يدويا', () => {
  it('الشخصيات سبع ولكل واحدة مراحلها', () => {
    const opts = personaOptions()
    expect(opts).toHaveLength(7)
    expect(opts.every((o) => o.stages.length > 0)).toBe(true)
    expect(opts.find((o) => o.key === 'manager')?.stages).toEqual(['manager', 'senior_manager'])
  })

  it('الأهداف بلا تكرار رمز، وكلها قابلة للوصول لأنها من GOALS_V21', () => {
    const opts = goalOptions()
    expect(opts.length).toBeGreaterThan(5)
    expect(new Set(opts.map((o) => o.legacy)).size).toBe(opts.length)
    expect(opts.every((o) => o.reachable)).toBe(true)
  })

  it('المراحل تُشتق من الشخصيات بلا تكرار', () => {
    expect(stagesOf(['student', 'early_career'])).toEqual(['early_career', 'fresh_graduate', 'university_student'])
    expect(stagesOf([])).toEqual([])
  })
})
