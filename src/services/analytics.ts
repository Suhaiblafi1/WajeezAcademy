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
/* اتّحادُ الأحداث يُشتقّ من القائمة المشتركة لا يُكتب هنا: الخادمُ يقرأ
   القائمةَ نفسَها، فلا تشيخ مرآةٌ منهما (application/analytics/events.ts). */
export type { AnalyticsEvent } from "../application/analytics/events";
import type { AnalyticsEvent } from "../application/analytics/events";

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
