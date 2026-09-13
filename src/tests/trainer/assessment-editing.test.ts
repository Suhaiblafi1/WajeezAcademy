/* التكليفُ يُعدَّل ويُحذف — وحرّاسُ ما لا يجوز أن ينكسر فيه.

   كان التكليفُ يُنشأ ولا يُمسّ: خطأٌ مطبعيٌّ في عنوانٍ يقرؤه كلُّ مسجَّلٍ
   يبقى ما بقيت الشعبة، والنموذجُ يجمع ثلاثةَ حقولٍ (عنوانٌ ونوعٌ وموعد)
   بينما القائمةُ تعرض «من ١٠٠» لدرجةٍ لا يضعها أحد.

   والفحصُ هنا **على الترتيب والاقتران** لا على ورودِ نصّ: أنّ المنعَ يقع
   قبل الحذف في الشيفرة، وأنّ الصلاحيّةَ داخلُ تسجيلِ المسار لا في ملفٍّ
   بعيد، وأنّ العمودَ المختارَ من القاعدة يصل إلى الواجهة فعلا. فمسحُ نصٍّ
   وحدَه يمرّ على تعليقٍ يذكر الكلمة. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')
/* الشيفرةُ بلا تعليقاتٍ — كي لا يمرّ حارسٌ بذكرِ الكلمة في شرحٍ فوقها */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const SVC = 'server/services/assessment.service.ts'
const ROUTES = 'server/http/routes/learning-portal.routes.ts'
const PLAN = 'server/services/cohort-plan.service.ts'
const WS = 'src/pages/trainer/CohortWorkspace.tsx'
const SCHEMA = 'prisma/schema.prisma'
const MIGRATION = 'prisma/migrations/20260913110000_assessment_brief/migration.sql'

