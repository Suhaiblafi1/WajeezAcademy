/* «أضف دورة» في المسار الخاصّ بما بقي على الكود، والبدائلُ من دورات صفحة المنحة (٢١ نوفمبر ٢٠٢٦).

   قرارا صاحب المنصّة: «Allow adding» — يضيف حتّى حدّ كود منحته ويختفي الزرُّ عنده، ويحذف ما أضافه وحدَه، وبلا كود منحةٍ
   لا إضافة. و«Only Black Friday courses» — بدائلُ «استبدالها» و«أضف دورة» من قائمة حملة الكود وحدَها، وبلا كود منحةٍ كلُّ ما
   يُشترى. والعددُ والقائمةُ من الخادم (`server/tests/commerce/private-path.test.ts`)، وهنا القاعدةُ والصفحة. والفحصُ على البنية
   والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  pathAddsLeft, pathAddsLeftAr, pathCandidatesWithin, pathCourseRemovable, restoredPathCourses,
} from '@/application/commerce/private-path'
import { addCandidates, type SwapCohortOption } from '@/application/catalog/pathway-swap'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/PrivatePath.tsx')
const JOURNEY = code('src/components/CourseJourney.tsx')

describe('كم دورة يضيف (pathAddsLeft)', () => {
  it('⚠️ مسار بدورتين على كود لأربع: يضيف دورتين، ثم واحدة، ثم لا شيء', () => {
    /* الخادمُ يقول 2: أربعٌ ناقصا دورتي المسار */
    expect(pathAddsLeft({ coursesLeft: 2, baseCount: 2, current: 2 })).toBe(2)
    expect(pathAddsLeft({ coursesLeft: 2, baseCount: 2, current: 3 })).toBe(1)
    expect(pathAddsLeft({ coursesLeft: 2, baseCount: 2, current: 4 })).toBe(0)
    expect(pathAddsLeft({ coursesLeft: 2, baseCount: 2, current: 5 })).toBe(0)
  })
  it('⚠️ بلا كود منحة لا إضافة — ولا بسعرها الكامل', () => {
    expect(pathAddsLeft({ coursesLeft: null, baseCount: 2, current: 2 })).toBe(0)
    expect(pathAddsLeft({ coursesLeft: undefined, baseCount: 2, current: 2 })).toBe(0)
    expect(pathAddsLeft({ coursesLeft: 0, baseCount: 2, current: 2 })).toBe(0)
  })
  it('السطر فوق الزر', () => {
    expect(pathAddsLeftAr(1)).toBe('تضيف حتى دورة واحدة بالكود نفسه')
    expect(pathAddsLeftAr(2)).toBe('تضيف حتى دورتين بالكود نفسه')
    expect(pathAddsLeftAr(3)).toBe('تضيف حتى 3 دورات بالكود نفسه')
  })
})

describe('ما يحذف وما يستعاد', () => {
  it('⚠️ المضاف وحده يحذف — دورات المستشار تستبدل ولا تحذف', () => {
    expect(pathCourseRemovable(0, 2)).toBe(false)
    expect(pathCourseRemovable(1, 2)).toBe(false)
    expect(pathCourseRemovable(2, 2)).toBe(true)
  })
  it('⚠️ من خرج وعاد يجد ما أضافه في حده — وما فوق الحد أو أقل من المسار لا يستعاد', () => {
    expect(restoredPathCourses(['a', 'b', 'x'], 2, 2)).toEqual(['a', 'b', 'x'])
    expect(restoredPathCourses(['a', 'b'], 2, null)).toEqual(['a', 'b'])
    expect(restoredPathCourses(['a', 'b', 'x'], 2, null)).toBeNull()
    expect(restoredPathCourses(['a', 'b', 'x', 'y', 'z'], 2, 2)).toBeNull()
    expect(restoredPathCourses(['a'], 2, 2)).toBeNull()
    expect(restoredPathCourses(['a', 'a', 'x'], 2, 2)).toBeNull()
    expect(restoredPathCourses(undefined, 2, 2)).toBeNull()
  })
})

