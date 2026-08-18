import { useEffect, useState } from "react";
import { CheckCircle2, Info, X } from "lucide-react";

/* ─────────── Toast موحد لكل البوابات ───────────
   استدعِ toast("رسالة") من أي مكان — تظهر 4 ثوان ثم تختفي، وتتراكب عند التعدد.
   النوع success افتراضي، وinfo للتنبيهات المحايدة. */

export type ToastKind = "success" | "info";
interface ToastItem { id: number; text: string; kind: ToastKind; }

const EVENT = "wajeez:toast";

// eslint-disable-next-line react-refresh/only-export-components -- ناقل أحداث خالص بلا حالة؛ بقاؤه بجانب المضيف مقصود
export function toast(text: string, kind: ToastKind = "success") {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, kind } }));
}

let seq = 0;

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const { text, kind } = (e as CustomEvent<{ text: string; kind: ToastKind }>).detail;
      const id = ++seq;
      setItems((list) => [...list.slice(-2), { id, text, kind }]); // ثلاث رسائل كحد أقصى
      window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 4000);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  if (items.length === 0) return null;

  return (
    <div dir="rtl" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-5 sm:bottom-6">
      {items.map((t) => (
        <p
          key={t.id}
          className={`pointer-events-auto flex max-w-lg items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur ${
            t.kind === "success"
              ? "border-[#38A7B4]/50 bg-[#0E2225]/95 text-[#6EC7D1]"
              : "border-[#FABC05]/50 bg-[#241E0E]/95 text-[#FABC05]"
          }`}
        >
          {t.kind === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Info className="h-4 w-4 shrink-0" />}
          <span className="leading-6">{t.text}</span>
          <button
            onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}
            aria-label="إغلاق التنبيه"
            className="cursor-pointer text-current opacity-50 transition hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </p>
      ))}
    </div>
  );
}
