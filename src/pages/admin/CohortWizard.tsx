/* معالجُ إنشاء الشعبة — خمسُ خطواتٍ بدل نموذجٍ واحدٍ وستَّةِ شروطٍ تُكتشَف بعد الحفظ.

   ما كان يحدث (جولة ٢٠٦-٠٩، الرحلة ٧): نموذجٌ من خمسة حقولٍ يُنشئ «مسودّة»،
   ثمّ تظهر شروطُ الفتح الستّةُ حمراءَ فيبدأ الموظّفُ رحلةً ثانيةً: جلسةٌ
   واحدةً واحدة، ومدرّبٌ من نموذجٍ آخر، وسعرٌ من ثالث. والجدولُ الأسبوعيُّ
   الذي عبّأه لا يولّد شيئا.

   وهنا الترتيبُ هو الترتيبُ الذي يفكّر به من يفتح فصلا: أيُّ دورة، ثمّ متى
   ولكم، ثمّ بكم ولكم مقعدا، ثمّ من يدرّس، ثمّ نظرةٌ أخيرةٌ قبل الإنشاء.
   والجلساتُ تُولَّد من الجدول في الخطوة نفسِها التي يُكتب فيها. */

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, Check, ChevronLeft, ChevronRight, Loader2, Sparkles, UserCheck, Users, Wallet,
} from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import DayOfWeekPicker from "@/components/DayOfWeekPicker";
import { daysLabelAr, fmtDateAr, fmtDateTimeAr } from "@/utils/format";

export interface WizardCourse {
  id: string;
  title: string;
  currency?: string;
  listPrice?: number | null;
}

interface PlannedSession { title: string; startsAt: string; endsAt: string; duplicate: boolean }
interface GeneratePreview { applied: boolean; created: number; skipped: number; sessions: PlannedSession[] }
interface EligibleTrainer { profileId: string; name: string; qualification: string }
interface Checklist { ready: boolean; missing: string[] }

const STEPS = ["الدورة", "الجدول", "المقاعد والسعر", "المدرّب", "المراجعة"] as const;

/** ترتيبُ الأسبوع كما في `Date.getUTCDay` — والخادمُ يستعمل الترتيبَ نفسَه */
const DAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** أوّلُ يومِ عملٍ قادم — قيمةٌ افتراضيّةٌ معقولةٌ لبداية الفصل */
function nextWeekISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7 - d.getDay());
  return d.toISOString().slice(0, 10);
}

