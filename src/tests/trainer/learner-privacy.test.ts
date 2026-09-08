/* خصوصيّةُ المتعلّم عند المدرّب.

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): «لا يرى المدرّب أرقام وإيميلات
   المتدرّبين للخصوصيّة — فقط المعلومات التي يجب أن يراها كمدرّب».

   وكان `trainerCohorts` يُرسل بريدَ كلّ مسجَّل، وصفحةُ «متعلّموني» تبحث فيه،
   وقائمةُ المتعثّرين تفتح `mailto:` إليه. فالمنصّةُ هي القناة — رسائلُ
   الشعبة — والبريدُ ملكُ المتعلّم.

   والفحصُ على **البنية** لا على ورود حرف: كتلةُ `trainerCohorts` وحدَها،
   والشيفرةُ بلا تعليقاتها. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('خصوصيّةُ المتعلّم عند المدرّب', () => {
  it('«شعبي» لا تحمل بريدَ المتعلّم — الاسمُ وحدَه', () => {
    const src = code('server/services/enrollment.service.ts')
    const block = /async trainerCohorts\([\s\S]*?\n {2}\}\n/.exec(src)?.[0] ?? ''
    expect(block, 'كتلةُ trainerCohorts مفقودة').toBeTruthy()
    expect(block, 'بريدُ المتعلّم يخرج إلى المدرّب').not.toMatch(/email:\s*true/)
    expect(block, 'رقمُ المتعلّم يخرج إلى المدرّب').not.toMatch(/phone:\s*true/)
  })

  it('«متعلّموني» لا تقرأ بريدا ولا تبحث فيه', () => {
    const src = code('src/pages/trainer/MyLearners.tsx')
    expect(src).not.toMatch(/\.email\b/)
  })

  it('والمتعثّرون يُراسَلون من الشعبة لا من بريدهم', () => {
    const list = code('src/components/AtRiskList.tsx')
    expect(list, 'عاد `mailto:` إلى المدرّب').not.toMatch(/mailto:/)
    expect(list, 'لا طريقَ إلى رسائل الشعبة').toMatch(/to="\/trainer\/board"/)
    const model = code('src/application/trainer/at-risk.ts')
    expect(model, 'نموذجُ المتعثّر ما زال يحمل بريدا').not.toMatch(/\bemail\b/)
  })
})
