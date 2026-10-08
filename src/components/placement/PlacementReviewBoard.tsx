/* مراجعةُ أسئلة اختبار تحديد مستوى الإنجليزيّة (٨ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «أكتبه مسوّدةً ويراجعه مدرّبُ الإنجليزيّة في بوّابته». فهذه
   اللوحةُ تُعرض في بوّابة المدرّب لمن مُنح `placement.review`، وفي لوحة الإدارة
   للمدير — مكوّنٌ واحدٌ في غلافين، فلا تفترق الشاشتان.

   ولكلّ سؤالٍ ثلاثةُ أفعالٍ يُقال أثرُ كلٍّ منها قبل أن يُختار (قاعدةُ «الخياراتُ
   وأثرُ كلٍّ»): **اعتمده** فيدخل الاختبار، **عدّله** فيبقى بحاله ويتغيّر نصُّه،
   **أسقطه** فيخرج من الاختبار ويبقى في السجلّ يُعاد متى شاء. ولا يُفتح الاختبارُ
   للمتعلّمين حتّى يكون لكلّ مستوى ثلاثةُ أسئلةٍ معتمدة. */

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, PencilLine, ServerOff, XCircle } from "lucide-react";
import { apiGet, apiPatch, apiPost, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import TabBar from "@/components/ui/TabBar";
import { MIN_APPROVED_PER_LEVEL } from "@/domain/placement/english-placement";

interface ReviewItem {
  id: string;
  level: string;
  skill: "grammar" | "vocabulary" | "reading";
  passage: string | null;
  stem: string;
  options: string[];
  answer_index: number;
  status: "draft" | "approved" | "retired";
  review_note_ar: string | null;
}

interface ReviewList {
  open: boolean;
  per_level: { level: string; approved: number; total: number }[];
  items: ReviewItem[];
}

const SKILL_AR: Record<ReviewItem["skill"], string> = {
  grammar: "قواعد", vocabulary: "مفردات", reading: "قراءة",
};

const TABS = [
  { id: "draft", label: "تنتظر المراجعة" },
  { id: "approved", label: "معتمَدة" },
  { id: "retired", label: "مُسقَطة" },
];

interface Draft {
  stem: string;
  passage: string;
  options: string[];
  answer: number;
}

export default function PlacementReviewBoard() {
  const [data, setData] = useState<ReviewList | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [status, setStatus] = useState("draft");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setOffline(null);
    try {
      setData(await apiGet<ReviewList>("/api/placement/english/review"));
    } catch (e) {
      setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (id: string, approve: boolean) => {
    if (busy) return;
    setBusy(id);
    try {
      const note = notes[id]?.trim();
      await apiPost(`/api/placement/english/review/${id}/decide`, { approve, ...(note ? { note } : {}) });
      toast(approve ? "اعتُمد السؤال — صار في الاختبار" : "أُسقط السؤال — خرج من الاختبار ويُعاد متى شئت");
      await load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ القرار");
    } finally {
      setBusy(null);
    }
  };

  const startEdit = (i: ReviewItem) => {
    setEditing(i.id);
    setDraft({ stem: i.stem, passage: i.passage ?? "", options: [...i.options], answer: i.answer_index });
  };

  const saveEdit = async (i: ReviewItem) => {
    if (!draft || busy) return;
    setBusy(i.id);
    try {
      await apiPatch(`/api/placement/english/review/${i.id}`, {
        stemEn: draft.stem,
        options: draft.options,
        answerIndex: draft.answer,
        ...(i.skill === "reading" ? { passageEn: draft.passage } : {}),
      });
      toast("حُفظ التعديل — وحالُ السؤال كما كانت");
      setEditing(null);
      setDraft(null);
      await load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر حفظ التعديل");
    } finally {
      setBusy(null);
    }
  };

  if (offline) {
    return (
      <Panel className="grid place-items-center py-16 text-center">
        <ServerOff className="h-10 w-10 text-muted-foreground/50" />
        <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
      </Panel>
    );
  }
  if (!data) {
    return <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>;
  }

  const rows = data.items.filter((i) => i.status === status);

  return (
    <div>
      <Card tone={data.open ? "positive" : "accent"} className="mb-5">
        <p className="text-read leading-7 text-foreground">
          {data.open
            ? "الاختبارُ مفتوحٌ للمتعلّمين: لكلّ مستوى أسئلتُه المعتمدة. وما تعتمده أو تُسقطه بعد الآن يغيّر الاختبارَ فورا."
            : `الاختبارُ مغلقٌ عن المتعلّمين حتّى يكون لكلّ مستوى ${MIN_APPROVED_PER_LEVEL} أسئلةٍ معتمدةٍ على الأقلّ. ومن يطلبه قبل ذلك يُسجَّل بمستواه الموصوف.`}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {data.per_level.map((l) => (
            <li key={l.level}>
              <Inset className={`px-3 py-1 text-fine font-bold ${l.approved >= MIN_APPROVED_PER_LEVEL ? "text-teal-light-ink" : "text-muted-foreground"}`}>
                <span dir="ltr">{l.level}</span> · {l.approved} معتمَد من {l.total}
              </Inset>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-fine leading-6 text-muted-foreground">
          «اعتمده» يُدخله الاختبار · «عدّله» يغيّر نصَّه ويُبقي حالَه · «أسقطه» يُخرجه من الاختبار ويبقى هنا تعيده متى شئت.
        </p>
      </Card>

      <TabBar className="mb-5" ariaLabel="حالُ الأسئلة" value={status} onChange={setStatus}
        items={TABS.map((t) => ({ id: t.id, label: `${t.label} (${data.items.filter((i) => i.status === t.id).length})` }))} />

      {rows.length === 0 ? (
        <Card as="p" className="px-5 py-10 text-center text-sm text-muted-foreground">لا أسئلةَ في هذه الحالة.</Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((i) => (
            <Card as="li" key={i.id}>
              <div className="flex flex-wrap items-center gap-2 text-fine">
                <span dir="ltr" className="rounded-full border border-white/10 px-2 py-0.5 font-black text-foreground">{i.level}</span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 font-bold text-muted-foreground">{SKILL_AR[i.skill]}</span>
                <span dir="ltr" className="text-muted-foreground/60">{i.id}</span>
              </div>

              {editing === i.id && draft ? (
                <div dir="ltr" className="mt-3 space-y-2 text-left">
                  {i.skill === "reading" && (
                    <textarea value={draft.passage} rows={3} aria-label="Passage"
                      onChange={(e) => setDraft({ ...draft, passage: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-transparent p-2 text-sm text-foreground" />
                  )}
                  <input value={draft.stem} aria-label="Question"
                    onChange={(e) => setDraft({ ...draft, stem: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-transparent p-2 text-sm font-bold text-foreground" />
                  {draft.options.map((o, k) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="radio" name={`answer-${i.id}`} checked={draft.answer === k}
                        onChange={() => setDraft({ ...draft, answer: k })} aria-label={`Correct answer ${k + 1}`} />
                      <input value={o} aria-label={`Option ${k + 1}`}
                        onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, j) => (j === k ? e.target.value : x)) })}
                        className="w-full rounded-xl border border-white/10 bg-transparent p-2 text-sm text-foreground" />
                    </label>
                  ))}
                  <div dir="rtl" className="flex flex-wrap gap-2 pt-1">
                    <Button tone="confirm" size="sm" onClick={() => void saveEdit(i)} disabled={busy === i.id}>احفظ التعديل</Button>
                    <Button tone="ghost" size="sm" onClick={() => { setEditing(null); setDraft(null); }}>تراجع</Button>
                  </div>
                </div>
              ) : (
                <div dir="ltr" className="mt-3 text-left">
                  {i.passage && <Inset as="p" className="mb-2 p-3 text-sm leading-7 text-muted-foreground">{i.passage}</Inset>}
                  <p className="text-sm font-bold leading-7 text-foreground">{i.stem}</p>
                  <ol className="mt-2 space-y-1">
                    {i.options.map((o, k) => (
                      <li key={k} className={`text-sm ${k === i.answer_index ? "font-black text-teal-light-ink" : "text-muted-foreground"}`}>
                        {String.fromCharCode(65 + k)}. {o}{k === i.answer_index ? "  ✓" : ""}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {i.review_note_ar && <p className="mt-2 text-read text-muted-foreground">ملاحظةُ المراجعة: {i.review_note_ar}</p>}

              {editing !== i.id && (
                <div className="mt-4 space-y-2">
                  <input value={notes[i.id] ?? ""} placeholder="ملاحظةٌ مع القرار (اختياريّة)"
                    onChange={(e) => setNotes({ ...notes, [i.id]: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-transparent p-2 text-fine text-foreground" />
                  <div className="flex flex-wrap gap-2">
                    {i.status !== "approved" && (
                      <Button tone="confirm" size="sm" onClick={() => void decide(i.id, true)} disabled={busy === i.id}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> اعتمده
                      </Button>
                    )}
                    <Button tone="secondary" size="sm" onClick={() => startEdit(i)} disabled={busy === i.id}>
                      <PencilLine className="h-3.5 w-3.5" /> عدّله
                    </Button>
                    {i.status !== "retired" && (
                      <Button tone="danger" size="sm" onClick={() => void decide(i.id, false)} disabled={busy === i.id}>
                        <XCircle className="h-3.5 w-3.5" /> أسقطه
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
