/* من الخطّة إلى الاختبار، ومن نتيجته إلى الخطّة — بالرابط وحدَه.

   قرارُ صاحب المنصّة: الاختبارُ اختياريٌّ من صفحة النتيجة، و«تُحدَّث التوصيةُ إن خالفها
   الاختبار» — بخيارٍ يختاره المتعلّم لا بتبديلٍ عنه. والتحديثُ بابُ «غيّر مستواي» نفسُه،
   فيُحرس هنا أنّ رابطَ التحديث يُقرأ طلبَ تعديلٍ صحيحا لسؤال مستوى الإنجليزيّة، بنصّ
   الخيار المقابل للمستوى المقيس — لا لمستوى بجانبه.

   ⚠ أُثبت سقوطُه: أُزيح فهرسُ الخيار بواحد (`o${i}`) فسقط الأوّل — ثمّ أُعيد فخضرّ. */

import { describe, expect, it } from 'vitest'
import { Q } from '../../domain/diagnostic/v2_1/maps'
import { ENGLISH_LEVELS } from '../../domain/diagnostic/v2_1/english'
import { levelLabelOf, parseReviseRequest } from '../../application/diagnostic/level-summary'
import { applyPlacementHref, placementHref, statedLevelOf } from '../../application/placement/links'

const query = (href: string) => new URLSearchParams(href.split('?')[1] ?? '')

describe('رابطُ تحديث الخطّة بمستوى الاختبار', () => {
  it('لكلّ مستوى: طلبُ تعديلٍ لسؤال الإنجليزيّة بنصّ خياره هو', () => {
    for (const l of ENGLISH_LEVELS) {
      const req = parseReviseRequest(query(applyPlacementHref(l.code)))
      expect(req?.questionId).toBe(Q.ENGLISH_LEVEL)
      expect(levelLabelOf(req!.questionId, req!.optionId), l.code).toBe(l.label_ar)
    }
  })
})

describe('رابطُ الاختبار يحمل المستوى الموصوف', () => {
  it('يُبنى ويُقرأ — وما ليس مستوى يُتجاهَل', () => {
    expect(statedLevelOf(query(placementHref('b1')))).toBe('b1')
    expect(statedLevelOf(query(placementHref(null)))).toBeNull()
    expect(statedLevelOf(new URLSearchParams('from=z9'))).toBeNull()
  })
})
