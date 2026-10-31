/* أوّلُ ما جاء به الزائر — يُلتقط عند فتح الموقع ويُرسَل مع إنشاء حسابه.

   الحسابُ والتعليلُ في `src/application/marketing/signup-source.ts`. وهنا التخزينُ وحدَه:
   في ذاكرة المتصفّح المحليّة، وبـ`safe-storage` فلا تُسقط صفحةً حيث تُمنع الذاكرة — ومن
   مُنعت عنده سُجّل بلا مصدر، ولا ينكسر شيء. */

import { keepTouch, touchFromLocation, type FirstTouch } from "@/application/marketing/signup-source";
import { safeGet, safeSet } from "./safe-storage";

const KEY = "wajeez_first_touch";

function stored(): FirstTouch | null {
  const raw = safeGet(KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" ? (v as FirstTouch) : null;
  } catch {
    return null;
  }
}

/** يُنادى مرّةً عند فتح الموقع — والتنقّلُ داخله بعد ذلك لا يُغيّر شيئا */
export function captureFirstTouch(): void {
  if (typeof window === "undefined") return;
  const fresh = touchFromLocation(
    window.location.search, document.referrer, window.location.hostname, window.location.pathname, new Date(),
  );
  const before = stored();
  const keep = keepTouch(before, fresh);
  if (keep !== before) safeSet(KEY, JSON.stringify(keep));
}

/** ما يُرسَل مع إنشاء الحساب — أو لا شيء */
export function firstTouch(): FirstTouch | null {
  return stored();
}

/** هذه الزيارةُ نفسُها — متى فُتحت الصفحةُ ومن أين، بلا أن تُحفظ. تُرسَل مع نموذج المنحة (`MemberGrantPage`) */
export function pageTouchNow(): FirstTouch | null {
  if (typeof window === "undefined") return null;
  return touchFromLocation(window.location.search, document.referrer, window.location.hostname, window.location.pathname, new Date());
}

const VISITOR_KEY = "wajeez_visitor";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** رقمٌ عشوائيٌّ لهذا المتصفّح — يُعدّ به من فتح صفحةَ المنحة مرّةً واحدة (`grant-visit.service.ts`).
    لا يُشتقّ من شيءٍ في الجهاز، ومن مُنعت عنده الذاكرةُ يأخذ رقما جديدا كلَّ مرّة */
export function visitorId(): string {
  const had = safeGet(VISITOR_KEY);
  if (had && UUID_RE.test(had)) return had;
  const fresh = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
  safeSet(VISITOR_KEY, fresh);
  return fresh;
}
