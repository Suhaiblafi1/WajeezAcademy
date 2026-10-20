/* مساراتُ المنحة — في شاشة «منحة أعضاء وجيز» (٢٠ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: تُبنى المساراتُ جديدةً من هنا — اسمٌ ودوراتٌ لها شعبٌ مفتوحة، ولا تتجاوز حدَّ
   دورات المنحة. ولكلّ مسارٍ هامشُه كاملا **بالنسبة التي في خانة الإعدادات**: سعرُه، وما يدفعه بلا منحة،
   وما يدفعه بها، وأجورُ مقاعد مدرّبيه، وما يبقى للأكاديميّة. والعلّةُ في `server/services/grant-pathway.service.ts`.

   وتحتها **دوراتُ المنحة الافتراضيّة** — قرارُه (٢٠ أكتوبر ٢٠٢٦): «اجعل الافتراضيَّ كلَّ الدورات المفعّلة ولها
   مدرّبٌ ولها شعبةٌ مفتوحةٌ للفصل القادم القريب». فتُعرض هنا بفصلها وسعرها بالمنحة، ليرى ما يختار منه من يعبّئ
   النموذج بلا أن يفتح الصفحة. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { toast, toastError } from "@/components/Toast";
import ConfirmAction from "@/components/ConfirmAction";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/services/api";
import { fmtMoney } from "@/application/text/format-ar";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { grantPrice } from "@/application/commerce/grant";
import { countAr } from "@/application/text/count-ar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import ListToolbar from "@/components/admin/ListToolbar";
import { staffControlCls, staffSelectCls } from "@/components/FormKit";
import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

interface OpenCourse { courseId: string; courseTitleAr: string; price: number; currency: string; startsAt: string | null; seatsLeft: number | null }
interface PathwayCourse { courseId: string; titleAr: string; cohort: OpenCourse | null; seatCost: number | null }
interface Pathway {
  id: string; titleAr: string; blurbAr: string | null; sortOrder: number; active: boolean;
  courses: PathwayCourse[]; missing: number;
  listTotal: number; bundleTotal: number; grantTotal: number; seatCostTotal: number | null; margin: number | null;
}
interface Draft { id: string | null; titleAr: string; blurbAr: string; courseIds: string[]; active: boolean }

const USD = "USD";
/** المقاعدُ الباقيةُ بصيغة عددها — والمثنّى بلا رقم */
const seatsLeftAr = (n: number) => (n === 2 ? "بقي مقعدان" : `بقي ${countAr(n, { one: "مقعد", two: "مقعدان", few: "مقاعد", many: "مقعدا" })}`);

