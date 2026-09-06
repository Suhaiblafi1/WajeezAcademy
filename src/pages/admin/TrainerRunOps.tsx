/* سلسلةُ تشغيل المدرّب — خمسةُ مساراتٍ كان الخادمُ يعرفها ولا شاشةَ تصل إليها.

   المسارات: البتُّ في طلبات التأهيل · التأهيلُ المباشر · الإسنادُ لشعبة ·
   اعتمادُ الظهور العامّ · الإيقاف. وكلُّها مكتوبةٌ ومُختبَرةٌ في الخادم منذ
   شهور، **ولا زرَّ واحدا يطلبها**. فالنتيجةُ أنّ مدرّبا لا يمكن أن يصير
   مؤهَّلا أبدا، وصفحةَ المدرّبين العامّةَ لا يمكن أن تعرض أحدا، ولا يُسنَد
   أحدٌ إلى شعبة — لا لعطبٍ في المنطق بل لغياب مدخل.

   ── وترتيبُ الشاشة ترتيبُ السلسلة لا ترتيبُ الأهمّيّة ──

   الطابورُ أوّلا لأنّه ما ينتظر قرارا **من غيرك**؛ ثمّ المدرّبون، وفي بطاقة
   كلٍّ منهم **ما يمنع خطوتَه التالية** لا قائمةُ أزرارٍ متساوية: بلا حسابٍ لا
   يُسنَد، وبلا تأهيلٍ لا يُسنَد لشعبة، وبلا اعتمادِ نشرٍ لا يظهر للعامّة.

   ── وقائمةُ الشعب تُرشَّح بتأهيله هو ──

   الخادمُ يرفض إسنادا بلا تأهيل (`not_qualified`). وعرضُ كلّ الشعب ثمّ ردُّ
   الطلب رسالةُ خطأٍ بعد نقرة؛ فتُعرض شعبُ الدورات التي هو مؤهَّلٌ لها وحدَها،
   ويُقال له لماذا اختفى الباقي. */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck, CheckCircle2, Clock, GraduationCap, Loader2, Search,
  ServerOff, ShieldAlert, UserCheck, Users, XCircle,
} from "lucide-react";
import { toast, toastError } from "@/components/Toast";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { controlCls } from "@/components/FormKit";
import { matchesQuery } from "@/application/text/search-ar";
import { fmtDateTime } from "@/application/text/format-ar";
import ConfirmAction from "@/components/ConfirmAction";

import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
interface OpsQualification { courseId: string; courseTitle: string; status: string }
interface OpsAssignment {
  courseId: string; courseTitle: string
  cohortId: string | null; cohortTitle: string | null; cohortStatus: string | null
}
interface OpsTrainer {
  profileId: string;
  applicationId: string;
  name: string;
  email: string;
  applicationStatus: string;
  hasAccount: boolean;
  suspended: boolean;
  publiclyVisible: boolean;
  isVerified: boolean;
  qualifications: OpsQualification[];
  assignments: OpsAssignment[];
}

interface PendingRequest {
  id: string;
  courseId: string;
  note: string | null;
  requestedAt: string | null;
  profile: { id: string; application: { fullName: string; status: string } };
  course: { id: string; versions: { titleAr: string }[] };
  requestedCohort: { id: string; title: string; startsAt: string | null; status: string } | null;
}

interface CourseOpt { id: string; titleAr?: string; title?: string }
interface CohortOpt { id: string; title: string; courseId: string; status: string }

const QUAL_LABEL: Record<string, string> = {
  qualified: "مؤهَّل", pending: "طلبٌ معلَّق", rejected: "مرفوض", retired: "متقاعد",
};

