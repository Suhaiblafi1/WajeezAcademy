/* «أيُّ الدورات أنا مؤهَّلٌ لها؟ ومتى أنا متاح؟» — سؤالان للمدرّب لا شاشةَ
   لهما (المهمّة ٧١).

   والأوّلُ أغربُ من الثاني: **الخادمُ يجيبه منذ زمن.** `/api/trainer/me/qualifications`
   و`/api/trainer/catalog-scope` موجودان ومحروسان بصلاحيّاتهما، ولا تنادِيهما
   شاشةٌ واحدة — فالمدرّبُ يسأل الإدارةَ عمّا تعرفه المنصّةُ عنه. وهذه الشاشةُ
   تعرضهما لا أكثر.

   والثاني جديد: لم يكن للمدرّب موضعٌ يقول فيه «صباحي مشغول» ولا «سأسافر
   الأسبوعَ القادم». والحكمان مختلفان بقصدٍ ومكتوبان في المخطّط:

   · **الغيابُ مانع** — إعلانٌ صريحٌ بمدّةٍ بعينها يردُّ إسنادَ أيّ جلسةٍ فيها.
   · **الساعاتُ إرشاد** — من لم يُعلن لا يُمنَع من شيء، ومن أعلن يظهر لمن
     يُسنِد عددُ الجلسات الواقعة خارج ساعاته، والقرارُ له.

   وتُقال هذه التفرقةُ للمدرّب في الشاشة نفسِها: إعلانٌ لا يُفهَم أثرُه إمّا
   يُترك فراغا أو يُملأ خوفا. */

import { useCallback, useEffect, useState } from "react";
import { Award, CalendarCheck, CalendarOff, Clock, Loader2, Lock, Plus, ServerOff, Trash2 } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import EmptyState from "@/components/EmptyState";
import { toast, toastError } from "@/components/Toast";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/services/api";

interface Qualification { courseId: string; title: string; currentVersion: number; qualifiedAt: string }
interface ScopeGate { allowed: boolean; basis: "earned" | "granted" | "none"; reasonAr: string }
interface Window { weekday: number; startMinute: number; endMinute: number }
interface Blackout { id: string; startsAt: string; endsAt: string; reason: string | null; past: boolean }
interface Availability { windows: Window[]; blackouts: Blackout[]; meaningAr: string }

/* ── فصولي (البند ٥٣) ──
   `myStatus` ثلاثيّةٌ لا ثنائيّة: `null` تعني «لم أُسأل بعدُ ولم أقل شيئا»،
   وهي ليست موافقةً ولا اعتذارا. و`declared` ما ورّثه الترحيلُ من مواسمَ
   أعلنها في طلبه — إعلانٌ قديمٌ لم يؤكّده بعد. */
interface MyTerm {
  id: string; titleAr: string; season: string;
  startsOn: string; endsOn: string;
  registrationOpensAt: string | null; registrationClosesAt: string | null;
  termStatus: string;
  myStatus: "declared" | "confirmed" | "declined" | null;
  maxCohorts: number | null; note: string | null;
  assignedCohorts: { id: string; title: string; courseId: string; startsAt: string | null; status: string }[];
}

const TERM_STATE: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "أكّدتُ إتاحتي", cls: "border-teal/50 bg-teal/10 text-teal-light-ink" },
  declined: { label: "اعتذرتُ عنه", cls: "border-white/15 bg-white/[0.03] text-muted-foreground" },
  declared: { label: "معلَنٌ من طلبك — لم تؤكّده", cls: "border-gold/50 bg-gold/10 text-gold-ink" },
};

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** دقائقُ منتصفِ الليل ↔ `HH:MM` — الحقلُ يعرض وقتا والخادمُ يخزّن رقما */
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ar", { year: "numeric", month: "long", day: "numeric" });

