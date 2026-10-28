/* ═══ شاشتا النقل تطلبان سببه — للمعتمَد وحدَه (٢٨ أكتوبر ٢٠٢٦) ═══

   الخادمُ لا ينقل لقاءً معتمَدا بلا سبب يصل متعلّميه (`server/tests/learning/session-move-reasons.test.ts`)، وهنا
   ما تفعله الشاشتان به: خانةٌ للسبب حين يكون اللقاءُ معتمَدا، والزرُّ لا يُضغط قبل أن يُكتب، والسببُ يُرسَل مع
   الموعد. وما لم يُعتمَد لا خانةَ له ولا سببَ يُرسَل.

   والشاشتان تجلبان لقاءاتهما فلا تُرسَمان ساكنتين بما فيهما — فالفحصُ على بنيتهما بلا تعليقاتهما، كأختهما
   في `host-start-screen.test.ts`. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

describe('«انقل الموعد» في لقاءات الشعبة', () => {
  const code = read('src/pages/trainer/SessionsAndAttendance.tsx')
  const moveFn = code.slice(code.indexOf('const moveSession'), code.indexOf('const startAsHost'))

  it('⚠️ يُرسل السببَ مع الموعد — للمعتمَد وحدَه', () => {
    expect(moveFn.length, 'دالّة النقل غائبة').toBeGreaterThan(100)
    expect(moveFn).toMatch(/\.\.\.\(announced \? \{ reasonAr: moveForm\.reason\.trim\(\) \} : \{\}\)/)
    expect(code).toMatch(/onClick=\{\(\) => void moveSession\(s\.id, announcedOf\(s\)\)\}/)
  })

  it('⚠️ وخانتُه للمعتمَد — والزرُّ لا يُضغط قبل أن يُكتب', () => {
    expect(code).toMatch(/\{announcedOf\(s\) && \(\s*<div>\s*<label htmlFor=\{`mv-r-\$\{s\.id\}`\}/)
    expect(code).toMatch(/<textarea id=\{`mv-r-\$\{s\.id\}`\}[^>]*value=\{moveForm\.reason\}/)
    expect(code).toMatch(/\|\| \(announcedOf\(s\) && moveForm\.reason\.trim\(\)\.length < MOVE_WHY_MIN\)\}/)
  })
})

describe('«غيّر موعده» في موعد المحور', () => {
  const code = read('src/pages/trainer/SlotSessions.tsx')
  const saveFn = code.slice(code.indexOf('const saveMove'), code.indexOf('const relink'))

  it('⚠️ يُرسل السببَ مع الموعد — للمعتمَد وحدَه', () => {
    expect(saveFn.length, 'دالّة الحفظ غائبة').toBeGreaterThan(100)
    expect(saveFn).toMatch(/\.\.\.\(announcedOf\(s\) \? \{ reasonAr: move\.reason\.trim\(\) \} : \{\}\)/)
  })

  it('⚠️ وخانتُه للمعتمَد — والزرُّ لا يُضغط قبل أن يُكتب', () => {
    expect(code).toMatch(/const moveWhyMissing = announcedOf\(s\) && move\.reason\.trim\(\)\.length < MOVE_WHY_MIN/)
    expect(code).toMatch(/\{announcedOf\(s\) && \(\s*<StaffField label="لماذا تنقله؟"/)
    expect(code).toMatch(/disabled=\{busy \|\| !moveTimed \|\| moveWhyMissing\}/)
  })

  it('والمعتمَدُ ما لم يُكتب غيرُه — كما يقرؤه الخادم', () => {
    expect(code).toMatch(/const announcedOf = \(s: SlotSession\) => \(s\.approvalState \?\? "approved"\) === "approved"/)
  })
})
