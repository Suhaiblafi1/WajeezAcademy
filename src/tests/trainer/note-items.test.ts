/* ملاحظاتُ الردّ بنودٌ في «المراجعة» (١١ أكتوبر ٢٠٢٦) — القاعدةُ والشاشة.

   قرارُ صاحب المنصّة: «دعها في قسم التعديلات بشكلٍ واضح — كأنّك تقول له قمنا بتعديل كذا وكذا، على
   شكل نقاط (ما لم يُذكر في التعديلات أدناه) — ليوافق عليها أيضا، بشكل أُطرٍ منظّمةٍ مرتّبة».

   ① الملاحظةُ نقاطٌ سطرا سطرا، و«مطلوب»/«مقترَح» في أوّل السطر وسمٌ — وهي صيغةُ بطاقة المعايير.
   ② بندٌ لكلّ خطوةٍ عليها ملاحظة، العامّةُ أوّلا — ولا بندَ لسطر «واقترحنا على خطّتك…» الآليّ.
   ③ وفي «المراجعة» قبل التعديلات: إطارٌ مرقّمٌ بنقاطه، و«سأعدّله» يفتح خطوتَها (لا «موافق»: الملاحظةُ لا
      تغيّر شيئا بنفسها — صاحبُ المنصّة، ١١ أكتوبر ٢٠٢٦)، و«أُبقيه كما هو» بكلمته.
   ④ ولا تُعدّ «تعديلاتٍ جاهزة»، والقيدُ في القاعدة يتّسع لنوعها.

   والقراءةُ البنيويّةُ على الشيفرة بلا تعليقاتها. وجولتُها على قاعدةٍ حقيقيّة في
   `server/tests/plan/note-items.test.ts`. */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  isEditsLineAr, noteItemsFrom, notePoints, PLAN_EDIT_KINDS, planEditView, suggestedEditsLineAr,
} from '@/application/trainer/plan-edits'
import { compactGapsAr, NOTE_SUGGESTION_AR, scorecardNotes } from '@/application/trainer/plan-scorecard'

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
    expect(v.rows.map((r) => [r.tagAr ?? null, r.labelAr, r.beforeAr, r.afterAr])).toEqual([['مطلوب', '', null, 'مصدر'], [null, '', null, 'أوضح']])
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

  it('⚠️ إطارُها بنقاطها، و«سأعدّله» يُعلِّمها ويفتح خطوتَها — لا «موافق» ولا «لا أوافق»', () => {
    const card = trainer.slice(trainer.indexOf('const noteCard = (x: PlanEditItem) => ('), trainer.indexOf('const editCard = (x: PlanEditItem) => ('))
    expect(card).toMatch(/<Card as="li" key=\{x\.id\}/)
    expect(card).toMatch(/<NotePoints view=\{x\.view\} \/>/)
    /* «سأعدّله»: يُعلِّمها ثمّ يفتح خطوتَها — وإن لم تكن الخطّةُ في يده فتحها وحدَها */
    expect(card).toMatch(/onClick=\{\(\) => blocked\s*\? onOpenStep\?\.\(x\.step\)\s*: void act\(x\.id, \(\) => apiPost\(`\/api\/trainer\/plan-edits\/\$\{x\.id\}\/accept`, \{\}\)[^\n]*\n\s*\.then\(\(\) => onOpenStep\?\.\(x\.step\)\)\}\s*>\s*سأعدّله\s*<\/Button>/)
    /* والعامّةُ لا خطوةَ لها: «اطّلعتُ عليها» */
    expect(card).toMatch(/x\.step === "general" \? \([\s\S]{0,400}>\s*اطّلعتُ عليها\s*<\/Button>/)
    /* ولا إجبار: يُبقيه كما هو ويقول لماذا */
    expect(card).toMatch(/setRejecting\(rejecting === x\.id \? null : x\.id\)[\s\S]{0,100}\{x\.step === "general" \? "لي رأيٌ آخر" : "أُبقيه كما هو"\}/)
    expect(card).toMatch(/\{whyBox\(x, "أرسِل رأيك"/)
    expect(card).not.toMatch(/>\s*(موافق|لا أوافق)\s*</)
    expect(code('src/components/PlanEdits.tsx')).toMatch(/const whyBox = [\s\S]{0,700}\/api\/trainer\/plan-edits\/\$\{x\.id\}\/reject`, note\.trim\(\) \? \{ noteAr: note\.trim\(\) \} : \{\}/)
  })

  it('⚠️ ونقطةُ «الآن ← نقترح» خانتان — «الآن» ثمّ «نقترح»، كخانتي التعديل', () => {
    const points = panel.slice(panel.indexOf('export function NotePoints'), panel.indexOf('export function NotePoints') + 2400)
    expect(points).toMatch(/\{r\.beforeAr !== null \? \([\s\S]{0,1200}<Cell label="الآن" text=\{r\.beforeAr\} muted \/>\s*<Cell label="نقترح" text=\{r\.afterAr\} \/>/)
    /* وقائمةُ النواقص محورا محورا ثمّ «كيف تُصلحه» — لا سطرا مكتظّا في خانة (١١ أكتوبر ٢٠٢٦) */
    expect(points).toMatch(/\{gapLayout\(r\.beforeAr\) \? \([\s\S]{0,200}<GapList layout=\{gapLayout\(r\.beforeAr\)!\} \/>[\s\S]{0,200}نقترح:<\/b> \{r\.afterAr\}/)
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
    /* آخرُ هجرةٍ تضع القيد — فالنوعُ الذي يأتي بعد `note` (`schedule`، ١١ أكتوبر ٢٠٢٦) يُقرأ معه */
    const dir = join(process.cwd(), 'prisma/migrations')
    const sql = readdirSync(dir).sort().reverse()
      .map((d) => { try { return readFileSync(join(dir, d, 'migration.sql'), 'utf8') } catch { return '' } })
      .find((x) => /ADD CONSTRAINT "PlanEditSuggestion_kind_allowed"/.test(x)) ?? ''
    const allowed = /CHECK \("kind" IN \(([^)]+)\)\)/.exec(sql)?.[1].split(',').map((s) => s.trim().replace(/'/g, ''))
    expect(allowed).toEqual([...PLAN_EDIT_KINDS])
    expect(PLAN_EDIT_KINDS).toContain('note')
  })
})

/* ═══ «ماذا كان وماذا نقترح» (١١ أكتوبر ٢٠٢٦) ═══
   قال صاحبُ المنصّة لمّا رأى «المُسلَّم: المحور 1: بلا مُسلَّم؛ المحور 2: …»: «الاقتراحاتُ غيرُ مفهومة.. يجب أن
   تكون ماذا كان وماذا نقترح». فالنقطةُ من بطاقة المعايير خانتان: «الآن» مجموعا، و«نقترح» المعيارُ بجملته. */
describe('⑤ «الآن ← نقترح»', () => {
  it('⚠️ السطرُ القديمُ كما وصل — «الآن» مجموعا، و«نقترح» من اسم معياره', () => {
    const old = 'مقترَح — المُسلَّم: ' + Array.from({ length: 8 }, (_, k) => `المحور ${k + 1}: بلا مُسلَّم`).join('؛ ')
    const [p] = notePoints(old)
    expect([p.tagAr, p.labelAr, p.nowAr]).toEqual(['مقترَح', 'المُسلَّم', 'المحاور 1–8: بلا مُسلَّم'])
    expect(p.suggestAr).toBe(NOTE_SUGGESTION_AR['المُسلَّم'])
    const [r] = notePoints('مقترَح — إيقاعٌ ثابتٌ وبلا عطل: 7 مواعيدَ مختلفة: الأربعاء 19:00 · الجمعة 19:00')
    expect([r.labelAr, r.nowAr]).toEqual(['إيقاعٌ ثابتٌ وبلا عطل', '7 مواعيدَ مختلفة: الأربعاء 19:00 · الجمعة 19:00'])
    expect(r.suggestAr).toMatch(/^اليومُ والساعةُ أنفسُهما كلَّ أسبوع/)
  })

  it('⚠️ والسطرُ الجديدُ يحمل خانتيه — ويُعرض صفّا بهما', () => {
    const notes = scorecardNotes([
      { key: 'rhythm', step: 'sessions', status: 'advice', labelAr: 'إيقاعٌ ثابتٌ وبلا عطل', gaps: ['3 مواعيد أسبوعيّة'], measuredAr: 'x', standardAr: 'اليومُ والساعةُ أنفسُهما' },
    ] as never)
    const v = planEditView({ kind: 'note', step: 'sessions', textAr: notes.sessions! }, null, { moduleIds: [] })
    expect(v.rows).toEqual([{ labelAr: 'إيقاعٌ ثابتٌ وبلا عطل', beforeAr: '3 مواعيد أسبوعيّة', afterAr: 'اليومُ والساعةُ أنفسُهما', tagAr: 'مقترَح' }])
  })

  it('وكلامُ المعتمِد الحرُّ نقطةٌ كما كتبها — لا يُشقّ عند نقطتين', () => {
    const [p] = notePoints('ملاحظة: راجع المحور الثاني')
    expect([p.labelAr, p.nowAr, p.suggestAr, p.textAr]).toEqual([undefined, undefined, undefined, 'ملاحظة: راجع المحور الثاني'])
  })

  it('والمجموعُ يقول المدى — والمختلفُ يبقى كما هو', () => {
    expect(compactGapsAr(['المحور 1: بلا لقاء', 'المحور 2: بلا لقاء', 'المحور 3: بلا لقاء', 'المحور 5: بلا لقاء'])).toBe('المحاور 1–3، 5: بلا لقاء')
    expect(compactGapsAr(['المحور 1: بلا لقاء', 'المحور 2: بلا مصدر'])).toBe('المحور 1: بلا لقاء؛ المحور 2: بلا مصدر')
  })

  it('⚠️ ولكلّ معيارٍ في البطاقة اقتراحُه — فلا سطرَ قديمٌ بلا «نقترح»', () => {
    const src = readFileSync(join(process.cwd(), 'src/application/trainer/plan-scorecard.ts'), 'utf8')
    const labels = [...src.matchAll(/key: '[a-z_]+', labelAr: '([^']+)'/g)].map((m) => m[1])
    expect(labels.length, 'تعطّلت قراءةُ المعايير').toBeGreaterThan(12)
    expect(labels.filter((l) => !NOTE_SUGGESTION_AR[l])).toEqual([])
  })
})
