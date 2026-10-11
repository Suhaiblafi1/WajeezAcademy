/* ملاحظاتُ الردّ بنودٌ في «المراجعة» (١١ أكتوبر ٢٠٢٦) — القاعدةُ والشاشة.

   قرارُ صاحب المنصّة: «دعها في قسم التعديلات بشكلٍ واضح — كأنّك تقول له قمنا بتعديل كذا وكذا، على
   شكل نقاط (ما لم يُذكر في التعديلات أدناه) — ليوافق عليها أيضا، بشكل أُطرٍ منظّمةٍ مرتّبة».

   ① الملاحظةُ نقاطٌ سطرا سطرا، و«مطلوب»/«مقترَح» في أوّل السطر وسمٌ — وهي صيغةُ بطاقة المعايير.
   ② بندٌ لكلّ خطوةٍ عليها ملاحظة، العامّةُ أوّلا — ولا بندَ لسطر «واقترحنا على خطّتك…» الآليّ.
   ③ وفي «المراجعة» قبل التعديلات: إطارٌ مرقّمٌ بنقاطه، و«موافق» و«لا أوافق»، وزرٌّ إلى خطوتها.
   ④ ولا تُعدّ «تعديلاتٍ جاهزة»، والقيدُ في القاعدة يتّسع لنوعها.

   والقراءةُ البنيويّةُ على الشيفرة بلا تعليقاتها. وجولتُها على قاعدةٍ حقيقيّة في
   `server/tests/plan/note-items.test.ts`. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isEditsLineAr, noteItemsFrom, notePoints, PLAN_EDIT_KINDS, planEditView, suggestedEditsLineAr,
} from '@/application/trainer/plan-edits'
import { scorecardNotes } from '@/application/trainer/plan-scorecard'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① نقاطُ الملاحظة', () => {
  it('⚠️ سطرٌ لكلّ نقطة — بلا علامة تعداد، و«مطلوب»/«مقترَح» وسمٌ', () => {
    expect(notePoints('مطلوب — المصدر: لا مصدر\n\n- مقترَح — المخرَج أوضح\n• انقل اللقاء\n2) سطرٌ مرقّم')).toEqual([
      { textAr: 'المصدر: لا مصدر', tagAr: 'مطلوب' },
      { textAr: 'المخرَج أوضح', tagAr: 'مقترَح' },
      { textAr: 'انقل اللقاء', tagAr: null },
      { textAr: 'سطرٌ مرقّم', tagAr: null },
    ])
  })

  it('⚠️ وصيغةُ بطاقة المعايير (`scorecardNotes`) تُقرأ بوسومها', () => {
    const notes = scorecardNotes([
      { key: 'k1', step: 'modules', status: 'blocked', labelAr: 'مصدرٌ للدورة', gaps: ['لا مصدر'] },
      { key: 'k2', step: 'modules', status: 'advice', labelAr: 'المخرَج', gaps: ['أوضح'] },
    ] as never)
    const [item] = noteItemsFrom(notes)
    expect(item.required).toBe(true)
    expect(notePoints(item.edit.textAr).map((p) => p.tagAr)).toEqual(['مطلوب', 'مقترَح'])
  })
})

describe('② بندٌ لكلّ خطوة', () => {
  it('⚠️ العامّةُ أوّلا ثمّ بترتيب الخطوات — و«مطلوب» إن كان فيها، والفارغُ لا بندَ له', () => {
    const items = noteItemsFrom({ sessions: 'انقل اللقاء', general: 'شكرا', modules: 'مطلوب — مصدر', identity: '  ' })
    expect(items.map((x) => [x.edit.step, x.required])).toEqual([['general', false], ['modules', true], ['sessions', false]])
    expect(items[1].edit).toEqual({ kind: 'note', step: 'modules', textAr: 'مطلوب — مصدر' })
  })

  it('⚠️ ولا بندَ لسطر «واقترحنا على خطّتك…» الذي تكتبه المنصّةُ حين يُردّ بالتعديلات وحدَها', () => {
    const auto = suggestedEditsLineAr(26, 3)!
    expect(isEditsLineAr(auto)).toBe(true)
    expect(isEditsLineAr(suggestedEditsLineAr(1, 0)!)).toBe(true)
    expect(noteItemsFrom({ general: auto })).toEqual([])
    expect(isEditsLineAr('واقترحنا عليك أن تراجع المحور الأوّل')).toBe(false)
  })

  it('وعنوانُها باسم خطوتها، ونقاطُها صفوفُها', () => {
    const v = planEditView({ kind: 'note', step: 'modules', textAr: 'مطلوب — مصدر\nأوضح' }, null, { moduleIds: [] })
    expect(v.titleAr).toBe('ملاحظةٌ على «المحاور ومواعيدها»')
    expect(v.rows.map((r) => [r.labelAr, r.beforeAr, r.afterAr])).toEqual([['مطلوب', null, 'مصدر'], ['', null, 'أوضح']])
    expect(planEditView({ kind: 'note', step: 'general', textAr: 'شكرا' }, null, { moduleIds: [] }).titleAr).toBe('ملاحظةٌ عامّة')
  })
})

describe('③ وفي «المراجعة» قبل التعديلات', () => {
  const panel = code('src/components/PlanEdits.tsx')
  const trainer = panel.slice(panel.indexOf('export function PlanEditsPanel'))
  const ws = code('src/pages/trainer/CohortWorkspace.tsx')

  it('⚠️ الملاحظاتُ أوّلا ثمّ التعديلات — والترقيمُ بهذا الترتيب', () => {
    expect(trainer).toMatch(/const ordered = \[\.\.\.items\.filter\(isNote\), \.\.\.items\.filter\(\(x\) => !isNote\(x\)\)\];/)
    expect(trainer).toMatch(/const numberOf = \(x: PlanEditItem\) => ordered\.indexOf\(x\) \+ 1;/)
    const notesAt = trainer.indexOf('{pendingNotes.map((x) => noteCard(x))}')
    const editsAt = trainer.indexOf('{pendingEdits.map((x) => editCard(x))}')
    expect(notesAt, 'لا ملاحظات').toBeGreaterThan(0)
    expect(notesAt, 'الملاحظاتُ بعد التعديلات').toBeLessThan(editsAt)
  })

  it('⚠️ إطارُها بنقاطها، و«موافق» يقبلها، و«لا أوافق» يسأل لماذا — وزرٌّ إلى خطوتها إلّا العامّة', () => {
    const card = trainer.slice(trainer.indexOf('const noteCard = (x: PlanEditItem) => ('), trainer.indexOf('const editCard = (x: PlanEditItem) => ('))
    expect(card).toMatch(/<Card as="li" key=\{x\.id\}/)
    expect(card).toMatch(/<NotePoints view=\{x\.view\} \/>/)
    expect(card).toMatch(/apiPost\(`\/api\/trainer\/plan-edits\/\$\{x\.id\}\/accept`, \{\}\)[\s\S]{0,200}>\s*موافق\s*<\/Button>/)
    expect(card).toMatch(/setRejecting\(rejecting === x\.id \? null : x\.id\)[\s\S]{0,100}>\s*لا أوافق\s*<\/Button>/)
    expect(card).toMatch(/\{whyBox\(x, "أكّد أنّك لا توافق"/)
    expect(card).toMatch(/\{onOpenStep && x\.step !== "general" && \([\s\S]{0,200}onClick=\{\(\) => onOpenStep\(x\.step\)\}/)
    expect(code('src/components/PlanEdits.tsx')).toMatch(/const whyBox = [\s\S]{0,700}\/api\/trainer\/plan-edits\/\$\{x\.id\}\/reject`, note\.trim\(\) \? \{ noteAr: note\.trim\(\) \} : \{\}/)
  })

  it('⚠️ والصفحةُ تفتح خطوتَها — ما كانت من خطواتها', () => {
    expect(ws).toMatch(/onOpenStep=\{\(s\) => \{ if \(STAGES\.some\(\(x\) => x\.key === s\)\) void openStage\(s as Stage\); \}\}/)
  })
})

describe('④ ولا تُعدّ تعديلات، والقاعدةُ تتّسع لها', () => {
  it('⚠️ «التعديلاتُ الجاهزة» في البريد والجرس بلا الملاحظات', () => {
    expect(code('server/services/cohort-plan.service.ts'))
      .toMatch(/planEditSuggestion\.findMany\(\{ where: \{ planId, status: 'pending', kind: \{ not: 'note' \} \}/)
  })

  it('⚠️ والردُّ يولّدها — وقراءةُ خطّةٍ رُدّت قبل هذا تستدركها', () => {
    expect(code('server/services/cohort-plan.service.ts')).toMatch(/new PlanEditService\(this\.prisma\)\.ensureNoteItems\(planId\)/)
    expect(code('server/services/plan-edit.service.ts')).toMatch(/if \(latest\.status === 'changes_requested'\) await this\.ensureNoteItems\(latest\.id\)/)
  })

  it('⚠️ وقيدُ نوع البند في القاعدة يحمل الأنواعَ كلَّها — ومنها `note`', () => {
    const sql = readFileSync(join(process.cwd(), 'prisma/migrations/20261011200000_plan_edit_note_kind/migration.sql'), 'utf8')
    const allowed = /CHECK \("kind" IN \(([^)]+)\)\)/.exec(sql)?.[1].split(',').map((s) => s.trim().replace(/'/g, ''))
    expect(allowed).toEqual([...PLAN_EDIT_KINDS])
    expect(PLAN_EDIT_KINDS).toContain('note')
  })
})
