/* قواعدُ اللقاء في منتقيه، والتكرارُ الأسبوعيّ، والنموذجُ الفارغ — ملفُّ صاحب
   المنصّة «تحسينات بوابة مدرّب وجيز» (١١ أكتوبر ٢٠٢٦).

   القواعدُ محضةٌ تُفحص بقيمها. والشاشةُ تُفحص على بنيتها (التعليقاتُ تُنزع قبل
   الفحص): لا قيمةَ مكتوبةً مسبقا في النموذج، والزرُّ «احفظ اللقاء» لا «أرسِله
   للاعتماد»، والتكرارُ يمرّ بالنداء نفسِه وبحفظ المواعيد قبله. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  dayNoteAr, defaultMeetingAxes, firstWeekdayIn, fromClockNote, holidayOn, isWorkday, lateInSlot, suggestedSessionTitle, toClockNote, weeklyProposals, slotDayOptionAr, slotDays } from '@/application/trainer/session-picker'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const SLOT = code('src/pages/trainer/SlotSessions.tsx')
const WEEKLY = code('src/pages/trainer/WeeklySessions.tsx')
const WS = code('src/pages/trainer/CohortWorkspace.tsx')

/* ٢٠٢٦-١٢-٢٠ أحد · ٢٤ خميس · ٢٥ جمعة (عيد الميلاد) · ٢٦ سبت */
describe('قواعد المنتقي — علامة لا منع', () => {
  it('العطلتان تعرفان بيومهما من أيّ سنة', () => {
    expect(holidayOn('2026-12-25')).toBe('عيد الميلاد')
    expect(holidayOn('2027-01-01')).toBe('رأس السنة')
    expect(holidayOn('2026-12-24')).toBeNull()
    expect(holidayOn('')).toBeNull()
  })

  it('يوم العمل الأحد إلى الخميس — والجمعة والسبت لا', () => {
    expect(isWorkday('2026-12-20')).toBe(true)
    expect(isWorkday('2026-12-24')).toBe(true)
    expect(isWorkday('2026-12-26')).toBe(false)
  })

  it('ساعات البدء في يوم عمل قبل الخامسة تعلّم «وقت عمل» — وفي السبت لا', () => {
    expect(fromClockNote('2026-12-20', '16:30')).toBe('وقت عمل')
    expect(fromClockNote('2026-12-20', '17:00')).toBeNull()
    expect(fromClockNote('2026-12-26', '10:00')).toBeNull()
    expect(fromClockNote('', '10:00')).toBeNull()
  })

  it('وما ينتهي بعد العاشرة والنصف يعلّم «متأخّر»', () => {
    expect(toClockNote('22:30')).toBeNull()
    expect(toClockNote('23:00')).toBe('متأخّر')
  })

  it('ويقال تحت اليوم: العطلة أوّلا، ثمّ يوم العمل', () => {
    expect(dayNoteAr('2026-12-25')).toContain('عيد الميلاد')
    expect(dayNoteAr('2026-12-20')).toContain('بعد الخامسة')
    expect(dayNoteAr('2026-12-26')).toBeNull()
  })
})

