/* «المهامّ والمصادر» ثلاثةُ ألسنةٍ كلُّها إلزاميّة، والمرفقُ نوعُه أوّلا (٣٠ سبتمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «يجب أن يكون هناك ثلاثُ تابات: الأولى للمهامّ العمليّة،
   وتابٌ للمصادر، وتابٌ لمشروع التخرّج — للسهولة ولكي لا ينسى أيّا منها لأنّها
   كلُّها إجباريّة… وعند خانة المهامّ: عندما يختار ملفّا لا تظهر خانةُ رفع
   الملف. يجب بعد أن يختار ملفّا أو فيديو يظهر له ما يوازيه… وأعطِه هنا
   تعليماتٍ وتوصياتٍ لكلّ تاب».

   والفحصُ على البنية بعد نزع التعليقات. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const WS = code('src/pages/trainer/CohortWorkspace.tsx')
const stage = WS.slice(WS.indexOf('stage === "assignments" && (() => {'), WS.indexOf('stage === "approval" && ('))

describe('① ثلاثةُ ألسنة', () => {
  it('⚠️ المهامُّ العمليّةُ والمصادرُ ومشروعُ التخرّج — ولكلٍّ صفُّه في قائمة الخادم', () => {
    const tabs = WS.slice(WS.indexOf('const TASK_TABS'), WS.indexOf('function TaskTabGuide'))
    for (const [id, label, key] of [['tasks', 'المهامّ العمليّة', 'assignments'], ['resources', 'المصادر', 'resources'], ['project', 'مشروع التخرّج', 'project']]) {
      expect(tabs, `لا لسانَ «${label}»`).toMatch(new RegExp(`${id}: \\{\\s*label: "${label}",\\s*key: "${key}"`))
    }
    expect(stage).toMatch(/<TabBar[\s\S]*?items=\{\(Object\.keys\(TASK_TABS\) as TaskTab\[\]\)\.map/)
  })

  it('⚠️ واللسانُ يقول حالَ صفّه — فالناقصُ يُرى قبل فتحه', () => {
    expect(stage).toMatch(/tabDone\(TASK_TABS\[t\]\.key\)/)
    expect(stage).toContain('aria-label="لم يتمّ بعد"')
  })

  it('⚠️ ولكلّ لسانٍ تعليماتُه وتوصياتُه — تحته', () => {
    expect(stage).toContain('<TaskTabGuide tab={taskTab} />')
    const tabs = WS.slice(WS.indexOf('const TASK_TABS'), WS.indexOf('function TaskTabGuide'))
    expect((tabs.match(/tips: \[/g) ?? []).length).toBe(3)
  })

  it('⚠️ والمشروعُ في لسانه وحدَه — لا يُختار نوعا في لسان المهامّ', () => {
    expect(stage).toMatch(/const shownTasks = ws\.assessments\.filter\(\(a\) => \(a\.type === "project"\) === isProject\)/)
    expect(stage).toMatch(/Object\.entries\(ASSESSMENT_TYPES\)\.filter\(\(\[k\]\) => k !== "project"\)/)
  })
})

describe('② المرفقُ: النوعُ أوّلا، ثمّ ما يوازيه', () => {
  const rows = stage.slice(stage.indexOf('{taskAttachments.map((att, i) => {'), stage.indexOf('+ مرفق'))

  it('⚠️ «ملفّ» يُظهر الرفعَ — وما سواه يُظهر الرابطَ بتلميح نوعه', () => {
    expect(rows).toMatch(/\{isFile \? \(\s*<ModuleBodyUpload/)
    expect(rows).toMatch(/: \(\s*<StaffField label=\{ATTACHMENT_LINK_HINT\[kind\]\.label\} hint=\{ATTACHMENT_LINK_HINT\[kind\]\.hint\}>/)
    /* والنوعُ قبل الاسم والمصدر في الصفّ */
    expect(rows.indexOf('aria-label={`نوع المرفق')).toBeLessThan(rows.indexOf('aria-label={`اسم المرفق'))
  })

  it('⚠️ ولا يجتمع رابطٌ وملفّ — تبديلُ النوع يمحو الآخر', () => {
    expect(rows).toMatch(/k === "file"\s*\? \{ kind: k, url: "" \}\s*: \{ kind: k, bodyFileKey: null, bodyFileName: null, bodyFileMime: null \}/)
  })

  it('⚠️ والمرفوعُ يُرسَل مفتاحا لا رابطا — والخادمُ يقبل واحدا منهما', () => {
    expect(WS).toMatch(/\? \{ title: r\.title\.trim\(\), kind: "file", bodyFileKey:/)
    const routes = code('server/http/routes/learning-portal.routes.ts')
    expect(routes).toMatch(/const TASK_ATTACHMENTS = [\s\S]*?\.refine\(/)
  })
})
