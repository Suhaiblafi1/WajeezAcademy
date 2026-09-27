/* ما تغيّر عن المعتمَد — مراجعةُ الخطّة كما يقرؤها المعتمِد (٣ج-٤).

   العلّةُ في رأس `application/trainer/plan-diff.ts`. وهنا القاعدةُ محضةً: ما
   يُذكر، وبأيّ خطوة، وما لا يُذكر لأنّه لم يتغيّر. */

import { describe, expect, it } from 'vitest'
import { planDiff } from '@/application/trainer/plan-diff'

const fmt = { date: (d: string) => d.slice(5) }
/* شكلُ الخطّة كما يُحفظ — مرخًى، فكلُّ حقلٍ يُعدَّل في مراجعةٍ يقبل قيمتَه */
interface Plan {
  summaryAr?: string | null
  startsOn?: string
  endsOn?: string
  modules: { moduleId: string; titleAr?: string; bodyAr?: string; outcomeAr?: string }[]
  slots: { startsOn: string; endsOn: string; moduleIds: string[]; workbook?: { url?: string } | null }[]
  resources: { title: string; url?: string; category?: string; moduleId?: string }[]
}
const approved: Plan = {
  summaryAr: 'دورةٌ في أتمتة العمليات',
  startsOn: '2027-02-07', endsOn: '2027-03-06',
  modules: [
    { moduleId: 'm1', titleAr: 'اختيارُ العمليّة', bodyAr: 'متنُ الأوّل' },
    { moduleId: 'm2', titleAr: 'جدوى الأتمتة', outcomeAr: 'يقيس الجدوى' },
    { moduleId: 'm3', titleAr: 'التنفيذ' },
    { moduleId: 'm4', titleAr: 'القياس' },
  ],
  slots: [
    { startsOn: '2027-02-07', endsOn: '2027-02-13', moduleIds: ['m1'], workbook: { url: 'https://x.test/w1.pdf' } },
    { startsOn: '2027-02-14', endsOn: '2027-02-20', moduleIds: ['m2'], workbook: { url: 'https://x.test/w2.pdf' } },
    { startsOn: '2027-02-21', endsOn: '2027-02-27', moduleIds: ['m3'] },
    { startsOn: '2027-02-28', endsOn: '2027-03-06', moduleIds: ['m4'] },
  ],
  resources: [
    { title: 'دليلُ الأتمتة', url: 'https://x.test/guide', moduleId: 'm1' },
    { title: 'تسجيلُ اللقاء الأوّل', url: 'https://x.test/rec1', category: 'recorded', moduleId: 'm1' },
  ],
}
const revise = (patch: Partial<Plan>): Plan => ({ ...structuredClone(approved), ...patch })
const lines = (r: ReturnType<typeof planDiff>, section: string) => r.find((s) => s.section === section)?.lines ?? []

describe('ما لم يتغيّر لا يُذكر', () => {
  it('⚠️ المراجعةُ نفسُها بلا تغييرٍ لا سطرَ لها — ولا قسمَ فارغ', () => {
    expect(planDiff(approved, structuredClone(approved), fmt)).toEqual([])
  })

  it('⚠️ والفراغُ والمسافاتُ ليست تغييرا — «بلا وصف» هو «بلا وصف»', () => {
    const a = { ...approved, summaryAr: null }
    expect(planDiff(a, { ...approved, summaryAr: '   ' }, fmt)).toEqual([])
  })
})

describe('المعلوماتُ الأساسيّة', () => {
  it('⚠️ المدّةُ بطرفيها قبلُ وبعدُ — والوصفُ يُقال تغيّرُه', () => {
    const r = planDiff(approved, revise({ endsOn: '2027-03-13', summaryAr: 'وصفٌ جديد' }), fmt)
    expect(r[0]).toMatchObject({ section: 'identity', label: 'المعلومات الأساسيّة' })
    expect(lines(r, 'identity')).toEqual(['المدّة: من 02-07 إلى 03-06 ← من 02-07 إلى 03-13', 'تغيّر وصفُ الشعبة'])
  })
})

