/* الكتالوجُ الخفيف لصفحة «ابنِ مسارك» — ولا يصل صفحةً تقرأ متونَ الدروس (`public-content.ts`، ٥ نوفمبر ٢٠٢٦).

   ① الخفيفةُ تُطلب بـ`?lite=1` وتُثبَّت لمن طلبها.
   ② وصفحةٌ تطلب الكاملةَ بعدها لا ترى الخفيفة: تُرفع فترى «جار التحميل»، ثمّ الكاملةُ بمتونها.
   ③ والخفيفةُ إن وصلت بعد طلب الكاملة لا تُثبَّت فوقها.
   ④ والكاملةُ المثبَّتةُ لا تُستبدل بالخفيفة. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const course = { course_id: 'C-LITE-001', pathway_id: 'PW-LITE-001', sequence: 1, title_ar: 'دورة', total_hours: 10, skill_names_ar: [] }
const path = { id: 'PW-LITE-001', title: 'مسار', audience: '', after: '', capstone: '', duration_weeks: 8, weekly_hours: '4', level: 'مبتدئ', course_ids: ['C-LITE-001'] }
const mod = { module_id: 'M-1', course_id: 'C-LITE-001', sequence: 1, title_ar: 'وحدة' }
const FULL = { source: 'api', launch_pathways: [path], courses: [course], modules: [{ ...mod, module_body_ar: 'متن الدرس' }] }
const LITE = { source: 'api', launch_pathways: [path], courses: [course], modules: [mod] }

/** ردودٌ مؤجَّلة يفرج عنها الاختبارُ بترتيبه هو — فيُختبر السباقُ لا حظُّ التوقيت */
function deferredApi() {
  const waiting = new Map<string, (v: unknown) => void>()
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    urls.push(url)
    const key = url.includes('lite=1') ? 'lite' : url.includes('core-catalog') ? 'full' : 'other'
    if (key === 'other') return Promise.resolve({ ok: true, json: async () => ({ references: [] }) } as unknown as Response)
    return new Promise((res) => waiting.set(key, (body) => res({ ok: true, json: async () => body } as unknown as Response)))
  }))
  const release = async (key: 'lite' | 'full', body: unknown) => {
    for (let i = 0; i < 50 && !waiting.has(key); i++) await new Promise((r) => setTimeout(r, 1))
    waiting.get(key)!(body)
    await new Promise((r) => setTimeout(r, 5))
  }
  return { urls, release }
}

async function fresh() {
  vi.resetModules()
  const source = await import('../../data/core-catalog-source')
  source.installCoreCatalogRaw({ launch_pathways: [], courses: [], modules: [], library_resources: [] })
  const content = await import('../../services/public-content')
  return { source, content }
}
const body = (source: Awaited<ReturnType<typeof fresh>>['source']) => source.getCoreCatalogRaw().modules[0]?.module_body_ar

describe('الكتالوج الخفيف لـ«ابن مسارك»', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('⚠️ ① تطلب ?lite=1 وتثبتها', async () => {
    const { source, content } = await fresh()
    const api = deferredApi()
    const p = content.ensureLiteContent()
    await api.release('lite', LITE)
    await p
    expect(api.urls.some((u) => u.includes('/api/public/core-catalog?lite=1'))).toBe(true)
    expect(api.urls.some((u) => /core-catalog$/.test(u))).toBe(false)
    expect(source.hasCoreCatalog()).toBe(true)
  })

  it('⚠️ ② صفحة الدروس بعدها لا ترى الخفيفة — ترى الفراغ ثم الكاملة بمتونها', async () => {
    const { source, content } = await fresh()
    const api = deferredApi()
    const lite = content.ensureLiteContent()
    await api.release('lite', LITE)
    await lite
    const full = content.ensurePublishedContent()
    expect(source.hasCoreCatalog(), 'رأت صفحة الدروس كتالوجا بلا متون').toBe(false)
    await api.release('full', FULL)
    await full
    expect(body(source)).toBe('متن الدرس')
  })

  it('⚠️ ③ الخفيفة الواصلة بعد طلب الكاملة لا تثبت', async () => {
    const { source, content } = await fresh()
    const api = deferredApi()
    const lite = content.ensureLiteContent()
    const full = content.ensurePublishedContent()
    await api.release('full', FULL)
    await full
    await api.release('lite', LITE)
    await lite
    expect(body(source)).toBe('متن الدرس')
  })

  it('⚠️ ④ الكاملة المثبتة لا تستبدل بالخفيفة', async () => {
    const { source, content } = await fresh()
    const api = deferredApi()
    const full = content.ensurePublishedContent()
    await api.release('full', FULL)
    await full
    await content.ensureLiteContent()
    expect(api.urls.some((u) => u.includes('lite=1'))).toBe(false)
    expect(body(source)).toBe('متن الدرس')
  })
})
