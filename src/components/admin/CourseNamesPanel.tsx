/* ═══ أسماءُ الدورات — من أسماء شعبها (٢٠ أكتوبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: «اجعل تغييرَ الأسماء للدورات أسهل، والبحثَ للدورات أسهل،
   واقتراحاتٍ من أسماء الشعب نختار منها، أو اسما يجمعها وأنا أوافق.. لكلّ دورة،
   وعلى الدورات التي لها شعبٌ فقط».

   وكان البابُ صندوقَ JSON يُكتب فيه `{"titleAr": …}` بعد اختيار الدورة من قائمةٍ
   منسدلةٍ بلا بحث — واعتمادُه لا يكتب الاسم أصلا. فصار لكلّ دورةٍ لها شعبٌ بطاقةٌ:
   اسمُها الآن، وأسماءُ شعبها، واقتراحاتٌ تُختار بنقرة، وحقلٌ يُعدَّل فيه الاسم،
   وزرٌّ واحدٌ يعتمده. والاقتراحُ من `course-name-suggest.ts`، والكتابةُ من
   `CatalogAdminService.renameCourse`. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import ListToolbar from "@/components/admin/ListToolbar";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { OptionGrid, staffControlCls } from "@/components/FormKit";
import { toast } from "@/components/Toast";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { fmtDateTime } from "@/application/text/format-ar";
import { tidyCourseTitleAr, type CourseNameSuggestion } from "@/application/catalog/course-name-suggest";

type CourseNameRow = {
  id: string; status: string; titleAr: string; termEn: string | null; legacyTitleAr: string | null
  renamedAt: string | null
  cohorts: { id: string; title: string; status: string; startsAt: string | null }[]
  suggestions: CourseNameSuggestion[]
  pendingRename: { id: string; titleAr: string } | null
};

type RenameResult = { applied: boolean; titleAr: string; published: boolean };

const COHORT_STATUS_AR: Record<string, string> = {
  draft: "مسودة", open: "مفتوحة", full: "مكتملة", active: "جارية", completed: "منتهية", cancelled: "ملغاة",
};

/* «اسم شعبة» و«اسم شعبتين» و«اسم ٣ شعب» — والعددُ يُقرأ لا يُحسب */
function sourceAr(s: CourseNameSuggestion): string {
  if (s.kind === "combined") return "يجمع أسماء الشعب";
  const n = s.cohortCount;
  if (n === 1) return "اسم شعبة";
  if (n === 2) return "اسم شعبتين";
  return n <= 10 ? `اسم ${n} شعب` : `اسم ${n} شعبة`;
}

type Filter = "suggested" | "all" | "pending";

