/* «خططٌ تنتظر اعتمادك» — بابٌ واحدٌ لخطط المدرّبين كلِّهم (٣ أكتوبر ٢٠٢٦).
 *
 * سؤالُ صاحب المنصّة: «كيف أعتمد كلَّ شعبةٍ أنهى مدرّبُها موادَّها وتنتظر
 * اعتمادي؟». وكان الجوابُ أن يفتح شعبةً شعبة. فاختار أن تُجمع: كلُّ خطّةٍ
 * مرسَلةٍ من كلّ مدرّب، وأمام كلٍّ «اعتمدها» و«اطلب تعديلات». وما يُحرَس:
 *
 *   ① المراجعةُ واحدةٌ في البابين — بطاقةُ الشعبة والطابورُ يعرضان المكوّنَ
 *      نفسَه، ولا قرارَ في الطابور إلّا من داخله: فلا يُعتمَد ما لم يُفتح.
 *   ② والطابورُ يُبلَغ — بندٌ في القائمة بصلاحيّة الاعتماد وشارةُ عدد، ومسارٌ
 *      مسجَّل، ورابطٌ من لوح دورات المدرّب في «العقود».
 *   ③ وما يُقال قبل النقر وبعده بما يحكم به الخادم — جملةُ الزرّين في شعبة
 *      الإعداد، ورسالةُ الاعتماد بما ردّه (`prep`).
 *
 * والفحصُ على البنية بعد نزع التعليقات: كلُّ ملفٍّ هنا يشرح ما يفعله بأسماء
 * ما يفعله، فتعليقٌ يذكر `<TrainerPlanReview` يُخضرّ حارسا على غيابه.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { allSections, sectionsFor } from '@/pages/admin/nav-map'
import { approvedMsg, planApprovedMsg, prepNoteAr } from '@/application/trainer/plan-decision'
import { ROLE_PERMISSIONS } from '../../../server/auth/permissions'

const bare = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const OPS = bare('src/pages/admin/CohortOps.tsx')
const QUEUE = bare('src/pages/admin/PendingPlans.tsx')
const REVIEW = bare('src/components/admin/TrainerPlanReview.tsx')

describe('① المراجعةُ واحدةٌ في البابين', () => {
  it('بطاقةُ الشعبة تعرض المكوّنَ في لسان المحتوى — لا نسخةً منه', () => {
    const at = OPS.indexOf('<TrainerPlanReview cohortId={cohort.id}')
    expect(at, 'سقطت مراجعةُ الخطّة من بطاقة الشعبة').toBeGreaterThan(-1)
    /* وفي قسم الخطّة المحروس بلسانه: لا `</Section>` بين رأس القسم والمكوّن */
    const head = OPS.lastIndexOf('<Section icon={BookOpen} title="خطّةُ المدرّب', at)
    expect(head, 'المكوّنُ خارجَ قسم الخطّة').toBeGreaterThan(-1)
    expect(OPS.slice(head, at)).not.toContain('</Section>')
    expect(OPS.slice(OPS.lastIndexOf('</Section>', head), head), 'قسمُ الخطّة بلا بوّابة لسانه').toContain('tab === "content"')
    /* ولا قرارَ ولا قراءةَ للخطّة في البطاقة نفسِها — تلك نسخةٌ ثانيةٌ تفترق */
    expect(OPS, 'عادت نسخةٌ من القرار إلى البطاقة').not.toMatch(/cohort-plans\/\$\{/)
    expect(OPS).not.toContain('/trainer-plan`')
  })

  it('والطابورُ يعرض المكوّنَ نفسَه حين تُفتح الخطّة — ولا يقرّر من خارجه', () => {
    expect(QUEUE).toMatch(/import TrainerPlanReview, \{ type PlanOutcome \} from "@\/components\/admin\/TrainerPlanReview";/)
    expect(QUEUE).toMatch(/\{isOpen && \(\s*<div[^>]*>\s*<TrainerPlanReview\s+cohortId=\{r\.cohort\.id\}/)
    /* لا اعتمادَ بالجملة ولا زرَّ يقرّر ما لم يُفتح: الطابورُ لا يرسل شيئا بنفسه */
    expect(QUEUE, 'في الطابور قرارٌ من خارج المراجعة').not.toMatch(/apiPost|\/decide/)
    /* ويعلم بما قُضي ليعلّمه — لا ليُسقطه من تحت عين قارئه */
    expect(QUEUE).toMatch(/onPlanDecided=\{\(outcome\) => setDecided\(\(d\) => \(\{ \.\.\.d, \[r\.id\]: outcome \}\)\)\}/)
  })

  it('والمكوّنُ يقول ما ردّه الاعتمادُ لمدرّب الإعداد — ويُخبر بابَه بما قُضي', () => {
    expect(REVIEW).toMatch(/\(r\) => planApprovedMsg\(r as PlanDecision\),/)
    expect(REVIEW).toMatch(/onPlanDecided\?\.\("approved"\); return r;/)
    expect(REVIEW).toMatch(/if \(ok\) \{ setAsking\(false\); onPlanDecided\?\.\("changes_requested"\); \}/)
  })
})

