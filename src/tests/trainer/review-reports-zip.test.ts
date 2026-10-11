/* الملفُّ المضغوطُ يُفتح في الصندوق لا على الجهاز (١١ أكتوبر ٢٠٢٦).

   ردّت أداةُ الفكّ في جهاز صاحب المنصّة حزمةَ التقارير بأسمائها العربيّة («Error 94 - Bad
   message»)، فيُسقط الملفُّ المضغوطُ في الصندوق كما هو. وهنا على حِزَمٍ حقيقيّةٍ تُبنى في الذاكرة:

   ① ما في الحزمة يخرج ملفّاتٍ بأسمائها — بلا مجلّداتها — ويمرّ بالمطابقة نفسِها.
   ② وما ليس تقريرا يُترك ويُعَدّ، ونسخةُ Word لـPDF فيها تُترك، وبقايا ماك ليست ملفّات.
   ③ وحزمةٌ لا تُفتح تُقال بسببها ولا توقف ما بعدها.
   ④ والصندوقُ يفتح ما اختير قبل المطابقة، ويقبل zip في نافذة الاختيار.

   والفحصُ على الشيفرة بلا تعليقاتها. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { matchReportFile } from '@/application/trainer/review-reports-bulk'
import { expandReportFiles, isZipFile, skippedLineAr } from '@/application/trainer/review-reports-zip'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const A = 'c69a5748-897b-4b0b-906e-d634aea56dae'
const B = 'aab32bfa-2eee-4ca1-9eb4-42cd93b70338'
const plans = [{ id: A, labelAr: 'شعبة أ' }, { id: B, labelAr: 'شعبة ب' }]
const REPORT_A = `06 — تقرير مراجعة — دورة الإقناع والتواصل المؤثّر بناء الحجّة ومعالجة الاعتراض [${A}]`
const APPX_B = `15 — ملحق المرجع الدولي — دورة الإنجليزية العامة، المستوى الأول [${B}]`
const PDF = '%PDF-1.4\n%%EOF\n'

async function zipOf(entries: Record<string, string>, name = 'حزمة.zip'): Promise<File> {
  const z = new JSZip()
  for (const [path, body] of Object.entries(entries)) z.file(path, body)
  return new File([await z.generateAsync({ type: 'arraybuffer' })], name, { type: 'application/zip' })
}

describe('① ما في الحزمة يخرج ملفّاتٍ بأسمائها', () => {
  it('⚠️ بأسمائها العربيّة كاملةً وبلا مجلّداتها — فتطابق خطّتَها كأنّها اختيرت واحدا واحدا', async () => {
    const zip = await zipOf({
      [`1 - التقارير والملاحق/${REPORT_A}.pdf`]: PDF,
      [`1 - التقارير والملاحق/${APPX_B}.pdf`]: PDF,
    })
    const r = await expandReportFiles([zip])
    expect(r.problems).toEqual([])
    expect(r.files.map((f) => f.name)).toEqual([`${REPORT_A}.pdf`, `${APPX_B}.pdf`])
    expect(r.files.map((f) => f.type)).toEqual(['application/pdf', 'application/pdf'])
    expect(await r.files[0].text()).toBe(PDF)
    expect(r.files.map((f) => matchReportFile(f.name, f.type, plans)))
      .toMatchObject([{ ok: true, planId: A }, { ok: true, planId: B }])
  })

  it('وما اختير ملفّا لا حزمةً يمرّ كما هو — بجانب ما خرج من الحزمة', async () => {
    const loose = new File([PDF], `${APPX_B}.pdf`, { type: 'application/pdf' })
    const r = await expandReportFiles([loose, await zipOf({ [`${REPORT_A}.pdf`]: PDF })])
    expect(r.files[0]).toBe(loose)
    expect(r.files.map((f) => f.name)).toEqual([`${APPX_B}.pdf`, `${REPORT_A}.pdf`])
  })

  it('والحزمةُ تُعرف بامتدادها أو بنوعها', () => {
    expect(isZipFile('reports.ZIP', '')).toBe(true)
    expect(isZipFile('reports', 'application/x-zip-compressed')).toBe(true)
    expect(isZipFile(`${REPORT_A}.pdf`, 'application/pdf')).toBe(false)
  })
})

describe('② ما يُترك من الحزمة', () => {
  it('⚠️ ما ليس PDF ولا Word يُترك ويُعَدّ، ونسخةُ Word لـPDF فيها تُترك، وبقايا ماك ليست ملفّات', async () => {
    const zip = await zipOf({
      [`1/${REPORT_A}.pdf`]: PDF,
      [`2 - نسخ Word/${REPORT_A}.docx`]: 'docx',
      [`2 - نسخ Word/${APPX_B}.docx`]: 'docx',
      '3/تعديلات.json': '{}',
      'README.txt': 'x',
      [`__MACOSX/1/._${REPORT_A}.pdf`]: 'mac',
      [`1/._${APPX_B}.pdf`]: 'mac',
    })
    const r = await expandReportFiles([zip])
    expect(r.files.map((f) => f.name), 'Word وحدَه بلا PDF يُرفع').toEqual([`${REPORT_A}.pdf`, `${APPX_B}.docx`])
    expect(r.skipped).toEqual({ other: 2, wordTwins: 1 })
    expect(skippedLineAr(r.skipped)).toBe('تُرك من الملفّ المضغوط: 1 نسخةَ Word لملفّاتِ PDF فيها (رُفع الـPDF وحدَه)، و2 ليست PDF ولا Word.')
    expect(skippedLineAr({ other: 0, wordTwins: 0 })).toBe('')
  })
})

describe('③ حزمةٌ لا تُفتح', () => {
  it('⚠️ تُقال بسببها — ولا توقف ما بعدها', async () => {
    const broken = new File(['ليست حزمة'], 'تقارير.zip', { type: 'application/zip' })
    const r = await expandReportFiles([broken, await zipOf({ [`${REPORT_A}.pdf`]: PDF })])
    expect(r.problems).toEqual([{ name: 'تقارير.zip', problemAr: expect.stringMatching(/^تعذّر فتحُ الملفّ المضغوط/) }])
    expect(r.files.map((f) => f.name)).toEqual([`${REPORT_A}.pdf`])
  })
})

describe('④ الصندوق', () => {
  const comp = code('src/components/ReviewReports.tsx')
  const bulk = comp.slice(comp.indexOf('export function ReviewReportsBulkUpload'), comp.indexOf('export function ReviewReportList'))

  it('⚠️ يفتح ما اختير قبل المطابقة — والمطابقةُ على ما خرج لا على ما اختير', () => {
    const open = bulk.indexOf('const expanded = await expandReportFiles(picked)')
    expect(open).toBeGreaterThan(0)
    expect(bulk).toMatch(/const files = expanded\.files;/)
    expect(open).toBeLessThan(bulk.indexOf('for (const [i, file] of files.entries())'))
  })

  it('⚠️ وما لم يُفتح يُقال في نتائجه، وما تُرك يُقال سطرا', () => {
    expect(bulk).toMatch(/const out: ReportResult\[\] = expanded\.problems\.map\(/)
    expect(bulk).toMatch(/setSkippedAr\(skippedLineAr\(expanded\.skipped\)\)/)
    expect(bulk).toMatch(/\{skippedAr && <p/)
  })

  it('⚠️ ونافذةُ الاختيار تقبل zip — وبطاقةُ الخطّة الواحدة لا', () => {
    expect(bulk).toMatch(/accept=\{\[\.\.\.REVIEW_REPORT_MIMES, "\.pdf", "\.docx", "\.zip", "application\/zip"\]/)
    const card = comp.slice(0, comp.indexOf('export function ReviewReportsBulkUpload'))
    expect(card).not.toContain('.zip')
  })
})
