/* ما المسار، ولمن — سطرُ «مسارات كاملة» و«لك إن كنت» على البطاقات (صاحب المنصّة، ١٤ نوفمبر ٢٠٢٦).

   قال: «قل له: لأنّنا نهتمّ بالنتائج فقد جمعنا حزمةً من الدورات لكلّ هدفٍ بحسب الفئة المستهدفة.. وألغِ جملةَ ليس لك.. بل يجب أن
   تكون لك إن كنت»، ووافق على النصّين («نعم نفذ»). والمحروس:
   ١) السطرُ يقول عددا صادقا — كلُّ مسارٍ منشورٍ بعدد دورات السطر، وإلّا كذب السطرُ على صفحةٍ يراها كلُّ زائر.
   ٢) والسطرُ يلي عنوانَ «مسارات كاملة» في الرئيسة مباشرة.
   ٣) والبطاقتان (الرئيسة والكتالوج) تقولان لمن المسار (`audience`) لا لمن ليس (`notFor`).
   والفحصُ على الشيفرة بلا تعاليقها: الكلمةُ في تعليقٍ لا تُخضرّ حارسا. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PATH_COURSES, PATH_FOR_YOU_AR, PATHS_INTRO_AR } from '@/application/catalog/path-intro'
import { publicPathways } from '@/data/public-pathways'
import { plainAr } from '@/application/text/plain-ar'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ')

describe('سطر «مسارات كاملة» — لأننا نهتم بالنتائج', () => {
  it('⚠️ العدد في السطر صادق — كل مسار منشور بعدد دوراته', () => {
    expect(publicPathways.length, 'لا مسارات منشورة').toBeGreaterThan(0)
    const off = publicPathways.filter((p) => p.courseIds.length !== PATH_COURSES).map((p) => `${p.id}: ${p.courseIds.length}`)
    expect(off, `السطر يقول ${PATH_COURSES} دورات وهذه بغيرها`).toEqual([])
    expect(PATHS_INTRO_AR).toContain(`${PATH_COURSES} دورات`)
    expect(PATHS_INTRO_AR).toMatch(/^لأننا نهتم بالنتائج/)
    for (const t of [PATHS_INTRO_AR, PATH_FOR_YOU_AR]) expect(t).toBe(plainAr(t))
  })

  it('⚠️ ويلي عنوان «مسارات كاملة» في الرئيسة مباشرة', () => {
    const best = code('src/pages/home/Bestsellers.tsx')
    expect(best).toMatch(/<h3 className="[^"]*">مسارات كاملة<\/h3>\s*<p className="[^"]*">\{PATHS_INTRO_AR\}<\/p>/)
  })
})

describe('«لك إن كنت» لا «ليس لك إن» — على بطاقتي المسار', () => {
  for (const [file, field] of [['src/pages/home/Bestsellers.tsx', 'b\\.item'], ['src/pages/Catalog.tsx', 'p']] as const) {
    it(`⚠️ ${file}`, () => {
      const src = code(file)
      expect(src, 'لا يقول لمن المسار').toMatch(new RegExp(`\\{PATH_FOR_YOU_AR\\} </span>\\s*\\{resolveCatalogRefsAr\\(${field}\\.audience,`))
      expect(src, 'عاد «ليس لك إن»').not.toMatch(new RegExp(`${field}\\.notFor`))
      expect(src, 'عاد «ليس لك إن» نصا').not.toContain('ليس لك إن')
    })
  }

  it('وكل مسار منشور له جمهور يقرأ بعد «لك إن كنت»', () => {
    for (const p of publicPathways) expect(p.audience?.trim(), `${p.id} بلا جمهور`).toBeTruthy()
  })
})
