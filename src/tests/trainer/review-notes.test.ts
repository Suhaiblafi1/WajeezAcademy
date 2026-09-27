/* ملاحظاتُ المعتمِد لكلّ خطوةٍ في خطوتها — القاعدةُ والعرض (٣ب).

   القاعدةُ محضةٌ في `review-notes.ts` ويحتجّ بها الخادم، والعرضُ في
   `ReviewNotes.tsx` يُرسَم رسما ساكنا — فالحارسُ على ما يُعرض لا على حروفٍ في
   ملفّ. وأثرُها في الدورة الحقيقيّة (تُحفظ وتُجمع وتبقى وتُرفع) في
   `server/tests/trainer/plan-single-approval.test.ts`. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  REVIEW_NOTE_MAX, REVIEW_SECTIONS, STAGE_LABELS, composeReviewNote, hasReviewNotes, normalizeReviewNotes,
  notedSections, notesForTrainer, readReviewNotes,
} from '@/application/trainer/review-notes'
import { ReviewNotesBanner, ReviewNotesForm, ReviewNotesList, StageReviewNote } from '@/components/ReviewNotes'

const WORKSPACE = readFileSync(join(process.cwd(), 'src/pages/trainer/CohortWorkspace.tsx'), 'utf8')
const COHORT_OPS = readFileSync(join(process.cwd(), 'src/pages/admin/CohortOps.tsx'), 'utf8')

describe('ما يُحفظ', () => {
  it('⚠️ المفاتيحُ المعروفةُ وحدَها، نصوصا مشذّبةً غيرَ فارغة', () => {
    expect(normalizeReviewNotes({
      general: '  عامّة  ', modules: 'المحورُ الثالث بلا متن', sessions: '   ', identity: 7, bogus: 'مفتاحٌ غريب',
    })).toEqual({ general: 'عامّة', modules: 'المحورُ الثالث بلا متن' })
  })

  it('ولا يتجاوز الحدّ — ولا يُقبل ما ليس كائنا', () => {
    expect(normalizeReviewNotes({ workbooks: 'x'.repeat(REVIEW_NOTE_MAX + 50) }).workbooks).toHaveLength(REVIEW_NOTE_MAX)
    expect(normalizeReviewNotes(['modules'])).toEqual({})
    expect(normalizeReviewNotes('نصّ')).toEqual({})
    expect(normalizeReviewNotes(null)).toEqual({})
  })

  it('⚠️ وملاحظاتٌ فارغةٌ كلُّها ليست ردّا', () => {
    expect(hasReviewNotes(normalizeReviewNotes({ general: ' ', modules: '' }))).toBe(false)
    expect(hasReviewNotes({ assignments: 'أضف تعليماتٍ للمهمّة الثانية' })).toBe(true)
  })
})

describe('ما يُقرأ', () => {
  const notes = { sessions: 'لقاءُ الموعد الثاني خارجه', general: 'المنهجُ متماسك', identity: 'النبذةُ قصيرة' }

  it('⚠️ الخطواتُ بترتيب الشريط — والعامّةُ ليست خطوة', () => {
    expect(notedSections(notes)).toEqual(['identity', 'sessions'])
  })

  it('⚠️ والنصُّ المجموعُ: العامّةُ أوّلا ثمّ كلُّ خطوةٍ باسمها', () => {
    expect(composeReviewNote(notes)).toBe('المنهجُ متماسك\n\n«المعلومات الأساسيّة»: النبذةُ قصيرة\n\n«اللقاءات»: لقاءُ الموعد الثاني خارجه')
    expect(composeReviewNote({})).toBeNull()
  })

  it('⚠️ والردُّ القديمُ نصٌّ واحدٌ يُقرأ ملاحظةً عامّة — ولا يسقط', () => {
    expect(readReviewNotes({ reviewerNotes: null, reviewerNote: '  أضف مثالا  ' })).toEqual({ general: 'أضف مثالا' })
    expect(readReviewNotes({ reviewerNotes: { modules: 'م' }, reviewerNote: 'نصٌّ مجموع' })).toEqual({ modules: 'م' })
    expect(readReviewNotes({ reviewerNotes: null, reviewerNote: null })).toEqual({})
  })

  it('⚠️ والمدرّبُ يقرؤها ما دامت مردودةً إليه وحدَه', () => {
    const row = { reviewerNotes: { workbooks: 'كرّاسةُ الموعد الأوّل رابطُها معطوب' }, reviewerNote: 'x' }
    expect(notesForTrainer({ status: 'changes_requested', ...row })).toEqual({ workbooks: 'كرّاسةُ الموعد الأوّل رابطُها معطوب' })
    /* بعد إعادة الإرسال تبقى في الصفّ للمعتمِد — لا في شاشة المدرّب */
    expect(notesForTrainer({ status: 'submitted', ...row })).toEqual({})
    expect(notesForTrainer({ status: 'approved', ...row })).toEqual({})
    expect(notesForTrainer(null)).toEqual({})
  })
})

