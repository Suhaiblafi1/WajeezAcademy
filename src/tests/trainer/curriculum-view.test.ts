/* المنهجُ كاملا — من الألف إلى الياء (المرحلة ٣).

   «صفحةٌ توضح كلَّ ما كتبه بالترتيب: المعلوماتُ الأساسيّة، ثمّ المحاورُ ورابطُ
   كرّاسة كلّ محورٍ وتحتها المهامُّ التطبيقيّةُ لكلّ محورٍ والمصادر… وإذا جمع بين
   محاورَ مختلفةٍ يصبح محور ١+٢» (صاحب المنصّة، ٢٧ سبتمبر ٢٠٢٦).

   البناءُ المحضُ في `curriculum-view.ts`؛ ورسمُه في `CurriculumReview` (أسفلَ
   هذا الملفّ رسما ساكنا)؛ وأنّ الصفحتين تقرآنه في `axis-stepper.test.ts`. */

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { axesLabel, curriculumView, type CurriculumInput } from '@/application/trainer/curriculum-view'
import CurriculumReview from '@/components/CurriculumReview'

const content = {
  kind: 'trainer',
  summaryAr: 'شعبةٌ تُخرج خريطةَ أتمتة.',
  modules: [
    { moduleId: 'M1', titleAr: 'رسمُ العمليّة', outcomeAr: 'خريطةٌ واحدة', bodyAr: 'كلمةٌ ثانيةٌ ثالثة' },
    { moduleId: 'M2', titleAr: 'قياسُ الهدر', bodyFileKey: 'k-body-2', bodyFileName: 'هدر.pdf' },
    { moduleId: 'M3', titleAr: 'اختيارُ الأداة' },
    { moduleId: 'M4', titleAr: 'خطّةُ التنفيذ' },
    { moduleId: 'M5', titleAr: 'محورٌ بلا موعد' },
  ],
  slots: [
    { startsOn: '2027-02-07', endsOn: '2027-02-13', moduleIds: ['M1', 'M2'], workbook: { url: 'https://x.test/wb1' } },
    { startsOn: '2027-02-14', endsOn: '2027-02-20', moduleIds: ['M3'], workbook: { url: 'javascript:alert(1)' } },
    { startsOn: '2027-02-21', endsOn: '2027-03-06', moduleIds: ['M4'], workbook: { bodyFileKey: 'k-wb4', bodyFileName: 'كرّاسة٤.pdf' } },
  ],
  resources: [
    { title: 'مسجّلٌ للأوّل', url: 'https://x.test/rec', category: 'recorded', moduleId: 'M1', opensAt: '2027-02-08T06:00:00.000Z' },
    { title: 'قراءةٌ مسبقة', url: 'https://x.test/pre', moduleId: 'M3', preReading: true },
    { title: 'للشعبة كلِّها', url: 'https://x.test/all' },
  ],
}
const input: CurriculumInput = {
  title: 'الدفعة الأولى',
  period: { startsOn: '2027-02-07', endsOn: '2027-03-06' },
  content,
  now: new Date('2027-02-10T00:00:00.000Z'),
  sessions: [
    { id: 's2', title: 'لقاءُ الثالث', startsAt: '2027-02-15T15:00:00.000Z', endsAt: '2027-02-15T17:00:00.000Z', moduleIds: ['M3'], approvalState: 'pending' },
    /* لقاءٌ ثانٍ للموعد الأوّل يرد قبل الأوّل في الصفوف — ويُعرض بعده بوقته */
    { id: 's1b', title: 'لقاءٌ ثانٍ للأوّلين', startsAt: '2027-02-12T15:00:00.000Z', endsAt: '2027-02-12T17:00:00.000Z', moduleIds: ['M1'], approvalState: 'approved' },
    { id: 's1', title: 'لقاءُ الأوّلين', startsAt: '2027-02-08T15:00:00.000Z', endsAt: '2027-02-08T17:00:00.000Z', moduleIds: ['M2', 'M1'], approvalState: 'approved' },
    { id: 'old', title: 'قديمٌ بعمودٍ واحد', startsAt: '2027-02-22T15:00:00.000Z', moduleId: 'M4', approvalState: 'approved' },
    { id: 'ph', title: 'مثالُ الإدارة', startsAt: '2027-02-09T15:00:00.000Z', moduleIds: ['M1'], placeholder: true },
    { id: 'x', title: 'ملغى', startsAt: '2027-02-09T15:00:00.000Z', moduleIds: ['M1'], status: 'cancelled' },
    { id: 'loose', title: 'بلا محور', startsAt: '2027-02-11T15:00:00.000Z', moduleIds: [] },
  ],
  assessments: [
    { id: 'a1', title: 'تطبيقُ الأوّل', type: 'assignment', moduleId: 'M1', dueAt: '2027-02-13T20:59:59.999Z', briefAr: 'ارسم', attachments: [{}, {}] },
    { id: 'a4', title: 'مشروعُ الرابع', type: 'project', moduleId: 'M4' },
    { id: 'c', title: 'مغلقة', type: 'assignment', moduleId: 'M1', status: 'closed' },
    { id: 'g', title: 'بلا محور', type: 'quiz', moduleId: null },
  ],
}
const view = curriculumView(input)
const group = (label: string) => view.groups.find((g) => g.label === label)!

