/* الإقلاع البارد لا يُسقط اللقطة إلى المضمّن.
 *
 * الدالة السحابية تُقلع باردة بعد سكون. قياس على الإنتاج: 7.4 ثانية لأول طلب،
 * ثم 0.27–0.63 ثانية لما بعده. ومهلة واحدة قدرها 2.5 ثانية كانت تُلغي الطلب في
 * الحالة الباردة بالضبط، فيقع المحرك على الكتالوج المضمّن — وقد يكون أقدم من
 * المنشور — بصمت. وأول زائر بعد سكون هو من يقع فيها، وهو الأكثر في موقع بلا
 * حركة بعد.
 *
 * فالمحاولة الأولى تبقى قصيرة كي لا ينتظر أحد في الحالة الدافئة الشائعة،
 * والثانية تمنح البارد وقته. وما يُختبَر هنا هو الحدّان معا: أن البطيء يُدرَك،
 * وأن السريع لا يُبطَّأ، وأن الفشل الحقيقي ما زال يسقط إلى المضمّن بلا رمي.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const SNAP = {
  label: 'auto-abc1234-def567',
  payload: {
    questions: { questions: [{ question_id: 'Q1' }] },
    skills: { skills: [] },
    coreCatalog: { launch_pathways: [{ id: 'PW-1' }], courses: [{ course_id: 'C-1' }], modules: [] },
    templates: { templates: [] },
    optionEffects: {},
    pathwayProfiles: { profiles: {} },
  },
}

/** يستجيب بعد `delayMs`، ويحترم إلغاء AbortController كما يفعل fetch الحقيقي */
function slowFetch(delayMs: number, body: unknown = SNAP) {
  return vi.fn((_url: string, init?: { signal?: AbortSignal }) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => resolve({ ok: true, json: async () => body } as Response), delayMs)
      init?.signal?.addEventListener('abort', () => {
        clearTimeout(t)
        reject(new DOMException('aborted', 'AbortError'))
      })
    }),
  )
}

async function freshModule() {
  vi.resetModules()
  const installed: string[] = []
  vi.doMock('@/domain/diagnostic/catalog', () => ({
    installCatalogSnapshot: (_p: unknown, label: string) => { installed.push(label) },
  }))
  const mod = await import('@/services/catalog-snapshot')
  return { ensurePublishedSnapshot: mod.ensurePublishedSnapshot, installed }
}

beforeEach(() => { vi.useFakeTimers(); vi.unstubAllGlobals() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.doUnmock('@/domain/diagnostic/catalog') })

describe('جلب لقطة الكتالوج', () => {
  it('الدافئ يُثبَّت بلا انتظار زائد', async () => {
    const { ensurePublishedSnapshot, installed } = await freshModule()
    const f = slowFetch(300)
    vi.stubGlobal('fetch', f)

    const p = ensurePublishedSnapshot()
    await vi.advanceTimersByTimeAsync(400)
    expect(await p).toBe(SNAP.label)
    expect(installed).toEqual([SNAP.label])
    expect(f, 'استُدعي مرتين والأولى كانت كافية').toHaveBeenCalledTimes(1)
  })

  it('الإقلاع البارد (٧ ثوان) يُدرَك بمحاولة ثانية بدل السقوط إلى المضمّن', async () => {
    const { ensurePublishedSnapshot, installed } = await freshModule()
    /* الأولى تُلغى عند ٢.٥ ثانية، والثانية تبدأ من جديد وتنجح عند ٧ */
    const f = vi.fn()
      .mockImplementationOnce(slowFetch(7_000))
      .mockImplementationOnce(slowFetch(7_000))
    vi.stubGlobal('fetch', f)

    const p = ensurePublishedSnapshot()
    await vi.advanceTimersByTimeAsync(11_000)

    expect(await p, 'سقط إلى المضمّن رغم أن الخادم ردّ').toBe(SNAP.label)
    expect(installed).toEqual([SNAP.label])
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('البطيء فوق كل المهل يسقط إلى المضمّن بلا رمي', async () => {
    const { ensurePublishedSnapshot, installed } = await freshModule()
    vi.stubGlobal('fetch', slowFetch(60_000))

    const p = ensurePublishedSnapshot()
    await vi.advanceTimersByTimeAsync(15_000)

    expect(await p).toBe('bundled')
    expect(installed).toEqual([])
  })

  it('خادم يردّ بخطأ لا يُثبَّت شيء منه', async () => {
    const { ensurePublishedSnapshot, installed } = await freshModule()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 }) as Response))

    const p = ensurePublishedSnapshot()
    await vi.advanceTimersByTimeAsync(15_000)

    expect(await p).toBe('bundled')
    expect(installed).toEqual([])
  })

  it('الجلب مرة واحدة لكل جلسة مهما تعدّد المنادون', async () => {
    const { ensurePublishedSnapshot } = await freshModule()
    const f = slowFetch(200)
    vi.stubGlobal('fetch', f)

    const a = ensurePublishedSnapshot()
    const b = ensurePublishedSnapshot()
    await vi.advanceTimersByTimeAsync(300)
    expect(await a).toBe(await b)
    expect(f).toHaveBeenCalledTimes(1)
  })
})
