/* تقاريرُ المراجعة دفعةً واحدة (١١ أكتوبر ٢٠٢٦) — «اريد ان ارفع كل شي مره واحده!».

   ① كلُّ ملفٍّ يُعرف موضعُه من معرّف خطّته في اسمه — وما لا يُعرف يُردّ بسببه ولا يُخمَّن.
   ② والصندوقُ في «خططٌ تنتظر اعتمادك» لمن يعتمد، يرفع بمسلك البطاقة نفسِه، وما كان مرفوعا
      يُقال «كان مرفوعا» لا «رُدّ». ويُحفظ باسمٍ بلا معرّف الخطّة — فلا يراه المدرّب.

   والفحصُ على الشيفرة بلا تعليقاتها. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { matchReportFile, reportDisplayName, reportMime, reportsSummaryAr } from '@/application/trainer/review-reports-bulk'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const A = 'c69a5748-897b-4b0b-906e-d634aea56dae'
const B = 'aab32bfa-2eee-4ca1-9eb4-42cd93b70338'
const plans = [{ id: A, labelAr: 'شعبة أ — مدرّبة' }, { id: B, labelAr: 'شعبة ب — مدرّب' }]

describe('① أيُّ خطّةٍ هذا الملفّ', () => {
  it('⚠️ من معرّفها في اسمه — تقريرا كان أو ملحقا، PDF أو Word', () => {
    expect(matchReportFile(`14 — تقرير مراجعة — دورة [${A}].pdf`, 'application/pdf', plans))
      .toEqual({
        name: `14 — تقرير مراجعة — دورة [${A}].pdf`, ok: true, planId: A, labelAr: 'شعبة أ — مدرّبة', mime: 'application/pdf',
        storedName: 'تقرير مراجعة — دورة.pdf',
      })
    expect(matchReportFile(`ملحق [${B.toUpperCase()}].docx`, '', plans)).toMatchObject({ ok: true, planId: B })
  })

  it('⚠️ وما لا يذكر خطّتَه، أو يذكر خطّتين، أو خطّةً ليست في القائمة — يُردّ بسببه', () => {
    expect(matchReportFile('تقرير مراجعة.pdf', 'application/pdf', plans))
      .toMatchObject({ ok: false, problemAr: 'لا يذكر اسمُ الملفّ خطّتَه — ارفعه من بطاقة خطّته' })
    expect(matchReportFile(`${A} ${B}.pdf`, 'application/pdf', plans)).toMatchObject({ ok: false })
    expect(matchReportFile('x [11111111-2222-3333-4444-555555555555].pdf', 'application/pdf', plans))
      .toMatchObject({ ok: false, problemAr: expect.stringMatching(/^خطّتُه ليست في القائمة المعروضة الآن/) })
  })

  it('⚠️ ولا يُقبل إلّا PDF أو Word — ولو ذكر خطّتَه', () => {
    expect(matchReportFile(`صورة [${A}].png`, 'image/png', plans)).toMatchObject({ ok: false, problemAr: 'لا يُقبل إلّا PDF أو Word' })
    expect(reportMime('a.DOCX', '')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })

  it('⚠️ والمدرّبُ يرى اسمَ الملفّ بلا معرّف الخطّة ولا رقمِ ترتيبه — رآهما في تجربة الرفع', () => {
    expect(reportDisplayName(`06 — تقرير مراجعة — دورة الإقناع [${A}].pdf`)).toBe('تقرير مراجعة — دورة الإقناع.pdf')
    expect(reportDisplayName(`ملحق المرجع الدولي (${B.toUpperCase()}).docx`)).toBe('ملحق المرجع الدولي.docx')
    expect(reportDisplayName(`${A}.pdf`)).toBe('تقرير المراجعة.pdf')
    /* وما ليس رقمَ ترتيبٍ يبقى: سنةٌ في أوّل الاسم */
    expect(reportDisplayName(`2026 — خطة [${A}].pdf`)).toBe('2026 — خطة.pdf')
  })

  it('والخلاصةُ تقول ما رُفع وما كان مرفوعا وما رُدّ — ولا تقول «يراه المدرّب» وفي الدفعة ما رُدّ', () => {
    expect(reportsSummaryAr(42, 0, 0)).toBe('رُفع 42 — يراها كلُّ مدرّبٍ في صفحة شعبته من الآن، وتذكرها رسالةُ قرارك.')
    expect(reportsSummaryAr(40, 2, 0)).toMatch(/^رُفع 40، وكان 2 مرفوعا من قبل فلم يُكرَّر — يراها/)
    expect(reportsSummaryAr(41, 0, 1)).toBe('رُفع 41، ورُدّ 1 بسببه أدناه.')
  })
})

describe('② الصندوقُ في «خططٌ تنتظر اعتمادك»', () => {
  const page = code('src/pages/admin/PendingPlans.tsx')
  const comp = code('src/components/ReviewReports.tsx')
  const bulk = comp.slice(comp.indexOf('export function ReviewReportsBulkUpload'), comp.indexOf('export function ReviewReportList'))

  it('⚠️ لمن يعتمد وحدَه — كالرفع في البطاقة', () => {
    expect(page).toMatch(/\{rows !== null && canUploadEdits && \(\s*<ReviewReportsBulkUpload/)
  })

  it('⚠️ يرفع إلى خطّة الملفّ بمسلك البطاقة نفسِه — ويقول قبل الرفع إنّ المدرّبَ يراه من الآن', () => {
    expect(bulk).toMatch(/const m = matchReportFile\(file\.name, file\.type, plans\)/)
    expect(bulk).toMatch(/apiPost<\{ uploadUrl: string; maxBytes: number \}>\(\s*`\/api\/admin\/cohort-plans\/\$\{m\.planId\}\/review-report`/)
    expect(bulk).toMatch(/await putSigned\(r\.uploadUrl, file, r\.maxBytes\)/)
    expect(bulk, 'يُحفظ باسمه الذي فيه معرّفُ الخطّة فيراه المدرّب').toMatch(/originalName: m\.storedName \}/)
    expect(bulk).toMatch(/<input[\s\S]{0,80}type="file"\s*multiple/)
    expect(bulk).toContain('ويراه المدرّبُ في صفحة')
  })

  it('⚠️ وما كان مرفوعا يُقال «كان مرفوعا» — لا «رُدّ»', () => {
    expect(bulk).toMatch(/const already = e instanceof ApiError && e\.code === "report_exists"/)
    expect(bulk).toMatch(/state: already \? "already" : "failed"/)
  })

  it('⚠️ وبطاقةُ المدرّب لا تقول «مع ردّها» — يراها والخطّةُ ما تزال تنتظر القرار', () => {
    const list = comp.slice(comp.indexOf('export function ReviewReportList'))
    expect(list).toContain('رفعته الإدارةُ بعد قراءة خطّتك')
    expect(list).not.toMatch(/مع ردّها|مع قرارها/)
  })

  it('⚠️ وما رُدّ لا يوقف ما بعده', () => {
    const loop = bulk.slice(bulk.indexOf('for (const [i, file] of files.entries())'))
    expect(loop.indexOf('try {')).toBeGreaterThan(0)
    expect(loop.indexOf('try {'), 'الاعتراضُ داخل الحلقة لا حولها').toBeLessThan(loop.indexOf('setProgress(null)'))
  })
})