export default function GrantPathways({ percentOff, maxCourses }: { percentOff: number | null; maxCourses: number }) {
  const [list, setList] = useState<Pathway[] | null>(null);
  const [open, setOpen] = useState<OpenCourse[]>([]);
  const [termAr, setTermAr] = useState<string | null>(null);
  /* دوراتُ المنحة تنمو بنموّ الكتالوج — فيُبحث فيها ويُقلَّب */
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const shown = useMemo(() => paginate(open.filter((c) => matchesQuery(q, [c.courseTitleAr])), page, 25), [open, q, page]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<Pathway | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (percentOff === null) return;
    try {
      const r = await apiGet<{ pathways: Pathway[] }>(`/api/admin/member-grant/pathways?percentOff=${percentOff}`);
      setList(r.pathways);
    } catch { setList(null); }
  }, [percentOff]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    apiGet<{ termAr: string | null; courses: OpenCourse[] }>("/api/admin/member-grant/open-courses")
      .then((r) => { setOpen(r.courses); setTermAr(r.termAr); })
      .catch(() => setOpen([]));
  }, []);

  const save = async (d: Draft) => {
    setBusy(true);
    try {
      const body = { titleAr: d.titleAr, blurbAr: d.blurbAr || null, courseIds: d.courseIds, active: d.active };
      if (d.id) await apiPut(`/api/admin/member-grant/pathways/${d.id}`, body);
      else await apiPost("/api/admin/member-grant/pathways", body);
      toast("حفظ الاقتراح");
      setDraft(null);
      await load();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر حفظ الاقتراح"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try { await apiDelete(`/api/admin/member-grant/pathways/${removing.id}`); toast("حذف الاقتراح"); setRemoving(null); await load(); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر حذف الاقتراح"); }
    finally { setBusy(false); }
  };

  const edit = (p: Pathway) => setDraft({ id: p.id, titleAr: p.titleAr, blurbAr: p.blurbAr ?? "", courseIds: p.courses.map((c) => c.courseId), active: p.active });
  const titleOf = (id: string) => open.find((c) => c.courseId === id)?.courseTitleAr
    ?? list?.flatMap((p) => p.courses).find((c) => c.courseId === id)?.titleAr ?? id;
  const move = (i: number, by: number) => {
    if (!draft) return;
    const ids = [...draft.courseIds];
    const j = i + by;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setDraft({ ...draft, courseIds: ids });
  };

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black">اقتراحات المنحة</h2>
        {!draft && <Button size="sm" onClick={() => setDraft({ id: null, titleAr: "", blurbAr: "", courseIds: [], active: true })}>اقتراح جديد</Button>}
      </div>
      <p className="mt-1 text-read text-muted-foreground">
        مجموعات دورات تقترحها على من يعبئ النموذج. يضغط أحدها فتختار دوراته، ثم يعدل كما يشاء. كل اقتراح حتى {maxCourses} دورات.
      </p>

      {draft && (
        <Card className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-3">
            <label className="grid flex-1 gap-1 text-read">اسم الاقتراح
              <input value={draft.titleAr} onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })} className={staffControlCls} />
            </label>
            <label className="grid flex-[2] gap-1 text-read">لمن يناسب
              <input value={draft.blurbAr} onChange={(e) => setDraft({ ...draft, blurbAr: e.target.value })} className={staffControlCls} />
            </label>
          </div>
          <ol className="space-y-1.5">
            {draft.courseIds.map((id, i) => (
              <li key={id} className="flex items-center gap-2 text-read">
                <span className="flex-1">{i + 1}. {titleOf(id)}</span>
                <button type="button" aria-label="لأعلى" onClick={() => move(i, -1)} className="cursor-pointer text-muted-foreground"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" aria-label="لأسفل" onClick={() => move(i, 1)} className="cursor-pointer text-muted-foreground"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" aria-label="احذف الدورة" onClick={() => setDraft({ ...draft, courseIds: draft.courseIds.filter((x) => x !== id) })} className="cursor-pointer text-muted-foreground"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ol>
          {draft.courseIds.length < maxCourses && (
            <select value="" onChange={(e) => e.target.value && setDraft({ ...draft, courseIds: [...draft.courseIds, e.target.value] })} className={staffSelectCls}>
              <option value="">أضف دورة من دورات المنحة</option>
              {open.filter((c) => !draft.courseIds.includes(c.courseId)).map((c) => (
                <option key={c.courseId} value={c.courseId}>{c.courseTitleAr} — {fmtMoney(c.price, c.currency)} — تبدأ {cohortDayAr(c.startsAt)}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 text-read">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            يظهر لمن يعبئ النموذج
          </label>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || draft.titleAr.trim().length < 3 || draft.courseIds.length === 0} onClick={() => void save(draft)}>احفظ الاقتراح</Button>
            <Button size="sm" tone="ghost" disabled={busy} onClick={() => setDraft(null)}>تراجع</Button>
          </div>
        </Card>
      )}

      {list === null ? null : list.length === 0 ? (
        <Card as="p" className="mt-3 text-read text-muted-foreground">لا اقتراح بعد. من يعبئ النموذج يختار من دورات المنحة أدناه.</Card>
      ) : (
        <div className="mt-3 space-y-3">
          {list.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-black">{p.titleAr}{p.active ? "" : " · لا يظهر"}</p>
                  {p.blurbAr && <p className="text-read text-muted-foreground">{p.blurbAr}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" tone="secondary" onClick={() => edit(p)}>عدل</Button>
                  <Button size="sm" tone="ghost" onClick={() => setRemoving(p)}>احذف</Button>
                </div>
              </div>
              <ul className="mt-2 space-y-1 text-read">
                {p.courses.map((c) => (
                  <li key={c.courseId} className="flex flex-wrap justify-between gap-2">
                    <span>{c.titleAr}</span>
                    {c.cohort
                      ? <span className="text-muted-foreground">تبدأ {cohortDayAr(c.cohort.startsAt)} · <span dir="ltr">{fmtMoney(c.cohort.price, c.cohort.currency)}</span></span>
                      : <span className="text-danger-ink">لا تظهر الآن: ليست من دورات المنحة</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t border-border pt-2 text-read">
                السعر <span dir="ltr">{fmtMoney(p.listTotal, USD)}</span>
                {" · "}بلا منحة <span dir="ltr">{fmtMoney(p.bundleTotal, USD)}</span>
                {" · "}بالمنحة <span dir="ltr" className="font-bold">{fmtMoney(p.grantTotal, USD)}</span>
                {" · "}للمدربين {p.seatCostTotal === null ? "غير معروف" : <span dir="ltr">{fmtMoney(p.seatCostTotal, USD)}</span>}
                {" · "}يبقى للأكاديمية{" "}
                <span dir="ltr" className={`font-bold ${p.margin !== null && p.margin < 0 ? "text-danger-ink" : ""}`}>
                  {p.margin === null ? "—" : fmtMoney(p.margin, USD)}
                </span>
              </p>
              {p.missing > 0 && <p className="mt-1 text-read text-danger-ink">{p.missing} من دوراته لا تظهر لمن يعبئ النموذج: ليست من دورات المنحة.</p>}
            </Card>
          ))}
        </div>
      )}

      <h2 className="mt-6 text-lg font-black">دورات المنحة ({open.length})</h2>
      <p className="mt-1 text-read text-muted-foreground">
        {termAr ? `${termAr}: ` : ""}كل دورة منشورة لها مدرب منشور وشعبة مفتوحة للتسجيل. منها يختار من يعبئ النموذج، وتتحدث وحدها حين تفتح شعبة أو تغلق.
      </p>
      <Card className="mt-3">
        <ListToolbar q={q} onQ={setQ} onPage={setPage} view={shown} placeholder="ابحث باسم الدورة" unit="دورة" />
        {shown.rows.length === 0 ? (
          <p className="text-read text-muted-foreground">{open.length === 0 ? "لا دورة متاحة الآن." : "لا دورة بهذا الاسم."}</p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.rows.map((c) => (
              <li key={c.courseId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-read">
                <span className="font-bold">{c.courseTitleAr}</span>
                <span className="text-muted-foreground">
                  تبدأ {cohortDayAr(c.startsAt)}
                  {" · "}<span dir="ltr">{fmtMoney(c.price, c.currency)}</span>
                  {percentOff !== null && <>{" · "}بالمنحة <span dir="ltr" className="font-bold text-foreground">{fmtMoney(grantPrice(c.price, percentOff), c.currency)}</span></>}
                  {c.seatsLeft !== null && ` · ${seatsLeftAr(c.seatsLeft)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {removing && (
        <ConfirmAction
          titleAr="حذف اقتراح" confirmLabelAr="احذف الاقتراح" busy={busy}
          onCancel={() => setRemoving(null)} onConfirm={() => void remove()}
        >
          يختفي «{removing.titleAr}» من صفحة الحملة. ومن اشترى به يبقى شراؤه كما هو. وإن أردت إخفاءه فقط، عدله وألغ «يظهر لمن يعبئ النموذج».
        </ConfirmAction>
      )}
    </>
  );
}
