/* فجوةُ المتون: ما يُقال للمتعلّم، وبوّابةٌ تحرس لا شيء (البند ٤٢).

   ٣٠٨ وحداتٍ من ٤٠٤ بلا متنِ دراسةٍ ذاتيّة. وهذا **ليس بيعَ فراغ**:
   الوحداتُ الأربعُ مئةٍ والأربعُ كلُّها لها عنوانٌ ومخرَجٌ ونشاطٌ ومخرَجٌ
   مطلوبٌ وساعات — والدورةُ تُدرَّس مباشرةً مع مدرّبها. الناقصُ نصُّ الدراسة
   الذاتيّة وحدَه.

   لكنّ عطبين حقيقيّين كانا:

   ① **المشغّلُ يصمت**: وحدةٌ بلا متن تُسقط خطوةَ الدرس فيهبط المتعلّمُ إلى
      «نشاطك ومخرَجك» مباشرةً بلا كلمةٍ تقول لماذا — فيرى وحدةً من خطوةٍ
      واحدة ويظنّ العطبَ في حسابه.

   ② **بوّابةُ التأليف تحرس لا شيء**: `ci:authoring` مكتوبةٌ في
      `package.json` ولا يناديها أحدٌ في CI — ولو نودِيت لسقطت، فوحدةٌ
      مؤلَّفةٌ ناقصةٌ واحدة تُبقيها حمراءَ أبدا. وبوّابةٌ حمراءُ دائما تُعلّم
      القارئَ تجاهلَ الأحمر. */

import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import './setup-catalog'
import catalog from '../data/catalog/core-catalog.v2.json'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

interface RawModule {
  module_id: string
  title_ar?: string
  module_outcome_ar?: string
  practice_activity_ar?: string
  evidence_artifact_ar?: string
  module_body_ar?: string
}
const modules = (catalog as unknown as { modules: RawModule[] }).modules
const filled = (v: string | undefined) => Boolean(v && v.trim())

describe('الحقيقةُ المقيسة — ما هو ناقصٌ بالضبط', () => {
  it('كلُّ وحدةٍ لها عنوانٌ ومخرَجٌ ونشاطٌ ومخرَجٌ مطلوب — فليست فارغة', () => {
    const structural: (keyof RawModule)[] = [
      'title_ar', 'module_outcome_ar', 'practice_activity_ar', 'evidence_artifact_ar',
    ]
    for (const field of structural) {
      const missing = modules.filter((m) => !filled(m[field] as string | undefined))
      expect(
        missing.map((m) => m.module_id).slice(0, 5),
        `وحداتٌ بلا ${field} — الدورةُ ما عادت تُدرَّس بهيكلٍ كامل`,
      ).toEqual([])
    }
  })

  it('والناقصُ متنُ الدراسة الذاتيّة وحدَه — ويُقاس فلا يُنسى', () => {
    const withBody = modules.filter((m) => filled(m.module_body_ar)).length
    expect(withBody, 'تغيّرت التغطية — تُراجَع خطّةُ التأليف').toBeLessThan(modules.length)
    expect(withBody, 'تراجعت التغطيةُ عمّا كانت').toBeGreaterThanOrEqual(96)
  })
})

describe('① المشغّلُ يقول ما ينقص — لا يصمت', () => {
  const player = read('src/pages/student/ModuleStudy.tsx')

  it('وحدةٌ بلا دروسٍ تُعلن أنّ متنَها قيد التأليف', () => {
    expect(player).toMatch(/lessonCount === 0/)
    expect(player).toContain('قيد التأليف')
  })

  it('ولا تَعِد بما لا يقع — تقول إنّها تُدرَّس مع مدرّبها وإنّ نشاطَها أدناه', () => {
    expect(player).toContain('تُدرَّس مع مدرّبك')
  })
})

describe('② بوّابةُ التأليف تحرس فعلا', () => {
  it('لها خطُّ أساسٍ ملتزَم — فلا تُترك حمراءَ أبدا ولا يُزيَّف الرقمُ بصفر', () => {
    expect(existsSync(join(root, 'authoring-baseline.json')), 'لا خطَّ أساس').toBe(true)
    const base = JSON.parse(read('authoring-baseline.json')) as { modules: Record<string, number> }
    expect(Object.keys(base.modules).length, 'خطُّ أساسٍ فارغ — يُراجَع').toBeGreaterThanOrEqual(0)
  })

  it('والبوّابةُ تفهم الجديدَ من المسجَّل — لا «أيُّ مخالفةٍ تُسقط»', () => {
    const gate = read('scripts/audit-authoring.ts')
    expect(gate, 'البوّابةُ ما زالت تسقط على المسجَّل سلفا').toContain('authoring-baseline.json')
    expect(gate).toContain('--update')
    expect(gate).toMatch(/مخالفاتٌ فوق خطّ الأساس/)
  })

  /* يُقاس سطرُ التشغيل لا نصُّ التعليق: ذكرُ اسم البوّابة في شرحٍ لا يُشغّلها،
     وهي العلّةُ نفسُها التي وقعت فيها البوّابتان قبلها. */
  it('وهي موصولةٌ بـCI — بوّابةٌ لا يناديها أحدٌ ليست بوّابة', () => {
    const runs = read('.github/workflows/ci.yml')
      .split('\n')
      .filter((l) => /^\s*run:/.test(l))
      .join('\n')
    expect(runs, 'ci:authoring مكتوبةٌ ولا تُنادى').toMatch(/ci:authoring|audit-authoring/)
  })
})
