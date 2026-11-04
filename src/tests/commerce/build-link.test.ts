/* رابطُ الشراء الجاهز — قراءتُه وبناؤه (`src/application/commerce/build-link.ts`، ٤ نوفمبر ٢٠٢٦).
   ما في الرابط يُنظَّف شكلا ولا يُصدَّق — والتصديقُ في الخادم (`server/tests/commerce/buy-link-preview.test.ts`). */

import { describe, expect, it } from 'vitest'
import { buildLinkPath, parseBuildLink } from '@/application/commerce/build-link'
import { MAX_BUILT_COURSES } from '@/application/commerce/discount-policy'
import { parsePendingCheckout } from '@/application/commerce/pending-checkout'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

describe('قراءة الرابط', () => {
  it('⚠️ الرابط القديم بلا add ولا code يبقى كما هو', () => {
    expect(parseBuildLink(`?cohort=${A}`, 'C-MGR-101')).toEqual({ adds: [], dropped: 0, code: null })
    expect(parseBuildLink('', 'C-MGR-101')).toEqual({ adds: [], dropped: 0, code: null })
  })

  it('⚠️ دورات بشعبها ودونها، والكود بحروف كبيرة', () => {
    const l = parseBuildLink(`?cohort=${A}&add=C-PSY-109:${B},C-AI-101&code=wg-abcd2345`, 'C-MGR-101')
    expect(l.adds).toEqual([{ courseId: 'C-PSY-109', cohortId: B }, { courseId: 'C-AI-101', cohortId: null }])
    expect(l.code).toBe('WG-ABCD2345')
  })

  it('⚠️ المكرر يعد مرة — والدورة الأولى لا تضاف ثانية', () => {
    const l = parseBuildLink(`?add=C-AI-101,C-AI-101:${B},C-MGR-101`, 'C-MGR-101')
    expect(l.adds).toEqual([{ courseId: 'C-AI-101', cohortId: B }])
  })

  it('⚠️ المشوه يسقط ويعد، وما زاد على حد المسار يسقط ويعد', () => {
    expect(parseBuildLink('?add=../x,C-A:not-uuid:extra', 'C-1').dropped).toBe(2)
    const many = Array.from({ length: 8 }, (_, i) => `C-X-${i}`).join(',')
    const l = parseBuildLink(`?add=${many}`, 'C-1')
    expect(l.adds).toHaveLength(MAX_BUILT_COURSES - 1)
    expect(l.dropped).toBe(8 - (MAX_BUILT_COURSES - 1))
  })

  it('⚠️ شعبة بغير شكلها تترك فتختار الصفحة أقرب شعبة', () => {
    expect(parseBuildLink('?add=C-AI-101:123', 'C-1').adds).toEqual([{ courseId: 'C-AI-101', cohortId: null }])
  })

  it('⚠️ كود بحروف غريبة لا يكتب في الخانة', () => {
    expect(parseBuildLink('?code=<script>', 'C-1').code).toBeNull()
  })
})

describe('بناء الرابط', () => {
  it('⚠️ يقرأ ما بناه — ومعه تتبع حملة واتساب', () => {
    const href = buildLinkPath({
      courseId: 'C-MGR-101', cohortId: A,
      adds: [{ courseId: 'C-PSY-109', cohortId: B }, { courseId: 'C-AI-101', cohortId: null }],
      code: 'wg-abcd2345', tracking: { utm_source: 'whatsapp', utm_campaign: 'wajeez-sales' },
    })
    expect(href).toBe(`/build/C-MGR-101?cohort=${A}&add=C-PSY-109:${B},C-AI-101&code=WG-ABCD2345&utm_source=whatsapp&utm_campaign=wajeez-sales`)
    const back = parseBuildLink(href.slice(href.indexOf('?')), 'C-MGR-101')
    expect(back.adds.map((a) => a.courseId)).toEqual(['C-PSY-109', 'C-AI-101'])
    expect(back.code).toBe('WG-ABCD2345')
  })
})

describe('الكود يعود بعد التسجيل', () => {
  it('⚠️ الشراء المحفوظ يحمل الكود — والمشوه لا يقرأ', () => {
    const now = Date.now()
    const base = { path: '/build/C-MGR-101', intent: { title: 't', amount: 1, kind: 'courses', courseIds: ['C-MGR-101'] }, cohortByCourse: {}, at: now }
    expect(parsePendingCheckout(JSON.stringify({ ...base, couponCode: 'WG-ABCD2345' }), now)?.couponCode).toBe('WG-ABCD2345')
    expect(parsePendingCheckout(JSON.stringify({ ...base, couponCode: 'x y' }), now)?.couponCode).toBeUndefined()
  })
})
