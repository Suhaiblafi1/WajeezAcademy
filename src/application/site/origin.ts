/* أصل الموقع القانوني — مصدر واحد للنطاق الذي نقول للعالم إنه بيتنا.

   النطاق الحيّ www.wajeezacademy.com، والموقع عليه اليوم على خادمٍ نملكه
   (حاويات Docker خلف Caddy — `deploy/README.md`). وكان الأصل مكتوبا حرفا في
   مكانين — SeoHead
   وindex.html — فكل صفحة تُعلن canonical إلى نطاق لا يستجيب: زاحف الفهرسة
   يُحال إلى عدم، ورابطٌ يُشارَك في واتساب أو تويتر يُقرأ عنوانه من الوسم
   الساكن (البوتات لا تشغّل React) فتفشل معاينته.

   ── ولماذا تغيّر هذا الثابت (٥ سبتمبر ٢٠٢٦) ──

   كان `academy.wajeez.com` — نطاقا حُجز ولم يُوجَّه قطّ. والموقع انتقل إلى
   `www.wajeezacademy.com`، ولا ذكر لهذا النطاق في المستودع كلِّه. فبناءٌ لا
   يُضبط فيه `VITE_SITE_ORIGIN` كان يسقط إلى نطاقٍ ليس نطاقَ أحد: canonical
   وog:url وog:image وخريطةُ الموقع وrobots كلُّها تشير إلى العدم. والاحتياطيُّ
   يجب أن يكون **النطاق الحيّ** لا نطاقا مأمولا — فحين يُنسى المتغيّر يقع
   السقوطُ على الصواب لا على الخطأ.

   والترتيب هنا يصحّح نفسه بلا تدخل:
     ١) VITE_SITE_ORIGIN إن ضُبط وقت البناء — الكلمة الأخيرة للمالك، وهو
        الموضع الصحيح لضبطه: وسيطُ بناءٍ يُمرَّر إلى `Dockerfile`. ⚠️ ولا
        يُمرَّر اليوم — فالوقوعُ دائما على (٣)، وهو الصواب لحسن الحظّ.
     ٢) وإلا أصلُ التشغيل الفعلي في المتصفح.
     ٣) وإلا النطاق الحيّ — للتصيير خارج المتصفح.
   ولا localhost في الأصل القانوني أبدا: تُستثنى المضيفات المحلية في (٢). */

/** النطاق الحيّ للموقع — يُعلن هنا مرة واحدة */
export const CANONICAL_ORIGIN = 'https://www.wajeezacademy.com'

const isLocal = (host: string) =>
  host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')

export function siteOrigin(): string {
  const configured = import.meta.env?.VITE_SITE_ORIGIN
  if (typeof configured === 'string' && configured.length > 0) return configured.replace(/\/+$/, '')
  if (typeof window !== 'undefined' && window.location && !isLocal(window.location.hostname)) {
    return window.location.origin
  }
  return CANONICAL_ORIGIN
}
