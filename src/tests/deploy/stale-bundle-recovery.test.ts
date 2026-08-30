/* حارسٌ على شبكة أمانٍ لا تستطيع الحزمةُ حراسةَ نفسها فيها.

   العطب: نشرٌ جديد يُغيّر بصمة `index-<hash>.js` ويحذف القديم، وصفحةٌ
   مخزّنة في متصفّح الزائر تطلب المحذوف. الحزمة لا تُنفَّذ — فلا اختبارَ
   واجهةٍ يراها، ولا كودَ React ينقذها. الشاشة بيضاء صامتة.

   فالإنقاذ سطورٌ داخل `index.html`، وهذا الملفّ يقرؤها من الملفّ المشحون
   نفسه ويُشغّلها ببيئةٍ مصطنعة. قراءةُ الملفّ مقصودة: لو حُذف السكربت أو
   أُعيدت صياغتُه بما يكسره، سقط الاختبار — ولو كُتب الاختبار على نسخةٍ
   من الشيفرة لحرس نفسَه لا ما يُشحن. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

type Handler = (event: { target: unknown }) => void

/** يستخرج سكربت الحارس من index.html المشحون ويُشغّله ببيئةٍ مصطنعة */
function bootGuard(storage: { get: () => string | null; set: () => void; remove: () => void }) {
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  const source = blocks.find((b) => b.includes('wajeez_stale_reload'))
  expect(source, 'سكربت الحارس غير موجود في index.html').toBeTruthy()

  const handlers: Handler[] = []
  let reloads = 0
  const win = {
    addEventListener: (type: string, fn: Handler, capture?: boolean) => {
      expect(type).toBe('error')
      expect(capture, 'لا بدّ من طور الالتقاط — فشلُ المورد لا يصعد').toBe(true)
      handlers.push(fn)
    },
  } as Record<string, unknown>

  new Function('window', 'sessionStorage', 'location', source!)(
    win,
    { getItem: storage.get, setItem: storage.set, removeItem: storage.remove },
    { reload: () => { reloads += 1 } },
  )

  return {
    fail: (target: unknown) => handlers.forEach((h) => h({ target })),
    booted: () => (win.__wajeezBooted as (() => void) | undefined)?.(),
    reloads: () => reloads,
  }
}

/** تخزينٌ يعمل — الحالة الغالبة */
function workingStorage() {
  let value: string | null = null
  return {
    get: () => value,
    set: () => { value = '1' },
    remove: () => { value = null },
    peek: () => value,
  }
}

const bundleScript = { tagName: 'SCRIPT', src: 'https://x.test/assets/index-DHWQAcgR.js' }

describe('التعافي من حزمةٍ محذوفة بعد نشرٍ جديد', () => {
  it('١) فشلُ حزمةٍ من /assets يُعيد التحميل', () => {
    const g = bootGuard(workingStorage())
    g.fail(bundleScript)
    expect(g.reloads()).toBe(1)
  })

  it('٢) لا يُعيد التحميل مرّتين — التبويب لا يدور بلا نهاية', () => {
    const g = bootGuard(workingStorage())
    g.fail(bundleScript)
    g.fail(bundleScript)
    g.fail({ tagName: 'LINK', href: 'https://x.test/assets/index-BukcLkOK.css' })
    expect(g.reloads()).toBe(1)
  })

  it('٣) موردٌ خارج /assets لا يُعيد التحميل — خطّ الخطوط ليس عطبنا', () => {
    const g = bootGuard(workingStorage())
    g.fail({ tagName: 'LINK', href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic' })
    g.fail({ tagName: 'SCRIPT', src: 'https://analytics.test/tag.js' })
    expect(g.reloads()).toBe(0)
  })

  it('٤) خطأ شيفرةٍ عاديّ لا يُعيد التحميل', () => {
    const g = bootGuard(workingStorage())
    g.fail(null)
    g.fail({ tagName: 'DIV' })
    expect(g.reloads()).toBe(0)
  })

  it('٥) بلا تخزينٍ متاح لا يُعيد التحميل أبدا — الحلقة أسوأ من البياض', () => {
    const throwing = {
      get: () => { throw new Error('تصفّح خفيّ صارم') },
      set: () => { throw new Error('تصفّح خفيّ صارم') },
      remove: () => { throw new Error('تصفّح خفيّ صارم') },
    }
    const g = bootGuard(throwing)
    g.fail(bundleScript)
    expect(g.reloads()).toBe(0)
    expect(() => g.booted()).not.toThrow()
  })

  it('٦) إقلاع الحزمة يمسح العلامة — فلا تمنع تعافيا يحتاجه نشرٌ لاحق', () => {
    const store = workingStorage()
    const g = bootGuard(store)
    g.fail(bundleScript)
    expect(store.peek()).toBe('1')
    g.booted()
    expect(store.peek()).toBeNull()
  })

  /* «يذكر الاسم» لا يكفي: أوّل صياغةٍ لهذا الحارس فحصت وجود النصّ
     `__wajeezBooted` في الملفّ، وإعلانُ النوع فوقه يحمل الاسم نفسه — فنزعُ
     النداء أبقى الاختبار أخضر. المطلوب النداء لا الذكر. */
  it('٧) الحزمة تنادي __wajeezBooted فعلا — وإلّا بقيت العلامة أبدا', () => {
    const main = readFileSync(join(process.cwd(), 'src/main.tsx'), 'utf8')
    const call = /^\s*window\.__wajeezBooted\?\.\(\)\s*$/m
    expect(call.test(main), 'src/main.tsx لا ينادي window.__wajeezBooted?.()').toBe(true)
  })
})
