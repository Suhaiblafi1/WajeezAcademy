/* ملفُّ التسليم، وروابطُ ما يُسلَّم، ونبذةُ الشعبة (١٠ أكتوبر ٢٠٢٦).

   قال صاحبُ المنصّة: «this is our challenge… we should make the text readable on links for the
   trainers… no need to tell the trainers to make links instead of text or files… solve it not
   limiting the trainers». وعن النبذة: وعدٌ في خطوة المدرّب ولا صفحةَ تعرضه — «solve it».

   ① قواعدُ ملفّ التسليم: النوعُ من الامتداد، والسقف، والسببُ بكلامٍ واضح، وما يُفتح وما يُنزَّل.
   ② الرابطُ في نصّ التسليم يُعرف كاملا بمساره العربيّ، ويُعرض بحروفه.
   ③ والشاشاتُ تعرضها منها: طابورُ المدرّب، وبطاقةُ الواجب، وصفحةُ الرحلة.
   ④ ونبذةُ الشعبة تُقرأ من الخطّة وتُعرض قبل الدفع وبعد الالتحاق.

   والفحصُ على الشيفرة بلا تعليقاتها، وعلى العرض المُصيَّر حيث أمكن. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  SUBMISSION_FILE_MAX_BYTES, cleanFileName, fileSizeAr, readyToSubmit, submissionFileInline, submissionFileProblemAr,
  submissionFileType, submissionFileView,
} from '@/application/learning/submission-file'
import { linkSegments, readableUrl } from '@/application/text/linkify'
import LinkedText from '@/components/LinkedText'
import { cohortSummaryAr, COHORT_SUMMARY_PUBLIC_MAX } from '@/application/learning/cohort-summary'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① ملفُّ التسليم', () => {
  it('⚠️ النوعُ من الامتداد — وما يُفتح صفحةً أو يعمل برنامجا لا يُقبل', () => {
    expect(submissionFileType('تقرير.PDF')?.mime).toBe('application/pdf')
    expect(submissionFileType('video.MOV')?.mime).toBe('video/quicktime')
    expect(submissionFileType('slides.pptx')).not.toBeNull()
    for (const bad of ['page.html', 'page.htm', 'logo.svg', 'run.exe', 'script.js', 'بلا امتداد', '.pdf.']) {
      expect(submissionFileType(bad), bad).toBeNull()
    }
  })

  it('⚠️ والسببُ يُقال بكلامٍ يفهمه المتعلّم — نوعا وحجما وفراغا', () => {
    expect(submissionFileProblemAr('a.pdf', 1000)).toBeNull()
    expect(submissionFileProblemAr('a.html', 1000)).toMatch(/^لا يمكن رفع هذا النوع من الملفات\. ارفع PDF أو Word/)
    expect(submissionFileProblemAr('a.mp4', SUBMISSION_FILE_MAX_BYTES + 1)).toBe('الملف أكبر من 100 ميغابايت، وهو الحد الأقصى للتسليم.')
    expect(submissionFileProblemAr('a.mp4', SUBMISSION_FILE_MAX_BYTES)).toBeNull()
    expect(submissionFileProblemAr('a.pdf', 0)).toBe('الملف فارغ.')
  })

  it('والحجمُ كما يُقرأ', () => {
    expect(fileSizeAr(850 * 1024)).toBe('850 كيلوبايت')
    expect(fileSizeAr(200)).toBe('1 كيلوبايت')
    expect(fileSizeAr(3.24 * 1024 * 1024)).toBe('3.2 ميغابايت')
    expect(fileSizeAr(2 * 1024 * 1024)).toBe('2 ميغابايت')
    expect(fileSizeAr(57.6 * 1024 * 1024)).toBe('58 ميغابايت')
  })

  it('⚠️ ما يُفتح في المتصفّح بنوعه المخزَّن — وما سواه يُنزَّل', () => {
    expect(submissionFileInline('application/pdf')).toBe(true)
    expect(submissionFileInline('video/mp4')).toBe(true)
    expect(submissionFileInline('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(false)
    expect(submissionFileInline('text/html')).toBe(false)
    expect(submissionFileInline('image/svg+xml')).toBe(false)
    expect(submissionFileInline(null)).toBe(false)
  })

  it('واسمُ الملفّ بلا مسارٍ ولا رموزِ تحكّم — والطويلُ يُقصّ ويبقى امتدادُه', () => {
    expect(cleanFileName('C:\\Users\\salma\\تقريري.docx')).toBe('تقريري.docx')
    expect(cleanFileName('/home/a/b.pdf')).toBe('b.pdf')
    expect(cleanFileName('a\u0000b\u0007.pdf')).toBe('ab.pdf')
    const long = cleanFileName(`${'ا'.repeat(300)}.pdf`)
    expect(long.length).toBeLessThanOrEqual(150)
    expect(long.endsWith('.pdf')).toBe(true)
  })

  it('⚠️ وما يخرج إلى الشاشة بابٌ لا مفتاح — و«ينتظر» لرفعٍ لم يصل وحدَه', () => {
    expect(submissionFileView({ storageKey: null, fileName: null, fileSize: null, fileUploadedAt: null }))
      .toEqual({ fileUrl: null, fileName: null, fileSize: null, fileWaiting: false })
    const waiting = submissionFileView({ storageKey: 'k/1', fileName: 'a.pdf', fileSize: 10, fileUploadedAt: null })
    expect(waiting).toEqual({ fileUrl: '/api/v1/submission-files/k%2F1', fileName: 'a.pdf', fileSize: 10, fileWaiting: true })
    expect(submissionFileView({ storageKey: 'k', fileName: 'a.pdf', fileSize: 10, fileUploadedAt: new Date() }).fileWaiting).toBe(false)
    /* ما سُلّم قبل أن يُحفظ الاسمُ لا يُقال عنه «لم يصل» */
    expect(submissionFileView({ storageKey: 'k', fileName: null, fileSize: null, fileUploadedAt: null }))
      .toMatchObject({ fileName: 'الملف المرفق', fileWaiting: false })
  })

  it('⚠️ ويُسلَّم بنصٍّ أو بملفٍّ مقبول — وملفٌّ مردودٌ لا يُسلَّم معه شيء', () => {
    expect(readyToSubmit('إجابتي', null)).toBe(true)
    expect(readyToSubmit('  ', null)).toBe(false)
    expect(readyToSubmit('', { name: 'a.pdf', size: 10 })).toBe(true)
    expect(readyToSubmit('إجابتي', { name: 'a.exe', size: 10 })).toBe(false)
  })
})

