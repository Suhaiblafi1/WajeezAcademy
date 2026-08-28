/* أصل الموقع القانوني — مصدر واحد للنطاق الذي نقول للعالم إنه بيتنا.

   النطاق النهائي academy.wajeez.com، والموقع اليوم في فترة تجريبية على نطاق
   Vercel. وكان الأصل مكتوبا حرفا في مكانين — SeoHead وindex.html — بالنطاق
   النهائي دائما. فكل صفحة في الفترة التجريبية تُعلن canonical إلى نطاق لا
   يستجيب بعد: زاحف الفهرسة يُحال إلى عدم، ورابطٌ يُشارَك في واتساب أو تويتر
   يُقرأ عنوانه من الوسم الساكن (البوتات لا تشغّل React) فتفشل معاينته.

   والترتيب هنا يصحّح نفسه بلا تدخل:
     ١) VITE_SITE_ORIGIN إن ضُبط وقت البناء — الكلمة الأخيرة للمالك.
     ٢) وإلا أصلُ التشغيل الفعلي في المتصفح — فهو نطاق Vercel اليوم، ويصير
        academy.wajeez.com من تلقائه يوم يشير النطاق إلى النشرة نفسها.
     ٣) وإلا النطاق النهائي — للتصيير خارج المتصفح.
   ولا localhost في الأصل القانوني أبدا: تُستثنى المضيفات المحلية في (٢). */

/** النطاق الذي سيستقر عليه الموقع — يُعلن هنا مرة واحدة */
export const CANONICAL_ORIGIN = 'https://academy.wajeez.com'

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