describe('المواعيدُ بالترتيب — وكلُّ موعدٍ محاورُه', () => {
  it('⚠️ المجموعاتُ على ترتيب المواعيد، والمجموعان «المحور ١ + ٢»', () => {
    expect(view.bySlot).toBe(true)
    expect(view.groups.map((g) => g.label)).toEqual(['المحور 1 + 2', 'المحور 3', 'المحور 4', 'المحور 5'])
    expect(group('المحور 1 + 2')).toMatchObject({ startsOn: '2027-02-07', endsOn: '2027-02-13' })
    expect(axesLabel([2, 1])).toBe('المحور 1 + 2')
  })

  it('⚠️ ومحورٌ في الخطّة بلا موعدٍ يُعرض لا يُخفى', () => {
    expect(group('المحور 5')).toMatchObject({ startsOn: null, workbook: null })
  })

  it('والمحورُ بما كتبه: ما يخرج به، ومتنُه بعدد كلماته أو ملفُّه', () => {
    const [m1, m2] = group('المحور 1 + 2').axes
    expect(m1).toMatchObject({ n: 1, title: 'رسمُ العمليّة', outcome: 'خريطةٌ واحدة', bodyWords: 3, bodyFile: null })
    expect(m2).toMatchObject({ n: 2, body: null, bodyFile: { key: 'k-body-2', name: 'هدر.pdf' } })
  })

  it('⚠️ والكرّاسةُ بقاعدة الخادم — الرابطُ غيرُ http كأن لم يكن', () => {
    expect(group('المحور 1 + 2').workbook).toMatchObject({ url: 'https://x.test/wb1' })
    expect(group('المحور 3').workbook, 'رابطُ javascript عُدّ كرّاسة').toBeNull()
    expect(group('المحور 4').workbook).toMatchObject({ fileKey: 'k-wb4', fileName: 'كرّاسة٤.pdf' })
  })
})

