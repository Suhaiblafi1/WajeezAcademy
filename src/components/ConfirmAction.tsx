/* تأكيدٌ واحدٌ لكلّ فعلٍ لا رجعةَ فيه.

   كان التأكيدُ في المنصّة حوارَ متصفّحٍ خامّا: `window.confirm` في موضعَين
   و`window.prompt` في ثمانية — **ولا شيءَ في الباقي**. وحوارُ المتصفّح عطبٌ
   بذاته لا شكلا فحسب:

   • لا يُنسَّق ولا يُقرأ كسائر المنصّة، وسطرُه واحدٌ بلا تفصيل — فقائمةُ ما
     سيُمحى تُكتب بـ`\n` ونقاطٍ يدويّة.
   • والمتصفّحُ يملك كتمَه: من ضغط «امنع هذا الموقع من إظهار الحوارات» صار
     `confirm` عنده يعود `false` دائما — فالفعلُ لا يقع ولا يُقال له لماذا.
   • ولا يفرّق بين فعلٍ يُراجَع وفعلٍ لا يُستعاد.

   والقاعدةُ هنا: نافذةٌ واحدةٌ من `Modal` (تحبس التركيزَ وتُغلق بـEscape
   وتُعيد التركيزَ لزرّها)، تقول **ماذا سيحدث بالضبط** لا «أنت متأكّد؟»، وما
   لا يُستعاد يُشترَط فيه كتابةُ ما يُثبت القصد: البريدُ حرفا بحرف، أو سببٌ
   يُقرأ في السجلّ بعد سنة. وزرُّ التنفيذ مغلَقٌ حتّى يتحقّق الشرط. */

import { useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";

export interface ConfirmTyping {
  /** ما يُطلب كتابتُه بالحرف — بريدٌ أو رمزٌ يراه المستخدم أمامه */
  expected: string
  labelAr: string
}

export interface ConfirmReason {
  labelAr: string
  minLength: number
}

export default function ConfirmAction({
  titleAr,
  children,
  confirmLabelAr,
  onCancel,
  onConfirm,
  busy = false,
  tone = "danger",
  typing,
  reason,
}: {
  titleAr: string;
  /** ماذا سيحدث بالضبط — لا «أنت متأكّد؟» */
  children: ReactNode;
  confirmLabelAr: string;
  onCancel: () => void;
  /** يُنادى بالسبب المكتوب إن كان مطلوبا */
  onConfirm: (reasonText?: string) => void;
  busy?: boolean;
  tone?: "danger" | "default";
  typing?: ConfirmTyping;
  reason?: ConfirmReason;
}) {
  const [typed, setTyped] = useState("");
  const [why, setWhy] = useState("");

  /* ولا تفريغَ للحقول عند الفتح: النافذةُ تُصيَّر شرطيّا (`{state && <…/>}`)
     فتُنشأ من جديدٍ في كلّ مرّة وحالتُها فارغةٌ أصلا. وتفريغُها في `useEffect`
     كان يُشغّل تصييرا زائدا لا يُغيّر شيئا. */

  const typingOk = !typing || typed.trim().toLowerCase() === typing.expected.trim().toLowerCase();
  const reasonOk = !reason || why.trim().length >= reason.minLength;
  const ready = typingOk && reasonOk && !busy;

  const field = "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/25 focus:border-teal focus:outline-none";

  return (
    <Modal onClose={onCancel} label={titleAr} panelClassName="w-full max-w-lg">
      {/* أرضيّةُ اللوح على الطفل لا على `panelClassName` — كما في سائر
          النوافذ (`BuyPanel`): بلا أرضيّةٍ يطفو النصُّ فوق الصفحة المعتّمة. */}
      <div dir="rtl" className="max-h-[86vh] overflow-y-auto rounded-3xl border border-white/10 bg-surface p-5 text-white sm:p-6">
        <h2 className="flex items-start gap-2 text-sm font-black">
          {tone === "danger" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />}
          {titleAr}
        </h2>

        <div className="mt-3 space-y-2 text-[12px] leading-6 text-white/70">{children}</div>

        {typing && (
          <label className="mt-4 block text-[11px] font-bold text-white/60">
            {typing.labelAr}
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              dir="ltr"
              autoComplete="off"
              className={`mt-1 font-mono ${field}`}
            />
            {typed.length > 0 && !typingOk && (
              <span className="mt-1 block font-bold text-red-300">لا يطابق — لن يقع شيء.</span>
            )}
          </label>
        )}

        {reason && (
          <label className="mt-4 block text-[11px] font-bold text-white/60">
            {reason.labelAr}
            <textarea
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              rows={3}
              className={`mt-1 resize-y ${field}`}
            />
            {/* الشرطُ يُقال ما لم يتحقّق، فلا يُقرأ «٤٤ من ١٠» بعد تحقّقه */}
            <span className={`mt-1 block ${reasonOk ? "text-teal-light-ink" : "text-white/40"}`}>
              {reasonOk
                ? "يكفي — ويُقرأ كما كتبتَه"
                : `اكتب ${reason.minLength - why.trim().length} حرفا أخرى على الأقلّ`}
            </span>
          </label>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!ready}
            onClick={() => onConfirm(reason ? why.trim() : undefined)}
            className={`cursor-pointer rounded-full px-5 py-2 text-xs font-black transition disabled:opacity-40 ${
              tone === "danger" ? "bg-red-500/90 text-white hover:bg-red-500" : "bg-gold text-on-gold"
            }`}
          >
            {confirmLabelAr}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-full border border-white/15 px-5 py-2 text-xs font-bold text-white/70 transition hover:border-white/40"
          >
            تراجَع
          </button>
        </div>
      </div>
    </Modal>
  );
}