describe('المحاورُ ومواعيدها', () => {
  it('⚠️ محورٌ أُضيف وآخرُ حُذف وثالثٌ تغيّر اسمُه — كلٌّ بسطره', () => {
    const next = revise({})
    next.modules = [
      { moduleId: 'm1', titleAr: 'اختيارُ العمليّة المناسبة', bodyAr: 'متنُ الأوّل' },
      { moduleId: 'm2', titleAr: 'جدوى الأتمتة', outcomeAr: 'يقيس الجدوى' },
      { moduleId: 'm3', titleAr: 'التنفيذ' },
      { moduleId: 'm5', titleAr: 'الاستدامة' },
    ]
    expect(lines(planDiff(approved, next, fmt), 'modules')).toEqual(expect.arrayContaining([
      'أُضيف محور: «الاستدامة»',
      'حُذف محور: «القياس»',
      '«اختيارُ العمليّة» صار «اختيارُ العمليّة المناسبة»',
    ]))
  })

  it('⚠️ وما تغيّر في محورٍ يُسمّى بحقوله — المتنُ والمخرَج', () => {
    const next = revise({})
    next.modules[0] = { ...next.modules[0], bodyAr: 'متنٌ أطول' }
    next.modules[1] = { ...next.modules[1], outcomeAr: 'يقيس الجدوى ويقارنها' }
    expect(lines(planDiff(approved, next, fmt), 'modules')).toEqual([
      'تغيّر في «اختيارُ العمليّة»: المتن',
      'تغيّر في «جدوى الأتمتة»: المخرَج',
    ])
  })

  it('⚠️ والترتيبُ وحدَه تغيير — منه أرقامُ المحاور', () => {
    const next = revise({})
    next.modules = [next.modules[1], next.modules[0], next.modules[2], next.modules[3]]
    expect(lines(planDiff(approved, next, fmt), 'modules')).toContain('تغيّر ترتيبُ المحاور')
  })

  it('⚠️ والمواعيدُ بأرقامها: تاريخُها ومحاورُها وعددُها', () => {
    const next = revise({})
    next.slots[3] = { ...next.slots[3], endsOn: '2027-03-13' }
    next.slots[2] = { ...next.slots[2], moduleIds: ['m3', 'm4'] }
    const ls = lines(planDiff(approved, next, fmt), 'modules')
    expect(ls).toContain('الموعد 4: من 02-28 إلى 03-06 ← من 02-28 إلى 03-13')
    expect(ls).toContain('محاورُ الموعد 3: المحور 3 ← المحور 3 + 4')
    const fewer = revise({})
    fewer.slots = fewer.slots.slice(0, 3)
    expect(lines(planDiff(approved, fewer, fmt), 'modules')).toContain('صارت المواعيدُ 3 بعد 4')
  })
})

describe('الكرّاسات', () => {
  it('⚠️ أُضيفت وحُذفت وتغيّرت — كلٌّ بموعدها', () => {
    const next = revise({})
    next.slots[0] = { ...next.slots[0], workbook: { url: 'https://x.test/w1-v2.pdf' } }
    next.slots[1] = { ...next.slots[1], workbook: null }
    next.slots[2] = { ...next.slots[2], workbook: { url: 'https://x.test/w3.pdf' } }
    expect(lines(planDiff(approved, next, fmt), 'workbooks')).toEqual([
      'تغيّرت كرّاسةُ الموعد 1', 'حُذفت كرّاسةُ الموعد 2', 'أُضيفت كرّاسةُ الموعد 3',
    ])
  })
})

describe('الجلساتُ المسجّلة والمصادر — كلٌّ في خطوته', () => {
  it('⚠️ المسجّلةُ في «اللقاءات» والمصادرُ في «المهامّ والمصادر» — لا تختلطان', () => {
    const next = revise({})
    next.resources = [
      { title: 'دليلُ الأتمتة', url: 'https://x.test/guide-v2', moduleId: 'm1' },
      { title: 'تسجيلُ اللقاء الثاني', url: 'https://x.test/rec2', category: 'recorded', moduleId: 'm2' },
      { title: 'مقالٌ للقراءة', url: 'https://x.test/read', moduleId: 'm2' },
    ]
    const r = planDiff(approved, next, fmt)
    expect(lines(r, 'sessions')).toEqual(['أُضيف تسجيل: «تسجيلُ اللقاء الثاني»', 'حُذف تسجيل: «تسجيلُ اللقاء الأوّل»'])
    expect(lines(r, 'assignments')).toEqual(['تغيّر رابطُ «دليلُ الأتمتة»', 'أُضيف مصدر: «مقالٌ للقراءة»'])
    expect(r.find((s) => s.section === 'sessions')?.label).toBe('اللقاءات')
  })

  it('⚠️ وموضعُه وموعدُ ظهوره تغييرٌ وإن بقي رابطُه', () => {
    const next = revise({})
    next.resources = [{ ...next.resources[0], moduleId: 'm2' }, next.resources[1]]
    expect(lines(planDiff(approved, next, fmt), 'assignments')).toEqual(['تغيّر موضعُ «دليلُ الأتمتة» أو موعدُ ظهوره'])
  })
})

describe('وما لا يُقرأ لا يُسقط الصفحة', () => {
  it('خطّةٌ فارغةٌ أو معطوبةٌ تُقرأ بلا شيء', () => {
    expect(planDiff(null, undefined, fmt)).toEqual([])
    expect(planDiff({ modules: 'x' }, { slots: 7 }, fmt)).toEqual([])
  })
})
