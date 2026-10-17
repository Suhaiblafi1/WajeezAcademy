/* كلُّ مدرّبٍ خانةٌ تنضمّ وتنسدل في «خطط تنتظر اعتمادك» (١٧ أكتوبر ٢٠٢٦).

   «اريد ان يكون لكل مدرب خانه يمكن ضمها وانسدالها للسهوله» (صاحب المنصّة). وهنا وجوهُه:

   ① رأسُ كلّ مدرّبٍ زرٌّ يقول حالَه، وخططُه تحته لا تُرسم وهي مطويّة — في المنتظِرة والمردودة معا.
   ② مطويّةٌ ابتداءً، إلّا مدرّبا وحيدا في قائمته فلا شيءَ يُختار بينه.
   ③ وبلوغُ خطّةٍ بعينها («ابدأ بأقدمها»، ورابطُ الشعبة، والرفع) يسدل خانةَ مدرّبها.

   والفحصُ على الشيفرة بلا تعليقاتها: حارسٌ طابق جملةً في تعليقٍ مرّ أخضرَ لسببٍ خاطئ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const page = readFileSync(join(process.cwd(), 'src/pages/admin/PendingPlans.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① رأسُ المدرّب زرٌّ، وخططُه تحته', () => {
  it('⚠️ الرأسُ زرٌّ يقول أمطويٌّ هو أم منسدل، ويسمّي ما يضمّه', () => {
    expect(page).toMatch(/<Inset as="button" type="button" interactive aria-expanded=\{shown\} aria-controls=\{controls\} onClick=\{onToggle\}/)
  })

  it('⚠️ في المنتظِرة: الخططُ والمراجعةُ داخل الخانة، لا تُرسم وهي مطويّة', () => {
    expect(page).toMatch(/<TrainerStrip heading="h2" name=\{g\.name\} shown=\{shown\} controls=\{`trainer-plans-\$\{gi\}`\}\s+onToggle=\{\(\) => toggleGroup\(g\.key, pendingAlone\)\}/)
    const fold = page.search(/\{shown && \(\s*<div id=\{`trainer-plans-\$\{gi\}`\}/)
    expect(fold, 'لا خانة تطوى').toBeGreaterThan(0)
    const rows = page.indexOf('{g.rows.map((r) => {')
    expect(rows, 'الخطط خارج الخانة').toBeGreaterThan(fold)
    expect(page.indexOf('<TrainerPlanReview')).toBeGreaterThan(rows)
  })

  it('⚠️ وفي المردودة كذلك — لكلّ مدرّب خانته', () => {
    expect(page).toMatch(/const returnedGroups = trainerGroups\(byTrainer\(returnedScoped\)\);/)
    expect(page).toMatch(/\{returnedGroups\.map\(\(g, gi\) => \{/)
    expect(page).toMatch(/<TrainerStrip heading="h3" name=\{g\.name\} shown=\{shown\} controls=\{`returned-plans-\$\{gi\}`\}\s+onToggle=\{\(\) => toggleGroup\(`ret:\$\{g\.key\}`, returnedAlone\)\}/)
    expect(page).toMatch(/\{shown && \(\s*<ul id=\{`returned-plans-\$\{gi\}`\}[^>]*>\s*\{g\.rows\.map\(\(r\) => \{/)
  })
})

describe('② مطويّةٌ ابتداءً إلّا الوحيد', () => {
  it('⚠️ ما لم ينقره أحدٌ يتبع «أهو وحيد في قائمته؟»', () => {
    expect(page).toMatch(/const \[groupOpen, setGroupOpen\] = useState<Record<string, boolean>>\(\{\}\);/)
    expect(page).toMatch(/const groupShown = \(key: string, alone: boolean\) => groupOpen\[key\] \?\? alone;/)
    expect(page).toMatch(/const toggleGroup = \(key: string, alone: boolean\) => setGroupOpen\(\(s\) => \(\{ \.\.\.s, \[key\]: !\(s\[key\] \?\? alone\) \}\)\);/)
    expect(page).toMatch(/const pendingAlone = new Set\(ordered\.map\(trainerKey\)\)\.size === 1;/)
    expect(page).toMatch(/const returnedAlone = returnedGroups\.length === 1;/)
  })
})

describe('③ بلوغُ خطّةٍ يسدل خانتها', () => {
  it('⚠️ `goTo` يفتح خانة مدرّبها مع الخطّة', () => {
    const goTo = page.slice(page.indexOf('const goTo = useCallback('), page.indexOf('}, []);', page.indexOf('const goTo = useCallback(')))
    expect(goTo).toMatch(/setOpen\(\(s\) => new Set\(s\)\.add\(id\)\);/)
    expect(goTo).toMatch(/setGroupOpen\(\(s\) => \(\{ \.\.\.s, \[trainerKey\(list\[at\]!\)\]: true \}\)\);/)
  })
})

it('⚠️ وما يقوله الرأسُ بلا تشكيل إعرابيّ — الشدّة وحدها تبقى', () => {
  const strips = [...page.matchAll(/<TrainerStrip[\s\S]*?(?:\/>|<\/TrainerStrip>)/g)].map((m) => m[0])
  expect(strips).toHaveLength(2)
  expect(strips.join(' ')).toMatch(/انتهت كلّها/)
  expect(strips.join(' ')).not.toMatch(/[ً-ِْ]/)
})
