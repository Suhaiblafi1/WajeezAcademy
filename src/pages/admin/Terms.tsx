/* المواسمُ والتقويم — الشاشةُ التي كانت ناقصةً لنظامٍ مكتمل.

   ═══ ما كان ═══

   نظامُ الفصول كاملٌ في الخادم: إنشاءُ موسمٍ بحدوده المحسوبة، ونافذةُ
   تسجيل، ومدرّبون متاحون، وتوزيعُ شعب الموسم بمعاينةٍ ثمّ تطبيق، ونشرُ
   التقويم — **ولا شاشةَ تناديه**. فالتقويمُ العامّ فارغ، وكلُّ شعبةٍ فُتحت
   بالسكربت بلا موسمٍ فلا تظهر فيه، وسأل صاحبُ المنصّة: «هل التقويم يمتلئ بكلّ
   دورةٍ نُشرت؟» — لا؛ يمتلئ بشعب موسمٍ منشور، ولم يكن ثمّةَ موسم.

   ═══ القرار (٨ سبتمبر ٢٠٢٦) ═══

   شاشةٌ واحدةٌ تمشي الخطواتِ الأربع بترتيبها، لكلّ موسم:
     ① أنشئ الموسم (سنةٌ وموسم — والتواريخُ تُحسب)
     ② نافذةُ التسجيل
     ③ وزّع الشعب — معاينةٌ أوّلا، ثمّ تطبيقٌ بطلبٍ صريح
     ④ انشر التقويم — فيراه الزائرُ في `/calendar`، وتقول الدورةُ متى تُفتح.

   والذهبيُّ الواحدُ للنشر: هو ما يُخرج الموسمَ إلى الناس. */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { CalendarCheck, CalendarPlus, CalendarRange, Loader2, Play, Users, Trash2 } from "lucide-react";
import AdminLayout from "./AdminLayout";
import FlowSteps from "@/components/FlowSteps";
import { apiGet, apiPost, apiDelete, ApiError, permissionMessage } from "@/services/api";
import { fmtDateAr } from "@/utils/format";
import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffControlCls, staffSelectCls } from "@/components/FormKit";
import { TRAINING_SEASONS } from "@/application/trainer/application-options";
import { toast, toastError } from "@/components/Toast";

interface Term {
  id: string; year: number; season: string; titleAr: string;
  startsOn: string; endsOn: string; status: string;
  registrationOpensAt: string | null; registrationClosesAt: string | null;
  calendarPublishedAt: string | null;
  _count: { cohorts: number; trainerAvailability: number };
}
interface PlanResult {
  applied: boolean; termTitleAr: string; opened: number; prepared: number;
  rows: { courseId: string; titleAr: string; week: number; startsAt: string; monthWithinTerm: number }[];
  unplaced: { courseId: string; titleAr: string; whyAr: string }[];
  skipped: { courseId: string; titleAr: string; whyAr: string }[];
  loadByMonth: Record<number, number>;
}
interface AvailableTrainer { profileId: string; name: string; status: string; maxCohorts: number | null; qualifiedCourseIds: string[] }

/** `datetime-local` يقبل بلا ثوانٍ ولا منطقة — والخادمُ يقرؤه تاريخا */
const toLocal = (iso: string | null) => (iso ? iso.slice(0, 16) : "");
const STATUS_AR: Record<string, string> = { draft: "مسودّة", planning: "قيد التخطيط", open: "مفتوح", running: "جارٍ", closed: "مغلق" };

