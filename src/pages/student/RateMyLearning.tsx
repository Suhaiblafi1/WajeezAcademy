/* تقييمي (١و) — المتعلّم يقيّم مدرّبه ودورته ومستشاره.

   الصفحة تقول للمتعلّم حدود السرّية بلا تجميل: اسمه لا يصل المدرّب، والمدرّب
   لا يرى شيئا حتى تبلغ التقييمات ثلاثة. وعدٌ نصفُه صحيح أسوأ من لا وعد — من
   ظنّ تقييمه سرّيا مطلقا ثم عُرف، يخسر ثقته بالمنصّة كلّها لا بالصفحة. */

import { useCallback, useEffect, useState } from "react";
import { Loader2, ServerOff, ShieldCheck, Star } from "lucide-react";
import PortalLayout from "./PortalLayout";
import EmptyState from "@/components/EmptyState";
import { apiGet, apiPost, ApiError } from "@/services/api";

interface Rateable {
  subjectType: "trainer" | "advisor" | "course";
  subjectId: string;
  nameAr: string;
  enrollmentId: string;
  myScore: number | null;
  myComment: string | null;
}

const KIND_AR: Record<Rateable["subjectType"], string> = {
  trainer: "مدرّب",
  advisor: "مستشار",
  course: "دورة",
};

function Stars({ value, onPick, disabled }: { value: number; onPick: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="الدرجة من ١ إلى ٥">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} من ٥`}
          disabled={disabled}
          onClick={() => onPick(n)}
          className="cursor-pointer rounded p-0.5 transition disabled:cursor-not-allowed"
        >
          <Star className={`h-6 w-6 ${n <= value ? "fill-gold text-gold" : "text-white/25"}`} />
        </button>
      ))}
    </div>
  );
}

function RatingCard({ item, onSaved }: { item: Rateable; onSaved: () => void }) {
  const [score, setScore] = useState(item.myScore ?? 0);
  const [comment, setComment] = useState(item.myComment ?? "");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");

  const save = async () => {
    if (score < 1 || busy) return;
    setBusy(true); setFlash(""); setError("");
    try {
      await apiPost("/api/learner/ratings", {
        enrollmentId: item.enrollmentId, subjectType: item.subjectType,
        subjectId: item.subjectId, score, ...(comment.trim() ? { commentAr: comment.trim() } : {}),
      });
      setFlash(item.myScore == null ? "شكرا — وصل تقييمك" : "حُدّث تقييمك");
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر إرسال التقييم");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-white/45">
            {KIND_AR[item.subjectType]}
          </span>
          <h3 className="mt-1.5 text-sm font-black">{item.nameAr}</h3>
        </div>
        {item.myScore != null && (
          <span className="text-[11px] text-white/40">قيّمتَ سابقا — يمكنك التعديل</span>
        )}
      </div>

      <div className="mt-4">
        <Stars value={score} onPick={setScore} disabled={busy} />
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[11px] font-bold text-white/50">
          تعليق اختياري — لا يُنشر علنا إلا بعد مراجعة الإدارة
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={1500}
          placeholder="ما الذي نفعك؟ وما الذي كان يمكن أن يكون أفضل؟"
          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-6 outline-none focus:border-teal/60"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={score < 1 || busy}
          className="cursor-pointer rounded-full bg-teal px-5 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "يُرسَل…" : item.myScore == null ? "أرسل التقييم" : "حدّث التقييم"}
        </button>
        {flash && <span role="status" className="text-[11px] font-bold text-emerald-300">{flash}</span>}
        {error && <span role="alert" className="text-[11px] font-bold text-red-300">{error}</span>}
      </div>
    </article>
  );
}

export default function RateMyLearning() {
  const [rows, setRows] = useState<Rateable[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setOffline(null);
    try {
      setRows(await apiGet<Rateable[]>("/api/learner/rateable"));
    } catch (e) {
      setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل — هذه الصفحة تتطلب API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <PortalLayout title="تقييمي">
      {/* حدود السرّية مكتوبة قبل النموذج لا بعده — تُقرأ قبل أن يُكتب شيء */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-teal/25 bg-teal/[0.05] p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-light-ink" />
        <p className="text-[12px] leading-6 text-white/65">
          <span className="font-black text-white/85">اسمك لا يصل المدرّب ولا المستشار.</span>{" "}
          ولا يرى أيٌّ منهما تقييما حتى تبلغ التقييمات الواردة عنه ثلاثة — في العدد
          القليل يُستدلّ على أصحاب الآراء مهما حُذفت الأسماء. والإدارة ترى التعليقات
          فور وصولها، مجهولةَ صاحبها كذلك، لأن عليها أن تتصرّف إن كان في الأمر ما يستدعي.
        </p>
      </div>

      {offline && (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center">
          <ServerOff className="h-10 w-10 text-white/20" />
          <p className="mt-3 max-w-md text-sm leading-7 text-white/55">{offline}</p>
        </div>
      )}

      {!offline && loading && (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" />
        </div>
      )}

      {!offline && !loading && rows.length === 0 && (
        <EmptyState
          icon={Star}
          titleAr="لا شيء تقيّمه بعد"
          reasonAr="التقييم يُفتح بعد أن تبدأ شعبتك فعلا — لا رأي فيما لم يُجرَّب. حين تبدأ، ستجد هنا دورتك ومدرّبها."
          tone="start"
          actions={[{ to: "/student/cohorts", labelAr: "الشعب المفتوحة", hintAr: "اطلب مقعدا في شعبة قادمة" }]}
        />
      )}

      {!offline && !loading && rows.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <RatingCard key={`${r.enrollmentId}-${r.subjectType}-${r.subjectId}`} item={r} onSaved={() => void load()} />
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
