/* نسخُ القوالب المضمّنة تُشتقّ من الكتالوج — لا تُكتب باليد (٢٩ سبتمبر ٢٠٢٦).

   ── ما هي، ولمن ──

   كلُّ دورةٍ في قالبٍ مركّب (`composite-templates.v1.json`) تحمل مع معرّفها
   نسخا توثيقيّة: عنوانَها وساعاتِها واسمَ مسارها. ولا يقرؤها أحدٌ يعرضها
   لمتعلّم: المحرّكُ يأخذ العنوانَ والساعاتِ من الكتالوج المركزيّ — ويثبته
   `src/tests/diagnostic/single-source.test.ts` بإفسادها عمدا — واللقطةُ
   المنشورةُ تبني عناوينَ القوالب من القاعدة (`server/catalog/snapshot-builder.ts`).
   هي للمراجع البشريّ وحدَه: يرى «C-SAL-101» فلا يعرفها، ويرى عنوانَها فيعرف.

   ── وما وقع لها ──

   أُعيدت تسميةُ الدورات في الكتالوج أكثرَ من مرّة، ولم تُعَد النسخُ هنا. فحمل
   مئةٌ وثلاثةٌ وثمانون موضعا عنوانا زال، يقرؤه المراجعُ الذي كُتب له فيرى
   دورةً غيرَ الدورة: «استهداف السوق وبناء خط المبيعات» والدورةُ اليومَ «بناء
   ملفّ العميل المثاليّ». وكان `audit:diagnostic` يقول ذلك، لكنّه لم يكن في
   `verify` ولا في CI، فلم يسمعه أحد.

   ── فالنسخةُ تُشتقّ ولا تُحرَّر ──

   يعيد هذا السكربتُ كتابتَها من الكتالوج: العنوانَ والساعاتِ من الدورة، واسمَ
   المسار من مسار الموضع نفسِه. ولا يمسّ `pathway_id`: ذاك ليس نسخة — يقرؤه
   المحرّكُ (`universe.ts`) ليعرف المساراتِ التي يمثّلها القالب، فتغييرُه قرارٌ
   لا مزامنة، والتدقيقُ يقوله إن انحرف. ولا يضيف حقلا غائبا ولا يحذف حاضرا.

   بلا خيار: يكتب ما تغيّر. وبـ`--check`: يقارن ولا يكتب، ويسقط إن بقي ما
   يُكتب — وحارسُه في `verify` وCI هو `audit:diagnostic` نفسُه. */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATES = join(root, 'src/data/catalog/composite-templates.v1.json')
const CHECK = process.argv.includes('--check')

interface CoreCourse { course_id: string; title_ar: string; total_hours: number }
interface CorePathway { id: string; title: string }
const core = JSON.parse(readFileSync(join(root, 'src/data/catalog/core-catalog.v2.json'), 'utf8')) as {
  courses: CoreCourse[]
  launch_pathways: CorePathway[]
}
const courseById = new Map(core.courses.map((c) => [c.course_id, c]))
const pathwayTitleById = new Map(core.launch_pathways.map((p) => [p.id, p.title]))

type CourseRef = Record<string, unknown> & { course_id: string; pathway_id?: string }
const LISTS = ['required_courses', 'conditional_courses', 'bridge_courses', 'starter_courses'] as const
const templates = JSON.parse(readFileSync(TEMPLATES, 'utf8')) as {
  templates: ({ template_id: string } & Partial<Record<(typeof LISTS)[number], CourseRef[]>>)[]
}

let changed = 0
const unknown: string[] = []
for (const t of templates.templates) {
  for (const list of LISTS) {
    for (const ref of t[list] ?? []) {
      const course = courseById.get(ref.course_id)
      /* معرّفٌ لا دورةَ له ليس نسخةً تُصحَّح — التدقيقُ يسمّيه، ولا يُخمَّن هنا */
      if (!course) { unknown.push(`${t.template_id}: ${ref.course_id}`); continue }
      const copies: [string, unknown][] = [
        ['course_title_ar', course.title_ar],
        ['hours', course.total_hours],
        ['pathway_title_ar', ref.pathway_id ? pathwayTitleById.get(ref.pathway_id) : undefined],
      ]
      for (const [key, value] of copies) {
        if (ref[key] === undefined || value === undefined || ref[key] === value) continue
        ref[key] = value
        changed++
      }
    }
  }
}

if (unknown.length > 0) {
  console.error(`✗ قوالبُ تشير إلى دوراتٍ لا وجودَ لها — لا تُزامَن نسخُها:\n  ${unknown.join('\n  ')}`)
  process.exit(1)
}
if (changed === 0) {
  console.log('✓ نسخُ القوالب المضمّنة تطابق الكتالوج.')
  process.exit(0)
}
if (CHECK) {
  console.error(`✗ ${changed} نسخةً مضمّنةً في القوالب تخالف الكتالوج — شغّل: npm run catalog:sync-templates`)
  process.exit(1)
}
writeFileSync(TEMPLATES, JSON.stringify(templates, null, 2) + '\n')
console.log(`✍️  حُدّثت ${changed} نسخةً مضمّنةً في ${TEMPLATES.slice(root.length + 1)}.`)
