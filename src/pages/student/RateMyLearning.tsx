/* تقييمي (١و) — المتعلّم يقيّم مدرّبه ودورته ومستشاره.

   الصفحة تقول للمتعلّم حدود السرّية بلا تجميل: اسمه لا يصل المدرّب، والمدرّب
   لا يرى شيئا حتى تبلغ التقييمات ثلاثة. وعدٌ نصفُه صحيح أسوأ من لا وعد — من
   ظنّ تقييمه سرّيا مطلقا ثم عُرف، يخسر ثقته بالمنصّة كلّها لا بالصفحة. */

import { useCallback, useEffect, useState } from "react";
import { Loader2, ServerOff, ShieldCheck, Star } from "lucide-react";
import PortalLayout from "./PortalLayout";
import EmptyState from "@/components/EmptyState";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { toast } from '@/components/Toast';

import { Panel, Card } from "@/components/ui/Surface";
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
          <Star className={`h-6 w-6 ${n <= value ? "fill-gold text-gold" : "text-muted-foreground/50"}`} />
        </button>
      ))}
    </div>
  );
}

function RatingCard({ item, onSaved }: { item: Rateable; onSaved: () => void }) {
  const [score, setScore] = useState(item.myScore ?? 0);
  /* لا تُقال «اختر نجمةً» قبل أن يُحاول: لومٌ على حقلٍ لم يُلمس ليس إرشادا */
  const [needsScore, setNeedsScore] = useState(false);
  const [comment, setComment] = useState(item.myComment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (score < 1 || busy) return;
    setBusy(true);  setError("");
    try {
      await apiPost("/api/learner/ratings", {
        enrollmentId: item.enrollmentId, subjectType: item.subjectType,
        subjectId: item.subjectId, score, ...(comment.trim() ? { commentAr: comment.trim() } : {}),
      });
      toast(item.myScore == null ? "شكرا — وصل تقييمك" : "حُدّث تقييمك");
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر إرسال التقييم");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card as="article">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-fine font-bold text-muted-foreground">
            {KIND_AR[item.subjectType]}
          </span>
          {/* h2 لا h3 — البطاقةُ تحت عنوان الصفحة مباشرةً (انظر «شهاداتي») */}
          <h2 className="mt-1.5 text-sm font-black">{item.nameAr}</h2>
        </div>
        {item.myScore != null && (
          <span className="text-fine text-muted-foreground">قيّمتَ سابقا — يمكنك التعديل</span>
        )}
      </div>

      <div className="mt-4">
        <Stars value={score} onPick={(v) => { setScore(v); setNeedsScore(false); }} disabled={busy} />
        {needsScore && score < 1 && (
          <p role="alert" className="mt-2 text-fine font-bold leading-5 text-red-300">
            اختر عددَ النجوم أوّلا — التعليقُ وحدَه لا يُرسَل تقييما.
          </p>
        )}
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-fine font-bold text-muted-foreground">
          تعليق اختياري — لا يُنشر علنا إلا بعد مراجعة الإدارة
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={1500}
          placeholder="ما الذي نفعك؟ وما الذي كان يمكن أن يكون أفضل؟"
          className="w-full rounded-xl border border-white/10 bg-paper/20 px-3 py-2 text-xs leading-6 outline-none focus:border-teal/60"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {/* الزرُّ لا يُغلَق بلا سبب: كان باهتا حتّى تُختار نجمةٌ ولا شيءَ
            يقول ذلك — فيُضغَط الآن فيُقال ما ينقص، عند موضعه. */}
        <button
          onClick={score < 1 ? () => setNeedsScore(true) : save}
          disabled={busy}
          className="cursor-pointer rounded-full bg-teal px-5 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "يُرسَل…" : item.myScore == null ? "أرسل التقييم" : "حدّث التقييم"}
        </button>
        {error && <span role="alert" className="text-fine font-bold text-red-300">{error}</span>}
      </div>
    </Card>
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
    <PortalLayout title="رأيي في التدريب">
      {/* حدود السرّية مكتوبة قبل النموذج لا بعده — تُقرأ قبل أن يُكتب شيء */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-teal/25 bg-teal/[0.05] p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-light-ink" />
        <p className="text-[12px] leading-6 text-foreground">
          <span className="font-black text-foreground">اسمك لا يصل المدرّب ولا المستشار.</span>{" "}
          ولا يرى أيٌّ منهما تقييما حتى تبلغ التقييمات الواردة عنه ثلاثة — في العدد
          القليل يُستدلّ على أصحاب الآراء مهما حُذفت الأسماء. والإدارة ترى التعليقات
          فور وصولها، مجهولةَ صاحبها كذلك، لأن عليها أن تتصرّف إن كان في الأمر ما يستدعي.
        </p>
      </div>

      {offline && (
        <Panel className="grid place-items-center py-16 text-center">
          <ServerOff className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
        </Panel>
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
          actions={[{ to: "/student/learning", labelAr: "افتح مسارك", hintAr: "اختر موعد دورتك القادمة" }]}
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
