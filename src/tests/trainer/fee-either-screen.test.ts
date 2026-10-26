/* خطوةُ الأجر في «الاتفاقية» لأيٍّ من المدير الأكاديميّ والماليّة — وتحتها سجلُّ أجره بمن ضبط (٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة «C»: يضبط أجرَ المدرّب أيٌّ منهما، والأثرُ يقول من فعل. وكانت الخطوةُ مقفلةً على المدير
   الأكاديميّ («هذه الخطوة تحتاج صلاحيّة لا تملكها») وهو يضبط الرقمَ نفسَه في مُركِّب العقد. والخادمُ يحرسه
   `server/tests/trainer/fee-either.test.ts`؛ وهذا يحرس الشاشة:

   ① تُفتح الخطوةُ لأيٍّ من الحبّتين — وتحفظ بالمسار الذي فتحه الخادمُ لكلتيهما.
   ② وتحت الرقم سجلُّه: من مسار سجلّ أجره، وكلُّ سطرٍ باسم من ضبط، ويُعاد بعد الحفظ.
   ③ وشرحُها لا يَعِد بزرٍّ لا وجودَ له («اعتمده نهائيّا») — يعبر حين نعتمد توقيعَه.
   ④ وإن خرج له عقدٌ لم ينفذ قيل قبل الحفظ إنّ نصَّه لا يتغيّر به، والخياران: هنا وحدَه، أو يُحفظ ثمّ يحمله نصُّه
      بإعادة إصداره من «العقود» — والطريقُ بحاله. وبلا هذا يوقّع على رقمٍ ويُحسب له غيرُه. (وكان الثاني «مع العقد في
      «العقود»» حين كان التركيبُ والإعادةُ يكتبان الأجر؛ ثمّ صار يُضبط هنا وحدَه — قرارُ «a»، ٢٦ أكتوبر ٢٠٢٦.)
      وذلك للأجر العامّ وحدَه: قاعدةُ شعبةٍ واحدة (قرارُ «a»، ٢٦ أكتوبر ٢٠٢٦) لا تمسّ نصَّ العقد. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { outContractOf } from '@/application/trainer/contract-fee'

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

describe('④ وعقد خرج ولم ينفذ يقال قبل الحفظ', () => {
  const c = (status: string, createdAt = '2026-10-20T10:00:00Z', fee: Record<string, string | null> = {}) => ({
    title: `عقد ${status}`, status, createdAt,
    compensationType: 'per_seat', compensationRate: '30', currency: 'JOD', ...fee,
  })

  it('⚠️ ما خرج ولم ينفذ وحده — المسودة والمرسل والموقع وطلب التعديل', () => {
    for (const status of ['draft', 'sent', 'signed', 'amendment_requested']) {
      expect(outContractOf([c(status)]), status).not.toBeNull()
    }
    /* والنافذ يغير أجره بالقاعدة، والمغلق لا نص له يفترق */
    for (const status of ['signature_approved', 'countersigned', 'revoked', 'declined', 'expired', 'terminated', 'superseded']) {
      expect(outContractOf([c(status)]), status).toBeNull()
    }
  })

  it('⚠️ أحدثها — بأجره كما في نصه', () => {
    const out = outContractOf([
      c('revoked', '2026-10-01T10:00:00Z'),
      c('sent', '2026-10-05T10:00:00Z', { compensationRate: '25' }),
      c('signed', '2026-10-20T10:00:00Z', { compensationType: 'fixed_per_cohort', compensationRate: '400' }),
    ])
    expect(out?.contract.status).toBe('signed')
    expect(out?.phraseAr).toBe('وقعه وينتظر اعتماد توقيعه')
    expect(out?.howAr).toBe('ولتحمله نصه: أعده للتوقيع من «العقود» واختر أجر «الاتفاقية».')
    expect(out?.feeAr).toBe('بأجر ثابت لكل شعبة 400 JOD')
    expect(outContractOf([c('sent', undefined, { compensationType: 'revenue_share', compensationRate: '40' })])?.feeAr)
      .toBe('بأجر نسبة من الإيراد 40 %')
    expect(outContractOf([c('sent', undefined, { compensationType: null })])?.feeAr).toBe('بلا أجر')
  })

  it('⚠️ والخطوة تقوله بخيارين — «العقود» لمن يركّب العقد وحده', () => {
    expect(FEE).toContain('const out = outContractOf(contracts);')
    const note = /\{out && !scope && \(\s*<Inset[\s\S]*?<\/Inset>/.exec(FEE)?.[0] ?? ''
    expect(note, 'لا يقال شيء').toContain('{out.feeAr}')
    expect(note).toContain('الحفظ هنا يغيّر الأجر الذي يحسب له، ويبقى نصّ')
    expect(note, 'لا يقال كيف يحمله نصه').toContain('{out.howAr}')
    expect(FEE).toContain('{scope ? "اضبطه لهذه الشعبة" : out ? "احفظه هنا" : live ? "استبدل القاعدة السارية" : "اضبط الاتفاق الماليّ"}')
    expect(FEE).toMatch(/\{out && !scope && contractsHref && \(\s*<Button as=\{Link\} to=\{contractsHref\}/)
    expect(PREP).toContain('contractsHref={can("trainer.contract.manage") ? contractsHref : undefined}')
    expect(PREP).toMatch(/profileId=\{profileId\} live=\{activeRule\} contracts=\{contracts\}/)
    expect(code('src/pages/admin/TrainerApplications.tsx')).toContain('contractsHref={contractsHref(a, "contract")}')
  })
})
