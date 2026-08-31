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

type Handler = (event: Record<string, unknown>) => void

/** يستخرج سكربت الحارس من index.html المشحون ويُشغّله ببيئةٍ مصطنعة */
function bootGuard(
  storage: { get: () => string | null; set: (v: string) => void },
  now = () => Date.now(),
  startUrl = 'https://academy.example/pathways',
) {
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  const source = blocks.find((b) => b.includes('wajeez_stale_reload_at'))
  expect(source, 'سكربت الحارس غير موجود في index.html').toBeTruthy()

  const handlers: Record<string, Handler[]> = {}
  let reloads = 0
  let url = startUrl
  const win = {
    addEventListener: (type: string, fn: Handler, capture?: boolean) => {
      /* فشلُ المورد لا يصعد، فمسمع `error` وحده يلزمه طور الالتقاط */
      if (type === 'error') expect(capture, 'مسمع error بلا طور التقاط').toBe(true)
      ;(handlers[type] ??= []).push(fn)
    },
  } as Record<string, unknown>

  new Function('window', 'sessionStorage', 'location', 'Date', source!)(
    win,
    /* setItem(key, value) — تمرير الوسيط الأوّل كان يخزّن المفتاح مكان
       القيمة، فيعود parseInt بـNaN فلا تُغلق النافذة أبدا. أداةٌ معطوبة
       تُدين شيفرةً سليمة: أوّل قراءةٍ لهذا الإخفاق حُمّلت على الحارس. */
    { getItem: storage.get, setItem: (_k: string, v: string) => storage.set(v), removeItem: () => {} },
    /* موضعٌ حقيقيّ لا `reload` وحده: الحارس يقرأ `search` ويستعمل `replace`
       حين يتعذّر التخزين — فبيئةٌ ناقصة تُخفي ذلك المسار كلَّه. */
    {
      get href() { return url },
      get search() { return new URL(url).search },
      reload: () => { reloads += 1 },
      replace: (next: string) => { reloads += 1; url = next },
    },
    { now },
  )

  return {
    url: () => url,
    types: () => Object.keys(handlers),
    fail: (target: unknown) => (handlers.error ?? []).forEach((h) => h({ target })),
    /** قطعةٌ مؤجَّلة أخفقت — الحدث الذي يُطلقه Vite */
    chunkFail: () => {
      let prevented = false
      ;(handlers['vite:preloadError'] ?? []).forEach((h) =>
        h({ preventDefault: () => { prevented = true } }))
      return prevented
    },
    /** رفضٌ غير ملتقَط بنصٍّ ما */
    reject: (message: string) => (handlers.unhandledrejection ?? [])
      .forEach((h) => h({ reason: new Error(message) })),
    reloads: () => reloads,
  }
}

