/* تقريرُ المراجعة — يرفعه المعتمِدُ ويقرؤه المدرّبُ في المنصّة (٨ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: يصل التقريرُ من المنصّة نفسِها لا بريدا من خارجها. الرحلةُ على قاعدةٍ
   حقيقيّةٍ في `server/tests/plan/review-report.test.ts`؛ وهنا جملةُ رسالة القرار، وأنّ
   الشاشتين تحملان وجهَيهما. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { reviewReportLineAr } from '@/application/trainer/plan-decision'
import { reportTitleAr } from '@/application/trainer/review-reports-bulk'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*(\/\/|--).*$/gm, '')

describe('رسالة القرار تذكر التقرير وموضعه', () => {
  it('بلا تقرير لا جملة', () => {
    expect(reviewReportLineAr([])).toBeNull()
  })

  it('تقرير واحد باسمه، وأين يقرأ', () => {
    const line = reviewReportLineAr(['تقرير.pdf'])!
    expect(line).toContain('تقرير مراجعة مفصّل: «تقرير.pdf»')
    expect(line).toContain('تجده في خطوة «المراجعة» من صفحة شعبتك')
  })

  /* أسماءُ الحزمة كانت للإدارة لترفعها (١١ أكتوبر ٢٠٢٦): «المدرّب — الشعبة (1)» تقريرٌ و«(2)» ملحق */
  it('⚠️ وبعنوانه الذي يفهمه المدرّب — لا «المدرّب — الشعبة (1).pdf»', () => {
    expect(reportTitleAr('صهيب الخوالدة — مهارة الخطابة (1).pdf')).toBe('تقرير المراجعة')
    expect(reportTitleAr('صهيب الخوالدة — مهارة الخطابة (2).pdf')).toBe('ملحق المرجع الدولي')
    expect(reviewReportLineAr(['ف — ش (1).pdf', 'ف — ش (2).pdf'])).toContain('«تقرير المراجعة» و«ملحق المرجع الدولي»')
    expect(reportTitleAr('خطّة الشعبة.pdf'), 'وما سواها باسمه').toBe('خطّة الشعبة.pdf')
    expect(reportTitleAr('تقرير (2).pdf'), 'نسخة تنزيل ثانية ليست ملحقا').toBe('تقرير (2).pdf')
  })

  it('وأكثر من تقرير بأسمائها', () => {
    expect(reviewReportLineAr(['أ.pdf', 'ب.docx'])).toContain('تقارير مراجعة مفصّلة: «أ.pdf» و«ب.docx»')
  })
})

describe('والشاشتان تحملان وجهيهما', () => {
  /* والرفعُ في «أدوات Claude»، وما رُفع في «بطاقات للمدرب» يُحذف قبل القرار (٢٦ أكتوبر ٢٠٢٦، المرحلة الخامسة) */
  it('بطاقة المراجعة ترفع التقرير والخطّة بانتظار القرار', () => {
    const card = code('src/components/admin/TrainerPlanReview.tsx')
    expect(card).toMatch(/const canUploadReport = trainerPlan\?\.status === "submitted" && canApprovePlan;/)
    expect(card).toMatch(/\{canUploadReport && \(\s*<>\s*<input\s+ref=\{reportFile\}[\s\S]{0,400}void reports\.upload\(f\)/)
    expect(card).toMatch(/<ReviewReportFiles reports=\{trainerPlan\.reviewReports \?\? \[\]\} busy=\{reports\.busy\} onRemove=\{canUploadReport \?/)
  })

  /* وصار في «المراجعة» مع بنودها، للقراءة إن شاء (١١ أكتوبر ٢٠٢٦) — كان في الرأس مع الملاحظة */
  it('وصفحة المدرّب تعرضه في «المراجعة»', () => {
    const ws = code('src/pages/trainer/CohortWorkspace.tsx')
    const at = ws.indexOf('{stage === "review" ? (')
    expect(at).toBeGreaterThan(0)
    const review = ws.slice(at, ws.indexOf(') : revision.pending > 0 && inHand ? (', at))
    expect(review).toContain('<ReviewReportList reports={ws.reviewReports ?? []} />')
    expect(ws.match(/<ReviewReportList /g)?.length, 'التقرير في موضعين').toBe(1)
  })
})
