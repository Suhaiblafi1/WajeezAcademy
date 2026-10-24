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
     ③ مواعيدُ بلا تعارض — مكانَ «وزّع الشعب» الذي ذهب (٢٤ أكتوبر ٢٠٢٦)
     ④ انشر التقويم — فيراه الزائرُ في `/calendar`، وتقول الدورةُ متى تُفتح.

   والذهبيُّ الواحدُ للنشر: هو ما يُخرج الموسمَ إلى الناس. */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { BellRing, CalendarCheck, CalendarClock, CalendarPlus, CalendarRange, DoorClosed, DoorOpen, Loader2, Trash2 } from "lucide-react";
import AdminLayout from "./AdminLayout";
import FlowSteps from "@/components/FlowSteps";
import { apiGet, apiPost, apiDelete, ApiError, permissionMessage } from "@/services/api";
import { fmtDateAr } from "@/utils/format";
import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffControlCls, staffSelectCls } from "@/components/FormKit";
import { termlessAutoAr, termlessWaitAr, type TermlessKind } from "@/application/terms/termless";
import { TRAINING_SEASONS } from "@/application/trainer/application-options";
import { termHorizon } from "@/application/terms/season";
import { toast, toastError } from "@/components/Toast";
import { TERM_STATUS_AR, TERM_STATUS_EFFECT_AR, nextStatuses, type TermStatus } from "@/application/terms/lifecycle";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import SeasonSwitch from "@/components/admin/SeasonSwitch";
import { useRealSession } from "@/services/session";

interface Term {
  id: string; year: number; season: string; titleAr: string;
  startsOn: string; endsOn: string; status: string;
  registrationOpensAt: string | null; registrationClosesAt: string | null;
  calendarPublishedAt: string | null;
  _count: { cohorts: number };
}

/** بابُ الموسم كما يقرؤه الخادم — العلّةُ في `server/services/registration-window.ts` */
interface SeasonGate { open: boolean; seasonKey: string; seasonAr: string; messageAr: string }
interface GateState { gate: SeasonGate; waiting: { total: number; pending: number } }

/** `datetime-local` يقبل بلا ثوانٍ ولا منطقة — والخادمُ يقرؤه تاريخا */
const toLocal = (iso: string | null) => (iso ? iso.slice(0, 16) : "");
/* ═══ ومعجمُ الحالات صار من عمود العمل لا من ذاكرةٍ سابقة ═══

   كان هنا معجمٌ محلّيّ: `draft | planning | open | running | closed`. وثلاثةٌ
   منها ليست من قيم العمود أصلا (`planned | open | active | closed |
   cancelled`)، فكان الإداريُّ يقرأ لكلّ فصلٍ كلمةَ «planned» بالإنجليزيّة —
   لأنّ الترجمةَ تخطئ المفتاحَ فتسقط إلى القيمة الخام. ومعجمان يقولان الشيءَ
   نفسَه يفترقان؛ فصار المعجمُ مع القاعدة في `application/terms/lifecycle`. */

/** شعبةٌ لم يُسمَّ فصلُها بعد — «لم تُفتَح» لا «معطوبة» */
interface TermlessCohort {
  id: string; title: string; courseTitleAr: string;
  learners: number; sessions: number; trainers: string[];
  /* ما يتحدّد فصلُه وحدَه وما يحتاجك — والعلّةُ في `src/application/terms/termless.ts` */
  plan: string | null; startsOn: string | null; kind: TermlessKind; whyAr: string | null;
}

