/* «مسارٌ عامّ» `/go/BF80` — قاعدتُه في `src/application/commerce/private-path.ts` (٢٢ نوفمبر ٢٠٢٦).

   طلبُ صاحب المنصّة: الدوراتُ الثلاث في رابطٍ عامّ، يدخل صاحبُه أو ينشئ حسابا فيظهر باسمه. ثمّ قرارُه: لا استبدالَ فيه —
   يختار من دوراته الثلاث واحدةً أو أكثر. ثمّ قرارُه في اليوم نفسِه (٢٢ نوفمبر ٢٠٢٦): «اسمح لهم بإضافة دورات، لكن من الدورات
   الباقية في منحة بلاك فرايدي فقط، لا غيرها» — نسخا لـ«لا إضافة».

   ① **الرمزُ يُعرف بأيّ حالةٍ للحروف** — ولا يصطدم برموز المسارات الخاصّة (ثمانيةٌ عشوائيّة).
   ② **ولا استبدالَ فيه** — والمسارُ الخاصّ باقٍ به.
   ③ **والاختيارُ من دوراته وحدَها، واحدةٌ على الأقلّ** — وبترتيب المسار.
   ④ **و«أضف دورة» بما بقي على كوده بعد ما اختار** — ومن أزال واحدةً من الثلاث أفسح لغيرها، وبلا كود منحةٍ لا إضافة.
   ⑤ **والمرشّحون من قائمة بلاك فرايدي وحدَها خارجَ دوراته** — وبلا قائمةٍ لا أحد.
   ⑥ **والصفحة**: «أضف دورة» للعامّ بعدّه ومرشّحيه، والدفعُ بما اختاره وما أضافه، والمضافُ يُحذف — والاستبدالُ ممنوعٌ فيه. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  GO_CODE_LENGTH, PUBLIC_PATHS, isGoCode, pathSwappable, publicPathAddsLeft, publicPathBuyIds, publicPathCandidates,
  publicPathOf, publicPathSelection, restoredPublicPath,
} from '@/application/commerce/private-path'
import { addCandidates, type SwapCohortOption } from '@/application/catalog/pathway-swap'
import { BLACK_FRIDAY_GRANT_SLUG } from '@/application/commerce/grant'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const PAGE = readFileSync(join(root, 'src/pages/PrivatePath.tsx'), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

const THREE = ['C-JOB-104', 'C-MGR-107', 'C-BIZ-107']

describe('① الرمز يعرف بأي حالة للحروف', () => {
  it('⚠️ BF80 بدوراته الثلاث وحملة بلاك فرايدي — وbf80 مثله', () => {
    for (const raw of ['BF80', 'bf80', ' Bf80 ']) {
      const def = publicPathOf(raw)
      expect(def?.code, raw).toBe('BF80')
      expect(def?.courseIds).toEqual(THREE)
      expect(def?.campaign).toBe(BLACK_FRIDAY_GRANT_SLUG)
      expect(isGoCode(raw), raw).toBe(true)
    }
    expect(publicPathOf('BF81')).toBeNull()
    expect(publicPathOf('toString')).toBeNull()
  })

  it('⚠️ ولا يصطدم برموز المسارات الخاصة — كل رمز عام أقصر من ثمانية', () => {
    for (const code of Object.keys(PUBLIC_PATHS)) expect(code.length).toBeLessThan(GO_CODE_LENGTH)
    expect(isGoCode('K6XLRYUF')).toBe(true)
  })
})

describe('② لا استبدال في المسار العام', () => {
  it('⚠️ العام لا يستبدل — والخاص يستبدل', () => {
    expect(pathSwappable(true)).toBe(false)
    expect(pathSwappable(false)).toBe(true)
  })
})

describe('③ الاختيار من دوراته وحدها، واحدة على الأقل', () => {
  it('⚠️ واحدة أو اثنتان أو الثلاث — بترتيب المسار', () => {
    expect(publicPathSelection(THREE, ['C-BIZ-107'])).toEqual(['C-BIZ-107'])
    expect(publicPathSelection(THREE, ['C-BIZ-107', 'C-JOB-104'])).toEqual(['C-JOB-104', 'C-BIZ-107'])
    expect(publicPathSelection(THREE, THREE)).toEqual(THREE)
  })
  it('⚠️ ولا شيء أو دورة من خارجه لا يتابع به', () => {
    expect(publicPathSelection(THREE, [])).toBeNull()
    expect(publicPathSelection(THREE, ['C-JOB-104', 'C-OTHER-1'])).toBeNull()
  })
})

describe('④ «أضف دورة» بما بقي على كوده بعد ما اختار', () => {
  it('⚠️ كود لأربع والثلاث مختارة: يضيف واحدة ثم لا شيء — ومن أزال واحدة أضاف اثنتين', () => {
    /* الخادمُ يقول 1: أربعٌ ناقصا الثلاث */
    expect(publicPathAddsLeft({ coursesLeft: 1, baseCount: 3, selected: 3 })).toBe(1)
    expect(publicPathAddsLeft({ coursesLeft: 1, baseCount: 3, selected: 4 })).toBe(0)
    expect(publicPathAddsLeft({ coursesLeft: 1, baseCount: 3, selected: 2 })).toBe(2)
  })
  it('⚠️ كود بقي عليه دورتان (−1 من الخادم): لا إضافة مع الثلاث، وواحدة إن أزال واحدة', () => {
    expect(publicPathAddsLeft({ coursesLeft: -1, baseCount: 3, selected: 3 })).toBe(0)
    expect(publicPathAddsLeft({ coursesLeft: -1, baseCount: 3, selected: 1 })).toBe(1)
  })
  it('⚠️ بلا كود منحة لا إضافة', () => {
    expect(publicPathAddsLeft({ coursesLeft: null, baseCount: 3, selected: 1 })).toBe(0)
    expect(publicPathAddsLeft({ coursesLeft: undefined, baseCount: 3, selected: 1 })).toBe(0)
  })
  it('⚠️ والدفع بما اختاره من الثلاث بترتيبها ثم ما أضافه — ولا شيء من الثلاث لا يتابع به', () => {
    expect(publicPathBuyIds(THREE, ['C-BIZ-107'], ['C-X-1'])).toEqual(['C-BIZ-107', 'C-X-1'])
    expect(publicPathBuyIds(THREE, THREE, [])).toEqual(THREE)
    expect(publicPathBuyIds(THREE, [], ['C-X-1'])).toBeNull()
  })
  it('⚠️ ومن عاد قبل الدفع يجد ما اختاره وما أضافه — وما يزيد على كوده لا يستعاد', () => {
    expect(restoredPublicPath(['C-JOB-104', 'C-X-1'], THREE, 1)).toEqual({ chosen: ['C-JOB-104'], added: ['C-X-1'] })
    expect(restoredPublicPath(['C-JOB-104', 'C-X-1', 'C-X-2', 'C-X-3', 'C-X-4'], THREE, 1)).toBeNull()
    expect(restoredPublicPath(['C-X-1'], THREE, 1)).toBeNull()
    expect(restoredPublicPath(['C-JOB-104', 'C-X-1'], THREE, null)).toBeNull()
  })
})