describe('اللقاءاتُ والمهامُّ والمصادرُ تحت مواعيدها', () => {
  it('⚠️ اللقاءُ في موعد محوره، بترتيب وقته — لا المبدئيُّ ولا الملغى', () => {
    expect(group('المحور 1 + 2').meetings.map((m) => m.id), 'اللقاءاتُ بترتيب صفوفها لا بمواعيدها').toEqual(['s1', 's1b'])
    expect(group('المحور 1 + 2').meetings[0]).toMatchObject({ axes: [1, 2], state: 'held' })
    expect(group('المحور 3').meetings[0]).toMatchObject({ id: 's2', state: 'pending' })
    /* والقديمُ بعمود `moduleId` وحدَه يُقرأ لمحوره */
    expect(group('المحور 4').meetings[0]).toMatchObject({ id: 'old', state: 'approved' })
    expect(view.general.meetings.map((m) => m.id)).toEqual(['loose'])
    expect(view.counts.meetings, 'عُدّ المبدئيُّ أو الملغى').toBe(5)
  })

  it('⚠️ المهمّةُ تحت محورها بتعليماتها ومرفقاتها — والمغلقةُ لا تُعدّ', () => {
    expect(group('المحور 1 + 2').tasks).toEqual([
      { id: 'a1', title: 'تطبيقُ الأوّل', type: 'assignment', dueAt: '2027-02-13T20:59:59.999Z', briefAr: 'ارسم', attachments: 2 },
    ])
    expect(group('المحور 4').tasks[0]).toMatchObject({ id: 'a4', briefAr: null, dueAt: null })
    expect(view.general.tasks.map((t) => t.id)).toEqual(['g'])
    expect(view.counts.tasks).toBe(3)
  })

  it('⚠️ والمسجَّلُ جلسةٌ تحت موعده، والمسبقةُ مصدرٌ بعلامتها، والعامُّ للشعبة كلِّها', () => {
    expect(group('المحور 1 + 2').recordings).toEqual([{ title: 'مسجّلٌ للأوّل', url: 'https://x.test/rec', opensAt: '2027-02-08T06:00:00.000Z' }])
    expect(group('المحور 3').resources[0]).toMatchObject({ title: 'قراءةٌ مسبقة', preReading: true })
    expect(view.general.resources.map((r) => r.title)).toEqual(['للشعبة كلِّها'])
    expect(view.counts).toMatchObject({ resources: 2, recordings: 1, axes: 5 })
  })
})

describe('وما اعتُمد قبل المواعيد يُقرأ محورا محورا', () => {
  it('⚠️ بلا مواعيدَ: لكلّ محورٍ مجموعتُه بالترتيب، ومهامُّه تحته', () => {
    const legacy = curriculumView({ ...input, content: { ...content, slots: [] } })
    expect(legacy.bySlot).toBe(false)
    expect(legacy.groups.map((g) => g.label)).toEqual(['المحور 1', 'المحور 2', 'المحور 3', 'المحور 4', 'المحور 5'])
    expect(legacy.groups[0].tasks.map((t) => t.id)).toEqual(['a1'])
    expect(legacy.groups.every((g) => g.startsOn === null && g.workbook === null)).toBe(true)
  })
})

/* ═══ والرسمُ — ما يقرؤه المدرّبُ والمعتمِدُ فعلا ═══ */
describe('صفحةُ المنهج مرسومة', () => {
  const html = (onEdit?: () => void) => renderToStaticMarkup(createElement(CurriculumReview, { view, onEdit }))

  it('⚠️ بالترتيب: الأساسيّات، ثمّ الموعدُ الأوّل بمحوريه، ثمّ ما للشعبة كلِّها', () => {
    const h = html()
    const at = (s: string) => h.indexOf(s)
    expect(at('الدفعة الأولى')).toBeGreaterThan(-1)
    expect(at('شعبةٌ تُخرج خريطةَ أتمتة.')).toBeGreaterThan(at('الدفعة الأولى'))
    expect(at('الموعد 1 · المحور 1 + 2')).toBeGreaterThan(at('شعبةٌ تُخرج'))
    expect(at('الموعد 2 · المحور 3')).toBeGreaterThan(at('الموعد 1 · المحور 1 + 2'))
    expect(at('للشعبة كلِّها — بلا محور')).toBeGreaterThan(at('الموعد 2 · المحور 3'))
  })

  it('⚠️ ويُقال ما ينقص في موضعه — كرّاسةٌ غائبة، ومهمّةٌ بلا تعليمات، ومحورٌ بلا متن', () => {
    const h = html()
    /* وكرّاسةُ الدورة الواحدة غائبةٌ في هذه الخطّة — تُقال في رأس المنهج (٣٠ سبتمبر ٢٠٢٦) */
    expect(h).toContain('لم تُوضع بعد.')
    expect(h).toContain('بلا تعليمات')
    expect(h).toContain('بلا متنٍ نظريّ بعد.')
  })

  it('⚠️ وملفُّ الكرّاسة والمتن من المسار المحروس — لا مفتاحٌ عارٍ', () => {
    const h = html()
    expect(h).toContain('/api/v1/cohort-files/k-wb4')
    expect(h).toContain('/api/v1/cohort-files/k-body-2')
    expect(h).toContain('بانتظار الاعتماد')
  })

  it('⚠️ و«عدّل» للمدرّب وحدَه — المعتمِدُ يقرأ ولا يعدّل', () => {
    expect(html(() => undefined)).toContain('عدّل')
    expect(html(), 'زرُّ تعديلٍ في صفحة المعتمِد').not.toContain('عدّل')
  })
})

