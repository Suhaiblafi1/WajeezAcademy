import { useEffect, useRef, useState } from 'react'

/* ───────────────────────── «رآه» مرّةً واحدة ─────────────────────────

   أُضيف (١ نوفمبر ٢٠٢٦) لطلب صاحب المنصّة في «لماذا هذه المنحة؟»: «لا تجعل هذه تظهر بثبات، اجعلها تظهر عندما يصل
   الشخص» — الوسومُ تدخل حين يبلغها القارئ لا قبله.

   و`useReveal` لا يكفي هنا: هو يكتب `is-visible` على `.reveal` بعتبةٍ تقع والعنصرُ يطلّ من أسفل الشاشة، فيقع الدخولُ
   وعينُ القارئ أعلى منه ولا يراه. فالحافّةُ السفلى هنا ترتفع (`bottom`، نسبةٌ من الشاشة): لا «رآه» إلّا والعنصرُ في
   أعلى الشاشة حيث يقرأ.

   ومن طلب تخفيفَ الحركة، أو متصفّحٌ بلا IntersectionObserver، يراه فورا — فلا يبقى شيءٌ مخفيّا. */
/** يُرى فورا بلا حركة: من طلب تخفيفَها، أو متصفّحٌ بلا IntersectionObserver */
const showNow = (): boolean =>
  typeof IntersectionObserver === 'undefined'
  || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

export function useSeenOnce<T extends Element>(bottom = '-35%') {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(showNow)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect() } },
      { rootMargin: `0px 0px ${bottom} 0px`, threshold: 1 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [bottom, seen])
  return [ref, seen] as const
}
