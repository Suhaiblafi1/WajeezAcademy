/* ما ينقص «المهامّ والمصادر» يُقال بصفّه الناقص — لا بصفّ المهامّ وهو تامّ.

   شكا صاحبُ المنصّة (١٠ أكتوبر ٢٠٢٦): «ملأتُ كلَّ شيءٍ وما زالت ناقصة». ولسانُ
   «المهامّ العمليّة» عليه ✓، واللافتةُ تقول «ألّف مهمّةً عمليّةً واحدةً على
   الأقلّ». والسببُ أنّ الدرجةَ ثلاثةُ صفوفٍ في قائمة الخادم، وما لا تفحصه
   الشاشةُ بنفسها (محورٌ بلا مصدر، مشروعٌ بلا موعد) كان يقع على `[label]` —
   وهو صفُّ المهامّ.

   والفحصُ على البنية: الشيفرةُ بلا تعليقاتها، والمقتطَعُ فرعُ الدرجة وحدَه. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WS = readFileSync(join(process.cwd(), 'src/pages/trainer/CohortWorkspace.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const fn = WS.slice(WS.indexOf('const gapsFor = ('), WS.indexOf('const saveAndContinue'))
const branch = fn.slice(fn.indexOf('if (k === "assignments")'), fn.indexOf('return [label];\n  };'))

describe('ما ينقص «المهامّ والمصادر» بصفّه', () => {
  it('⚠️ لا يقع على صفّ المهامّ وحدَه حين لا يُسمّى شيءٌ بعينه', () => {
    expect(branch, 'لم يُعثر على فرع الدرجة').toContain('if (k === "assignments")')
    expect(branch, 'الناقصُ يُقال بصفّ المهامّ ولسانُه تامّ').not.toMatch(/return out\.length \? out : \[label\];/)
  })

  it('⚠️ ويقرأ صفوفَ الدرجة كلَّها من قائمة الخادم — ما لم يتمّ منها بنصّه', () => {
    expect(branch, 'لا يقرأ صفوفَ الدرجة').toContain('STAGE_KEYS.assignments')
    expect(branch, 'لا يقرأ تمامَ الصفّ').toMatch(/row && !row\.done \? \[row\.labelAr\]/)
  })
})
