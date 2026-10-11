/* ═══ الفحصُ بلا تشكيلٍ إعرابيّ — بعد «اللغة البيضاء» (١١ أكتوبر ٢٠٢٦) ═══

   نصوصُ الشاشات وطبقةُ التطبيق صارت بلا حركات (`src/application/text/plain-ar.ts`)، ونصوصُ الخادم
   وما في القاعدة قبل القرار بحركاتها. فالحارسُ يقارن الطرفين بلا تشكيلٍ إعرابيّ — ما يُفحص وما يُنتظر
   معا، نصّا أو تعبيرا نمطيّا أو مطابِقا غيرَ متماثل أو خطأً مرفوعا — فلا يحمرّ لحركةٍ ولا يخضرّ لمعنى. */

import type { expect as vitestExpect } from 'vitest'
import { plainAr } from '../../../src/application/text/plain-ar'

type Expect = typeof vitestExpect

const plainErr = (e: unknown): unknown => {
  if (e instanceof Error) e.message = plainAr(e.message)
  return e
}

export function plainDeep(v: unknown): unknown {
  if (typeof v === 'string') return plainAr(v)
  if (v instanceof RegExp) return new RegExp(plainAr(v.source), v.flags)
  if (Array.isArray(v)) return v.map(plainDeep)
  if (v instanceof Error) return plainErr(v)
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plainDeep(x)]))
  }
  return v
}

/** ما يُفحص: نصٌّ وما فيه بلا تشكيل؛ ووعدٌ يُرفض أو دالّةٌ ترمي — خطؤهما بلا تشكيل */
function plainActual(v: unknown): unknown {
  if (v instanceof Promise) return v.then(plainDeep, (e) => { throw plainErr(e) })
  if (typeof v === 'function') {
    const fn = v as (...a: unknown[]) => unknown
    return (...a: unknown[]) => {
      try {
        const r = fn(...a)
        return r instanceof Promise ? r.then((x) => x, (e) => { throw plainErr(e) }) : r
      } catch (e) { throw plainErr(e) }
    }
  }
  return plainDeep(v)
}

function wrap<T extends object>(target: T): T {
  return new Proxy(target, {
    get(t, k) {
      const x = Reflect.get(t, k) as unknown
      if (typeof x === 'function') return (...a: unknown[]) => wrapResult((x as (...b: unknown[]) => unknown).apply(t, a.map(plainDeep)))
      if (x && typeof x === 'object') return wrap(x)
      return x
    },
  })
}
const wrapResult = (r: unknown) => (r && typeof r === 'object' && !(r instanceof Promise) ? wrap(r) : r)

/** `expect` يقارن بلا تشكيلٍ إعرابيّ — والمطابِقاتُ غيرُ المتماثلة كذلك */
export function plainExpect(base: Expect): Expect {
  const fn = (v: unknown, m?: string) => wrap(base(plainActual(v), m) as object)
  return Object.assign(fn, base, {
    stringContaining: (s: string) => base.stringContaining(plainAr(s)),
    stringMatching: (s: string | RegExp) => base.stringMatching(plainDeep(s) as string | RegExp),
    objectContaining: (o: Record<string, unknown>) => base.objectContaining(plainDeep(o) as Record<string, unknown>),
    arrayContaining: (a: unknown[]) => base.arrayContaining(plainDeep(a) as unknown[]),
  }) as unknown as Expect
}
