/* يعيد فتحَ لوح الشراء مرّةً واحدة حين تعود الصفحةُ بـ`?resume=1` (الخطوة ل، ٢٠ أكتوبر ٢٠٢٦).

   مكوّنٌ لا خطّاف: صفحتا الشراء تعودان مبكّرا قبل أن تُعرّف دالّةَ الشراء، والخطّافُ بعد عودةٍ مبكّرة
   يكسر ترتيبَ الخطاطيف. فيُركَّب هذا في ما تعرضه الصفحةُ، ويُنادي ما يُعطاه حين تجهز. */

import { useEffect, useRef } from "react";

export default function ResumeCheckout({ ready, onResume }: { ready: boolean; onResume: () => void }) {
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    onResume();
    /* والعلامةُ تُرفع من العنوان: تحديثُ الصفحة بعدها لا يعيد فتحَ لوحٍ أغلقه */
    const url = new URL(window.location.href);
    url.searchParams.delete("resume");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [ready, onResume]);
  return null;
}