describe('التكرار الأسبوعيّ — اقتراح يراجع ثمّ يحفظ', () => {
  const slots = [
    { startsOn: '2026-12-20', endsOn: '2026-12-26', moduleIds: ['M1'] },
    { startsOn: '2026-12-27', endsOn: '2027-01-02', moduleIds: ['M2', 'M3'] },
    { startsOn: '2027-01-03', endsOn: '2027-01-05', moduleIds: ['M4'] },
  ]

  it('أوّل يوم من أيّام الأسبوع داخل الموعد — ولا شيء إن لم يقع فيه', () => {
    expect(firstWeekdayIn(slots[0]!, 6)).toBe('2026-12-26')
    expect(firstWeekdayIn(slots[2]!, 6)).toBeNull()
  })

  it('والعطلة تتخطّى إلى الأسبوع التالي داخل الموعد — وإلّا بقيت لتعلّم', () => {
    /* الجمعتان ٢٥ ديسمبر و١ يناير عطلتان — فتُقترح الثالثة */
    expect(firstWeekdayIn({ startsOn: '2026-12-20', endsOn: '2027-01-09' }, 5)).toBe('2027-01-08')
    expect(firstWeekdayIn(slots[0]!, 5)).toBe('2026-12-25')
  })

  it('لقاء لكلّ موعد لمحاوره التي لا لقاء لها — والمغطّى لا يكرّر', () => {
    const out = weeklyProposals(slots, new Set(['M2']), 6)
    expect(out).toEqual([
      { slotIndex: 0, date: '2026-12-26', moduleIds: ['M1'] },
      { slotIndex: 1, date: '2027-01-02', moduleIds: ['M3'] },
      { slotIndex: 2, date: null, moduleIds: ['M4'] },
    ])
    expect(weeklyProposals(slots, new Set(['M1', 'M2', 'M3', 'M4']), 6)).toEqual([])
  })

  it('ويقال إن وقع بعد أوّل ثلاثة أيّام من موعده', () => {
    expect(lateInSlot('2026-12-22', slots[0]!)).toBe(false)
    expect(lateInSlot('2026-12-23', slots[0]!)).toBe(true)
  })

  it('والعنوان المقترح عناوين المحاور — ورقم ما لم يعنون', () => {
    const titles = new Map([['M1', 'قوة الصوت والتنفس'], ['M2', '  ']])
    const no = new Map([['M1', 1], ['M2', 2]])
    expect(suggestedSessionTitle(['M1'], titles, no)).toBe('قوة الصوت والتنفس')
    expect(suggestedSessionTitle(['M1', 'M2'], titles, no)).toBe('قوة الصوت والتنفس · المحور 2')
  })
})

