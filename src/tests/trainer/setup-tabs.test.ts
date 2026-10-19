/* ═══ من في طور الإعداد يرى ما يعمل به — الخطوة H (١٩ أكتوبر ٢٠٢٦) ═══

   درس صاحبُ المنصّة جانبَ المدرّب واختار («All, in order»): من اعتمدنا توقيعَه ولم تُعتمد دوراتُه بعدُ
   كان يرى «طلبتي» بلا طلبة و«طابور التقييم» بلا تسليم و«جدولي» بلا لقاء و«التسويق» بلا دورة.

   ① في طوره خمسةُ ألسنة: «الرئيسية» و«شعبي» و«دوراتي» و«التسويق» و«مستحقاتي» (وفيها عقدُه).
      و«التسويق» باقٍ بقول صاحب المنصّة حين رأى الصور: «ابقِ التسويقَ خارجا».
   ② وطورُه من عقده كما يقرؤه شريطُ المهلة — ولا يُعامَل به من له شعبةٌ تُشغَّل أو تسليمٌ ينتظره.
   ③ والأبوابُ لا تُغلق: المسارُ قائمٌ لمن جاءه برابط.

   والفحصُ على البنية: الدالّةُ تُنادى، والشيفرةُ تُقرأ بلا تعليقاتها. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { tabsForStage } from '@/application/trainer/setup-tabs'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const ALL = ['/trainer', '/trainer/board', '/trainer/learners', '/trainer/grading', '/trainer/schedule',
  '/trainer/qualifications', '/trainer/marketing', '/trainer/earnings'].map((to) => ({ to }))

describe('① ألسنةُ الطور', () => {
  it('⚠️ في الإعداد: الرئيسية وشعبي ودوراتي والتسويق ومستحقاتي — بترتيبها', () => {
    expect(tabsForStage(ALL, true).map((t) => t.to))
      .toEqual(['/trainer', '/trainer/board', '/trainer/qualifications', '/trainer/marketing', '/trainer/earnings'])
  })

  it('وبعده القائمةُ كلُّها', () => {
    expect(tabsForStage(ALL, false)).toEqual(ALL)
  })

  it('ومراجعةُ اختبار المستوى لمن مُنحها تبقى — ليست من الطور', () => {
    expect(tabsForStage([...ALL, { to: '/trainer/placement-review' }], true).map((t) => t.to)).toContain('/trainer/placement-review')
  })
})

describe('② الطورُ من العقد — ولا يُخفى عمّن له طلبة', () => {
  const L = code('src/pages/trainer/TrainerLayout.tsx')

  it('⚠️ شرطٌ قائم، ولا شعبةَ تُشغَّل، ولا تسليمَ ينتظر', () => {
    expect(L).toMatch(/const inSetup = Boolean\(contract && hasOpenCondition\(contract\)\) && \(me\?\.liveCohorts \?\? 0\) === 0 && pending === 0;/)
    expect(L).toMatch(/<PortalTabs\s+tabs=\{shownTabs\}/)
  })

  it('والخادمُ يعدّ شعبَه التي تُشغَّل', () => {
    const r = code('server/http/routes/trainer-portal.routes.ts')
    expect(r).toMatch(/const liveCohorts = await prisma\.cohortTrainer\.count\(\{\s*where: \{ profileId: profile\.id, cohort: \{ status: \{ in: \['open', 'full', 'active', 'completed'\] \} \} \},?\s*\}\)/)
    expect(r).toMatch(/return \{ \.\.\.full, pendingGrading, liveCohorts \}/)
  })
})

describe('③ والأبوابُ لا تُغلق', () => {
  it.each(['/trainer/learners', '/trainer/grading', '/trainer/schedule'])('%s مسارٌ قائم', (p) => {
    expect(code('src/App.tsx')).toMatch(new RegExp(`<Route path="${p}" element=\\{<[A-Z]`))
  })
})
