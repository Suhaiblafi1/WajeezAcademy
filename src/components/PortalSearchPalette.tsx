/* لوحة بحث البوابات التشغيلية (Ctrl+K) — نسخة المدرب والمستشار.
   تضرب نقطة بحث الدور نفسه في الخادم، فلا ترى إلا ما يملكه المستخدم فعلا:
   المدرب: شعبه وطلابه المسندون. المستشار: حالاته المسندة. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CalendarCog, Search, UserRound, Users } from "lucide-react";
import { apiGet } from "@/services/api";

interface SearchHit { id: string; title: string; sub: string; to: string }

const PALETTES = {
  trainer: {
    endpoint: "/api/trainer/search",
    placeholder: "ابحث في شعبك وطلابك…",
    emptyHint: "اكتب اسم شعبة أو طالب من إسناداتك —",
    groups: [
      { key: "cohorts", label: "شعبي", icon: CalendarCog },
      { key: "students", label: "طلابي", icon: Users },
    ],
  },
  advisor: {
    endpoint: "/api/advisor/search",
    placeholder: "ابحث في حالاتك…",
    emptyHint: "اكتب اسم عميل من حالاتك المسندة —",
    groups: [
      { key: "cases", label: "حالاتي", icon: UserRound },
    ],
  },
} as const;

export default function PortalSearchPalette({ kind }: { kind: keyof typeof PALETTES }) {
  const conf = PALETTES[kind];
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<Record<string, SearchHit[]> | null>(null);
  const [searching, setSearching] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") setOpen(false);
    };
    const onCustom = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("wajeez:open-search", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wajeez:open-search", onCustom);
    };
  }, []);

  useEffect(() => {
    if (open) { setQ(""); setGroups(null); setCursor(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  /* بحث مهدَّأ — 250ms بعد آخر حرف */
  useEffect(() => {
    if (!open || q.trim().length < 1) { setGroups(null); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiGet<{ q: string; groups: Record<string, SearchHit[]> }>(`${conf.endpoint}?q=${encodeURIComponent(q.trim())}`);
        setGroups(res.groups);
      } catch { setGroups(null); }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open, conf.endpoint]);

  const flat = useMemo(() => {
    if (!groups) return [];
    return conf.groups.flatMap((g) => (groups[g.key] ?? []).map((h) => ({ ...h, group: g.key })));
  }, [groups, conf.groups]);

  const go = useCallback((hit: SearchHit) => {
    setOpen(false);
    navigate(hit.to);
  }, [navigate]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter" && flat[cursor]) go(flat[cursor]);
  };

  if (!open) return null;

  let rowIndex = -1;
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/70 px-4 pt-24 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div dir="rtl" className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/15 bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <Search className="h-4 w-4 shrink-0 text-[#6EC7D1]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            onKeyDown={onInputKey}
            placeholder={conf.placeholder}
            aria-label={conf.placeholder}
            className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          <kbd className="rounded-md border border-white/15 px-2 py-0.5 text-[10px] text-white/40">Esc</kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {q.trim() === "" && (
            <p className="px-4 py-8 text-center text-xs leading-6 text-white/40">
              {conf.emptyHint}<br />الأسهم ↑↓ للتنقل و Enter للقفز
            </p>
          )}
          {searching && <p className="px-4 py-6 text-center text-xs text-white/40">يُبحث…</p>}
          {!searching && groups && flat.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-white/40">لا نتائج لـ «{q}» ضمن نطاقك</p>
          )}
          {groups && conf.groups.map((g) => {
            const hits = groups[g.key] ?? [];
            if (hits.length === 0) return null;
            return (
              <div key={g.key} className="mb-1">
                <p className="flex items-center gap-2 px-3 pb-1 pt-2 text-[10px] font-black text-white/35">
                  <g.icon className="h-3 w-3" /> {g.label}
                </p>
                {hits.map((h) => {
                  rowIndex += 1;
                  const idx = rowIndex;
                  return (
                    <button
                      key={`${g.key}-${h.id}`}
                      onClick={() => go(h)}
                      onMouseEnter={() => setCursor(idx)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-right transition ${
                        cursor === idx ? "bg-[#38A7B4]/15" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black text-white/90">{h.title}</span>
                        <span className="block truncate text-[10px] text-white/40">{h.sub}</span>
                      </span>
                      <span className="shrink-0 text-[9px] font-bold text-[#6EC7D1]">Enter ↵</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
