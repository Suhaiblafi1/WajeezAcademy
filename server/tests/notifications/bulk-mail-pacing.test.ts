/* مهلةُ البريد المشتركة في العامل — والعاجلُ أوّلا (٢٢ نوفمبر ٢٠٢٦). والعلّةُ في رأس `server/services/mail-pacer.ts`.

   ① **لا يخرج في الثانية أكثرُ من الحدّ** مهما طُلب — ولو طلبه العاجلُ والجماعيُّ معا.
   ② **والعاجلُ يسبق** ما ينتظر من الجماعيّ: رسالةُ كلمة سرٍّ لا تقف خلف حملة.
   ③ **والسرعةُ من البيئة** بين واحدٍ وتسع، وما سوى ذلك يعود إلى ثمان.

   بلا قاعدة: ساعةٌ مزيّفةٌ تُقاس بها الأدوار. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MAIL_SENDS_PER_SECOND, MailPacer, mailSendsPerSecond } from '../../services/mail-pacer'

beforeEach(() => { vi.useFakeTimers({ now: 0 }) })
afterEach(() => { vi.useRealTimers() })

/** يطلب الأدوارَ كلَّها ثمّ يمشي بالساعة حتّى تُعطى — ويردّ متى أُعطي كلٌّ وبأيّ ترتيب */
async function run(pacer: MailPacer, asks: ('urgent' | 'bulk')[], untilMs = 10_000) {
  const granted: { i: number; kind: string; at: number }[] = []
  asks.forEach((kind, i) => { void pacer.acquire(kind).then(() => { granted.push({ i, kind, at: Date.now() }) }) })
  await vi.advanceTimersByTimeAsync(untilMs)
  return granted
}

describe('مهلة البريد المشتركة', () => {
  it('⚠️ ① لا يخرج في أي ثانية أكثر من ثمان — ولو طلب ثلاثون معا', async () => {
    const pacer = new MailPacer(8)
    const asks = Array.from({ length: 30 }, (_, i) => (i % 5 === 0 ? 'urgent' : 'bulk') as 'urgent' | 'bulk')
    const granted = await run(pacer, asks)
    expect(granted, 'لم تعط الأدوار كلها').toHaveLength(30)
    const times = granted.map((g) => g.at).sort((a, b) => a - b)
    for (let k = 0; k + 8 < times.length; k += 1) {
      expect(times[k + 8] - times[k], `تسع رسائل في أقل من ثانية عند ${times[k]}`).toBeGreaterThanOrEqual(1000)
    }
    expect(times.at(-1), 'أبطأ من الحد بلا سبب').toBeLessThanOrEqual(29 * 125)
  })

  it('⚠️ ② والعاجل يسبق ما ينتظر من الجماعي', async () => {
    const pacer = new MailPacer(8)
    const granted = await run(pacer, ['bulk', 'bulk', 'bulk', 'bulk', 'urgent'])
    /* الأوّلُ يُعطى ساعةَ طُلب، والعاجلُ بعده مباشرةً قبل الجماعيّ الذي ينتظر */
    expect(granted.map((g) => g.kind)).toEqual(['bulk', 'urgent', 'bulk', 'bulk', 'bulk'])
    expect(granted[1].at, 'انتظر العاجل أكثر من دور واحد').toBe(125)
  })

  it('③ والسرعة من البيئة بين واحد وتسع', () => {
    expect(mailSendsPerSecond({})).toBe(DEFAULT_MAIL_SENDS_PER_SECOND)
    expect(mailSendsPerSecond({ MAIL_SENDS_PER_SECOND: '2' })).toBe(2)
    expect(mailSendsPerSecond({ MAIL_SENDS_PER_SECOND: '50' }), 'فوق حد Resend').toBe(9)
    expect(mailSendsPerSecond({ MAIL_SENDS_PER_SECOND: 'سريع' })).toBe(DEFAULT_MAIL_SENDS_PER_SECOND)
    expect(new MailPacer(8).intervalMs).toBe(125)
  })
})
