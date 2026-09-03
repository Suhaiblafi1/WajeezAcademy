/* اختيارُ متعلّمٍ بالاسم أو البريد — بديلُ حقلِ «معرف المستخدم (UUID)».

   كان تسجيلُ متعلّمٍ في شعبةٍ يطلب لصقَ معرّفٍ من ٣٦ حرفا لا يظهر على أيّ
   شاشة، فيفتح الموظّفُ قاعدةَ البيانات أو يستسلم (شُوهد في جولة ٢٠٢٦-٠٩).
   وهنا يكتب حرفَين فيرى الأسماء، ومن كان مسجَّلا في هذه الشعبة يظهر معطَّلا
   بدل أن يُسجَّل مرّتين فيُرَدّ بخطإٍ بعد الضغط. */

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, UserCheck, X } from "lucide-react";
import { apiGet } from "@/services/api";

export interface LearnerHit {
  id: string;
  displayName: string;
  email: string;
  enrolled: boolean;
}

export default function LearnerSearchField({
  cohortId,
  value,
  onChange,
  disabled,
}: {
  cohortId: string;
  /** المتعلّمُ المختار، أو `null` قبل الاختيار */
  value: LearnerHit | null;
  onChange: (learner: LearnerHit | null) => void;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<LearnerHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  /* مهلةٌ قصيرةٌ قبل السؤال: الكتابةُ أسرعُ من الشبكة، وآخرُ جوابٍ هو الصحيح.

     ولا تُضبَط حالةٌ في جسم التأثير مباشرةً (تصييرٌ متتالٍ) — كلُّ ضبطٍ هنا
     يقع داخل المؤقّت أو بعد جواب الشبكة. */
  useEffect(() => {
    if (value || term.trim().length < 2) {
      const clearing = setTimeout(() => { seq.current += 1; setHits(null); setBusy(false) }, 0);
      return () => clearTimeout(clearing);
    }
    const mine = ++seq.current;
    const t = setTimeout(() => {
      setBusy(true);
      apiGet<LearnerHit[]>(`/api/admin/learners/search?q=${encodeURIComponent(term.trim())}&cohortId=${cohortId}`)
        .then((r) => { if (mine === seq.current) setHits(r) })
        .catch(() => { if (mine === seq.current) setHits([]) })
        .finally(() => { if (mine === seq.current) setBusy(false) });
    }, 300);
    return () => clearTimeout(t);
  }, [term, cohortId, value]);

  if (value) {
    return (
      <div className="flex flex-1 items-center gap-2 rounded-xl border border-teal/40 bg-teal/5 px-3 py-2">
        <UserCheck className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
        <span className="flex-1 truncate text-xs font-bold text-foreground">{value.displayName}</span>
        <span dir="ltr" className="truncate text-micro text-muted-foreground">{value.email}</span>
        <button
          type="button"
          onClick={() => { onChange(null); setTerm(""); }}
          aria-label="اختر متعلّما آخر"
          className="shrink-0 cursor-pointer rounded-full p-1 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <label className="sr-only" htmlFor={`learner-search-${cohortId}`}>ابحث عن متعلّم بالاسم أو البريد</label>
      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-paper/30 px-3 py-2 focus-within:border-teal">
        {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
              : <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <input
          id={`learner-search-${cohortId}`}
          value={term}
          disabled={disabled}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ابحث بالاسم أو البريد — حرفان يكفيان"
          autoComplete="off"
          className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/75 focus:outline-none"
        />
      </div>

      {hits !== null && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-white/15 bg-[#0F1A1D] p-1 shadow-2xl">
          {hits.length === 0 && (
            <li className="px-3 py-2 text-[11px] text-muted-foreground">لا متعلّمَ بهذا الاسم أو البريد.</li>
          )}
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                disabled={h.enrolled}
                onClick={() => { onChange(h); setHits(null); }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-right transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
              >
                <span className="truncate text-xs font-bold text-foreground">{h.displayName}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {h.enrolled && <span className="rounded-full bg-white/10 px-2 py-0.5 text-micro font-bold text-muted-foreground">مسجَّلٌ هنا</span>}
                  <span dir="ltr" className="text-micro text-muted-foreground">{h.email}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
