/* عدّادُ طابور التصحيح — الإشارةُ الأولى في قائمة المدرّب.
 *
 * ── لماذا رقمٌ في القائمة لا إشعارٌ وحدَه ──
 *
 * الإشعارُ يُقرأ مرّةً ثمّ يُنسى، ويُرسَل مرّةً واحدةً عند امتلاء الطابور
 * كي لا تصير شعبةٌ من ثلاثين ثلاثين إشعارا عن عملٍ واحد. فالرقمُ هو ما
 * يبقى: يُرى بلا فتحِ شيء، ويصير صفرا وحدَه حين يفرغ الطابور.
 *
 * وهذا الحارسُ يفحص البنيةَ لا الشكل: من أين يأتي الرقم، وهل يُقرأ لمن
 * لا يرى، وهل يختفي عند الصفر.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const layout = readFileSync(join(root, 'src/pages/trainer/TrainerLayout.tsx'), 'utf8')
const route = readFileSync(join(root, 'server/http/routes/trainer-portal.routes.ts'), 'utf8')

describe('عدّادُ ما ينتظر تصحيحَه', () => {
  it('الرقمُ من الخادم لا من الواجهة — فلا يُخمَّن ولا يُحسب مرّتين', () => {
    expect(layout).toMatch(/apiGet<\{ pendingGrading\?: number \}>\("\/api\/trainer\/me"\)/)
    expect(route).toMatch(/pendingGrading/)
  })

  it('والخادمُ يعدّ المعلّقَ في شعبِ هذا المدرّب وحدَه', () => {
    /* عدٌّ بلا قيدِ المدرّب يُظهر له عملَ غيره؛ وبلا قيدِ الحالة يعدّ ما صُحّح */
    expect(route).toMatch(/status: \{ in: \['submitted', 'under_review'\] \}/)
    expect(route).toMatch(/trainers: \{ some: \{ profileId: profile\.id \} \}/)
  })

  it('ويظهر على «طابور التقييم» وحدَه', () => {
    expect(layout).toMatch(/label: "طابور التقييم"[^}]*count: pending/)
  })

  it('ويُقرأ لمن لا يرى — رقمٌ عائمٌ لا يقول ماذا يعدّ', () => {
    expect(layout).toMatch(/sr-only">ينتظر تصحيحَك: /)
  })

  it('ويختفي عند الصفر — «٠ ينتظر» ضجيجٌ لا خبر', () => {
    expect(layout).toMatch(/\{!!t\.count && \(/)
  })

  it('وسقوطُ العدّاد لا يُسقط البوّابة', () => {
    /* بوّابةٌ لا تُفتح لأنّ رقما لم يصل عطبٌ أكبرُ من غياب الرقم */
    expect(layout).toMatch(/\.catch\(\(\) => \{/)
  })
})
