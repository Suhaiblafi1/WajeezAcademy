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
