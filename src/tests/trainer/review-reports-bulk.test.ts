/* تقاريرُ المراجعة دفعةً واحدة (١١ أكتوبر ٢٠٢٦) — «اريد ان ارفع كل شي مره واحده!».

   ① كلُّ ملفٍّ يُعرف موضعُه من معرّف خطّته في اسمه — وما لا يُعرف يُردّ بسببه ولا يُخمَّن.
   ② والصندوقُ في «خططٌ تنتظر اعتمادك» لمن يعتمد، يرفع بمسلك البطاقة نفسِه، وما كان مرفوعا
      يُقال «كان مرفوعا» لا «رُدّ». ويُحفظ باسمٍ بلا معرّف الخطّة — فلا يراه المدرّب.

   والفحصُ على الشيفرة بلا تعليقاتها. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { matchReportFile, nameTokens, reportDisplayName, reportMime, reportsSummaryAr } from '@/application/trainer/review-reports-bulk'

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
      .toMatchObject({ ok: false, problemAr: expect.stringMatching(/^لا يذكر اسمُ الملفّ خطّةً في القائمة — سمِّه باسم المدرّب واسم الشعبة/) })
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

describe('①ب وبلا معرّف: باسم المدرّب واسم الشعبة (١١ أكتوبر ٢٠٢٦)', () => {
  /* «سمي الملفات باسماء المدربين واسم الشعبه فقط لاغير، وان كان اكثر من ملف اترك رقم لكل ملف» */
  const course = 'دورة التفاوض متعدّد الأطراف: صياغة التزاماتٍ قابلةٍ للتنفيذ والمتابعة'
  const named = [
    { id: 'p-enas-2', labelAr: 'أ', trainerName: 'ايناس عاهد ذيب', cohortTitle: `${course} — شعبة ٢` },
    { id: 'p-enas-3', labelAr: 'ب', trainerName: 'ايناس عاهد ذيب', cohortTitle: `${course} — شعبة ٣` },
    { id: 'p-nawwar-3', labelAr: 'ج', trainerName: 'Nawwar Abdelhadi', cohortTitle: `${course} — شعبة ٣` },
  ]
  const match = (n: string) => matchReportFile(n, 'application/pdf', named)

  it('⚠️ «المدرّب — الشعبة (1).pdf» يُرفع إلى خطّته، ويُحفظ باسمه كما هو', () => {
    const n = 'ايناس عاهد ذيب — دورة التفاوض متعدّد الأطراف صياغة التزاماتٍ قابلةٍ للتنفيذ والمتابعة — شعبة ٢ (1).pdf'
    expect(match(n)).toMatchObject({ ok: true, planId: 'p-enas-2', storedName: n })
    expect(match('Nawwar Abdelhadi — دورة التفاوض متعدّد الأطراف صياغة التزاماتٍ قابلةٍ للتنفيذ والمتابعة — شعبة ٣ (2).pdf'))
      .toMatchObject({ ok: true, planId: 'p-nawwar-3' })
  })

  it('⚠️ ولو كُتب بلا تشكيل، وبأرقامٍ لاتينيّة، وبألفٍ بلا همزة', () => {
    expect(match('ايناس عاهد ذيب - دورة التفاوض متعدد الاطراف صياغة التزامات قابلة للتنفيذ والمتابعة - شعبة 3 (2).pdf'))
      .toMatchObject({ ok: true, planId: 'p-enas-3' })
    expect(nameTokens('شعبةُ ٢ — الأطراف ـ متعدّد')).toEqual(['شعبة', '2', 'الاطراف', 'متعدد'])
  })

  it('⚠️ وما يصدق على خطّتين يُردّ ولا يُخمَّن — رقمُ الشعبة يفصل', () => {
    expect(match('ايناس عاهد ذيب — دورة التفاوض متعدّد الأطراف (1).pdf'))
      .toMatchObject({ ok: false, problemAr: expect.stringMatching(/^يصدق اسمُه على 2 خطط — زِد فيه رقمَ الشعبة/) })
  })

  it('⚠️ ولا بدّ من اسم المدرّب كاملا، ومن شيءٍ من شعبته، وألّا يزيد عليهما', () => {
    const refused = (n: string) => expect(match(n), n).toMatchObject({ ok: false })
    refused('دورة التفاوض متعدّد الأطراف صياغة التزاماتٍ قابلةٍ للتنفيذ والمتابعة — شعبة ٢ (1).pdf')
    refused('ايناس — دورة التفاوض متعدّد الأطراف — شعبة ٢ (1).pdf')
    refused('ايناس عاهد ذيب (1).pdf')
    refused('Nawwar Abdelhadi (1).pdf')
    refused('ايناس عاهد ذيب — ملاحظات شخصية (1).pdf')
  })

  it('والمعرّفُ إن وُجد يقدَّم — وقائمةٌ بلا أسماءٍ لا تُطابَق بالاسم', () => {
    expect(matchReportFile(`ايناس عاهد ذيب — ${course} — شعبة ٢ [${A}].pdf`, 'application/pdf', [...named, ...plans]))
      .toMatchObject({ ok: true, planId: A })
    expect(matchReportFile('ايناس عاهد ذيب — دورة التفاوض — شعبة ٢ (1).pdf', 'application/pdf', named.map(({ id, labelAr }) => ({ id, labelAr }))))
      .toMatchObject({ ok: false })
    expect(matchReportFile('Nawwar Abdelhadi — شعبة ٣ (1).pdf', 'application/pdf', [{ id: 'x', labelAr: 'x', trainerName: 'Nawwar Abdelhadi' }]))
      .toMatchObject({ ok: false })
  })
})

describe('② الصندوقُ في «خططٌ تنتظر اعتمادك»', () => {
  const page = code('src/pages/admin/PendingPlans.tsx')
  const comp = code('src/components/ReviewReports.tsx')
  const bulk = comp.slice(comp.indexOf('export function ReviewReportsBulkUpload'), comp.indexOf('export function ReviewReportList'))

  it('⚠️ لمن يعتمد وحدَه — كالرفع في البطاقة', () => {
    expect(page).toMatch(/\{rows !== null && canUploadEdits && \(\s*<ReviewReportsBulkUpload/)
  })

  it('⚠️ والقائمةُ تحمل اسمَ المدرّب وعنوانَ الشعبة — بهما يُطابَق الاسمُ بلا معرّف', () => {
    const box = page.slice(page.indexOf('<ReviewReportsBulkUpload'))
    const prop = box.slice(box.indexOf('plans={'), box.indexOf('onUploaded='))
    expect(prop).toMatch(/^plans=\{scoped\.map\(\(r\) => \(\{ id: r\.id, /)
    expect(prop).toMatch(/, trainerName: r\.trainerName, cohortTitle: r\.cohort\.title \}\)\)\}\s*$/)
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