export default function TrainerRunOps() {
  const [trainers, setTrainers] = useState<OpsTrainer[] | null>(null);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [cohorts, setCohorts] = useState<CohortOpt[]>([]);
  const [offline, setOffline] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<Record<string, { courseId: string; cohortId: string }>>({});
  const [suspendTarget, setSuspendTarget] = useState<OpsTrainer | null>(null);

  const load = useCallback(async () => {
    try {
      const [ops, reqs, cs, chs] = await Promise.all([
        apiGet<OpsTrainer[]>("/api/admin/trainers/ops"),
        apiGet<PendingRequest[]>("/api/admin/qualification-requests"),
        apiGet<CourseOpt[]>("/api/admin/catalog/courses").catch(() => [] as CourseOpt[]),
        apiGet<CohortOpt[]>("/api/admin/cohorts").catch(() => [] as CohortOpt[]),
      ]);
      setTrainers(ops);
      setRequests(reqs);
      setCourses(cs);
      setCohorts(chs);
      setOffline(null);
    } catch (e) {
      setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast(ok);
      await load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ الإجراء");
    } finally {
      setBusy("");
    }
  };

  const courseName = useCallback(
    (id: string) => courses.find((c) => c.id === id)?.titleAr ?? courses.find((c) => c.id === id)?.title ?? id,
    [courses],
  );

  const shown = useMemo(
    () => (trainers ?? []).filter((t) => matchesQuery(q, [t.name, t.email])),
    [trainers, q],
  );

  if (offline) {
    return (
      <Panel className="grid place-items-center py-20 text-center">
        <ServerOff className="h-12 w-12 text-muted-foreground/50" />
        <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
        <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
      </Panel>
    );
  }

  if (trainers === null) {
    return <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* ── الطابور: ما ينتظر قرارك من غيرك ── */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-black">
          <Clock className="h-4 w-4 text-gold-ink" />
          طلباتُ التأهيل المعلّقة
          {requests.length > 0 && (
            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-micro font-black text-gold-ink">{requests.length}</span>
          )}
        </h3>
        <p className="mt-1 text-[11.5px] leading-6 text-muted-foreground">
          يُقدَّمها من يجدول الشعبة، ويبتّ فيها من يملك التأهيل — <b>فمن يطلب ليس من يقرّر</b>.
          والموافقةُ <b>تؤهّل وتُسند إلى الشعبة المطلوبة في فعلٍ واحد</b>.
        </p>

        {requests.length === 0 ? (
          <Card className="mt-3 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-teal-light-ink/50" />
            <p className="mt-2 text-xs text-muted-foreground">لا طلبَ ينتظر قرارك.</p>
          </Card>
        ) : (
          <ul className="mt-3 space-y-3">
            {requests.map((r) => (
              <Card as="li" tone="warn" key={r.id}>
                <p className="text-sm font-black">{r.profile.application.fullName}</p>
                <p className="mt-1 text-[11.5px] leading-6 text-muted-foreground">
                  للدورة: <b className="text-foreground">{r.course.versions[0]?.titleAr ?? courseName(r.courseId)}</b>
                  {r.requestedCohort && (
                    <> · للشعبة: <b className="text-foreground">{r.requestedCohort.title}</b>
                      {r.requestedCohort.startsAt && <> — تبدأ {fmtDateTime(new Date(r.requestedCohort.startsAt))}</>}
                    </>
                  )}
                  {r.requestedAt && <> · طُلب {fmtDateTime(new Date(r.requestedAt))}</>}
                </p>
                {r.note && <p className="mt-2 rounded-xl bg-paper/30 p-2.5 text-[11.5px] leading-6">{r.note}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={note[r.id] ?? ""}
                    onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder="ملاحظة تُسجَّل مع القرار (اختيارية)"
                    aria-label="ملاحظة القرار"
                    className={`${controlCls} min-w-[16rem] flex-1`}
                  />
                  <Button tone="primary" type="button" disabled={busy === r.id}
                    onClick={() => void act(r.id,
                      () => apiPost(`/api/admin/qualification-requests/${r.id}/decide`, { approve: true, note: note[r.id]?.trim() || undefined }),
                      "أُهِّل وأُسنِد إلى الشعبة")}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> أهِّله وأسنِده
                  </Button>
                  <Button tone="danger" type="button" disabled={busy === r.id}
                    onClick={() => void act(r.id,
                      () => apiPost(`/api/admin/qualification-requests/${r.id}/decide`, { approve: false, note: note[r.id]?.trim() || undefined }),
                      "رُفض الطلب")}>
                    <XCircle className="h-3.5 w-3.5" /> ارفض
                  </Button>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </section>

      {/* ── المدرّبون ── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-black">
            <Users className="h-4 w-4 text-teal-light-ink" /> المدرّبون ({shown.length})
          </h3>
          <label className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسمٍ أو بريد"
              aria-label="ابحث في المدرّبين"
              className={`${controlCls} w-64 pr-9`}
            />
          </label>
        </div>

        {shown.length === 0 ? (
          <Card className="mt-3 p-8 text-center">
            <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-black">لا مدرّبَ بعد</p>
            <p className="mt-1 text-[11.5px] leading-6 text-muted-foreground">
              يظهر هنا كلُّ من أُنشئ له ملفُّ مدرّب — أي من اعتُمد من تبويب «الطلبات».
            </p>
          </Card>
        ) : (
          <ul className="mt-3 space-y-3">
            {shown.map((t) => {
              const sel = pick[t.profileId] ?? { courseId: "", cohortId: "" };
              const qualified = t.qualifications.filter((x) => x.status === "qualified");
              const qualifiedIds = new Set(qualified.map((x) => x.courseId));
              /* الشعبُ المعروضةُ شعبُ دوراتٍ هو مؤهَّلٌ لها — الخادمُ يرفض ما عداها */
              const eligibleCohorts = cohorts.filter((c) => qualifiedIds.has(c.courseId));
              const k = (a: string) => `${t.profileId}:${a}`;
              return (
                <Card as="li" key={t.profileId}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 text-sm font-black">
                        {t.name}
                        {t.suspended && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-micro font-black text-red-300">موقوف</span>}
                        {t.publiclyVisible && (
                          <span className="flex items-center gap-1 rounded-full bg-teal/15 px-2 py-0.5 text-micro font-black text-teal-light-ink">
                            <BadgeCheck className="h-3 w-3" /> ظاهرٌ للعامّة
                          </span>
                        )}
                      </p>
                      <p dir="ltr" className="mt-0.5 text-right text-micro text-muted-foreground">{t.email}</p>
                    </div>
                  </div>

                  {/* ما يمنع الخطوةَ التالية — يُقال قبل الضغط لا بعده */}
                  {!t.hasAccount && (
                    <Inset as="p" tone="warn" className="mt-2.5 flex items-start gap-1.5 p-2.5 text-micro leading-6 text-gold-ink">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      لا حسابَ مربوطٌ بهذا الملفّ — فلا تُفتح له بوّابتُه ولو أُسنِد. اعتمِدْه من تبويب «الطلبات».
                    </Inset>
                  )}

                  <div className="mt-2.5 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-micro font-black text-muted-foreground">مؤهَّلٌ لـ</p>
                      {t.qualifications.length === 0 ? (
                        <p className="mt-1 text-micro text-muted-foreground">لا تأهيلَ بعد — وبلا تأهيلٍ لا يُسنَد إلى شعبة.</p>
                      ) : (
                        <ul className="mt-1 space-y-0.5 text-micro leading-6">
                          {t.qualifications.map((x) => (
                            <li key={x.courseId}>
                              {x.courseTitle}
                              <span className={x.status === "qualified" ? "text-teal-light-ink" : "text-muted-foreground"}> · {QUAL_LABEL[x.status] ?? x.status}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="text-micro font-black text-muted-foreground">مُسنَدٌ إلى</p>
                      {t.assignments.length === 0 ? (
                        <p className="mt-1 text-micro text-muted-foreground">لا إسنادَ نشط.</p>
                      ) : (
                        <ul className="mt-1 space-y-0.5 text-micro leading-6">
                          {t.assignments.map((a, i) => (
                            <li key={`${a.courseId}-${a.cohortId ?? i}`}>
                              {a.courseTitle}{a.cohortTitle ? ` — ${a.cohortTitle}` : " — بلا شعبة"}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* الإجراءات */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                    <select
                      value={sel.courseId} aria-label="الدورة"
                      onChange={(e) => setPick((p) => ({ ...p, [t.profileId]: { courseId: e.target.value, cohortId: "" } }))}
                      className={`${controlCls} w-56 [&>option]:bg-surface`}
                    >
                      <option value="">اختر دورة…</option>
                      {courses.map((c) => <option key={c.id} value={c.id}>{c.titleAr ?? c.title ?? c.id}</option>)}
                    </select>
                    <Button tone="primary" type="button" disabled={!sel.courseId || busy === k("qual")}
                      onClick={() => void act(k("qual"),
                        () => apiPost(`/api/admin/trainers/${t.profileId}/qualifications`, { courseId: sel.courseId }),
                        "أُهِّل للدورة")} className="px-3.5 text-gold-ink">
                      <GraduationCap className="h-3.5 w-3.5" /> أهِّله مباشرة
                    </Button>

                    <select
                      value={sel.cohortId} aria-label="الشعبة"
                      onChange={(e) => setPick((p) => ({ ...p, [t.profileId]: { ...sel, cohortId: e.target.value } }))}
                      className={`${controlCls} w-56 [&>option]:bg-surface`}
                    >
                      <option value="">
                        {eligibleCohorts.length === 0 ? "لا شعبةَ في دوراته المؤهَّلة" : "أسنِده إلى شعبة…"}
                      </option>
                      {eligibleCohorts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                    <Button tone="confirm" type="button" disabled={!sel.cohortId || busy === k("assign")}
                      onClick={() => {
                        const cohort = cohorts.find((c) => c.id === sel.cohortId);
                        if (!cohort) return;
                        void act(k("assign"),
                          () => apiPost(`/api/admin/trainers/${t.profileId}/assignments`, { courseId: cohort.courseId, cohortId: cohort.id }),
                          "أُسنِد إلى الشعبة");
                      }} className="px-3.5 text-teal-light-ink">
                      <UserCheck className="h-3.5 w-3.5" /> أسنِده
                    </Button>

                    {!t.publiclyVisible && (
                      <Button tone="secondary" type="button" disabled={busy === k("publish")}
                        onClick={() => void act(k("publish"),
                          () => apiPost(`/api/admin/trainers/${t.profileId}/publish-approval`),
                          "اعتُمد ظهورُه العامّ")} className="px-3.5">
                        <BadgeCheck className="h-3.5 w-3.5" /> اعتمِد ظهورَه العامّ
                      </Button>
                    )}

                    {!t.suspended && (
                      <Button tone="danger" type="button" disabled={busy === k("suspend")}
                        onClick={() => setSuspendTarget(t)} className="px-3.5">
                        <XCircle className="h-3.5 w-3.5" /> أوقِفه
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </ul>
        )}
      </section>

      {/* الإيقافُ فعلٌ يمسّ حسابا وجلساتٍ مجدولة — فسببُه يُكتب ولا يُفترض */}
      {suspendTarget && (
        <ConfirmAction
          titleAr={`إيقافُ ${suspendTarget.name}`}
          confirmLabelAr="أوقِفه"
          tone="danger"
          busy={busy === `${suspendTarget.profileId}:suspend`}
          reason={{ labelAr: "السببُ — يبقى في سجلّ الأثر", minLength: 5 }}
          onCancel={() => setSuspendTarget(null)}
          onConfirm={(reason) => {
            const target = suspendTarget;
            setSuspendTarget(null);
            void act(`${target.profileId}:suspend`,
              () => apiPost(`/api/admin/trainers/${target.profileId}/suspend`, { note: reason?.trim() || undefined }),
              "أُوقِف المدرّب");
          }}
        >
          يُخفى فورا من الصفحات العامّة، وتُلغى جلساتُه القادمة، ويُوقَف حسابُه.
          ويُرفع الإيقافُ من تبويب «الطلبات» بزرّ «ارفع الإيقاف».
        </ConfirmAction>
      )}
    </div>
  );
}
