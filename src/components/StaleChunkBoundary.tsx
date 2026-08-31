/* حاجزُ القطع الزائلة — يلتقط ما لا يصل نافذة المتصفّح.

   التطبيق يحمّل صفحاته تكاسليّا، وكلّ نشرٍ يغيّر بصمات القطع ويحذف القديمة.
   فصفحةٌ مخزّنة في متصفّح الزائر تُقلع سليمةً ثمّ تطلب عند أوّل انتقال قطعةً
   صارت ٤٠٤.

   وكتبتُ لذلك حارسا في `index.html` يسمع `error` و`vite:preloadError`
   و`unhandledrejection`. ثمّ اختبرتُه في متصفّحٍ حقيقيّ — بحجب قطعةٍ وردّها
   ٤٠٤ — **فلم يُعِد التحميل ولا مرّة**: إخفاقُ `import()` داخل `React.lazy`
   يصير خطأَ تصييرٍ يمرّ بشجرة React، لا حدثَ موردٍ ولا رفضا غير ملتقَط.
   وحتّى حين تُعيد React رميه إلى النافذة يأتي بـ`target === window`، وهو ما
   يتخطّاه الحارس عمدا («خطأ شيفرةٍ لا فشلُ مورد»).

   فاختباراتي كانت تفحص المستمع معزولا وتمرّ خضراء، والطريق الحقيقيّ مكسور.
   والحاجز هنا يلتقطه حيث يقع فعلا: في شجرة React.

   ويُعيد التحميل مرّةً واحدة كلّ دقيقة — النافذة نفسها التي في `index.html`،
   بالمفتاح نفسه — فلا تجتمع إعادتان ولا يدور التبويب إن كان النقص مقيما. */

import { Component, type ReactNode } from "react";
import { isStaleChunkError, mayReload } from "@/application/deploy/stale-chunk";

interface State { failed: boolean }

export class StaleChunkBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: isStaleChunkError(error) };
  }

  componentDidCatch(error: unknown) {
    if (!isStaleChunkError(error)) throw error; // ليس شأننا — يصعد كما كان
    if (mayReload()) window.location.reload();
  }

  render() {
    /* أثناء إعادة التحميل تُعرض شاشة الانتظار نفسها — لا وميضَ خطأ */
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