describe('② والطابورُ يُبلَغ', () => {
  const item = allSections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title })))
    .find((i) => i.to === '/admin/pending-plans')

  it('بندٌ تحت «المدرّبون — الانضمامُ والتعاقد» بصلاحيّة الاعتماد نفسِها، وبشارةِ عدد', () => {
    expect(item, 'لا بندَ للطابور في القائمة').toBeDefined()
    expect(item!.section).toBe('المدرّبون — الانضمامُ والتعاقد')
    expect(item!.need).toBe('cohort.plan.approve')
    expect(item!.badge).toBe('awaitingPlans')
  })

  it('يراه من يعتمد — لا من يدير الشعبَ ولا يعتمد خططَها', () => {
    const sees = (role: string) => sectionsFor(ROLE_PERMISSIONS[role])
      .some((s) => s.items.some((i) => i.to === '/admin/pending-plans'))
    expect(sees('academic_manager')).toBe(true)
    expect(sees('super_admin')).toBe(true)
    expect(sees('academic_coordinator'), 'يرى الطابورَ من لا يملك الاعتماد').toBe(false)
  })

  it('والمسارُ مسجَّلٌ بشاشته', () => {
    const app = bare('src/App.tsx')
    expect(app).toMatch(/const AdminPendingPlans = lazy\(\(\) => import\('\.\/pages\/admin\/PendingPlans'\)\)/)
    expect(app).toMatch(/<Route path="\/admin\/pending-plans" element=\{<AdminPendingPlans \/>\} \/>/)
  })

  /* والنافذةُ محدودةٌ بتسجيل المسار نفسِه لا بعددٍ من الأحرف — علّتُها في
     `awaiting-countersign-badge.test.ts`: نافذةٌ بالأحرف بلغت المسارَ التالي */
  it('والعددُ بمساره المحروس بصلاحيّة الاعتماد', () => {
    const routes = bare('server/http/routes/admin-learning.routes.ts')
    const at = routes.indexOf("'/api/admin/cohort-plans/pending-count'")
    expect(at, 'لا مسارَ للعدّ').toBeGreaterThan(-1)
    const next = routes.slice(at).search(/\n {2}app\.(get|post|put|patch|delete)\(/)
    const block = routes.slice(at, next < 0 ? routes.length : at + next)
    expect(block, 'مسارٌ بلا حارسِ صلاحيّة').toContain("requirePermission('cohort.plan.approve')")
    expect(block).toContain('plans.pendingCount()')
  })

  it('والإطارُ لا يجلبه إلّا لمن يملك الاعتماد', () => {
    const layout = bare('src/pages/admin/AdminLayout.tsx')
    expect(layout).toMatch(/const canApprovePlans = user\?\.permissions\.includes\("cohort\.plan\.approve"\) \?\? false;/)
    const at = layout.indexOf('/api/admin/cohort-plans/pending-count')
    expect(at, 'لا يُجلَب العدد').toBeGreaterThan(-1)
    const effect = layout.slice(layout.lastIndexOf('useEffect(', at), at)
    expect(effect, 'يُنادى لمن لا يملك الاعتماد').toContain('if (!canApprovePlans) return;')
    expect(layout).toMatch(/setBadges\(\(b\) => \(\{ \.\.\.b, awaitingPlans: r\.count \}\)\)/)
  })

  it('ولوحُ دورات المدرّب في «العقود» يفتح المرسَلةَ في الطابور مرشَّحا بخططه', () => {
    const panel = bare('src/pages/admin/TrainerMaterialsReview.tsx')
    expect(panel).toMatch(/r\.state === "submitted"\s*\?\s*`\/admin\/pending-plans\?trainer=\$\{profileId\}&cohort=\$\{r\.cohortId\}`/)
  })
})

