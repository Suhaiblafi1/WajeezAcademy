/* تسجيلُ اللقاء آليٌّ كلُّه — لا رفعَ ولا رابطَ بيد المدرّب (٣٠ سبتمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «لماذا هنا ارفع التسجيل علما أنّه لقاءُ زوم؟» ثمّ:
   «Zoom يسجّل على كلّ حال… أريده آليّا: حين ينتهي اللقاءُ يكون التسجيلُ متاحا
   للطلبة، ويعيد المدرّبُ مشاهدتَه — بلا زرّ تنزيل».

   وحارسُ ١٧ سبتمبر في `sessions-stage.test.ts` (لا خانةَ رابطٍ في بطاقة اللقاء)
   باقٍ كما هو؛ وهنا ما أُضيف إليه: لا رفعَ ملفٍّ، ولا مسلكَ رفعٍ للمدرّب، ولا
   تذكيرَ بعملٍ لا يملكه، وحالُ التسجيل يُقال بعد اللقاء. وإطفاءُ التنزيل في
   Zoom نفسِه محروسٌ في `server/tests/learning/zoom-recording.test.ts` ④.

   والفحصُ على البنية بعد نزع التعليقات. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const CARD = code('src/pages/trainer/SessionsAndAttendance.tsx')

describe('بطاقةُ اللقاء المباشر', () => {
  it('⚠️ لا رفعَ لملفّ تسجيل — ولا نداءَ رفع', () => {
    expect(CARD, 'عاد حقلُ رفع ملفٍّ إلى بطاقة اللقاء').not.toMatch(/type="file"/)
    expect(CARD, 'عاد نداءُ تسجيل ملفٍّ للرفع').not.toMatch(/\/recordings`/)
  })

  it('⚠️ وحالُ التسجيل بعد انتهاء اللقاء وحدَه', () => {
    expect(CARD).toMatch(/\(s\.status === "done" \|\| sessionEndMs\(s\) < Date\.now\(\)\) && openableRecordings\(s\.recordings\)\.length === 0 && \(\s*<p[^>]*>\s*بانتظار تسجيل Zoom/)
  })
})

describe('والخادمُ والطابور', () => {
  it('⚠️ لا مسلكَ للمدرّب يرفع تسجيلا أو يلصق رابطَه', () => {
    const routes = code('server/http/routes/learning-portal.routes.ts')
    expect(routes).not.toContain("'/api/trainer/sessions/:sessionId/recordings'")
    expect(routes).not.toContain('recording-link')
  })

  it('⚠️ ولا تذكيرَ في طابور المدرّب بتسجيلٍ يرفعه', () => {
    expect(code('src/application/trainer/work-queue.ts')).not.toContain('recording_missing')
  })
})