export default function CourseNamesPanel({
  canSelfApprove, onRenamed,
}: {
  /** من يعتمد ما يقدّمه: الاسمُ يُكتب فورا — وغيرُه يقدّم طلبا ينتظر مراجعا */
  canSelfApprove: boolean;
  onRenamed?: () => void;
}) {
  const [rows, setRows] = useState<CourseNameRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>("suggested");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await apiGet<CourseNameRow[]>("/api/admin/catalog/course-names"));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذر تحميل أسماء الدورات");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    all: rows?.length ?? 0,
    suggested: rows?.filter((r) => r.suggestions.length > 0).length ?? 0,
    pending: rows?.filter((r) => r.pendingRename).length ?? 0,
  }), [rows]);

  const view = paginate(
    (rows ?? []).filter((r) => (
      filter === "all" || (filter === "pending" ? r.pendingRename : r.suggestions.length > 0)
    ) && matchesQuery(q, [
      r.id, r.titleAr, r.termEn, r.legacyTitleAr, ...r.cohorts.map((c) => c.title),
      ...r.suggestions.map((s) => s.titleAr),
    ])),
    page, 25,
  );

  /* الحقلُ يبدأ بأوّل اقتراح — فمن وافق عليه ضغط زرّا واحدا */
  const draftOf = (r: CourseNameRow) => drafts[r.id] ?? r.suggestions[0]?.titleAr ?? "";

  const rename = async (r: CourseNameRow) => {
    const titleAr = tidyCourseTitleAr(draftOf(r));
    if (!titleAr) return;
    setBusyId(r.id); setError(null);
    try {
      const out = await apiPost<RenameResult>(`/api/admin/catalog/courses/${r.id}/rename`, { titleAr });
      toast(!out.applied
        ? "قدم الاسم للاعتماد — ينتظر مراجعا آخر"
        : out.published
          ? `صار اسمها «${out.titleAr}» — وفي الموقع الآن`
          : `صار اسمها «${out.titleAr}» — ويصل الموقع مع النشر التالي`);
      setDrafts((d) => { const next = { ...d }; delete next[r.id]; return next; });
      await load();
      onRenamed?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذر تغيير الاسم");
    } finally {
      setBusyId(null);
    }
  };

  if (rows === null) {
    return error
      ? <Inset as="p" tone="danger" className="px-4 py-3 text-sm">{error}</Inset>
      : <p className="text-sm text-muted-foreground">يحمل…</p>;
  }

  return (
    <Card className="border-gold/20">
      <p className="text-read leading-7 text-muted-foreground">
        الدورات التي لها شعب فقط. لكل دورة أسماء شعبها واقتراحات منها: اختر واحدا أو عدّله، ثم اعتمده.
        <b className="text-foreground"> يتغير اسم الدورة في كل الشاشات والموقع، وتبقى أسماء الشعب كما هي.</b>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {([
          ["suggested", `لها اقتراح (${counts.suggested})`],
          ["all", `كل الدورات (${counts.all})`],
          ...(counts.pending > 0 ? [["pending", `تنتظر الاعتماد (${counts.pending})`] as const] : []),
        ] as const).map(([k, label]) => (
          <Button key={k} size="sm" tone={filter === k ? "confirm" : "ghost"} aria-pressed={filter === k}
            onClick={() => { setFilter(k); setPage(1); }}>
            {label}
          </Button>
        ))}
      </div>

      <div className="mt-3">
        <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="دورة"
          placeholder="ابحث باسم الدورة أو الشعبة أو المعرّف…" />
      </div>
      {error && <Inset as="p" tone="danger" className="mt-3 px-4 py-3 text-sm">{error}</Inset>}

      {view.total === 0 && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {filter === "suggested" && !q
            ? "لا اقتراح الآن — أسماء الشعب مثل أسماء دوراتها. افتح «كل الدورات» لتغيير اسم بنفسك."
            : "لا نتيجة — امسح البحث أو افتح «كل الدورات»."}
        </p>
      )}

      <ul className="mt-3 space-y-3">
        {view.rows.map((r) => {
          const draft = draftOf(r);
          const tidy = tidyCourseTitleAr(draft);
          const same = tidy === r.titleAr;
          return (
            <Inset as="li" key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-foreground">{r.titleAr}</span>
                <span className="font-mono text-fine text-muted-foreground" dir="ltr">{r.id}</span>
                {r.termEn && <span className="text-fine text-muted-foreground" dir="ltr">{r.termEn}</span>}
                {r.renamedAt && <Chip tone="info">غير اسمها {fmtDateTime(new Date(r.renamedAt))}</Chip>}
                {r.pendingRename && <Chip tone="warn">ينتظر الاعتماد: {r.pendingRename.titleAr}</Chip>}
              </div>

              <div className="mt-2">
                <p className="text-read font-bold text-muted-foreground">أسماء الشعب ({r.cohorts.length})</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {r.cohorts.map((c) => (
                    <li key={c.id}>
                      <Chip tone={c.status === "cancelled" ? "neutral" : "info"}>
                        {c.title} · {COHORT_STATUS_AR[c.status] ?? c.status}
                      </Chip>
                    </li>
                  ))}
                </ul>
              </div>

              {r.suggestions.length > 0 && (
                <fieldset className="mt-3">
                  <legend className="mb-1.5 flex items-center gap-1.5 text-read font-bold text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-gold-ink" /> اقتراحات — اختر واحدا
                  </legend>
                  <OptionGrid
                    cols={2}
                    name={`اسم ${r.titleAr}`}
                    items={r.suggestions.map((s) => ({ value: s.titleAr, label: `${s.titleAr} — ${sourceAr(s)}` }))}
                    isOn={(v) => draft === v}
                    onToggle={(v) => setDrafts((d) => ({ ...d, [r.id]: v }))}
                  />
                </fieldset>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`rename-${r.id}`}>الاسم الجديد لـ{r.titleAr}</label>
                <input id={`rename-${r.id}`} value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                  placeholder="اكتب اسما جديدا…" className={`${staffControlCls} !w-auto min-w-[14rem] flex-1`} />
                <Button tone="confirm" size="sm" loading={busyId === r.id}
                  disabled={busyId !== null || !tidy || same}
                  onClick={() => void rename(r)}>
                  {canSelfApprove ? "اعتمد الاسم" : "قدم للاعتماد"}
                </Button>
              </div>
              {draft && !tidy && <p className="mt-1 text-read text-muted-foreground">الاسم من ٣ إلى ١٢٠ حرفا.</p>}
            </Inset>
          );
        })}
      </ul>
    </Card>
  );
}
