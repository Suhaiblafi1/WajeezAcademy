/* «المهامّ والتطبيق العمليّ» — كلمةٌ واحدةٌ في بوّابة المدرّب كلِّها.

   قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): تُبدَّل «التكاليف» في **كلّ** ما
   يراه المدرّب دفعةً واحدة، لا في شريط المراحل وحدَه. وعلّتُه مكتوبةٌ في
   دفتر العمل: من بدّل شاشةً وحدَها رأى «المهامّ» في الخطّة و«التكاليف» في
   لوح الشعبة — وهو بعينه ما شُكي منه في أسماء الدورات مقابل رموزها.

   وهذا الحارسُ هو ما يمنع عودتَها من باب النسخ: شاشةٌ جديدةٌ تُكتب بعد شهرٍ
   فيُنسَخ إليها نصٌّ قديم، ولا يحمرّ شيء.

   **وبوّابةُ الإدارة مستثناةٌ بقصد**: «المهامّ والتكليفات» هناك شيءٌ آخرُ
   تماما — تكليفُ موظّفٍ بعمل (`staff.task.assign`)، لا ما يُسلّمه المتعلّم.
   فالكلمتان تتشابهان ولا تعنيان واحدا، وتوحيدُهما خطأٌ لا إصلاح. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** الملفُّ بلا تعليقاته — فالتاريخُ يُروى في التعليق ولا يُحاسَب عليه */
const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .replace(/^\s*\/\/.*$/gm, '')

/** ما يراه المدرّبُ من شاشات التكاليف — وما يراه المعتمِدُ من الشعبة نفسِها */
const TRAINER_SCREENS = [
  'src/pages/trainer/CohortWorkspace.tsx',
  'src/pages/trainer/CohortOps.tsx',
  'src/pages/trainer/CohortAssignments.tsx',
  'src/pages/trainer/TrainerDashboard.tsx',
  'src/pages/trainer/GradingQueue.tsx',
]

const OLD = /تكليف|تكاليف|التكليف|التكاليف/

describe('لا «تكليف» في بوّابة المدرّب', () => {
  for (const f of TRAINER_SCREENS) {
    it(`⚠️ ${f.split('/').pop()} لا تحمل الكلمةَ القديمة`, () => {
      const hit = code(f).split('\n').find((l) => OLD.test(l))
      expect(hit ?? null, `عادت «التكاليف» في سطر: ${hit?.trim().slice(0, 90)}`).toBeNull()
    })
  }

  it('⚠️ وصفُّ القائمة عند الخادم بالكلمة نفسِها — وهو ما يقرؤه المدرّب', () => {
    /* القائمةُ تُبنى في الخادم (`buildChecklist`) ويُعرض نصُّها حرفيّا في
       الورشة وفي بطاقات «شعبي». وكانت تقول «ألّف تكاليفَ الشعبة» بينما
       الشريطُ فوقها يقول «المهامّ» — نصفُ تبديلٍ نجا من المسح لأنّه خارجَ
       مجلّد الشاشات، وهو بعينه ما بُني هذا الحارسُ ليمنعه. */
    const svc = code('server/services/cohort-plan.service.ts')
    const row = svc.split('\n').find((l) => l.includes("key: 'assignments'"))
    expect(row, 'لا صفَّ للمهامّ في قائمة الجاهزيّة').toBeTruthy()
    expect(OLD.test(row!), `عادت «التكاليف» في صفّ القائمة: ${row!.trim().slice(0, 90)}`).toBe(false)
    expect(row, 'الصفُّ لا يقول الحدَّ الأدنى').toContain('مهمّةً واحدةً على الأقلّ')
  })

  it('⚠️ ومرحلةُ الخطّة باسمها الجديد — والمفتاحُ لم يمسّه التبديل', () => {
    /* المفتاحُ `assignments` عقدٌ مع الخادم وقائمةِ الجاهزيّة: من بدّله
       كسر الحالةَ التي تُقرأ من `ws.checklist`، لا الاسمَ وحدَه. */
    const ws = code('src/pages/trainer/CohortWorkspace.tsx')
    expect(ws).toMatch(/key: "assignments", label: "المهامّ والتطبيق العمليّ"/)
    expect(ws, 'اسمُ الخطوة في رأسها لم يُبدَّل مع الشريط').toMatch(/title: "المهامّ والتطبيق العمليّ"/)
  })

  it('⚠️ واللقاءاتُ صارت «لقاءات مباشرة» — ومفتاحُها `sessions` كما هو', () => {
    expect(code('src/pages/trainer/CohortWorkspace.tsx'))
      .toMatch(/key: "sessions", label: "لقاءات مباشرة"/)
  })

  it('وبوّابةُ الإدارة تُبقي «المهامّ والتكليفات» — فهي تكليفُ موظّفٍ لا تسليمُ متعلّم', () => {
    /* لو وُحّدت الكلمتان لصار طابورُ عمل الموظّفين وتسليماتُ المتعلّمين
       اسما واحدا في منصّةٍ واحدة. */
    expect(code('src/pages/admin/Tasks.tsx')).toContain('المهامّ والتكليفات')
  })
})
