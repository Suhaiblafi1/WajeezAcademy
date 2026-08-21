/* ط-٤ · حالة الفراغ توجّه لا تُخبر فقط.
   «لا جلسات مجدولة قادمة» في مستطيل كبير تصف الحال وتترك المتعلم واقفا.
   الفراغ فرصة توجيه: ماذا يفعل الآن؟

   قاعدتان تحكمان الاستخدام، وهما سبب وجود هذا الملف أصلا:
   ١) **لا إجراء يُقترح إلا وهو متاح فعلا.** «احجز شعبة» حين لا شعبة مفتوحة
      طريقٌ مسدود يكلّف ثقة أكثر مما يوفّر خطوة. الصفحة المستدعية هي التي
      تعرف ما لديها، فهي التي تبني القائمة — لا هذا المكوّن.
   ٢) **الفراغ ليس نوعا واحدا.** «لا شيء بعد» غير «لا شيء في هذا المرشّح» غير
      «أنجزتَ كل المستحق». الأول يحتاج بداية، والثاني يحتاج إزالة مرشّح،
      والثالث تطمين لا دعوة. `tone` يفرّقها فلا تُعرض دعوةٌ لمن أتمّ عمله. */

import { Link } from "react-router";
import { ArrowLeft, type LucideIcon } from "lucide-react";

export interface EmptyAction {
  /** مسار داخلي — أو onClick لإجراء في المكان (إزالة مرشّح مثلا) */
  to?: string;
  onClick?: () => void;
  labelAr: string;
  /** سطر يقول ما يجري عند الضغط — لا نترك المستخدم يجرّب ليعرف */
  hintAr?: string;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  titleAr: string;
  /** سبب الفراغ بصدق — لا «حدث خطأ» ولا صمت */
  reasonAr: string;
  /** إجراءات متاحة فعلا؛ الفراغ هنا مقبول ويُعرض بلا دعوة كاذبة */
  actions?: EmptyAction[];
  /** start = بداية مطلوبة · filter = مرشّح يحجب · done = أُنجز كل شيء */
  tone?: "start" | "filter" | "done";
  className?: string;
}

const TONE_RING: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  start: "border-white/10 bg-white/[0.02]",
  filter: "border-white/10 bg-white/[0.02]",
  done: "border-emerald-400/25 bg-emerald-400/[0.04]",
};

const TONE_ICON: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  start: "text-white/25",
  filter: "text-white/25",
  done: "text-emerald-300/60",
};

export default function EmptyState({
  icon: Icon, titleAr, reasonAr, actions = [], tone = "start", className = "",
}: EmptyStateProps) {
  return (
    <div className={`grid place-items-center rounded-3xl border px-6 py-12 text-center ${TONE_RING[tone]} ${className}`}>
      <Icon className={`h-10 w-10 ${TONE_ICON[tone]}`} aria-hidden="true" />
      <h3 className="mt-4 text-lg font-black">{titleAr}</h3>
      <p className="mt-2 max-w-md text-sm leading-7 text-white/60">{reasonAr}</p>

      {actions.length > 0 && (
        <>
          <p className="mt-6 text-[11px] font-black text-white/60">
            {tone === "done" ? "وإن أردت المتابعة:" : "ابدأ من هنا:"}
          </p>
          <div className="mt-3 flex w-full max-w-lg flex-col gap-2">
            {actions.map((a) => {
              const body = (
                <>
                  <span className="flex-1 text-start text-sm font-bold">{a.labelAr}</span>
                  {a.hintAr && <span className="hidden text-[11px] text-white/60 sm:block">{a.hintAr}</span>}
                  <ArrowLeft className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
                </>
              );
              const cls = "flex cursor-pointer items-center gap-3 rounded-2xl border border-white/12 bg-black/20 px-4 py-3 transition hover:border-teal/50 hover:bg-teal/5";
              return a.to
                ? <Link key={a.labelAr} to={a.to} className={cls}>{body}</Link>
                : <button key={a.labelAr} type="button" onClick={a.onClick} className={cls}>{body}</button>;
            })}
          </div>
        </>
      )}
    </div>
  );
}
