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
   sessionStorage. والوحدة تحت الاختبار منطقٌ خالص فوق واجهة التخزين، فيكفي
   بديلٌ صغير مطابق للعقد — ولا نُدخل jsdom لأجل ثلاثة توابع. */
beforeAll(() => {
  if (typeof globalThis.sessionStorage !== 'undefined') return
  const map = new Map<string, string>()
  Object.defineProperty(globalThis, 'sessionStorage', {
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
    const raw = JSON.parse(sessionStorage.getItem(ADOPTED_PLAN_KEY) as string)
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
    sessionStorage.setItem(ADOPTED_PLAN_KEY, JSON.stringify({ composite: true, chosenIds: ['C-1'], giftId: null }))
    expect(readAdoptedPlan('PW-A')).toBeNull()
  })

  it('نسخة غير معروفة تُرفض', () => {
    sessionStorage.setItem(ADOPTED_PLAN_KEY, JSON.stringify({ ...PLAN, v: 2 }))
    expect(readAdoptedPlan('PW-A')).toBeNull()
  })

  it('نصّ غير صالح لا يرمي', () => {
    sessionStorage.setItem(ADOPTED_PLAN_KEY, 'ليس JSON')
    expect(() => readAdoptedPlan('PW-A')).not.toThrow()
    expect(readAdoptedPlan('PW-A')).toBeNull()
  })

  it('اسم فارغ أو دورات ليست نصوصا تُرفض', () => {
    sessionStorage.setItem(ADOPTED_PLAN_KEY, JSON.stringify({ ...PLAN, v: 1, nameAr: '' }))
    expect(readAdoptedPlan('PW-A')).toBeNull()
    sessionStorage.setItem(ADOPTED_PLAN_KEY, JSON.stringify({ ...PLAN, v: 1, courseIds: [1, 2] }))
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