describe('② الرابطُ في نصّ التسليم — كاملا وبحروفه', () => {
  const links = (t: string) => linkSegments(t).filter((s) => s.kind === 'link').map((s) => (s.kind === 'link' ? s.text : ''))

  it('⚠️ المسارُ العربيُّ من الرابط — والترقيمُ العربيُّ والفراغُ يُنهيانه', () => {
    expect(links('مقالتي: https://hbrarabic.com/التواصل-مع-محاورك، وفيها ما طلبتَ'))
      .toEqual(['https://hbrarabic.com/التواصل-مع-محاورك'])
    expect(links('هنا https://x.com/بحث?q=تفاوض#الجزء-الثاني ثمّ')).toEqual(['https://x.com/بحث?q=تفاوض#الجزء-الثاني'])
    expect(links('ابحث https://x.com/س؟ وجدته')).toEqual(['https://x.com/س'])
  })

  it('والحرفُ العربيُّ الملاصقُ للنطاق يُنهيه كما كان', () => {
    expect(links('https://wajeezacademy.comثمّ')).toEqual(['https://wajeezacademy.com'])
  })

  it('⚠️ ويُعرض بحروفه — والعنوانُ الذي يُفتح كما كُتب', () => {
    const enc = 'https://hbrarabic.com/%D8%A7%D9%84%D8%AA%D9%88%D8%A7%D8%B5%D9%84'
    expect(readableUrl(enc)).toBe('https://hbrarabic.com/التواصل')
    expect(readableUrl('https://x.com/%E0%A4%A')).toBe('https://x.com/%E0%A4%A')
    const h = renderToStaticMarkup(createElement(LinkedText, { text: `عملي هنا ${enc} للمراجعة` }))
    const a = /<a\b[^>]*>([^<]*)<\/a>/.exec(h)
    expect(a![0]).toContain(`href="${enc}"`)
    expect(a![1]).toBe('https://hbrarabic.com/التواصل')
    expect(a![0]).toContain('target="_blank"')
  })
})

