/* الخطّة المعتمَدة — مصدر واحد للحقيقة بين شاشة النتيجة وصفحة المسار.

   العطب الذي وُضعت له: كانت الخطّة تُكتب في sessionStorage بشكلين مختلفين.
   التبديل يكتب `{ composite: true, chosenIds }` **بلا pathwayId**، وصفحة
   المسار تقرأ بحارس `c.pathwayId === pathway.id`. فـundefined لا يساوي شيئا،
   فتُرفض الخطّة كلها، ويسقط الكود إلى `pathwayCourses[id]` — قائمة المسار
   الجاهز من الكتالوج. وكل المسارات المنشورة فيها خمس دورات بالضبط.

   فالمتعلّم الذي اعتمد خطّة من ستّ دورات كان يصل صفحةً فيها خمس، بعنوان مسارٍ
   لم يخترْه. لا دورة «حُذفت» — الخطّة كلّها استُبدلت بغيرها، بصمت.

   القاعدة هنا: **كلّ كتابة تحمل هوية المضيف، وكلّ قراءة تطابقها.** والشكل
   نسخته الأولى صراحةً (`v`) فسِجلّ قديم من متصفّح مفتوح لا يُقرأ نصفَ قراءة. */

export const ADOPTED_PLAN_KEY = 'wajeez_adopted_plan'

/** اسم الخطّة المركَّبة — لا تستعير اسم المسار المضيف، فهي ليست هو */
export const PERSONAL_PLAN_NAME_AR = 'مسارك الشخصي'

export interface AdoptedPlan {
  v: 1
  /** المسار الذي تُعرض الخطّة تحته — للتوجيه والمطابقة، لا للتسمية */
  hostPathwayId: string
  /** مركَّبة من أكثر من مسار؟ يحدّد الاسم والشارة */
  composed: boolean
  /** الاسم كما يُعرض للمتعلّم */
  nameAr: string
  courseIds: string[]
  giftId: string | null
  /** لحظة الاعتماد — للتشخيص لا للعرض */
  adoptedAt: string
}

function isPlan(x: unknown): x is AdoptedPlan {
  if (!x || typeof x !== 'object') return false
  const p = x as Partial<AdoptedPlan>
  return (
    p.v === 1 &&
    typeof p.hostPathwayId === 'string' && p.hostPathwayId.length > 0 &&
    typeof p.nameAr === 'string' && p.nameAr.length > 0 &&
    Array.isArray(p.courseIds) && p.courseIds.every((c) => typeof c === 'string')
  )
}

export function saveAdoptedPlan(plan: Omit<AdoptedPlan, 'v' | 'adoptedAt'>): AdoptedPlan | null {
  const full: AdoptedPlan = { v: 1, adoptedAt: new Date().toISOString(), ...plan }
  try {
    sessionStorage.setItem(ADOPTED_PLAN_KEY, JSON.stringify(full))
    return full
  } catch {
    /* مساحة ممتلئة أو خصوصية صارمة — الصفحة تسقط على شكلها الافتراضي وتقولها */
    return null
  }
}

/** الخطّة المعتمَدة لهذا المضيف — أو null. لا تُعاد خطّةُ مضيفٍ آخر أبدا. */
export function readAdoptedPlan(hostPathwayId: string | undefined): AdoptedPlan | null {
  if (!hostPathwayId) return null
  try {
    const raw = JSON.parse(sessionStorage.getItem(ADOPTED_PLAN_KEY) ?? 'null')
    if (!isPlan(raw)) return null
    return raw.hostPathwayId === hostPathwayId ? raw : null
  } catch {
    return null
  }
}

/** تعديل دورات خطّة معتمَدة قائمة — يبقي الهوية والاسم كما هما */
export function updateAdoptedCourses(hostPathwayId: string, courseIds: string[]): AdoptedPlan | null {
  const current = readAdoptedPlan(hostPathwayId)
  if (!current) return null
  return saveAdoptedPlan({ ...current, courseIds })
}

export function clearAdoptedPlan(): void {
  try {
    sessionStorage.removeItem(ADOPTED_PLAN_KEY)
  } catch {
    /* لا شيء يُفعل — القراءة تفشل بأمان على أي حال */
  }
}
