/* موضعُ ما ضُغط — منه يكبر مشغّلُ فيديو المدرّب (`TrainerVideoZoom` في `TrainerVideo.tsx`). نُقل من هناك (٩ نوفمبر ٢٠٢٦)
   لتقرأه صورةُ المدرّب بحلقتها في صفحته أيضا (`TrainerPublic.tsx`) — وملفُّ المكوّنات لا يصدّر غيرَ مكوّنات. */

/** مركزُ ما ضُغط بالنسبة إلى مركز الشاشة — منه يكبر المشغّل */
export type ZoomFrom = { x: number; y: number };

/* والجسمُ مكبَّرٌ على الشاشات الواسعة (`zoom: var(--app-scale)` في `index.css`): المقاسُ يُقرأ بمقياس الشاشة، والإزاحةُ
   داخل الجسم تُضرب فيه — فتُقسم عليه لتبدأ من النافذة الصغيرة نفسِها */
export function zoomFromEl(el: Element | null): ZoomFrom {
  if (!el || typeof window === "undefined") return { x: 0, y: 0 };
  const r = el.getBoundingClientRect();
  const scale = parseFloat(getComputedStyle(document.body).zoom) || 1;
  return {
    x: Math.round((r.left + r.width / 2 - window.innerWidth / 2) / scale),
    y: Math.round((r.top + r.height / 2 - window.innerHeight / 2) / scale),
  };
}