export default function Terms() {
  /* «مواعيد بلا تعارض» لمن يعتمد ما يُقترح على خطط المدرّبين — صلاحيّةُ بابها نفسُها، فلا رابطَ يُفتح على «لا تملك» */
  const { user } = useRealSession();
  const canClash = user?.permissions.includes("cohort.plan.edits.review") ?? false;
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ year: new Date().getFullYear(), season: "nov_jan" });
  const [windows, setWindows] = useState<Record<string, { opensAt: string; closesAt: string }>>({});
  const [showAllTerms, setShowAllTerms] = useState(false);
  /* الحذفُ بضغطتين: الأولى تكشف زرَّ التأكيد، والثانية تحذف — لا حوارَ متصفّح */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  /* شعبٌ لها مدرّبٌ ولم يُسمَّ فصلُها — ومدرّبوها محبوسون عن الجدولة */
  const [termless, setTermless] = useState<TermlessCohort[] | null>(null);
  const [pickTerm, setPickTerm] = useState<Record<string, string>>({});
  /* بابُ التسجيل للمنصّة كلِّها — قرارٌ واحدٌ فوق الشعب والفصول */
  const [gate, setGate] = useState<GateState | null>(null);
  const [gateSeason, setGateSeason] = useState("nov_jan");
  const [gateMessage, setGateMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [rows, stuck, seasonGate] = await Promise.all([
        apiGet<Term[]>("/api/admin/terms?all=true"),
        apiGet<TermlessCohort[]>("/api/admin/cohorts/without-term").catch(() => [] as TermlessCohort[]),
        apiGet<GateState>("/api/admin/registration-season").catch(() => null),
      ]);
      setTerms(rows);
      setTermless(stuck);
      if (seasonGate) {
        setGate(seasonGate);
        if (seasonGate.gate.seasonKey) setGateSeason(seasonGate.gate.seasonKey);
        setGateMessage(seasonGate.gate.messageAr);
      }
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

  /* تسميةُ فصلِ شعبةٍ قائمة — وبها تُفتح نافذةُ جدولة مدرّبها */
  const nameTerm = (c: TermlessCohort) => {
    const termId = pickTerm[c.id];
    if (!termId) return;
    return act(`term-${c.id}`, () => apiPost(`/api/admin/cohorts/${c.id}/term`, { termId }),
      "سمّي فصل الشعبة — وفتحت نافذة جدولة مدرّبها");
  };

  /* ═══ وحذفُ ما لا مدرّبَ له (٢٠ أكتوبر ٢٠٢٦) ═══
     «لماذا ما زالت هنا! احذفها» (صاحب المنصّة). بضغطتين كحذف الموسم، والخادمُ يحذف ما لا متعلّمَ
     فيه ويقول لما بقي سببَه (`trainerless-cohort-delete.service.ts`). */
  const [confirmCohortDelete, setConfirmCohortDelete] = useState<string | null>(null);
  const deleteTrainerless = async (ids: string[], key: string) => {
    if (busy || ids.length === 0) return;
    setBusy(key);
    try {
      const r = await apiPost<{ deleted: { id: string }[]; kept: { title: string; reasonAr: string }[] }>(
        "/api/admin/cohorts/delete-trainerless", { cohortIds: ids });
      if (r.deleted.length > 0) toast(`حذفت ${r.deleted.length} شعبة بلا مدرب`);
      if (r.kept.length > 0) toastError(r.kept.map((k) => `${k.title}: ${k.reasonAr}`).join(" · "));
      setConfirmCohortDelete(null);
      await load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذر الحذف");
    } finally {
      setBusy(null);
    }
  };

  /* بطاقةُ شعبةٍ بلا فصل — في «تحتاجك» بسببها، وفي المطويّ بحال خطّتها */
  const termlessCard = (c: TermlessCohort, line: string | null) => (
    <Card as="li" key={c.id}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-read font-bold text-foreground">{c.title}</p>
          <p className="mt-0.5 text-read text-muted-foreground">
            {c.courseTitleAr}
            {c.learners > 0 && <> · {c.learners} التحقوا</>}
            {c.sessions > 0 && <> · {c.sessions} لقاء</>}
          </p>
          {c.trainers.length > 0 && (
            <p className="mt-1 text-read text-muted-foreground">المدرّب: {c.trainers.join("، ")}</p>
          )}
          {line && <p className="mt-1 text-read font-bold text-foreground">{line}</p>}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label>
            <span className="mb-1.5 block text-read font-bold text-muted-foreground">الفصل</span>
            <select
              value={pickTerm[c.id] ?? ""}
              onChange={(e) => setPickTerm({ ...pickTerm, [c.id]: e.target.value })}
              aria-label={`فصل شعبة ${c.title}`}
              className={staffSelectCls}
            >
              <option value="">اختر فصلا…</option>
              {(terms ?? [])
                .filter((t) => !["closed", "cancelled"].includes(t.status))
                .map((t) => <option key={t.id} value={t.id}>{t.titleAr}</option>)}
            </select>
          </label>
          <Button
            tone="confirm"
            disabled={busy !== null || !pickTerm[c.id]}
            onClick={() => void nameTerm(c)}
          >
            سمّ الفصل
          </Button>
          {c.trainers.length === 0 && (
            confirmCohortDelete === c.id
              ? <span className="inline-flex items-center gap-2">
                  <Button tone="danger" disabled={busy !== null} onClick={() => void deleteTrainerless([c.id], `del-${c.id}`)}>أكّد الحذف — لا رجعة</Button>
                  <Button tone="ghost" disabled={busy !== null} onClick={() => setConfirmCohortDelete(null)}>تراجع</Button>
                </span>
              : <Button tone="ghost" icon={Trash2} disabled={busy !== null} onClick={() => setConfirmCohortDelete(c.id)}>احذفها</Button>
          )}
        </div>
      </div>
    </Card>
  );

  /* فتحُ البابِ وإغلاقُه — ولا يُلمس تحته علمُ شعبةٍ واحدة، فما كان مغلقا
     قبل الإغلاق يبقى مغلقا بعد الفتح. */
  const setGateOpen = (open: boolean) => act(
    "gate",
    async () => {
      const r = await apiPost<GateState>("/api/admin/registration-season", {
        open, season: gateSeason, ...(open ? {} : { messageAr: gateMessage.trim() || undefined }),
      });
      setGate(r);
      setGateMessage(r.gate.messageAr);
    },
    open ? "فتح باب التسجيل — وينتظر من ترك بريده أن تبلغه" : "أوقف التسجيل — ومن ينقر الدفع يطلب بريده",
  );

  /* إبلاغُ المنتظرين — فعلٌ مستقلٌّ عن الفتح: يُفتح البابُ، ويُتحقَّق من
     الشعب والأسعار، ثمّ يُنادى الناس. ومن أُبلغ لا يُبلَّغ مرّتين. */
  const notifyWaiting = () => act(
    "gate-notify",
    async () => {
      const r = await apiPost<{ queued: number }>("/api/admin/registration-season/notify", { season: gateSeason });
      toast(r.queued > 0 ? `كتبت ${r.queued} رسالة في الطابور — يرسلها العامل` : "لا أحد ينتظر الآن");
      setGate(await apiGet<GateState>("/api/admin/registration-season"));
    },
    "أبلغ المنتظرون",
  );

  const create = () => act("create", () => apiPost("/api/admin/terms", { year: Number(form.year), season: form.season }), "أنشئ الموسم بحدوده المحسوبة");
  const saveWindow = (t: Term) => {
    const w = windows[t.id] ?? { opensAt: "", closesAt: "" };
    return act(`window-${t.id}`, () => apiPost(`/api/admin/terms/${t.id}/registration-window`, {
      opensAt: w.opensAt ? new Date(w.opensAt).toISOString() : null,
      closesAt: w.closesAt ? new Date(w.closesAt).toISOString() : null,
    }), "حفظت نافذة التسجيل");
  };
  /* نقلُ حالة الفصل — والزرُّ يقول أثرَه لا اسمَه وحدَه (`TERM_STATUS_EFFECT_AR`) */
  const moveStatus = (t: Term, to: TermStatus) => act(
    `status-${t.id}`,
    () => apiPost(`/api/admin/terms/${t.id}/status`, { status: to }),
    `${t.titleAr}: ${TERM_STATUS_AR[to]}`,
  );
  const publish = (t: Term) => act(`publish-${t.id}`, () => apiPost(`/api/admin/terms/${t.id}/publish-calendar`, {}), "نشر التقويم — يراه الزائر الآن");
  const remove = (t: Term) => act(`delete-${t.id}`, async () => {
    await apiDelete(`/api/admin/terms/${t.id}`);
    setConfirmDelete(null);
  }, "حذف الموسم");

  const seasonLabel = (s: string) => TRAINING_SEASONS.find((x) => x.value === s)?.months ?? s;

  /* ═══ ولماذا لا تُعرض المواسمُ كلُّها ═══

     شكا صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «ضع الموسمَ القادمَ والذي يليه فقط،
     وأنا أنشئ البقيةَ لاحقا». وكانت الشاشةُ تعرض ثمانيةً — سنتَين من بطاقاتٍ
     لكلٍّ منها نافذةُ تسجيلٍ وتوزيعُ شعبٍ وزرُّ نشر، فلا يُعرف أيُّها يعنيه.

     والقسمةُ في `application/terms/season` لا هنا: هي قرارٌ يُفحص، وحارسُها
     يمنع أن يُخفى الموسمُ الجاري مع المخفيّ — وفيه الشعبُ التي تعمل اليوم.
     ولا يُحذف شيء: ما طُوي يبقى خلفَ إفصاحٍ ينادي عددَه. */
  const { shown: visibleTerms, hidden: foldedTerms } = termHorizon(terms ?? [], new Date());
  const listed = showAllTerms ? [...visibleTerms, ...foldedTerms] : visibleTerms;

  return (
    <AdminLayout title="المواسم والتقويم">
      <FlowSteps steps={[
        { label: "أنشئ الموسم", actor: "سنة وموسم — والتواريخ تحسب" },
        { label: "نافذة التسجيل", actor: "متى يفتح ومتى يغلق" },
        { label: "مواعيد بلا تعارض", actor: "معاينة ثمّ إرسال للمدربين" },
        { label: "انشر التقويم", actor: "فيراه الزائر" },
      ]} />

      {error && <Inset as="p" tone="danger" className="mb-4 px-4 py-3 text-read leading-6 text-red-200">{error}</Inset>}

      {/* ═══ بابُ التسجيل — أوّلُ ما يُقرأ في هذه الشاشة ═══

          قرارُ صاحب المنصّة (١٨ سبتمبر ٢٠٢٦): يُوقَف التسجيلُ حتّى يُفتح بابُ
          الموسم، ومن نقر «ادفع» يُقال له ذلك ويُطلَب بريدُه.

          وموضعُه فوق كلِّ شيءٍ لأنّه يعلو كلَّ شيء: لا معنى لضبط نافذةِ فصلٍ
          ولا لتوزيع شعبٍ وبابُ المنصّة مغلقٌ — ومن لا يرى القفلَ يظنّ عطبا
          حيث لا عطب. */}
      {gate && (
        <Panel as="section" className="mb-6">
          <h2 className="flex items-center gap-2 text-sm font-black">
            {gate.gate.open
              ? <DoorOpen className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />
              : <DoorClosed className="h-4 w-4 text-gold-ink" aria-hidden="true" />}
            باب التسجيل — المنصّة كلّها
          </h2>
          <p className="mt-1 text-read leading-6 text-muted-foreground">
            {gate.gate.open
              ? "التسجيل مفتوح: الشراء يتمّ حسب شروط الشعبة ونافذة فصلها."
              : "التسجيل موقوف: من ينقر «ادفع» يرى الرسالة أدناه ويترك بريده. ولا تتغيّر الشعب ولا نوافذ الفصول."}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
            <label>
              <span className="mb-1.5 block text-read font-bold text-muted-foreground">الموسم المنتظر</span>
              <select value={gateSeason} onChange={(e) => setGateSeason(e.target.value)} className={staffSelectCls}>
                {TRAINING_SEASONS.map((s) => <option key={s.value} value={s.value}>{s.label} — {s.months}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-read font-bold text-muted-foreground">ما يقال لمن نقر الدفع</span>
              <input
                value={gateMessage}
                onChange={(e) => setGateMessage(e.target.value)}
                placeholder="لم يفتح باب التسجيل لموسم الشتاء بعد"
                className={staffControlCls}
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {gate.gate.open ? (
              <Button tone="secondary" disabled={busy !== null} onClick={() => setGateOpen(false)}>
                <DoorClosed className="h-4 w-4" aria-hidden="true" /> أوقف التسجيل
              </Button>
            ) : (
              <Button tone="confirm" disabled={busy !== null} onClick={() => setGateOpen(true)}>
                <DoorOpen className="h-4 w-4" aria-hidden="true" /> افتح باب التسجيل
              </Button>
            )}
            {/* والإبلاغُ لا يُعرض إلّا والبابُ مفتوحٌ ومن ينتظر: زرٌّ يُرسل
                «فُتح» قبل أن يُفتح يُعيد الناسَ إلى الجملة نفسِها. */}
            {gate.gate.open && gate.waiting.pending > 0 && (
              <Button tone="confirm" disabled={busy !== null} onClick={notifyWaiting}>
                <BellRing className="h-4 w-4" aria-hidden="true" /> أبلغ المنتظرين ({gate.waiting.pending})
              </Button>
            )}
            <span className="text-read leading-6 text-muted-foreground">
              {gate.waiting.total === 0
                ? "لم يترك أحد بريده بعد."
                : `ترك بريده ${gate.waiting.total} — ${gate.waiting.pending} لم يبلّغوا بعد.`}
            </span>
          </div>
        </Panel>
      )}

      {/* ① إنشاءُ موسم — لا تواريخَ باليد: الموسمُ يحدّدها */}
      <Panel as="section" className="mb-6">
        <h2 className="flex items-center gap-2 text-sm font-black"><CalendarPlus className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> موسم جديد</h2>
        <p className="mt-1 text-read leading-6 text-muted-foreground">
          أربعة مواسم في السنة بحدود ثابتة (الشتاء: نوفمبر إلى يناير). اختر السنة والموسم، وتحسب التواريخ تلقائيّا.
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

      {/* ═══ شعبٌ أُسنِد مدرّبُها ولم يُسمَّ فصلُها ═══

          صار الفصلُ حقيقةً إداريّةً تُسمَّى عند الإسناد (١٧ سبتمبر ٢٠٢٦).
          ومن أُسنِدت إليه شعبةٌ بلا فصلٍ **محبوسٌ**: يفتح ورشتَه فلا يجدول
          لقاءً واحدا، ولا شيءَ في المنصّة كان يقول لأحدٍ إنّه ينتظر.

          وموضعُها فوق قائمة المواسم بقصد: إنسانٌ متوقّفٌ عن عمله يسبق
          تخطيطَ تقويمٍ قادم. */}
      {termless !== null && termless.some((c) => c.kind === "needs") && (
        <Panel as="section" tone="warn" className="mb-6">
          <h2 className="flex items-center gap-2 text-sm font-black text-gold-ink">
            <CalendarPlus className="h-4 w-4" aria-hidden="true" /> شعب تحتاج فصلا منك ({termless.filter((c) => c.kind === "needs").length})
          </h2>
          {/* ═══ ولم تعد «تحبس مدرّبَها» (٢٧ سبتمبر ٢٠٢٦) ═══
              المدرّبُ يحدّد مدّةَ شعبته بنفسه فتُفتح جدولتُه داخلها، والفصلُ
              يُشتقّ من تاريخ البدء حين تُعتمَد خطّتُه. فهنا ما لا يعرف النظامُ موسمَه وحدَه. */}
          <p className="mt-1 text-read leading-6 text-muted-foreground">
            لا يعرف النظام موسم هذه الشعب. اختر فصلها.
            {terms !== null && terms.length === 0 && " أنشئ موسما أوّلا."}
          </p>
          {(() => {
            const orphan = termless.filter((c) => c.kind === "needs" && c.trainers.length === 0).map((c) => c.id);
            if (orphan.length < 2) return null;
            return (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {confirmCohortDelete === "all"
                  ? <>
                      <Button tone="danger" disabled={busy !== null} onClick={() => void deleteTrainerless(orphan, "del-all")}>أكّد حذف {orphan.length} شعبة — لا رجعة</Button>
                      <Button tone="ghost" disabled={busy !== null} onClick={() => setConfirmCohortDelete(null)}>تراجع</Button>
                    </>
                  : <Button tone="danger" icon={Trash2} disabled={busy !== null} onClick={() => setConfirmCohortDelete("all")}>احذف كل الشعب بلا مدرب ({orphan.length})</Button>}
              </div>
            );
          })()}
          <ul className="mt-4 space-y-3">
            {termless.filter((c) => c.kind === "needs").map((c) => termlessCard(c, c.whyAr))}
          </ul>
        </Panel>
      )}

      {/* ═══ وما يتحدّد فصلُه وحدَه — مطويٌّ، والاختيارُ باقٍ (١٩ أكتوبر ٢٠٢٦) ═══
          «لماذا يجب أن أعيد التوزيع والمدرّبُ هو من حدّد وأنا اعتمدت.. هذا فعلٌ مكرّر» (صاحب المنصّة).
          فاعتمادُ خطّة مدرّبها يسمّي فصلَها من تاريخ بدئها، ولا يُعرض هنا عملا ينتظرك. */}
      {termless !== null && termless.some((c) => c.kind === "auto") && (
        <Panel as="details" className="mb-6">
          <summary className="flex cursor-pointer items-center gap-2 text-read font-bold text-muted-foreground">
            <CalendarPlus className="h-4 w-4" aria-hidden="true" /> {termlessAutoAr(termless.filter((c) => c.kind === "auto").length)}
          </summary>
          <p className="mt-2 text-read leading-6 text-muted-foreground">
            ويمكنك أن تضع لأي منها فصلا مبدئيا قبل ذلك. هذا اختياري.
          </p>
          <ul className="mt-3 space-y-3">
            {termless.filter((c) => c.kind === "auto").map((c) => termlessCard(c, termlessWaitAr(c, fmtDateAr)))}
          </ul>
        </Panel>
      )}

      {terms === null ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جار التحميل" /></div>
      ) : terms.length === 0 ? (
        <Panel as="p" className="py-10 text-center text-read text-muted-foreground">لا مواسم بعد — أنشئ أوّلها أعلاه.</Panel>
      ) : (
        <div className="space-y-5">
          {listed.map((t) => {
            const w = windows[t.id] ?? { opensAt: "", closesAt: "" };
            const published = Boolean(t.calendarPublishedAt);
            return (
              <Panel as="article" key={t.id} tone={published ? "positive" : "default"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-lg font-black"><CalendarRange className="h-5 w-5 text-teal-light-ink" aria-hidden="true" /> {t.titleAr}</h2>
                    <p className="mt-1 text-read text-muted-foreground">
                      {seasonLabel(t.season)} · {cohortDayAr(t.startsOn)} إلى {cohortDayAr(t.endsOn)} · {TERM_STATUS_AR[t.status as TermStatus] ?? t.status}
                    </p>
                    <p className="mt-1 text-read text-muted-foreground">{t._count.cohorts} شعبة</p>
                    {/* زرٌّ واحدٌ بمعاينة: يفتح شعبَه المعتمدة ويغلق شعبَ التجربة قبله ومواسمَه (١٨ أكتوبر ٢٠٢٦) */}
                    {["planned", "open", "active"].includes(t.status) && <SeasonSwitch termId={t.id} onDone={() => void load()} />}
                    {/* ═══ بابُ الحالة ═══

                        كان العمودُ يُقرأ ولا يُكتب: خمسُ قيمٍ وخمسةُ قرّاءَ ولا
                        كاتبَ واحد (العلّةُ في `application/terms/lifecycle`).
                        والأزرارُ تُبنى من `nextStatuses` لا تُكتب باليد — فما
                        لا يجوز لا يُعرض، ولا يحتاج الإداريُّ أن يحفظ الجدول.

                        و«جارٍ» و«منتهٍ» يقعان بالتقويم كذلك في وظيفةٍ كلَّ
                        ساعة: هذا بابُ التعجيل لا البابُ الوحيد. */}
                    {nextStatuses(t.status).length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {nextStatuses(t.status).map((to) => (
                          <Button
                            key={to}
                            tone={to === "cancelled" ? "ghost" : "secondary"}
                            size="sm"
                            disabled={busy !== null}
                            title={TERM_STATUS_EFFECT_AR[to]}
                            onClick={() => void moveStatus(t, to)}
                          >
                            {to === "open" ? "افتحه للتسجيل" : to === "cancelled" ? "ألغه" : to === "closed" ? "أنهه" : "اجعله جاريا"}
                          </Button>
                        ))}
                        <span className="text-read text-muted-foreground">{TERM_STATUS_EFFECT_AR[nextStatuses(t.status)[0]]}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-read">
                    {published
                      ? <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 font-black text-emerald-300"><CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" /> منشور {fmtDateAr(t.calendarPublishedAt)}</span>
                      : <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 font-bold text-muted-foreground">لم ينشر بعد</span>}
                  </div>
                </div>

                {/* ② نافذةُ التسجيل */}
                <Card as="section" className="mt-4">
                  <h3 className="text-read font-black">نافذة التسجيل</h3>
                  <p className="mt-1 text-read leading-6 text-muted-foreground">بلا نافذة يبقى التسجيل مفتوحا ما دامت الشعبة مفتوحة. ومعها يعلن الموعد وينتظر المسجّلون.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label>
                      <span className="mb-1.5 block text-read font-bold text-muted-foreground">يفتح</span>
                      <input type="datetime-local" dir="ltr" value={w.opensAt} onChange={(e) => setWindows({ ...windows, [t.id]: { ...w, opensAt: e.target.value } })} className={`${staffControlCls} text-left`} />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-read font-bold text-muted-foreground">يغلق</span>
                      <input type="datetime-local" dir="ltr" value={w.closesAt} onChange={(e) => setWindows({ ...windows, [t.id]: { ...w, closesAt: e.target.value } })} className={`${staffControlCls} text-left`} />
                    </label>
                    <Button tone="secondary" disabled={busy !== null} onClick={() => saveWindow(t)}>احفظ النافذة</Button>
                  </div>
                </Card>

                {/* مواعيدُ بلا تعارض — دورتان يأخذهما الطالبُ نفسُه لا تقعان في ساعةٍ واحدة (٢٢ أكتوبر ٢٠٢٦) */}
                {t._count.cohorts > 0 && canClash && (
                  <Card as="section" className="mt-4">
                    <h3 className="text-read font-black">مواعيد بلا تعارض</h3>
                    <p className="mt-1 text-read leading-6 text-muted-foreground">نرتب مواعيد الشعب حتى لا تتعارض دورتان قد يأخذهما الطالب نفسه. ترى الاقتراح قبل أن يصل المدربين.</p>
                    <Link to={`/admin/terms/${t.id}/clashes`} className="mt-3 inline-flex items-center gap-1.5 text-read font-bold text-teal-light-ink">
                      <CalendarClock className="h-4 w-4" aria-hidden="true" /> افتح مواعيد الفصل
                    </Link>
                  </Card>
                )}

                {/* ═══ وذهب «توزيعُ شعب الموسم» (٢٤ أكتوبر ٢٠٢٦) ═══
                    كان يقترح شعبةً بلا مدرّبٍ لكلّ دورةٍ منشورةٍ لا شعبةَ لها — ٩١ شعبة — ويفتحها بنقرة «طبّق».
                    وهو من زمنٍ قبل أن يحدّد المدرّبُ مدّةَ شعبته بنفسه، وصاحبُ المنصّة كان قد حذف شعبا بلا مدرّب.
                    فسأل: «ما هذه الـ٩١ شعبة؟» — واختار حذفَه. ومواعيدُ ما فُتح في «مواعيد بلا تعارض» أعلاه. */}

                {/* ④ النشر — الذهبيُّ الواحد */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {!published && (
                    <Button tone="primary" disabled={busy !== null || t._count.cohorts === 0} onClick={() => publish(t)}>
                      <CalendarCheck className="h-4 w-4" /> انشر التقويم
                    </Button>
                  )}
                  {!published && t._count.cohorts === 0 && <span className="text-read text-muted-foreground">لا شعب في هذا الموسم بعد — تقويم بلا شعب لا ينشر.</span>}
                  {/* الحذفُ لما لم يُنشر ولا شعبَ فيه — والخادمُ يحرس الشرطين أيضا */}
                  {!published && t._count.cohorts === 0 && (
                    confirmDelete === t.id
                      ? <span className="inline-flex items-center gap-2">
                          <Button tone="danger" size="sm" disabled={busy !== null} onClick={() => remove(t)}>أكّد الحذف — لا رجعة</Button>
                          <Button tone="ghost" size="sm" disabled={busy !== null} onClick={() => setConfirmDelete(null)}>تراجع</Button>
                        </span>
                      : <Button tone="ghost" size="sm" disabled={busy !== null} onClick={() => setConfirmDelete(t.id)}><Trash2 className="h-3.5 w-3.5" /> احذف الموسم</Button>
                  )}
                  <Link to="/calendar" className="text-read font-bold text-teal-light-ink underline decoration-dotted underline-offset-4">التقويم العامّ</Link>
                  <Link to="/admin/cohorts" className="text-read font-bold text-teal-light-ink underline decoration-dotted underline-offset-4">شعب الموسم في «تشغيل الشعب»</Link>
                </div>
              </Panel>
            );
          })}
          {/* ما طُوي يبقى موجودا: إفصاحٌ ينادي عددَه، لا حذفٌ صامت */}
          {foldedTerms.length > 0 && (
            <Button
              tone="ghost"
              onClick={() => setShowAllTerms((v) => !v)}
              aria-expanded={showAllTerms}
              className="w-full justify-center"
            >
              {showAllTerms
                ? "اطو المواسم البعيدة"
                : `اعرض المواسم الأخرى (${foldedTerms.length}) — ماضية وأبعد من موسمين`}
            </Button>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
