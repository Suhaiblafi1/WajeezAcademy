/* الكتالوجُ بلا تشكيلٍ إعرابيّ — أسماءُ الدورات والمسارات ومحتواها (٢٠ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة (١١ أكتوبر ٢٠٢٦): ما يراه إنسانٌ بلا حركاتٍ ولا تنوينٍ ولا سكون — والشدّةُ وحدَها
   تبقى (`plain-ar.ts`). وكان الكتالوجُ أكبرَ ما بقي: ٢٣٦ ألفَ علامةٍ في أسماء الدورات ونتائجها ومتون
   وحداتها، تُعرض في صفحة الدورة والمسار و«رحلتي». فأُزيلت من مصادره (`importer.ts` يقرؤها)، ووُلّد ما
   يُولَّد منها (`build:v2-overlays` و`build:v2_1-overlays`)، وطلب صاحبُ المنصّة ذلك بنفسه.

   والفحصُ على قيم النصوص بعد قراءة الملفّ JSON — فالمفاتيحُ والمعرّفاتُ لا تدخل فيه. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CASE_MARKS } from '@/application/text/plain-ar'

const SOURCES = [
  'src/data/catalog/core-catalog.v2.json',
  'src/data/catalog/core-catalog.slim.v2.json',
  'src/data/catalog/composite-templates.v1.json',
  'src/data/catalog/questions.v1.ar.json',
  'src/data/catalog/skills.v1.ar.json',
  'src/data/catalog/v2/pathway-domains.v2.json',
]

function marked(o: unknown, path: string, out: string[]) {
  if (typeof o === 'string') {
    if (new RegExp(CASE_MARKS.source).test(o)) out.push(`${path}: ${o.slice(0, 50)}`)
  } else if (Array.isArray(o)) {
    o.forEach((v, i) => marked(v, `${path}[${i}]`, out))
  } else if (o && typeof o === 'object') {
    /* `doc_ar` ملحوظةُ المولّد للمطوّر («لا يُحرر يدويا») — لا يراها متعلّم، كالتعليق */
    for (const [k, v] of Object.entries(o)) if (k !== 'doc_ar') marked(v, `${path}.${k}`, out)
  }
}

describe('الكتالوجُ بلا تشكيلٍ إعرابيّ', () => {
  for (const f of SOURCES) {
    it(`⚠️ ${f}`, () => {
      const out: string[] = []
      marked(JSON.parse(readFileSync(join(process.cwd(), f), 'utf8')), '$', out)
      expect(out.slice(0, 5), `${out.length} نصّا مشكولا`).toEqual([])
    })
  }
})
