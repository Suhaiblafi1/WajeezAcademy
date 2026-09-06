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

import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
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
      <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-muted-foreground">{error}</p>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11.5px] text-muted-foreground">{SCOPE_NOTE[data.scope]}</p>
        <form
          onSubmit={(e) => { e.preventDefault(); void load(q); }}
          className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو البريد…"
            aria-label="بحث في الطلبة"
            /* الحقلُ كان ارتفاعُه ستّةَ عشرَ بكسلا: نصٌّ بلا حاشيةٍ داخل
               حبّةٍ لها حاشيتُها. والحبّةُ تُرى هدفا، والهدفُ الفعليُّ هو
               الحقل — فيأخذ ارتفاعَه بنفسه. */
            className="min-h-8 w-48 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/75"
          />
        </form>
      </div>

      {data.learners.length === 0 ? (
        <Panel className="grid place-items-center py-14 text-center">
          <GraduationCap className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-black">لا طلبة في نطاقك بعد</p>
          <p className="mt-1 max-w-sm text-xs leading-6 text-muted-foreground">
            {data.scope === "trainer"
              ? "حين تُسنَد إليك شعبةٌ ويُسجَّل فيها متعلّمون، يظهرون هنا."
              : data.scope === "advisor"
                ? "حين تُسنَد إليك حالةٌ لعميلٍ سجّل في شعبة، يظهر هنا."
                : "لا تسجيلات بعد."}
          </p>
        </Panel>
      ) : (
        <ul className="space-y-2.5">
          {data.learners.map((l) => (
            <Card as="li" key={l.user.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-black">
                    {l.user.displayName}
                    {l.user.status !== "active" && (
                      <span className="rounded-full border border-red-400/40 px-2 py-0.5 text-micro font-bold text-red-300">موقوف</span>
                    )}
                  </p>
                  <p dir="ltr" className="mt-0.5 text-left text-[11px] text-muted-foreground">{l.user.email}</p>
                </div>
                {data.canWrite && (
                  <div className="flex shrink-0 gap-1.5">
                    <Button tone="secondary" size="sm" onClick={() => setEditing(l)}>
                      <Pencil className="h-3 w-3" /> عدّل الحساب
                    </Button>
                  </div>
                )}
              </div>

              <ul className="mt-3 space-y-1.5">
                {l.enrollments.map((e) => (
                  <Inset as="li" key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-[12px] font-bold text-foreground">{e.courseTitle}</span>
                      <span className="text-micro text-muted-foreground">
                        {e.cohortTitle} · {ENROLL_STATUS[e.status] ?? e.status} · {e.percent}٪
                        {e.startsAt ? ` · ${fmtDate(new Date(e.startsAt))}` : ""}
                      </span>
                    </span>
                    {data.canWrite && (
                      <Button tone="danger" size="sm" onClick={() => void act(
                          () => apiDelete(`/api/staff/learners/enrollments/${e.id}`, { note: "إخراجٌ من شاشة الطلبة" }),
                          `أُخرج «${l.user.displayName}» من «${e.cohortTitle}» — والسجلّ باقٍ`,
                        )}
                        disabled={busy} className="shrink-0 px-2.5 text-micro">
                        <Trash2 className="h-3 w-3" /> أخرجه
                      </Button>
                    )}
                  </Inset>
                ))}
              </ul>
            </Card>
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

  const field = "w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-foreground outline-none focus:border-teal/50";
  const suspended = row.user.status !== "active";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-paper/70 p-4" role="dialog" aria-label={`تعديل حساب ${row.user.displayName}`}>
      <Inset className="w-full max-w-md bg-surface">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-black">تعديل حساب «{row.user.displayName}»</h3>
          <button onClick={onClose} aria-label="إغلاق" className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-4 block text-[11px] font-bold text-muted-foreground">
          الاسم
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="mt-3 block text-[11px] font-bold text-muted-foreground">
          البريد
          <input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className={`${field} mt-1 text-left`} />
          {/* يُقال قبل الحفظ لا بعده: تبديلُ البريد يُسقط توثيقَه، والشراءُ
              والشهادةُ موقوفان على التوثيق. */}
          {email !== row.user.email && (
            <span className="mt-1 block text-micro font-normal leading-5 text-gold-ink">
              تبديلُ البريد يُسقط توثيقَه — سيحتاج أن يوثّق العنوان الجديد قبل الشراء والشهادة.
            </span>
          )}
        </label>

        <div className="mt-4 flex gap-2">
          <Button tone="confirm" disabled={busy}
            onClick={() => onSave({
              ...(displayName !== row.user.displayName ? { displayName } : {}),
              ...(email !== row.user.email ? { email } : {}),
            })} className="flex-1">
            احفظ
          </Button>
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
          <p className="text-[11px] font-bold text-muted-foreground">سجّله في شعبة</p>
          <div className="mt-2 flex gap-2">
            <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} className={`${field} flex-1 [&>option]:bg-surface`}>
              <option value="">اختر شعبة…</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.courseTitle} — {c.title}</option>)}
            </select>
            <Button tone="secondary" disabled={busy || !cohortId}
              onClick={() => onEnroll(cohortId)} className="shrink-0 px-3.5">
              <UserPlus className="h-3.5 w-3.5" /> سجّله
            </Button>
          </div>
          <p className="mt-2 text-micro leading-5 text-muted-foreground">
            تسجيلٌ إداريّ بلا فاتورة — يمرّ بحارس السعة نفسِه، والفائضُ يذهب لقائمة الانتظار.
          </p>
        </div>
      </Inset>
    </div>
  );
}
