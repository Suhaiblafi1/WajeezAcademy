/* صفحةُ الشعب (١٢ أكتوبر ٢٠٢٦) — طلبان من صاحب المنصّة في رسالةٍ واحدة:

   ① «لماذا لا يمكن فتح الشعبة…؟ أهناك خطأ» — حُفظت السعةُ والسعر في «التسجيل والمال» فصار
      الرأسُ «0/25 مقعدا · 170 USD»، وبقيت شاراتُ «شروط الفتح» «لا سعة محددة» لأنّها لا تُعاد بعد
      الحفظ. فما يُحفظ في ألسنة البطاقة يُعيد شروطَ الفتح معه.
   ② «أريد تاب خاصّة للدورات التي تكون معتمدة» — لسانٌ في رأس القائمة، وشرطُه شرطُ الشارة نفسِها.

   والفحصُ على الشيفرة بلا تعليقاتها: حارسٌ طابق جملةً في تعليقٍ مرّ أخضرَ لسببٍ خاطئ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { awaitsOpening, COHORT_LISTS, inCohortList } from '@/pages/admin/cohort-lists'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const page = code('src/pages/admin/AdminCohorts.tsx')

describe('① شروط الفتح تعاد بعد الحفظ', () => {
  it('⚠️ ما يحفظ في ألسنة البطاقة يعيد القائمة وشروط فتح الشعبة معا', () => {
    expect(page).toMatch(/<CohortOps cohort=\{c\} tab=\{tab\} onDone=\{\(msg\) => \{[\s\S]{0,80}?void load\(\); void loadChecklist\(c\.id\); \}\} \/>/)
  })
})

describe('② لسان «معتمدة — تنتظر فتحك»', () => {
  const draft = { status: 'draft', trainerPlanApproved: true }

  it('⚠️ المعتمدة: مسودة اعتمدت خطة مدربها — لا المفتوحة ولا مسودة بلا خطة معتمدة', () => {
    expect(awaitsOpening(draft)).toBe(true)
    expect(awaitsOpening({ status: 'draft', trainerPlanApproved: false })).toBe(false)
    expect(awaitsOpening({ status: 'open', trainerPlanApproved: true })).toBe(false)
  })

  it('⚠️ «كل الشعب» يعرض كل شيء، والمعتمدة وحدها في لسانها', () => {
    expect(COHORT_LISTS.map((l) => l.id)).toEqual(['all', 'approved'])
    expect(inCohortList('all', { status: 'open', trainerPlanApproved: false })).toBe(true)
    expect(inCohortList('approved', { status: 'open', trainerPlanApproved: true })).toBe(false)
    expect(inCohortList('approved', draft)).toBe(true)
  })

  it('⚠️ والقائمة تصفى باللسان قبل الفلاتر — والشارة واللسان شرط واحد', () => {
    expect(page).toMatch(/const filtered = rows\.filter\(\(c\) => \{\s*if \(!inCohortList\(list, c\)\) return false;/)
    expect(page).toMatch(/\{awaitsOpening\(c\) && \(\s*<span[^>]*>\s*معتمدة — تنتظر فتحك/)
    expect(page).not.toMatch(/c\.status === "draft" && c\.trainerPlanApproved/)
  })

  it('⚠️ والشريط بعدد كل لسان، والتبديل يعود إلى الصفحة الأولى', () => {
    expect(page).toMatch(/<TabBar className="mb-4" ariaLabel="قوائم الشعب" value=\{list\}\s*onChange=\{\(next\) => \{ setList\(next\); setPage\(1\); \}\}/)
    expect(page).toMatch(/items=\{COHORT_LISTS\.map\(\(l\) => \(\{ id: l\.id, label: `\$\{l\.label\} \(\$\{rows\.filter\(\(c\) => inCohortList\(l\.id, c\)\)\.length\}\)` \}\)\)\}/)
  })

  it('واللسان الفارغ يقول إنه لا شيء ينتظر — لا «وسع الفلاتر»', () => {
    expect(page).toMatch(/list === "approved" && !filtering && !q\s*\?\s*"لا شعبة معتمدة تنتظر الفتح الآن\."/)
  })

  it('⚠️ ونصوصه بلا تشكيل إعرابي — اللغة البيضاء', () => {
    expect(COHORT_LISTS.map((l) => l.label).join(' ')).not.toMatch(/[ً-ِْ]/)
  })
})
