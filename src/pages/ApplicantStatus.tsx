import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft, BadgeCheck, CalendarClock, CheckCircle2, FileText, Loader2, LogOut, Mail, MailWarning, Phone, RefreshCcw, XCircle,
} from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { readRoles, signOut } from "@/services/auth";
import { fmtDate } from "@/application/text/format-ar";
import { APPLICANT_STATUS, BOOKABLE_STATUSES, WITHDRAWABLE_STATUSES, contactChannelLabel } from "@/application/trainer/application-options";
import BookInterview from "@/components/BookInterview";

import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
/* بوّابةُ المتقدّم للتدريب — صفحةٌ واحدة تقول له أين طلبه.

   المتقدّم يدخل ببريده وكلمته التي اختارها عند التقديم، فيرى: حالةَ طلبه
   بلغته لا بلغة المراجع، وما الذي يليها، وسجلَّ ما مرّ به، ووسيلةَ التواصل
   التي اختارها. فإن رُفض قرأ الاعتذارَ هنا، وإن اعتُمد وجد بابَ بوّابة
   المدربين مفتوحا من الحساب نفسه. */

interface Mine {
  reference: string;
  status: string;
  fullName: string;
  email: string;
  phoneCountryCode: string | null;
  phone: string | null;
  contactChannel: string | null;
  contactAltEmail: string | null;
  createdAt: string;
  phase2CompletedAt: string | null;
  emailVerifiedAt: string | null;
  documents: { kind: string; originalName: string; uploadedAt: string }[];
  statusHistory: { toStatus: string; createdAt: string }[];
  profile: { userId: string | null } | null;
}

const DOC_AR: Record<string, string> = { cv: "السيرة الذاتية", evidence: "ملف أعمال", certificate: "شهادات واعتمادات", other: "وثيقة" };

const TONE_CLS: Record<string, string> = {
  neutral: "border-white/15 bg-white/[0.04] text-muted-foreground",
  progress: "border-teal/40 bg-teal/[0.08] text-teal-light-ink",
  good: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  warn: "border-gold/40 bg-gold/[0.08] text-gold-ink",
  bad: "border-red-400/30 bg-red-400/10 text-red-200",
};

