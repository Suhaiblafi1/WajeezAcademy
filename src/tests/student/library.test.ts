/* المكتبة (١د) — عقد المصدر والصفحة.
   الاختبار على المحوّل لا على التصيير: ما يقرّره هنا هو الترتيب وقاعدة
   إخفاء التبويب، وهما ما يكسر الصفحة إن انحرف. */

import { describe, expect, it, afterEach } from 'vitest'
import bundled from '../../data/catalog/core-catalog.v2.json'
import {
  getLibraryResources,
  installCoreCatalogRaw,
  type CoreCatalogRaw,
} from '../../data/core-catalog-source'

const BUNDLED = bundled as unknown as CoreCatalogRaw

afterEach(() => {
  installCoreCatalogRaw(BUNDLED)
})

describe('موارد المكتبة', () => {
  it('تبدأ فارغة ما لم يُنشر مورد — فلا يظهر تبويب على فراغ', () => {
    installCoreCatalogRaw({ ...BUNDLED, library_resources: [] })
    expect(getLibraryResources()).toEqual([])
  })

  it('كتالوج بلا حقل مكتبة أصلا لا يكسر القراءة', () => {
    const rest = { ...BUNDLED }
    delete rest.library_resources
    installCoreCatalogRaw(rest)
    expect(getLibraryResources()).toEqual([])
  })

  it('ترتيب النشر أولا ثم المعرّف — لا ترتيب عشوائي يتبدّل بين تحميلين', () => {
    installCoreCatalogRaw({
      ...BUNDLED,
      library_resources: [
        { id: 'lib-c', kind: 'article', title_ar: 'ج', url: 'https://example.com/c', sort_order: 2 },
        { id: 'lib-b', kind: 'video', title_ar: 'ب', url: 'https://example.com/b', sort_order: 1 },
        { id: 'lib-a', kind: 'video', title_ar: 'أ', url: 'https://example.com/a', sort_order: 1 },
      ],
    })
    expect(getLibraryResources().map((r) => r.id)).toEqual(['lib-a', 'lib-b', 'lib-c'])
  })

  it('مورد بلا sort_order يُعامل صفرا فيتقدّم لا يختفي', () => {
    installCoreCatalogRaw({
      ...BUNDLED,
      library_resources: [
        { id: 'lib-z', kind: 'pdf', title_ar: 'ز', url: 'https://example.com/z', sort_order: 5 },
        { id: 'lib-y', kind: 'text', title_ar: 'ي', url: 'https://example.com/y' },
      ],
    })
    expect(getLibraryResources().map((r) => r.id)).toEqual(['lib-y', 'lib-z'])
  })
})
