/* خطّةُ المتعلّم بعد تشخيصه — القواعدُ التي كانت صامتة.

   هذه الدوالُّ كانت داخلَ `src/pages/Diagnostic.tsx` غيرَ مصدَّرة، فلا
   يُختبَر منها شيء — **ومنها تُشتقّ دوراتُ المتعلّم وعليها يُبنى سعرُه**.
   ولم يتغيّر سلوكُها بالإخراج؛ الجديدُ أنّ ما كان منطوقا في تعليقٍ صار
   مشروطا في اختبار. وأخطرُ ما تحرسه: **ترتيبُ الفروع** — فانقلابُ فرعَين
   يعطي متعلّما خطّةً أخرى وسعرا آخر، ولا شاشةَ تصرخ بذلك. */

import { describe, expect, it } from 'vitest'
import {
  JOURNEY_STAGES,
  MODULE_STAGE,
  QC_STAGE,
  composedPrimaryOf,
  planCourseIdsOf,
  progressFromSession,
  stageIndexOf,
} from '../../application/diagnostic/plan-selection'
import { questionBank } from '../../domain/diagnostic/catalog'
import { pathwayCourses, MAX_PATHWAY_COURSES } from '../../data/courses'
import type { DiagQuestion, DiagResult } from '../../data/diagnostic'

/* نتيجةٌ بأقلِّ ما تحتاجه الدوالّ — الحقولُ الأخرى لا تدخل القرار */
const resultWith = (resultJson: Record<string, unknown>) =>
  ({ resultJson } as unknown as DiagResult)

const q = (id: string, module: string) => ({ id, module } as unknown as DiagQuestion)

describe('دوراتُ الخطّة — ترتيبُ الفروع', () => {
  it('النتيجةُ المركَّبةُ تغلب المسارَ المؤلَّف، ولو وُجدا معا', () => {
    const res = resultWith({
      composite: { courses: [{ courseId: 'C-A', sequence: 1 }, { courseId: 'C-B', sequence: 2 }] },
      composed_path: { courses: [{ courseId: 'C-Z' }], matchesPathwayId: null },
    })
    expect(planCourseIdsOf(res, 'PW-ANY')).toEqual(['C-A', 'C-B'])
    /* والمؤلَّفُ لا يُعرض أصلا حين توجد مركَّبة — لا اقتراحان متضاربان */
    expect(composedPrimaryOf(res)).toBeNull()
  })

  it('والمركَّبةُ تُرتَّب بالتسلسل لا بترتيب وصولها', () => {
    const res = resultWith({
      composite: {
        courses: [
          { courseId: 'C-THIRD', sequence: 3 },
          { courseId: 'C-FIRST', sequence: 1 },
          { courseId: 'C-SECOND', sequence: 2 },
        ],
      },
    })
    expect(planCourseIdsOf(res, undefined)).toEqual(['C-FIRST', 'C-SECOND', 'C-THIRD'])
  })

  it('والمسارُ المؤلَّفُ يُعرض بترتيب مصفوفته كما بناه المحرّك', () => {
    const res = resultWith({
      composed_path: { courses: [{ courseId: 'C-2' }, { courseId: 'C-1' }], matchesPathwayId: null },
    })
    expect(planCourseIdsOf(res, 'PW-ANY')).toEqual(['C-2', 'C-1'])
  })

  it('ومؤلَّفٌ يطابق مسارا قائما ليس اقتراحا مستقلّا — فتُعرض دوراتُ المضيف', () => {
    const host = Object.keys(pathwayCourses)[0]
    const res = resultWith({
      composed_path: { courses: [{ courseId: 'C-X' }], matchesPathwayId: host },
    })
    expect(composedPrimaryOf(res)).toBeNull()
    expect(planCourseIdsOf(res, host)).toEqual(pathwayCourses[host].slice(0, MAX_PATHWAY_COURSES))
  })

  it('ومؤلَّفٌ بلا دورةٍ واحدةٍ لا يُعرض — قائمةٌ فارغةٌ ليست اقتراحا', () => {
    const res = resultWith({ composed_path: { courses: [], matchesPathwayId: null } })
    expect(composedPrimaryOf(res)).toBeNull()
  })
})