export default function ApplicantStatus() {
  const navigate = useNavigate();
  const [mine, setMine] = useState<Mine | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [resent, setResent] = useState<"idle" | "busy" | "done" | "error">("idle");
  const roles = readRoles();
  const isTrainer = roles.includes("trainer");

  const load = async () => {
    setLoading(true); setError("");
    try {
      setMine(await apiGet<Mine>("/api/v1/trainer-applications/mine"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر جلب طلبك");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  /* استئنافُ مسودّة: مفتاحٌ جديد يفتح النموذج من حيث توقّف */
  const resume = async () => {
    try {
      const r = await apiPost<{ reference: string; candidateToken: string }>("/api/v1/trainer-applications/mine/resume");
      navigate(`/join-trainer?resume=${encodeURIComponent(r.reference)}&token=${encodeURIComponent(r.candidateToken)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر استئناف الطلب");
    }
  };

  const withdraw = async () => {
    if (!confirmWithdraw) { setConfirmWithdraw(true); return; }
    setWithdrawing(true);
    try {
      await apiPost("/api/v1/trainer-applications/mine/withdraw", {});
      setConfirmWithdraw(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر سحب الطلب");
    } finally {
      setWithdrawing(false);
    }
  };

  const resendConfirmation = async () => {
    if (!mine || resent === "busy") return;
    setResent("busy");
    try {
      await apiPost("/api/v1/trainer-applications/resend-verification", { email: mine.email });
      setResent("done");
    } catch {
      setResent("error");
    }
  };

  const doSignOut = async () => { await signOut(); navigate("/auth", { replace: true }); };

  const st = mine ? APPLICANT_STATUS[mine.status] ?? { label: mine.status, explain: "", tone: "neutral" as const } : null;
  const phone = mine?.phone ? `${mine.phoneCountryCode ?? ""}${mine.phone}` : null;
  const canWithdraw = mine ? (WITHDRAWABLE_STATUSES as readonly string[]).includes(mine.status) : false;

  return (
    <SiteShell>
      <SeoHead title="حالة طلب الانضمام" description="متابعة طلب الانضمام كمدرب في أكاديمية وجيز" path="/join-trainer/status" noindex />
      <div className="mx-auto max-w-2xl py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="kicker">طلب الانضمام كمدرب</span>
            <h1 className="mt-3 text-2xl font-black">حالة طلبك</h1>
          </div>
          <Button tone="secondary" type="button" onClick={doSignOut}>
            <LogOut className="h-3.5 w-3.5" /> تسجيل الخروج
          </Button>
        </div>

        {loading && (
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> نجلب طلبك…</p>
        )}
        {error && !loading && (
          <Card tone="danger" className="mt-6 text-sm text-red-200" role="alert">
            {error}
            {error.includes("لا طلب") && (
              <p className="mt-2 text-xs text-muted-foreground">
                لم نجد طلبا مرتبطا بهذا الحساب. <Link to="/join-trainer" className="text-teal-light-ink underline">قدّم طلبك من هنا</Link>.
              </p>
            )}
          </Card>
        )}

        {mine && st && (
          <div className="mt-6 space-y-4">
            {/* الحالة — بلغة صاحب الطلب */}
            <section className={`rounded-3xl border p-6 ${TONE_CLS[st.tone]}`}>
              <p className="text-[11px] font-bold opacity-70">رقم طلبك</p>
              <p className="mt-1 font-mono text-lg font-black tracking-wide" dir="ltr">{mine.reference}</p>
              <h2 className="mt-4 text-xl font-black">{st.label}</h2>
              <p className="mt-2 text-sm leading-7 opacity-90">{st.explain}</p>

              {mine.status === "draft" && (
                <Button tone="primary" type="button" onClick={resume} className="mt-4">
                  أكمل طلبك <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {(mine.status === "active" || isTrainer) && (
                <Link
                  to="/trainer"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal px-6 py-2.5 text-sm font-black text-on-teal transition hover:bg-teal/90"
                >
                  <BadgeCheck className="h-4 w-4" /> افتح بوابة المدربين
                </Link>
              )}
            </section>

            {/* الحجزُ يبقى في متناوله ما دام الطلبُ قبل القرار.

                رآه مرّةً في «وصل طلبك» ثمّ أغلق الصفحة. ولو لم يُعرض هنا لَما
                وجد إليه سبيلا بعدها — ورابطٌ يُرى مرّةً ثمّ يختفي كأنّه لم يكن.

                ولا يُعرض بعد القرار: من قُبل صار مدرّبا، ومن رُدّ لا يُدعى إلى
                مقابلة. والمسوّدةُ وانتظارُ توثيق البريد قبلَ ذلك — يُكمل طلبَه
                أوّلا فلا يحجز موعدا لطلبٍ لم يصل. */}
            {BOOKABLE_STATUSES.includes(mine.status) && (
              <BookInterview name={mine.fullName} email={mine.email} reference={mine.reference} />
            )}

            {/* البريد والتواصل */}
            <section className="grid gap-3 sm:grid-cols-2">
              <Card>
                <p className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground"><Mail className="h-3.5 w-3.5" /> بريدك</p>
                <p dir="ltr" className="mt-1 text-right text-sm text-muted-foreground">{mine.email}</p>
                {mine.emailVerifiedAt ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> موثَّق</p>
                ) : mine.status !== "draft" ? (
                  <div className="mt-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-gold-ink"><MailWarning className="h-3.5 w-3.5" /> غير موثَّق — افتح رابط التأكيد في بريدك</p>
                    <button
                      type="button" onClick={resendConfirmation} disabled={resent === "busy" || resent === "done"}
                      className="mt-1.5 cursor-pointer text-[11px] font-bold text-teal-light-ink underline decoration-dotted underline-offset-4 disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
                    >
                      {resent === "done" ? "أُعيد الإرسال — راجع بريدك" : resent === "error" ? "تعذّر — حاول بعد قليل" : "لم تصلك الرسالة؟ أعد الإرسال"}
                    </button>
                  </div>
                ) : null}
              </Card>
              <Card>
                <p className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground"><Phone className="h-3.5 w-3.5" /> سنتواصل معك عبر</p>
                {mine.contactChannel ? (
                  <>
                    <p className="mt-1 text-sm font-bold text-muted-foreground">{contactChannelLabel(mine.contactChannel)}</p>
                    <p dir="ltr" className="mt-0.5 text-right text-xs text-muted-foreground">
                      {mine.contactChannel === "other_email" ? mine.contactAltEmail
                        : mine.contactChannel === "email" ? mine.email
                        : phone ?? "—"}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">تختارها عند إكمال طلبك.</p>
                )}
              </Card>
            </section>

            {/* المسار */}
            <Card as="section">
              <h3 className="flex items-center gap-2 text-sm font-black"><CalendarClock className="h-4 w-4 text-teal-light-ink" /> ما مرّ به طلبك</h3>
              <ol className="mt-3 space-y-2">
                {mine.statusHistory.map((h, i) => (
                  <li key={`${h.toStatus}-${i}`} className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${i === mine.statusHistory.length - 1 ? "bg-teal" : "bg-white/30"}`} />
                      {APPLICANT_STATUS[h.toStatus]?.label ?? h.toStatus}
                    </span>
                    <span className="shrink-0 text-muted-foreground" dir="ltr">{fmtDate(h.createdAt)}</span>
                  </li>
                ))}
              </ol>
            </Card>

            {/* المستندات */}
            <Card as="section">
              <h3 className="flex items-center gap-2 text-sm font-black"><FileText className="h-4 w-4 text-teal-light-ink" /> مستنداتك</h3>
              {mine.documents.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">لم تُرفع مستندات بعد.</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  {mine.documents.map((d, i) => (
                    <li key={`${d.kind}-${i}`} className="flex items-center justify-between gap-3">
                      <span>{DOC_AR[d.kind] ?? d.kind} · <span className="text-muted-foreground">{d.originalName}</span></span>
                      <span className="shrink-0 text-muted-foreground" dir="ltr">{fmtDate(d.uploadedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* السحب */}
            {canWithdraw && (
              <Card as="section">
                <p className="text-xs font-bold text-muted-foreground">غيّرت رأيك؟ يمكنك سحب طلبك نهائيا — والتقديم من جديد متى شئت.</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button tone="danger" type="button" onClick={withdraw} disabled={withdrawing}>
                    {withdrawing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                    {confirmWithdraw ? "نعم — اسحب طلبي نهائيا" : "اسحب طلبي"}
                  </Button>
                  {confirmWithdraw && (
                    <button type="button" onClick={() => setConfirmWithdraw(false)} className="cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground">
                      تراجع
                    </button>
                  )}
                </div>
              </Card>
            )}

            <button type="button" onClick={() => void load()} className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-muted-foreground">
              <RefreshCcw className="h-3 w-3" /> تحديث
            </button>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
