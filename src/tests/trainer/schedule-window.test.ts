/* ═══ الفصلُ يفتح البابَ، والسقفُ حدٌّ اختياريّ — لا يُخلَطان ═══

   شكا صاحبُ المنصّة (١٧ سبتمبر ٢٠٢٦) أنّ سؤالَ الفصل «عند النقر عليها يصدر
   ملاحظةً لم أفهمها». وتتبُّعُ المسار كشف حلقةً مغلقةً لا رسالةً سيّئةً فحسب:

     ① يختار الفصلَ → `setTerm` يكتب حدودَ النافذة ولا يكتب `maxSessions`.
     ② يمشي إلى «لقاءات مباشرة» → `open` تُحسب بـ«و» ثلاثيّةٍ فتكون false
       → «لم يُحدَّد فصلُ هذه الشعبة بعد — اخترْه في خطوة الاسم والمواعيد».
     ③ ولو فُتح البابُ لقرأ «بلغتَ سقفَ اللقاءات — احذف لقاءً» وشعبتُه فارغة،
       لأنّ `remaining` يُحسب صفرا حين لا سقف.

   وما في ① أعلاه حكايةُ ما كان: الفصلُ يومَها يُختار من شاشته. ثمّ صار
   يُسمَّى عند الإسناد (١٧ سبتمبر ٢٠٢٦) وأُغلق بابُه عنه — ويحرس ذلك
   `cohort-term-and-sessions`. والمحروسُ هنا لم يتبدّل: متى يُفتح البابُ،
   وكم بقي فيه.

   فالحارسُ هنا على **القاعدة** و**على أنّ الموضعَين يقرآنها**. ولو فُحص
   السلوكُ وحدَه لَعاد العطبُ من الموضع الذي لم يُفحَص — وهو بعينه ما وقع.

   ═══ ثمّ سقط السقفُ كلُّه (٤ أكتوبر ٢٠٢٦) ═══

   «لا حاجةَ لسقف الشعبة — يضيفون ما شاؤوا، وساعاتٌ أكثرُ جودةٌ أعلى». فكان هنا
   ما يحرس «غيابُ السقف ليس بلوغَه»، وصار ما يحرس أنّه لا سقفَ أصلا: لا قاعدةَ
   تعدّه، ولا خادمَ يفحصه، ولا شاشةَ تعرضه أو تطلبه. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as SW from '@/application/trainer/schedule-window'
const { windowOpen } = SW

const root = process.cwd()
/* التعليقاتُ تُنزع قبل كلّ فحصٍ بنيويّ: هذا الملفُّ نفسُه يقتبس الشيفرةَ
   المعطوبةَ شرحا، ولو فُحص الخامُ لأسقط نفسَه. وقد مرّ في هذه المنصّة ثلاثةُ
   حرّاسٍ خضراءَ لأسبابٍ خاطئة، منها مطابقةُ نصٍّ في تعليق. */
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const WIN = { scheduleWindowStart: new Date('2026-11-01'), scheduleWindowEnd: new Date('2027-01-31') }

describe('البابُ يفتحه الفصلُ وحدَه', () => {
  it('⚠️ حدّان بلا سقفٍ = نافذةٌ مفتوحة — وهذا هو العطبُ الذي حبس المدرّب', () => {
    expect(windowOpen(WIN), 'الفصلُ محدَّدٌ والبابُ مغلق').toBe(true)
  })

  it('وبلا حدَّين لا نافذة — الفصلُ لم يُحدَّد بعدُ فعلا', () => {
    expect(windowOpen({ scheduleWindowStart: null, scheduleWindowEnd: null })).toBe(false)
    expect(windowOpen({ scheduleWindowStart: WIN.scheduleWindowStart, scheduleWindowEnd: null })).toBe(false)
    expect(windowOpen({})).toBe(false)
  })
})

describe('ولا سقفَ لعدد اللقاءات (٤ أكتوبر ٢٠٢٦)', () => {
  it('⚠️ القاعدةُ لا تعدّ لقاءً: لا «كم بقي» ولا «بلغتَ السقف»', () => {
    expect(Object.keys(SW).sort(), 'عادت قاعدةٌ تعدّ اللقاءات').toEqual(['windowOpen'])
  })

  it('⚠️ والخادمُ لا يقرأ السقفَ ولا يكتبه — ولا يقول «بلغتَ سقفَ اللقاءات»', () => {
    const SVC = code('server/services/cohort.service.ts')
    expect(SVC, 'عاد الخادمُ يقرأ سقفَ الشعبة أو يكتبه').not.toMatch(/maxSessions/)
    expect(SVC).not.toContain('بلغتَ سقفَ اللقاءات')
    const ROUTE = code('server/http/routes/admin-learning.routes.ts')
    const win = ROUTE.slice(ROUTE.indexOf("'/api/admin/cohorts/:id/schedule-window'"), ROUTE.indexOf('return cohorts.setScheduleWindow('))
    expect(win, 'لا مسلكَ للنافذة').toContain('end: z.coerce.date().nullish()')
    expect(win, 'عاد المسلكُ يقبل سقفا').not.toMatch(/maxSessions/)
  })

  it('⚠️ والشاشتان لا تعرضانه ولا تطلبانه — المدرّبُ والإدارة', () => {
    const TRAINER = code('src/pages/trainer/TrainerSchedule.tsx')
    expect(TRAINER).not.toMatch(/maxSessions|remaining|بلغتَ سقفَ/)
    const ADMIN = code('src/pages/admin/AdminCohorts.tsx')
    expect(ADMIN, 'عاد حقلُ السقف إلى نافذة الإدارة').not.toMatch(/maxSessions|سقفُ اللقاءات/)
    expect(ADMIN).toMatch(/const filled = \[form\.start, form\.end\]\.filter\(Boolean\)\.length;/)
  })
})

describe('والموضعان يقرآن القاعدةَ نفسَها — لا نسخةً في كلٍّ', () => {
  const SVC = code('server/services/cohort.service.ts')

  it('⚠️ الخادمُ لا يَضُمّ السقفَ إلى شرط فتح الباب', () => {
    /* الصيغتان المعطوبتان بالحرف:
         Boolean(cohort.scheduleWindowStart && cohort.scheduleWindowEnd && cohort.maxSessions)
         if (!from || !to || !cap)                                                            */
    expect(SVC, 'ما زال السقفُ يُضَمّ إلى شرط الفتح')
      .not.toMatch(/scheduleWindowEnd\s*&&\s*\w*\.?maxSessions/)
    expect(SVC, 'ما زال غيابُ السقف يُلقي «لم تفتح الإدارةُ نافذة»')
      .not.toMatch(/!from\s*\|\|\s*!to\s*\|\|\s*!cap/)
  })

  it('⚠️ ويستوردها من الوحدة الواحدة لا يكتبها بيده', () => {
    expect(SVC, 'الخادمُ لا يقرأ قاعدةَ النافذة المشتركة')
      .toMatch(/from ['"].*trainer\/schedule-window['"]/)
    expect(SVC).toMatch(/windowOpen\(/)
  })
})
