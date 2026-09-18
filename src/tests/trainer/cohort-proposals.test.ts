/* اسمُ الدورة يمرّ بقناته — ولا يُكتب من داخل خطّة شعبة (ح-٣ · د-٦).

   ═══ ما كان يحرسه هذا الملفّ ═══

   حقلَين في خطّة الشعبة: اسمٌ مقترحٌ للدورة وآخرُ للمسار، يختار المعتمِدُ
   ما يقبله فيُكتب **على النسخة الحاليّة** بـ`updateMany`. وكان الحارسُ
   يثبت وجودَهما في المواضع الأربعة.

   ═══ ولماذا انقلب ═══

   الكتابةُ فوق النسخة القائمة تُعيد تسميةَ **كلِّ شهادةٍ صدرت** عن الدورة،
   لأنّ التحقّقَ العامّ كان يقرأ آخرَ إصدار (ك-٢). فالاسمُ صار نوعَ تغييرٍ
   في `TrainerChangeService` ينتهي **إصدارا جديدا**، والصندوقُ حُذف.

   فصار الحارسُ يحرس الضدَّ — والفحصُ **بنيويٌّ لا نصّيّ**: لا يكفي أن تغيب
   كلمةٌ من ملفّ، بل تُفحص المواضعُ الأربعةُ التي كانت تحمل الحقلَين، ويُفحص
   أنّ البابَ الجديدَ **موصولٌ من شاشةٍ إلى مسارٍ إلى خدمة**. */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('صندوقُ «اقتراحٌ للإدارة» زال من مواضعه الأربعة', () => {
  it('مخطّطُ الخطّة عند الخادم لم يعد يقبل `proposals`', () => {
    const routes = code('server/http/routes/learning-portal.routes.ts')
    const schema = routes.slice(
      routes.indexOf('const planContent = z.object({'),
      routes.indexOf("app.get('/api/trainer/cohorts/:id/workspace'"),
    )
    expect(schema).not.toContain('proposals')
    expect(schema).not.toContain('courseTitleAr')
  })

  it('وشاشةُ المدرّب لا تكتبهما في الخطّة', () => {
    const ws = code('src/pages/trainer/CohortWorkspace.tsx')
    expect(ws).not.toMatch(/proposals: \{ \.\.\.\(content\.proposals \?\? \{\}\)/)
    expect(ws).not.toContain('pathwayTitleAr')
  })

  it('وشاشةُ المعتمِد لا تعرض خياراتٍ تُطبَّق مع الاعتماد', () => {
    const admin = code('src/pages/admin/CohortOps.tsx')
    expect(admin).not.toContain('applyProposals')
    const route = code('server/http/routes/admin-learning.routes.ts')
    expect(route).not.toContain('applyProposals')
    /* والاعتمادُ يمرّر ثلاثةً لا خمسة — لا وسيطَ اقتراحاتٍ خلفه */
    expect(route).toMatch(/plans\.decide\(req\.auth!\.userId, id, body\.approve, body\.note\)/)
  })

  it('والخادمُ لا يكتب اسما على نسخةٍ قائمةٍ من اعتماد خطّة', () => {
    const svc = code('server/services/cohort-plan.service.ts')
    expect(svc).not.toContain('courseVersion.updateMany')
    expect(svc).not.toContain('pathwayVersion.updateMany')
    expect(svc).not.toContain("action: 'cohort.plan.proposal_applied'")
  })

  /* والاسمُ في المعجم يبقى: أحداثٌ حقيقيّةٌ كُتبت به قبل الحذف، والمعجمُ هو
     ما يُقرأ به سجلُّ الشعبة — فحذفُ السطر يترك أحداثا بلا اسم. */
  it('واسمُ الفعل يبقى في معجم الأثر — لأنّ ما كُتب به يُقرأ', () => {
    expect(code('src/application/audit/labels.ts')).toContain("'cohort.plan.proposal_applied'")
  })
})

/* ═══ ثمّ أُغلق بابُ الاسم كلُّه (ق٥ · ١٧ سبتمبر ٢٠٢٦) ═══

   كان هنا وصفٌ يحرس أنّ البابَ الجديدَ **موصولٌ**: شاشةٌ في ورشة الشعبة،
   ومسلكٌ يقبلها، وخدمةٌ تحمل الاسمَ إلى إصدارٍ جديد. وقد بُني لأنّ حذفَ
   صندوقِ «اقتراحٌ للإدارة» كان يجب أن يترك للمدرّب بابا لا أن يسدّه.

   وسأل صاحبُ المنصّة عن موضعه: «لماذا هذا السؤال هنا؟» — والمدرّبُ جاء
   يجهّز دفعتَه فيُسأل عن اسم الدورة في الكتالوج كلِّه. ثمّ أغلق القناةَ:
   «بابُ اسم الدورة يُغلق»، وعلّتُه أنّ قناةً لا يملكها أحدٌ أسوأُ من لا
   قناة.

   فانقلب الحارسُ إلى ضدّه، والفحصُ **بنيويٌّ في أربعة مواضع**: الشاشةُ
   زالت، والورشةُ لا تنادي ما زال، والمسلكُ لا يقبل، والنوعُ خرج من
   `CHANGE_TYPES` — وهو الجذر: ما دام النوعُ في القائمة فالبابُ مفتوحٌ
   لكلّ من ينادي `submit` ولو بلا شاشة. */
describe('ق٥ بابُ اسم الدورة مغلقٌ في مواضعه الأربعة', () => {
  it('⚠️ لا شاشةَ اقتراحِ اسمٍ أصلا', () => {
    expect(existsSync(join(root, 'src/pages/trainer/CourseTitleProposal.tsx')),
      'عادت شاشةُ اقتراح الاسم').toBe(false)
  })

  it('⚠️ وورشةُ الشعبة لا تناديها — ولا تحمل إليها مسودّةً قديمة', () => {
    const ws = code('src/pages/trainer/CohortWorkspace.tsx')
    expect(ws, 'الورشةُ ما زالت تصيّر شاشةَ الاقتراح').not.toContain('CourseTitleProposal')
    expect(ws, 'ما زال يُمرَّر اقتراحُ اسمٍ من الخطّة').not.toContain('legacyDraft')
  })

  it('⚠️ ولا مسلكَ اسمٍ في مسارات المدرّب', () => {
    const routes = code('server/http/routes/trainer-portal.routes.ts')
    const urls = [...routes.matchAll(/app\.(get|post|patch|delete)\(\s*'([^']+)'/g)].map((m) => m[2])
    expect(urls.filter((u) => u.includes('course-title')), 'عاد مسلكُ اقتراح الاسم').toEqual([])
  })

  it('⚠️ والجذرُ: لا نوعَ `course_title_edit` في الخدمة — لا في الأنواع ولا في التطبيق', () => {
    const svc = code('server/services/trainer-change.service.ts')
    const types = svc.slice(svc.indexOf('export const CHANGE_TYPES = ['), svc.indexOf('] as const'))
    expect(types, 'عاد النوعُ إلى القائمة، فعاد البابُ لكلّ من ينادي `submit`')
      .not.toContain('course_title_edit')
    expect(svc, 'بقيت حالةُ تطبيقِ الاسم — فاسمُ إصدارٍ جديدٍ يُبدَّل ببندٍ لا بابَ له')
      .not.toMatch(/case 'course_title_edit'/)
    /* والاسمُ يُنسخ من الإصدار الأساس بلا تبديل — وهو ما كان قبل ح-٣ */
    expect(svc).toMatch(/const titleAr = baseVersion\.titleAr/)
  })

  it('⚠️ وبطاقةُ المعتمِد لا تقرأ بندَ اسمٍ لم يعد يُولَد', () => {
    const admin = code('src/pages/admin/TrainerOps.tsx')
    expect(admin, 'ما زالت البطاقةُ تقرأ بندَ الاسم').not.toContain('course_title_edit')
  })

  /* ولا يُترك المعلَّقُ في طابورٍ لا يعرف أحدٌ ما يفعل به: هجرةٌ تُصيّره
     `superseded` بتعليلها. والفحصُ على وجود الهجرة وعلى ما تفعله — فحذفُ
     البابِ بلا هذه الهجرة يترك طلبَ مدرّبٍ حيًّا بلا من يبتّ فيه. */
  it('⚠️ وما أُرسل قبل الإغلاق له هجرةٌ تقف به وتقول لماذا', () => {
    const sql = readFileSync(join(root, 'prisma/migrations/20260917190000_close_course_title_channel/migration.sql'), 'utf8')
    const body = sql.replace(/^\s*--.*$/gm, '')
    expect(body, 'الهجرةُ لا تمسّ الطلبات المعلّقة').toMatch(/UPDATE "TrainerChangeRequest"/)
    expect(body).toMatch(/superseded/)
    expect(body, 'لم تُعلَّل الوقفةُ لصاحبها').toMatch(/reviewerComment/)
    expect(body, 'مسّت الهجرةُ ما بُتّ فيه — قرارٌ وقع لا يُعاد كتابتُه')
      .toMatch(/status" IN \('draft', 'submitted', 'under_review', 'changes_requested'\)/)
    expect(body, 'الهجرةُ تطال طلباتٍ ليست اقتراحَ اسم').toMatch(/changeType" = 'course_title_edit'/)
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

describe('لوحةُ المدرّب — طابورٌ واحدٌ لا لوحُ أرقام', () => {
  const home = code('src/pages/trainer/TrainerDashboard.tsx')

  /* ═══ تحديثُ هذا الحارس — بقرارٍ لا بتنازل ═══

     كان يشترط شبكةَ «شعبي» (`summary.map` وحلقةَ تقدّمٍ وبطاقةً لكلّ شعبة)،
     وهي التي حلّت محلَّ أربعةِ أرقامٍ في الرأس بعد قول صاحب المنصّة (١٣
     سبتمبر ٢٠٢٦): «مبعثرةٌ وفيها معلوماتٌ سهلةُ الوصول في التبويبات أعلاه».

     والعلّةُ نفسُها بقيت في الشبكة: هي تبويبُ «شعبي» مرسوما مرّةً ثانية —
     وكذلك «جلساتي القادمة» هي «جدولي» مقصوصا، وحبّةُ «شعبتان تنتظران
     إرسالَك» عددٌ لا يقول أيَّ شعبةٍ ولا ما ينقصها.

     فصارت الثلاثةُ بنودا في الطابور نفسِه، لكلِّ بندٍ اسمُ شعبته وخطوتُها
     ووجهتُها. والمحفوظُ من القرار الأوّل هو **الترتيب**: سطرٌ رفيعٌ، ثمّ
     العمل، ثمّ الاجتماعُ في الذيل. والمنقوضُ هو **شكلُ العمل** وحدَه. */

  it('⚠️ الموجزُ يُقرأ ويُمرَّر إلى الطابور — ولا يُرسَم شبكةً ثانيةً لتبويب «شعبي»', () => {
    expect(home, 'الموجزُ لا يُجلَب').toContain('/api/trainer/cohorts/summary')
    const at = home.indexOf('buildWorkQueue(')
    expect(at, 'الطابورُ لا يُبنى في اللوحة').toBeGreaterThan(-1)
    const args = home.slice(at, home.indexOf(';', at))
    expect(args, 'الموجزُ مجلوبٌ ولا يبلغ الطابور').toContain('summary')
    expect(home, 'شبكةُ «شعبي» عادت — وهي تبويبٌ مرسومٌ مرّةً ثانية').not.toMatch(/summary\.map\(/)
  })

  it('السطرُ أوّلا، ثمّ الطابور، ثمّ المتعثّرون، ثمّ الاجتماعُ في الذيل', () => {
    const hello = home.indexOf('أهلاً {name}')
    const queue = home.indexOf('<TrainerWorkQueue')
    const risk = home.indexOf('<AtRiskList')
    /* وصار سطرُ الاجتماع مكوّنا يُستعمل مرّتين (ع-١) — فيُطلَب وسمُه لا نصُّه */
    const meeting = home.indexOf('<BookAdminMeeting')
    expect(hello, 'لا سطرَ تحيّةٍ في الرأس').toBeGreaterThan(0)
    expect(hello, 'الطابورُ قبل السطر').toBeLessThan(queue)
    expect(queue, 'المتعثّرون قبل الطابور').toBeLessThan(risk)
    expect(risk, 'الاجتماعُ قبل المتعثّرين').toBeLessThan(meeting)
  })

  it('⚠️ ولا وجهةَ مكتوبةً بيدٍ في اللوحة — الوجهاتُ كلُّها من بنود الطابور', () => {
    /* وجهةُ البند تُحسَب في `work-queue.ts` ومعها إجراؤها وسياقُها. أمّا
       `to="/trainer/…"` مكتوبةً هنا فمعناها قسمٌ ثانٍ يقود حيث يقود التبويبُ
       فوقه — وهي الشكوى بعينها. والفحصُ على شكل المسار لا على نصّ الرابط:
       مسارُ نقطةِ نهايةٍ يسبقه `api` فلا يُطابَق. */
    expect(home, 'وجهةٌ مكتوبةٌ بيدٍ في اللوحة').not.toMatch(/["'`]\/trainer\//)
  })

  it('والعددُ الذي لا مصدرَ له لا يُختلق — لا حضورٌ ٪ ولا تقييمٌ في اللوحة', () => {
    /* لوحُ «أرقامُك» في التصميم حمل أربعةً: اثنان لهما مصدرٌ في هذه الردود
       (الشعبُ والطلبة) ويقولهما السطرُ نثرا، واثنان لا مصدرَ لهما هنا. */
    expect(home, 'رقمٌ بلا مصدرٍ في اللوحة').not.toContain('حضورُ لقاءاتك')
    expect(home, 'رقمٌ بلا مصدرٍ في اللوحة').not.toContain('ما قيل عنك')
  })
})
