#!/usr/bin/env tsx
/* مولّد طبقات بيانات التشخيص V2 — غلافٌ رقيق حول المولّد المشترك (ج-٢).
   المنطق كله في src/application/catalog/overlays/ كي يعمل في موضعين بالنتيجة
   نفسها: هذا السكربت (يكتب الملفات للتطوير المحلي) وباني اللقطة (يولّده من
   الصفوف المنشورة). فسؤالٌ يُضاف بعد النشر يصبح مرئيا للمحرك بلا نشر كود.

   شغّل: npm run build:v2-overlays */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildQuestionMeta } from '../src/application/catalog/overlays/question-meta'
import { buildSkillLayers } from '../src/application/catalog/overlays/skill-layers'
import { sourceFromCatalogFiles } from '../src/application/catalog/overlays/from-files'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'))

const src = sourceFromCatalogFiles({
  questions: read('src/data/catalog/questions.v1.ar.json'),
  skills: read('src/data/catalog/skills.v1.ar.json'),
  core: read('src/data/catalog/core-catalog.v2.json'),
  templates: read('src/data/catalog/composite-templates.v1.json'),
})

const questionMeta = buildQuestionMeta(src)
const layers = buildSkillLayers(src)

for (const slug of layers.activationNeeded) {
  console.warn(`⚠️  ACADEMIC ACTIVATION NEEDED: ${slug} محكومة لكنها اكتسبت قياسًا أو ربطًا — أزِل قيدها بسبب موثق أو فك الربط.`)
}

/* ---------- كتابة حتمية (أو تحقّق بـ--check) ----------
   الملفان يقولان «مولَّد — لا يُحرر يدويًا» ولم يكن هناك ما يفرضه. مع --check
   يفشل الأمر عند أي انحراف: تحريرٌ يدوي، أو تغيير في المولّد بلا إعادة توليد.
   الإصلاح واحد في الحالتين: `npm run build:v2-overlays` والتزم الناتج. */
const CHECK = process.argv.includes('--check')
const outDir = join(root, 'src/data/catalog/v2')
const sortObj = <T,>(o: Record<string, T>) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]))
const files: [string, unknown][] = [
  ['question-meta.v2.json', { version: '2.0.0', generated_by: 'scripts/build-v2-overlays.mjs', questions: sortObj(questionMeta) }],
  ['skill-layers.v2.json', { version: '2.0.0', generated_by: 'scripts/build-v2-overlays.mjs', skills: sortObj(layers.skills) }],
]
if (CHECK) {
  let drift = 0
  for (const [name, data] of files) {
    const expected = JSON.stringify(data, null, 2) + '\n'
    const actual = readFileSync(join(outDir, name), 'utf8')
    if (actual !== expected) {
      drift++
      console.error(`✗ ${name} يخالف المولّد — حُرّر يدويا أو تغيّر المولّد بلا إعادة توليد.`)
    }
  }
  if (drift > 0) {
    console.error('  الإصلاح: npm run build:v2-overlays ثم التزم الناتج في التغيير نفسه.')
    process.exit(1)
  }
  console.log('✅ تراكبات V2 مطابقة لمولّدها.')
} else {
  mkdirSync(outDir, { recursive: true })
  for (const [name, data] of files) writeFileSync(join(outDir, name), JSON.stringify(data, null, 2) + '\n')
}
const retired = Object.entries(questionMeta).filter(([, m]) => m.layer === 'retire_candidate')
console.log(`questions: ${src.questions.length} | retire_candidates: ${retired.length} | skills: ${src.skills.length + src.skillExtensions.length} | measured: ${layers.measured.length} | measured-uncovered: ${layers.measuredUncovered.join(', ')}`)
console.log('retire_candidates:', retired.map(([id]) => id).join(', '))