describe('حذفُ التكليف — عملُ المتعلّمين لا يُمحى', () => {
  it('المنعُ يسبق الحذفَ في الشيفرة لا يتبعه', () => {
    const svc = code(SVC)
    const fn = svc.slice(svc.indexOf('async deleteAssessment('))
    const guard = fn.indexOf('_count.submissions > 0')
    const del = fn.indexOf('cohortAssessment.delete(')
    expect(guard, 'لا منعَ على التسليمات في `deleteAssessment`').toBeGreaterThan(-1)
    expect(del, 'لا حذفَ في `deleteAssessment`').toBeGreaterThan(-1)
    expect(guard, 'الحذفُ يقع قبل الفحص — التسليماتُ تسقط معه').toBeLessThan(del)
  })

  it('ويُردّ بـ409 لا بخطأ عامّ — فالواجهةُ تفرّق بين المنعِ والعطب', () => {
    const fn = code(SVC).slice(code(SVC).indexOf('async deleteAssessment('))
    expect(fn.slice(0, fn.indexOf('cohortAssessment.delete('))).toMatch(/has_submissions'[\s\S]*?409/)
  })

  it('وكلا الفعلين يتحقّق أنّ الشعبةَ من شعب المنادي', () => {
    const svc = code(SVC)
    for (const fn of ['async updateAssessment(', 'async deleteAssessment(']) {
      const body = svc.slice(svc.indexOf(fn), svc.indexOf(fn) + 900)
      expect(body, `${fn} بلا تحقّقٍ من مدرّب الشعبة`).toContain('assertAssessmentTrainer')
    }
    /* والدالّةُ نفسُها تستخرج الشعبةَ من التكليف ثمّ تسأل حارسَ الشعبة */
    const helper = svc.slice(svc.indexOf('private async assertAssessmentTrainer('))
    expect(helper.slice(0, 600)).toContain('assertCohortTrainer')
  })

  it('ولا تُخفَض النهايةُ تحت درجةٍ رُصدت فعلا', () => {
    const svc = code(SVC)
    const fn = svc.slice(svc.indexOf('async updateAssessment('), svc.indexOf('async deleteAssessment('))
    expect(fn, 'لا فحصَ على الدرجات عند خفض النهاية').toContain('score_below_awarded')
    /* يُقرأ أعلى ما رُصد من `Grade` عبر تسليمات هذا التكليف */
    expect(fn).toMatch(/grade\.aggregate\(\{[\s\S]*?submission:\s*\{\s*assessmentId\s*\}/)
  })
})

describe('المساران مسجَّلان بصلاحيّة التشغيل', () => {
  it('التعديلُ والحذفُ على معرّف التكليف، وكلٌّ بصلاحيّته في تسجيله', () => {
    const routes = code(ROUTES)
    for (const [verb, at] of [['patch', 'app.patch('], ['delete', 'app.delete(']] as const) {
      const i = routes.indexOf(`${at}'/api/trainer/assessments/:assessmentId'`)
      expect(i, `مسارُ ${verb} غير مسجَّل`).toBeGreaterThan(-1)
      /* الصلاحيّةُ داخلَ كتلة التسجيل نفسِها — لا في مكانٍ آخرَ من الملفّ */
      const block = routes.slice(i, i + 400)
      expect(block, `مسارُ ${verb} بلا صلاحيّة التشغيل`).toContain("requirePermission('trainer.cohort.operate')")
    }
  })
})

describe('تعليماتُ التكليف تصل من القاعدة إلى الواجهة', () => {
  it('العمودُ في المخطّط ويُنشئه ترحيلٌ إضافيٌّ لا يكسر القائم', () => {
    const model = read(SCHEMA).match(/model CohortAssessment \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(model, 'لا عمودَ `briefAr` في النموذج').toMatch(/briefAr\s+String\?/)
    const sql = read(MIGRATION)
    expect(sql).toMatch(/ALTER TABLE "CohortAssessment" ADD COLUMN "briefAr"/)
    expect(sql, 'عمودٌ إلزاميٌّ بلا قيمةٍ افتراضيّة يكسر الصفوفَ القائمة').not.toMatch(/NOT NULL(?!.*DEFAULT)/)
  })

  it('ويُختار من القاعدة ويُمرَّر في الحمولة معا — لا أحدَهما', () => {
    const plan = code(PLAN)
    const block = plan.slice(plan.indexOf('assessments: {'), plan.indexOf('checklist,'))
    expect(block, '`briefAr` غير مختارٍ من القاعدة').toMatch(/select: \{[^}]*briefAr: true/)
    expect(block, '`briefAr` مختارٌ ولا يُمرَّر — الواجهةُ تراه غيرَ معرَّف').toMatch(/briefAr: a\.briefAr/)
  })

  it('والواجهةُ تعلنه في نوعها فلا يضيع صامتا', () => {
    expect(code(WS)).toMatch(/assessments: \{[^}]*briefAr: string \| null/)
  })
})

describe('نموذجُ التكليف — ينشئ ويعدّل', () => {
  it('التعديلُ يذهب إلى معرّف التكليف، والإنشاءُ إلى الشعبة', () => {
    const ws = code(WS)
    expect(ws, 'لا تعديلَ — التكليفُ ما زال يُنشأ فقط').toMatch(/apiPatch\(`\/api\/trainer\/assessments\/\$\{editingId\}`/)
    expect(ws).toMatch(/apiDelete\(`\/api\/trainer\/assessments\/\$\{a\.id\}`/)
    expect(ws).toMatch(/apiPost\(`\/api\/trainer\/cohorts\/\$\{ws\.cohort\.id\}\/assessments`/)
  })

  it('والدرجةُ العظمى لها حقلٌ يكتبه المدرّب — لا قيمةٌ ثابتةٌ تُرسَل', () => {
    const ws = code(WS)
    expect(ws, 'لا حقلَ للدرجة العظمى').toMatch(/onChange=\{\(e\) => setTaskForm\(\{ \.\.\.taskForm, maxScore:/)
  })

  it('والتعليماتُ لها حقلٌ يُكتب ويُرسَل', () => {
    const ws = code(WS)
    expect(ws).toMatch(/setTaskForm\(\{ \.\.\.taskForm, briefAr:/)
    expect(ws, 'التعليماتُ تُكتب ولا تُرسَل').toMatch(/briefAr: taskForm\.briefAr\.trim\(\)/)
  })
})

describe('«لم يُحفَظ» — لكلّ مرحلةٍ وحدَها', () => {
  it('أزرارُ الحفظ الثلاثةُ لا تعمل بلا تغييرٍ في مرحلتها', () => {
    const ws = code(WS)
    for (const [stage, handler] of [
      ['identity', 'saveIdentity'],
      ['modules', 'savePlan'],
      ['resources', 'savePlan'],
    ] as const) {
      /* الزرُّ يُعرف بمعالجه ومرحلتِه معا: `savePlan` زرّان، ويُفرَّق بينهما
         بالشرط الذي يحمله كلٌّ منهما. */
      const re = new RegExp(`disabled=\\{[^}]*!dirty\\.${stage}[^}]*\\}[^>]*onClick=\\{${handler}\\}`)
      expect(ws, `زرُّ «${stage}» يعمل بلا تغيير`).toMatch(re)
    }
  })

  it('والمرحلتان اللتان تتقاسمان الخطّةَ تُقاسان كلٌّ على حدة', () => {
    const ws = code(WS)
    /* لو قِيستا على الكائن كلِّه لأضاءتا معا — فلكلٍّ بصمتُها */
    expect(ws).toMatch(/const modulesKey = \(c: PlanContent\)/)
    expect(ws).toMatch(/const resourcesKey = \(c: PlanContent\)/)
    expect(ws, 'بصمةُ المحاور تشمل المصادر').not.toMatch(/const modulesKey = [^\n]*resources/)
  })

  it('والبصمةُ تُؤخذ ممّا وصل من الخادم — فبعد الحفظ يعود كلُّ شيءٍ نظيفا', () => {
    const ws = code(WS)
    const load = ws.slice(ws.indexOf('const load = useCallback'), ws.indexOf('useEffect(() => { void load(true)'))
    expect(load, 'البصمةُ لا تُجدَّد عند التحميل — تبقى المرحلةُ «لم تُحفظ» بعد حفظها').toContain('setBaseline(')
  })

  it('والخروجُ بتعديلٍ في اليد يُستأذَن فيه', () => {
    const ws = code(WS)
    expect(ws).toMatch(/addEventListener\("beforeunload"/)
    expect(ws, 'التحذيرُ لا يقرأ حالةَ التعديل').toMatch(/dirtyRef\.current/)
  })
})
