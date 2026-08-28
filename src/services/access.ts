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

/* حُذف وضعُ المعاينة كلُّه (`enablePreview` · `disablePreview` · `isPreview` ·
   `unlockOwner` · `isOwnerUnlocked` · `canAccessPortal`). كان علمٌ في
   localStorage يفتح بوابةَ الطالب بلا حساب، ويجعل حارسَ الأدوار يمرّر أيَّ
   دورٍ بلا جلسة. ولمّا زالت البيانات المحاكاة لم يبق للمعاينة ما تعرضه.
   البوابات كلُّها بجلسةٍ وصلاحيةٍ حقيقيتين. */
