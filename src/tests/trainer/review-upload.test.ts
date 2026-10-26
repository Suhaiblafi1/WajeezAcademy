/* «خطط تنتظر اعتمادك»: تنزيلٌ واحدٌ وصندوقُ رفعٍ واحد — «فقط تحميل ورفع» (صاحب المنصّة، ٢٦ أكتوبر ٢٠٢٦).

   كانت فيها خمسُ أدوات: حزمتان، وصندوقان بثلاث طرقٍ وخانةِ استبدال، و«احذف المكرر من كل الخطط». وقال صاحبُ المنصّة:
   «هذا لا داعي له.. فقط تحميل ورفع.. باقي الأمور كانت لحلّ مشكلةٍ ظهرت في وقتها لا أكثر».

   ① الصندوقُ يقسم ما اختير: ملفّاتُ التعديلات، وكرّاساتُها (PDF سمّاه ملفٌّ منها)، والباقي تقارير.
   ② وخلاصةُ الدفعة تقول ما رُفع وما كان مرفوعا وما رُدّ — ولا «كلّها» وفيها ما رُدّ.
   ③ والصفحةُ تنزيلٌ واحدٌ وصندوقٌ واحد — ولا شيءَ ممّا ذهب. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isEditsFile, reviewUploadSummaryAr, splitReviewFiles } from '@/application/trainer/review-upload'

/* بلا التعليقات: ذِكرُ ما كان في شرحٍ ليس عودةً له */
const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const PAGE = code('src/pages/admin/PendingPlans.tsx')
const BOX = code('src/components/admin/ReviewUpload.tsx')

describe('① الصندوق يقسم ما اختير', () => {
  it('⚠️ ملف التعديلات JSON باسمه أو بنوعه — وما سواه ليس منه', () => {
    expect(isEditsFile({ name: 'خطة-الإقناع.json' })).toBe(true)
    expect(isEditsFile({ name: 'edits', type: 'application/json' })).toBe(true)
    expect(isEditsFile({ name: 'تقرير.pdf', type: 'application/pdf' })).toBe(false)
    expect(isEditsFile({ name: 'حزمة.zip' })).toBe(false)
  })

  it('⚠️ الـPDF الذي سماه ملف تعديلات كراسته — والباقي تقارير، Word وzip معها', () => {
    const files = [{ name: 'كراسة الإقناع.pdf' }, { name: 'ماريا — شعبة 3 (1).pdf' }, { name: 'ملحق.docx' }, { name: 'تقارير.zip' }]
    const { workbooks, reports } = splitReviewFiles(files, ['كراسة الإقناع.pdf'])
    expect(workbooks.map((f) => f.name)).toEqual(['كراسة الإقناع.pdf'])
    expect(reports.map((f) => f.name)).toEqual(['ماريا — شعبة 3 (1).pdf', 'ملحق.docx', 'تقارير.zip'])
  })

  it('⚠️ وبصورة الاسم الواحدة — اسم ماك يطابق اسم البند', () => {
    /* «إ» تنحلّ في صورة ماك إلى ألفٍ وهمزةٍ تحتها — فالاسمان مختلفان حرفا ومتّفقان قراءة */
    const mac = 'كراسة الإقناع'.normalize('NFD') + '.pdf'
    expect(mac, 'المسح لا يفرّق — فلا يقيس شيئا').not.toBe('كراسة الإقناع.pdf')
    expect(splitReviewFiles([{ name: mac }], ['كراسة الإقناع.pdf']).workbooks).toHaveLength(1)
  })

  it('وبلا ملف تعديلات في الدفعة: كل PDF تقرير', () => {
    expect(splitReviewFiles([{ name: 'كراسة.pdf' }], []).reports).toHaveLength(1)
  })
})

describe('② خلاصة الدفعة', () => {
  it('⚠️ «كلها» لما رفع كله وحده', () => {
    expect(reviewUploadSummaryAr(5, 0, 0)).toBe('رفعت الملفات كلها (5).')
    expect(reviewUploadSummaryAr(4, 0, 1)).not.toMatch(/كلها/)
    expect(reviewUploadSummaryAr(4, 1, 0)).not.toMatch(/رفعت الملفات كلها/)
  })

  it('⚠️ ما رفع وما رد وما كان مرفوعا — كل بعدده', () => {
    expect(reviewUploadSummaryAr(2, 1, 1)).toBe('رفع 2 من 4، وردّ 1 بسببه أدناه، و1 ملف كان مرفوعا من قبل.')
    expect(reviewUploadSummaryAr(0, 0, 3)).toBe('لم يرفع شيء — ردت الملفات كلها (3) بأسبابها أدناه.')
    expect(reviewUploadSummaryAr(0, 2, 0)).toBe('كانت الملفات كلها (2) مرفوعة من قبل — لم يكرر شيء.')
    expect(reviewUploadSummaryAr(0, 1, 1)).toBe('لم يرفع شيء جديد، وردّ 1 بسببه أدناه، و1 ملف كان مرفوعا من قبل.')
  })

  it('ونصوصها بلا تشكيل إعرابي — اللغة البيضاء', () => {
    const all = [reviewUploadSummaryAr(5, 0, 0), reviewUploadSummaryAr(2, 1, 1), reviewUploadSummaryAr(0, 0, 3), reviewUploadSummaryAr(0, 2, 0)].join(' ')
    expect(all).not.toMatch(/[ً-ِْ]/)
  })
})

describe('③ والصفحة تنزيل واحد وصندوق واحد', () => {
  it('⚠️ صندوق رفع واحد — ولا صندوق تعديلات ولا تقارير ولا «احذف المكرر» للخطط كلها', () => {
    expect(PAGE.match(/<ReviewUpload\b/g)).toHaveLength(1)
    expect(PAGE, 'عاد صندوق من الصناديق الثلاثة').not.toMatch(/BulkUpload|DedupeAll/)
  })

  it('⚠️ والصندوق يقرأ ملفات التعديلات أولا — فيعرف الكراسات قبل أن يرفع تقريرا', () => {
    const at = (s: string) => BOX.indexOf(s)
    expect(at('const { workbooks, reports } = splitReviewFiles(')).toBeGreaterThan(0)
    expect(at('picked.filter(isEditsFile)'), 'يقسم قبل أن يقرأ ملفات التعديلات').toBeLessThan(at('splitReviewFiles('))
    expect(at('splitReviewFiles('), 'يرفع التقارير قبل أن يعرف الكراسات').toBeLessThan(at('const expanded = await expandReportFiles(reports);'))
  })

  it('⚠️ والرفع العادي وحده — لا طريقة تستبدل ولا تسحب، ولا حذف لتقرير', () => {
    expect(BOX, 'عادت طرق الرفع أو الحذف').not.toMatch(/replace-drafts|replace-all|apiDelete|type="radio"|type="checkbox"/)
  })
})
