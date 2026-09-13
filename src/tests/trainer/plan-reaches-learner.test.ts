/* وصلُ خطّة المدرّب بالمتعلّم — حرّاسُ الأسلاك لا حرّاسُ المنطق.

   منطقُ العلوّ والمشروعِ محروسٌ في `plan-overlay.test.ts` على البنية
   والسلوك. وهذه تحرس أن تكون الأسلاكُ موصولةً فعلا: أن تُحمَل الخطّةُ في
   حمولة المتعلّم، وأن تقرأها الشاشتان، وأن يصحبَ التسجيلُ الرابطَ إلى
   شاشة الدراسة — فبلا واحدةٍ منها يبقى المدرّبُ يؤلّف في الفراغ كما كان. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① الخادمُ يحمل الخطّةَ مشروعةً ولا يحمل صفَّها', () => {
  const svc = code('server/services/enrollment.service.ts')
  const fn = svc.slice(svc.indexOf('async learnerCohortView'))
  const body = fn.slice(0, fn.indexOf('\n  }'))

  it('يُنتقى أحدثُ خطّةٍ معتمَدةٍ لمدرّب — بالحالات المشتركة لا بقائمةٍ مكتوبةٍ بيدها', () => {
    expect(body, 'لا خطّةَ في الاستعلام').toMatch(/plans: \{/)
    /* قائمةٌ منسوخةٌ هنا تفترق غدا عن `PLAN_VISIBLE_STATUSES` — فيقرأ
       الاستعلامُ مسودّةً ويظنّ المشروعُ أنّه محميّ. */
    expect(body, 'الحالاتُ مكتوبةٌ بيدها لا من المصدر الواحد').toMatch(/status: \{ in: \[\.\.\.PLAN_VISIBLE_STATUSES\] \}/)
    expect(body).toMatch(/trainerId: \{ not: null \}/)
    expect(body).toMatch(/orderBy: \{ createdAt: 'desc' \}/)
  })

  it('والخارجُ مشروعٌ لا خام، والصفُّ يُنزع من الحمولة', () => {
    expect(body, 'الخطّةُ تخرج خاما').toMatch(/trainerPlan: projectPlanForLearner\(/)
    /* `plans` تُفكَّك خارجَ الكائن: بقاؤها تسرّبٌ ثانٍ من بابٍ آخر —
       الحمولةُ تحمل `content` كاملا ومعه الاقتراحات. */
    expect(body, 'صفُّ الخطّة باقٍ في حمولة المتعلّم').toMatch(/const \{ plans, \.\.\.cohort \} = e\.cohort/)
    expect(body).not.toMatch(/return e\s*$/)
  })
})

describe('② شاشتا المتعلّم تقرآن العلوَّ لا الكتالوجَ وحدَه', () => {
  it('قائمةُ الدروس تعلو — ولا تمرّ `full.modules` كما هي', () => {
    const sw = code('src/components/journey/StageWork.tsx')
    expect(sw).toMatch(/overlayModules\(full\?\.modules \?\? \[\], detail\.cohort\.trainerPlan\)/)
    expect(sw, 'الوحداتُ ما زالت من الكتالوج مباشرةً').not.toMatch(/const modules = full\?\.modules \?\? \[\]/)
  })

  it('وشاشةُ الدراسة تعلو بالمعرّف الذي يصحبها — ولا نسخةَ منطقٍ ثانية', () => {
    const ms = code('src/pages/student/ModuleStudy.tsx')
    expect(ms).toMatch(/overlayModule\(/)
    expect(ms, 'المعرّفُ لا يُقرأ من العنوان').toMatch(/params\.get\("e"\)/)
    /* والمحورُ لا يُلتقط من الكتالوج مباشرةً بعد العلوّ */
    expect(ms).not.toMatch(/const mod = full\?\.modules\.find/)
  })

  it('والتسجيلُ يصحب الرابطَ من الرحلة ومن الوحدة إلى تاليتها', () => {
    const sw = code('src/components/journey/StageWork.tsx')
    expect(sw, 'الرابطُ بلا تسجيلٍ فلا تعلو شاشةُ الدراسة').toMatch(/module\/\$\{m\.id\}\?e=\$\{encodeURIComponent\(enrollmentId\)\}/)
    const ms = code('src/pages/student/ModuleStudy.tsx')
    expect(ms, 'الانتقالُ إلى التالية يُسقط التسجيل').toMatch(/module\/\$\{next\.id\}\$\{enrollmentId \?/)
  })

  it('ومصادرُ الخطّة تُعرض للمتعلّم — لا تبقى في الخطّة وحدَها', () => {
    const sw = code('src/components/journey/StageWork.tsx')
    expect(sw).toMatch(/detail\.cohort\.trainerPlan\?\.resources/)
    expect(sw, 'المصادرُ لا تُصيَّر').toMatch(/planResources\.map\(/)
    expect(sw, 'فراغُ اللوح لا يحسب مصادرَ الخطّة').toMatch(/hasResources =[\s\S]{0,220}planResources\.length > 0/)
  })
})

describe('③ نوعُ المصدر يُختار ويُحفظ ويُعرض بمعجمٍ واحد', () => {
  it('المدرّبُ يختار النوعَ من القائمة البيضاء نفسِها', () => {
    const ws = code('src/pages/trainer/CohortWorkspace.tsx')
    expect(ws, 'لا اختيارَ للنوع').toMatch(/RESOURCE_KINDS\.map\(\(k\)/)
    expect(ws, 'القائمةُ مكتوبةٌ بيدها في الشاشة').toMatch(/from "@\/application\/trainer\/plan-overlay"/)
  })

  it('والخادمُ يردّ نوعا مخترَعا عند الحفظ لا عند القراءة فحسب', () => {
    const routes = code('server/http/routes/learning-portal.routes.ts')
    const schema = routes.slice(routes.indexOf('const planContent = z.object({'))
    expect(schema.slice(0, schema.indexOf('liveNoteAr')), 'المخطّطُ يقبل أيَّ نوع').toMatch(/kind: z\.enum\(RESOURCE_KINDS\)/)
  })

  it('والاسمُ العربيُّ معجمٌ واحدٌ للشاشتين — لا نسختان تفترقان', () => {
    const meta = code('src/components/resource-kind-meta.ts')
    expect(meta).toMatch(/export const RESOURCE_META/)
    for (const f of ['src/components/journey/StageWork.tsx', 'src/pages/trainer/CohortWorkspace.tsx']) {
      expect(code(f), `${f} لا يقرأ المعجم`).toContain('from "@/components/resource-kind-meta"')
      /* ولا يكتب أسماءَه بيده: «كتاب صوتيّ» مكتوبةً في شاشةٍ هي النسخةُ الثانية */
      expect(code(f), `${f} يكتب اسمَ نوعٍ بيده`).not.toMatch(/label: "(رابط|فيديو|كتاب|كتاب صوتيّ|منشور|ملفّ)"/)
    }
  })
})
