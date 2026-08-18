import { useCallback, useEffect, useState } from "react";
import {
  CalendarCheck, CheckCircle2, ChevronLeft, ClipboardList, FileText, KeyRound,
  Loader2, MailCheck, RefreshCw, ServerOff, Star, UserPlus, XCircle,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { TrainerDetailOps, TrainerChangeRequests } from "./TrainerOps";

const STATUS_LABELS: Record<string, string> = {
  email_verification_pending: "بانتظار تحقق البريد",
  submitted: "مُقدَّم", under_review: "قيد المراجعة",
  information_requested: "بانتظار معلومات المرشح", shortlisted: "مختار أولي",
  interview_scheduled: "مقابلة مجدولة", demo_requested: "بانتظار الديمو",
  academic_review: "مراجعة أكاديمية", conditionally_approved: "قبول مشروط",
  contract_pending: "عقد قيد التوقيع", onboarding: "تهيئة", active: "نشط",
  waitlisted: "انتظار", rejected: "مرفوض", withdrawn: "مسحوب", suspended: "موقوف",
};

const RUBRIC_AXES: { key: string; label: string }[] = [
  { key: "domain_expertise", label: "خبرة المجال" },
  { key: "evidence_of_expertise", label: "أدلة الخبرة" },
  { key: "explanation_facilitation", label: "الشرح والتيسير" },
  { key: "demo_quality", label: "جودة الديمو" },
  { key: "activity_assessment_design", label: "تصميم الأنشطة والتقييمات" },
  { key: "feedback_skill", label: "التغذية الراجعة" },
  { key: "digital_training", label: "التدريب الرقمي" },
  { key: "values_fit", label: "التوافق مع قيم وجيز" },
  { key: "availability", label: "التوفر" },
];

const DECISIONS: { action: string; label: string; from: string[]; tone: "main" | "warn" | "danger" }[] = [
  { action: "move_to_review", label: "بدء المراجعة", from: ["submitted", "waitlisted"], tone: "main" },
  { action: "request_info", label: "اطلب معلومات إضافية", from: ["under_review"], tone: "warn" },
  { action: "shortlist", label: "اختصار أولي", from: ["under_review"], tone: "main" },
  { action: "request_demo", label: "اطلب درسا تجريبيا", from: ["shortlisted", "interview_scheduled"], tone: "warn" },
  { action: "academic_review", label: "مراجعة أكاديمية", from: ["demo_requested"], tone: "main" },
  { action: "conditionally_approve", label: "قبول مشروط", from: ["academic_review"], tone: "main" },
  { action: "waitlist", label: "قائمة الانتظار", from: ["submitted", "under_review", "shortlisted", "interview_scheduled", "academic_review"], tone: "warn" },
  { action: "reject", label: "رفض بلطف", from: ["submitted", "under_review", "information_requested", "shortlisted", "interview_scheduled", "demo_requested", "academic_review", "conditionally_approved", "contract_pending", "waitlisted"], tone: "danger" },
];

interface AppRow {
  id: string; reference: string; status: string; fullName: string; email: string;
  country: string | null; jobTitle: string | null; domainYears: string | null; trainingYears: string | null;
  specialties: string[]; createdAt: string; emailVerified: boolean; phase2Done: boolean;
  documentsCount: number; reviewsCount: number; interviewsCount: number;
}

interface AppDetail extends Record<string, unknown> {
  id: string; reference: string; status: string; fullName: string; email: string;
  jobTitle: string | null; country: string | null;
  motivation: string | null; bio: string | null; linkedinUrl: string | null;
  documents: { id: string; kind: string; originalName: string; storageKey: string }[];
  documentUrls: Record<string, string>;
  reviews: { id: string; scores: Record<string, number>; overallNote: string | null; createdAt: string }[];
  interviews: { id: string; scheduledAt: string; outcome: string | null }[];
  statusHistory: { fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }[];
  profile: { id: string; userId: string | null } | null;
}

/** إدارة طلبات انضمام المدربين — API حقيقي: مراجعة بشرية، قرارات، عقد، دعوة آمنة */
export default function TrainerApplications() {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [selected, setSelected] = useState<AppDetail | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [mode, setMode] = useState<"apps" | "changes">("apps");

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try {
      const rows = await apiGet<AppRow[]>(`/api/admin/trainer-applications${filter ? `?status=${filter}` : ""}`);
      setApps(rows);
    } catch (err) {
      setOffline(err instanceof ApiError ? err.message : "الخادم غير متصل — شغّل واجهة API أولا");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const openDetail = async (id: string) => {
    try {
      const detail = await apiGet<AppDetail>(`/api/admin/trainer-applications/${id}`);
      setSelected(detail);
      setScores({}); setNote("");
    } catch (err) {
      setFlash(err instanceof ApiError ? err.message : "تعذر فتح الطلب");
    }
  };

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true); setFlash("");
    try {
      await fn();
      setFlash(doneMsg);
      if (selected) await openDetail(selected.id);
      await load();
    } catch (err) {
      setFlash(err instanceof ApiError ? err.message : "تعذر تنفيذ الإجراء");
    } finally {
      setBusy(false);
    }
  };

  if (offline) {
    return (
      <AdminLayout title="طلبات انضمام المدربين">
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <ServerOff className="h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">{offline}</p>
          <button onClick={() => void load()} className="mt-5 flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-xs font-bold text-white/70 hover:border-white/40">
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </button>
        </div>
      </AdminLayout>
    );
  }

  /* ── عرض التفاصيل ── */
  if (selected) {
    const a = selected;
    const available = DECISIONS.filter((d) => d.from.includes(a.status));
    const rubricComplete = RUBRIC_AXES.every((x) => scores[x.key] >= 1);
    return (
      <AdminLayout title={`الطلب ${a.reference}`}>
        <button onClick={() => setSelected(null)} className="mb-4 flex cursor-pointer items-center gap-1.5 text-xs font-bold text-[#6EC7D1] hover:text-[#38A7B4]">
          <ChevronLeft className="h-4 w-4" /> كل الطلبات
        </button>

        {flash && <p className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs font-bold text-white/80" role="status">{flash}</p>}

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black">{a.fullName}</h3>
                  <p className="mt-1 text-xs text-white/50">
                    {a.jobTitle ?? "—"} · {a.country ?? "—"}
                    {(() => {
                      const labels: Record<string, string> = { employed: "موظف", own_business: "عمل خاص", full_time_training: "متفرغ للتدريب" };
                      const emp = labels[(a as Record<string, unknown>).employmentStatus as string];
                      return emp ? ` · ${emp}` : "";
                    })()}
                  </p>
                  <p className="mt-1 text-[11px] text-white/50" dir="ltr">{a.email}</p>
                </div>
                <span className="rounded-full border border-[#38A7B4]/40 px-3 py-1 text-[11px] font-bold text-[#6EC7D1]">
                  {STATUS_LABELS[a.status] ?? a.status}
                </span>
              </div>
              {a.bio && <p className="mt-4 text-xs leading-6 text-white/65">{a.bio}</p>}
              {a.motivation && (
                <p className="mt-3 rounded-xl border border-white/5 bg-black/20 p-3 text-xs leading-6 text-white/65">
                  <span className="font-bold text-white/50">لماذا وجيز؟ </span>{a.motivation}
                </p>
              )}
              {a.linkedinUrl && <p className="mt-2 text-[11px] text-[#6EC7D1]" dir="ltr">{a.linkedinUrl}</p>}
              {(() => {
                const yt = a.youtubeUrl as string | null | undefined
                const ig = a.instagramUrl as string | null | undefined
                const accred = a.hasAccreditation as boolean | null | undefined
                const accredDetails = a.accreditationDetails as string | null | undefined
                const tCountries = (a.targetCountries as string[] | undefined) ?? []
                const tAudiences = (a.targetAudiences as string[] | undefined) ?? []
                if (!yt && !ig && !accred && !tCountries.length && !tAudiences.length) return null
                return (
                  <div className="mt-4 space-y-2.5 rounded-xl border border-white/5 bg-black/20 p-3 text-xs leading-6 text-white/65">
                    {(yt || ig) && (
                      <p>
                        <span className="font-bold text-white/50">الحضور الرقمي: </span>
                        {yt && <span dir="ltr" className="text-[#6EC7D1]">{yt}</span>}
                        {yt && ig && ' · '}
                        {ig && <span dir="ltr" className="text-[#6EC7D1]">{ig}</span>}
                      </p>
                    )}
                    {accred && (
                      <p><span className="font-bold text-white/50">اعتماد رسمي: </span>{accredDetails || 'نعم — بلا تفاصيل مذكورة'}</p>
                    )}
                    {!!tCountries.length && (
                      <p><span className="font-bold text-white/50">الدول المستهدفة: </span>{tCountries.join('، ')}</p>
                    )}
                    {!!tAudiences.length && (
                      <p><span className="font-bold text-white/50">الفئات المستهدفة: </span>{tAudiences.join('، ')}</p>
                    )}
                  </div>
                )
              })()}
            </article>

            {/* الوثائق الخاصة */}
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h4 className="flex items-center gap-2 text-sm font-black"><FileText className="h-4 w-4 text-[#6EC7D1]" /> الوثائق — روابط موقعة تنتهي خلال دقائق</h4>
              {a.documents.length === 0 ? (
                <p className="mt-3 text-xs text-white/45">لم يرفع المرشح وثائق بعد.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {a.documents.map((d) => (
                    <li key={d.id}>
                      <a href={a.documentUrls[d.storageKey]} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/75 transition hover:border-[#38A7B4]/40">
                        <FileText className="h-4 w-4 text-[#6EC7D1]" />
                        <span className="font-bold">{d.kind}</span>
                        <span dir="ltr" className="text-white/45">{d.originalName}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            {/* سجل الحالات */}
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h4 className="flex items-center gap-2 text-sm font-black"><ClipboardList className="h-4 w-4 text-[#6EC7D1]" /> سجل الحالة</h4>
              <ol className="mt-3 space-y-2">
                {a.statusHistory.map((h, i) => (
                  <li key={i} className="flex items-center gap-2 text-[11px] text-white/55">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#38A7B4]" />
                    <b className="text-white/80">{STATUS_LABELS[h.toStatus] ?? h.toStatus}</b>
                    {h.note && <span>— {h.note}</span>}
                    <span className="mr-auto text-white/30">{new Date(h.createdAt).toLocaleString("ar")}</span>
                  </li>
                ))}
              </ol>
            </article>

            {/* عمليات متقدمة: مقابلات، ديمو، مراجع، عقود، تأهيل وإسناد وإيقاف */}
            <TrainerDetailOps app={a} onAction={act} />
          </div>

          {/* عمود القرارات والروبرك */}
          <div className="space-y-4">
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h4 className="text-sm font-black">الروبرك — تسعة محاور (١–٥)</h4>
              <div className="mt-3 space-y-2">
                {RUBRIC_AXES.map((x) => (
                  <div key={x.key} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-white/60">{x.label}</span>
                    <div className="flex gap-1" role="radiogroup" aria-label={x.label}>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v} type="button" onClick={() => setScores({ ...scores, [x.key]: v })}
                          aria-pressed={scores[x.key] === v}
                          className={`grid h-7 w-7 cursor-pointer place-items-center rounded-lg border text-[11px] font-bold transition ${
                            scores[x.key] === v ? "border-[#FABC05] bg-[#FABC05] text-[#0D0D0D]" : "border-white/15 text-white/50 hover:border-white/40"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="ملاحظة المراجع…"
                aria-label="ملاحظة المراجع"
                className="mt-3 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none"
              />
              <button
                disabled={!rubricComplete || busy}
                onClick={() => void act(() => apiPost(`/api/admin/trainer-applications/${a.id}/reviews`, { scores, overallNote: note || undefined }), "سُجل التقييم")}
                className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#38A7B4] py-2.5 text-xs font-black text-[#08272B] transition hover:bg-[#38A7B4]/90 disabled:opacity-40"
              >
                <Star className="h-3.5 w-3.5" /> سجّل التقييم
              </button>
              <p className="mt-2 text-center text-[10px] text-white/50">{a.reviews.length} تقييم مسجل</p>
            </article>

            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h4 className="text-sm font-black">القرار — بشري بالكامل</h4>
              <div className="mt-3 space-y-2">
                {available.length === 0 && <p className="text-xs text-white/45">لا إجراءات متاحة في هذه الحالة.</p>}
                {available.map((d) => (
                  <button
                    key={d.action} disabled={busy}
                    onClick={() => void act(
                      () => apiPost(`/api/admin/trainer-applications/${a.id}/decision`, { action: d.action, note: note || undefined }),
                      "نُفذ القرار وسُجل في الأثر",
                    )}
                    className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-2.5 text-xs font-black transition disabled:opacity-40 ${
                      d.tone === "main" ? "bg-[#FABC05] text-[#0D0D0D] hover:bg-[#FABC05]/90"
                        : d.tone === "warn" ? "border border-[#FABC05]/50 text-[#FABC05] hover:bg-[#FABC05]/10"
                        : "border border-white/15 text-white/55 hover:border-red-400/40 hover:text-red-300"
                    }`}
                  >
                    {d.tone === "danger" ? <XCircle className="h-3.5 w-3.5" /> : d.action === "request_demo" ? <CalendarCheck className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {d.label}
                  </button>
                ))}
              </div>

              {a.status === "onboarding" && !a.profile?.userId && (
                <button
                  disabled={busy}
                  onClick={() => void act(async () => {
                    const r = await apiPost<{ expiresAt: string; devInvitationToken?: string }>(`/api/admin/trainer-applications/${a.id}/invitations`);
                    if (r.devInvitationToken) {
                      setFlash(`دعوة أُنشئت (تطوير): /trainer/accept-invite?token=${r.devInvitationToken}`);
                    }
                  }, "أُرسلت الدعوة الآمنة")}
                  className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-[#38A7B4]/50 py-2.5 text-xs font-black text-[#6EC7D1] transition hover:bg-[#38A7B4]/10 disabled:opacity-40"
                >
                  <KeyRound className="h-3.5 w-3.5" /> أرسل دعوة إنشاء الحساب
                </button>
              )}
              {a.profile?.userId && (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#6EC7D1]">
                  <MailCheck className="h-3.5 w-3.5" /> الحساب مُنشأ ومرتبط بالملف
                </p>
              )}
            </article>
          </div>
        </div>
      </AdminLayout>
    );
  }

  /* ── القائمة ── */
  return (
    <AdminLayout title="طلبات انضمام المدربين">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-white/15 p-1">
          {([["apps", "الطلبات"], ["changes", "اقتراحات تعديل الدورات"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-black transition ${mode === k ? "bg-[#FABC05] text-[#0D0D0D]" : "text-white/60 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>
        {mode === "apps" && (
          <>
            <select
              value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="رشّح بالحالة"
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white [&>option]:bg-[#121B1D]"
            >
              <option value="">كل الحالات</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={() => void load()} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/60 hover:border-white/40">
              <RefreshCw className="h-3.5 w-3.5" /> تحديث
            </button>
          </>
        )}
        {flash && <span className="text-xs font-bold text-[#6EC7D1]" role="status">{flash}</span>}
      </div>

      {mode === "changes" && <TrainerChangeRequests />}
      {mode === "apps" && (loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>
      ) : apps.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <UserPlus className="h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black">لا طلبات بهذه الحالة</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">
            طلبات نموذج «انضم مدربا» تصل هنا مباشرة عبر قاعدة البيانات فور إرسالها.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <button
              key={a.id} onClick={() => void openDetail(a.id)}
              className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-right transition hover:border-[#38A7B4]/40"
            >
              <div>
                <p className="font-black">{a.fullName} <span className="mr-2 font-mono text-[10px] text-white/50" dir="ltr">{a.reference}</span></p>
                <p className="mt-1 text-xs text-white/50">
                  {a.specialties.join(" · ") || "—"} · خبرة مجال {a.domainYears ?? "—"} · {a.jobTitle ?? "—"}
                </p>
                <p className="mt-1 text-[11px] text-white/50">
                  {a.emailVerified ? "بريد متحقق ✓" : "بريد غير متحقق"} · {a.documentsCount} وثيقة · {a.reviewsCount} تقييم · {a.interviewsCount} مقابلة
                  {a.phase2Done ? " · أكمل المرحلة الثانية" : ""}
                </p>
              </div>
              <span className="rounded-full border border-[#38A7B4]/40 px-3 py-1 text-[11px] font-bold text-[#6EC7D1]">
                {STATUS_LABELS[a.status] ?? a.status}
              </span>
            </button>
          ))}
        </div>
      ))}
    </AdminLayout>
  );
}