describe('السقفُ غيرُ متماثلٍ بقصد', () => {
  it('دوراتُ المسار المضيف تُقصّ عند الحدّ', () => {
    const host = Object.entries(pathwayCourses).find(([, cs]) => cs.length > MAX_PATHWAY_COURSES)
    /* إن لم يوجد مسارٌ أطولُ من الحدّ فالشرطُ يبقى صحيحا بلا قصّ */
    const [id, courses] = host ?? Object.entries(pathwayCourses)[0]
    expect(planCourseIdsOf(null, id)).toEqual(courses.slice(0, MAX_PATHWAY_COURSES))
    expect(planCourseIdsOf(null, id).length).toBeLessThanOrEqual(MAX_PATHWAY_COURSES)
  })

  it('والمركَّبةُ لا تُقصّ — قرارُ محرّكٍ صريحٌ لا قائمةٌ افتراضيّة', () => {
    const many = Array.from({ length: MAX_PATHWAY_COURSES + 3 }, (_, i) => ({
      courseId: `C-${i}`, sequence: i,
    }))
    const ids = planCourseIdsOf(resultWith({ composite: { courses: many } }), undefined)
    expect(ids).toHaveLength(MAX_PATHWAY_COURSES + 3)
  })
})

describe('الحالاتُ الحدّيّة لا ترمي', () => {
  it('لا نتيجةَ ولا مسارَ مضيف → خطّةٌ فارغة', () => {
    expect(planCourseIdsOf(null, undefined)).toEqual([])
  })

  it('ومسارٌ مضيفٌ مجهولٌ → خطّةٌ فارغةٌ لا خطأ', () => {
    expect(planCourseIdsOf(null, 'PW-NOT-A-REAL-ID')).toEqual([])
  })

  it('ونتيجةٌ بلا حقلَي الخطّة → دوراتُ المضيف', () => {
    const host = Object.keys(pathwayCourses)[0]
    expect(planCourseIdsOf(resultWith({}), host)).toEqual(pathwayCourses[host].slice(0, MAX_PATHWAY_COURSES))
  })
})

describe('مرحلةُ السؤال على شريط التقدّم', () => {
  it('كلُّ وحدةٍ في بنك الأسئلة **الحيّ** لها مرحلةٌ صريحة', () => {
    /* هذا هو الحرسُ الحقيقيّ: الدالّةُ تُسقط ما لا تعرفه في المرحلة الأخيرة،
       وقد وقع ذلك فعلا في أسئلة القرار — «المرحلة ٥ من ٥» في السؤال الأوّل.
       فمن أضاف وحدةَ أسئلةٍ جديدةً يسقط اختبارُه هنا، لا يكتشفها متعلّم. */
    expect(questionBank.length).toBeGreaterThan(0)
    const mapped = (moduleId: string) =>
      MODULE_STAGE[moduleId] !== undefined ||
      moduleId.startsWith('M3') ||
      /* أو تكون كلُّ أسئلةِ الوحدة موزَّعةً بمعرّفها (حالةُ `QC`) */
      questionBank
        .filter((bq) => bq.module_id === moduleId)
        .every((bq) => QC_STAGE[bq.question_id] !== undefined)
    const unmapped = [...new Set(questionBank.map((bq) => bq.module_id))].filter((m) => !mapped(m))
    expect(unmapped).toEqual([])
  })

  it('وأسئلةُ القرار تُوزَّع بمعرّفها لا بوحدتها — ثلاثُ مراحلَ من وحدةٍ واحدة', () => {
    const stages = new Set(Object.values(QC_STAGE))
    expect(stages.size).toBeGreaterThan(1)
    for (const [id, stage] of Object.entries(QC_STAGE)) {
      expect(stageIndexOf(q(id, 'QC'))).toBe(stage)
    }
  })

  it('ووحداتُ `M3*` كلُّها في المرحلة الثالثة بالبادئة', () => {
    expect(stageIndexOf(q('x', 'M3'))).toBe(2)
    expect(stageIndexOf(q('x', 'M3B'))).toBe(2)
  })

  it('ولا سؤالَ يعني المرحلةَ الأولى لا الأخيرة', () => {
    expect(stageIndexOf(null)).toBe(0)
  })

  it('والمراحلُ خمسٌ — والدالّةُ لا تُرجع ما يخرج عن الشريط', () => {
    expect(JOURNEY_STAGES).toHaveLength(5)
    for (const bq of questionBank) {
      const idx = stageIndexOf(q(bq.question_id, bq.module_id))
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(JOURNEY_STAGES.length)
    }
  })
})

