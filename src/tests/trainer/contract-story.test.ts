/* العقدُ في «الاتفاقية» من ملفّ المدرّب: قصّتُه في سطر، وطلبُ التعديل وجوابُه تحته، ومُركِّبٌ واحد (٢٦ أكتوبر ٢٠٢٦).

   المرحلةُ الرابعةُ من مقترح لوحة الإدارة (3c): «قصّةُ العقد في سطرٍ واحد، وتحته طلبُ التعديل وجوابُه»، و«يذهب
   المُركِّبُ الثاني».

   ① القصّةُ ما وقع بتاريخه وبترتيب وقوعه — وما لم يقع لا يُذكر.
   ② وطلبُ التعديل: طلبُه هو وجوابُه، وطلبُ سلفه المسجَّل — فالبديلُ يقول لماذا وُلد.
   ③ والخطوةُ تقرؤهما، وتفتح النصَّ بمكوِّن «العقود» نفسِه، ولا تركّب: زرُّها مركِّبُ «العقود» لصاحبه.
   ④ وما تحت زرّ اعتماد التوقيع يقول ما يقع به — لا «لا يفتح حسابه» وهو يفتحه منذ ٢١ أكتوبر. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { amendmentLinesOf, contractStoryOf } from '@/application/trainer/contract-story'

/* بلا التعليقات: ذِكرُ ما كان في شرحٍ ليس عودةً له */
const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PREP = code('src/pages/admin/PreparationSteps.tsx')
const STEP = /function ContractStep\(\{[\s\S]*?\n\}\n/.exec(PREP)?.[0] ?? ''

describe('① القصة ما وقع بتاريخه', () => {
  it('⚠️ بترتيب وقوعه — والتعادل لترتيبه المعتاد (تركيب وإرسال بنقرة)', () => {
    const story = contractStoryOf({
      createdAt: '2026-10-12T09:00:00Z', sentAt: '2026-10-12T09:00:00Z', firstOpenedAt: '2026-10-13T08:00:00Z',
      amendmentRequestedAt: '2026-10-14T08:00:00Z', signedAt: '2026-10-23T08:00:00Z',
    })
    expect(story.map((e) => e.ar)).toEqual(['تجهيزه', 'إرساله', 'فتحه', 'طلب تعديله', 'توقيعه'])
  })

  it('⚠️ وما لم يقع لا يذكر — ولا تاريخ فارغ', () => {
    expect(contractStoryOf({ createdAt: '2026-10-12T09:00:00Z', sentAt: null, firstOpenedAt: undefined })
      .map((e) => e.key)).toEqual(['createdAt'])
    expect(contractStoryOf({})).toEqual([])
  })

  it('والنفاذ والإلغاء من أعمدتهما', () => {
    const keys = contractStoryOf({
      createdAt: '2026-10-01T00:00:00Z', signedAt: '2026-10-03T00:00:00Z',
      signatureApprovedAt: '2026-10-04T00:00:00Z', countersignedAt: '2026-10-20T00:00:00Z',
    }).map((e) => e.ar)
    expect(keys).toEqual(['تجهيزه', 'توقيعه', 'اعتماد توقيعه', 'توقيعنا'])
    expect(contractStoryOf({ createdAt: '2026-10-01T00:00:00Z', revokedAt: '2026-10-02T00:00:00Z' }).at(-1)?.ar).toBe('إلغاؤه')
  })
})

describe('② وطلب التعديل وجوابه', () => {
  const base = { id: 'c1', status: 'sent' }

  it('⚠️ طلبه المعلّق ينتظرنا', () => {
    const lines = amendmentLinesOf({ ...base, status: 'amendment_requested', amendmentRequestAr: 'البند 7' }, [])
    expect(lines).toEqual([expect.objectContaining({ previous: false, requestAr: 'البند 7', replyAr: null, pending: true })])
  })

  it('⚠️ وجوابه في مكانه — لا ينتظر', () => {
    const lines = amendmentLinesOf({ ...base, amendmentRequestAr: 'البند 7', amendmentReplyAr: 'يبقى كما هو' }, [])
    expect(lines).toEqual([expect.objectContaining({ previous: false, replyAr: 'يبقى كما هو', pending: false })])
  })

  it('⚠️ والبديل يقرأ طلب سلفه المسجل وجوابه', () => {
    const parent = { id: 'c0', status: 'revoked', amendmentRequestAr: 'موعد الدفع 15 يوما', amendmentReplyAr: 'قبلناه' }
    const lines = amendmentLinesOf({ ...base, replacesContractId: 'c0' }, [parent])
    expect(lines).toEqual([expect.objectContaining({ previous: true, requestAr: 'موعد الدفع 15 يوما', replyAr: 'قبلناه', pending: false })])
  })

  it('ولا تخمين: سلف غائب أو صف يشير إلى نفسه لا يقرأ', () => {
    expect(amendmentLinesOf({ ...base, replacesContractId: 'gone' }, [])).toEqual([])
    const self = { ...base, replacesContractId: 'c1', amendmentRequestAr: 'نفسه' }
    expect(amendmentLinesOf(self, [self]).map((l) => l.previous)).toEqual([false])
  })
})

describe('③ والخطوة تقرؤهما ولا تركب', () => {
  it('⚠️ السطر من القصة، والطلبات تحته', () => {
    expect(STEP, 'ContractStep مفقودة').toContain('const story = contractStoryOf(c);')
    expect(STEP).toContain('const amendments = amendmentLinesOf(c, contracts);')
    expect(STEP).toMatch(/\{story\.map\(\(e, i\) => \(/)
    expect(STEP).toMatch(/\{amendments\.map\(\(m\) => \(/)
  })

  it('⚠️ والنص بمسار «العقود» ومكوّنه — فلا تفترق الورقة', () => {
    expect(STEP).toContain('apiGet<{ bodyAr: string | null }>(`/api/admin/trainer-contracts/${c.id}/body`)')
    expect(STEP).toContain('<ContractDocument doc={parseContractDoc(shown.body)} />')
  })

  it('⚠️ ولا تركّب — زرها مركّب «العقود» لصاحبه', () => {
    expect(STEP, 'عاد المركّب الثاني').not.toContain('/contracts/compose`')
    expect(STEP).not.toContain('/contract-prefill`')
    expect(STEP).toMatch(/\{composeHref && \([\s\S]*?<Button\s+as=\{Link\} to=\{composeHref\}/)
  })
})

describe('④ وما تحت زر الاعتماد يقول ما يقع به', () => {
  it('⚠️ يفتح بوابته ويعبر به — لا «لا يفتح حسابه»', () => {
    expect(STEP).not.toContain('هذا لا يفتح حسابه')
    expect(STEP).toContain('اعتماده يفتح بوّابته ويعبر به إلى «المدربون». ونوقّع الاتفاقيّة حين نعتمد دوراته.')
    expect(STEP).toContain('اعتماده توقيع منّا عن الأكاديميّة، فينفذ العقد الآن.')
  })
})
