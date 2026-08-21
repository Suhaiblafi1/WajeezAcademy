/* إد-١ — الاتجاه لا يخترع معنى: القسمة على صفر ليست ١٠٠٪، ورقم اللحظة لا يُقارن. */

import { describe, expect, it } from 'vitest'
import {
  countWindows, flowTrend, stockTrend, trendBadgeAr, windowBounds, WINDOW_DAYS,
} from '../../application/metrics/trend'

const F = { one: 'طلب', two: 'طلبان', few: 'طلبات', many: 'طلبا' }
const NOW = Date.parse('2026-08-21T12:00:00.000Z')
const DAY = 86_400_000
const ago = (d: number) => new Date(NOW - d * DAY).toISOString()

describe('نافذتا المقارنة', () => {
  it('سبعة أيام وسبعة قبلها', () => {
    const b = windowBounds(NOW)
    expect(NOW - b.currentFrom).toBe(WINDOW_DAYS * DAY)
    expect(b.currentFrom - b.previousFrom).toBe(WINDOW_DAYS * DAY)
  })

  it('يوزع الصفوف على الفترتين ويهمل ما قبلهما', () => {
    const rows = [{ at: ago(1) }, { at: ago(6) }, { at: ago(8) }, { at: ago(13) }, { at: ago(30) }]
    expect(countWindows(rows, (r) => r.at, NOW)).toEqual({ current: 2, previous: 2 })
  })

  it('طابع فاسد أو غائب لا يُحسب حركة', () => {
    const rows = [{ at: ago(1) }, { at: 'ليس تاريخا' }, { at: null }, { at: undefined }]
    expect(countWindows(rows, (r) => r.at, NOW)).toEqual({ current: 1, previous: 0 })
  })

  it('طابع في المستقبل لا يُحسب — لم يقع بعد', () => {
    const rows = [{ at: new Date(NOW + 3 * DAY).toISOString() }, { at: ago(2) }]
    expect(countWindows(rows, (r) => r.at, NOW)).toEqual({ current: 1, previous: 0 })
  })

  it('يقبل Date كما يقبل النص', () => {
    const rows = [{ at: new Date(NOW - DAY) }, { at: new Date(NOW - 9 * DAY) }]
    expect(countWindows(rows, (r) => r.at, NOW)).toEqual({ current: 1, previous: 1 })
  })
})

describe('الاتجاه من حصيلتين', () => {
  it('صفر في الفترتين: سكون معلوم لا فراغ مجهول — بلا نسبة وبلا سهم', () => {
    const t = flowTrend(0, 0, F)
    expect(t.direction).toBe('quiet')
    expect(t.percent).toBeNull()
    expect(t.showArrow).toBe(false)
    expect(t.sentenceAr).toBe('لا حركة في الأسبوعين')
  })

  it('من صفر إلى عدد: لا نسبة — القسمة على صفر ليست ١٠٠٪ ولا ∞', () => {
    const t = flowTrend(3, 0, F)
    expect(t.direction).toBe('new')
    expect(t.percent).toBeNull()
    expect(t.sentenceAr).toBe('3 طلبات، مقابل لا شيء الأسبوع الماضي')
    expect(trendBadgeAr(t)).toBe('+3')
  })

  it('من عدد إلى صفر: توقف تام بنسبة −١٠٠٪ صادقة', () => {
    const t = flowTrend(0, 4, F)
    expect(t.direction).toBe('gone')
    expect(t.percent).toBe(-100)
    expect(t.sentenceAr).toBe('لا شيء، مقابل 4 طلبات الأسبوع الماضي')
  })

  it('العدد نفسه: ثبات صريح بلا سهم ولا شارة', () => {
    const t = flowTrend(5, 5, F)
    expect(t.direction).toBe('flat')
    expect(t.delta).toBe(0)
    expect(trendBadgeAr(t)).toBeNull()
  })

  it('ارتفاع وانخفاض بنسبة مدوّرة', () => {
    expect(flowTrend(7, 5, F).direction).toBe('up')
    expect(flowTrend(7, 5, F).percent).toBe(40)
    expect(trendBadgeAr(flowTrend(7, 5, F))).toBe('+40٪')
    expect(flowTrend(3, 5, F).direction).toBe('down')
    expect(flowTrend(3, 5, F).percent).toBe(-40)
    expect(trendBadgeAr(flowTrend(3, 5, F))).toBe('−40٪')
  })

  it('صيغة العدد عربية صحيحة في كل جملة', () => {
    expect(flowTrend(1, 0, F).sentenceAr).toBe('1 طلب، مقابل لا شيء الأسبوع الماضي')
    expect(flowTrend(2, 0, F).sentenceAr).toBe('2 طلبان، مقابل لا شيء الأسبوع الماضي')
    expect(flowTrend(11, 0, F).sentenceAr).toBe('11 طلبا، مقابل لا شيء الأسبوع الماضي')
    expect(flowTrend(5, 5, F).sentenceAr).toBe('5 طلبات — العدد نفسه كالأسبوع الماضي')
    expect(flowTrend(7, 5, F).sentenceAr).toBe('7 طلبات، مقابل 5 الأسبوع الماضي')
  })
})

describe('رقم اللحظة', () => {
  it('لا اتجاه ولا نسبة ولا سهم — والسبب معروض لا مخفي', () => {
    const t = stockTrend()
    expect(t.direction).toBe('none')
    expect(t.percent).toBeNull()
    expect(t.showArrow).toBe(false)
    expect(t.sentenceAr).toBe('رقمُ لحظة — لا سجل لعدده الأسبوع الماضي')
    expect(trendBadgeAr(t)).toBeNull()
  })
})
