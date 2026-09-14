/* الإسنادُ يبدأ من المدرّب لا من بحثٍ عن دورة (ج-١).

   ═══ الشكوى ═══

   «أجد صعوبةً بالبحث عن الدورات» — والإسنادُ اليومَ يبدأ من الشعبة: تُفتح
   شعبةٌ ثمّ يُختار لها مدرّب. فمن في ذهنه **مدرّبٌ** يريد أن يشغله لزمه أن
   يخمّن في أيّ شعبةٍ يصلح، ويفتحها واحدةً واحدةً ليرى.

   ═══ والبابُ الثاني لا بديلٌ عن الأوّل ═══

   إسنادُ الشعبة يبقى في صفحتها: من يخطّط فصلا يبدأ من شعبةٍ لا من إنسان.
   وهذه للسؤال المعكوس — «هذا المدرّبُ متاح، فماذا أعطيه؟».

   ═══ ثلاثةٌ استُعيرت من أنماطٍ قائمة ═══

   ① **7shifts** تقول بصوتٍ عالٍ لماذا القائمةُ قصيرة: «لا يظهر إلّا من
      أُسنِد إلى هذا القسم». فالقصرُ يصير جوابا لا لغزا — وهو ما يمنع السؤالَ
      «أين بقيّةُ الشعب؟».
   ② **Deel** ترقّم الخطوتين: اختر الإنسانَ، ثمّ اختر له. فلا تُعرض الثانيةُ
      قبل الأولى.
   ③ **Toggl** تبحث في قائمة الأشخاص ولا تسردهم في قائمةٍ منسدلة — وقائمةٌ
      منسدلةٌ بكلّ المدرّبين تُعيد الشكوى نفسَها بشكلٍ آخر.

   ═══ ولا مسارَ جديدٌ في الخادم ═══

   الحمولةُ كلُّها قائمة: `/api/admin/trainers/ops` تحمل المدرّبين بمؤهّلاتهم
   وإسناداتهم، و`/api/admin/cohorts` تحمل الشعبَ بدوراتها ومدرّبيها. فهذه
   شاشةٌ تصل بينهما — ولا يُبنى مسارٌ لعرضٍ يقدر عليه ما هو قائم. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BadgeCheck, GraduationCap, Loader2, UserPlus, Users } from "lucide-react";
import AdminLayout from "./AdminLayout";
import ListToolbar from "@/components/admin/ListToolbar";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { fmtDate } from "@/application/text/format-ar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { controlCls } from "@/components/FormKit";

interface Qualification {
  courseId: string;
  courseTitle: string;
  status: string;
}

interface TrainerRow {
  profileId: string;
  name: string;
  email: string;
  applicationStatus: string;
  hasAccount: boolean;
  suspended: boolean;
  qualifications: Qualification[];
  assignments: { courseId: string; cohortId: string | null }[];
}

interface CohortRow {
  id: string;
  title: string;
  status: string;
  courseId: string;
  courseTitle: string;
  startsAt: string | null;
  capacity: number | null;
  enrolled: number;
  trainers: { profileId: string; name: string; role: string }[];
}

/** حالةُ التأهيل بلغة من يقرأ — لا بحالة قاعدة البيانات */
const QUAL_AR: Record<string, string> = {
  qualified: "مؤهَّل",
  pending: "طلبُ تأهيلٍ ينتظر قرارَك",
  rejected: "رُفض تأهيلُه",
  retired: "سُحب تأهيلُه",
};

/* الشعبةُ المنتهيةُ لا يُسنَد إليها أحد — ولا تُعرض فتُشغل النظر */
const OPEN_COHORT = ["draft", "open", "full", "active"];

