/* مساراتُ المنحة — في شاشة «منحة أعضاء وجيز» (٢٠ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: تُبنى المساراتُ جديدةً من هنا — اسمٌ ودوراتٌ لها شعبٌ مفتوحة، ولا تتجاوز حدَّ
   دورات المنحة. ولكلّ مسارٍ هامشُه كاملا **بالنسبة التي في خانة الإعدادات**: سعرُه، وما يدفعه بلا منحة،
   وما يدفعه بها، وأجورُ مقاعد مدرّبيه، وما يبقى للأكاديميّة. والعلّةُ في `server/services/grant-pathway.service.ts`. */

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { toast, toastError } from "@/components/Toast";
import ConfirmAction from "@/components/ConfirmAction";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/services/api";
import { fmtMoney } from "@/application/text/format-ar";
import { cohortDayAr } from "@/application/learning/cohort-gate";
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

export default function GrantPathways({ percentOff, maxCourses }: { percentOff: number | null; maxCourses: number }) {
  const [list, setList] = useState<Pathway[] | null>(null);
  const [open, setOpen] = useState<OpenCourse[]>([]);
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
    apiGet<OpenCourse[]>("/api/admin/member-grant/open-courses").then(setOpen).catch(() => setOpen([]));
  }, []);

  const save = async (d: Draft) => {
    setBusy(true);
    try {
      const body = { titleAr: d.titleAr, blurbAr: d.blurbAr || null, courseIds: d.courseIds, active: d.active };
      if (d.id) await apiPut(`/api/admin/member-grant/pathways/${d.id}`, body);
      else await apiPost("/api/admin/member-grant/pathways", body);
      toast("حفظ المسار");
      setDraft(null);
      await load();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر حفظ المسار"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try { await apiDelete(`/api/admin/member-grant/pathways/${removing.id}`); toast("حذف المسار"); setRemoving(null); await load(); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر حذف المسار"); }
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
        <h2 className="text-lg font-black">مسارات المنحة</h2>
        {!draft && <Button size="sm" onClick={() => setDraft({ id: null, titleAr: "", blurbAr: "", courseIds: [], active: true })}>مسار جديد</Button>}
      </div>
      <p className="mt-1 text-read text-muted-foreground">
        يختار منها من يعبئ النموذج. كل مسار حتى {maxCourses} دورات لها شعب مفتوحة.
      </p>

      {draft && (
        <Card className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-3">
            <label className="grid flex-1 gap-1 text-read">اسم المسار
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
              <option value="">أضف دورة لها شعبة مفتوحة</option>
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
            <Button size="sm" disabled={busy || draft.titleAr.trim().length < 3 || draft.courseIds.length === 0} onClick={() => void save(draft)}>احفظ المسار</Button>
            <Button size="sm" tone="ghost" disabled={busy} onClick={() => setDraft(null)}>تراجع</Button>
          </div>
        </Card>
      )}

      {list === null ? null : list.length === 0 ? (
        <Card as="p" className="mt-3 text-read text-muted-foreground">لا مسار بعد.</Card>
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
                      : <span className="text-danger-ink">بلا شعبة مفتوحة الآن</span>}
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
              {p.missing > 0 && <p className="mt-1 text-read text-danger-ink">{p.missing} من دوراته بلا شعبة مفتوحة، ولا تظهر لمن يعبئ النموذج.</p>}
            </Card>
          ))}
        </div>
      )}

      {removing && (
        <ConfirmAction
          titleAr="حذف مسار منحة" confirmLabelAr="احذف المسار" busy={busy}
          onCancel={() => setRemoving(null)} onConfirm={() => void remove()}
        >
          يختفي «{removing.titleAr}» من صفحة الحملة. ومن اشترى به يبقى شراؤه كما هو. وإن أردت إخفاءه فقط، عدله وألغ «يظهر لمن يعبئ النموذج».
        </ConfirmAction>
      )}
    </>
  );
}
