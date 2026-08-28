# دليل النقل إلى الإنتاج — أكاديمي وجيز

هذا الدليل يحوّل النسخة المحلية الحالية إلى إطلاق حقيقي على Replit (أو أي استضافة Node).
كل ما في الموقع اليوم يعمل محليا بواجهات جاهزة للربط — هذا الملف يحدد أين يربط كل جزء.

---

## 1) النطاق والـ SEO

النطاق النهائي: **`academy.wajeez.com`**. والموقع اليوم في فترة تجريبية على
نطاق Vercel.

لا تحرّر النطاق في أي ملف. الأصل القانوني يُحقن وقت البناء من مصدر واحد
(`src/application/site/origin.ts` وإضافة `wajeez-site-origin` في
`vite.config.ts`) في: `index.html` (canonical وog:url وog:image وJSON-LD)،
و`public/sitemap.xml`، و`public/robots.txt`، و`SeoHead` وقت التشغيل.

الترتيب الذي يُختار به الأصل:

| # | المصدر | متى يُستعمل |
|---|---|---|
| ١ | `VITE_SITE_ORIGIN` | إن ضُبط في متغيّرات Vercel — الكلمة الأخيرة |
| ٢ | `https://$VERCEL_PROJECT_PRODUCTION_URL` | الفترة التجريبية: يوفّره البناء نفسه |
| ٣ | `academy.wajeez.com` | البناء المحلي وأي تصيير خارج المتصفح |

**يوم يشير النطاق النهائي إلى النشرة**، الخطوات ثلاث لا أكثر:

1. أضف النطاق في Vercel → Domains ووجّه سجل DNS.
2. اضبط في متغيّرات Vercel (Production):
   - `VITE_SITE_ORIGIN=https://academy.wajeez.com` — للوسوم الساكنة والخريطة.
   - `APP_URL=https://academy.wajeez.com` — لروابط الرسائل الصادرة
     (`publicSiteUrl()` في `server/services/notification.service.ts`)، وإلا
     خرجت الروابط على نطاق Vercel.
3. أعد النشر، ثم أضف الموقع إلى Google Search Console وقدّم
   `‎/sitemap.xml`.

وحارس `src/tests/site-origin.test.ts` يمنع عودة النطاق مكتوبا بالأيدي.

## 2) المصادقة (إحلال المخزن المحلي)

الواجهة في `src/services/auth.ts` تبقى كما هي؛ تُستبدل الدوال بنداءات API:

| الدالة الحالية | تستبدل بـ |
|---|---|
| `signUp` | `POST /api/auth/signup` — تجزئة كلمة المرور في الخادم (bcrypt/argon2) |
| `signIn` | `POST /api/auth/signin` — جلسة موقعة + انتهاء صلاحية |
| `requestPasswordReset` | بريد استعادة حقيقي برمز مؤقت |
| `resendVerification` / `markVerified` | تدفق تحقق بالبريد |
| القفل بعد 5 محاولات | يُطبق في الخادم أيضا (rate limiting) |

- أزرار Google/LinkedIn مخفية خلف `OAUTH_READY=false` — لا تُظهرها إلا بعد اكتمال OAuth ومختبَره، ثم اقلب العلم.
- بوابات الفريق الداخلية (`?preview=owner`) تُحذف في الإنتاج وتُستبدل بأدوار: `student | trainer | advisor | admin` في جدول المستخدمين، وتُفحص الصلاحية server-side في كل طلب.

## 3) الدفع — Stripe

- نافذة الدفع الحالية (`StripeCheckout` في `src/pages/Pathway.tsx`) محاكاة. تُستبدل بـ Stripe Checkout أو Payment Element.
- القواعد الإلزامية:
  1. إنشاء الـ PaymentIntent في الخادم فقط.
  2. استقبال `webhook` والتحقق من توقيعه بـ `STRIPE_WEBHOOK_SECRET`.
  3. إنشاء التسجيل (Enrollment) مرة واحدة لكل حدث دفع — idempotency key.
  4. إرسال بريد التأكيد وفتح منصة الطالب من حدث الـ webhook نفسه — لا من المتصفح.
  5. حالات الفشل تعرض رسالة عربية واضحة وتُسجل `payment_failed` في التحليلات.
