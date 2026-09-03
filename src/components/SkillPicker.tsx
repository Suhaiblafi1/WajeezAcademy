/* منتقي المهارات بحالة القياس (البند ب-٤).

   المشكلة: شاشة التأليف كانت تعرض ٣٠٥ مهارة كرقائق بلا بحث ولا حالة. فالمؤلّف
   لا يستطيع العثور على مهارة، ولا يرى الفرق بين مهارة يقيسها سؤال فعلي وأخرى
   مسجَّلة لا تُقاس أبدا — والثانية تُضعف وزن المهارات بقدر الخطأ الإملائي.

   قواعد التصميم المطبَّقة:
   - الحالة نصّ وأيقونة لا لون وحده: «مقيسة» و«مسجَّلة بلا سؤال» و«موقوفة».
   - الأثر مكتوب بجانب الحالة: «تفصل بين المرشحين» · «تدخل المقام ولا تُقاس».
   - المقيسة تتقدّم في الترتيب — الأنفع أولا لا الأبجدي أولا.
   - التحذير يظهر أثناء الاختيار لا بعد الحفظ، ولا يمنع الحفظ: المنع بلا بديل
     يدفع المؤلّف إلى حشر مهارة قريبة خاطئة، وهذا أسوأ من مهارة غير مقيسة.
   - «اطلب إضافة مهارة» مسار صريح: طلب تغيير يمرّ بالمراجعة، لا إنشاء صامت. */

import { useMemo, useState } from "react";
import { AlertTriangle, Check, CircleSlash, Plus, Search, TriangleAlert, X } from "lucide-react";
import {
  STATE_LABEL_AR, assessSkillSelection, byStateThenName, skillStateOf,
  type SkillMeasureState, type SkillState,
} from "@/application/catalog/skill-measurement";

export interface PickerSkill {
  id: string;
  slug: string;
  nameAr: string;
  familyId?: string | null;
}

const STATE_ICON: Record<SkillMeasureState, typeof Check> = {
  measured: Check,
  registered_unmeasured: TriangleAlert,
  inactive: CircleSlash,
};

const STATE_TONE: Record<SkillMeasureState, string> = {
  measured: "border-teal/50 text-teal-light-ink",
  registered_unmeasured: "border-gold/45 text-gold-ink",
  inactive: "border-white/25 text-muted-foreground",
};

function StateBadge({ state }: { state: SkillMeasureState }) {
  const Icon = STATE_ICON[state];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-micro font-bold ${STATE_TONE[state]}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {STATE_LABEL_AR[state]}
    </span>
  );
}

