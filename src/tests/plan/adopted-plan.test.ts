/* عقد الخطّة المعتمَدة (المرحلة ١).

   هذا الملفّ يثبّت العطب الذي وقع فعلا على الموقع الحيّ: خطّةٌ تُكتب بشكل
   وتُقرأ بحارسٍ لا يطابقه، فتُرفض بصمت ويُعرض غيرها مكانها. فالاختبارات هنا
   ليست على «هل يُحفظ الكائن» بل على **أن القراءة لا تعيد شيئا لم يُعتمد**. */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  saveAdoptedPlan,
  readAdoptedPlan,
  updateAdoptedCourses,
  clearAdoptedPlan,
  PERSONAL_PLAN_NAME_AR,
  ADOPTED_PLAN_KEY,
} from '../../application/plan/adopted-plan'

const PLAN = {
  hostPathwayId: 'PW-A',
  composed: true,
  nameAr: PERSONAL_PLAN_NAME_AR,
  courseIds: ['C-1', 'C-2', 'C-3', 'C-4', 'C-5', 'C-6'],
  giftId: null,
}

/* بيئة الاختبارات هنا Node لا jsdom (لا testing-library في المستودع)، فلا
   تخزينَ في العالم. والوحدة تحت الاختبار منطقٌ خالص فوق واجهة التخزين، فيكفي
   بديلٌ صغير مطابق للعقد — ولا نُدخل jsdom لأجل ثلاثة توابع.

   والمخزنان يُبدَّلان كلاهما بقصد. كان `sessionStorage` وحدَه مُبدَّلا، فلمّا
   صار الحفظُ يقصد `localStorage` أوّلا كان ذلك يرمي في Node — فتسقط الوحدةُ
   إلى احتياطيّها وتمرّ الاختباراتُ كلُّها خضراء **على مسلكٍ غير الذي تدّعي
   قياسه**. أي أنّ الخضرةَ كانت تشهد للاحتياطيّ لا للمقصود. */
function stubStore(name: 'localStorage' | 'sessionStorage') {
  const map = new Map<string, string>()
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: {
      getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
      setItem: (k: string, v: string) => { map.set(k, String(v)) },
      removeItem: (k: string) => { map.delete(k) },
      clear: () => { map.clear() },
      key: (i: number) => [...map.keys()][i] ?? null,
      get length() { return map.size },
    },
  })
}

/** يُسقط التخزينَ الدائم كما تفعل نافذةُ التصفّح الخاصّ */
function denyLocalStorage() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('التخزين ممنوع') },
  })
}

beforeAll(() => {
  stubStore('localStorage')
  stubStore('sessionStorage')
})

beforeEach(() => {
  clearAdoptedPlan()
})

describe('الحفظ والقراءة', () => {
  it('ما يُحفظ هو ما يُقرأ — بست دورات لا خمس', () => {
    saveAdoptedPlan(PLAN)
    const back = readAdoptedPlan('PW-A')
    expect(back?.courseIds).toEqual(PLAN.courseIds)
    expect(back?.courseIds).toHaveLength(6)
    expect(back?.nameAr).toBe(PERSONAL_PLAN_NAME_AR)
    expect(back?.composed).toBe(true)
  })

  it('كل كتابة تحمل هوية المضيف — وهذا ما كان غائبا', () => {
    saveAdoptedPlan(PLAN)
    const raw = JSON.parse(localStorage.getItem(ADOPTED_PLAN_KEY) as string)
    expect(raw.hostPathwayId).toBe('PW-A')
    expect(raw.v).toBe(1)
  })

  it('لا تُعاد خطّةُ مضيفٍ آخر', () => {
    saveAdoptedPlan(PLAN)
    expect(readAdoptedPlan('PW-B')).toBeNull()
    expect(readAdoptedPlan(undefined)).toBeNull()
  })

  it('غياب الخطّة يعيد null لا كائنا ناقصا', () => {
    expect(readAdoptedPlan('PW-A')).toBeNull()
  })
})

describe('السجلّات المعطوبة تُرفض ولا تُقرأ نصف قراءة', () => {
  it('الشكل القديم — بلا hostPathwayId — يُرفض', () => {
    /* هذا حرفيا ما كان يكتبه التبديل: بلا هوية مضيف */
    localStorage.setItem(ADOPTED_PLAN_KEY, JSON.stringify({ composite: true, chosenIds: ['C-1'], giftId: null }))
    expect(readAdoptedPlan('PW-A')).toBeNull()
  })

  it('نسخة غير معروفة تُرفض', () => {
    localStorage.setItem(ADOPTED_PLAN_KEY, JSON.stringify({ ...PLAN, v: 2 }))
    expect(readAdoptedPlan('PW-A')).toBeNull()
  })

  it('نصّ غير صالح لا يرمي', () => {
    localStorage.setItem(ADOPTED_PLAN_KEY, 'ليس JSON')
    expect(() => readAdoptedPlan('PW-A')).not.toThrow()
    expect(readAdoptedPlan('PW-A')).toBeNull()
  })

  it('اسم فارغ أو دورات ليست نصوصا تُرفض', () => {
    localStorage.setItem(ADOPTED_PLAN_KEY, JSON.stringify({ ...PLAN, v: 1, nameAr: '' }))
    expect(readAdoptedPlan('PW-A')).toBeNull()
    localStorage.setItem(ADOPTED_PLAN_KEY, JSON.stringify({ ...PLAN, v: 1, courseIds: [1, 2] }))
    expect(readAdoptedPlan('PW-A')).toBeNull()
  })
})

