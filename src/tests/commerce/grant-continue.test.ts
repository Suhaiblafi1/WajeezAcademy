/* «دورةٌ واحدةٌ أوّلا، والكودُ يبقى لباقي المسار» — شاشةُ الشكر بعد الدفع (صاحب المنصّة، ١٣ نوفمبر ٢٠٢٦).

   «أرى الناس تستصعب شراء أربع دورات». فبعد الدفع يُقال ما بقي على كوده وحتى متى، وما يلي ما اشتراه في مساره ممّا يُشترى
   الآن — وكلٌّ إلى صفحة دورته. والجملةُ نفسُها في بريد الدفع وتذكير ما قبل النهاية (`server/tests/commerce/grant-followup.test.ts` ⑩). */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { boughtCourseIds, nextInPath } from '@/application/commerce/grant-next'
import { GRANT_CONTINUE_AR, grantCoursesAr, grantLeftLineAr } from '@/application/commerce/grant'
import { plainAr } from '@/application/text/plain-ar'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ')

const PATHS = [{ courseIds: ['A1', 'A2', 'A3', 'A4'] }, { courseIds: ['B1', 'B2'] }]
const all = () => true

describe('ما يلي ما اشتراه في مساره', () => {
  it('⚠️ بترتيب المسار مما بعده ثم ما قبله — بلا ما اشتراه، وحتى اثنتين', () => {
    expect(nextInPath(['A2'], PATHS, all)).toEqual(['A3', 'A4'])
    expect(nextInPath(['A4'], PATHS, all), 'لا يعود إلى أول المسار').toEqual(['A1', 'A2'])
    expect(nextInPath(['A2', 'A3'], PATHS, all), 'اقترح ما اشتراه').toEqual(['A4', 'A1'])
  })

  it('⚠️ ومما يشترى الآن وحده — وبلا مسار لا اقتراح', () => {
    expect(nextInPath(['A1'], PATHS, (id) => id !== 'A2')).toEqual(['A3', 'A4'])
    expect(nextInPath(['Z9'], PATHS, all)).toEqual([])
    expect(nextInPath(['B1'], PATHS, (id) => id !== 'B2'), 'اقترح ما لا يشترى').toEqual([])
  })

  it('ودورات الطلب: بند الدورة بمعرفه، وبند الشعبة بدورتها — وما لا يعرف يسقط', () => {
    const ofCohort = (id: string) => ({ C1: 'A1', C2: 'B1' } as Record<string, string>)[id]
    expect(boughtCourseIds([{ kind: 'cohort', refId: 'C1' }, { kind: 'course', refId: 'A3' }, { kind: 'cohort', refId: 'C9' }, { kind: 'cohort', refId: 'C1' }], ofCohort))
      .toEqual(['A1', 'A3'])
  })
})

describe('جملة ما بقي على الكود', () => {
  it('⚠️ عدد ونسبة وآخر يوم بتوقيت عمان — وبلا تشكيل', () => {
    /* النهايةُ تحفظ أول اليوم الذي بعدها: منتصفُ ليل ١ ديسمبر بعمان = آخر يوم ٣٠ نوفمبر */
    expect(grantLeftLineAr(3, 50, '2026-11-30T21:00:00.000Z')).toBe('بقي لك على كود منحتك 3 دورات بخصم 50٪ حتى 30 نوفمبر 2026.')
    expect(grantLeftLineAr(1, 45, null)).toBe('بقي لك على كود منحتك دورة واحدة بخصم 45٪.')
    expect(grantCoursesAr(2)).toBe('دورتان')
    for (const t of [grantLeftLineAr(2, 50, null), GRANT_CONTINUE_AR]) expect(t).toBe(plainAr(t))
  })
})

describe('شاشة الشكر بعد الدفع', () => {
  const J = code('src/pages/student/Journey.tsx')

  it('⚠️ تقول ما بقي على كوده وما يلي في مساره — حين يبقى عليه شيء وحده', () => {
    const at = J.indexOf('شكرا لك — عدنا بك إلى رحلتك')
    const block = J.slice(at, J.indexOf('تظهر مراحلك أدناه', at))
    expect(block, 'لا يقال ما بقي على الكود في الشكر').toMatch(/\{paid && grant\?\.code && \(grant\.left \?\? 0\) > 0 && \(/)
    expect(block).toMatch(/grantLeftLineAr\(grant\.left \?\? 0, grant\.percentOff \?\? 0, grant\.closesAt\)/)
    expect(block, 'الدورات التالية لا تصل صفحاتها').toMatch(/<Link to=\{`\/build\/\$\{c\.id\}`\}/)
    expect(block, 'الزر لا يصل الدورة التالية أو الدورات').toMatch(/to=\{nextCourses\[0\] \? `\/build\/\$\{nextCourses\[0\]\.id\}` : "\/courses"\}/)
    expect(block).toContain('{GRANT_CONTINUE_AR}')
    expect(J, 'التالية ليست من مسار ما اشتراه أو مما يشترى الآن').toMatch(/nextInPath\(boughtCourseIds\(paid\.items, courseOfCohort\), publicPathways, \(id\) => availableThisSeason\(id, listed\) === true\)/)
  })
})