export default function TrainerQualifications() {
  const [quals, setQuals] = useState<Qualification[] | null>(null);
  const [scope, setScope] = useState<ScopeGate | null>(null);
  const [avail, setAvail] = useState<Availability | null>(null);
  const [down, setDown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Window[]>([]);
  const [leave, setLeave] = useState({ startsAt: "", endsAt: "", reason: "" });
  const [leaveErr, setLeaveErr] = useState("");
  const [terms, setTerms] = useState<MyTerm[] | null>(null);

  const load = useCallback(async () => {
    try {
      const [q, s, a, t] = await Promise.all([
        apiGet<Qualification[]>("/api/trainer/me/qualifications"),
        apiGet<ScopeGate>("/api/trainer/catalog-scope"),
        apiGet<Availability>("/api/trainer/me/availability"),
        /* الفصولُ لا تُسقط الشاشةَ إن تعذّرت: المؤهّلاتُ والساعاتُ أسبقُ منها،
           ولا يُحرَم المدرّبُ منهما لأنّ جدولا ثالثا لم يُجب. */
        apiGet<MyTerm[]>("/api/trainer/me/terms").catch(() => null),
      ]);
      setQuals(q); setScope(s); setAvail(a); setDraft(a.windows); setTerms(t); setDown(false);
    } catch {
      setDown(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveWindows = async () => {
    setBusy(true);
    try {
      const next = await apiPut<Availability>("/api/trainer/me/availability", { windows: draft });
      setAvail(next); setDraft(next.windows);
      toast("حُفظت ساعاتك المعلنة");
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر الحفظ — أعد المحاولة");
    } finally {
      setBusy(false);
    }
  };

  const addLeave = async () => {
    /* الخطأُ عند الحقل قبل الإرسال — لا نُرسل ما نعرف أنّه مردود */
    if (!leave.startsAt || !leave.endsAt) { setLeaveErr("اكتب تاريخَ البداية والنهاية"); return; }
    if (new Date(leave.endsAt) <= new Date(leave.startsAt)) { setLeaveErr("تاريخُ النهاية بعد البداية"); return; }
    setLeaveErr(""); setBusy(true);
    try {
      await apiPost("/api/trainer/me/blackouts", {
        startsAt: new Date(leave.startsAt).toISOString(),
        endsAt: new Date(leave.endsAt).toISOString(),
        reason: leave.reason.trim() || undefined,
      });
      setLeave({ startsAt: "", endsAt: "", reason: "" });
      await load();
      toast("سُجّل غيابك — ولن تُسنَد لك جلسةٌ فيه");
    } catch (e) {
      setLeaveErr(e instanceof ApiError ? e.message : "تعذّر التسجيل");
    } finally {
      setBusy(false);
    }
  };

  /** تأكيدٌ أو اعتذارٌ عن فصل — والقرارُ للمدرّب لا يُعلَن نيابةً عنه */
  const answerTerm = async (termId: string, status: "confirmed" | "declined") => {
    setBusy(true);
    try {
      await apiPost(`/api/trainer/me/terms/${termId}`, { status });
      await load();
      toast(status === "confirmed" ? "أُثبتت إتاحتك في هذا الفصل" : "سُجّل اعتذارك — ولن تُخطَّط لك شعبةٌ فيه");
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر الحفظ — أعد المحاولة");
    } finally {
      setBusy(false);
    }
  };

  const removeLeave = async (id: string) => {
    setBusy(true);
    try {
      await apiDelete(`/api/trainer/me/blackouts/${id}`);
      await load();
      toast("حُذف سجلُّ الغياب");
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  };

  if (down) {
    return (
      <TrainerLayout title="مؤهّلاتي وإتاحتي">
        <EmptyState
          icon={ServerOff}
          titleAr="تعذّر الوصول إلى الخادم"
          reasonAr="لم يُجب الخادمُ على طلب مؤهّلاتك. تحقّق من اتصالك ثمّ أعد التحميل."
          actions={[{ labelAr: "أعد المحاولة", onClick: () => void load() }]}
        />
      </TrainerLayout>
    );
  }

  if (!quals || !avail) {
    return (
      <TrainerLayout title="مؤهّلاتي وإتاحتي">
        <div className="grid place-items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" />
        </div>
      </TrainerLayout>
    );
  }

  const upcoming = avail.blackouts.filter((b) => !b.past);
  const dirty = JSON.stringify(draft) !== JSON.stringify(avail.windows);

  return (
    <TrainerLayout title="مؤهّلاتي وإتاحتي">
      <div className="space-y-8">
        {/* ── ما أنا مؤهَّلٌ له ── */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-black">
            <Award className="h-5 w-5 text-teal" aria-hidden="true" />
            الدورات التي أنا مؤهَّلٌ لها
            <span className="text-xs font-bold text-muted-foreground">({quals.length})</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            التأهيلُ للدورة لا للشعبة — فمن أُهِّل لدورةٍ يجوز إسنادُه لأيّ شعبةٍ منها.
          </p>

          {quals.length === 0 ? (
            <EmptyState
              className="mt-4"
              icon={Award}
              titleAr="لا تأهيلَ بعد"
              reasonAr="التأهيلُ يقع من الإدارة: تُطلبه شعبةٌ تحتاجك، أو يُمنح بعد مراجعة ملفّك. ولا تستطيع أن تؤهّل نفسك — وهذا مقصود."
              actions={[{ to: "/trainer/board", labelAr: "شعبي", hintAr: "ما أُسند إليك فعلا" }]}
            />
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {quals.map((q) => (
                <li key={q.courseId} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="font-bold">{q.title || q.courseId}</p>
                  <p className="mt-1 text-micro leading-5 text-muted-foreground">
                    <span className="font-mono">{q.courseId}</span> · النسخة {q.currentVersion} · أُهِّلت {fmtDate(q.qualifiedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── نطاقي في الكتالوج ── */}
        {scope && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="flex items-center gap-2 text-sm font-black">
              <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              نطاقُ اقتراحاتي
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{scope.reasonAr}</p>
          </section>
        )}

        {/* ── ساعاتي الأسبوعيّة ── */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-black">
            <Clock className="h-5 w-5 text-teal" aria-hidden="true" />
            ساعاتي الأسبوعيّة
          </h2>
          <p className="mt-1 text-sm leading-7 text-muted-foreground">{avail.meaningAr}</p>

          <ul className="mt-4 space-y-2">
            {draft.map((w, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <label className="sr-only" htmlFor={`day-${i}`}>اليوم</label>
                <select
                  id={`day-${i}`}
                  value={w.weekday}
                  onChange={(e) => setDraft(draft.map((x, j) => j === i ? { ...x, weekday: Number(e.target.value) } : x))}
                  className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3 text-sm"
                >
                  {DAYS.map((d, di) => <option key={di} value={di}>{d}</option>)}
                </select>
                <label className="sr-only" htmlFor={`from-${i}`}>من</label>
                <input
                  id={`from-${i}`} type="time" value={toTime(w.startMinute)}
                  onChange={(e) => setDraft(draft.map((x, j) => j === i ? { ...x, startMinute: toMinutes(e.target.value) } : x))}
                  className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3 text-sm"
                />
                <span className="text-xs text-muted-foreground">إلى</span>
                <label className="sr-only" htmlFor={`to-${i}`}>إلى</label>
                <input
                  id={`to-${i}`} type="time" value={toTime(w.endMinute)}
                  onChange={(e) => setDraft(draft.map((x, j) => j === i ? { ...x, endMinute: toMinutes(e.target.value) } : x))}
                  className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setDraft(draft.filter((_, j) => j !== i))}
                  className="ms-auto grid h-11 w-11 place-items-center rounded-xl border border-white/15 text-muted-foreground hover:text-foreground"
                  aria-label={`احذف نافذة ${DAYS[w.weekday]}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDraft([...draft, { weekday: 0, startMinute: 540, endMinute: 720 }])}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-bold hover:border-white/40"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> أضف نافذة
            </button>
            <button
              type="button" disabled={busy} onClick={() => void saveWindows()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-teal px-5 text-sm font-black text-on-teal disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              احفظ ساعاتي
            </button>
            {dirty && <span className="text-micro font-bold text-gold-ink">تغييراتٌ لم تُحفظ</span>}
          </div>
        </section>

        {/* ── فصولي (البند ٥٣) ── */}
        {terms && terms.length > 0 && (
          <section>
            <h2 className="flex items-center gap-2 text-lg font-black">
              <CalendarCheck className="h-5 w-5 text-teal" aria-hidden="true" />
              فصولي
            </h2>
            <p className="mt-1 text-sm leading-7 text-muted-foreground">
              <b>الإتاحةُ إعلانُك أنت:</b> تُبنى عليها قائمةُ «المدرّبون المتاحون لهذا الفصل» قبل أن تُنشأ
              شعبةٌ واحدة. ومن اعتذر لا تُخطَّط له شعبةٌ في ذلك الفصل.
            </p>

            <ul className="mt-4 space-y-3">
              {terms.map((t) => {
                const state = t.myStatus ? TERM_STATE[t.myStatus] : null;
                return (
                  <li key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="text-sm font-black">{t.titleAr}</span>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(t.startsOn)} — {fmtDate(t.endsOn)}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-micro font-black ${
                          state ? state.cls : "border-white/15 text-muted-foreground"
                        }`}
                      >
                        {state ? state.label : "لم تُجب بعد"}
                      </span>
                    </div>

                    {/* ما خُطِّط له فيه — فالاعتذارُ عن فصلٍ فيه ثلاثُ شعبٍ قرارٌ آخر */}
                    {t.assignedCohorts.length > 0 && (
                      <p className="mt-2 text-xs leading-6 text-gold-ink">
                        مُسنَدٌ إليك فيه {t.assignedCohorts.length}{" "}
                        {t.assignedCohorts.length === 1 ? "شعبة" : t.assignedCohorts.length === 2 ? "شعبتان" : "شعب"} —{" "}
                        {t.assignedCohorts.map((c) => c.title).join(" · ")}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button" disabled={busy || t.myStatus === "confirmed"}
                        onClick={() => void answerTerm(t.id, "confirmed")}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-teal px-5 text-sm font-black text-on-teal disabled:opacity-50"
                      >
                        أنا متاحٌ فيه
                      </button>
                      <button
                        type="button" disabled={busy || t.myStatus === "declined"}
                        onClick={() => void answerTerm(t.id, "declined")}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-bold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                      >
                        أعتذر عنه
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── غيابي ── */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-black">
            <CalendarOff className="h-5 w-5 text-teal" aria-hidden="true" />
            فترات غيابي
          </h2>
          <p className="mt-1 text-sm leading-7 text-muted-foreground">
            <b>الغيابُ مانعٌ لا تنبيه:</b> لن تُسنَد إليك شعبةٌ تقع جلسةٌ من جلساتها في مدّةٍ سجّلتَها هنا.
          </p>

          {upcoming.length > 0 && (
            <ul className="mt-4 space-y-2">
              {upcoming.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                  <span className="text-sm font-bold">{fmtDate(b.startsAt)} — {fmtDate(b.endsAt)}</span>
                  {b.reason && <span className="text-xs text-muted-foreground">{b.reason}</span>}
                  <button
                    type="button" disabled={busy} onClick={() => void removeLeave(b.id)}
                    className="ms-auto inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-white/15 px-3 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> احذف
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground" htmlFor="leave-from">من</label>
              <input
                id="leave-from" type="date" value={leave.startsAt}
                onChange={(e) => setLeave({ ...leave, startsAt: e.target.value })}
                aria-invalid={leaveErr ? true : undefined}
                aria-describedby={leaveErr ? "leave-err" : undefined}
                className="min-h-[44px] w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground" htmlFor="leave-to">إلى</label>
              <input
                id="leave-to" type="date" value={leave.endsAt}
                onChange={(e) => setLeave({ ...leave, endsAt: e.target.value })}
                aria-invalid={leaveErr ? true : undefined}
                className="min-h-[44px] w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground" htmlFor="leave-why">السبب (اختياري)</label>
              <input
                id="leave-why" type="text" maxLength={120} value={leave.reason}
                onChange={(e) => setLeave({ ...leave, reason: e.target.value })}
                placeholder="سفر · امتحانات · التزامٌ آخر"
                className="min-h-[44px] w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 text-sm"
              />
            </div>
            <button
              type="button" disabled={busy} onClick={() => void addLeave()}
              className="mt-auto inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-teal px-5 text-sm font-black text-on-teal disabled:opacity-60"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> سجّل
            </button>
            {leaveErr && (
              <p id="leave-err" role="alert" className="text-micro font-bold text-red-300 sm:col-span-4">{leaveErr}</p>
            )}
          </div>
        </section>
      </div>
    </TrainerLayout>
  );
}
