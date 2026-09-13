/* اقتراحُ اسم الدورة أو المسار — يركب مع الخطّة، وتقبله الإدارة بالاختيار.

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): للمدرّب أن يغيّر «حتّى عنوان الدورة،
   واسمَ المسار إن كان له مسارٌ كامل — وكلُّه يحتاج موافقةَ الإدارة». وكان
   لهذا طابورٌ مستقلّ (`TrainerChangeRequest`) بمساراتٍ في الخادم لا تناديها
   شاشة — فحُذفت مساراتُ المدرّب منه، وصار الاقتراحُ حقلَين في خطّة الشعبة.

   والفحصُ على البنية:
   · الحقلان في مخطّط الخطّة عند الخادم، وفي شاشة المدرّب، وفي شاشة المعتمِد.
   · الاعتمادُ يمرّر ما اختاره المعتمِدُ (`applyProposals`) — لا يُطبَّق شيءٌ ضمنا.
   · والمساراتُ الميّتة لم تعد في الخادم، و`catalog-scope` باقٍ لأنّ شاشةً تناديه.
   · ولوحةُ المدرّب تبدأ ببطاقات شعبه من الموجز. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('اقتراحُ الاسم يركب مع الخطّة', () => {
  it('مخطّطُ الخطّة عند الخادم يقبل الاقتراحين — لا أكثر', () => {
    const routes = code('server/http/routes/learning-portal.routes.ts')
    const schema = routes.slice(routes.indexOf('const planContent = z.object({'), routes.indexOf("app.get('/api/trainer/cohorts/:id/workspace'"))
    expect(schema).toMatch(/proposals: z\.object\(\{ courseTitleAr: z\.string\(\)\.max\(200\)\.nullish\(\), pathwayTitleAr: z\.string\(\)\.max\(200\)\.nullish\(\) \}\)\.nullish\(\)/)
  })

  it('والمدرّبُ يكتبهما في مرحلة الاسم والمواعيد ويحفظهما مع الخطّة', () => {
    const ws = code('src/pages/trainer/CohortWorkspace.tsx')
    expect(ws).toMatch(/proposals: \{ \.\.\.\(content\.proposals \?\? \{\}\), courseTitleAr: e\.target\.value \}/)
    expect(ws).toMatch(/proposals: \{ \.\.\.\(content\.proposals \?\? \{\}\), pathwayTitleAr: e\.target\.value \}/)
  })

  it('والمعتمِدُ يختار ما يقبله ويمرّره صراحةً — لا اعتمادَ يطبّق ضمنا', () => {
    const admin = code('src/pages/admin/CohortOps.tsx')
    expect(admin).toMatch(/applyProposals\.courseTitle/)
    expect(admin).toMatch(/applyProposals\.pathwayTitle/)
    expect(admin).toMatch(/\{ approve: true, applyProposals \}/)
    const route = code('server/http/routes/admin-learning.routes.ts')
    expect(route).toMatch(/applyProposals: z\.object/)
    expect(route).toMatch(/plans\.decide\(req\.auth!\.userId, id, body\.approve, body\.note, body\.applyProposals\)/)
  })

  it('والخادمُ يكتب الاسمَ على النسخة الحاليّة ويسجّل الأثر', () => {
    const svc = code('server/services/cohort-plan.service.ts')
    expect(svc).toMatch(/courseVersion\.updateMany\(\{\s*where: \{ courseId: plan\.cohort\.course\.id, version: plan\.cohort\.course\.currentVersion \}/)
    expect(svc).toMatch(/pathwayVersion\.updateMany\(/)
    expect(svc).toContain("action: 'cohort.plan.proposal_applied'")
    expect(code('src/application/audit/labels.ts')).toContain("'cohort.plan.proposal_applied'")
  })
})

describe('المساراتُ الميّتةُ حُذفت — وما تناديه شاشةٌ باقٍ', () => {
  const routes = code('server/http/routes/trainer-portal.routes.ts')

  it('لا إرسالَ اقتراحٍ ولا قائمتَه ولا سحبَه ولا مخطّطَ دورةٍ من جانب المدرّب', () => {
    for (const path of ['/api/trainer/change-requests', '/api/trainer/courses/:courseId/blueprint']) {
      expect(routes, `المسارُ الميّت عاد: ${path}`).not.toContain(`'${path}'`)
    }
    expect(routes).not.toContain('/api/trainer/change-requests/:id/withdraw')
  })

  it('و`catalog-scope` باقٍ — شاشةُ المؤهّلات تناديه', () => {
    expect(routes).toContain("'/api/trainer/catalog-scope'")
    expect(code('src/pages/trainer/Qualifications.tsx')).toContain('/api/trainer/catalog-scope')
  })
})

describe('لوحةُ المدرّب — بطاقاتُ الشعب أوّلا', () => {
  const home = code('src/pages/trainer/TrainerDashboard.tsx')

  it('تقرأ الموجزَ وتعرض لكلّ شعبةٍ حلقتَها وخطوتَها التالية', () => {
    expect(home).toContain('/api/trainer/cohorts/summary')
    expect(home).toMatch(/summary\.map\(\(c\)/)
    expect(home).toMatch(/<ProgressRing\b/)
    expect(home).toContain('to={`/trainer/cohort/${c.id}`}')
  })

  /* ═══ تحديثُ هذا الحارس — بقرارٍ لا بتنازل ═══

     كان يشترط وجودَ «جلسات هذا الأسبوع» في الرأس، وهو أحدُ أربعةِ أرقامٍ
     أقرّها قرارُ ٨ سبتمبر ٢٠٢٦ («الأرقامُ شريطٌ رفيعٌ في الرأس»).

     ثمّ قال صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «الرئيسيّة مبعثرةٌ وغير مرتّبة،
     وفيها معلوماتٌ سهلةُ الوصول للمدرّب في التبويبات أعلاه». والأربعةُ كانت
     تشير إلى المقاصد الأربعة نفسِها التي في شريط التبويبات — الروابطُ ذاتُها
     مرّتين.

     فالمحفوظُ من القرار الأوّل هو **الترتيب**: رأسٌ رفيعٌ، ثمّ بطاقاتُ الشعب،
     ثمّ الاجتماعُ في الذيل. والمنقوضُ هو **محتوى الرأس** وحدَه. والحارسُ
     صار يحرس الاثنين: الترتيبَ كما كان، وألّا تعود التبويباتُ بطاقاتٍ. */
  it('والرأسُ شريطٌ رفيع، والبطاقاتُ بعده، والاجتماعُ في الذيل', () => {
    const head = home.indexOf('waitingToSubmit > 0')
    const cards = home.indexOf('summary.map(')
    const meeting = home.indexOf('احجز اجتماعا مع الإدارة')
    expect(head, 'لا إشارةَ في الرأس').toBeGreaterThan(0)
    expect(head, 'الرأسُ بعد البطاقات').toBeLessThan(cards)
    expect(cards, 'الاجتماعُ قبل البطاقات').toBeLessThan(meeting)
  })

  it('ولا يعود الرأسُ يكرّر مقاصدَ التبويبات', () => {
    /* المقاصدُ الأربعة في `TrainerLayout` — وبطاقةٌ في الرأس تقود إلى أحدها
       بعددٍ مجرّدٍ هي تكرارٌ للتبويب فوقها. والفحصُ على الوجهة لا على النصّ. */
    for (const to of ['"/trainer/learners"', '"/trainer/grading"', '"/trainer/schedule"']) {
      const head = home.slice(0, home.indexOf('summary.map('))
      expect(head, `الرأسُ يكرّر التبويبَ ${to}`).not.toContain(`to=${to}`)
    }
  })
})
