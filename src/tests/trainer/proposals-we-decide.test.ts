/* الدمجُ قرارُنا لا سؤالٌ للمدرّب، وما بُتّ فيه قسمٌ بعنوانه، ووجهةٌ واحدةٌ باسمٍ واحد
   (٣٠ سبتمبر ٢٠٢٦).

   قرارُ صاحب المنصّة على ثلاثِ شاشات:
   ① «دمجٌ أم دورةٌ جديدة؟» في فورم الاقتراح — «هذا نحن نقرّره لا هو»: فلا
      يُسأل عنه المدرّب، ولا يُعرض عليه جوابُه القديم عن سؤالٍ لم يعد يُسأل.
      والإدارةُ تبقى تراه حيث أُجيب عنه.
   ② ما بُتّ فيه من اقتراحاته قسمٌ منفصلٌ بعنوانه، لا مختلطٌ بما ينتظر.
   ③ فراغُ طابور التصحيح: «افتح شعبي وسجّل الحضور» و«جهّز شعبتك» بابٌ واحد
      باسمين — فبقي واحد.

   والفحصُ على البنية بعد نزع التعليقات: فالتعليقُ الذي يروي ما حُذف يذكر
   اسمَه، ولا ينبغي أن يُحسب حضورا. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { proposalDetailRows } from '../../application/trainer/proposal-details'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const MINE = code('src/pages/trainer/MyCourseProposals.tsx')
const QUEUE = code('src/pages/trainer/GradingQueue.tsx')

describe('① الدمجُ قرارُنا', () => {
  it('فورمُ المدرّب لا يسأل عن الدمج ولا عن أقرب دورة', () => {
    expect(MINE, 'عاد سؤالُ الدمج إلى فورم المدرّب').not.toMatch(/PROPOSAL_MERGE|onToggle=\{one\("merge"\)\}/)
    expect(MINE, 'عاد سؤالُ «أقربُ دورةٍ» إلى فورم المدرّب').not.toMatch(/closestCourseAr/)
  })

  it('ولا يرى المدرّبُ جوابَه القديم — والإدارةُ تراه', () => {
    const d = { level: 'beginner' as const, merge: 'yes' as const, closestCourseAr: 'تحليل البيانات' }
    const trainer = proposalDetailRows(d, 'trainer').map((r) => r.labelAr)
    expect(trainer).toEqual(['المستوى'])
    const admin = proposalDetailRows(d).map((r) => r.labelAr)
    expect(admin).toEqual(expect.arrayContaining(['الدمج', 'أقربُ دورةٍ في الكتالوج بقوله']))
    expect(
      [...MINE.matchAll(/proposalDetailRows\(([^)]*)\)/g)].map((m) => m[1]),
      'شاشةُ المدرّب تعرض الأسطرَ بعين الإدارة',
    ).toEqual(['p.details, "trainer"', 'p.details, "trainer"'])
  })
})

describe('② ما بُتّ فيه قسمٌ بعنوانه', () => {
  it('قسمان معنونان، وكلٌّ يعرض نصيبَه', () => {
    expect(MINE).toMatch(/<section aria-labelledby="proposals-open-h"[\s\S]*?\{pending\.map\(card\)\}/)
    expect(MINE).toMatch(/<section aria-labelledby="proposals-decided-h"[\s\S]*?ما بُتّ فيه من اقتراحاتك[\s\S]*?\{decided\.map\(card\)\}/)
    expect(MINE, 'قائمةٌ واحدةٌ تخلط الحالين').not.toMatch(/rows\.map\(/)
  })
})

describe('③ فراغُ طابور التصحيح', () => {
  it('لا وجهتان إلى بابٍ واحد', () => {
    const at = QUEUE.indexOf('وهذه وجهاتٌ تنفع الآن')
    expect(at).toBeGreaterThan(0)
    const block = QUEUE.slice(at, QUEUE.indexOf('</Panel>', at))
    const targets = [...block.matchAll(/<Link to="([^"]+)"/g)].map((m) => m[1])
    expect(targets.length).toBeGreaterThan(0)
    expect(new Set(targets).size, `وجهتان إلى بابٍ واحد: ${targets.join('، ')}`).toBe(targets.length)
  })
})
