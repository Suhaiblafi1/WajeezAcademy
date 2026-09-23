/* شريطُ العرض المشروط في بوّابة المدرّب — الطريقُ من الشرط إلى زرٍّ يُضغَط.
 *
 * ── ما كان ناقصا ──
 *
 * `conditional-offer.ts` يحسب الطورَ والأيّامَ والسطرَ المقروء، والخادمُ
 * يقبل «أعلنتُ اكتمالها» و«امنحني يومين» منذ #271 — ولا شيءَ في بوّابته
 * يعرض الأوّلَ ولا يضغط الثاني. فمهلةٌ تسير على إنسانٍ لا يراها، ومخرجٌ
 * مفتوحٌ له لا يبلغه إلّا بـ`curl`.
 *
 * ── وأخطرُ ما يحرسه هذا الملفّ ──
 *
 * أنّ الشريطَ لا يُعلَّق على الطور وحدَه: `conditionPhase` يردّ `none` لمن
 * لا أعمدةَ شرطٍ في عقده — وهم مدرّبو المنصّة كلُّهم قبل هذا الطور. فشريطٌ
 * يقرأ الطورَ ولا يسأل «أله شرطٌ قائمٌ أصلا» يُعلن على كلِّ مدرّبٍ نشطٍ
 * منذ سنةٍ أنّ عرضَه مشروطٌ وأنّ موعدَ جلسته سيصله.
 *
 * والفحصُ على البنية: من أين يأتي السطر، وأيّ شرطٍ يُعلَّق عليه الظهور،
 * وهل يطابق ما يقبله الخادمُ فعلا.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MATERIALS_WINDOW_DAYS, EXTENSION_DAYS,
  conditionPhase, extendProblemAr, hasOpenCondition, canAskExtension, canDeclareMaterials,
} from '@/application/trainer/conditional-offer'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const strip = readFileSync(join(root, 'src/components/ConditionStrip.tsx'), 'utf8')
const layout = readFileSync(join(root, 'src/pages/trainer/TrainerLayout.tsx'), 'utf8')
const route = readFileSync(join(root, 'server/http/routes/trainer-portal.routes.ts'), 'utf8')
const service = readFileSync(join(root, 'server/services/trainer-review.service.ts'), 'utf8')

const DAY = 86_400_000
const NOW = new Date('2026-10-08T09:00:00Z')
const running = { conditionDeadlineAt: new Date(NOW.getTime() + 3 * DAY), now: NOW }
const lapsed = { conditionDeadlineAt: new Date(NOW.getTime() - 3 * DAY), now: NOW }

describe('أله شرطٌ قائمٌ أصلا — سؤالٌ قبل الطور', () => {
  it('الأطوارُ الثلاثةُ الحيّةُ تُظهر الشريط', () => {
    expect(hasOpenCondition(running)).toBe(true)
    expect(hasOpenCondition({ ...running, conditionPausedAt: NOW })).toBe(true)
    expect(hasOpenCondition(lapsed)).toBe(true)
  })

  /* الحارسُ الذي وُلد منه هذا الملفّ: مدرّبٌ نشطٌ منذ سنةٍ عقدُه بلا أعمدةِ
     شرط. طورُه `none` — فلو عُلّق الشريطُ على الطورِ وحدَه لقرأه هو أيضا. */
  it('ومن لا عمودَ شرطٍ في عقده لا شريطَ له — وهم مدرّبو المنصّة كلُّهم', () => {
    const veteran = { now: NOW }
    expect(conditionPhase(veteran)).toBe('none')
    expect(hasOpenCondition(veteran)).toBe(false)
  })

  it('ومن اعتُمدت موادُّه انتهى شرطُه فلا شريط', () => {
    expect(hasOpenCondition({ ...running, conditionMetAt: NOW })).toBe(false)
  })

  /* وشرطُ الظهور هو بعينه شرطُ الخادم — ولو افترقا لظهر زرٌّ يُردّ بـ«لا
     مهلةَ قائمةً على حسابك»، أو اختفى زرٌّ يقبله الخادم. */
  it('ويطابق شرطَ `openConditionContract` في الخادم حرفا بحرف', () => {
    expect(service).toMatch(/conditionDeadlineAt: \{ not: null \}, conditionMetAt: null/)
  })
})

