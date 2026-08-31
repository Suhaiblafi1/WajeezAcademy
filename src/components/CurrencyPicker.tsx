/* مبدّل العملة — زرٌّ صغير لا صفٌّ من الشرائح.

   كانت نافذة الدفع تعرض العملات الستّ شرائحَ بأسمائها الكاملة («دينار
   أردني»، «ريال سعودي»، «درهم إماراتي»…) في صفٍّ يلتفّ سطرين. فاحتلّ
   اختيارُ العملة — وهو تفصيلُ عرضٍ لا قرار — مساحةً أكبر من الرقم نفسه،
   وأزاح الرسوم وكود الخصم إلى أسفل النافذة.

   وقرار صاحب المنتج: «زرّ صغير يختار عملته، لا تجعلها كبيرة». فالزرّ يعرض
   رمز العملة الحاليّة ورمزها الثلاثيّ، ويفتح قائمةً قصيرةً عند الحاجة. من
   لا يريد التبديل لا يرى إلّا عملته — وهي مكتشفةٌ من بلده أصلا. */

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CURRENCIES, setCurrency, useCurrency, type CurrencyCode } from "@/services/currency";

export default function CurrencyPicker({ className = "" }: { className?: string }) {
  const cur = useCurrency();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  /* إغلاق بالنقر خارجها وبمفتاح الهروب — قائمةٌ صغيرة لا تحبس المستخدم */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`العملة: ${CURRENCIES[cur.code].label} — اضغط لتغييرها`}
        className="flex cursor-pointer items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-bold text-white/60 transition hover:border-white/35 hover:text-white/85"
      >
        <span dir="ltr">{cur.code}</span>
        <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-20 mt-1.5 min-w-[9.5rem] overflow-hidden rounded-xl border border-white/12 bg-surface py-1 shadow-xl"
        >
          {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
            <li key={c}>
              <button
                type="button"
                role="option"
                aria-selected={cur.code === c}
                onClick={() => { setCurrency(c); setOpen(false); }}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-right text-[11px] font-bold transition hover:bg-white/[0.06] ${
                  cur.code === c ? "text-teal-light-ink" : "text-white/65"
                }`}
              >
                <span>{CURRENCIES[c].label}</span>
                {cur.code === c
                  ? <Check className="h-3 w-3 shrink-0" />
                  : <span className="shrink-0 text-[10px] text-white/35" dir="ltr">{c}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
