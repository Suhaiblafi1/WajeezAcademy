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
import { readFileSync } from 'node:fs'
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

describe('وبابُ الاسم الجديد موصولٌ — شاشةٌ ومسارٌ وخدمة', () => {
  it('الخدمةُ تعرف النوعَ وتحمل الاسمَ إلى الإصدار الجديد', () => {
    const svc = code('server/services/trainer-change.service.ts')
    expect(svc).toContain("'course_title_edit'")
    /* والفحصُ على **الحمل** لا على ورودِ الاسم: الإصدارُ الجديدُ كان ينسخ
       `baseVersion.titleAr` حرفا بحرف، فلو بقي كذلك لمرّ النوعُ بلا أثر. */
    expect(svc).toMatch(/case 'course_title_edit': \{[\s\S]{0,200}titleAr = after\.titleAr\.trim\(\)/)
    expect(svc).toMatch(/courseId: course\.id, version: newVersion,\s*\n\s*titleAr,/)
    expect(svc).not.toMatch(/version: newVersion,\s*\n\s*titleAr: baseVersion\.titleAr/)
  })

  it('والمسارُ يقبله من المدرّب بنطاق الكتالوج', () => {
    const routes = code('server/http/routes/trainer-portal.routes.ts')
    expect(routes).toContain("'/api/trainer/course-title-proposals'")
    expect(routes).toMatch(/changeType: 'course_title_edit'/)
    expect(routes).toMatch(/scope: 'catalog'/)
  })

  /* ═══ ولا يعتمد المعتمِدُ اسما لم يره ═══

     بطاقةُ الاقتراح عند الإدارة كانت تعرض السببَ و«ن بند تعديل» وحدَهما.
     فمن ضغط «اعتماد للكتالوج» على اقتراحِ تسميةٍ اعتمد اسما لم يقرأه — وهو
     كلُّ الاقتراح لا تفصيلا فيه. جُرّبت الشاشةُ بالمتصفّح فظهر ذلك، فأُضيف.

     والفحصُ على **القراءة من البند** لا على ورودِ نصّ: العنوانُ يُقرأ من
     `afterValue.titleAr` لبندِ `course_title_edit` بعينه. */
  it('وبطاقةُ المعتمِد تعرض الاسمَ المقترَحَ قبل أزرار القرار', () => {
    const admin = code('src/pages/admin/TrainerOps.tsx')
    expect(admin).toMatch(/changeType === "course_title_edit"/)
    expect(admin).toMatch(/after\?\.titleAr/)
    /* ويُعرض في البطاقة لا في دالّةٍ لا تُنادى */
    expect(admin).toMatch(/\{proposedTitle\(r\) &&/)
    /* وقبل أزرار القرار: يقرأ ثمّ يقرّر */
    const card = admin.slice(admin.indexOf('{rows.map((r) =>'))
    expect(card.indexOf('proposedTitle(r)')).toBeLessThan(card.indexOf('approve_for_catalog'))
  })

  it('والشاشةُ تناديه من ورشة الشعبة — لا مسارَ بلا شاشةٍ من جديد', () => {
    const screen = code('src/pages/trainer/CourseTitleProposal.tsx')
    expect(screen).toContain('/api/trainer/course-title-proposals')
    const ws = code('src/pages/trainer/CohortWorkspace.tsx')
    expect(ws).toContain('<CourseTitleProposal')
    expect(ws).toContain('from "./CourseTitleProposal"')
  })

  /* وما كتبه مدرّبٌ في الصندوق القديم لا يضيع: يُعرض مهيّأً في القناة
     الجديدة. والفحصُ على الوصل — `legacyDraft` يصل من `content.proposals`. */
  it('وما حُفظ في الصندوق القديم يُعرض مهيّأً لا مهجورا', () => {
    const ws = code('src/pages/trainer/CohortWorkspace.tsx')
    expect(ws).toMatch(/legacyDraft=\{content\.proposals\?\.courseTitleAr \?\? null\}/)
    const screen = code('src/pages/trainer/CourseTitleProposal.tsx')
    expect(screen).toMatch(/setTitleAr\(draft\)/)
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