- `src/services/access.ts` → `getEnrollment()` تُستبدل بـ `GET /api/me/enrollment` محمي بالجلسة.

## 4) البريد المعاملاتي

- مزود مقترح: Resend أو Postmark (أسهل ضبطا مع Replit).
- قبل الإرسال: اضبط `SPF` و`DKIM` و`DMARC` على نطاق `wajeez.co` وإلا وقعت الرسائل في المهملات.
- الرسائل المطلوبة: تأكيد الحساب، استعادة كلمة المرور، تأكيد الدفع مع الفاتورة، رد نموذج التواصل بالرقم المرجعي.

## 5) الدورات المباشرة — زووم

- أنشئ تطبيق Server-to-Server OAuth في Zoom Marketplace وضع المفاتيح في البيئة.
- `src/services/zoom.ts` جاهز كنقطة ربط: إنشاء اللقاءات عند فتح الشعبة، وإرسال الروابط للمسجلين، وتسجيل الحضور.
- لا تُنشئ اجتماعات من المتصفح — كل نداءات زووم من الخادم.

## 6) ترويسات الأمان (تُضبط في الخادم عند النشر)

```
Content-Security-Policy: default-src 'self'; img-src 'self' https://images.unsplash.com https://wajeez.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## 7) الأداء

- المقاييس المستهدفة في Lighthouse: أداء 90 · وصول 95 · أفضل ممارسات 95 · SEO 95.
- الصور الحالية من Unsplash بروابط مضغوطة (`w=` + `q=80`)؛ عند الإنتاج انقلها إلى CDN خاص أو حوّلها WebP/AVIF.
- فعّل تقسيم الشيفرة للبوابات الداخلية: `React.lazy` على مسارات `/student /advisor /trainer /admin`.
- راقب حزمة البناء: `npm run build` يجب أن تبقى الرئيسية تحت 300KB مضغوطة.

## 8) التحليلات

- `src/services/analytics.ts` → دالة `track()` هي نقطة الربط الوحيدة. اربطها بمزودك.
- القاعدة الذهبية المطبقة في الكود: لا تُرسَل إجابات التشخيص ولا أي محتوى شخصي — أحداث وصفية فقط.
- الأحداث المربوطة حاليا: `hero_cta_clicked, mirror_started, mirror_completed, diagnostic_started, diagnostic_question_completed, diagnostic_abandoned, diagnostic_completed, recommendation_viewed, account_started, account_created, account_failed, pathway_viewed, course_viewed, checkout_started, payment_completed, contact_submitted, refund_requested`.

## 9) النسخ الاحتياطي والمراقبة

- قاعدة البيانات (عند إضافتها): نسخ احتياطي يومي + اختبار استعادة شهري.
- سجل أخطاء الخادم (Sentry أو ما يكافئه) مع إخفاء أي بيانات شخصية من السجلات.

## 10) قائمة فحص الإطلاق

- [ ] النطاق والـ canonical والخريطة محدثة
- [ ] OAuth حقيقي مختبَر ثم `OAUTH_READY = true`
- [ ] Stripe webhook موقّع + idempotency + بريد التأكيد يعمل
- [ ] SPF/DKIM/DMARC مضبوطة والبريد التجريبي يصل للصندوق الوارد
- [ ] زووم ينشئ لقاء تجريبيا من الخادم
- [ ] رقم واتساب الرسمي في `WHATSAPP_BUSINESS_NUMBER` وفي `src/data/stories.ts → CONTACT.whatsapp`
- [ ] السجل التجاري والرقم الضريبي عُبّئا في صفحتي الشروط والخصوصية
- [ ] حذف علم `?preview=owner` وبوابات الفريق من `/auth`
- [ ] Lighthouse: 90 / 95 / 95 / 95
- [ ] تجربة كاملة بجهاز حقيقي: وقفة صدق ← تشخيص ← نتيجة ← حساب ← دفع تجريبي ← بوابة طالب
