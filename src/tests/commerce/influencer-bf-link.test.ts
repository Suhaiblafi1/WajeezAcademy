/* رابطُ المؤثّر في «بلاك فرايدي وجيز» يحمل كودَه قناةً (قرارُ صاحب المنصّة (١٧ نوفمبر ٢٠٢٦): Fix all 6).

   العلّة: كان رابطُه في حسابه وفي لوح الإدارة `/grant/bf/<كوده>`، والموقعُ يحوّل هذا المسارَ إلى `/grant/bf` بما بعد «؟»
   وحدَه — فيسقط الكود، ولا يُنسب إليه من جاء برابطه. والنسبةُ فيها بالقناة `?ch=` وحدَها (`grant-landing.service.ts#apply`).
   فرابطُه الآن `?ch=<كوده صغيرا>`، والرابطُ القديمُ المنشورُ يُحوَّل بكوده قناةً (`channelSearch`). */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { channelSearch, influencerLink } from '@/application/commerce/influencer'
import { BLACK_FRIDAY_GRANT_SLUG } from '@/application/commerce/grant'

const APP = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8')

describe('رابط المؤثر في بلاك فرايدي', () => {
  it('⚠️ يحمل كوده قناة لا مسارا يسقط', () => {
    expect(influencerLink('https://x.test', 'KASEET', BLACK_FRIDAY_GRANT_SLUG)).toBe('https://x.test/grant/bf?ch=kaseet')
    /* ورابطُه في منحة المؤثّرين كما كان */
    expect(influencerLink('https://x.test', 'SARA')).toBe('https://x.test/grant/i/SARA')
  })

  it('⚠️ والرابط القديم يحول بكوده قناة — وما بعد «؟» يبقى', () => {
    expect(channelSearch('', 'KASEET')).toBe('?ch=kaseet')
    expect(channelSearch('?w=1', 'kaseet')).toBe('?w=1&ch=kaseet')
    /* وقناةٌ في الرابط لا تُبدَّل، وما لا يشبه كودا لا يُكتب */
    expect(channelSearch('?ch=share', 'KASEET')).toBe('?ch=share')
    expect(channelSearch('?w=1', 'x y')).toBe('?w=1')
    expect(APP).toContain('<Route path="/grant/bf/:code" element={<KeepQueryAsChannel to="/grant/bf" />} />')
    expect(APP).toContain('<Route path="/grant/bf/:code/build" element={<KeepQueryAsChannel to="/grant/bf/build" />} />')
  })
})
