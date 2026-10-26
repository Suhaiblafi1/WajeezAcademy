/* ═══ نصوصُ صفحة الشعبة بلا تشكيلٍ إعرابيّ (٢٠ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة (١١ أكتوبر ٢٠٢٦): ما يراه إنسانٌ بلا حركاتٍ ولا تنوينٍ ولا سكون — والشدّةُ وحدَها تبقى.
   وكان في صفحة الشعبة ثلاثةٌ: إشعارُ شعبة الإعداد («شعبةُ إعداد… دورتَك… تُنشَر»)، وخطآ بطاقات «قبل/بعد»
   («الرابطُ» و«تُرفع»). والماسحُ يقرأ النصوصَ بشجرة TypeScript لا بالحرف، فالتعليقاتُ ليست منه.

   ثمّ «عقدي» وسجلُّ تنفيذه وملحقُ اعتماده (٢٠ أكتوبر ٢٠٢٦): نصوصُ الشاشة كانت مشكولةً كلُّها — «العودةُ»
   و«لا عقدَ موقَّعا» و«فهي نافذةٌ». ومتنُ العقد الموقَّع ليس منها: يصل من الخادم ولا يُمسّ.

   ورُئي ساقطا: أُعيد «شعبةُ إعداد» في `usePrepCohorts.ts` فسقط، وأُعيدت «عقدي» مشكولةً فسقط. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { markedTexts as marked } from '../helpers/marked-text'

const FILES = [
  'src/pages/trainer/CohortWorkspace.tsx',
  'src/pages/trainer/SlotSessions.tsx',
  'src/pages/trainer/WeeklySessions.tsx',
  'src/pages/trainer/SlotDaySelect.tsx',
  'src/pages/trainer/TrainerSchedule.tsx',
  'src/pages/trainer/SessionsAndAttendance.tsx',
  'src/components/PlanEdits.tsx',
  /* وحالُ بطاقاتها انتقل إلى خطّافه برسائله (٢٦ أكتوبر ٢٠٢٦) — فلا تخرج من الفحص بنقلها */
  'src/hooks/usePlanEdits.ts',
  'src/components/trainer/usePrepCohorts.ts',
  'src/application/trainer/plan-edits.ts',
  /* و«عقدي» وما يعرضه من سجلّ التنفيذ وملحق الاعتماد (٢٠ أكتوبر ٢٠٢٦) — نصوصُ الشاشة لا متنُ العقد الموقَّع */
  'src/pages/trainer/MyContract.tsx',
  'src/components/ContractExecution.tsx',
  'src/components/ContractApproval.tsx',
]

describe('صفحة الشعبة بلا تشكيل', () => {
  it('الماسح يرى الحركة في النصّ ويتجاوز التعليق والشدّة', () => {
    const sample = ["const a = 'شعبةُ إعداد'", "/* شعبةُ في تعليق */ const b = 'شعبة'", "const c = 'الكرّاسة'", 'const d = <p>تُنشَر</p>'].join('\n')
    expect(marked('sample.tsx', sample).map((x) => x.split(' ')[0])).toEqual(['sample.tsx:1', 'sample.tsx:4'])
  })

  it('⚠️ لا حركة في نصوص صفحة الشعبة وما تعرضه', () => {
    const hits = FILES.flatMap((f) => marked(f, readFileSync(join(process.cwd(), f), 'utf8')))
    expect(hits, 'نصّ بتشكيل إعرابيّ').toEqual([])
  })
})

/* ═══ ولا وعدَ بحفظٍ يدويٍّ لم يعد (٢٠ أكتوبر ٢٠٢٦) ═══
   الحفظُ التلقائيُّ يكتب حذفَ المحور بعد ثوانٍ بلا تراجع — وكان الصندوقُ يقول «لا يقع شيء حتّى تحفظ المحاور»،
   وبطاقةُ الموعد «تحفظ بزرّ احفظ في أعلى الصفحة» ولا زرّ. ورُئي ساقطا: أُعيد النصّان فسقط. */
describe('لا وعد بحفظ يدويّ', () => {
  it('⚠️ حذف المحور والجلسة المسجّلة يقولان إنّ الحفظ تلقائيّ', () => {
    const ws = readFileSync(join(process.cwd(), 'src/pages/trainer/CohortWorkspace.tsx'), 'utf8')
    const slot = readFileSync(join(process.cwd(), 'src/pages/trainer/SlotSessions.tsx'), 'utf8')
    expect(ws).not.toContain('حتّى تحفظ المحاور')
    expect(ws).toContain('ويحفظ الحذف تلقائيّا بعد ثوان.')
    expect(slot).not.toContain('بزرّ «احفظ» في أعلى الصفحة')
    expect(slot).toContain('الجلسة المسجّلة تحفظ مع خطّتك تلقائيّا.')
  })
})
