/* صفحةُ الشعب (١٢ أكتوبر ٢٠٢٦) — طلبان من صاحب المنصّة في رسالةٍ واحدة:

   ① «لماذا لا يمكن فتح الشعبة…؟ أهناك خطأ» — حُفظت السعةُ والسعر في «التسجيل والمال» فصار
      الرأسُ «0/25 مقعدا · 170 USD»، وبقيت شاراتُ «شروط الفتح» «لا سعة محددة» لأنّها لا تُعاد بعد
      الحفظ. فما يُحفظ في ألسنة البطاقة يُعيد شروطَ الفتح معه.
   ② «أريد تاب خاصّة للدورات التي تكون معتمدة» — لسانٌ في رأس القائمة، وشرطُه شرطُ الشارة نفسِها.

   والفحصُ على الشيفرة بلا تعليقاتها: حارسٌ طابق جملةً في تعليقٍ مرّ أخضرَ لسببٍ خاطئ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { awaitsOpening, cohortNextStep, COHORT_LISTS, inCohortList } from '@/pages/admin/cohort-lists'

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
    expect(COHORT_LISTS.map((l) => l.id)).toEqual(['all', 'upcoming', 'approved'])
    expect(inCohortList('all', { status: 'open', trainerPlanApproved: false })).toBe(true)
    expect(inCohortList('approved', { status: 'open', trainerPlanApproved: true })).toBe(false)
    expect(inCohortList('approved', draft)).toBe(true)
  })

  it('⚠️ والقائمة تصفى باللسان قبل الفلاتر — والشارة واللسان شرط واحد', () => {
    expect(page).toMatch(/const filtered = rows\.filter\(\(c\) => \{\s*if \(!inCohortList\(list, c\)\) return false;/)
    /* والشارةُ صارت شارةَ «ما تحتاجه» الواحدة (٢٠ أكتوبر ٢٠٢٦) — وتسمّي المعتمَدةَ باسم لسانها */
    expect(page).toMatch(/const next = cohortNextStep\(c\);/)
    expect(cohortNextStep({ ...draft, trainers: [{}] })?.label).toBe(COHORT_LISTS.find((l) => l.id === 'approved')!.label)
    expect(page).not.toMatch(/c\.status === "draft" && c\.trainerPlanApproved/)
  })

  it('⚠️ والشريط بعدد كل لسان، والتبديل يعود إلى الصفحة الأولى', () => {
    expect(page).toMatch(/<TabBar className="mb-4" ariaLabel="قوائم الشعب" value=\{list\}\s*onChange=\{\(next\) => \{ setList\(next\); setPage\(1\); \}\}/)
    /* و«تبدأ قريبا» لمن يرى المال وحدَه (٢٢ أكتوبر ٢٠٢٦) */
    expect(page).toMatch(/items=\{COHORT_LISTS\.filter\(\(l\) => seesMoney \|\| l\.id !== "upcoming"\)\.map\(\(l\) => \(\{ id: l\.id, label: `\$\{l\.label\} \(\$\{rows\.filter\(\(c\) => inCohortList\(l\.id, c\)\)\.length\}\)` \}\)\)\}/)
  })

  it('واللسان الفارغ يقول إنه لا شيء ينتظر — لا «وسع الفلاتر»', () => {
    expect(page).toMatch(/list === "approved" && !filtering && !q\s*\?\s*"لا شعبة معتمدة تنتظر الفتح الآن\."/)
  })

  it('⚠️ ونصوصه بلا تشكيل إعرابي — اللغة البيضاء', () => {
    expect(COHORT_LISTS.map((l) => l.label).join(' ')).not.toMatch(/[ً-ِْ]/)
  })
})

/* ═══ ③ شارةٌ واحدةٌ تقول ما تحتاجه الشعبة (٢٠ أكتوبر ٢٠٢٦) ═══
   «لا أميّز بين دوراتٍ لها مدرّبٌ ودوراتٍ لا مدرّبَ لها ودوراتٍ مدرّبوها موقوفون» (صاحب المنصّة). */
describe('③ ما تحتاجه الشعبة', () => {
  const base = { status: 'draft', trainerPlanApproved: false, trainerPlanStatus: null as string | null, trainers: [{ suspended: false }] }
  it('بلا مدرب، ثم مدرب موقوف، ثم خطة — بترتيب ما يوقفها', () => {
    expect(cohortNextStep({ ...base, trainers: [] })?.label).toBe('بلا مدرب')
    expect(cohortNextStep({ ...base, trainers: [{ suspended: true }] })?.label).toBe('مدربها موقوف')
    expect(cohortNextStep({ ...base, trainerPlanStatus: 'submitted' })?.label).toBe('خطة تنتظر مراجعتك')
    expect(cohortNextStep(base)?.label).toBe('تنتظر خطة المدرب')
  })
  it('والمفتوحة بلا خطة معتمدة تقال مخفية — والمنتهية لا تحتاج شيئا', () => {
    expect(cohortNextStep({ ...base, status: 'open', trainers: [] })?.label).toBe('بلا مدرب — مخفية عن الموقع')
    expect(cohortNextStep({ ...base, status: 'completed', trainers: [] })).toBeNull()
    expect(cohortNextStep({ ...base, status: 'open', trainerPlanApproved: true })).toBeNull()
  })
})

