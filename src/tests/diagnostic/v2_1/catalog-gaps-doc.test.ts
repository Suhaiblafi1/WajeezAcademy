/* وثيقةُ الفجوات تصف المحرّكَ الحيّ — لا محرّكا تقاعد.

   ─────────── العطبُ الذي وُضع له هذا الحارس ───────────

   كانت `CATALOG_GAPS_FROM_DIAGNOSTIC_AR.md` تُولَّد من محاكاةِ محرّك **V2**،
   ويُلحَق بها سببٌ جذريٌّ **مكتوبٌ باليد في المولّد**: «سؤال الهدف ينتج ٧
   رموز فقط، وهذه اثنا عشرَ مسارا لا تُوصَل». فالأرقامُ تتجدّد والتعليلُ لا
   يتجدّد. ثمّ انتقلت المنصّةُ إلى V2.1 فبقيت الوثيقةُ تصف محرّكا لا يخدم
   أحدا — وقياسُ المحرّك الحيّ نقض دعواها: المساراتُ كلُّها تفوز، والسؤالُ
   يعلن اثني عشرَ رمزا لا سبعة.

   **ولم تكن وثيقةً تُقرأ وتُنسى**: قُرئت فبُني عليها، وساقت قارئَها إلى
   المشكلة الخطأ. فوثيقةٌ بائدةٌ أسوأُ من لا وثيقة.

   ─────────── والمقيسُ بنيةٌ لا ورودُ حرف ───────────

   لا يكفي أن يُطابَق نصٌّ في الوثيقة — فذاك يخضرّ لأنّ الحرفَ ورد. المقيسُ:
   أنّ الوثيقةَ **مربوطةٌ ببوّابةٍ تقارنها بالمحرّك**، وأنّ مولّدها لا يكتب
   عددا مسكوكا في نصّه. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const GEN = 'scripts/v2_1/audit-catalog-gaps.ts'
const DOC = 'docs/CATALOG_GAPS_FROM_DIAGNOSTIC_AR.md'

describe('وثيقةُ فجوات الكتالوج لا تبيد صامتةً', () => {
  it('البوّابةُ مربوطةٌ في `verify` — خطُّ أساسٍ لا يُقارن به شيءٌ ليس خطَّ أساس', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    const gate = pkg.scripts['ci:catalog-gaps']
    expect(gate, 'لا أمرَ `ci:catalog-gaps`').toBeTruthy()
    expect(gate, 'البوّابةُ لا تعمل بوضع المقارنة').toContain('--check')
    expect(gate).toContain('audit-catalog-gaps')
    expect(pkg.scripts['verify'], '`verify` لا تستدعي البوّابة').toContain('ci:catalog-gaps')
  })

  it('ومولّدٌ واحدٌ لا مولّدان — فمن شغّل الآخرَ لا يمحو هذه', () => {
    const old = read('scripts/report-v2-docs.ts')
    expect(old, 'مولّدٌ ثانٍ ما زال يكتب وثيقةَ الفجوات').not.toContain(`writeFileSync(join(root, '${DOC}')`)
  })

  it('ولا عددَ مسكوكٌ في نصّ المولّد — كلُّ رقمٍ محسوبٌ من المحرّك', () => {
    const gen = read(GEN)
    /* أسطرُ القالب وحدَها (ما بين علامتَي اقتباسٍ خلفيّة) تُفحَص: التعليقُ
       يسوق أرقامَ الحادثة شرحا، وهي توثيقٌ لا مخرَج. */
    const template = gen.slice(gen.indexOf('return `#'))
    const frozen = template.match(/(?<![$\w])(٧|7 رموز|اثنا عشر مسارا|12 من 20)(?![\w])/g)
    expect(frozen, `تعليلٌ مسكوكٌ عاد إلى القالب: ${frozen?.join('، ')}`).toBeNull()
  })

  it('والوثيقةُ تقول حدَّ مسحها — «لم يفز» ليست «لا يُوصَل»', () => {
    const doc = read(DOC)
    expect(doc, 'لا يُذكر حدُّ المسح، فيُقرأ غيابُ مسارٍ نفيا').toMatch(/لم يثبت أنّه لا يُوصَل/)
  })

  it('وتُعلن أنّها مولَّدةٌ وتسمّي مولّدَها — فلا تُحرَّر باليد فتُمحى', () => {
    const doc = read(DOC)
    expect(doc).toMatch(/وُلّدت آليًا/)
    expect(doc, 'لا تدلّ على مولّدها').toContain('audit-catalog-gaps.ts')
  })
})
