/* طبقة تحليلات تراعي الخصوصية — Privacy-first Analytics
   --------------------------------------------------------------
   المبدأ: نتتبع «أحداث الرحلة» فقط (بدأ، أكمل، اشترى)، ولا تُرسَل
   أي إجابة تشخيص أو محتوى شخصي كقيمة للحدث إطلاقا — الخادم يرفضها
   أصلا (قائمة أحداث بيضاء + قيم رمزية قصيرة فقط في POST /api/events).

   الهوية: anonId عشوائي يعيش في localStorage ويميز الجهاز قبل التسجيل،
   ويرتبط بالحساب تلقائيا عند أول حدث بعده (الخادم يشتق userId من كوكي
   الجلسة، لا من العميل). الإرسال: دفعة خفيفة بـ fetch keepalive،
   وnavigator.sendBeacon عند مغادرة الصفحة حتى لا تضيع الأحداث الأخيرة.
*/
export type AnalyticsEvent =
  /* ح-٣: إجابة على تمرين استرجاع — رقم الوحدة والسؤال وصوابه، بلا نص حرّ */
  | 'module_check_answered'
  /* ح-٢: فتح فصل فيديو — رقم الوحدة والفصل */
  | 'module_video_chapter_opened'
  | 'hero_cta_clicked'
  | 'mirror_started'
  | 'mirror_completed'
  | 'diagnostic_started'
  | 'diagnostic_question_completed'
  | 'diagnostic_abandoned'
  | 'diagnostic_completed'
  | 'recommendation_viewed'
  | 'result_teaser_viewed'
  | 'gate_viewed'
  /* الزائر ضغط «أنشئ حسابك» من عرض صفحة المسار — يقيس ما يكسبه إخفاءُ
     المدرّبين ومكان الدفع خلف التسجيل */
  | 'offer_signup_clicked'
  | 'gate_dismissed'
  | 'result_full_viewed'
  | 'account_started'
  | 'account_created'
  | 'account_failed'
  | 'feedback_submitted'
  | 'pathway_viewed'
  | 'course_viewed'
  /* حُذف 'payment_completed': كان يُطلق بعد مؤقّت نافذة دفعٍ وهمية، فيصير
     في التحليلات «مبيعات» لا وجود لها. والدفع الحقيقي حين يُربط يُطلقه من
     الخادم بعد تأكيد المزوّد لا من المتصفّح. */
  | 'checkout_started'
  | 'enroll_request_opened'
  | 'payment_failed'
  | 'refund_requested'
  | 'contact_submitted'
  | 'deepening_started'
  | 'deepening_completed'
  | 'composite_adopted'
  /* اعتماد مسار جاهز — كان <Link> بلا حدث، فلا نعرف كم اعتمد جاهزا مقابل مركَّب */
  | 'pathway_adopted'
  /* شبكة تقييم الجوانب — تُقاس لأننا نحتاج أن نعرف كم يملؤها وكم يتخطاها */
  | 'skills_rated'
  | 'skills_skipped'
  /* بناء مسار من دورة واحدة — الفتح والإضافة والتسمية.
     تُقاس لأنها تجيب سؤالا لا نملك جوابه: هل يبني الناس تركيباتهم فعلا،
     وأين يتوقفون — عند الدورة الواحدة أم عند حدّ الحزمة؟ */
  | 'course_path_opened'
  | 'course_path_added'
  /* اختيارٌ تجاوز سقف البناء فحُفظ للمرحلة التالية — لا رفض صامت */
  | 'course_path_deferred'
  | 'promo_applied'
  | 'course_path_named'

/** سمات وصفية غير شخصية فقط: أرقام أسئلة، مجالات، أنواع شراء — لا نصوص حرة */
type Meta = Record<string, string | number | boolean>

const API_BASE: string = import.meta.env.VITE_API_URL ?? "";
const ANON_KEY = "wajeez_anon";

let cachedAnon: string | null = null;

/** معرف الجهاز المجهول — يُنشأ مرة ويُخزن محليا، null إن مُنع التخزين */
export function anonId(): string | null {
  if (cachedAnon) return cachedAnon;
  try {
    let v = localStorage.getItem(ANON_KEY);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(ANON_KEY, v);
    }
    cachedAnon = v;
    return v;
  } catch {
    return null; // خصوصية صارمة أو مساحة ممتلئة — الحدث يُرسل بلا هوية جهاز
  }
}

interface Pending {
  event: AnalyticsEvent;
  meta: Meta;
}

const pending: Pending[] = [];
let timer: number | null = null;

function bodyOf(e: Pending): string {
  return JSON.stringify({ event: e.event, meta: e.meta, anonId: anonId() ?? undefined });
}

function flush(): void {
  timer = null;
  const batch = pending.splice(0, pending.length);
  for (const e of batch) {
    void fetch(`${API_BASE}/api/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: bodyOf(e),
    }).catch(() => undefined); // تحليلات أفضل جهد — لا تعطل تجربة المستخدم أبدا
  }
}

/** مغادرة الصفحة: نستنزف الطابور بـ sendBeacon لأن fetch قد يُلغى أثناء التفريغ */
function flushOnLeave(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  const batch = pending.splice(0, pending.length);
  for (const e of batch) {
    try {
      navigator.sendBeacon(`${API_BASE}/api/events`, new Blob([bodyOf(e)], { type: "application/json" }));
    } catch {
      /* لا شيء — حدث واحد ضائع أفضل من كسر المغادرة */
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushOnLeave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOnLeave();
  });
}

export function track(event: AnalyticsEvent, meta?: Meta) {
  if (import.meta.env.DEV) {
     
    console.debug(`[analytics] ${event}`, meta ?? {})
  }
  pending.push({ event, meta: meta ?? {} });
  if (document.visibilityState === "hidden") {
    flushOnLeave(); // أحداث التفريغ (مثل الهجر عند المغادرة) تذهب فورا بالـ beacon
    return;
  }
  if (timer === null) timer = window.setTimeout(flush, 400);
}
