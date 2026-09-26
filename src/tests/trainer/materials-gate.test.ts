/* لا يُعتمَد مَن لم تُقرأ موادُّه — القاعدةُ نفسُها، لا نسخةٌ في الشاشة وأخرى في الخادم.
 *
 * ── البلاغُ الذي وُلد منه ──
 *
 * صاحبُ المنصّة (٢٦ سبتمبر ٢٠٢٦): «ما وجدتُ بالتجربة أنّك اعتمدتَ المدرّبَ
 * رسميّا عند توقيعي — وهذا خطأ. اعتمدِ العقدَ المشروط وينتقل لمرحلة وضع
 * المواد، وبعد أن يضع المواد كاملا أقول إنّه ١٠٠٪ نشط».
 *
 * وهو عطبٌ شُحن صباحَ ذلك اليوم: زرُّ الختم صار ينادي `decide('activate')`
 * لأيّ عرضٍ مشروطٍ موقَّع، بلا شرطِ أن يكون صاحبُه أعلن اكتمالَ موادّه. فيعمل
 * بعد توقيعه بثانية، ويسقط الطورُ الذي بُني له العرضُ كلُّه.
 *
 * ── وأدقُّ ما يُقاس: أنّ `running` تُمنَع و`under_review` تُجاز ──
 *
 * وهما أقربُ طورَين: كلاهما مهلةٌ قائمةٌ على عقدٍ موقَّع، والفرقُ بينهما
 * **إعلانُ المدرّب** وحدَه (`conditionPausedAt`). فمن خلطهما جعل الحارسَ
 * زينةً تمرّ في الحالة التي وُلد منها البلاغُ بعينها.
 *
 * ── ولمَ تُقاس الرسالةُ لا الحكمُ وحدَه ──
 *
 * الشاشةُ تعرض نصَّها حرفا للموظّف مكانَ الزرّ. ورسالةٌ تقول «لا يُختَم» بلا
 * أن تقول **لماذا ولا ما يُفعَل** تجعله يظنّ العطبَ في النظام لا في الطور.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  materialsGateProblemAr, materialsAreInHand, conditionPhase,
} from '@/application/trainer/conditional-offer'

const DAY = 86_400_000
const NOW = new Date('2026-09-26T12:00:00Z')
const at = (days: number) => new Date(NOW.getTime() + days * DAY)

/** عرضٌ مشروطٌ بمهلةٍ سارية — وما عداه يُشتقّ منه */
const running = {
  orientationAt: at(-10),
  conditionDeadlineAt: at(5),
  conditionPausedAt: null,
  conditionExtendedAt: null,
  conditionMetAt: null,
  now: NOW,
}

describe('الموادُّ تُعرَض قبل الاعتماد لا بعده', () => {
  it('والطورُ يُقرأ كما تقرؤه بقيّةُ المنصّة — وإلّا فالحارسُ يقيس شيئا آخر', () => {
    expect(conditionPhase(running)).toBe('running')
    expect(conditionPhase({ ...running, conditionPausedAt: at(-1) })).toBe('under_review')
    expect(conditionPhase({ ...running, conditionDeadlineAt: at(-1) })).toBe('lapsed')
    expect(conditionPhase({ ...running, conditionDeadlineAt: null })).toBe('none')
  })

  it('يعمل ولم يُعلنْ: يُمنَع — وهي الحالةُ التي وُلد منها البلاغ', () => {
    const problem = materialsGateProblemAr(running)
    expect(problem, 'اعتُمد مَن لم يعرض موادَّه').not.toBeNull()
    expect(problem, 'لا يُقال لماذا').toMatch(/لم يُعلنْ اكتمالَ موادّه/)
    expect(materialsAreInHand(running)).toBe(false)
  })

  it('وتُقال مدّتُه الباقيةُ في الرسالة — فيعرف أينتظر أم يتجاوز', () => {
    expect(materialsGateProblemAr({ ...running, conditionDeadlineAt: at(5) })).toMatch(/5 أيّام/)
    expect(materialsGateProblemAr({ ...running, conditionDeadlineAt: at(1) })).toMatch(/يومٌ واحد/)
    expect(materialsGateProblemAr({ ...running, conditionDeadlineAt: at(2) })).toMatch(/يومان/)
  })

  it('أعلن اكتمالَها: تُجاز — وهي وحدَها', () => {
    /* ═══ ومِحَكُّ الحارس هنا ═══
       `running` و`under_review` أقربُ طورَين: مهلةٌ قائمةٌ على عقدٍ موقَّع
       في كلتيهما، والفرقُ إعلانُ المدرّب وحدَه. */
    const declared = { ...running, conditionPausedAt: at(-1) }
    expect(materialsGateProblemAr(declared), 'مُنع اعتمادُ من صارت موادُّه بين يديك').toBeNull()
    expect(materialsAreInHand(declared)).toBe(true)
  })

  it('انقضت مهلتُه ولم يُعلنْ: يُمنَع، ويُقال المخرجُ', () => {
    const lapsed = { ...running, conditionDeadlineAt: at(-1) }
    expect(materialsGateProblemAr(lapsed)).toMatch(/انقضت مهلتُه/)
    /* ولا يُترك بلا باب: التمديدُ قائم، والإعلانُ يُقبل ولو متأخّرا */
    expect(materialsGateProblemAr(lapsed)).toMatch(/مدِّدْ|اطلبْ/)
  })

  it('وانقضاءٌ مع إعلانٍ متأخّر: يُجاز — فالإعلانُ يُقبل بعد المهلة', () => {
    /* `declareMaterialsComplete` تقبل الإعلانَ ولو انقضت المهلة («من تأخّر
       يوما ثمّ أتمّ موادَّه أولى به أن تُقرأ»). فلو منع الحارسُ هنا لَحُبس
       من أعلن فعلا خلفَ بابٍ لا يفتحه شيء. */
    const lateDeclared = { ...running, conditionDeadlineAt: at(-3), conditionPausedAt: at(-1) }
    expect(conditionPhase(lateDeclared)).toBe('under_review')
    expect(materialsGateProblemAr(lateDeclared)).toBeNull()
  })

  it('وعرضٌ مشروطٌ بلا مهلة: يُجاز — ولا يُحبَس من لا يملك أن يُعلن', () => {
    /* ═══ وهذا ما أوشك أن يُشحَن خطأً ═══

       أوّلُ صياغةٍ منعت هذه الحالةَ فأسقطت ١٢٦ فحصا: المهلةُ تُحسَب من جلسة
       التهيئة وهي **اختياريّةٌ** عند التركيب، فعرضٌ بلا جلسةٍ عرضٌ بلا مهلة.
       وصاحبُه لا يستطيع الإعلانَ أصلا (`openConditionContract` تشترط مهلةً
       قائمة) — فمنعُه حبسٌ أبديٌّ خلف بابٍ لا مفتاحَ له. */
    const none = { ...running, conditionDeadlineAt: null, orientationAt: null }
    expect(conditionPhase(none)).toBe('none')
    expect(materialsGateProblemAr(none), 'حُبس من لا مهلةَ له ولا سبيلَ له إلى الإعلان')
      .toBeNull()
  })

  it('وما اكتمل شرطُه لا يُمنَع — فالحكمُ لا يرتدّ على من مضى', () => {
    const met = { ...running, conditionMetAt: at(-2) }
    expect(materialsGateProblemAr(met)).toBeNull()
  })
})

