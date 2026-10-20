/* نداءٌ يُعاد حين يخفق (٢٠ أكتوبر ٢٠٢٦) — `src/services/retry.ts`.

   والحارسُ على السلوك: ينجح بعد إخفاقين، ويسلّم الخطأ حين تنفد الفواصل، ويقف حين يُغلق صاحبُه.
   ورُئي ساقطا: جُعلت الدالّةُ تنادي مرّةً واحدة، فسقط الأوّل. */

import { describe, expect, it } from 'vitest'
import { withRetry } from '@/services/retry'

const flaky = (failures: number) => {
  let calls = 0
  const fn = async () => {
    calls += 1
    if (calls <= failures) throw new Error(`خطأ ${calls}`)
    return 'وصل'
  }
  return { fn, calls: () => calls }
}

describe('withRetry', () => {
  it('⚠️ ينجح بعد إخفاقين — ولا يُرى الإخفاق', async () => {
    const f = flaky(2)
    await expect(withRetry(f.fn, { delays: [0, 0, 0] })).resolves.toBe('وصل')
    expect(f.calls()).toBe(3)
  })

  it('ويسلّم آخر خطأ حين تنفد الفواصل', async () => {
    const f = flaky(5)
    await expect(withRetry(f.fn, { delays: [0, 0] })).rejects.toThrow('خطأ 3')
    expect(f.calls()).toBe(3)
  })

  it('ويقف حين يغلق صاحبه — فلا طلب بعد الإغلاق', async () => {
    const f = flaky(5)
    let alive = true
    const p = withRetry(async () => { const r = f.fn(); alive = false; return r }, { delays: [0, 0, 0], alive: () => alive })
    await expect(p).rejects.toThrow('خطأ 1')
    expect(f.calls()).toBe(1)
  })
})