describe('التعديل', () => {
  it('تبديل دورة يبقي الهوية والاسم', () => {
    saveAdoptedPlan(PLAN)
    updateAdoptedCourses('PW-A', ['C-1', 'C-9', 'C-3', 'C-4', 'C-5', 'C-6'])
    const back = readAdoptedPlan('PW-A')
    expect(back?.courseIds[1]).toBe('C-9')
    expect(back?.courseIds).toHaveLength(6)
    expect(back?.nameAr).toBe(PERSONAL_PLAN_NAME_AR)
    expect(back?.hostPathwayId).toBe('PW-A')
  })

  it('تعديل خطّة غير معتمَدة لا يُنشئ خطّة من عدم', () => {
    expect(updateAdoptedCourses('PW-A', ['C-1'])).toBeNull()
    expect(readAdoptedPlan('PW-A')).toBeNull()
  })
})

describe('المسار الجاهز', () => {
  it('يحمل اسمه هو لا «مسارك الشخصي»', () => {
    saveAdoptedPlan({ ...PLAN, composed: false, nameAr: 'مسار القيادة', courseIds: ['C-1', 'C-2', 'C-3', 'C-4', 'C-5'] })
    const back = readAdoptedPlan('PW-A')
    expect(back?.nameAr).toBe('مسار القيادة')
    expect(back?.composed).toBe(false)
  })
})

/* ═══ البقاء بعد إغلاق التبويب ═══

   العطبُ الذي وُضعت له هذه المجموعة: الخطّةُ كانت في `sessionStorage`، فتموت
   بإغلاق التبويب — وبفتح الرابط في تبويبٍ جديد، وبإرساله إلى مستشار. ولا
   رسالةَ خطأ حين تموت: تسقط الصفحةُ إلى شكلها الأصلع بلا شارةِ تخصيصٍ ولا
   استبدالِ دورات، فيقرؤها صاحبُها «صفحةً قديمة» لا «خطّةً ضاعت». */
describe('الخطّة تبقى بعد إغلاق التبويب', () => {
  it('تُكتب في الدائم لا في الجلسة', () => {
    saveAdoptedPlan(PLAN)
    expect(localStorage.getItem(ADOPTED_PLAN_KEY)).toBeTruthy()
    expect(sessionStorage.getItem(ADOPTED_PLAN_KEY)).toBeNull()
  })

  it('ومسحُ الجلسة — وهو ما يفعله إغلاق التبويب — لا يُضيعها', () => {
    saveAdoptedPlan(PLAN)
    sessionStorage.clear()
    expect(readAdoptedPlan('PW-A')?.courseIds).toEqual(PLAN.courseIds)
  })

  it('وخطّةٌ كُتبت قبل النقل تُهاجَر عند أوّل قراءة — فلا يخسرها تبويبٌ مفتوح', () => {
    localStorage.clear()
    sessionStorage.setItem(ADOPTED_PLAN_KEY, JSON.stringify({ v: 1, adoptedAt: 'x', ...PLAN }))
    expect(readAdoptedPlan('PW-A')?.nameAr).toBe(PERSONAL_PLAN_NAME_AR)
    expect(localStorage.getItem(ADOPTED_PLAN_KEY), 'لم تُرقَّ إلى الدائم').toBeTruthy()
  })

  it('والنسيانُ يمسح المخزنين — وإلّا عادت من القديم بعد مسح الجديد', () => {
    saveAdoptedPlan(PLAN)
    sessionStorage.setItem(ADOPTED_PLAN_KEY, JSON.stringify({ v: 1, adoptedAt: 'x', ...PLAN }))
    clearAdoptedPlan()
    expect(readAdoptedPlan('PW-A')).toBeNull()
  })

  it('وحين يُمنع الدائم (تصفّحٌ خاصّ) تبقى خطّةُ الجلسة — أقلُّ من الدائم وأفضلُ من لا شيء', () => {
    denyLocalStorage()
    try {
      expect(saveAdoptedPlan(PLAN)?.courseIds).toEqual(PLAN.courseIds)
      expect(readAdoptedPlan('PW-A')?.courseIds).toEqual(PLAN.courseIds)
    } finally {
      stubStore('localStorage')
    }
  })
})