describe('النموذج فارغ — المدرّب يكتب، والمنصّة تقترح', () => {
  it('لا عنوان ولا يوم ولا ساعة مكتوبة مسبقا', () => {
    const blank = SLOT.slice(SLOT.indexOf('const blank = () => ({'), SLOT.indexOf('});', SLOT.indexOf('const blank = () => ({')))
    expect(blank).toMatch(/title: "",/)
    expect(blank).toMatch(/date: "", from: "", to: "",/)
    expect(SLOT, 'عاد العنوان المكتوب «اللقاء المباشر · …»').not.toContain('اللقاء المباشر ·')
    expect(SLOT, 'عادت ساعة افتراضيّة').not.toMatch(/from: "18:00"|to: "20:00"/)
    expect(SLOT, 'العنوان قيمة لا مثال باهت').toMatch(/value=\{form\.title\} placeholder=\{`مثال: \$\{suggested\}`\}/)
  })

  it('ولا يحفظ لقاء قبل أن يختار يومه وساعتاه', () => {
    expect(SLOT).toMatch(/const timed = Boolean\(form\.date && form\.from && form\.to\);/)
    expect(SLOT).toMatch(/disabled=\{busy \|\| title\.length < 2 \|\| !timed \|\|/)
  })

  /* مواعيدُ المحاور من لقاءاتها (١٧ أكتوبر ٢٠٢٦): لقاءٌ جديدٌ على كلّ المحاور يخالف ترتيبَها فيُردّ */
  it('⚠️ في بطاقة الشعبة كلّها: أوّل محور بلا لقاء وحده — ولا شيء إن غطّيت كلّها', () => {
    const axes = ['M1', 'M2', 'M3', 'M4']
    expect(defaultMeetingAxes(axes, new Set(['M1']), true), 'فتح على كلّ ما لم يغطّ').toEqual(['M2'])
    expect(defaultMeetingAxes(axes, new Set(), true)).toEqual(['M1'])
    expect(defaultMeetingAxes(axes, new Set(axes), true), 'اختار عنه وكلّها مغطّاة').toEqual([])
    expect(SLOT, 'الشاشة لا تأخذ محاورها من القاعدة').toMatch(/moduleIds: defaultMeetingAxes\(axes, covered, wholePeriod\),/)
  })

  it('وفي بطاقة الموعد كما كانت: ما لم يغطّ من محاوره — وكلّها إن غطّيت', () => {
    const axes = ['M1', 'M2', 'M3']
    expect(defaultMeetingAxes(axes, new Set(['M1']), false)).toEqual(['M2', 'M3'])
    expect(defaultMeetingAxes(axes, new Set(axes), false)).toEqual(axes)
  })

  it('والزرّ «احفظ اللقاء» — لا «أرسله للاعتماد» في كلّ لقاء', () => {
    expect(SLOT).toContain('احفظ اللقاء')
    expect(SLOT).not.toMatch(/أرسله للاعتماد|أرسل اللقاء للاعتماد/)
  })

  it('و«إلى الساعة» تقول لماذا تبدأ بعد ساعتين — والخيارات تعلّم بالقواعد', () => {
    expect(SLOT).toContain('hint={TO_LADDER_WHY_AR}')
    expect(SLOT).toContain('fromClockNote(form.date, c)')
    expect(SLOT).toContain('toClockNote(c)')
    expect(SLOT).toContain('dayNoteAr(form.date)')
  })
})

describe('التكرار في الشاشة — خيار لا طريقة', () => {
  it('اليدويّ هو الأصل', () => {
    expect(WS).toMatch(/useState<"manual" \| "weekly">\("manual"\)/)
    expect(WS).toContain('<WeeklySessions')
  })

  it('ويحفظ بنداء اللقاء الواحد نفسه — بعد حفظ المواعيد', () => {
    const body = WEEKLY.slice(WEEKLY.indexOf('const save = async'), WEEKLY.indexOf('finally', WEEKLY.indexOf('const save = async')))
    const guard = body.indexOf('if (beforeWrite && !(await beforeWrite())) return;')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(body.indexOf('apiPost(`/api/trainer/cohorts/${cohortId}/sessions`'))
    expect(WEEKLY, 'باب ثان يفترق عن الأوّل').not.toMatch(/sessions\/bulk|sessions\/weekly/)
  })
})

/* ═══ أيّامُ الموعد وحدَها — «اعرض لي الوقتَ المسموحَ به وحدَه» (صاحب المنصّة، ١١ أكتوبر ٢٠٢٦) ═══ */
describe('قائمة أيّام الموعد', () => {
  it('⚠️ من أوّل الموعد إلى آخره وحده — كلّ يوم باسمه وتاريخه', () => {
    const days = slotDays({ startsOn: '2026-12-23', endsOn: '2026-12-27' })
    expect(days.map((d) => d.date)).toEqual(['2026-12-23', '2026-12-24', '2026-12-25', '2026-12-26', '2026-12-27'])
    expect(days[0]!.labelAr).toBe('الأربعاء 23 ديسمبر')
  })

  it('⚠️ وأوّل ثلاثة أيّام «الأنسب» — والعطلة معلّمة باسمها ولا تحذف', () => {
    const days = slotDays({ startsOn: '2026-12-23', endsOn: '2026-12-27' })
    expect(days.map((d) => d.early)).toEqual([true, true, true, false, false])
    expect(days.map(slotDayOptionAr)).toEqual([
      'الأربعاء 23 ديسمبر · الأنسب', 'الخميس 24 ديسمبر · الأنسب', 'الجمعة 25 ديسمبر · عطلة: عيد الميلاد',
      'السبت 26 ديسمبر', 'الأحد 27 ديسمبر',
    ])
  })

  it('وموعد مقلوب أو غير مقروء لا أيّام له', () => {
    expect(slotDays({ startsOn: '2026-12-27', endsOn: '2026-12-23' })).toEqual([])
    expect(slotDays({ startsOn: '', endsOn: '2026-12-23' })).toEqual([])
  })
})
