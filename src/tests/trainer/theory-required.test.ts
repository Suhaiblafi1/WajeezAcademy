/* «المحتوى النظريّ» اختياريٌّ — لا يمنع الاعتماد (١٧ أكتوبر ٢٠٢٦).

   كان شرطا منذ ١٣ سبتمبر ٢٠٢٦: أربعون حرفا مكتوبةً أو ملفٌّ مرفوعٌ لكلّ محور، وكان
   هذا الملفُّ يحرسه. ثمّ سأل صاحبُ المنصّة وهو يرى محورا فارغا: «هل المحتوى النظريُّ
   مهمٌّ كونه يوجد كرّاسةٌ للمادّة؟» — فعُرضت عليه ثلاثُ طرقٍ بفروقها، فاختار
   **«Always optional»**. والعلّةُ في `buildChecklist` (`cohort-plan.service.ts`).

   فيحرس الملفُّ القرارَ الجديد من جهتيه:
   ① محورٌ بلا متنٍ لا يمنع تمامَ خطوة المحاور — في الخادم ولا في الشاشة ولا في الدليل.
   ② والخطوةُ نفسُها باقيةٌ شرطا بما سواه: محاورُ، ومواعيدُ سليمة، وتطبيقٌ عمليّ —
      فأسهلُ طريقٍ لـ① أن تُقلَب الخطوةُ كلُّها اختياريّة، وذاك ما لم يُقرَّر. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildChecklist } from '../../../server/services/cohort-plan.service'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

/* يومٌ من أيّام المدّة — من ٧ فبراير ٢٠٢٧ */
const day = (n: number) => new Date(Date.UTC(2027, 1, 7 + n)).toISOString().slice(0, 10)
/* لكلّ محورٍ أسبوعُه وتطبيقُه — كي يُقاس المتنُ وحدَه */
const plan = (bodies: (string | null)[], activity = 'تطبيق عمليّ قصير') => ({
  kind: 'trainer' as const,
  modules: bodies.map((b, i) => ({ moduleId: `M${i}`, titleAr: `محور ${i}`, bodyAr: b, activityAr: activity })),
  resources: [{ title: 'مرجع', url: 'https://x.test/a' }],
  slots: bodies.map((_, i) => ({ startsOn: day(i * 7), endsOn: day(i * 7 + 6), moduleIds: [`M${i}`] })),
})
const modules = (bodies: (string | null)[], activity?: string) => buildChecklist({
  cohort: { title: 'شعبة' },
  period: { startsOn: '2027-02-07', endsOn: '2027-03-14' },
  content: plan(bodies, activity) as never,
  sessions: [{ startsAt: new Date('2027-02-09T15:00:00.000Z'), recordings: [] }],
  assessmentsCount: 0,
  planStatus: 'draft',
}).find((c) => c.key === 'modules')!

describe('① محور بلا محتوى نظريّ لا يمنع الاعتماد', () => {
  it('⚠️ فارغ أو مسافات أو حرف — والخطوة تامّة', () => {
    const row = modules([null, '', '    ', 'x'])
    expect(row.done, 'محور بلا متن منع تمام الخطوة').toBe(true)
    expect(row.labelAr, 'الخطوة ما زالت تطلب كتابة المحتوى').not.toContain('النظريّ')
  })

  it('⚠️ والشاشة لا تقول «ينقصه المحتوى النظريّ» — ولا تقول الخانة إنّه يلزم', () => {
    const ws = code('src/pages/trainer/CohortWorkspace.tsx')
    expect(ws, 'الشاشة ما زالت تعدّه ناقصا').not.toMatch(/ينقصه? المحتوى النظريّ/)
    expect(ws, 'الخانة ما زالت تقول إنّه يلزم للاعتماد').not.toContain('يلزم للاعتماد')
    expect(ws).toContain('label="المحتوى النظريّ"')
  })

  it('⚠️ ودليل المدرّب لا يطلب منه أربعين حرفا', () => {
    const guide = code('src/data/trainer-guide/content.ts')
    expect(guide, 'الدليل ما زال يشترط المحتوى النظريّ').not.toMatch(/حرفا من المحتوى النظريّ|مكتملا بأربعين|محور يتمّ بـ/)
  })
})

describe('② وخطوة المحاور باقية شرطا بما سواه', () => {
  it('⚠️ لا تصير اختياريّة كلّها', () => {
    expect(modules([null]).optional, 'قُلبت الخطوة كلّها اختياريّة').toBe(false)
  })

  it('⚠️ وبلا محاور ناقصة — وبلا تطبيق عمليّ ناقصة', () => {
    expect(modules([]).done).toBe(false)
    expect(modules([null], '').done, 'سقط شرط التطبيق مع المتن').toBe(false)
  })
})
