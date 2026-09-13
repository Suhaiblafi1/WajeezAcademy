/* جلسة الخادم الحقيقية — جسر واحد بين تسجيل الدخول عبر API وبوابات المنصات.
   كل بوابة كانت تعتمد هوية محلية تجريبية؛ هذا الخطاف يتيح لها التعرف على
   الحساب الحقيقي فتتجاوز شاشة «من أنت؟» لمن سجّل دخوله فعلا.

   والجلبُ نفسُه ليس هنا: هو في `services/me.ts` — نداءٌ واحدٌ تتقاسمه
   الشاشةُ كلُّها. وهذا الخطّافُ واجهتُه في React لا مصدرُه. */

import { useEffect, useState } from "react";
import { fetchMe, freshMe, type SessionUser } from "./me";

export type { SessionUser };

/** يجلب جلسة الخادم مرة واحدة — user=null حتى يكتمل الفحص أو عند غياب جلسة.

    ومعها حالةُ قناة البريد: حاجزُ التوثيق **لا يُفرَض حين تكون مغلقة** (الخادمُ
    يُسقطه صراحةً). فبدونها تقول الواجهةُ للمتعلّم إنّ شراءَه موقوفٌ وهو ليس
    موقوفا، وتعرض عليه زرَّ إرسالٍ لا يمكن أن ينجح. */
export function useRealSession() {
  /* جوابٌ طازجٌ محفوظٌ يُقرأ في أوّل تصيير — فلا يمرّ المكوّنُ بلوحِ تحميلٍ
     ولا يرتعش، وهو ما يحدث في كلّ انتقالٍ بين شاشات البوّابة. */
  const seed = freshMe();
  const [user, setUser] = useState<SessionUser | null>(seed?.user ?? null);
  const [emailChannel, setEmailChannel] = useState<boolean | null>(seed?.emailChannelEnabled ?? null);
  const [checked, setChecked] = useState(seed != null);
  useEffect(() => {
    let alive = true;
    fetchMe()
      .then((r) => {
        if (!alive) return;
        setUser(r.user);
        setEmailChannel(r.emailChannelEnabled);
      })
      .catch(() => { if (alive) setUser(null); })
      .finally(() => { if (alive) setChecked(true); });
    return () => { alive = false };
  }, []);
  return { user, checked, emailChannel };
}
