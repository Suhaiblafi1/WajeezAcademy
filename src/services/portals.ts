/* بوّاباتُ هذا الحساب — سؤالٌ واحدٌ في عمر الصفحة.

   الصلاحيّةُ تقول «تستطيع الدخول»، ولا تقول «لك ملفٌّ هنا». ومديرُ النظام
   يملك صلاحيّاتِ البوّابتَين بلا ملفٍّ في أيٍّ منهما، فكانت كلُّ شاشةٍ تسقط
   وحدَها برسالةٍ تقنيّة. فيُسأل الخادمُ مرّةً ويقرّر الإطار. */

import { apiGet } from "./api";

export interface MyPortals {
  trainer: boolean;
  advisor: boolean;
}

/* عند تعذُّر السؤال نفترض أنّ له ملفّا: فالمنعُ الخاطئ أسوأ من رسالةٍ تقنيّة. */
const FALLBACK: MyPortals = { trainer: true, advisor: true };

let cached: Promise<MyPortals> | null = null;

export function loadMyPortals(): Promise<MyPortals> {
  cached ??= apiGet<MyPortals>("/api/me/portals").catch(() => FALLBACK);
  return cached;
}

/** للاختبارات ولتسجيل الخروج — الجوابُ يخصّ حسابا بعينه */
export function resetMyPortalsCache(): void {
  cached = null;
}
