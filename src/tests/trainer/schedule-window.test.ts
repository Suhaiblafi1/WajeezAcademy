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
   السلوكُ وحدَه لَعاد العطبُ من الموضع الذي لم يُفحَص — وهو بعينه ما وقع. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { windowOpen, remainingSessions, capReached } from '@/application/trainer/schedule-window'

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

describe('السقفُ حدٌّ اختياريّ — وغيابُه ليس بلوغَه', () => {
  it('⚠️ بلا سقفٍ: الباقي «بلا سقف» لا صفر', () => {
    expect(remainingSessions(null, 0), 'قُرئ غيابُ السقف صفرا').toBeNull()
    expect(remainingSessions(undefined, 7)).toBeNull()
  })

  it('⚠️ ومن لا سقفَ له لا يبلغه — ولو جدول تسعين لقاءً', () => {
    expect(capReached(null, 0), 'شعبةٌ فارغةٌ قيل لمدرّبها بلغتَ السقف').toBe(false)
    expect(capReached(null, 90)).toBe(false)
  })

  it('والسقفُ الموضوعُ يُحترَم: يُعَدّ ما بقي، ويُقال إذا نفد', () => {
    expect(remainingSessions(8, 3)).toBe(5)
    expect(capReached(8, 3)).toBe(false)
    expect(remainingSessions(8, 8)).toBe(0)
    expect(capReached(8, 8)).toBe(true)
    /* وما جاوزه لا يُعطي عددا سالبا يُطرح من غيره */
    expect(remainingSessions(8, 11)).toBe(0)
    expect(capReached(8, 11)).toBe(true)
  })

  it('وسقفُ الصفر سقفٌ لم يُوضَع — لا شعبةٌ بصفر لقاءات', () => {
    expect(remainingSessions(0, 0), 'صفرٌ قُرئ سقفا فأُغلق الباب').toBeNull()
    expect(capReached(0, 0)).toBe(false)
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
    expect(SVC).toMatch(/capReached\(/)
  })

  it('⚠️ والشاشةُ كذلك — «بلغتَ السقف» لا تُشتقّ من رقمٍ يعني شيئَين', () => {
    const UI = code('src/pages/trainer/TrainerSchedule.tsx')
    /* `const full = win.remaining <= 0` هي الصيغةُ التي قالت لشعبةٍ فارغةٍ
       إنّها بلغت سقفَها. */
    expect(UI, 'الشاشةُ ما زالت تشتقّ بلوغَ السقف من «الباقي ≤ 0»')
      .not.toMatch(/remaining\s*<=\s*0/)
    expect(UI, 'الشاشةُ لا تقرأ القاعدةَ المشتركة')
      .toMatch(/from ['"]@\/application\/trainer\/schedule-window['"]/)
  })
})