export default function Terms() {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ year: new Date().getFullYear(), season: "nov_jan" });
  const [windows, setWindows] = useState<Record<string, { opensAt: string; closesAt: string }>>({});
  const [plans, setPlans] = useState<Record<string, PlanResult>>({});
  const [trainers, setTrainers] = useState<Record<string, AvailableTrainer[]>>({});
  /* الحذفُ بضغطتين: الأولى تكشف زرَّ التأكيد، والثانية تحذف — لا حوارَ متصفّح */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await apiGet<Term[]>("/api/admin/terms?all=true");
      setTerms(rows);
      setWindows(Object.fromEntries(rows.map((t) => [t.id, { opensAt: toLocal(t.registrationOpensAt), closesAt: toLocal(t.registrationClosesAt) }])));
      setError(null);
    } catch (e) { setError(permissionMessage(e, "تعذر الاتصال بخادم API — شغّله بـ npm run api:dev")); setTerms([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); toast(done); await load(); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(null); }
  };

  const create = () => act("create", () => apiPost("/api/admin/terms", { year: Number(form.year), season: form.season }), "أُنشئ الموسم بحدوده المحسوبة");
  const saveWindow = (t: Term) => {
    const w = windows[t.id] ?? { opensAt: "", closesAt: "" };
    return act(`window-${t.id}`, () => apiPost(`/api/admin/terms/${t.id}/registration-window`, {
      opensAt: w.opensAt ? new Date(w.opensAt).toISOString() : null,
      closesAt: w.closesAt ? new Date(w.closesAt).toISOString() : null,
    }), "حُفظت نافذةُ التسجيل");
  };
  const preview = (t: Term) => act(`preview-${t.id}`, async () => {
    setPlans((p) => ({ ...p, [t.id]: undefined as unknown as PlanResult }));
    const r = await apiPost<PlanResult>(`/api/admin/terms/${t.id}/plan`, { apply: false });
    setPlans((p) => ({ ...p, [t.id]: r }));
  }, "هذه معاينةٌ — لم يُفتح شيءٌ بعد");
  const apply = (t: Term) => act(`apply-${t.id}`, async () => {
    const r = await apiPost<PlanResult>(`/api/admin/terms/${t.id}/plan`, { apply: true });
    setPlans((p) => ({ ...p, [t.id]: r }));
  }, "وُزّعت شعبُ الموسم وفُتحت");
  const publish = (t: Term) => act(`publish-${t.id}`, () => apiPost(`/api/admin/terms/${t.id}/publish-calendar`, {}), "نُشر التقويم — يراه الزائرُ الآن");
  const remove = (t: Term) => act(`delete-${t.id}`, async () => {
    await apiDelete(`/api/admin/terms/${t.id}`);
    setConfirmDelete(null);
  }, "حُذف الموسم");
  const loadTrainers = (t: Term) => act(`trainers-${t.id}`, async () => {
    const rows = await apiGet<AvailableTrainer[]>(`/api/admin/terms/${t.id}/available-trainers`);
    setTrainers((x) => ({ ...x, [t.id]: rows }));
  }, "قُرئ المدرّبون المتاحون");

  const seasonLabel = (s: string) => TRAINING_SEASONS.find((x) => x.value === s)?.months ?? s;

  return (
    <AdminLayout title="المواسم والتقويم">
      <FlowSteps steps={[
        { label: "أنشئ الموسم", actor: "سنةٌ وموسم — والتواريخُ تُحسب" },
        { label: "نافذةُ التسجيل", actor: "متى يُفتح ومتى يُغلق" },
        { label: "وزّع الشعب", actor: "معاينةٌ ثمّ تطبيق" },
        { label: "انشر التقويم", actor: "فيراه الزائر" },
      ]} />

      {error && <Inset as="p" tone="danger" className="mb-4 px-4 py-3 text-read leading-6 text-red-200">{error}</Inset>}

      {/* ① إنشاءُ موسم — لا تواريخَ باليد: الموسمُ يحدّدها */}
      <Panel as="section" className="mb-6">
        <h2 className="flex items-center gap-2 text-sm font-black"><CalendarPlus className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> موسمٌ جديد</h2>
        <p className="mt-1 text-read leading-6 text-muted-foreground">
          المواسمُ أربعة في السنة، وحدودُ كلٍّ منها ثابتة: موسمُ الشتاء نوفمبر إلى يناير، وهكذا. اختر السنةَ والموسم — والتواريخُ تُحسب.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <label>
            <span className="mb-1.5 block text-read font-bold text-muted-foreground">السنة</span>
            <input type="number" dir="ltr" min={2024} max={2100} value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} className={`${staffControlCls} w-28 text-left`} />
          </label>
          <label>
            <span className="mb-1.5 block text-read font-bold text-muted-foreground">الموسم</span>
            <select value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} className={staffSelectCls}>
              {TRAINING_SEASONS.map((s) => <option key={s.value} value={s.value}>{s.label} — {s.months}</option>)}
            </select>
          </label>
          <Button tone="confirm" disabled={busy !== null} onClick={create}>أنشئ الموسم</Button>
        </div>
      </Panel>

      {terms === null ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" /></div>
      ) : terms.length === 0 ? (
        <Panel as="p" className="py-10 text-center text-read text-muted-foreground">لا مواسمَ بعد — أنشئ أوّلَها أعلاه، فيصير للدورات موعدٌ يُعلَن.</Panel>
      ) : (
        <div className="space-y-5">
          {terms.map((t) => {
            const plan = plans[t.id];
            const w = windows[t.id] ?? { opensAt: "", closesAt: "" };
            const published = Boolean(t.calendarPublishedAt);
            return (
              <Panel as="article" key={t.id} tone={published ? "positive" : "default"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-lg font-black"><CalendarRange className="h-5 w-5 text-teal-light-ink" aria-hidden="true" /> {t.titleAr}</h2>
                    <p className="mt-1 text-read text-muted-foreground">
                      {seasonLabel(t.season)} · {fmtDateAr(t.startsOn)} إلى {fmtDateAr(t.endsOn)} · {STATUS_AR[t.status] ?? t.status}
                    </p>
                    <p className="mt-1 text-read text-muted-foreground">{t._count.cohorts} شعبة · {t._count.trainerAvailability} مدرّبا أعلن إتاحته</p>
                  </div>
                  <div className="text-read">
                    {published
                      ? <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 font-black text-emerald-300"><CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" /> منشورٌ {fmtDateAr(t.calendarPublishedAt)}</span>
                      : <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 font-bold text-muted-foreground">لم يُنشر بعد</span>}
                  </div>
                </div>

                {/* ② نافذةُ التسجيل */}
                <Card as="section" className="mt-4">
                  <h3 className="text-read font-black">نافذةُ التسجيل</h3>
                  <p className="mt-1 text-read leading-6 text-muted-foreground">بلا نافذةٍ يبقى التسجيلُ مفتوحا ما دامت شعبةٌ مفتوحة. وبها يُعلَن الموعدُ ويُنتظَر.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label>
                      <span className="mb-1.5 block text-read font-bold text-muted-foreground">يُفتح</span>
                      <input type="datetime-local" dir="ltr" value={w.opensAt} onChange={(e) => setWindows({ ...windows, [t.id]: { ...w, opensAt: e.target.value } })} className={`${staffControlCls} text-left`} />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-read font-bold text-muted-foreground">يُغلق</span>
                      <input type="datetime-local" dir="ltr" value={w.closesAt} onChange={(e) => setWindows({ ...windows, [t.id]: { ...w, closesAt: e.target.value } })} className={`${staffControlCls} text-left`} />
                    </label>
                    <Button tone="secondary" disabled={busy !== null} onClick={() => saveWindow(t)}>احفظ النافذة</Button>
                  </div>
                </Card>

                {/* ③ توزيعُ الشعب — معاينةٌ ثمّ تطبيق */}
                <Card as="section" className="mt-3">
                  <h3 className="text-read font-black">توزيعُ شعب الموسم</h3>
                  <p className="mt-1 text-read leading-6 text-muted-foreground">
                    لكلّ دورةٍ منشورةٍ بسعرٍ شعبةٌ في أسبوعها وشهرها من الموسم، بلا تزاحمٍ بين دورات المسار الواحد. المعاينةُ لا تفتح شيئا — والتطبيقُ يفتح.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button tone="secondary" disabled={busy !== null} onClick={() => preview(t)}><Play className="h-3.5 w-3.5" /> عاين التوزيع</Button>
                    {plan && !plan.applied && plan.rows.length > 0 && (
                      <Button tone="confirm" disabled={busy !== null} onClick={() => apply(t)}>طبّق التوزيع — افتح {plan.rows.length} شعبة</Button>
                    )}
                    <Button tone="ghost" disabled={busy !== null} onClick={() => loadTrainers(t)}><Users className="h-3.5 w-3.5" /> من المتاح للتدريس؟</Button>
                  </div>
                  {plan && (
                    <Inset className="mt-3">
                      <p className="text-read font-bold text-foreground">
                        {plan.applied ? `فُتحت ${plan.opened} شعبة وهُيّئت ${plan.prepared}` : `${plan.rows.length} شعبة تُقترح`}
                        {" · "}بالشهر: {[1, 2, 3].map((m) => `${m}: ${plan.loadByMonth[m] ?? 0}`).join(" · ")}
                      </p>
                      {plan.rows.length > 0 && (
                        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                          {plan.rows.slice(0, 12).map((r) => (
                            <li key={r.courseId} className="text-read text-muted-foreground">{r.titleAr} — الأسبوع {r.week + 1} · {fmtDateAr(r.startsAt)}</li>
                          ))}
                          {plan.rows.length > 12 && <li className="text-read text-muted-foreground">… و{plan.rows.length - 12} غيرها</li>}
                        </ul>
                      )}
                      {plan.unplaced.length > 0 && (
                        <p className="mt-2 text-read leading-6 text-gold-ink">لم تُوضع: {plan.unplaced.map((u) => `${u.titleAr} (${u.whyAr})`).join("، ")}</p>
                      )}
                      {plan.skipped.length > 0 && (
                        <p className="mt-2 text-read leading-6 text-muted-foreground">تُركت: {plan.skipped.length} دورة — لها شعبةٌ قائمة أو بلا سعر.</p>
                      )}
                    </Inset>
                  )}
                  {trainers[t.id] && (
                    <Inset className="mt-3">
                      <p className="text-read font-bold text-foreground">المتاحون لهذا الموسم ({trainers[t.id].length})</p>
                      {trainers[t.id].length === 0
                        ? <p className="mt-1 text-read text-muted-foreground">لم يُعلن أحدٌ إتاحتَه بعد — المدرّبون يعلنونها من «مؤهّلاتي وإتاحتي».</p>
                        : <ul className="mt-1 grid gap-1 sm:grid-cols-2">{trainers[t.id].map((tr) => <li key={tr.profileId} className="text-read text-muted-foreground">{tr.name} · {tr.status === "confirmed" ? "أكّد" : "أعلن"} · {tr.qualifiedCourseIds.length} دورة مؤهَّل لها</li>)}</ul>}
                    </Inset>
                  )}
                </Card>

                {/* ④ النشر — الذهبيُّ الواحد */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {!published && (
                    <Button tone="primary" disabled={busy !== null || t._count.cohorts === 0} onClick={() => publish(t)}>
                      <CalendarCheck className="h-4 w-4" /> انشر التقويم
                    </Button>
                  )}
                  {!published && t._count.cohorts === 0 && <span className="text-read text-muted-foreground">وزّع الشعبَ أوّلا — تقويمٌ بلا شعب لا يُنشر.</span>}
                  {/* الحذفُ لما لم يُنشر ولا شعبَ فيه — والخادمُ يحرس الشرطين أيضا */}
                  {!published && t._count.cohorts === 0 && (
                    confirmDelete === t.id
                      ? <span className="inline-flex items-center gap-2">
                          <Button tone="danger" size="sm" disabled={busy !== null} onClick={() => remove(t)}>أكّد الحذف — لا رجعة</Button>
                          <Button tone="ghost" size="sm" disabled={busy !== null} onClick={() => setConfirmDelete(null)}>تراجع</Button>
                        </span>
                      : <Button tone="ghost" size="sm" disabled={busy !== null} onClick={() => setConfirmDelete(t.id)}><Trash2 className="h-3.5 w-3.5" /> احذف الموسم</Button>
                  )}
                  <Link to="/calendar" className="text-read font-bold text-teal-light-ink underline decoration-dotted underline-offset-4">التقويمُ العامّ</Link>
                  <Link to="/admin/cohorts" className="text-read font-bold text-teal-light-ink underline decoration-dotted underline-offset-4">شعبُ الموسم في «الشعب»</Link>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
