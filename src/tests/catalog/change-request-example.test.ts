/* «الاسم الجديد» مثالٌ يُرى ولا يُرسَل (`change-request-example.ts`، ٢٤ أكتوبر ٢٠٢٦). والخادمُ يردّه عند التقديم وعند
   الاعتماد — `server/tests/catalog/change-request-example.test.ts`. */

import { describe, expect, it } from 'vitest'
import { carriesExampleTitle, CHANGE_REQUEST_EXAMPLE, CHANGE_REQUEST_EXAMPLE_TITLE } from '../../application/catalog/change-request-example'

describe('مثال طلب التعديل', () => {
  it('⚠️ المثال المعروض في الخانة هو ما يرده الخادم', () => {
    expect(carriesExampleTitle(JSON.parse(CHANGE_REQUEST_EXAMPLE))).toBe(true)
  })
  it('ولو بمسافات حوله', () => {
    expect(carriesExampleTitle({ titleAr: `  ${CHANGE_REQUEST_EXAMPLE_TITLE} ` })).toBe(true)
  })
  it('واسم حقيقي يمر، وما لا اسم فيه', () => {
    expect(carriesExampleTitle({ titleAr: 'المحاسبة للمبتدئين' })).toBe(false)
    expect(carriesExampleTitle({ objectives: ['هدف'] })).toBe(false)
    expect(carriesExampleTitle(null)).toBe(false)
  })
})
