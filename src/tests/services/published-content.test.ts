/* الفراغ ليس جوابا.
 *
 * /api/public/core-catalog يقرأ جدولي Pathway وCourse مباشرة، لا اللقطة
 * المنشورة. فقاعدة إنتاج لم تُستورد بعد ترد 200 ومصفوفات فارغة — لا خطأ
 * يُمسك ولا حالة تُفحص. وكان الشرط `Array.isArray(...)` وحده، و`[]` مصفوفة،
 * فيُثبَّت الفراغ، ويُرفع `installed = true`، ويُتخطّى الاحتياطي المضمن
 * الموضوع لهذه الحالة بالذات. النتيجة على الموقع الحي: العناوين تظهر،
 * والعدّاد «الكل ٠»، وبلا بطاقة واحدة.
 *
 * تثبّت هذه الاختبارات الشرط الدائم: لا يُستبدل كتالوج قائم بأفرغ منه.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/* setup-catalog.ts يثبّت الكتالوج المضمن قبل كل ملف اختبار — فهو هنا
   يمثّل «ما يراه الزائر الآن»، والسؤال هو هل يمحوه ردٌّ فارغ. */

const EMPTY_REPLY = { source: 'api', launch_pathways: [], courses: [], modules: [] }

const FULL_REPLY = {
  source: 'api',
  launch_pathways: [
    { id: 'PW-TEST-001', title: 'مسار من الخادم', audience: '', after: '', capstone: '',
      duration_weeks: 8, weekly_hours: '4', level: 'مبتدئ', course_ids: ['C-TEST-001'] },
  ],
  courses: [
    { course_id: 'C-TEST-001', pathway_id: 'PW-TEST-001', sequence: 1,
      title_ar: 'دورة من الخادم', total_hours: 10, skill_names_ar: [] },
  ],
  modules: [],
}

function mockApi(coreCatalog: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const body = url.includes('/api/public/core-catalog') ? coreCatalog : { references: [] }
    return { ok: status === 200, json: async () => body } as unknown as Response
  }))
}

/* الوحدة تحفظ الجلب في `inflight` لمرة واحدة لكل جلسة، والمخزن حالة على
   مستوى الوحدة — فكل اختبار يبدأ من وحدات جديدة لا من بقايا سابقه. */
async function freshModules() {
  vi.resetModules()
  const source = await import('../../data/core-catalog-source')
  const bundled = (await import('../../data/catalog/core-catalog.v2.json')).default
  source.installCoreCatalogRaw(bundled as unknown as Parameters<typeof source.installCoreCatalogRaw>[0])
  const content = await import('../../services/public-content')
  return { source, content }
}

describe('جلب المحتوى العام: الفراغ ليس جوابا', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('ردٌّ فارغ من الخادم لا يمحو الكتالوج المعروض', async () => {
    const { source, content } = await freshModules()
    const before = source.getCoreCatalogRaw().launch_pathways.length
    expect(before).toBeGreaterThan(0) // مضاد للفراغ: الاختبار بلا معنى إن بدأ فارغا

    mockApi(EMPTY_REPLY)
    await content.ensurePublishedContent()

    expect(source.hasCoreCatalog()).toBe(true)
    expect(source.getCoreCatalogRaw().launch_pathways.length).toBe(before)
    expect(source.getCoreCatalogRaw().courses.length).toBeGreaterThan(0)
  })

  it('ردٌّ بمسارات وبلا دورات لا يُقبل كذلك', async () => {
    const { source, content } = await freshModules()
    const before = source.getCoreCatalogRaw().courses.length

    mockApi({ ...FULL_REPLY, courses: [] })
    await content.ensurePublishedContent()

    expect(source.getCoreCatalogRaw().courses.length).toBe(before)
    expect(source.getCoreCatalogRaw().launch_pathways.some((p) => p.id === 'PW-TEST-001')).toBe(false)
  })

  it('ردٌّ مكتمل يُثبَّت ويستبدل المضمن — الحارس لا يمنع الحالة السليمة', async () => {
    const { source, content } = await freshModules()

    mockApi(FULL_REPLY)
    await content.ensurePublishedContent()

    expect(source.getCoreCatalogRaw().launch_pathways).toHaveLength(1)
    expect(source.getCoreCatalogRaw().launch_pathways[0].id).toBe('PW-TEST-001')
  })

  it('تعذّر الجلب يُبقي الكتالوج قائما عبر الاحتياطي المضمن', async () => {
    const { source, content } = await freshModules()

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('شبكة') }))
    await content.ensurePublishedContent()

    expect(source.hasCoreCatalog()).toBe(true)
  })
})

/* الأثر الذي يراه الزائر: مختارات الصفحة الرئيسية تُبنى من قائمة معرفات
   تحريرية ثابتة، فإن خلا المصدر خلت الصفحة كلها — لا رسالة ولا بطاقة. */
describe('أثر الفراغ على الصفحة الرئيسية', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('مختارات وجيز تُحلّ كلها مقابل الكتالوج المضمن', async () => {
    vi.resetModules()
    const source = await import('../../data/core-catalog-source')
    const bundled = (await import('../../data/catalog/core-catalog.v2.json')).default
    source.installCoreCatalogRaw(bundled as unknown as Parameters<typeof source.installCoreCatalogRaw>[0])

    const { bestsellers, pathwayById } = await import('../../data/pathways')
    const unresolved = bestsellers.filter((b) => !pathwayById(b.id))
    expect(unresolved.map((b) => b.id)).toEqual([])
    expect(bestsellers.length).toBeGreaterThan(0)
  })
})