describe('البدائل من دورات صفحة المنحة وحدها (pathCandidatesWithin)', () => {
  const ranked = [
    { courseId: 'near', reason_ar: 'ق' }, { courseId: 'bf', reason_ar: 'ب' },
    { courseId: 'other', reason_ar: 'غ' }, { courseId: 'bf2', reason_ar: 'ب' },
  ]
  it('⚠️ بقائمة المنحة: ما فيها وحده، بترتيبه', () => {
    expect(pathCandidatesWithin(ranked, ['bf2', 'bf']).map((r) => r.courseId)).toEqual(['bf', 'bf2'])
    expect(pathCandidatesWithin(ranked, [])).toEqual([])
  })
  it('⚠️ بلا كود منحة: كل ما يشترى كما كان', () => {
    expect(pathCandidatesWithin(ranked, null)).toEqual(ranked)
    expect(pathCandidatesWithin(ranked, undefined)).toEqual(ranked)
  })
  it('والإضافة بقاعدة البدائل: خارج المسار، وما لا يتعارض أولا', () => {
    const on = (day: number) => ({ startsAt: `2026-12-0${day}T17:00:00Z`, endsAt: `2026-12-0${day}T19:00:00Z` })
    const opts: Record<string, SwapCohortOption[]> = {
      a: [{ id: 'ca', startsAt: '2026-12-01T17:00:00Z', sessions: [on(1)] }],
      clash: [{ id: 'cc', startsAt: '2026-12-01T17:00:00Z', sessions: [on(1)] }],
      free: [{ id: 'cf', startsAt: '2026-12-02T17:00:00Z', sessions: [on(2)] }],
    }
    const out = addCandidates({
      courseIds: ['a'],
      ranked: [{ courseId: 'a', reason_ar: 'م' }, { courseId: 'clash', reason_ar: 'م' }, { courseId: 'free', reason_ar: 'م' }],
      cohortsOf: (id) => opts[id] ?? [], picked: {}, titleOf: (id) => id, season: null,
    })
    expect(out.map((c) => [c.courseId, c.fit])).toEqual([['free', 'free'], ['clash', 'clash']])
  })
})

describe('الصفحة', () => {
  it('⚠️ «أضف دورة» يظهر ما دام على الكود دورات — بعدد الخادم — ويختفي عند الحد', () => {
    /* والمسارُ العامّ بعدّه هو (٢٢ نوفمبر ٢٠٢٦، `publicPathAddsLeft` — `public-path.test.ts`) */
    expect(PAGE).toMatch(/: pathAddsLeft\(\{ coursesLeft: v\.coursesLeft, baseCount: originalIds\.length, current: courseIds\.length \}\);/)
    expect(PAGE).toMatch(/\{addsLeft > 0 && \([\s\S]*?data-testid="private-path-add"[\s\S]*?أضف دورة/)
    expect(PAGE).toMatch(/addCandidates\(\{/)
  })
  it('⚠️ والمضاف وحده يحذف — والرحلة تعرض «حذفها» له في وضع الاستبدال', () => {
    expect(PAGE).toMatch(/const removableIds = courseIds\.filter\(\(_, i\) => pathCourseRemovable\(i, originalIds\.length\)\)/)
    expect(PAGE).toMatch(/onRemove: \(id\) => \{\s*if \(!removableIds\.includes\(id\)\) return;/)
    expect(JOURNEY).toMatch(/\(!edit\.swapOnly \|\| edit\.removableIds\?\.includes\(c\.id\)\) && \(/)
  })
  it('⚠️ البدائل والإضافة كلاهما من قائمة المنحة', () => {
    expect(PAGE.match(/pathCandidatesWithin\(/g)?.length, 'الاستبدال أو الإضافة بلا قائمة المنحة').toBe(2)
    expect(PAGE.match(/pathCandidatesWithin\([^;]*?v\.grantCourseIds,?\s*\);/g)?.length).toBe(2)
  })
  it('⚠️ والمضاف يصل لوح الدفع والشراء المحفوظ — بدورات الصفحة كما هي الآن', () => {
    /* وما يُشترى سلّةُ الصفحة الآن: دوراتُها في المسار الخاصّ، وما اختاره من الثلاث وما أضافه في العامّ (٢٢ نوفمبر ٢٠٢٦) */
    expect(PAGE).toMatch(/const buyIds = isPublic \? publicPathBuyIds\(originalIds, chosen, addedIds\) \?\? \[\] : courseIds;/)
    expect(PAGE).toMatch(/intent: \{ title: headline\.titleAr, amount: [^}]*kind: "courses", courseIds: buyIds \}/)
    expect(PAGE).toMatch(/restoredPathCourses\(resumed\?\.intent\.courseIds, originalIds\.length, v\.coursesLeft\)/)
  })
})