describe('⑤ المرشحون من قائمة بلاك فرايدي وحدها خارج دوراته', () => {
  const ranked = ['C-JOB-104', 'C-OUT-1', 'C-BF-1', 'C-BF-2', 'C-MGR-107'].map((courseId) => ({ courseId, reason_ar: 'م' }))
  const grant = [...THREE, 'C-BF-1', 'C-BF-2']
  it('⚠️ ما ليس في القائمة لا يعرض، ولا دورة من الثلاث ولو أزالها', () => {
    expect(publicPathCandidates(ranked, grant, THREE).map((r) => r.courseId)).toEqual(['C-BF-1', 'C-BF-2'])
    expect(publicPathCandidates(ranked, grant, [...THREE, 'C-BF-1']).map((r) => r.courseId)).toEqual(['C-BF-2'])
  })
  it('⚠️ وبلا قائمة لا أحد — لا «كل ما يشترى»', () => {
    expect(publicPathCandidates(ranked, null, THREE)).toEqual([])
  })
  it('⚠️ ومع قاعدة البدائل: ما له شعبة من القائمة وحدها', () => {
    const opts: Record<string, SwapCohortOption[]> = Object.fromEntries(
      ranked.map((r) => [r.courseId, [{ id: `k-${r.courseId}`, startsAt: null, sessions: [] }]]),
    )
    const out = addCandidates({
      courseIds: THREE, ranked: publicPathCandidates(ranked, grant, THREE),
      cohortsOf: (id) => opts[id] ?? [], picked: {}, titleOf: (id) => id, season: null,
    })
    expect(out.map((c) => c.courseId)).toEqual(['C-BF-1', 'C-BF-2'])
  })
})

