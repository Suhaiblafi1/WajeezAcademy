/* «اشترى عبر» في صفحات المنح: الرابطُ الذي اشترى منه يغلب زيارةً قديمة (`orderViaAr`، ٨ نوفمبر ٢٠٢٦) —
   كما تحسب العمولةُ (`commissionExcludedOrders`): رابطُ المستشار يغلب أثرَ حملة واتساب. */

import { describe, expect, it } from 'vitest'
import { orderViaAr } from '@/application/commerce/buy-link-campaign'

const WA = { utmSource: 'whatsapp', utmCampaign: 'wajeez-sales' }

describe('اشترى عبر', () => {
  it('⚠️ رابط المستشار يغلب زيارة حملة واتساب قديمة', () => {
    expect(orderViaAr({ touch: WA, buyLink: { kind: 'advisor' } })).toBe('رابط من المستشار')
  })
  it('⚠️ رابط الإدارة يغلب زيارة قديمة — إلا إن كان هو رابط حملة واتساب', () => {
    expect(orderViaAr({ touch: WA, buyLink: { kind: 'admin' } })).toBe('رابط من الإدارة')
    expect(orderViaAr({ buyLink: { kind: 'admin', whatsapp: true } })).toBe('حملة واتساب')
  })
  it('⚠️ بلا رابط: حملة واتساب من الزيارة، وما سواها لا يسمى', () => {
    expect(orderViaAr({ touch: WA })).toBe('حملة واتساب')
    expect(orderViaAr({ touch: { utmSource: 'facebook' } })).toBeNull()
    expect(orderViaAr(null)).toBeNull()
  })
})

describe('زيارة الحملة سبعة أيام (٨ نوفمبر ٢٠٢٦)', () => {
  const ordered = new Date('2026-11-20T12:00:00Z')
  const visit = (daysBefore: number) => ({ ...WA, at: new Date(ordered.getTime() - daysBefore * 86_400_000).toISOString() })
  it('⚠️ زيارة قبل ستة أيام تحسب، وقبل ثمانية لا', () => {
    expect(orderViaAr({ touch: visit(6) }, ordered)).toBe('حملة واتساب')
    expect(orderViaAr({ touch: visit(8) }, ordered)).toBeNull()
  })
  it('⚠️ زيارة بلا وقت يقرأ لا تحسب مع وقت الطلب', () => {
    expect(orderViaAr({ touch: WA }, ordered)).toBeNull()
  })
  it('⚠️ ورابط الإدارة الذي ولد رابط حملة يبقى حملة مهما مضى', () => {
    expect(orderViaAr({ touch: visit(30), buyLink: { kind: 'admin', whatsapp: true } }, ordered)).toBe('حملة واتساب')
  })
})
