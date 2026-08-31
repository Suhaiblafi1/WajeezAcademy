/* حاجزُ القطع الزائلة — الالتقاط حيث يقع العطب فعلا.

   كتبتُ حارسا في `index.html` يسمع `error` و`vite:preloadError`
   و`unhandledrejection`، واختبرتُه بمستمعاتٍ مصطنعة فمرّ أخضر. ثمّ حجبتُ
   قطعةً حقيقيّةً في متصفّحٍ حقيقيّ — **فلم يُعِد التحميل ولا مرّة**: إخفاقُ
   `import()` داخل `React.lazy` يصير خطأَ تصييرٍ يمرّ بشجرة React، لا حدثَ
   موردٍ ولا رفضا غير ملتقَط. اختباري كان يفحص المستمع معزولا، والطريق
   الحقيقيّ مكسور — وهذا رابعُ حارسٍ يحرس نفسه في هذا العمل.

   فالحاجز يلتقطه في الشجرة. والقاعدتان محروستان هنا: ما يُعدّ «قطعةً
   زائلة»، والنافذة التي تمنع دوران التبويب. */

import { describe, expect, it } from 'vitest'
import { STALE_RELOAD_KEY, isStaleChunkError, mayReload } from '@/application/deploy/stale-chunk'

describe('تمييز خطأ القطعة الزائلة', () => {
  it('١) يتعرّف على صيغ المتصفّحات الثلاث', () => {
    for (const m of [
      'Failed to fetch dynamically imported module: /assets/Diagnostic-x.js',
      'Importing a module script failed.',
      'error loading dynamically imported module: /assets/Pathway-y.js',
    ]) {
      expect(isStaleChunkError(new Error(m)), m).toBe(true)
    }
  })

  it('٢) ولا يبتلع أخطاء التصيير العاديّة — وإلّا أُخفيت عطوبٌ حقيقيّة', () => {
    for (const m of [
      "Cannot read properties of undefined (reading 'map')",
      'Maximum update depth exceeded',
      'Objects are not valid as a React child',
    ]) {
      expect(isStaleChunkError(new Error(m)), m).toBe(false)
    }
    expect(isStaleChunkError(null)).toBe(false)
    expect(isStaleChunkError(undefined)).toBe(false)
  })
})

describe('نافذة إعادة التحميل', () => {
  const stub = () => {
    const box = new Map<string, string>()
    const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => box.get(k) ?? null,
        setItem: (k: string, v: string) => { box.set(k, v) },
        removeItem: (k: string) => { box.delete(k) },
      },
    })
    return () => {
      if (original) Object.defineProperty(globalThis, 'sessionStorage', original)
      else Reflect.deleteProperty(globalThis, 'sessionStorage')
    }
  }

  it('٣) تسمح بواحدة ثمّ تمنع داخل الدقيقة — التبويب لا يدور', () => {
    const restore = stub()
    try {
      const t = 5_000_000
      expect(mayReload(t)).toBe(true)
      expect(mayReload(t + 1_000)).toBe(false)
      expect(mayReload(t + 59_000)).toBe(false)
      expect(mayReload(t + 61_000)).toBe(true)
    } finally { restore() }
  })

  it('٤) وبلا تخزينٍ متاح لا تُعيد أبدا — الحلقة أسوأ من البياض', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() { throw new Error('تصفّح خفيّ صارم') },
    })
    try {
      expect(mayReload()).toBe(false)
    } finally {
      if (original) Object.defineProperty(globalThis, 'sessionStorage', original)
      else Reflect.deleteProperty(globalThis, 'sessionStorage')
    }
  })

  it('٥) وتشارك مفتاح حارس index.html — لا نافذتان لعطبٍ واحد', () => {
    const restore = stub()
    try {
      mayReload(6_000_000)
      expect(sessionStorage.getItem(STALE_RELOAD_KEY)).toBe('6000000')
    } finally { restore() }
  })
})

describe('الحاجز مركّبٌ فوق الشجرة', () => {
  it('٦) يلفّ المسارات المؤجَّلة في App', async () => {
    const { readFileSync } = await import('node:fs')
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8')
    expect(app).toContain('<StaleChunkBoundary')
    /* فوق Suspense لا تحته: تحته لا يرى إخفاق التحميل */
    expect(app.indexOf('<StaleChunkBoundary')).toBeLessThan(app.indexOf('<Suspense'))
  })
})
