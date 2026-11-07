/* طلبا «ابنِ مسارك» يبدآن مع الصفحة، والصفحةُ تأخذهما ولا تطلبهما ثانية (`src/services/early-fetch.ts`، ٥ نوفمبر ٢٠٢٦). */

import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

/* الاختباراتُ في Node بلا نافذة — فتُعطى نافذةً فيها صندوقُ الطلبات وحدَه */
const withEarly = (box: Record<string, Promise<Response>>) => vi.stubGlobal('window', { __wajeezEarly: box })
afterEach(() => { vi.unstubAllGlobals() })

describe('الطلب المبكر', () => {
  it('⚠️ يؤخذ مرة واحدة ثم ينسى — وبلا طلب مبكر لا شيء', async () => {
    const { takeEarly } = await import('../../services/early-fetch')
    expect(takeEarly('/api/public/cohorts')).toBeNull()
    const p = Promise.resolve(new Response('[]'))
    withEarly({ '/api/public/cohorts': p })
    expect(takeEarly('/api/public/cohorts')).toBe(p)
    expect(takeEarly('/api/public/cohorts'), 'أعطي مرتين — والجسم لا يقرأ مرتين').toBeNull()
  })

  it('⚠️ الكتالوج الخفيف يؤخذ من الطلب المبكر ولا يطلب ثانية', async () => {
    vi.resetModules()
    const source = await import('../../data/core-catalog-source')
    source.installCoreCatalogRaw({ launch_pathways: [], courses: [], modules: [], library_resources: [] })
    const lite = {
      launch_pathways: [{ id: 'PW-E', title: 'م', audience: '', after: '', capstone: '', duration_weeks: 8, weekly_hours: '4', level: 'مبتدئ', course_ids: ['C-E'] }],
      courses: [{ course_id: 'C-E', pathway_id: 'PW-E', sequence: 1, title_ar: 'د', total_hours: 1, skill_names_ar: [] }],
      modules: [],
    }
    withEarly({ '/api/public/core-catalog?lite=1': Promise.resolve(new Response(JSON.stringify(lite))) })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const content = await import('../../services/public-content')
    await content.ensureLiteContent()
    expect(fetchSpy, 'طلب الكتالوج الخفيف مرة ثانية').not.toHaveBeenCalled()
    expect(source.hasCoreCatalog()).toBe(true)
  })

  it('⚠️ السكربت في index.html يبدأ الطلبين نفسيهما على /build وحدها', () => {
    const html = readFileSync('index.html', 'utf8')
    const script = html.match(/<script>\s*\/\*[^]*?__wajeezEarly[^]*?<\/script>/)?.[0] ?? ''
    expect(script).toContain('"/api/public/cohorts"')
    expect(script).toContain('"/api/public/core-catalog?lite=1"')
    expect(script).toMatch(/\^\\\/build\\\//)
  })
})
