import { useEffect } from 'react'

/* ───────────────────────── ظهورُ `.reveal` عند بلوغه ─────────────────────────

   `.reveal` في `index.css` يبدأ شفّافا، ولا يظهر إلّا حين يُضاف إليه
   `is-visible`. فكلُّ صفحةٍ فيها مكوّنٌ يحمله تحتاج هذا الخطّاف — وإلّا بقي
   المكوّنُ مخفيّا للأبد. وكان في الرئيسيّة وحدَها، فانتقل إلى هنا حين احتاجت
   «من نحن» جدارَ المؤسّسات نفسَه (`EcosystemOrgStrip`).

   MutationObserver يلتقط العناصر المُضافة لاحقا (محتوى يصل بعد أول رسم —
   مثل بطاقة المسار المميز التي تنتظر لقطة الكتالوج) فلا تبقى مخفية للأبد */
export function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('is-visible')),
      { threshold: 0.12 }
    )
    const seen = new WeakSet<Element>()
    const scan = () =>
      document.querySelectorAll('.reveal').forEach((el) => {
        if (!seen.has(el)) { seen.add(el); io.observe(el) }
      })
    scan()
    const mo = new MutationObserver(scan)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => { io.disconnect(); mo.disconnect() }
  }, [])
}