export default function AssignByTrainer() {
  const [trainers, setTrainers] = useState<TrainerRow[] | null>(null);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pickedId, setPickedId] = useState<string | null>(null);
  /* التأهيلُ في مكانه (قرارُك ١٤ سبتمبر): من لا مؤهّلَ له يُؤهَّل من هنا،
     فالغرضُ كلُّه ألّا يغادر من يُسنِد ليبحث. */
  const [qualifyFor, setQualifyFor] = useState("");

  const load = useCallback(async () => {
    try {
      const [t, c] = await Promise.all([
        apiGet<TrainerRow[]>("/api/admin/trainers/ops"),
        apiGet<CohortRow[]>("/api/admin/cohorts"),
      ]);
      setTrainers(t);
      setCohorts(c);
      setErr("");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر تحميل المدرّبين والشعب");
      setTrainers([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(doneMsg); await load(); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ الإجراء"); }
    finally { setBusy(false); }
  };

  /* من يُسنَد إليه: نشطٌ غيرُ موقوفٍ وله حساب. والمستبعَدُ لا يُخفى صامتا —
     يُقال في الحالة الفارغة لماذا قصُرت القائمة. */
  const assignable = useMemo(
    () => (trainers ?? []).filter((t) => t.applicationStatus === "active" && !t.suspended && t.hasAccount),
    [trainers],
  );
  const shown = useMemo(
    () => assignable.filter((t) => matchesQuery(q, [t.name, t.email, ...t.qualifications.map((x) => x.courseTitle)])),
    [assignable, q],
  );
  const view = paginate(shown, page, 8);

  const picked = pickedId ? assignable.find((t) => t.profileId === pickedId) ?? null : null;
  /* مصفوفةٌ جديدةٌ في كلّ تصييرٍ تُبطل `useMemo` الذي يعتمد عليها — فتُحفظ */
  const qualified = useMemo(
    () => picked?.qualifications.filter((x) => x.status === "qualified") ?? [],
    [picked],
  );

  /* شعبُ دوراته وحدَها — وهو كلُّ معنى هذه الشاشة */
  const his = useMemo(() => {
    if (!picked) return [];
    const codes = new Set(qualified.map((x) => x.courseId));
    return cohorts
      .filter((c) => codes.has(c.courseId) && OPEN_COHORT.includes(c.status))
      .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
  }, [picked, qualified, cohorts]);

  /* ما يصلح للتأهيل في مكانه: دوراتٌ لها شعبٌ مفتوحةٌ ولم يُؤهَّل لها بعد.
     ولا تُعرض دورةٌ لا شعبةَ لها — تأهيلٌ لا يُسنَد بعده شيءٌ عملٌ بلا أثر. */
  const qualifiable = useMemo(() => {
    if (!picked) return [];
    const known = new Set(picked.qualifications.map((x) => x.courseId));
    const seen = new Map<string, string>();
    for (const c of cohorts) {
      if (!OPEN_COHORT.includes(c.status) || known.has(c.courseId)) continue;
      if (!seen.has(c.courseId)) seen.set(c.courseId, c.courseTitle || c.courseId);
    }
    return [...seen].map(([courseId, title]) => ({ courseId, title }));
  }, [picked, cohorts]);

  if (err) return <AdminLayout title="إسنادٌ يبدأ من المدرّب"><Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card></AdminLayout>;
  if (!trainers) {
    return (
      <AdminLayout title="إسنادٌ يبدأ من المدرّب">
        <div className="grid place-items-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="إسنادٌ يبدأ من المدرّب">
      <Panel as="section">
        <h2 className="flex items-center gap-2 text-sm font-black text-foreground">
          <Users className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> ① اختر المدرّب
        </h2>
        <p className="mt-1 text-read leading-6 text-muted-foreground">
          ابدأ من الإنسان لا من الدورة: اختر مدرّبا فتظهر لك الشعبُ التي يصلح لها وحدَها.
          وإسنادُ شعبةٍ بعينها بابُه في <Link to="/admin/cohorts" className="font-bold text-teal-light-ink underline decoration-dotted underline-offset-4">الشعب</Link>.
        </p>

        <div className="mt-4">
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="مدرّبا"
            placeholder="ابحث باسمٍ أو بريدٍ أو دورةٍ يؤهَّل لها…" />
          {view.total === 0 ? (
            <Inset as="p" className="py-10 text-center text-read leading-6 text-muted-foreground">
              {q.trim()
                ? `لا مدرّبَ يطابق «${q.trim()}».`
                : "لا مدرّبَ نشطا بحسابٍ مربوط — والموقوفُ ومن بلا حسابٍ لا يُسنَد إليهما."}
            </Inset>
          ) : (
            <ul className="space-y-2">
              {view.rows.map((t) => {
                const isPicked = t.profileId === pickedId;
                const count = t.qualifications.filter((x) => x.status === "qualified").length;
                return (
                  <Card as="li" key={t.profileId} className={isPicked ? "ring-1 ring-teal/50" : undefined}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-read font-black text-foreground">{t.name}</p>
                        <p className="mt-0.5 text-read text-muted-foreground" dir="ltr">{t.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-read text-muted-foreground">
                          {count === 0 ? "بلا تأهيل" : `مؤهَّلٌ لـ${count}`}
                        </span>
                        <Button tone={isPicked ? "confirm" : "secondary"} size="sm"
                          onClick={() => { setPickedId(isPicked ? null : t.profileId); setQualifyFor(""); }}>
                          {isPicked ? "المختار" : "اختره"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </ul>
          )}
        </div>
      </Panel>

      {/* ② لا تُعرض قبل الأولى — خطوتان مرقّمتان لا لوحتان متجاورتان */}
      {picked && (
        <Panel as="section" className="mt-5">
          <h2 className="flex items-center gap-2 text-sm font-black text-foreground">
            <GraduationCap className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> ② ما يصلح له «{picked.name}»
          </h2>

          {/* ═══ يُقال لماذا القائمةُ قصيرة ═══ */}
          <Inset className="mt-3 text-read leading-6 text-muted-foreground">
            تظهر هنا الشعبُ المفتوحةُ على الدورات التي أُهِّل لها هذا المدرّبُ وحدَها
            {qualified.length > 0 && (
              <> — وهي <b className="text-foreground">{qualified.map((x) => x.courseTitle).join(" · ")}</b></>
            )}
            . ولتأهيله لغيرها بابٌ أسفله.
          </Inset>

          {/* حالاتُ تأهيلٍ ليست «مؤهَّلا» تُقال ولا تُخفى */}
          {picked.qualifications.some((x) => x.status !== "qualified") && (
            <ul className="mt-3 space-y-1">
              {picked.qualifications.filter((x) => x.status !== "qualified").map((x) => (
                <li key={x.courseId} className="text-read text-muted-foreground">
                  {x.courseTitle} — {QUAL_AR[x.status] ?? x.status}
                </li>
              ))}
            </ul>
          )}

          {qualified.length === 0 ? (
            <Inset tone="warn" as="p" className="mt-3 text-read leading-6 text-gold-ink">
              لا تأهيلَ قائما لهذا المدرّب — فلا شعبةَ تُسنَد إليه بعد. أهّله أدناه وتظهر شعبُها فورا.
            </Inset>
          ) : his.length === 0 ? (
            <Inset as="p" className="mt-3 text-read leading-6 text-muted-foreground">
              لا شعبةَ مفتوحةً على دوراته الآن — أهّله لدورةٍ لها شعبة، أو افتح شعبةً على إحدى دوراته من «الشعب».
            </Inset>
          ) : (
            <ul className="mt-4 space-y-2">
              {his.map((c) => {
                const already = c.trainers.some((x) => x.profileId === picked.profileId);
                const other = c.trainers.filter((x) => x.profileId !== picked.profileId);
                return (
                  <Card as="li" key={c.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-read font-black text-foreground">{c.title}</p>
                        <p className="mt-0.5 text-read text-muted-foreground">
                          {c.courseTitle}
                          {c.startsAt && <> · تبدأ {fmtDate(c.startsAt)}</>}
                          {" · "}{c.enrolled}{c.capacity ? ` من ${c.capacity}` : ""} التحقوا
                          {other.length > 0 && <> · عليها {other.map((x) => x.name).join(" و")}</>}
                        </p>
                      </div>
                      {already ? (
                        <span className="flex items-center gap-1.5 text-read font-bold text-teal-light-ink">
                          <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> مُسنَدٌ إليها
                        </span>
                      ) : (
                        <Button tone="confirm" size="sm" disabled={busy}
                          onClick={() => act(
                            () => apiPost(`/api/admin/trainers/${picked.profileId}/assignments`, { courseId: c.courseId, cohortId: c.id }),
                            `أُسنِد ${picked.name} إلى «${c.title}»`,
                          )}>
                          أسنده إليها
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </ul>
          )}

          {/* ═══ التأهيلُ في مكانه — لا مغادرةَ للبحث (قرارُك ١٤ سبتمبر) ═══ */}
          <div className="mt-5 border-t border-white/8 pt-4">
            <p className="flex items-center gap-2 text-read font-black text-foreground">
              <UserPlus className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> أهّله لدورةٍ أخرى
            </p>
            <p className="mt-1 text-read leading-6 text-muted-foreground">
              تُعرض الدوراتُ التي لها شعبٌ مفتوحةٌ ولم يُؤهَّل لها — فالتأهيلُ هنا يُتبَع بإسنادٍ لا يُترك معلّقا.
            </p>
            {qualifiable.length === 0 ? (
              <p className="mt-2 text-read text-muted-foreground">لا دورةَ أخرى لها شعبةٌ مفتوحةٌ يصلح أن يُؤهَّل لها الآن.</p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <select aria-label="الدورة التي يُؤهَّل لها" value={qualifyFor}
                  onChange={(e) => setQualifyFor(e.target.value)}
                  className={`${controlCls} [&>option]:bg-surface`}>
                  <option value="">اختر دورة…</option>
                  {qualifiable.map((c) => <option key={c.courseId} value={c.courseId}>{c.title}</option>)}
                </select>
                <Button tone="secondary" size="sm" disabled={busy || !qualifyFor}
                  onClick={() => act(
                    () => apiPost(`/api/admin/trainers/${picked.profileId}/qualifications`, { courseId: qualifyFor }),
                    "أُهِّل — وشعبُ الدورة تظهر أعلاه الآن",
                  ).then(() => setQualifyFor(""))}>
                  أهّله
                </Button>
              </div>
            )}
          </div>
        </Panel>
      )}
    </AdminLayout>
  );
}