describe('زرُّ التمديد أضيقُ من قبول الخادم بقصد', () => {
  it('يُعرض لمن مهلتُه تسير ولم يُمدَّد له', () => {
    expect(canAskExtension(running)).toBe(true)
  })

  /* والضيقُ حقيقيٌّ لا مصادفة: الخادمُ يقبل تمديدَ المنقضية (لا مانعَ في
     `extendProblemAr`)، لكنّه يزيدها على تاريخها هي فتبقى منقضية. */
  it('ولا يُعرض للمنقضية — والخادمُ يقبلها، فالضيقُ منّا لا منه', () => {
    expect(extendProblemAr(lapsed)).toBeNull()
    expect(canAskExtension(lapsed)).toBe(false)
  })

  it('ولا لمن مُنح التمديدَ مرّةً', () => {
    const once = { ...running, conditionExtendedAt: new Date(NOW.getTime() - DAY) }
    expect(canAskExtension(once)).toBe(false)
  })

  it('ولا للمجمَّدة — موادُّه عندنا، والمهلةُ واقفةٌ أصلا', () => {
    expect(canAskExtension({ ...running, conditionPausedAt: NOW })).toBe(false)
  })
})

describe('زرُّ «أعلنتُ اكتمالها» يطابق ما يقبله الخادم', () => {
  it('يُعرَض لمن مهلتُه تسير', () => {
    expect(canDeclareMaterials(running)).toBe(true)
  })

  /* والمنقضيةُ منها بقصد: الخادمُ يقبلها متأخّرةً بنصّه — وزرٌّ
     يختفي عن من تأخّر يوما يغلق بابا فتحه الخادمُ بيده. */
  it('وللمنقضية أيضا — فالخادمُ يقبلها متأخّرة', () => {
    expect(canDeclareMaterials(lapsed)).toBe(true)
    expect(service).toMatch(/phase !== 'running' && phase !== 'lapsed'/)
  })

  it('ولا يُعرَض لمن أعلن أصلا — والخادمُ يردّه بـ`already_declared`', () => {
    expect(canDeclareMaterials({ ...running, conditionPausedAt: NOW })).toBe(false)
    expect(service).toMatch(/already_declared/)
  })

  it('والشريطُ يعلّق الزرّ عليه لا على ظنّ', () => {
    expect(strip).toMatch(/canDeclareMaterials\(/)
  })

  /* والإعلانُ لا رجعةَ فيه: يجمّد المهلةَ ويوقظ الطابور، والثانيةُ
     تُرَدّ. فنقرةٌ واحدةٌ تُنفِذُه ليست إنصافا لمن لمّا يرفع مادّتَه الأخيرة. */
  it('وله تأكيدٌ يقول ماذا سيحدث — لا نقرةٌ تُنفِذ', () => {
    /* والفحصُ على **الطريق** لا على ورودِ اسمٍ: الإعلانُ لا يُنادى
       إلّا من `onConfirm`، وزرُّ الشريط يفتح السؤالَ لا ينفِذ. */
    expect(strip).toMatch(/onConfirm=\{\(\) => void declare\(\)\}/)
    expect(strip, 'زرٌّ يُعلن بنقرةٍ واحدةٍ بلا تأكيد').not.toMatch(/onClick=\{\(\) => void declare\(\)\}/)
    expect(strip).not.toMatch(/window\.confirm/)
  })
})

describe('الشريطُ يقرأ ولا يكتب حسابا', () => {
  it('سطرُه من `conditionLineAr` لا من نصٍّ مكتوبٍ فيه', () => {
    /* نسختان لسطرٍ واحدٍ تفترقان: تُصلَح الأيّامُ في وحدةٍ ويبقى الشريطُ
       يقول «سبعة» لمن أمامه يومان. */
    expect(strip).toMatch(/conditionLineAr\(/)
    expect(strip).not.toMatch(/أمامك .* لرفع موادّك/)
  })

  it('وظهورُه معلَّقٌ على `hasOpenCondition` لا على الطور', () => {
    expect(strip).toMatch(/hasOpenCondition\(/)
  })

  it('وزرُّ التمديد على `canAskExtension`', () => {
    expect(strip).toMatch(/canAskExtension\(/)
  })

  it('ولا يحسب الأيّامَ بيده', () => {
    expect(strip).not.toMatch(/86_?400_?000|24 \* 60 \* 60/)
  })
})

describe('الزرّان يبلغان الخادمَ الذي يقبلهما', () => {
  it('«أعلنتُ اكتمالها» إلى مسارها', () => {
    expect(strip).toMatch(/"\/api\/trainer\/condition\/declare-complete"/)
    expect(route).toMatch(/'\/api\/trainer\/condition\/declare-complete'/)
  })

  it('و«امنحني يومين» إلى مسارها', () => {
    expect(strip).toMatch(/"\/api\/trainer\/condition\/extend"/)
    expect(route).toMatch(/'\/api\/trainer\/condition\/extend'/)
  })

  /* وردُّ الخادم يُقرأ لا يُبتلع: «مُنح التمديدَ مرّةً» نصٌّ كُتب ليُقرأ. */
  it('وكلُّ ردٍّ من الخادم يُقرأ بنصّه — لا واحدٌ يُقرأ وآخرُ يُبتلع', () => {
    /* «مُنح التمديدَ مرّةً ولا يُمنح ثانية» نصٌّ كُتب ليُقرأ. وعدٌّ لا
       ورودٌ: موضعٌ واحدٌ يقرأ والثاني يبتلع يُمرّر فحصَ الورود. */
    const caught = (strip.match(/catch \(e\) \{/g) ?? []).length
    const read = (strip.match(/permissionMessage\(e, /g) ?? []).length
    expect(caught).toBeGreaterThan(0)
    expect(read, 'ردٌّ من الخادم يُلتقط ولا يُعرَض نصُّه').toBe(caught)
  })
})

describe('وما ينقصه يُقرأ من مهامّه لا من ظنٍّ', () => {
  it('المهامُّ غيرُ المنجَزةِ وحدَها — والمنجَزةُ لا تُعاد عليه', () => {
    expect(strip).toMatch(/\.filter\(\(t\) => !t\.doneAt\)/)
  })

  it('ومصدرُها مهامُّ ملفّه من الخادم لا قائمةٌ مكتوبةٌ في الواجهة', () => {
    expect(layout).toMatch(/tasks=\{me\?\.onboardingTasks\}/)
    expect(route).toMatch(/onboardingTasks: true/)
  })
})

describe('الطريقُ من الخادم إلى الشريط', () => {
  it('أعمدةُ الشرط تخرج في `/api/trainer/me` — وبلا ذلك لا يقرأ الشريطُ شيئا', () => {
    const select = route.slice(route.indexOf('contracts: {'), route.indexOf('pendingGrading'))
    for (const col of ['conditionDeadlineAt', 'conditionPausedAt', 'conditionExtendedAt', 'conditionMetAt']) {
      expect(select, `عمودُ ${col} لا يخرج من انتقاء العقد`).toMatch(new RegExp(`${col}: true`))
    }
  })

  it('والإطارُ يمرّر العقدَ إلى الشريط', () => {
    expect(layout).toMatch(/<ConditionStrip/)
    expect(layout).toMatch(/contracts\?/)
  })

  /* والشريطُ في الإطار لا في صفحةٍ واحدة: المهلةُ تسير على المدرّب في كلّ
     شاشةٍ يفتحها، لا في «الرئيسية» وحدَها. */
  it('وموضعُه الإطارُ فيُرى في كلّ شاشة', () => {
    expect(layout).toMatch(/^import ConditionStrip[,ز ]/m)
  })

  it('ولا طلبَ ثانٍ له — العقدُ في النداء الذي يجلب عدّادَ التصحيح', () => {
    const calls = layout.match(/apiGet</g) ?? []
    expect(calls.length, 'نداءٌ ثانٍ لـ`/api/trainer/me` في الإطار نفسِه').toBe(1)
  })
})

describe('الثوابتُ تُقرأ من موضعها', () => {
  it('لا يُكتب «٧» ولا «يومان» رقما في الشريط', () => {
    expect(MATERIALS_WINDOW_DAYS).toBe(7)
    expect(EXTENSION_DAYS).toBe(2)
    expect(strip).not.toMatch(/\b7 (أيّام|ايام)\b/)
  })
})
