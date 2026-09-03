import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Banknote, BookMarked, CalendarCog, LifeBuoy, Search, UserPlus, Users } from "lucide-react";
import { apiGet } from "@/services/api";
import { useRealSession } from "@/services/session";

interface SearchHit { id: string; title: string; sub: string; to: string }
type Groups = Record<"applications" | "users" | "cohorts" | "courses" | "tickets" | "payouts", SearchHit[]>;

const GROUP_META: { key: keyof Groups; label: string; icon: typeof Search }[] = [
  { key: "applications", label: "طلبات المدربين", icon: UserPlus },
  { key: "users", label: "المستخدمون", icon: Users },
  { key: "cohorts", label: "الشعب", icon: CalendarCog },
  { key: "courses", label: "الدورات", icon: BookMarked },
  { key: "tickets", label: "التذاكر", icon: LifeBuoy },
  { key: "payouts", label: "كشوف المستحقات", icon: Banknote },
];

/** لوحة بحث الإدارة — Cmd/Ctrl+K من أي شاشة إدارية. كل مجموعة نتائج مفلترة بصلاحياتها من الخادم. */
export default function SearchPalette() {
  const { user } = useRealSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<Groups | null>(null);
  const [searching, setSearching] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const staff = user?.permissions.some((p) => !p.startsWith("learner.")) ?? false;

  /* فتح بلوحة المفاتيح أو بحدث مخصص من زر الواجهة */
  useEffect(() => {
    if (!staff) return;
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
  }, [staff]);

  useEffect(() => {
    if (open) { setQ(""); setGroups(null); setCursor(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  /* بحث مهدَّأ */
  useEffect(() => {
    if (!open || q.trim().length < 1) { setGroups(null); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiGet<{ q: string; groups: Groups }>(`/api/admin/search?q=${encodeURIComponent(q.trim())}`);
        setGroups(res.groups);
      }
      catch { setGroups(null); }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  const flat = useMemo(() => {
    if (!groups) return [];
    return GROUP_META.flatMap((g) => (groups[g.key] ?? []).map((h) => ({ ...h, group: g.key })));
  }, [groups]);

  const go = useCallback((hit: SearchHit) => {
    setOpen(false);
    navigate(hit.to);
  }, [navigate]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter" && flat[cursor]) go(flat[cursor]);
  };

  if (!staff || !open) return null;

  let rowIndex = -1;
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/70 px-4 pt-24 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div dir="rtl" className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/15 bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <Search className="h-4 w-4 shrink-0 text-teal-light-ink" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            onKeyDown={onInputKey}
            placeholder="ابحث: مدرب، شعبة، دورة، مستخدم، تذكرة، كشف…"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          <kbd className="rounded-md border border-white/15 px-2 py-0.5 text-micro text-white/40">Esc</kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {q.trim() === "" && (
            <p className="px-4 py-8 text-center text-xs leading-6 text-white/40">
              اكتب للبحث الفوري عبر كل كيانات الإدارة —<br />الأسهم ↑↓ للتنقل و Enter للقفز
            </p>
          )}
          {searching && <p className="px-4 py-6 text-center text-xs text-white/40">يُبحث…</p>}
          {!searching && groups && flat.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-white/40">لا نتائج لـ «{q}» فيما تملك صلاحيته</p>
          )}
          {groups && GROUP_META.map((g) => {
            const hits = groups[g.key] ?? [];
            if (hits.length === 0) return null;
            return (
              <div key={g.key} className="mb-1">
                <p className="flex items-center gap-2 px-3 pb-1 pt-2 text-micro font-black text-white/35">
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
                        cursor === idx ? "bg-teal/15" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black text-foreground">{h.title}</span>
                        <span className="block truncate text-micro text-white/40">{h.sub}</span>
                      </span>
                      <span className="shrink-0 text-micro font-bold text-teal-light-ink">Enter ↵</span>
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