export default function CohortWizard({
  courses,
  onDone,
  onError,
}: {
  courses: WizardCourse[];
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [courseId, setCourseId] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [title, setTitle] = useState("");

  const [days, setDays] = useState<string[]>(["tue", "thu"]);
  const [startTime, setStartTime] = useState("18:00");
  const [weeks, setWeeks] = useState("8");
  const [duration, setDuration] = useState("120");
  const [from, setFrom] = useState(nextWeekISO());

  const [capacity, setCapacity] = useState("20");
  const [price, setPrice] = useState("");

  const [trainers, setTrainers] = useState<EligibleTrainer[] | null>(null);
  const [trainerId, setTrainerId] = useState("");

  const course = useMemo(() => courses.find((c) => c.id === courseId) ?? null, [courses, courseId]);
  const currency = course?.currency ?? "USD";
  const shown = useMemo(() => {
    const q = courseFilter.trim();
    if (!q) return courses.slice(0, 60);
    return courses.filter((c) => c.title.includes(q) || c.id.includes(q.toUpperCase())).slice(0, 60);
  }, [courses, courseFilter]);

  /* العنوانُ يُقترَح من الدورة والشهر — ويبقى قابلا للتغيير */
  useEffect(() => {
    if (!course || title) return;
    const month = new Date(from).toLocaleDateString("ar", { month: "long", year: "numeric" });
    setTitle(`${course.title} — ${month}`);
  }, [course, from, title]);

  /* معاينةُ الجلسات: حسابٌ محضٌ من المُدخَلات — لا تأثيرَ ولا نداءَ شبكة.

     والقواعدُ هي قواعدُ الخادم نفسُها (`generateSessions`): أسبوعٌ يبدأ
     بالأحد، وما مضى لا يُجدَّل. والجوابُ المُعتمَدُ بعد الإنشاء جوابُ الخادم. */
  const preview = useMemo<PlannedSession[]>(() => {
    if (!/^\d{2}:\d{2}$/.test(startTime) || days.length === 0) return [];
    const [hh, mm] = startTime.split(":").map(Number);
    const start = new Date(`${from}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) return [];
    const weekStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() - start.getUTCDay()));
    const out: PlannedSession[] = [];
    const w = Math.max(1, Math.min(52, Number(weeks) || 1));
    const dur = Math.max(15, Number(duration) || 120);
    let n = 0;
    for (let i = 0; i < w; i += 1) {
      for (const d of [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))) {
        const at = new Date(weekStart);
        at.setUTCDate(weekStart.getUTCDate() + i * 7 + DAY_ORDER.indexOf(d));
        at.setUTCHours(hh, mm, 0, 0);
        if (at < start) continue;
        n += 1;
        out.push({
          title: `الجلسة ${n}`,
          startsAt: at.toISOString(),
          endsAt: new Date(at.getTime() + dur * 60_000).toISOString(),
          duplicate: false,
        });
      }
    }
    return out;
  }, [days, startTime, weeks, duration, from]);

  /* مدرّبو هذه الدورة يُقرأون بعد وجود الشعبة — ولا شعبةَ قبل الإنشاء.
     فنقرأ المؤهَّلين للدورة من مسارٍ عامّ إن وُجد، وإلّا تُترك الخطوةُ
     اختياريّةً ويُسنَد المدرّبُ من بطاقة الشعبة بعد الإنشاء. */
  useEffect(() => {
    if (step !== 3 || !courseId || trainers !== null) return;
    let alive = true;
    apiGet<EligibleTrainer[]>(`/api/admin/courses/${encodeURIComponent(courseId)}/eligible-trainers`)
      .then((r) => { if (alive) setTrainers(r) })
      .catch(() => { if (alive) setTrainers([]) });
    return () => { alive = false };
  }, [step, courseId, trainers]);

  /* ما ينقص الخطوة، بالاسم لا بزرٍّ مطفأ.

     كان «التالي» يُطفأ على تعبيرٍ واحدٍ فيه خمسةُ شروط، والموظّفُ يمسح
     الحقولَ بعينه يبحث عن الشرط الذي لم يستوفِه — والخطوةُ الأولى والثالثة
     لم تكن تقول شيئا أصلا. فصارت الشروطُ قائمةَ نقصٍ تُقرأ بجانب الزرّ،
     وكلُّ عنصرٍ فيها بصيغة ما يُفعل لا ما يَنقص. */
  const stepMissing = useMemo<string[]>(() => {
    const m: string[] = [];
    if (step === 0) {
      if (!courseId) m.push("اختر الدورةَ من القائمة");
      if (title.trim().length < 3) m.push("اكتب عنوانا للشعبة — ثلاثةُ أحرفٍ على الأقلّ");
    } else if (step === 1) {
      if (days.length === 0) m.push("اختر يوما واحدا على الأقلّ");
      if (!/^\d{2}:\d{2}$/.test(startTime)) m.push("حدّد وقتَ البدء");
      if (!(Number(weeks) >= 1 && Number(weeks) <= 52)) m.push("عددُ الأسابيع بين واحدٍ واثنين وخمسين");
      if (!(Number(duration) >= 15)) m.push("مدّةُ الجلسة خمسَ عشرةَ دقيقةً على الأقلّ");
      if (preview.length === 0) m.push("جدولٌ يُنتج جلسةً واحدةً على الأقلّ — راجع أوّلَ أسبوع");
    } else if (step === 2) {
      if (!(Number(capacity) >= 1)) m.push("سعةُ الشعبة مقعدٌ واحدٌ على الأقلّ");
      if (price !== "" && Number(price) < 0) m.push("السعرُ صفرٌ أو أكثر");
    }
    return m;
  }, [step, courseId, title, days, startTime, weeks, duration, preview.length, capacity, price]);

  const canNext = stepMissing.length === 0;

  const reset = () => {
    setStep(0); setCourseId(""); setCourseFilter(""); setTitle("");
    setDays(["tue", "thu"]); setStartTime("18:00"); setWeeks("8"); setDuration("120");
    setFrom(nextWeekISO()); setCapacity("20"); setPrice("");
    setTrainers(null); setTrainerId("");
  };

  /* الإنشاءُ فعلٌ واحدٌ من نظر الموظّف، وأربعةُ نداءاتٍ من نظر النظام.
     وأيُّ نداءٍ يسقط بعد الأوّل لا يُخفى: الشعبةُ أُنشئت، ويُقال ما لم يتمّ. */
  const create = async (thenOpen: boolean) => {
    setBusy(true);
    const notes: string[] = [];
    try {
      const cohort = await apiPost<{ id: string }>("/api/admin/cohorts", {
        courseId,
        title: title.trim(),
        capacity: Number(capacity),
        price: price ? Number(price) : undefined,
        daysOfWeek: days,
        startTime,
      });

      try {
        const gen = await apiPost<GeneratePreview>(`/api/admin/cohorts/${cohort.id}/sessions/generate`, {
          weeks: Math.max(1, Math.min(52, Number(weeks) || 1)),
          from: new Date(`${from}T00:00:00.000Z`).toISOString(),
          /* القيمةُ نفسُها التي حُسبت بها المعاينة — لا قيمةٌ خامٌّ يرفضها الخادم */
          durationMinutes: Math.max(15, Number(duration) || 120),
          apply: true,
        });
        notes.push(`${gen.created} جلسة`);
      } catch (e) {
        notes.push(`الجلسات لم تُولَّد (${e instanceof ApiError ? e.message : "خطأ"}) — ولّدها من بطاقة الشعبة`);
      }

      if (trainerId) {
        try {
          await apiPost(`/api/admin/cohorts/${cohort.id}/trainers`, { profileId: trainerId, role: "lead" });
          notes.push("ومدرّبٌ مسنَد");
        } catch (e) {
          notes.push(`المدرّبُ لم يُسنَد (${e instanceof ApiError ? e.message : "خطأ"})`);
        }
      }

      if (thenOpen) {
        try {
          const check = await apiGet<Checklist>(`/api/admin/cohorts/${cohort.id}/open-checklist`);
          if (check.ready) {
            await apiPost(`/api/admin/cohorts/${cohort.id}/open`, {});
            notes.push("وفُتحت للتسجيل");
          } else {
            notes.push(`بقيت مسودّةً — ينقصها: ${check.missing.join(" · ")}`);
          }
        } catch {
          notes.push("تعذّر فحصُ شروط الفتح — راجع بطاقةَ الشعبة");
        }
      }

      onDone(`أُنشئت «${title.trim()}» — ${notes.join(" · ")}`);
      reset();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "تعذّر إنشاءُ الشعبة");
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "mt-1 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
      {/* خطواتٌ مرقّمة — الرقمُ يقول أين أنت لا يزيّن */}
      <ol className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px]">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { if (i < step) setStep(i) }}
              disabled={i > step}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold transition ${
                i === step ? "bg-teal text-on-teal"
                : i < step ? "cursor-pointer border border-teal/40 text-teal-light-ink hover:bg-teal/10"
                : "border border-white/10 text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-3 w-3" aria-hidden="true" /> : <span>{i + 1}</span>}
              {label}
            </button>
            {i < STEPS.length - 1 && <ChevronLeft className="h-3 w-3 text-muted-foreground/50" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {/* ١ · الدورة */}
      {step === 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="wiz-course-filter">الدورة — المنشورة فقط</label>
            <input id="wiz-course-filter" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}
              placeholder="ابحث بعنوان الدورة أو رمزها" className={inputCls} />
            <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-white/10">
              {shown.length === 0 && <p className="px-3 py-3 text-[11px] text-muted-foreground">لا دورةَ بهذا الاسم.</p>}
              {shown.map((c) => (
                <button key={c.id} type="button" onClick={() => setCourseId(c.id)}
                  className={`flex w-full items-center justify-between gap-3 border-b border-white/5 px-3 py-2.5 text-right transition last:border-b-0 ${
                    courseId === c.id ? "bg-teal/15" : "hover:bg-white/5"
                  }`}>
                  <span className="truncate text-xs font-bold text-foreground">{c.title}</span>
                  <span dir="ltr" className="shrink-0 font-mono text-micro text-muted-foreground">{c.id}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="wiz-title">عنوان الشعبة</label>
            <input id="wiz-title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="شعبة أكتوبر 2026 — مسائية" className={inputCls} />
            <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
              يُقترَح من الدورة والشهر، وهو ما يراه المتعلّمُ في فاتورته وشهادته — فاجعله يفرّق هذه الشعبةَ عن أختها.
            </p>
            {course && (
              <p className="mt-3 rounded-xl border border-white/10 bg-paper/20 px-3 py-2.5 text-[11px] text-muted-foreground">
                سعرُ قائمة الدورة: {course.listPrice ?? "—"} {currency}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ٢ · الجدول والجلسات */}
      {step === 1 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><DayOfWeekPicker value={days} onChange={setDays} /></div>
            <label className="text-xs text-muted-foreground">
              وقت البدء
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
            </label>
            <label className="text-xs text-muted-foreground">
              مدّة الجلسة (دقيقة)
              <input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls} />
            </label>
            <label className="text-xs text-muted-foreground">
              أوّلُ أسبوع
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
            </label>
            <label className="text-xs text-muted-foreground">
              عددُ الأسابيع
              <input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(e.target.value)} className={inputCls} />
            </label>
          </div>
          <div className="rounded-2xl border border-teal/25 bg-teal/[0.05] p-4">
            <p className="flex items-center gap-2 text-xs font-black text-teal-light-ink">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {`${preview.length} جلسة ستُنشأ`}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">تُولَّد مع الشعبة، ولك تعديلُ أيٍّ منها بعدها.</p>
            {Number(duration) < 15 && (
              <p role="alert" className="mt-2 text-[11px] font-bold text-red-300">مدّةُ الجلسة خمسَ عشرةَ دقيقةً على الأقلّ.</p>
            )}
            {days.length === 0 && (
              <p role="alert" className="mt-2 text-[11px] font-bold text-red-300">اختر يوما واحدا على الأقلّ.</p>
            )}
            <ul className="mt-3 max-h-52 space-y-1 overflow-y-auto text-[11px] text-foreground">
              {preview.slice(0, 40).map((s) => (
                <li key={s.startsAt} className="flex items-center justify-between gap-2 border-b border-white/5 pb-1">
                  <span className="font-bold">{s.title}</span>
                  <span className="text-muted-foreground">{fmtDateTimeAr(s.startsAt)}</span>
                </li>
              ))}
              {preview.length === 0 && <li className="text-muted-foreground">لا جلسة — راجع الأيّامَ وأوّلَ أسبوع.</li>}
            </ul>
            {preview.length > 40 && (
              <p className="mt-2 text-micro text-muted-foreground">…و{preview.length - 40} جلسةً أخرى</p>
            )}
          </div>
        </div>
      )}

      {/* ٣ · المقاعد والسعر */}
      {step === 2 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" aria-hidden="true" /> السعة</span>
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className={inputCls} />
            <span className="mt-1 block text-micro text-muted-foreground">الفائضُ يتحوّل إلى قائمة انتظار آليّا.</span>
          </label>
          <label className="text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" aria-hidden="true" /> السعر ({currency})</span>
            <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)}
              placeholder={course?.listPrice != null ? String(course.listPrice) : undefined} className={inputCls} />
            <span className="mt-1 block text-micro text-muted-foreground">
              يُورَث من سعر قائمة الدورة إن تُرك فارغا — والعملةُ عملةُ الدورة لا افتراضا.
            </span>
          </label>
        </div>
      )}

      {/* ٤ · المدرّب */}
      {step === 3 && (
        <div>
          {trainers === null && <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden="true" /> تُقرأ قائمةُ المدرّبين…</p>}
          {trainers !== null && trainers.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-paper/20 px-4 py-3 text-[11px] leading-6 text-muted-foreground">
              لا مدرّبَ مؤهَّلا لهذه الدورة بعد — تُنشأ الشعبةُ مسودّةً، ويُسنَد المدرّبُ من بطاقتها متى تأهّل.
              وشرطُ الفتح يبقى قائما: لا شعبةَ تُفتح بلا مدرّب.
            </p>
          )}
          {trainers !== null && trainers.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              <li>
                <button type="button" onClick={() => setTrainerId("")}
                  className={`w-full rounded-xl border px-4 py-3 text-right text-xs font-bold transition ${
                    trainerId === "" ? "border-teal bg-teal/10 text-foreground" : "border-white/12 text-muted-foreground hover:border-white/30"
                  }`}>
                  أُسنده لاحقا
                </button>
              </li>
              {trainers.map((t) => (
                <li key={t.profileId}>
                  <button type="button" disabled={t.qualification !== "qualified"} onClick={() => setTrainerId(t.profileId)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-right text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                      trainerId === t.profileId ? "border-teal bg-teal/10 text-foreground" : "border-white/12 text-foreground hover:border-white/30"
                    }`}>
                    <span className="flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5" aria-hidden="true" /> {t.name}</span>
                    {t.qualification !== "qualified" && <span className="text-micro text-muted-foreground">غيرُ مؤهَّلٍ لهذه الدورة</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ٥ · المراجعة */}
      {step === 4 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <dl className="rounded-2xl border border-white/10 bg-paper/20 p-4 text-xs">
            {[
              ["الدورة", course?.title ?? "—"],
              ["العنوان", title.trim() || "—"],
              ["الجدول", `${daysLabelAr(days)} · ${startTime} · ${duration} دقيقة`],
              ["المدى", `${weeks} أسبوعا من ${fmtDateAr(from)}`],
              ["الجلسات", `${preview.length} جلسة تُولَّد الآن`],
              ["المقاعد", capacity],
              ["السعر", price
                ? `${price} ${currency}`
                : course?.listPrice != null
                  ? `${course.listPrice} ${currency} — موروثٌ من سعر قائمة الدورة`
                  : `بلا سعر — وشرطُ الفتح يمنع شعبةً بلا سعر`],
              ["المدرّب", trainerId ? (trainers?.find((t) => t.profileId === trainerId)?.name ?? "مسنَد") : "لاحقا"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 border-b border-white/5 py-1.5 last:border-b-0">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-left font-bold text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-2xl border border-gold/25 bg-gold/[0.06] p-4 text-[11px] leading-6 text-foreground">
            <p className="font-black text-gold-ink">قبل الفتح للتسجيل</p>
            <p className="mt-1">
              الشعبةُ تُنشأ مسودّةً. و«أنشئ وافتح» يفحص شروطَ الفتح الستّة أوّلا: خطّةُ تقديمٍ معتمدة، مدرّبٌ
              مؤهَّلٌ مسنَد، جدولٌ وجلسات، سعةٌ وسعرٌ، وإعدادٌ ماليّ. فإن نقص شيءٌ بقيت مسودّةً وقيل لك ما ينقص —
              ولا تُفتح شعبةٌ ناقصةٌ للمتعلّمين.
            </p>
          </div>
        </div>
      )}

      {/* التنقّل */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
        <button type="button" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-5 py-2 text-xs font-bold text-foreground transition hover:border-white/40 disabled:opacity-30">
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /> السابق
        </button>
        {/* السببُ بجانب الزرّ — لا في ذيل الصفحة ولا في تلميحٍ يظهر بالمرور */}
        {step < STEPS.length - 1 && stepMissing.length > 0 && (
          <p role="status" className="order-last w-full text-[11px] leading-6 text-gold-ink sm:order-none sm:w-auto sm:flex-1">
            قبل «التالي»: {stepMissing.join(" · ")}
          </p>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" disabled={!canNext || busy} onClick={() => setStep(step + 1)}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-6 py-2 text-xs font-black text-foreground transition hover:bg-white/15 disabled:opacity-40">
            التالي <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void create(false)}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-6 py-2 text-xs font-bold text-foreground transition hover:border-white/40 disabled:opacity-40">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null} أنشئ مسودّة
            </button>
            <button type="button" disabled={busy} onClick={() => void create(true)}
              className="flex cursor-pointer items-center gap-2 rounded-full bg-teal px-6 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light disabled:opacity-40">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
              أنشئ وافتح إن استوفت
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
