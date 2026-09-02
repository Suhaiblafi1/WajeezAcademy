/* إدخالُ متونٍ مؤلَّفة إلى الكتالوج — من ملفّاتٍ على القرص لا بلصقٍ في JSON.

   المتنُ نصٌّ طويل فيه أسطرٌ وعلاماتُ اقتباسٍ وشرطاتٌ مائلة، ولصقُه يدا في
   ملفّ JSON بابُ أخطاءٍ صامتة: سطرٌ يُفلت، واقتباسٌ يكسر الملفّ، أو — أسوأُ
   — يُكتب في الوحدة الخطأ فيقرأ متعلّمٌ درسا ليس درسَه.

   فالمصدرُ ملفّاتٌ باسم الوحدة، والأداةُ تقرأ وتُدخل وتتحقّق:
     <moduleId>.body.md · <moduleId>.checks.txt · <moduleId>.scenario.txt
     <moduleId>.practice.txt · <moduleId>.rubric.txt

   **وتتحقّق بمحلّلات المنصّة نفسِها** — `validateChecks` و`validateScenario`
   و`validatePractice` و`validateRubric` — لا بفحصٍ مستقلٍّ أضعفَ منها. وهذا سدُّ ثقبٍ وقع فعلا: مرّ من هذا الباب
   ستّةَ عشرَ سيناريو فيها عقدةٌ بخيارٍ واحدٍ ومعها «تأمل:»، وأربعُ وحداتٍ
   بسبعة أسئلةٍ والحدُّ خمسة — كلُّها ترفضها شاشة `/admin/authoring` بـ٤٢٢،
   فدخلت الكتالوجَ من خلف الشاشة وصارت غيرَ قابلةٍ للتحرير فيها.
   فما لا يُحفظ في المحرّر لا يُكتب في الكتالوج.

   الاستعمال:
     npx tsx scripts/apply-authoring.ts <مجلّد>            معاينة
     npx tsx scripts/apply-authoring.ts <مجلّد> --apply    كتابة
*/

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateChecks } from '../src/application/content/module-checks'
import { validateScenario } from '../src/application/content/scenario'
import { validatePractice } from '../src/application/content/practice'
import { validateRubric } from '../src/application/content/rubric'

const CATALOG = join(process.cwd(), 'src/data/catalog/core-catalog.v2.json')

interface Module {
  module_id: string
  title_ar: string
  module_body_ar?: string | null
  module_checks_ar?: string | null
  module_scenario_ar?: string | null
  module_practice_ar?: string | null
  module_rubric_ar?: string | null
  [k: string]: unknown
}

function main() {
  const dir = process.argv[2]
  if (!dir) {
    console.error('الاستعمال: npx tsx scripts/apply-authoring.ts <مجلّد> [--apply]')
    process.exit(2)
  }
  const apply = process.argv.includes('--apply')

  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8')) as { modules: Module[] }
  const byId = new Map(catalog.modules.map((m) => [m.module_id, m]))

  const files = readdirSync(dir)
  const ids = [...new Set(files.map((f) => f.replace(/\.(body\.md|checks\.txt|scenario\.txt|practice\.txt|rubric\.txt)$/, '')))]
    .filter((id) => files.some((f) => f.startsWith(`${id}.`)))
    .sort()

  let changed = 0
  const missing: string[] = []
  const rejected: string[] = []

  for (const id of ids) {
    const m = byId.get(id)
    if (!m) { missing.push(id); continue }

    const read = (suffix: string) => {
      const f = join(dir, `${id}.${suffix}`)
      return files.includes(`${id}.${suffix}`) ? readFileSync(f, 'utf8').trim() : null
    }

    const body = read('body.md')
    const checks = read('checks.txt')
    const scenario = read('scenario.txt')
    const practice = read('practice.txt')
    const rubric = read('rubric.txt')

    /* محلّلاتُ المنصّة قبل الكتابة — لا بعدها */
    if (checks) {
      const r = validateChecks(checks)
      if (!r.ok) for (const e of r.errorsAr) rejected.push(`${id} · تمارين: ${e}`)
    }
    if (scenario) {
      const r = validateScenario(scenario)
      if (!r.ok) for (const e of r.errorsAr) rejected.push(`${id} · سيناريو: ${e}`)
    }
    if (practice) {
      const r = validatePractice(practice)
      if (!r.ok) for (const e of r.errorsAr) rejected.push(`${id} · نشاط: ${e}`)
    }
    if (rubric) {
      const r = validateRubric(rubric)
      if (!r.ok) for (const e of r.errorsAr) rejected.push(`${id} · روبرك: ${e}`)
    }

    const parts: string[] = []
    if (body) { m.module_body_ar = body; parts.push(`متن ${body.split(/\s+/).length} كلمة`) }
    if (checks) { m.module_checks_ar = checks; parts.push(`${checks.split(/\n\s*\n/).length} تمارين`) }
    if (scenario) { m.module_scenario_ar = scenario; parts.push('سيناريو') }
    if (practice) { m.module_practice_ar = practice; parts.push('نشاط') }
    if (rubric) { m.module_rubric_ar = rubric; parts.push('روبرك') }

    if (parts.length > 0) {
      changed++
      console.log(`  ${id} · ${m.title_ar} — ${parts.join(' · ')}`)
    }
  }

  if (rejected.length > 0) {
    console.error('\n✗ ما ترفضه محلّلات المنصّة — لا يُكتب في الكتالوج:')
    for (const r of rejected) console.error(`  ${r}`)
    console.error('  أصلح المصدرَ ثمّ أعِد — فما لا يُحفظ في المحرّر لا يدخل من خلفه.\n')
    process.exit(1)
  }

  if (missing.length > 0) {
    console.error(`\n✗ وحداتٌ لا وجودَ لها في الكتالوج: ${missing.join('، ')}`)
    console.error('  راجع المعرّف — كتابةُ متنٍ في وحدةٍ خطأ تُقرأ درسا ليس درسَه.\n')
    process.exit(1)
  }

  if (!apply) {
    console.log(`\n(معاينة) ${changed} وحدة ستُحدَّث. أضف --apply للكتابة.\n`)
    return
  }

  /* مسافتان كما هو الملفّ الأصل، وسطرٌ أخير — كي يبقى الفرقُ مقروءا */
  writeFileSync(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  console.log(`\n✅ كُتبت ${changed} وحدة في الكتالوج.\n`)
}

main()
