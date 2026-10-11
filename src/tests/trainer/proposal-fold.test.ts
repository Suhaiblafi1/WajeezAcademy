/* اقتراحاتُ المدرّب في ملفّه — المفتوحُ بطاقاتٌ، والمبتوتُ سطرٌ يُفتح (٢٩ سبتمبر ٢٠٢٦).

   سأل صاحبُ المنصّة عن ملفٍّ طُبّقت عليه قراراتُه كلُّها: «لماذا ما زال هناك
   مقترح؟» — وكان المعروضُ اقتراحا مربوطا ببطاقةٍ وأزرارٍ كأنّه ينتظر. فالحارسُ
   هنا على القسمة نفسِها: ما بُتّ فيه لا يُعرض بين ما ينتظر، وما ينتظر لا يُطوى. */

import { describe, expect, it } from 'vitest'
import { DECIDED_PROPOSAL_STATUSES, foldProposals } from '../../application/trainer/proposal-fold'
import { DECIDED_PROPOSAL, OPEN_PROPOSAL } from '../../../server/services/course-proposal.service'

const p = (id: string, status: string) => ({ id, status })

describe('اقتراحات المدرّب في ملفّه', () => {
  it('مدرّبة ربط اقتراح لها وصار الآخر دورة — لا شيء ينتظر، والسطر يقول ما جرى', () => {
    const { open, decided, decidedSummaryAr } = foldProposals([p('a', 'linked'), p('b', 'became_course')])
    expect(open, 'مبتوت فيه يعرض بين ما ينتظر').toEqual([])
    expect(decided.map((x) => x.id)).toEqual(['a', 'b'])
    expect(decidedSummaryAr).toBe('ربطت برمز قائم: 1 · صارت دورة: 1')
  })

  it('كلّ حال مفتوحة في الخادم تبقى بطاقة، وكلّ مبتوتة تطوى — والقائمتان لا تفترقان', () => {
    for (const s of OPEN_PROPOSAL) {
      expect(foldProposals([p('x', s)]).open, `مفتوح طوي: ${s}`).toHaveLength(1)
    }
    for (const s of DECIDED_PROPOSAL) {
      expect(foldProposals([p('x', s)]).decided, `مبتوت لم يطو: ${s}`).toHaveLength(1)
    }
    expect([...DECIDED_PROPOSAL_STATUSES].sort()).toEqual([...DECIDED_PROPOSAL].sort())
  })

  it('وما لا يعرف حاله لا يطوى — يبقى بطاقة ترى', () => {
    const { open, decided } = foldProposals([p('x', 'status_not_yet_invented')])
    expect(open).toHaveLength(1)
    expect(decided).toHaveLength(0)
  })

  it('السطر المطويّ بترتيب ثابت، ولا يذكر ما عدده صفر', () => {
    const r = foldProposals([p('a', 'rejected'), p('b', 'linked'), p('c', 'linked'), p('d', 'submitted')])
    expect(r.decidedSummaryAr).toBe('ربطت برمز قائم: 2 · ردّت: 1')
    expect(r.open.map((x) => x.id)).toEqual(['d'])
  })
})