describe('⑥ الصفحة', () => {
  it('⚠️ «أضف دورة» للعام بعده بعد ما اختار — ومرشحوه من قائمة المنحة', () => {
    expect(PAGE).toMatch(/const addsLeft = isPublic\s*\? publicPathAddsLeft\(\{ coursesLeft: v\.coursesLeft, baseCount: originalIds\.length, selected: buyIds\.length \}\)/)
    expect(PAGE).toMatch(/const ranked = isPublic\s*\? publicPathCandidates\(all, v\.grantCourseIds, courseIds\)/)
    expect(PAGE).toMatch(/\{addsLeft > 0 && \([\s\S]*?data-testid="private-path-add"/)
  })
  it('⚠️ والدفع بما اختاره وما أضافه — والمضاف يحذف من صندوق الاختيار', () => {
    expect(PAGE).toMatch(/const buyIds = isPublic \? publicPathBuyIds\(originalIds, chosen, addedIds\) \?\? \[\] : courseIds;/)
    expect(PAGE).toMatch(/data-testid="public-path-added"[\s\S]*?onClick=\{\(\) => removeAdded\(id\)\}/)
  })
  it('⚠️ ولا استبدال في العام', () => {
    expect(PAGE).toMatch(/edit=\{!pathSwappable\(isPublic\) \? undefined : \{/)
  })
})

/* ═══ ⑦ وبلا حسابٍ يرى كلَّ شيء، والحسابُ عند الدفع (٢٣ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «They should see everything, and once they click to pay, then create account or sign in if they are
   not» — نسخا لصندوق «سجل دخولك» أسفلَ الصفحة وللسعر المخفيّ عن الزائر. */
describe('⑦ الزائر يرى كل شيء، والدخول عند الدفع', () => {
  it('⚠️ السعر والاختيار و«أضف دورة» للزائر — ولا صندوق دخول في آخر الصفحة', () => {
    expect(PAGE).toMatch(/const showPrice = Boolean\(v\.price \|\| changed\) && buyIds\.length > 0;/)
    expect(PAGE).toMatch(/\{isPublic && journeyReady && \(\s*<Card[^>]*data-testid="public-path-pick"/)
    expect(PAGE).not.toMatch(/public-path-sign-in/)
    expect(PAGE).not.toMatch(/سجل دخولك أو أنشئ حسابا<\/Button>/)
    /* و«أضف دورة» لا يشترط الدخول: عدُّه من الخادم وحدَه */
    expect(PAGE).toMatch(/\{addsLeft > 0 && \(/)
  })

  it('⚠️ وكل اختيار للزائر يسعر من الخادم بنسبة الحملة — ومن دخل بكوده', () => {
    expect(PAGE).toMatch(/if \(key === originalKey \|\| !key\) return;/)
    expect(PAGE).toMatch(/\(signIn\s*\? apiPost<PreviewReply>\(`\/api\/public\/go\/\$\{v\.code\}\/preview`, \{ cohortIds: key\.split\(","\) \}\)\s*: apiPost<PreviewReply>\("\/api\/public\/checkout\/preview"/)
  })

  it('⚠️ و«أكمل التسجيل» للزائر: يحفظ اختياره ثم الدخول — ثم لوح الدفع بالاختيار نفسه حين يصل كوده', () => {
    /* يُحفظ ما يشتريه قبل الدخول، بما اختاره وما أضافه */
    expect(PAGE).toMatch(/const buy = \(\) => \{[\s\S]*?savePendingCheckout\(\{[\s\S]*?courseIds: buyIds[\s\S]*?if \(session\) setBuyOpen\(true\);\s*else setAuthOpen\(true\);/)
    /* والدخولُ من AuthGate، ثمّ يُعاد المسارُ بحسابه ويُنتظر كودُه */
    expect(PAGE).toMatch(/<AuthGate[\s\S]*?onDone=\{\(\) => \{\s*setAuthOpen\(false\);\s*if \(signIn\) \{ setPayAfterAuth\(true\); onSignedIn\(\); \} else setBuyOpen\(true\);/)
    expect(PAGE).toMatch(/const buyShown = buyOpen \|\| \(payAfterAuth && !signIn && session !== null\);/)
    expect(PAGE).toMatch(/\{buyShown && \(\s*<BuyPanel[\s\S]*?onClose=\{closeBuy\}/)
    /* والاختيارُ لا يُعاد من الصفر حين يصل المسارُ بكوده: الصفحةُ نفسُها بحالها، لا «يحمّل» بينهما ولا مفتاحٌ يعيد بناءها */
    expect(PAGE).not.toMatch(/<PathPage\s+key=/)
    expect(PAGE).not.toMatch(/setLoaded\(\{ state: "loading" \}\)/)
  })
})
