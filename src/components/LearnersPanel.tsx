/* الطلبةُ المسجَّلون — لوحٌ واحد لثلاث بوابات.

   قرارُ صاحب المنصّة: «أضف لبوابات السوبر، والمدير الأكاديميّ، والمدرّب
   (طلابه فقط)، والمستشار (حالاته فقط) وصولا لقائمة الطلبة المسجَّلين مع
   صلاحية حذف/إضافة طالب أو تعديل حسابه — كلُّ دورٍ يرى نطاقَه فقط».

   ولوحٌ واحد لا ثلاثة: النطاقُ يُشتقّ في الخادم من صلاحيّات صاحب الجلسة
   (`scopeFor`)، فالشاشةُ تسأل السؤالَ نفسَه وتعرض ما يعود. وثلاثةُ ألواحٍ
   لسؤالٍ واحد تفترق: يُصلَح عطبٌ في أحدها ويبقى في اثنين.

   والشاشةُ لا تحرس شيئا — تقرأ `canWrite` من الجواب فتُظهر أو تُخفي. والحراسةُ
   في الخادم: المدرّبُ يُردّ ٤٠٣ لو نادى مسلكَ التعديل بيده. */

import { useCallback, useEffect, useState } from "react";
import { GraduationCap, Loader2, Pencil, Search, ShieldOff, Trash2, UserPlus, X } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/services/api";
import { fmtDate } from "@/application/text/format-ar";
import { toast, toastError } from './Toast';

interface LearnerEnrollment {
  id: string;
  cohortId: string;
  cohortTitle: string;
  courseTitle: string;
  status: string;
  percent: number;
  startsAt: string | null;
}

interface LearnerRow {
  user: { id: string; email: string; displayName: string; status: string; createdAt: string };
  enrollments: LearnerEnrollment[];
}

interface LearnersResponse {
  scope: "all" | "trainer" | "advisor";
  canWrite: boolean;
  learners: LearnerRow[];
}

const SCOPE_NOTE: Record<LearnersResponse["scope"], string> = {
  all: "كلّ الطلبة المسجَّلين في الأكاديمية.",
  trainer: "طلبةُ شعبك أنت — لا طلبةَ غيرك.",
  advisor: "عملاءُ الحالات المسندة إليك وحدَهم.",
};

const ENROLL_STATUS: Record<string, string> = {
  enrolled: "مسجَّل", waitlisted: "قائمة انتظار", completed: "مكتمل", dropped: "منسحب",
};

