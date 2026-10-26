/* خطوةُ الأجر في «الاتفاقية» لأيٍّ من المدير الأكاديميّ والماليّة — وتحتها سجلُّ أجره بمن ضبط (٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة «C»: يضبط أجرَ المدرّب أيٌّ منهما، والأثرُ يقول من فعل. وكانت الخطوةُ مقفلةً على المدير
   الأكاديميّ («هذه الخطوة تحتاج صلاحيّة لا تملكها») وهو يضبط الرقمَ نفسَه في مُركِّب العقد. والخادمُ يحرسه
   `server/tests/trainer/fee-either.test.ts`؛ وهذا يحرس الشاشة:

   ① تُفتح الخطوةُ لأيٍّ من الحبّتين — وتحفظ بالمسار الذي فتحه الخادمُ لكلتيهما.
   ② وتحت الرقم سجلُّه: من مسار سجلّ أجره، وكلُّ سطرٍ باسم من ضبط، ويُعاد بعد الحفظ.
   ③ وشرحُها لا يَعِد بزرٍّ لا وجودَ له («اعتمده نهائيّا») — يعبر حين نعتمد توقيعَه. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/* بلا التعليقات: ذِكرُ ما كان في شرحٍ ليس عودةً له */
const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PREP = code('src/pages/admin/PreparationSteps.tsx')
const ROUTES = code('server/http/routes/admin-trainer.routes.ts')
const EITHER = String.raw`requireAnyPermission\('trainer\.compensation\.manage', 'trainer\.contract\.manage'\)`
const FEE = /function FeeStep\(\{[\s\S]*?\n\}\n/.exec(PREP)?.[0] ?? ''

describe('① تفتح لأي من الحبتين', () => {
  it('⚠️ لا يقفلها إلا من لا يملك أيا منهما', () => {
    const step = /<Step\s+n=\{1\} stepKey="compensation"[\s\S]*?<\/Step>/.exec(PREP)?.[0] ?? ''
    expect(step, 'خطوة الأجر مفقودة').toContain('<FeeStep')
    expect(step).toContain('locked={!can("trainer.compensation.manage") && !can("trainer.contract.manage")}')
  })

  it('⚠️ وتحفظ بالمسار الذي فتحه الخادم لكلتيهما', () => {
    expect(FEE, 'FeeStep مفقودة').toContain('apiPost("/api/admin/trainer-compensation-rules", {')
    expect(ROUTES).toMatch(new RegExp(String.raw`app\.post\('/api/admin/trainer-compensation-rules', \{\s*preHandler: ${EITHER},`))
  })
})

describe('② وتحت الرقم سجله', () => {
  it('⚠️ من مسار سجل أجره — بحبتي الضبط نفسيهما', () => {
    expect(FEE).toContain('apiGet<FeeHistoryRow[]>(`/api/admin/trainers/${profileId}/fee-history`)')
    expect(ROUTES).toMatch(new RegExp(String.raw`app\.get\('/api/admin/trainers/:profileId/fee-history', \{\s*preHandler: ${EITHER},`))
  })

  it('⚠️ وكل سطر باسم من ضبط — ويعاد بعد الحفظ فيرى اسمه أعلاه', () => {
    const list = /\{history && history\.length > 0 && \([\s\S]*?<\/ol>/.exec(FEE)?.[0] ?? ''
    expect(list, 'السجل لا يصير').toContain('{history.map((h) => (')
    expect(list).toContain('{h.createdByName ? `ضبطه ${h.createdByName}` : "لا يعرف من ضبطه"}')
    const save = /const save = \(\) =>[\s\S]*?"ضبط الاتفاق الماليّ"\);/.exec(FEE)?.[0] ?? ''
    expect(save, 'الحفظ مفقود').toContain('loadHistory();')
  })
})

describe('③ وشرحها لا يعد بزر لا وجود له', () => {
  it('لا «اعتمده نهائيا» — يعبر إلى «المدربون» حين نعتمد توقيعه', () => {
    expect(PREP).not.toContain('اعتمده نهائيّا')
    expect(PREP).toContain('وتعتمد توقيعه <b className="text-foreground">يعبر إلى «المدربون»</b>')
  })
})
