import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, FileUp, Loader2, ShieldCheck } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { apiPost, ApiError } from "@/services/api";
import { courses } from "@/data/courses";

const inputCls =
  "w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal focus:outline-none";

const DOC_KINDS = [
  { kind: "cv", label: "السيرة الذاتية" },
  { kind: "training_video", label: "فيديو تدريبي (حتى ٣٠٠MB)" },
  { kind: "certificate", label: "شهادات واعتمادات" },
  { kind: "evidence", label: "أدلة أو توصيات" },
];

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

interface UploadState { status: "idle" | "registering" | "uploading" | "done" | "error"; name?: string }

/** المرحلة الثانية — الاستكمال المهني: تُفتح للمرشحين فقط برمز الوصول */
export default function JoinTrainerComplete() {
  const [params] = useSearchParams();
  const reference = params.get("ref") ?? "";
  const candidateToken = params.get("token") ?? "";

  const [prevCourses, setPrevCourses] = useState([{ title: "", org: "", year: "", learnersCount: "" }]);
  const [totalLearners, setTotalLearners] = useState("");
  const [previousOrgs, setPreviousOrgs] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [teachable, setTeachable] = useState<string[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [startFrom, setStartFrom] = useState("");
  const [demoConsent, setDemoConsent] = useState(false);
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const catalogCourses = useMemo(() => courses.map((c) => ({ id: c.id, title: c.name })), []);

  useEffect(() => { window.scrollTo(0, 0); }, [done]);

  const uploadFile = async (kind: string, file: File) => {
    setUploads((u) => ({ ...u, [kind]: { status: "registering", name: file.name } }));
    try {
      const reg = await apiPost<{ uploadUrl: string }>(`/api/v1/trainer-applications/${encodeURIComponent(reference)}/documents`, {
        candidateToken, kind, originalName: file.name, mime: file.type || "application/octet-stream", sizeBytes: file.size,
      });
      setUploads((u) => ({ ...u, [kind]: { status: "uploading", name: file.name } }));
      const res = await fetch(reg.uploadUrl, {
        method: "PUT", headers: { "content-type": "application/octet-stream" }, body: file,
      });
      if (!res.ok) throw new Error("upload failed");
      setUploads((u) => ({ ...u, [kind]: { status: "done", name: file.name } }));
    } catch (err) {
      setUploads((u) => ({ ...u, [kind]: { status: "error", name: file.name } }));
      setError(err instanceof ApiError ? err.message : `تعذر رفع «${file.name}» — حاول مجددا`);
    }
  };

  const validLink = reference.trim().length >= 5 && candidateToken.trim().length >= 10;
  const valid =
    validLink && prevCourses.some((c) => c.title.trim()) && teachable.length > 0 &&
    demoConsent && uploads.cv?.status === "done";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError("");
    try {
      await apiPost(`/api/v1/trainer-applications/${encodeURIComponent(reference)}/phase-2`, {
        candidateToken,
        previousCourses: prevCourses.filter((c) => c.title.trim()).map((c) => ({
          title: c.title, org: c.org || undefined,
          year: c.year ? Number(c.year) : undefined,
          learnersCount: c.learnersCount ? Number(c.learnersCount) : undefined,
        })),
        totalLearners: totalLearners ? Number(totalLearners) : undefined,
        previousOrgs: previousOrgs || undefined, evidenceNotes: evidenceNotes || undefined,
        teachableCourseIds: teachable,
        availability: { days, hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : undefined, startFrom: startFrom || undefined },
        demoConsent,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر الحفظ — تحقق من اتصالك وحاول مجددا");
    } finally {
      setBusy(false);
    }
  };

  if (!validLink) {
    return (
      <SiteShell>
        <SeoHead title="الاستكمال المهني" description="المرحلة الثانية من طلب انضمام المدرب" path="/join-trainer/complete" />
        <div className="mx-auto max-w-lg py-16 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-teal-light-ink" />
          <h1 className="mt-5 text-2xl font-black">هذه الصفحة للمرشحين فقط</h1>
          <p className="mt-3 text-sm leading-8 text-white/60">
            تُفتح المرحلة الثانية برابط خاص يصلك بعد اختصار طلبك. لم يصلك؟ راجع حالة طلبك من{" "}
            <Link to="/join-trainer" className="text-teal-light-ink underline">صفحة الانضمام</Link>.
          </p>
        </div>
      </SiteShell>
    );
  }

  if (done) {
    return (
      <SiteShell>
        <SeoHead title="اكتمل ملفك" description="اكتمل الملف المهني للمرشح" path="/join-trainer/complete" />
        <div className="mx-auto max-w-lg py-16 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-teal/15">
            <CheckCircle2 className="h-8 w-8 text-teal-light-ink" />
          </span>
          <h1 className="mt-6 text-2xl font-black">ملفك المهني اكتمل</h1>
          <p className="mt-3 text-sm leading-8 text-white/60">
            عاد طلبك <b className="font-mono" dir="ltr">{reference}</b> إلى المراجعة الأكاديمية بكل ما أرسلت.
            الخطوة التالية: مقابلة ثم درس تجريبي قصير — سنراسلك على بريدك.
          </p>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <SeoHead title="الاستكمال المهني" description="المرحلة الثانية من طلب انضمام المدرب" path="/join-trainer/complete" />
      <div className="mx-auto max-w-2xl">
        <span className="kicker">المرحلة الثانية — الاستكمال المهني</span>
        <h1 className="h-section mt-4">أثبت خبرتك — بالأدلة لا بالألقاب</h1>
        <p className="mt-3 text-sm leading-8 text-white/60">
          طلبك <b className="font-mono" dir="ltr">{reference}</b> مُختار أوليًا. أكمل ملفك: سيرة، أدلة،
          والدورات التي تستطيع تدريسها فعلا من كتالوجنا.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          {/* الوثائق */}
          <fieldset>
            <legend className="text-sm font-black">الوثائق والأدلة — ملفات خاصة لا يراها إلا لجنة المراجعة</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {DOC_KINDS.map((d) => (
                <label
                  key={d.kind}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
                    uploads[d.kind]?.status === "done"
                      ? "border-teal/50 bg-teal/10"
                      : "border-white/10 bg-black/20 hover:border-white/25"
                  }`}
                >
                  <input
                    type="file" className="sr-only"
                    accept={d.kind === "training_video" ? "video/*" : ".pdf,.doc,.docx,.txt,.jpg,.png"}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(d.kind, f); }}
                  />
                  {uploads[d.kind]?.status === "done"
                    ? <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-light-ink" />
                    : uploads[d.kind]?.status === "uploading" || uploads[d.kind]?.status === "registering"
                      ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-gold-ink" />
                      : <FileUp className="h-5 w-5 shrink-0 text-white/40" />}
                  <span className="text-xs">
                    <b className="block text-white/85">{d.label}{d.kind === "cv" ? " *" : ""}</b>
                    <span className="text-white/45" dir="ltr">{uploads[d.kind]?.name ?? "اختر ملفا"}</span>
                    {uploads[d.kind]?.status === "error" && <b className="block text-red-300">فشل الرفع — أعد المحاولة</b>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* الدورات السابقة */}
          <fieldset>
            <legend className="text-sm font-black">ثلاث دورات درّبتها سابقا — الأبرز فقط</legend>
            <div className="mt-3 space-y-3">
              {prevCourses.map((c, i) => (
                <div key={i} className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-4">
                  <input placeholder={`عنوان الدورة ${i + 1}`} value={c.title} aria-label={`عنوان الدورة ${i + 1}`}
                    onChange={(e) => setPrevCourses(prevCourses.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                    className={`${inputCls} sm:col-span-2`} />
                  <input placeholder="الجهة" value={c.org} aria-label="الجهة"
                    onChange={(e) => setPrevCourses(prevCourses.map((x, j) => j === i ? { ...x, org: e.target.value } : x))}
                    className={inputCls} />
                  <input placeholder="السنة" dir="ltr" value={c.year} aria-label="السنة"
                    onChange={(e) => setPrevCourses(prevCourses.map((x, j) => j === i ? { ...x, year: e.target.value } : x))}
                    className={`${inputCls} text-left`} />
                </div>
              ))}
              {prevCourses.length < 3 && (
                <button type="button" onClick={() => setPrevCourses([...prevCourses, { title: "", org: "", year: "", learnersCount: "" }])}
                  className="cursor-pointer text-xs font-bold text-teal-light-ink hover:text-teal-ink">
                  + أضف دورة أخرى
                </button>
              )}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="p2-learners" className="mb-1.5 block text-xs font-bold text-white/60">إجمالي المتدربين الذين درّبتهم</label>
              <input id="p2-learners" dir="ltr" inputMode="numeric" value={totalLearners} onChange={(e) => setTotalLearners(e.target.value)} className={`${inputCls} text-left`} />
            </div>
            <div>
              <label htmlFor="p2-orgs" className="mb-1.5 block text-xs font-bold text-white/60">جهات عملت معها سابقا</label>
              <input id="p2-orgs" value={previousOrgs} onChange={(e) => setPreviousOrgs(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label htmlFor="p2-evidence" className="mb-1.5 block text-xs font-bold text-white/60">أدلة وتوصيات — روابط أو وصف موجز</label>
            <textarea id="p2-evidence" rows={2} value={evidenceNotes} onChange={(e) => setEvidenceNotes(e.target.value)} className={inputCls} />
          </div>

          {/* الدورات القابلة للتدريس */}
          <fieldset>
            <legend className="text-sm font-black">الدورات الحالية التي تستطيع تدريسها فعلا *</legend>
            <p className="mt-1 text-[11px] text-white/45">من كتالوج وجيز الحالي — اختر ما تملك خبرة مثبتة فيه فقط.</p>
            <div className="mt-3 flex max-h-56 flex-wrap gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3">
              {catalogCourses.map((c) => (
                <button
                  type="button" key={c.id}
                  onClick={() => setTeachable(teachable.includes(c.id) ? teachable.filter((x) => x !== c.id) : [...teachable, c.id])}
                  aria-pressed={teachable.includes(c.id)}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                    teachable.includes(c.id)
                      ? "border-teal bg-teal/15 text-teal-light-ink"
                      : "border-white/15 text-white/55 hover:border-white/35"
                  }`}
                >
                  {c.title}
                </button>
              ))}
            </div>
          </fieldset>

          {/* التوفر */}
          <fieldset>
            <legend className="text-sm font-black">توفرك الأسبوعي</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <button
                  type="button" key={d} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
                  aria-pressed={days.includes(d)}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                    days.includes(d) ? "border-teal bg-teal/15 text-teal-light-ink" : "border-white/15 text-white/55 hover:border-white/35"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="p2-hours" className="mb-1.5 block text-xs font-bold text-white/60">ساعات أسبوعيا</label>
                <input id="p2-hours" dir="ltr" inputMode="numeric" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} className={`${inputCls} text-left`} />
              </div>
              <div>
                <label htmlFor="p2-start" className="mb-1.5 block text-xs font-bold text-white/60">يمكنك البدء من</label>
                <input id="p2-start" placeholder="مثال: مطلع الشهر القادم" value={startFrom} onChange={(e) => setStartFrom(e.target.value)} className={inputCls} />
              </div>
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-black/20 p-3">
            <input type="checkbox" checked={demoConsent} onChange={(e) => setDemoConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal" />
            <span className="text-xs leading-6 text-white/60">
              أوافق على تقديم درس تجريبي (Demo) قصير أمام اللجنة الأكاديمية كجزء من التقييم. *
            </span>
          </label>

          {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200" role="alert">{error}</p>}

          <button
            type="submit" disabled={!valid || busy}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-gold py-3.5 font-black text-on-gold transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {busy ? "جاري الحفظ…" : "أكمل ملفي المهني"}
          </button>
          {!valid && (
            <p className="text-center text-[11px] text-white/40">
              يلزم: سيرة ذاتية مرفوعة + دورة سابقة واحدة على الأقل + دورة قابلة للتدريس + موافقة الديمو.
            </p>
          )}
        </form>
      </div>
    </SiteShell>
  );
}
