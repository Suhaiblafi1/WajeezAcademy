/* العقدُ يأخذ أجرَه من «الاتفاقية» — لا خاناتِ أجرٍ في التركيب ولا في الإعادة (٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة «a»: الأجرُ يُضبط في «الاتفاقية» من ملفّ المدرّب وحدَها. وكان يُكتب في ثلاثة مواضعَ غيرِها: «الأتعاب»
   (ذهب نموذجُها — `fee-agreement-door.test.ts`)، ومُركِّبُ العقد، ونافذةُ إعادته. والخادمُ يحرسه
   `server/tests/trainer/fee-from-agreement.test.ts`؛ وهذا يحرس الشاشة:

   ① المُركِّبُ لا يكتب أجرا: يقرأ القاعدةَ السارية ويدلّ على «الاتفاقية»، ولا يرسل `compensation`.
   ② ونافذةُ الإعادة لا تكتب أجرا: أجرُ عقده أو أجرُ «الاتفاقية» حين يفترقان — بخيارين وأثرِ كلٍّ منهما — وترسل
      `feeFromRule` وحدَه.
   ③ وخطوةُ الأجر تقول كيف يحمل نصُّ عقده الأجرَ الجديد، بحاله — وكلُّها من «العقود». */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { outContractOf } from '@/application/trainer/contract-fee'

/* بلا التعليقات: ذِكرُ ما كان في شرحٍ ليس عودةً له */
const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const CONTRACTS = code('src/pages/admin/TrainerContracts.tsx')
const PREP = code('src/pages/admin/PreparationSteps.tsx')
const FEE = /function FeeStep\(\{[\s\S]*?\n\}\n/.exec(PREP)?.[0] ?? ''
/* جسمُ ما يُرسَل في التركيب والمعاينة — من `useMemo` إلى قائمة اعتماده */
const COMPOSE = /const composeBody = useMemo\(\(\) => \{[\s\S]*?\}, \[/.exec(CONTRACTS)?.[0] ?? ''
/* ونداءُ الإعادة وقبولِ التعديل */
const REISSUE = /await apiPost\(`\/api\/admin\/trainer-contracts\/\$\{r\.row\.id\}\/\$\{amend \? "amendment-reissue" : "resign-request"\}`, \{[\s\S]*?\}\);/.exec(CONTRACTS)?.[0] ?? ''

describe('① المركب لا يكتب أجرا', () => {
  it('⚠️ لا يرسل `compensation` — والخادم يطبع القاعدة السارية', () => {
    expect(COMPOSE, 'جسم التركيب مفقود').toContain('requiredDocuments: docs,')
    expect(COMPOSE, 'عاد المركب يرسل أجرا').not.toMatch(/\bcompensation\b/)
  })

  it('⚠️ ولا خانات أجر فيه — يقرأ القاعدة ويدل على «الاتفاقية»', () => {
    expect(CONTRACTS, 'عادت خانات الأجر').not.toMatch(/\bfee(Rate|MinSeats|ReferralRate)\b/)
    expect(CONTRACTS).toMatch(/هذه القاعدة السارية، ويأخذها العقد كما هي\. تضبط في\{" "\}\s*<Link to=\{agreementHref\(openFor\.id\)\}/)
    expect(CONTRACTS).toMatch(/لا قاعدة أتعاب لهذا المدرب\. اضبطها في\{" "\}\s*<Link to=\{agreementHref\(openFor\.id\)\}/)
  })
})

describe('② ونافذة الإعادة لا تكتب أجرا', () => {
  it('⚠️ ترسل `feeFromRule` وحده — وحين يختار أجر «الاتفاقية» وقد افترق', () => {
    expect(REISSUE, 'نداء الإعادة مفقود').toContain('subjectAr: subject, bodyAr: body,')
    expect(REISSUE).toContain('...(feeChanged ? { feeFromRule: true } : {}),')
    expect(REISSUE, 'عادت تكتب أجرا').not.toMatch(/\bcompensation\b/)
    expect(CONTRACTS).toContain('const feeChanged = feeDiffers && r.takeRuleFee;')
  })

  it('⚠️ وأجر «الاتفاقية» من التعبئة نفسها — ويقاس الافتراق بمقياس الخادم', () => {
    expect(CONTRACTS).toMatch(/ruleFee: p\.compensation && \{/)
    expect(CONTRACTS).toMatch(/const feeDiffers = ruleFee !== null && personalChangesAr\(/)
  })

  it('⚠️ وخياران بأثر كل منهما حين يفترقان — لا خانة ثالثة', () => {
    const choice = /\{feeDiffers \? \([\s\S]*?\) : \(/.exec(CONTRACTS)?.[0] ?? ''
    expect(choice, 'لا خيار').toContain('checked={r.takeRuleFee}')
    expect(choice).toContain('checked={!r.takeRuleFee}')
    expect(choice).toContain('أجر «الاتفاقية» الآن: <b>{feeLineAr(ruleFee)}</b>')
    expect(choice).toContain('أجر عقده كما هو: <b>{feeLineAr(rowFee)}</b> — ويحسب له أجر «الاتفاقية»')
    expect(choice, 'خانة أجر').not.toMatch(/inputMode="(decimal|numeric)"/)
  })
})

describe('③ وخطوة الأجر تقول كيف يحمله نص عقده', () => {
  const c = (status: string) => ({
    title: 'عقد', status, createdAt: '2026-10-20T10:00:00Z', compensationType: 'per_seat', compensationRate: '25', currency: 'JOD',
  })

  it('⚠️ بحاله — وكلها من «العقود»', () => {
    for (const status of ['draft', 'sent', 'signed', 'amendment_requested']) {
      expect(outContractOf([c(status)])?.howAr, status).toContain('«العقود»')
    }
    expect(outContractOf([c('draft')])?.howAr).toContain('ألغه')
    expect(outContractOf([c('sent')])?.howAr).toContain('وجهّز غيره، فيأخذ الجديد أجر «الاتفاقية»')
    expect(outContractOf([c('signed')])?.howAr).toContain('أعده للتوقيع')
    expect(outContractOf([c('amendment_requested')])?.howAr).toContain('اقبل طلب تعديله')
  })

  it('⚠️ والخطوة تقوله تحت الفرق — وبابها يفتح عقده لا يغيّره', () => {
    const note = /\{out && !scope && \(\s*<Inset[\s\S]*?<\/Inset>/.exec(FEE)?.[0] ?? ''
    expect(note).toContain('{out.howAr}')
    expect(FEE).toMatch(/<Button as=\{Link\} to=\{contractsHref\}[^>]*>\s*افتح عقده في «العقود»\s*<\/Button>/)
    expect(FEE, 'عاد يعد بتغييره مع العقد').not.toContain('غيّره مع العقد')
  })
})