describe('الأسماءُ واحدةٌ في الشريط وفي حقول المعتمِد', () => {
  it('⚠️ خطواتُ الشريط بأسماء أقسام الملاحظات نفسِها — فلا يبحث المدرّبُ عن خطوةٍ باسمٍ آخر', () => {
    for (const s of REVIEW_SECTIONS) {
      expect(WORKSPACE, `خطوةُ «${s.key}» في الشريط باسمٍ غيرِ اسم قسمها عند المعتمِد`)
        .toContain(`{ key: "${s.key}", label: "${s.label}", icon:`)
    }
    expect(Object.keys(STAGE_LABELS)).toEqual(['identity', 'modules', 'workbooks', 'sessions', 'assignments'])
  })
})

describe('نموذجُ المعتمِد', () => {
  const html = renderToStaticMarkup(createElement(ReviewNotesForm, { busy: false, onSend: () => undefined, onCancel: () => undefined }))

  it('⚠️ حقلٌ لكلّ خطوةٍ باسمها في شريط المدرّب، وحقلٌ عامّ', () => {
    expect(html).toContain('ملاحظةٌ عامّة')
    for (const s of REVIEW_SECTIONS) expect(html, `لا حقلَ لـ«${s.label}»`).toContain(s.label)
    expect(html.match(/<textarea/g)?.length).toBe(REVIEW_SECTIONS.length + 1)
  })

  it('⚠️ ولا يُرسَل فارغا — الزرُّ مطفأٌ حتّى تُكتب ملاحظة', () => {
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>أرسِلها إليه<\/button>/)
    expect(html).toContain('اكتب ملاحظةً واحدةً على الأقلّ.')
  })
})

describe('وما يُقرأ منها', () => {
  it('⚠️ قائمةُ المعتمِد: العامّةُ ثمّ الخطواتُ بترتيب الشريط وبأسمائها', () => {
    const html = renderToStaticMarkup(createElement(ReviewNotesList, {
      notes: { assignments: 'المهمّةُ الثانية بلا تعليمات', general: 'قريبٌ من الاعتماد', modules: 'المحورُ الثالث بلا متن' },
    }))
    const at = (s: string) => html.indexOf(s)
    expect(at('قريبٌ من الاعتماد')).toBeGreaterThan(-1)
    expect(at('قريبٌ من الاعتماد')).toBeLessThan(at(STAGE_LABELS.modules))
    expect(at(STAGE_LABELS.modules)).toBeLessThan(at(STAGE_LABELS.assignments))
    expect(html).not.toContain(STAGE_LABELS.sessions)
  })

  it('⚠️ لاصقةُ المدرّب: العامّةُ بنصّها، والخطواتُ أزرارٌ بأسمائها لا بنصوصها', () => {
    const html = renderToStaticMarkup(createElement(ReviewNotesBanner, {
      notes: { general: 'أحسنت — بقي القليل', sessions: 'لقاءُ الموعد الثاني خارجه' }, current: 'sessions', onOpen: () => undefined,
    }))
    expect(html).toContain('أحسنت — بقي القليل')
    expect(html).toMatch(/<button[^>]*aria-current="true"[^>]*>.*اللقاءات.*<\/button>/)
    /* نصُّ الخطوة في رأسها هناك — لا يُكرَّر في اللاصقة فتطول */
    expect(html).not.toContain('لقاءُ الموعد الثاني خارجه')
    expect(renderToStaticMarkup(createElement(ReviewNotesBanner, { notes: {}, onOpen: () => undefined }))).toBe('')
  })

  it('⚠️ وفي رأس الخطوة نصُّ ملاحظتها — ولا شيءَ لخطوةٍ لا ملاحظةَ عليها', () => {
    const html = renderToStaticMarkup(createElement(StageReviewNote, { stage: 'workbooks', text: 'كرّاسةُ الموعد الأوّل رابطُها معطوب' }))
    expect(html).toContain('ملاحظةُ الإدارة على هذه الخطوة')
    expect(html).toContain('كرّاسةُ الموعد الأوّل رابطُها معطوب')
    expect(html).toContain('aria-label="ملاحظةُ الإدارة على «الكرّاسات»"')
    expect(renderToStaticMarkup(createElement(StageReviewNote, { stage: 'workbooks', text: undefined }))).toBe('')
  })
})

