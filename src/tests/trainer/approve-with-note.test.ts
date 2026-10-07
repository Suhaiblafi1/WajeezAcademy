/* الاعتمادُ بكلمة (٧ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: الخطّةُ التي ليس عليها إلّا مقترحاتٌ تُعتمَد ولا تُردّ، وتصل
   المقترحاتُ في خبر اعتمادها. والخادمُ يقبل الكلمةَ منذ زمن («وكلمةُ الإدارة: …» —
   `last-mile-screens.test.ts`)؛ وهنا ما يرسله الزرّ، وأنّ زرَّ الاعتماد يرسله. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { approvalBody } from '@/application/trainer/plan-decision'
import { REVIEW_NOTE_MAX } from '@/application/trainer/review-notes'

describe('ما يُرسَل بالاعتماد', () => {
  it('بلا كلمةٍ: الاعتمادُ وحدَه — كما كان', () => {
    expect(approvalBody('')).toEqual({ approve: true })
    expect(approvalBody('   \n ')).toEqual({ approve: true })
  })

  it('وبكلمةٍ: مشذَّبةً، وبحدّ الملاحظة الذي يقبله الخادم', () => {
    expect(approvalBody('  أضف مصادرَ عربيّة  ')).toEqual({ approve: true, note: 'أضف مصادرَ عربيّة' })
    expect(approvalBody('ك'.repeat(REVIEW_NOTE_MAX + 50)).note).toHaveLength(REVIEW_NOTE_MAX)
  })
})

describe('وزرُّ الاعتماد يرسلها', () => {
  /* التعليقاتُ لا تُحتسب — الفحصُ على الشيفرة */
  const src = readFileSync(join(process.cwd(), 'src/components/admin/TrainerPlanReview.tsx'), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*(\/\/|--).*$/gm, '')

  it('قرارُ الخطّة بالاعتماد يُبنى من الكلمة — لا `{ approve: true }` مكتوبا', () => {
    /* ما بعد عنوان القرار في سطره — جسمُ النداء */
    const calls = [...src.matchAll(/cohort-plans\/\$\{trainerPlan\.id\}\/decide`,\s*([^\n]*)/g)].map((m) => m[1].trim())
    expect(calls.length, 'لم يُعثر على نداءات القرار').toBeGreaterThanOrEqual(2)
    expect(calls.some((c) => c.startsWith('approvalBody(approveNote)'))).toBe(true)
    expect(calls.some((c) => c.startsWith('{ approve: true }'))).toBe(false)
  })

  it('والكلمةُ يُكتب فيها في حقلٍ بحدّها', () => {
    expect(src).toMatch(/<textarea[\s\S]{0,120}maxLength=\{REVIEW_NOTE_MAX\}[\s\S]{0,80}value=\{approveNote\}/)
  })
})
