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
function bootGuard(
  storage: { get: () => string | null; set: (v: string) => void },
  now = () => Date.now(),
) {
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  const source = blocks.find((b) => b.includes('wajeez_stale_reload_at'))
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

  new Function('window', 'sessionStorage', 'location', 'Date', source!)(
    win,
    /* setItem(key, value) — تمرير الوسيط الأوّل كان يخزّن المفتاح مكان
       القيمة، فيعود parseInt بـNaN فلا تُغلق النافذة أبدا. أداةٌ معطوبة
       تُدين شيفرةً سليمة: أوّل قراءةٍ لهذا الإخفاق حُمّلت على الحارس. */
    { getItem: storage.get, setItem: (_k: string, v: string) => storage.set(v), removeItem: () => {} },
    { reload: () => { reloads += 1 } },
    { now },
  )

  return {
    fail: (target: unknown) => handlers.forEach((h) => h({ target })),
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

  it('٥) بلا تخزينٍ متاح لا يُعيد التحميل أبدا — الحلقة أسوأ من البياض', () => {
    const throwing = {
      get: (): string | null => { throw new Error('تصفّح خفيّ صارم') },
      set: () => { throw new Error('تصفّح خفيّ صارم') },
    }
    const g = bootGuard(throwing)
    g.fail(bundleScript)
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
})