/* سلسلةُ الشروط كما كانت حرفيّا في الصفحة قبل الإخراج — تُحفظ هنا **حاكما**
   لا نسخةً ثانية: التحويلُ إلى جدولٍ (`MODULE_STAGE`) كان ليجعل الاختبارَ
   يمرّ على البنك، والسؤالُ الذي يستحقّ جوابا: هل غيّر التحويلُ قيمةً واحدة؟
   فتُقارَن الدالّةُ بالسلسلة على كلّ وحدةٍ في البنك الحيّ وعلى أسماءٍ
   مصطنعةٍ لا وجودَ لها — ولو اختلفتا في مدخلٍ واحدٍ سقط الاختبار. */
function stageByOriginalChain(module: string): number {
  if (module === 'M0' || module === 'M1') return 0
  if (module === 'M2' || module === 'M2B' || module === 'M8') return 1
  if (module.startsWith('M3')) return 2
  if (module === 'M4' || module === 'M4B' || module === 'M5' || module === 'M6') return 3
  return 4
}

describe('التحويلُ إلى جدولٍ لم يغيّر قيمةً واحدة', () => {
  it('الدالّةُ تطابق سلسلةَ الشروط الأصليّة على كلّ وحدةٍ في البنك', () => {
    for (const bq of questionBank) {
      if (QC_STAGE[bq.question_id] !== undefined) continue // موزَّعةٌ بمعرّفها
      expect(stageIndexOf(q(bq.question_id, bq.module_id))).toBe(stageByOriginalChain(bq.module_id))
    }
  })

  it('وتطابقها على وحداتِ السلسلة كلِّها وعلى أسماءٍ مجهولة', () => {
    const names = [
      'M0', 'M1', 'M2', 'M2B', 'M8', 'M3', 'M3A', 'M3B', 'M3C', 'M3D', 'M3E', 'M3Z',
      'M4', 'M4B', 'M5', 'M6', 'M7', 'M9', 'M10', 'QC', 'ZZ', '', 'm3', 'M', 'M30',
    ]
    for (const n of names) {
      expect(stageIndexOf(q('unmapped-id', n))).toBe(stageByOriginalChain(n))
    }
  })
})

describe('استئنافُ التشخيص', () => {
  it('لا استئنافَ دون جوابَين — سؤالٌ واحدٌ ليس تقدّما يُحفظ', () => {
    expect(progressFromSession({ answers: [{ questionId: 'a', value: '1' }], savedAt: '2026-09-04T10:00:00Z' })).toBeNull()
    expect(progressFromSession(null)).toBeNull()
  })

  it('والأجوبةُ المتعدّدةُ تُجمع بفاصلة، والترتيبُ يُحفظ كما سُئل', () => {
    const p = progressFromSession({
      answers: [
        { questionId: 'q1', value: 'one' },
        { questionId: 'q2', value: ['a', 'b', 'c'] },
      ],
      savedAt: '2026-09-04T10:00:00Z',
    })
    expect(p?.answers).toEqual({ q1: 'one', q2: 'a,b,c' })
    expect(p?.asked).toEqual(['q1', 'q2'])
    expect(p?.savedAt).toBe(Date.parse('2026-09-04T10:00:00Z'))
  })

  it('وتاريخٌ غيرُ مقروءٍ يعود إلى «الآن» لا إلى صفرِ الزمن', () => {
    const now = 1_700_000_000_000
    const p = progressFromSession({
      answers: [{ questionId: 'q1', value: 'x' }, { questionId: 'q2', value: 'y' }],
      savedAt: 'ليس تاريخا',
    }, now)
    expect(p?.savedAt).toBe(now)
  })
})