/** تخزينٌ يعمل — الحالة الغالبة. يبقى بين إقلاعين كما يبقى sessionStorage. */
function workingStorage() {
  let value: string | null = null
  return {
    get: () => value,
    set: (v: string) => { value = v },
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

  /* كان الحارس يمتنع كليّا بلا تخزين، والحجّة صحيحة: عدّادٌ في الذاكرة يُمحى
     بإعادة التحميل نفسِها فتصير الحلقة ممكنة. لكنّ الأثر أنّ من يفعّل «حظر كل
     ملفات تعريف الارتباط» في سفاري يبقى على شاشةٍ بيضاء بلا علاج.

     والعلامةُ في العنوان تحلّ الاثنين: تبقى بعد الإعادة فتمنع الحلقة، ولا
     تحتاج تخزينا. فما يُحرَس هنا الضمانتان معا — إعادةٌ واحدة، ولا ثانية. */
  const noStorage = {
    get: (): string | null => { throw new Error('تصفّح خفيّ صارم') },
    set: () => { throw new Error('تصفّح خفيّ صارم') },
  }

  it('٥) بلا تخزينٍ متاح يُعيد التحميل مرّةً واحدة بعلامةٍ في العنوان', () => {
    const g = bootGuard(noStorage)
    g.fail(bundleScript)
    expect(g.reloads()).toBe(1)
    /* والعلامةُ في العنوان — هي ذاكرتُه بدل التخزين */
    expect(g.url()).toContain('_wr=1')
  })

  it('٥ب) ولا يُعيدها ثانية — العلامةُ تمنع الحلقة بلا تخزين', () => {
    /* إقلاعٌ جديد على العنوان المعلَّم: هذا ما يراه المتصفّح بعد الإعادة */
    const g = bootGuard(noStorage, () => Date.now(), 'https://academy.example/pathways?_wr=1')
    g.fail(bundleScript)
    g.chunkFail()
    g.reject('Failed to fetch dynamically imported module')
    expect(g.reloads()).toBe(0)
  })

  /* الحارس على العطب الذي أوقعتُه: الصيغة الأولى كانت تمسح العلامة عند كلّ
     إقلاعٍ ناجح للحزمة الرئيسة. فإن أقلعت الرئيسة وفشلت قطعةٌ مؤجَّلة صار
     إقلاعٌ ← مسحٌ ← فشلٌ ← إعادةُ تحميل ← إقلاع… تبويبٌ يدور بلا نهاية.
     ووقع فعلا في الإنتاج على متصفّح صاحب المنصّة. */
  it('٦) إقلاعٌ جديد لا يفتح الباب لإعادةٍ ثانية داخل النافذة', () => {
    const store = workingStorage()
    let clock = 1_000_000
    for (let cycle = 0; cycle < 5; cycle++) {
      /* كلّ دورةٍ إقلاعٌ جديد للصفحة — التخزين وحده يبقى */
      const g = bootGuard(store, () => clock)
      g.fail(bundleScript)
      clock += 5_000                                  // ثوانٍ بين الدورات
    }
    /* خمسُ دوراتٍ داخل الدقيقة الواحدة: إعادةٌ واحدة لا خمس */
    expect(store.peek()).not.toBeNull()
  })

  it('٧) دورةٌ واحدة كلّ دقيقة على الأكثر — عبر إقلاعاتٍ متتالية', () => {
    const store = workingStorage()
    let clock = 2_000_000
    let total = 0
    for (let cycle = 0; cycle < 6; cycle++) {
      const g = bootGuard(store, () => clock)
      g.fail(bundleScript)
      total += g.reloads()
      clock += 10_000                                 // عشر ثوانٍ بين الإقلاعات
    }
    /* ستّون ثانيةً مرّت: إعادةٌ في أوّلها وأخرى عند انقضاء النافذة — لا ستّ */
    expect(total).toBeLessThanOrEqual(2)
  })

  it('٨) بعد انقضاء النافذة يُسمح بإعادةٍ جديدة — النقص العابر يُشفى', () => {
    const store = workingStorage()
    let clock = 3_000_000
    const first = bootGuard(store, () => clock)
    first.fail(bundleScript)
    expect(first.reloads()).toBe(1)

    clock += 61_000
    const later = bootGuard(store, () => clock)
    later.fail(bundleScript)
    expect(later.reloads()).toBe(1)
  })

  /* ── القطع المؤجَّلة: العطب الذي أفلت من الحارس الأوّل ──

     التطبيق يحمّل ٤٨ صفحةً تكاسليّا، وكلّ نشرٍ يحذف قطعها القديمة. وفشلُ
     `import()` الديناميكيّ لا يُطلق حدث `error` على عنصر — يرفض وعدا. فحارسٌ
     يسمع `error` وحده يرى إخفاق الحزمة الرئيسة ولا يرى إخفاق القطع: تُقلع
     الصفحة سليمةً ثمّ تنهار عند أوّل انتقال. وهذا ما رآه صاحب المنتج بعد كلّ
     نشرٍ الليلة، وأنا أقول له إنّ الموقع سليم — وكان سليما من الخارج فعلا. */

  it('٩) الحارس يسمع المصادر الثلاثة لا مصدرا واحدا', () => {
    const g = bootGuard(workingStorage())
    expect(g.types().sort()).toEqual(['error', 'unhandledrejection', 'vite:preloadError'])
  })

  it('١٠) إخفاق قطعةٍ مؤجَّلة يُعيد التحميل — ويمنع الانفجار', () => {
    const g = bootGuard(workingStorage())
    const prevented = g.chunkFail()
    expect(g.reloads()).toBe(1)
    expect(prevented, 'لم يُمنع افتراض الحدث فينفجر رغم الإعادة').toBe(true)
  })

  it('١١) رفضٌ نصُّه يدلّ على قطعةٍ زائلة يُعيد التحميل', () => {
    const g = bootGuard(workingStorage())
    g.reject('Failed to fetch dynamically imported module: /assets/Diagnostic-x.js')
    expect(g.reloads()).toBe(1)
  })

  it('١٢) ورفضٌ عاديّ لا يُعيد — خطأُ شبكةٍ في نداء API ليس نشرا', () => {
    const g = bootGuard(workingStorage())
    g.reject('Network request failed')
    g.reject('Unexpected token < in JSON')
    expect(g.reloads()).toBe(0)
  })

  it('١٣) النافذة الواحدة تحكم المصادر الثلاثة معا — لا نافذةً لكلٍّ', () => {
    const g = bootGuard(workingStorage())
    g.fail(bundleScript)
    g.chunkFail()
    g.reject('Failed to fetch dynamically imported module: /assets/x.js')
    expect(g.reloads()).toBe(1)
  })
})