describe('وفي ورشة المدرّب', () => {
  /* الورشةُ تحمّل بياناتها في أثرٍ فلا تُرسَم رسما ساكنا — فالحارسُ هنا على
     البنية: من أين تُقرأ الملاحظات، وأين تُعرض كلُّ واحدة. */
  it('⚠️ تُقرأ بقاعدة «ما دامت مردودةً إليه» لا من الصفّ مباشرةً', () => {
    expect(WORKSPACE).toMatch(/const reviewNotes: ReviewNotes = notesForTrainer\(ws\.plan\);/)
    expect(WORKSPACE, 'بقي عرضٌ للنصّ المجموع خارجَ القاعدة').not.toMatch(/\{ws\.plan\.reviewerNote\}/)
  })

  it('⚠️ وملاحظةُ الخطوة في رأسها — لكلّ خطوةٍ إلّا الاعتماد', () => {
    expect(WORKSPACE).toMatch(/\{phase === "prepare" && stage !== "approval" && <StageReviewNote stage=\{stage\} text=\{reviewNotes\[stage\]\} \/>\}/)
    expect(WORKSPACE).toMatch(/<ReviewNotesBanner notes=\{reviewNotes\} /)
  })

  it('⚠️ والشريطُ يعلّم الخطوةَ التي عليها ملاحظة — بالعين وبالاسم المسموع', () => {
    expect(WORKSPACE).toMatch(/const noted = \(notedStages as readonly string\[\]\)\.includes\(s\.key\);/)
    expect(WORKSPACE).toMatch(/\{noted && \(\s*<span data-noted /)
    /* والحالُ المسموعُ يحملها — `stateAr` هو ما يُقرأ في اسم الدرجة */
    expect(WORKSPACE).toMatch(/const stateAr = `\$\{dirty\[s\.key\][^\n]*\}\$\{noted \? " · عليها ملاحظةٌ من الإدارة" : ""\}`;/)
  })
})

describe('وفي بطاقة المعتمِد', () => {
  it('⚠️ الردُّ من النموذج بأقسامه — لا من صندوق المتصفّح بسطرٍ واحد', () => {
    /* بابٌ واحدٌ للردّ — وهو النموذج. ولا يُفحص غيابُ «note: note»: يطابق
       «note: notes» نفسَها، اسما جزءا من اسم */
    const declines = COHORT_OPS.match(/cohort-plans\/\$\{trainerPlan\.id\}\/decide`, \{ approve: false/g) ?? []
    expect(declines, 'للردّ على الخطّة بابٌ غيرُ النموذج').toHaveLength(1)
    expect(COHORT_OPS).toMatch(/<ReviewNotesForm[\s\S]{0,200}onSend=\{\(notes\) => void act\(\s*\(\) => apiPost\(`\/api\/admin\/cohort-plans\/\$\{trainerPlan\.id\}\/decide`, \{ approve: false, note: notes \}\)/)
  })

  it('⚠️ وما يُعتمَد مع الخطّة لا يُعرض بطاقةً بطاقة — يُعدّ على زرّ اعتمادها', () => {
    expect(COHORT_OPS).toMatch(/const riding = pendingSessions\.filter\(\(p\) => p\.withPlan\);/)
    expect(COHORT_OPS).toMatch(/const individual = pendingSessions\.filter\(\(p\) => !p\.withPlan\);/)
    expect(COHORT_OPS).toMatch(/\{individual\.map\(\(ps\) => \(/)
    expect(COHORT_OPS, 'بقيت البطاقاتُ تعرض كلَّ منتظِر').not.toMatch(/\{pendingSessions\.map\(/)
    expect(COHORT_OPS).toMatch(/riding\.length > 0 \? `اعتمدها ولقاءاتِها \(\$\{riding\.length\}\)` : "اعتمدها"/)
  })
})
