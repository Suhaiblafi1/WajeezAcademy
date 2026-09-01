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

/* ═══ لماذا localStorage لا sessionStorage ═══

   كانت الخطّة تُكتب في sessionStorage، وهو يموت بإغلاق التبويب. فالخطّةُ
   التي بناها التشخيصُ للمتعلّم كانت تعيش تبويبا واحدا لا أكثر، وتضيع بأيّ
   من هذه — وكلُّها طبيعيّةٌ لا شاذّة:

   · يغلق التبويب ثمّ يعود بعد ساعة
   · يفتح الرابط في تبويبٍ جديد
   · **يرسل الرابط إلى أحدٍ ليستشيره** — فيرى المستشارُ صفحةَ كتالوجٍ عاديّة
     لا خطّةَ صاحبه

   وحين تضيع لا تظهر رسالةُ خطأ: تسقط الصفحةُ إلى شكلها الأصلع — بلا شارةِ
   تخصيص، وبلا القدرة على استبدال الدورات. فيقرؤها صاحبُها «صفحةً قديمة»
   لا «خطّةً ضاعت»، ولا يعرف أنّ شيئا فُقد أصلا.

   وlocalStorage يبقى بين الجلسات على الجهاز نفسه. أمّا الانتقالُ بين
   الأجهزة فبابُه الحساب: `syncAdoptedPlan` يرفعها إلى الخادم لمن سجّل.

   والهجرة تحتَ: من كانت خطّتُه في تبويبٍ مفتوحٍ لحظةَ النشر لا تُفقد — تُقرأ
   من القديم مرّةً وتُكتب في الجديد. */
const LEGACY_SESSION_READ = true

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
  const body = JSON.stringify(full)
  try {
    localStorage.setItem(ADOPTED_PLAN_KEY, body)
  } catch {
    /* مساحة ممتلئة أو خصوصية صارمة — نجرّب الجلسة، فخطّةُ تبويبٍ واحد
       أفضلُ من لا خطّة. والصفحة تسقط على شكلها الافتراضي إن فشل الاثنان. */
    try {
      sessionStorage.setItem(ADOPTED_PLAN_KEY, body)
      return full
    } catch {
      return null
    }
  }
  /* ولا يبقى صدىً في الجلسة يُقرأ بعد تعديلٍ في الدائم */
  try { sessionStorage.removeItem(ADOPTED_PLAN_KEY) } catch { /* لا يضرّ بقاؤه */ }
  return full
}

/** الخطّة المعتمَدة لهذا المضيف — أو null. لا تُعاد خطّةُ مضيفٍ آخر أبدا. */
export function readAdoptedPlan(hostPathwayId: string | undefined): AdoptedPlan | null {
  if (!hostPathwayId) return null
  const parse = (raw: string | null): AdoptedPlan | null => {
    try {
      const x = JSON.parse(raw ?? 'null')
      return isPlan(x) ? x : null
    } catch {
      return null
    }
  }
  let plan: AdoptedPlan | null = null
  try {
    plan = parse(localStorage.getItem(ADOPTED_PLAN_KEY))
  } catch {
    /* التخزين ممنوع — تبقى الجلسة */
  }
  /* هجرةُ خطّةٍ كُتبت قبل النقل: تُقرأ مرّةً وتُرقّى إلى الدائم */
  if (!plan && LEGACY_SESSION_READ) {
    try {
      plan = parse(sessionStorage.getItem(ADOPTED_PLAN_KEY))
      if (plan) {
        try { localStorage.setItem(ADOPTED_PLAN_KEY, JSON.stringify(plan)) } catch { /* تبقى في الجلسة */ }
      }
    } catch {
      /* لا تخزينَ أصلا */
    }
  }
  if (!plan) return null
  return plan.hostPathwayId === hostPathwayId ? plan : null
}

/** تعديل دورات خطّة معتمَدة قائمة — يبقي الهوية والاسم كما هما */
export function updateAdoptedCourses(hostPathwayId: string, courseIds: string[]): AdoptedPlan | null {
  const current = readAdoptedPlan(hostPathwayId)
  if (!current) return null
  return saveAdoptedPlan({ ...current, courseIds })
}

/** يُرسل الخطّة إلى الخادم لتبقى بعد إغلاق التبويب — أفضل جهد.

    لماذا «أفضل جهد» ولا يُسقط الاعتماد عند الفشل: الضيف بلا حساب لا خادم له،
    والمسجَّل الذي انقطعت شبكتُه ما زال أمامه خطّته في هذه الجلسة. فالفشل يُخفض
    التجربة ولا يُلغيها. ومن كان له حساب صار للخطّة بيتٌ يبقى. */
export async function syncAdoptedPlan(plan: Omit<AdoptedPlan, 'v' | 'adoptedAt'>): Promise<boolean> {
  try {
    const res = await fetch('/api/learner/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        nameAr: plan.nameAr,
        composed: plan.composed,
        hostPathwayId: plan.hostPathwayId,
        ...(plan.giftId ? { giftCourseId: plan.giftId } : {}),
        courseIds: plan.courseIds,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** يُنسي الخطّة من المخزنين معا — وإلّا عادت من القديم بعد مسحِ الجديد */
export function clearAdoptedPlan(): void {
  try { localStorage.removeItem(ADOPTED_PLAN_KEY) } catch { /* القراءة تفشل بأمان */ }
  try { sessionStorage.removeItem(ADOPTED_PLAN_KEY) } catch { /* كذلك */ }
}
