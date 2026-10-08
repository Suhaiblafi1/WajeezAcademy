/* تقريرُ المراجعة — يرفعه المعتمِدُ ويقرؤه المدرّبُ في المنصّة (٨ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: يصل التقريرُ من المنصّة نفسِها لا بريدا من خارجها. الرحلةُ على قاعدةٍ
   حقيقيّةٍ في `server/tests/plan/review-report.test.ts`؛ وهنا جملةُ رسالة القرار، وأنّ
   الشاشتين تحملان وجهَيهما. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { reviewReportLineAr } from '@/application/trainer/plan-decision'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*(\/\/|--).*$/gm, '')

describe('رسالةُ القرار تذكر التقريرَ وموضعَه', () => {
  it('بلا تقريرٍ لا جملة', () => {
    expect(reviewReportLineAr([])).toBeNull()
  })

  it('تقريرٌ واحدٌ باسمه، وأين يُقرأ', () => {
    const line = reviewReportLineAr(['تقرير.pdf'])!
    expect(line).toContain('تقريرُ مراجعةٍ مفصّل: «تقرير.pdf»')
    expect(line).toContain('تجده في صفحة شعبتك تحت «تقرير المراجعة»')
  })

  it('وأكثرُ من تقرير بأسمائها', () => {
    expect(reviewReportLineAr(['أ.pdf', 'ب.docx'])).toContain('تقاريرُ مراجعةٍ مفصّلة: «أ.pdf» و«ب.docx»')
  })
})

describe('والشاشتان تحملان وجهَيهما', () => {
  it('بطاقةُ المراجعة ترفع التقرير والخطّةُ بانتظار القرار', () => {
    expect(code('src/components/admin/TrainerPlanReview.tsx'))
      .toMatch(/status === "submitted" && canApprovePlan && \(\s*<ReviewReportUploader planId=\{trainerPlan\.id\}/)
  })

  it('وصفحةُ المدرّب تعرضه حيث تعرض ملاحظةَ الإدارة', () => {
    const ws = code('src/pages/trainer/CohortWorkspace.tsx')
    const at = ws.indexOf('<ReviewNotesBanner')
    expect(at).toBeGreaterThan(0)
    expect(ws.slice(at, at + 400)).toContain('<ReviewReportList reports={ws.reviewReports ?? []} />')
  })
})
