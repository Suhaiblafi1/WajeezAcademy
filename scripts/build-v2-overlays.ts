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
/* موجة ٦ · ج — قاموس مهارات نحيف للحزمة المضمنة.
   القياس: الحزمة المضمنة تشحن القاموس كاملا (٢٨٨ كيلو) والمحرك يقرأ منه أربعة
   حقول (٢٣ كيلو) + الأطر المرجعية. والفرق يهبط على صفحة التشخيص — باب المنصة
   — في كل زيارة، ثم يُرمى لأن اللقطة المنشورة تحلّ محلّه.

   والقاموس الكامل يبقى مصدر الحقيقة: المستورد والخادم يقرآنه كما هو. النحيف
   نسخة مولَّدة للواجهة وحدها، ويحرسها --check فلا تتقادم عن أصلها. */
/* family_ar لازم للواجهة: قياس العائلات يسأل المتعلم باسمها العربي،
   وبدونه يظهر رمز (COM) بدل «التواصل واللغة والتأثير». */
const SLIM_SKILL_KEYS = ['skill_id', 'slug', 'name_ar', 'family_id', 'family_ar', 'source_frameworks', 'active', 'merged_into', 'merge_date'] as const
const skillsFile = read('src/data/catalog/skills.v1.ar.json') as { version?: string; skills: Record<string, unknown>[] }
const slimSkills = {
  version: skillsFile.version,
  doc_ar: 'قاموس مهارات نحيف — مولَّد من skills.v1.ar.json للحزمة المضمنة. لا يُحرر يدويا.',
  generated_by: 'scripts/build-v2-overlays.ts',
  skills: skillsFile.skills.map((s) => {
    const out: Record<string, unknown> = {}
    for (const k of SLIM_SKILL_KEYS) if (s[k] !== undefined) out[k] = s[k]
    return out
  }),
}

const files: [string, unknown][] = [
  ['question-meta.v2.json', { version: '2.0.0', generated_by: 'scripts/build-v2-overlays.mjs', questions: sortObj(questionMeta) }],
  ['skill-layers.v2.json', { version: '2.0.0', generated_by: 'scripts/build-v2-overlays.mjs', skills: sortObj(layers.skills) }],
]
/* النحيف يعيش مع مصدره لا في مجلد v2 */
const SLIM_PATH = join(root, 'src/data/catalog/skills.slim.v1.json')
const slimText = JSON.stringify(slimSkills, null, 2) + '\n'
if (CHECK) {
  let drift = 0
  if (readFileSync(SLIM_PATH, 'utf8') !== slimText) {
    drift++
    console.error('✗ skills.slim.v1.json يخالف مصدره — أُضيفت مهارة أو تغيّر حقل بلا إعادة توليد.')
  }
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
  writeFileSync(SLIM_PATH, slimText)
}
const retired = Object.entries(questionMeta).filter(([, m]) => m.layer === 'retire_candidate')
console.log(`questions: ${src.questions.length} | retire_candidates: ${retired.length} | skills: ${src.skills.length + src.skillExtensions.length} | measured: ${layers.measured.length} | measured-uncovered: ${layers.measuredUncovered.join(', ')}`)
console.log('retire_candidates:', retired.map(([id]) => id).join(', '))