/* ═══ وخطوةُ المدرّب الأخيرة تقرؤها قبل الإقرار ═══ */
describe('المدرّبُ يقرأ منهجَه قبل أن يُقرّ', () => {
  const ws = readFileSync(join(process.cwd(), 'src/pages/trainer/CohortWorkspace.tsx'), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
  const approval = ws.slice(ws.indexOf('stage === "approval" && ('))

  it('⚠️ الصفحةُ في درجة الإرسال، قبل مربّع الموافقة — وبزرّ «عدّل» يعيده إلى خطوته', () => {
    /* الوسمُ بعينه لا اسمٌ يبدأ به — `<CurriculumReviewX` ليس الصفحة */
    const review = approval.search(/<CurriculumReview\s/)
    expect(review, 'لا منهجَ في درجة الإرسال').toBeGreaterThan(-1)
    expect(review, 'المنهجُ بعد الإقرار لا قبله').toBeLessThan(approval.indexOf('id="plan-confirm"'))
    expect(approval).toMatch(/onEdit=\{\(s\) => openStage\(s\)\}/)
    expect(approval).toMatch(/sessions: ws\.sessions,\s*assessments: ws\.assessments/)
  })
})

/* ═══ كرّاسةُ الدورة الواحدة (٣٠ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «اجعل الكرّاسةَ واحدةً فقط وليس لكلّ محور، على أن تكون
   كاملةً لكلّ المحاور… سهلةً على الطالب يتبعها محورا محورا». فالمعتمِدُ يراها
   مرّةً في رأس المنهج، وفي كلّ موعدٍ أين يبدأ محورُه فيها — والمحورُ الذي لم
   يُكتب موضعُه يُقال «بلا موضع» في مكانه. */
describe('كرّاسةُ الدورة في المنهج', () => {
  const one = curriculumView({
    ...input,
    content: {
      ...content,
      workbook: { title: 'كرّاسةُ الأتمتة', bodyFileKey: 'k-cwb', parts: [{ moduleId: 'M1', whereAr: 'ص 3' }, { moduleId: 'M2', whereAr: 'ص 9' }] },
    },
  })

  it('⚠️ تُقرأ مرّةً — وموضعُ كلّ محورٍ على محوره', () => {
    expect(one.workbook).toMatchObject({ title: 'كرّاسةُ الأتمتة', fileKey: 'k-cwb' })
    expect(one.groups[0].axes.map((a) => a.workbookWhere)).toEqual(['ص 3', 'ص 9'])
    expect(one.groups[1].axes[0].workbookWhere).toBeNull()
  })

  it('⚠️ والرسمُ يقول موضعَ كلّ محور، ويسمّي الغائب — ولا يعرض كرّاساتِ المواعيد معها', () => {
    const h = renderToStaticMarkup(createElement(CurriculumReview, { view: one }))
    expect(h).toContain('/api/v1/cohort-files/k-cwb')
    expect(h).toContain('في كرّاسة الدورة')
    expect(h).toContain('ص 9')
    expect(h).toContain('بلا موضع')
    expect(h, 'كرّاسةُ موعدٍ قديمةٌ عُرضت بجانب كرّاسة الدورة').not.toContain('/api/v1/cohort-files/k-wb4')
  })
})