/* ═══ والشاشةُ تستدعي الحكمَ ولا تنسخه ═══ */
const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const bare = (p: string) => readFileSync(join(root, p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('ولا يُعرَض زرٌّ يردّه الخادم', () => {
  const SCREEN = bare('src/pages/admin/TrainerContracts.tsx')
  const SERVICE = bare('server/services/trainer-review.service.ts')

  it('الخادمُ يمنع في `decide` — لا في زرٍّ واحدٍ من بابَيه', () => {
    /* بابا الاعتماد اثنان: شاشةُ العقود وشاشةُ الطلبات، وكلاهما يمرّ من
       `decide`. فحارسٌ في `countersignContract` وحدَها يترك الثانيَ مفتوحا. */
    const at = SERVICE.indexOf('async decide(')
    const body = SERVICE.slice(at, SERVICE.indexOf('\n  async ', at + 1))
    expect(body, 'بوّابةُ الموادّ ليست في `decide` — فبابُ شاشة الطلبات مفتوح')
      .toMatch(/materialsGateProblemAr\(/)
    expect(body, 'تُقرأ البوّابةُ على غير العرض المشروط الموقَّع المفتوح')
      .toMatch(/gatesActivation: true, status: 'signed', conditionMetAt: null/)
  })

  it('والردُّ برمزٍ يُقرأ لا برسالةٍ تُطابَق نصّا', () => {
    const at = SERVICE.indexOf('materialsGateProblemAr(')
    expect(SERVICE.slice(at, at + 900)).toMatch(/'materials_pending'/)
  })

  it('والشاشةُ تنادي الحكمَ نفسَه بدل أن تكتب شرطا ثانيا', () => {
    expect(SCREEN, 'الشاشةُ لا تقرأ بوّابةَ الموادّ — فتعرض زرّا يُردّ')
      .toMatch(/materialsGateProblemAr\(conditionFactsOf\(c\)\)/)
    expect(SCREEN, 'بقي شرطُ الطور منسوخا في الشاشة بدل استدعاء الحكم')
      .not.toMatch(/conditionPhase\(conditionFactsOf\(c\)\) === "under_review"/)
  })

  it('وزرُّ الختم لا يُعرَض على عرضٍ مشروطٍ لم تُعرَض موادُّه', () => {
    const at = SCREEN.indexOf('c.gatesActivation && materialsGateProblemAr')
    expect(at, 'زرُّ الختم بلا شرطِ موادّ').toBeGreaterThan(0)
    const block = SCREEN.slice(at, at + 1400)
    /* والسببُ يُقال مكانَه: زرٌّ غائبٌ بلا تفسيرٍ يُقرأ عطبا في النظام */
    expect(block, 'يُمنع الزرُّ صامتا').toMatch(/لا يُختَم بعد/)
    /* وهو معروضٌ على غير المشروط كما كان */
    expect(block, 'حُجب الزرُّ عن العقد غير المشروط').toMatch(/طابقتُ الاسمَ/)
  })
})