describe('③ والشاشاتُ تعرضها منها', () => {
  it('⚠️ طابورُ التصحيح: النصُّ بروابطه، والملفُّ باسمه — أو «لم يكتمل رفعُه»', () => {
    const src = code('src/pages/trainer/GradingQueue.tsx')
    expect(src).toMatch(/<LinkedText text=\{q\.textAnswer\}/)
    expect(src, 'النصُّ ما زال حرفا ميّتا').not.toMatch(/>\{q\.textAnswer\}</)
    expect(src).toMatch(/\{q\.fileUrl && q\.fileWaiting && \(/)
    expect(src).toMatch(/\{q\.fileUrl && !q\.fileWaiting && \([\s\S]{0,400}افتح ملفَّ التسليم\{q\.fileName \? `: \$\{q\.fileName\}` : ""\}/)
  })

  it('⚠️ بطاقةُ الواجب: يُرفق ملفّا حيث يقبل الخادمُ الملفّات — ويُسلَّم به وحدَه', () => {
    const src = code('src/components/journey/StageWork.tsx')
    expect(src).toMatch(/\{fileUploads && setFiles && \(\s*<SubmissionFilePick/)
    expect(src).toMatch(/disabled=\{busy === a\.id \|\| !readyToSubmit\(answers\[a\.id\], fileUploads \? files\[a\.id\] : null\)\}/)
    expect(src).toMatch(/<SubmittedWork submission=\{mine\}/)
  })

  it('⚠️ صفحةُ الرحلة: تصف الملفَّ للخادم ثمّ ترفعه بنسبةٍ تُرى، وتعيد ما انقطع', () => {
    const src = code('src/pages/student/Journey.tsx')
    expect(src).toMatch(/file: \{ originalName: file\.name, mime: file\.type \|\| undefined, sizeBytes: file\.size \}/)
    expect(src).toMatch(/await apiUpload\(uploadUrl, file, \(pct\) =>/)
    expect(src).toMatch(/\/api\/learner\/submissions\/\$\{submissionId\}\/file/)
    expect(src).toMatch(/window\.addEventListener\("beforeunload", warn\)/)
  })

  it('ونصُّ الإعلان يُعرض من العرض نفسِه — فلا تفترق القاعدتان', () => {
    expect(code('src/components/AnnouncementBody.tsx')).toMatch(/return <LinkedText text=\{text\}/)
  })
})

describe('④ نبذةُ الشعبة — قبل الدفع وبعد الالتحاق', () => {
  it('تُقرأ من الخطّة كما كُتبت، والفارغُ لا شيء', () => {
    expect(cohortSummaryAr({ summaryAr: '  سطران عن الشعبة.\r\n\r\n\r\n\r\nوالثاني.  ' })).toBe('سطران عن الشعبة.\n\nوالثاني.')
    for (const c of [null, 'نص', {}, { summaryAr: '   ' }, { summaryAr: 5 }]) expect(cohortSummaryAr(c)).toBeNull()
  })

  it('والطويلُ يُقصّ عند كلمة', () => {
    const long = `${'كلمة '.repeat(200)}`.trim()
    const out = cohortSummaryAr({ summaryAr: long })!
    expect(out.length).toBeLessThanOrEqual(COHORT_SUMMARY_PUBLIC_MAX + 1)
    expect(out.endsWith('كلمة…')).toBe(true)
  })

  it('⚠️ تخرج في قائمة الشعب العامّة من الخطّة المعتمَدة وحدَها', () => {
    const src = code('server/services/public-catalog.service.ts')
    expect(src).toMatch(/plans: \{\s*where: \{ trainerId: \{ not: null \}, status: \{ in: \[\.\.\.PLAN_VISIBLE_STATUSES\] \} \}/)
    expect(src).toMatch(/summaryAr: cohortSummaryAr\(c\.plans\[0\]\?\.content\)/)
  })

  it('⚠️ وتُعرض في اختيار الموعد قبل الدفع، وفي صفحة الشعبة بعد الالتحاق', () => {
    expect(code('src/components/CohortPicker.tsx')).toMatch(/\{selected\.summaryAr && \(\s*<p[^>]*>\{selected\.summaryAr\}<\/p>/)
    expect(code('src/components/journey/StageWork.tsx')).toMatch(/\{detail\.cohort\.trainerPlan\?\.summaryAr && \(\s*<p[^>]*>\{detail\.cohort\.trainerPlan\.summaryAr\}<\/p>/)
    expect(code('src/services/cohort-prices.ts')).toMatch(/summaryAr: typeof c\.summaryAr === 'string' && c\.summaryAr\.trim\(\) \? c\.summaryAr\.trim\(\) : null/)
  })
})