export default function SkillPicker({
  skills, selectedIds, onToggle, onRequestSkill, className = "",
}: {
  skills: PickerSkill[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** يقدّم طلب مهارة جديدة للمراجعة — بلا هذا لا يظهر مسار الطلب */
  onRequestSkill?: (input: { slug: string; nameAr: string; reasonAr: string }) => Promise<void>;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  const [ask, setAsk] = useState({ slug: "", nameAr: "", reasonAr: "" });
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState(false);

  /* الحالة تُحسب مرة لكل مهارة لا في كل رسم — القائمة ٣٠٥ صفا */
  const rows = useMemo(() => {
    const withState: (PickerSkill & { st: SkillState })[] = skills.map((s) => ({ ...s, st: skillStateOf(s.slug, s.nameAr) }));
    return withState.sort((a, b) => byStateThenName(a.st, b.st));
  }, [skills]);

  const shown = useMemo(() => {
    const q = query.trim();
    if (!q) return rows;
    return rows.filter((r) => r.nameAr.includes(q) || r.slug.includes(q.toLowerCase()));
  }, [rows, query]);

  const selectedSlugs = useMemo(
    () => skills.filter((s) => selectedIds.includes(s.id)).map((s) => s.slug),
    [skills, selectedIds],
  );
  const assessment = useMemo(() => assessSkillSelection(selectedSlugs), [selectedSlugs]);

  const submitAsk = async () => {
    if (!onRequestSkill || !ask.slug.trim() || !ask.nameAr.trim()) return;
    setAsking(true);
    await onRequestSkill({ slug: ask.slug.trim(), nameAr: ask.nameAr.trim(), reasonAr: ask.reasonAr.trim() })
      .then(() => { setAsked(true); setAsk({ slug: "", nameAr: "", reasonAr: "" }); setAskOpen(false); })
      .catch(() => undefined);
    setAsking(false);
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black text-muted-foreground">
          المهارات المرتبطة ({assessment.total})
          {assessment.total > 0 && (
            <span className="ms-2 font-medium text-muted-foreground">
              {assessment.measured} مقيسة · {assessment.unmeasured} بلا سؤال
              {assessment.inactive > 0 ? ` · ${assessment.inactive} موقوفة` : ""}
            </span>
          )}
        </p>
        <label className="relative">
          <span className="sr-only">ابحث في المهارات</span>
          <Search className="pointer-events-none absolute inset-y-0 end-3 my-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الشريحة…"
            className="min-h-11 w-56 rounded-2xl border border-white/12 bg-paper/25 px-4 pe-9 text-xs placeholder:text-muted-foreground/75 focus:border-teal/60 focus:outline-none"
          />
        </label>
      </div>

      {/* التحذيرات أثناء الاختيار لا بعد الحفظ */}
      {assessment.warningsAr.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {assessment.warningsAr.map((w) => (
            <li key={w} className="flex items-start gap-2 rounded-2xl border border-gold/30 bg-gold/[0.07] px-3 py-2 text-[11px] leading-6 text-foreground">
              <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0 text-gold-ink" aria-hidden="true" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-white/10 bg-paper/20 p-2">
        {shown.map((r) => {
          const on = selectedIds.includes(r.id);
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onToggle(r.id)}
                aria-pressed={on}
                className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-1.5 text-right transition ${
                  on ? "border-teal bg-teal-ink/15" : "border-transparent hover:border-white/20"
                }`}
              >
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? "border-teal bg-teal text-on-teal" : "border-white/25"}`} aria-hidden="true">
                  {on && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">{r.nameAr}</span>
                  <span className="block truncate text-micro text-muted-foreground">{r.st.noteAr}</span>
                </span>
                <StateBadge state={r.st.state} />
              </button>
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="px-3 py-6 text-center text-[11px] text-muted-foreground">
            {rows.length === 0 ? "لا مهارات في الكتالوج بعد." : `لا مهارة تطابق «${query}».`}
          </li>
        )}
      </ul>

      {/* مسار الطلب — يمنع حشر مهارة قريبة خاطئة */}
      {onRequestSkill && (
        <div className="mt-2">
          {asked ? (
            <p className="flex items-center gap-2 text-[11px] font-bold text-teal-light-ink">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              قُدّم طلب المهارة للمراجعة — لا تُضاف قبل الاعتماد.
            </p>
          ) : askOpen ? (
            <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-black text-foreground">طلب مهارة غير موجودة</p>
                <button type="button" onClick={() => setAskOpen(false)} aria-label="إغلاق" className="cursor-pointer text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  value={ask.slug}
                  onChange={(e) => setAsk({ ...ask, slug: e.target.value })}
                  placeholder="skill_slug"
                  dir="ltr"
                  className="min-h-11 rounded-2xl border border-white/12 bg-paper/25 px-4 font-mono text-xs placeholder:text-muted-foreground/75 focus:border-teal/60 focus:outline-none"
                />
                <input
                  value={ask.nameAr}
                  onChange={(e) => setAsk({ ...ask, nameAr: e.target.value })}
                  placeholder="الاسم العربي"
                  className="min-h-11 rounded-2xl border border-white/12 bg-paper/25 px-4 text-xs placeholder:text-muted-foreground/75 focus:border-teal/60 focus:outline-none"
                />
              </div>
              <textarea
                value={ask.reasonAr}
                onChange={(e) => setAsk({ ...ask, reasonAr: e.target.value })}
                rows={2}
                placeholder="لماذا لا تكفي مهارة موجودة؟ — يقرأها المراجع"
                className="mt-2 w-full rounded-2xl border border-white/12 bg-paper/25 px-4 py-2 text-xs leading-6 placeholder:text-muted-foreground/75 focus:border-teal/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void submitAsk()}
                disabled={asking || !ask.slug.trim() || !ask.nameAr.trim()}
                className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-gold px-4 text-xs font-black text-on-gold transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                قدّم الطلب للمراجعة
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAskOpen(true)}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 text-[11px] font-bold text-foreground transition hover:border-teal/60 hover:text-teal-light-ink"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              اطلب إضافة مهارة غير موجودة
            </button>
          )}
        </div>
      )}
    </div>
  );
}
