#!/usr/bin/env node
/* فحصُ ملفّاتِ التأليف **قبل** تطبيقها — بالبوّابة نفسِها لا بنسخةٍ منها.
 *
 * البوّابةُ (`audit-authoring.ts`) تقرأ الكتالوجَ، فلا تُفحَص وحدةٌ إلّا بعد
 * `apply-authoring`. فكان المؤلّفُ يُسلّم على غير بيّنة، ويكتب كلُّ واحدٍ
 * سكربتَ تحقّقٍ في جذر المستودع ثمّ يتركه — وقع ذلك ثلاث مرّات.
 *
 * وهذا السكربتُ يبني من الملفّات الخمسة كائنَ الوحدة نفسَه ويُمرّره إلى
 * `auditModule` المُصدَّرة من البوّابة — فلا يفترق ما يفحصه المؤلّفُ عمّا
 * تفحصه البوّابة، ولا تُكتب قاعدةٌ مرّتين فتفترقا.
 *
 *   npx tsx scripts/check-authoring-files.ts C-CAR-101-M1
 *   npx tsx scripts/check-authoring-files.ts C-CAR-101       # كلُّ وحدات الدورة
 *   npx tsx scripts/check-authoring-files.ts                 # كلُّ ما في content/authoring
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { auditModule, type Module, type Course } from './audit-authoring'

const DIR = join(process.cwd(), 'content/authoring')
const CATALOG = join(process.cwd(), 'src/data/catalog/core-catalog.v2.json')
const LIBRARY = join(process.cwd(), 'src/data/library/wajeez-library.index.json')

const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '')

function main() {
  const filter = process.argv[2] ?? ''
  const raw = JSON.parse(readFileSync(CATALOG, 'utf8')) as { modules: Module[]; courses: Course[] }
  const meta = new Map(raw.modules.map((m) => [m.module_id, m]))
  const courseSkills = new Map<string, string[]>(raw.courses.map((c) => [c.course_id, c.skill_slugs ?? []]))
  const library = JSON.parse(read(LIBRARY) || '{"items":[]}')

  const ids = [...new Set(
    readdirSync(DIR)
      .filter((f) => f.endsWith('.body.md'))
      .map((f) => f.replace('.body.md', ''))
      .filter((id) => !filter || id.startsWith(filter)),
  )].sort()

  if (ids.length === 0) {
    console.error(`لا وحدةَ تطابق «${filter}» في content/authoring`)
    process.exit(1)
  }

  let bad = 0
  for (const id of ids) {
    const m = meta.get(id)
    if (!m) {
      console.log(`✗ ${id} — لا وحدةَ بهذا المعرّف في الكتالوج`)
      bad++
      continue
    }
    /* الوحدةُ كما ستصير بعد التطبيق — بلا تطبيق.

       والحقلُ الذي لا ملفَّ له **يبقى كما في الكتالوج** ولا يصير فارغا: هذا
       ما يفعله `apply-authoring` بالضبط — يكتب ما عنده ويترك الباقي. وثمانٍ
       وعشرون وحدةً فحوصُها وسيناريوهاتُها في الكتالوج وحدَه بلا ملفّ تأليف
       (استُوردت قبل أن يوجد هذا المسلك)، فجعلُ الغائب فارغا كان يقرؤها
       «بلا تمارين» وهي تحمل تمارينَها. */
    const over = (field: keyof Module, file: string) => {
      const t = read(join(DIR, file))
      return t.trim() ? { [field]: t } : {}
    }
    const built: Module = {
      ...m,
      ...over('module_body_ar', `${id}.body.md`),
      ...over('module_checks_ar', `${id}.checks.txt`),
      ...over('module_scenario_ar', `${id}.scenario.txt`),
      ...over('module_practice_ar', `${id}.practice.txt`),
      ...over('module_rubric_ar', `${id}.rubric.txt`),
    }
    const v = auditModule(built, courseSkills, library)
    if (v.length === 0) {
      console.log(`✅ ${id} — مطابقٌ للسياسة`)
    } else {
      bad++
      console.log(`✗ ${id} — ${v.length} مخالفة:`)
      for (const x of v) console.log(`    · [${x.rule}] ${x.detail}`)
    }
  }

  console.log('')
  if (bad === 0) console.log(`✅ ${ids.length} وحدةً مفحوصةً قبل التطبيق — لا مخالفة.\n`)
  else {
    console.log(`✗ ${bad} وحدةً من ${ids.length} فيها مخالفة — تُصلَح قبل apply-authoring.\n`)
    process.exit(1)
  }
}

main()