describe('④ أدوات التقييم مطوية', () => {
  it('الروبرك وقواعد الإكمال تحت عنوان يفتح حين يطلب — لا مفتوحة تحت القائمة', () => {
    expect(page).toMatch(/<details className="mt-8">\s*<summary[^>]*>أدوات التقييم والشهادة[^<]*<\/summary>\s*<LearningSettings/)
  })
})

/* ═══ ⑤ «تبدأ قريبا» (٢٢ أكتوبر ٢٠٢٦) ═══
   «كيف أعلم أيّ الدورات قريبة وكم فيها تسجيل لأقرّر إيقافها؟» (صاحب المنصّة). */
describe('⑤ تبدأ قريبا', () => {
  const now = new Date('2026-10-22T10:00:00Z')
  const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString()
  const base = { trainerPlanApproved: true }

  it('⚠️ ما لم يبدأ وأول لقاء فيه خلال المدى — لا ما مضى ولا ما بدأ ولا ما بلا موعد', () => {
    expect(inCohortList('upcoming', { ...base, status: 'open', firstAt: inDays(5) }, now)).toBe(true)
    expect(inCohortList('upcoming', { ...base, status: 'draft', firstAt: inDays(30) }, now)).toBe(true)
    expect(inCohortList('upcoming', { ...base, status: 'open', firstAt: inDays(-1) }, now)).toBe(false)
    expect(inCohortList('upcoming', { ...base, status: 'active', firstAt: inDays(5) }, now)).toBe(false)
    expect(inCohortList('upcoming', { ...base, status: 'cancelled', firstAt: inDays(5) }, now)).toBe(false)
    expect(inCohortList('upcoming', { ...base, status: 'open', firstAt: null }, now)).toBe(false)
    expect(inCohortList('upcoming', { ...base, status: 'open', firstAt: inDays(90) }, now)).toBe(false)
  })

  it('⚠️ ولسانه يعرض قائمته لا البطاقات — وفيها المال والإلغاء', () => {
    expect(page).toMatch(/!loading && list === "upcoming" \? \(\s*<UpcomingCohorts/)
    const list = code('src/components/admin/UpcomingCohorts.tsx')
    expect(list).toMatch(/apiGet<UpcomingRow\[\]>\(`\/api\/admin\/cohorts\/upcoming\?days=\$\{UPCOMING_MAX_DAYS\}`\)/)
    expect(list).toMatch(/<CohortMoneyLine m=\{r\.money\} \/>/)
    expect(list).toMatch(/<CancelCohortBox compact cohortId=\{r\.id\}/)
  })
})

/* ═══ ⑥ والمال للمدير الأكاديمي ومدير النظام وحدهما (٢٢ أكتوبر ٢٠٢٦) ═══
   قرار صاحب المنصّة: «مدير الأكاديمية والسوبر أدمن». */
describe('⑥ من يرى المال', () => {
  const routes = code('server/http/routes/admin-learning.routes.ts')
  const gate = (path: string) => {
    const at = routes.indexOf(`app.get('${path}'`)
    expect(at, `لا مسار ${path}`).toBeGreaterThan(-1)
    return routes.slice(at, routes.indexOf('}, async', at))
  }
  it('⚠️ المساران يطلبان إدارة الشعب وعرض المالية معا', () => {
    for (const p of ['/api/admin/cohorts/upcoming', '/api/admin/cohorts/:id/economics']) {
      expect(gate(p)).toContain("preHandler: [requirePermission('cohort.manage'), requirePermission('finance.view')]")
    }
  })
  it('⚠️ والحبتان معا لا تجتمعان إلا في المدير الأكاديمي ومدير النظام', async () => {
    const { ROLE_PERMISSIONS } = await import('../../../server/auth/permissions')
    const both = Object.entries(ROLE_PERMISSIONS)
      .filter(([, keys]) => (keys as readonly string[]).includes('cohort.manage') && (keys as readonly string[]).includes('finance.view'))
      .map(([role]) => role).sort()
    expect(both).toEqual(['academic_manager', 'super_admin'])
  })
  it('⚠️ والشاشة تخفي اللافتة عمن لا يراها', () => {
    expect(page).toMatch(/\{seesMoney && <CohortMoney cohortId=\{c\.id\}/)
    expect(page).toMatch(/const seesMoney = viewer\?\.permissions\.includes\("finance\.view"\) \?\? false;/)
  })
})