export default function LearnersPanel() {
  const [data, setData] = useState<LearnersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<LearnerRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (search = "") => {
    setLoading(true);
    setError(null);
    try {
      const path = search.trim() ? `/api/staff/learners?q=${encodeURIComponent(search.trim())}` : "/api/staff/learners";
      setData(await apiGet<LearnersResponse>(path));
    } catch (e) {
      setData(null);
      setError(e instanceof ApiError ? e.message : "تعذّر قراءة قائمة الطلبة");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(msg); await load(q); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذّر الإجراء"); }
    finally { setBusy(false); }
  };

  if (loading && !data) {
    return <div className="grid place-items-center py-16"><Loader2 className="h-7 w-7 animate-spin text-teal-ink" /></div>;
  }
  if (error) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-white/60">{error}</p>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11.5px] text-white/45">{SCOPE_NOTE[data.scope]}</p>
        <form
          onSubmit={(e) => { e.preventDefault(); void load(q); }}
          className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-white/35" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو البريد…"
            aria-label="بحث في الطلبة"
            className="w-48 bg-transparent text-xs text-white outline-none placeholder:text-white/30"
          />
        </form>
      </div>

      {data.learners.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-14 text-center">
          <GraduationCap className="h-10 w-10 text-white/20" />
          <p className="mt-3 text-sm font-black">لا طلبة في نطاقك بعد</p>
          <p className="mt-1 max-w-sm text-xs leading-6 text-white/50">
            {data.scope === "trainer"
              ? "حين تُسنَد إليك شعبةٌ ويُسجَّل فيها متعلّمون، يظهرون هنا."
              : data.scope === "advisor"
                ? "حين تُسنَد إليك حالةٌ لعميلٍ سجّل في شعبة، يظهر هنا."
                : "لا تسجيلات بعد."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {data.learners.map((l) => (
            <li key={l.user.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-black">
                    {l.user.displayName}
                    {l.user.status !== "active" && (
                      <span className="rounded-full border border-red-400/40 px-2 py-0.5 text-[10px] font-bold text-red-300">موقوف</span>
                    )}
                  </p>
                  <p dir="ltr" className="mt-0.5 text-left text-[11px] text-white/45">{l.user.email}</p>
                </div>
                {data.canWrite && (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => setEditing(l)}
                      className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-white/70 transition hover:border-teal/50 hover:text-teal-light-ink"
                    >
                      <Pencil className="h-3 w-3" /> عدّل الحساب
                    </button>
                  </div>
                )}
              </div>

              <ul className="mt-3 space-y-1.5">
                {l.enrollments.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-[12px] font-bold text-white/80">{e.courseTitle}</span>
                      <span className="text-[10.5px] text-white/45">
                        {e.cohortTitle} · {ENROLL_STATUS[e.status] ?? e.status} · {e.percent}٪
                        {e.startsAt ? ` · ${fmtDate(new Date(e.startsAt))}` : ""}
                      </span>
                    </span>
                    {data.canWrite && (
                      <button
                        onClick={() => void act(
                          () => apiDelete(`/api/staff/learners/enrollments/${e.id}`, { note: "إخراجٌ من شاشة الطلبة" }),
                          `أُخرج «${l.user.displayName}» من «${e.cohortTitle}» — والسجلّ باقٍ`,
                        )}
                        disabled={busy}
                        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-red-400/30 px-2.5 py-1 text-[10.5px] font-bold text-red-300 transition hover:bg-red-400/10 disabled:opacity-40"
                      >
                        <Trash2 className="h-3 w-3" /> أخرجه
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {editing && data.canWrite && (
        <EditLearner
          row={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={(patch) => void act(
            () => apiPatch(`/api/staff/learners/${editing.user.id}`, patch).then(() => setEditing(null)),
            "حُفظ التعديل — والأثرُ مسجَّل",
          )}
          onEnroll={(cohortId) => void act(
            () => apiPost(`/api/staff/learners/${editing.user.id}/enrollments`, { cohortId }).then(() => setEditing(null)),
            "سُجّل في الشعبة",
          )}
        />
      )}
    </div>
  );
}

/** تعديلُ حساب طالب وتسجيلُه في شعبة — لوحٌ واحد لأنّهما فعلا الشاشة نفسِها */
function EditLearner({ row, busy, onClose, onSave, onEnroll }: {
  row: LearnerRow;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: { displayName?: string; email?: string; status?: "active" | "suspended" }) => void;
  onEnroll: (cohortId: string) => void;
}) {
  const [displayName, setDisplayName] = useState(row.user.displayName);
  const [email, setEmail] = useState(row.user.email);
  const [cohorts, setCohorts] = useState<{ id: string; title: string; courseTitle: string }[]>([]);
  const [cohortId, setCohortId] = useState("");

  useEffect(() => {
    apiGet<{ id: string; title: string; courseTitle: string }[]>("/api/public/cohorts")
      .then((rows) => setCohorts(rows.filter((c) => !row.enrollments.some((e) => e.cohortId === c.id))))
      .catch(() => setCohorts([]));
  }, [row.enrollments]);

  const field = "w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-teal/50";
  const suspended = row.user.status !== "active";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-label={`تعديل حساب ${row.user.displayName}`}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-black">تعديل حساب «{row.user.displayName}»</h3>
          <button onClick={onClose} aria-label="إغلاق" className="cursor-pointer text-white/40 hover:text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-4 block text-[11px] font-bold text-white/50">
          الاسم
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="mt-3 block text-[11px] font-bold text-white/50">
          البريد
          <input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className={`${field} mt-1 text-left`} />
          {/* يُقال قبل الحفظ لا بعده: تبديلُ البريد يُسقط توثيقَه، والشراءُ
              والشهادةُ موقوفان على التوثيق. */}
          {email !== row.user.email && (
            <span className="mt-1 block text-[10.5px] font-normal leading-5 text-gold-ink">
              تبديلُ البريد يُسقط توثيقَه — سيحتاج أن يوثّق العنوان الجديد قبل الشراء والشهادة.
            </span>
          )}
        </label>

        <div className="mt-4 flex gap-2">
          <button
            disabled={busy}
            onClick={() => onSave({
              ...(displayName !== row.user.displayName ? { displayName } : {}),
              ...(email !== row.user.email ? { email } : {}),
            })}
            className="flex-1 cursor-pointer rounded-full bg-teal py-2.5 text-xs font-black text-on-teal transition hover:bg-teal-light disabled:opacity-40"
          >
            احفظ
          </button>
          <button
            disabled={busy}
            onClick={() => onSave({ status: suspended ? "active" : "suspended" })}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2.5 text-xs font-bold transition disabled:opacity-40 ${
              suspended
                ? "border-teal/45 text-teal-light-ink hover:bg-teal/10"
                : "border-red-400/40 text-red-300 hover:bg-red-400/10"
            }`}
          >
            <ShieldOff className="h-3.5 w-3.5" /> {suspended ? "ارفع الإيقاف" : "أوقف الحساب"}
          </button>
        </div>

        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-[11px] font-bold text-white/50">سجّله في شعبة</p>
          <div className="mt-2 flex gap-2">
            <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} className={`${field} flex-1 [&>option]:bg-surface`}>
              <option value="">اختر شعبة…</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.courseTitle} — {c.title}</option>)}
            </select>
            <button
              disabled={busy || !cohortId}
              onClick={() => onEnroll(cohortId)}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-2 text-[11px] font-bold text-white/75 transition hover:border-teal/50 disabled:opacity-40"
            >
              <UserPlus className="h-3.5 w-3.5" /> سجّله
            </button>
          </div>
          <p className="mt-2 text-[10.5px] leading-5 text-white/40">
            تسجيلٌ إداريّ بلا فاتورة — يمرّ بحارس السعة نفسِه، والفائضُ يذهب لقائمة الانتظار.
          </p>
        </div>
      </div>
    </div>
  );
}
