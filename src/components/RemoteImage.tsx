/* موجة ٦ · د (البند و-٢) — صورة خارجية لا تترك فراغا حين تفشل.

   القياس الذي أنتج هذا المكوّن: خمس صور في الصفحة الرئيسية `naturalWidth = 0`
   — ثلاثة شعارات إعلام تُستضاف على مُحسِّن صور الموقع الأم (`_next/image`)،
   وصورتان من Unsplash. والقسم الذي يحملها يُعرض بارتفاع كامل ومحتواه فارغ،
   فيقرأ الزائر «تحدث عنا الإعلام» ولا يرى تحته شيئا.

   والسبب لا يهم في العلاج: منع الاستضافة الخارجية، أو شبكة بطيئة، أو انقطاع.
   القاعدة واحدة — **الصورة الخارجية ليست ضمانا، فلا يُبنى قسمٌ على نجاحها**.

   نوعان من البديل لأن الفشل نوعان:
   - `label`: الصورة تحمل معنى (شعار جهة) — البديل نصُّها، فالمعلومة تبقى.
   - `decor`: الصورة زينة — البديل تدرّجٌ هادئ، ولا نصّ يُقرأ بلا فائدة. */

import { useEffect, useRef, useState } from "react";

/* مهلة الانتظار قبل عرض البديل. القياس أظهر أن `onError` وحده لا يكفي:
   الطلب المحجوب من مضيف خارجي **يُعلَّق** ولا يفشل، فلا يُطلق onError أبدا
   ويبقى القسم فارغا إلى الأبد. والمهلة طويلة بما يكفي كي لا تعاقب شبكة بطيئة
   تعمل، وقصيرة بما يكفي كي لا يقرأ الزائر عنوانا بلا محتوى تحته. */
const LOAD_TIMEOUT_MS = 6000;

export interface RemoteImageProps {
  src: string;
  /** نصّ بديل — وهو أيضا ما يُعرض حين تفشل الصورة في وضع label */
  alt: string;
  className?: string;
  /** label = المعنى في الصورة فيُعرض نصّها · decor = زينة فيُعرض تدرّج */
  fallback?: "label" | "decor";
  /** صنف الحاوية البديلة — كي تحفظ مكان الصورة وأبعادها */
  fallbackClassName?: string;
  loading?: "lazy" | "eager";
}

export default function RemoteImage({
  src, alt, className = "", fallback = "decor", fallbackClassName = "", loading = "lazy",
}: RemoteImageProps) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (failed) return;
    const t = setTimeout(() => {
      /* حُمِّلت فعلا خلال المهلة؟ لا بديل. وإلا فالانتظار لم يعد مفيدا. */
      const el = imgRef.current;
      if (el && el.complete && el.naturalWidth > 0) return;
      setFailed(true);
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [src, failed]);

  if (failed) {
    return fallback === "label" ? (
      <span
        className={`grid place-items-center rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-bold text-foreground ${fallbackClassName || className}`}
      >
        {alt}
      </span>
    ) : (
      /* زينة: لا نصّ — قارئ الشاشة لا يقرأ ما لا يفيد */
      <span
        aria-hidden="true"
        className={`block bg-[radial-gradient(circle_at_60%_20%,rgb(var(--teal-ink)/0.28),transparent_65%)] ${fallbackClassName || className}`}
      />
    );
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