describe('③ ما يُقال قبل النقر وبعده بما يحكم به الخادم', () => {
  it('شعبةُ الإعداد: الزرّان وأثرُ كلٍّ — لا زرٌّ واحدٌ يُساق إليه', () => {
    const both = prepNoteAr({ onboarding: true, qualifies: true })
    expect(both).toContain('«اعتمدها» تؤهّل مدرّبَها لدورتها')
    expect(both, 'لا يُقال أنّ آخرَها يفعّله').toContain('وإن لم يبقَ من دوراته ما ينتظر فُعِّل')
    expect(both, 'يُجزَم بخَتم العقد ولا خَتمَ لغير المشروط').toContain('إن كان ينتظر ختمَنا')
    expect(both, 'لا يُقال ما يقع بالردّ').toContain('و«اطلب تعديلات» تعيدها إليه بملاحظاتك')
    expect(both).toContain('ويُستأنف عدُّ مهلته إن كانت موقوفةً لمراجعتنا')

    /* ودورتُه معتمَدةٌ أصلا (`qualifies: false`): لا يُقال «تؤهّله» */
    const qualified = prepNoteAr({ onboarding: true, qualifies: false })
    expect(qualified).toContain('دورتُها معتمَدةٌ لمدرّبها أصلا')
    expect(qualified).not.toContain('تؤهّل')

    /* والنشطُ لا يُفعَّل بها ولا مهلةَ له: لا يُقال ما لا يقع */
    const active = prepNoteAr({ onboarding: false, qualifies: true })
    expect(active).not.toContain('فُعِّل')
    expect(active).not.toContain('مهلته')
  })

  it('ورسالةُ الاعتماد تقول ما ردّه الخادمُ لمدرّب الإعداد', () => {
    const base = { status: 'approved' } as const
    /* شعبةٌ عاديّة: الرسالةُ كما كانت حرفا */
    expect(planApprovedMsg({ ...base, prep: null })).toBe(approvedMsg(base))
    expect(planApprovedMsg({ ...base, prep: { activated: true } })).toContain('فُعِّل مدرّبا نشطا')
    expect(planApprovedMsg({ ...base, prep: { activated: false, waiting: 1 } })).toContain('وبقيت له دورةٌ واحدة لم تُعتمَد بعد')
    expect(planApprovedMsg({ ...base, prep: { activated: false, waiting: 2 } })).toContain('وبقيت له دورتان')
    expect(planApprovedMsg({ ...base, prep: { activated: false, waiting: 11 } })).toContain('وبقيت له 11 دورةً')
    const blocked = planApprovedMsg({ ...base, prep: { activated: false, blockedAr: 'لا حسابَ له بعد' } })
    expect(blocked).toContain('ولم يُفعَّل: لا حسابَ له بعد')
  })

  it('والجملتان لا تلتحمان بنقطتين — ولو انتهت الأولى بنقطة', () => {
    const msg = planApprovedMsg({
      status: 'approved',
      meetings: { approved: 0, failed: [{ id: 's1', title: 'اللقاءُ الأوّل', reason: 'تعذّر إنشاءُ الاجتماع' }] },
      prep: { activated: false, waiting: 1 },
    })
    expect(msg).not.toContain('..')
    expect(msg).toContain('أدناه. وبقيت له')
  })

  it('والطابورُ يقول الجملةَ على شعبة الإعداد وحدَها، وقبل القرار لا بعده', () => {
    expect(QUEUE).toMatch(/\{r\.prep && !done && \(\s*<p[^>]*>\{prepNoteAr\(r\.prep\)\}<\/p>/)
  })
})
