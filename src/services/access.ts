/**
 * خدمة الوصول والاستحقاق — Access / Entitlement Layer
 * -------------------------------------------------------
 * الآن: محاكاة محلية. الدفع الناجح (StripeCheckout داخل صفحة المسار) يستدعي
 * grantEnrollment() فيُحفظ الاستحقاق في localStorage وتُفتح بوابة الطالب.
 *
 * عند النقل إلى Replit (الوثيقة: GHL-first + طبقة مخصصة):
 *   - يستقبل الخادم webhook الدفع من Stripe/GHL، يتحقق من التوقيع،
 *     وينشئ PathEnrollment واحدا لكل حدث (idempotency key).
 *   - تستبدل getEnrollment() هنا بنداء GET /api/me/enrollment محمي بجلسة الدخول.
 *   - لا تمرر أي مفاتيح للمتصفح — المفاتيح كلها server-side.
 */

export interface Enrollment {
  pathwayId: string;
  pathwayName: string;
  courseIds: string[];
  giftId?: string | null;
  kind: "pathway" | "course" | "courses";
  amount: number;
  purchasedAt: number;
  /** مرجع الطلب — عند الربط الحقيقي يصبح payment_intent / invoice id */
  ref: string;
}

const KEY = "wajeez_enrollment";

export function grantEnrollment(e: Omit<Enrollment, "purchasedAt" | "ref">): Enrollment {
  const full: Enrollment = {
    ...e,
    purchasedAt: Date.now(),
    ref: `WJ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  };
  localStorage.setItem(KEY, JSON.stringify(full));
  return full;
}

export function getEnrollment(): Enrollment | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Enrollment) : null;
  } catch {
    return null;
  }
}

/** وضع المعاينة التجريبية — للمالك أثناء التطوير فقط، يُزال عند الربط الحقيقي */
export function enablePreview() {
  localStorage.setItem("wajeez_portal_preview", "1");
}
export function disablePreview() {
  localStorage.removeItem("wajeez_portal_preview");
}
export function isPreview(): boolean {
  return localStorage.getItem("wajeez_portal_preview") === "1";
}

/** علم المالك: يُفتح مرة واحدة عبر ?preview=owner في العنوان ويُخزن محليا —
    لا يظهر زر المعاينة ولا بوابات الفريق لمن لم يفتح هذا العلم */
const OWNER_KEY = "wajeez_owner_gateways";
export function unlockOwner(): void {
  localStorage.setItem(OWNER_KEY, "1");
}
export function isOwnerUnlocked(): boolean {
  return localStorage.getItem(OWNER_KEY) === "1";
}

/** هل يحق للمستخدم دخول البوابة؟ دفع سابق أو معاينة تجريبية */
export function canAccessPortal(): boolean {
  return getEnrollment() !== null || isPreview();
}
