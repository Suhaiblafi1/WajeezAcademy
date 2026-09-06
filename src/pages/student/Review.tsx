/* مراجعتي (البند ح-٤) — الاسترجاع المتباعد: بطاقة سؤال تعود بعد يوم، ثم ثلاثة،
   ثم أسبوع، ثم ثلاثة أسابيع، ثم شهرين. الجمع بين الاسترجاع والتباعد هو ما
   يسنده الدليل، لا أحدهما وحده.

   ما ليس في هذه الشاشة بقصد:
   - لا نقاط ولا سلسلة أيام ولا لوحة صدارة. البحث يجد أثر التلعيب الإجمالي
     صغيرا وبعض حلقاته ترفع التسرب — فالمؤشر الوحيد هو «ما استُحق اليوم».
   - لا يرفع الاسترجاع مستوى مهارة ولا يخفضه: المستوى من القياس (مؤشر وجيز
     والقياس البعديّ ح-٧). ويُقال ذلك للمتعلم صراحة لا في الكود وحده.
   - لا استرجاع قبل موعده: من أراد التقديم فقد ألغى الفائدة، والخادم يرفضه. */

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarClock, CheckCircle2, Layers, Loader2, RefreshCw, Target } from "lucide-react";
import PortalLayout from "./PortalLayout";
import CheckQuestion from "@/components/CheckQuestion";
import { apiGet, apiPost } from "@/services/api";
import { fmtWhen } from "@/utils/format";
import { usePublishedContent } from "@/services/public-content";
import { buildCheckTextIndex } from "@/data/module-checks-index";
import { skillNameOf } from "@/data/skill-names";
import {
  buildRetrievalSummary, buildReviewQueue, dueCards,
  type RetrievalCard, type ReviewItem,
} from "@/application/student/retrieval-schedule";
import EmptyState from "@/components/EmptyState";

import { Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
const HONESTY_NOTE =
  "الاسترجاع لا يرفع مستوى مهارتك ولا يخفضه — مستواك يأتي من القياس في مؤشر وجيز ومن إعادة القياس بعد الدورة. " +
  "هذه البطاقات لتثبيت ما تعلمته، لا لتقييمك.";

/** بطاقة واحدة: السؤال ثم التصحيح ثم موعد العودة */
function ReviewCard({
  item, chosen, onPick, saved,
}: {
  item: ReviewItem;
  chosen: number | undefined;
  onPick: (oi: number) => void;
  saved: { step: number; dueAt: string } | null;
}) {
  const correct = chosen !== undefined && chosen === item.correctIndex;
  return (
    <Panel as="li" className="sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {item.skillNameAr && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal/40 px-2.5 py-0.5 font-bold text-teal-light-ink">
            <Target className="h-3 w-3" aria-hidden="true" />
            {item.skillNameAr}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="h-3 w-3" aria-hidden="true" />
          {[item.courseTitleAr, item.moduleTitleAr].filter(Boolean).join(" · ")}
        </span>
      </div>

      <CheckQuestion
        check={{
          promptAr: item.promptAr,
          options: item.options,
          correctIndex: item.correctIndex,
          explainAr: item.explainAr,
          chapterIndex: null,
          skillSlug: item.skillSlug,
        }}
        index={null}
        chosen={chosen}
        onPick={onPick}
      />

      <p className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3 text-[11px] text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {saved ? (
          <>تعود هذه البطاقة في {fmtWhen(saved.dueAt)}.</>
        ) : chosen === undefined ? (
          <>تعود بعد {item.nextIfCorrectAr} لو استرجعتها، وبعد {item.nextIfWrongAr} لو لم تسترجعها.</>
        ) : (
          <>{correct ? `استرجعتها — تعود بعد ${item.nextIfCorrectAr}.` : `لم تسترجعها — تعود بعد ${item.nextIfWrongAr}.`}</>
        )}
      </p>
    </Panel>
  );
}

export default function Review() {
  const catalogVersion = usePublishedContent();
  /* اللقطة تحمل بطاقاتها ولحظة قراءتها معا: الاستحقاق يُحسب على لحظة الجلب لا
     على ساعة كل رسم، فلا تتحرك القائمة تحت يد المتعلم وهو يجيب. */
  const [snap, setSnap] = useState<{ cards: RetrievalCard[]; at: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, { step: number; dueAt: string }>>({});

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await apiGet<{ cards: RetrievalCard[] }>("/api/learner/retrieval").catch(
        (e: unknown) => (e instanceof Error ? e.message : "تعذر تحميل بطاقات المراجعة"),
      );
      if (!alive) return;
      const at = new Date().toISOString();
      if (typeof r === "string") { setError(r); setSnap({ cards: [], at }); }
      else { setError(null); setSnap({ cards: r.cards, at }); }
    })();
    return () => { alive = false; };
  }, [reload]);

  const { queue, summary } = useMemo(() => {
    /* الكتالوج كسول (ع-١): الفهرس يُبنى بعد تثبيته لا قبله */
    void catalogVersion;
    if (!snap) return { queue: [] as ReviewItem[], summary: null };
    const now = new Date(snap.at);
    const text = buildCheckTextIndex();
    const names: Record<string, string> = {};
    for (const c of snap.cards) if (c.skillSlug) names[c.skillSlug] = skillNameOf(c.skillSlug);
    return {
      queue: buildReviewQueue(dueCards(snap.cards, now), text, names),
      summary: buildRetrievalSummary(snap.cards, now),
    };
  }, [snap, catalogVersion]);

  const answer = async (item: ReviewItem, optionIndex: number) => {
    const key = `${item.moduleId}#${item.checkIndex}`;
    if (picked[key] !== undefined) return;
    setPicked((p) => ({ ...p, [key]: optionIndex }));
    const res = await apiPost<{ step: number; dueAt: string }>("/api/learner/retrieval/answer", {
      moduleId: item.moduleId,
      checkIndex: item.checkIndex,
      correct: optionIndex === item.correctIndex,
    }).catch(() => null);
    if (res) setSaved((s) => ({ ...s, [key]: { step: res.step, dueAt: res.dueAt } }));
  };

  if (snap === null) {
    return (
      <PortalLayout title="تثبيتُ ما تعلّمت">
        <div className="grid place-items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="جارٍ التحميل" />
        </div>
      </PortalLayout>
    );
  }

  const answeredAll = queue.length > 0 && queue.every((i) => picked[`${i.moduleId}#${i.checkIndex}`] !== undefined);

  return (
    <PortalLayout title="تثبيتُ ما تعلّمت">
      {error && (
        <p className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">{error}</p>
      )}

      <Panel as="section" tone="accent" className="bg-teal-ink/[0.07]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs text-muted-foreground">بطاقات استحقّت الاسترجاع اليوم</p>
            <p className="mt-1 text-5xl font-black leading-none text-teal-light-ink tabular-nums">{summary?.due ?? 0}</p>
            {summary && summary.due === 0 && summary.nextDueAt && (
              <p className="mt-2 text-xs text-muted-foreground">التالية في {fmtWhen(summary.nextDueAt)}</p>
            )}
          </div>
          <dl className="grid grid-cols-3 gap-5 text-center">
            {[
              { k: "كل بطاقاتك", v: summary?.total ?? 0 },
              { k: "ثابتة الاسترجاع", v: summary?.settled ?? 0 },
              { k: "عادت لأول السلّم", v: summary?.restarted ?? 0 },
            ].map((t) => (
              <div key={t.k}>
                <dd className="text-2xl font-black tabular-nums">{t.v}</dd>
                <dt className="mt-0.5 text-[11px] text-muted-foreground">{t.k}</dt>
              </div>
            ))}
          </dl>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">{HONESTY_NOTE}</p>
      </Panel>

      {queue.length === 0 ? (
        /* ط-٤ · حالتان لا واحدة: «لا بطاقات بعد» تحتاج بداية، و«لا شيء مستحق»
           إنجازٌ يُطمئن — فلا تُعرض بنبرة نقص ولا تُدعى لعمل لا فائدة فيه الآن.
           التباعد نفسه هو الفائدة، فلا نقترح مراجعة قبل موعدها. */
        summary && summary.total === 0 ? (
          <EmptyState
            className="mt-6"
            icon={Layers}
            titleAr="لا بطاقات بعد"
            reasonAr="تُفتح بطاقات المراجعة من تمرين الاسترجاع في نهاية كل وحدة — أنهِ وحدة ثم اطلب جدولة عودتها."
            actions={[
              { to: "/student/learning", labelAr: "أنهِ وحدة من دوراتي", hintAr: "أول بطاقة تُفتح بعدها" },
              { to: "/student/learning", labelAr: "اعرف الوحدة التالية", hintAr: "موضعك من المسار" },
            ]}
          />
        ) : (
          <EmptyState
            className="mt-6"
            icon={Layers}
            tone="done"
            titleAr="لا شيء مستحق الآن"
            reasonAr="راجعتَ كل ما حلّ موعده. التباعد نفسه هو الفائدة، فلا نقدّم موعدا — عد في الموعد المذكور أعلاه."
            actions={[{ to: "/student/learning", labelAr: "تابع دوراتي", hintAr: "وحدة جديدة تفتح بطاقات جديدة" }]}
          />
        )
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-4">
            {queue.map((item) => {
              const key = `${item.moduleId}#${item.checkIndex}`;
              return (
                <ReviewCard
                  key={key}
                  item={item}
                  chosen={picked[key]}
                  onPick={(oi) => void answer(item, oi)}
                  saved={saved[key] ?? null}
                />
              );
            })}
          </ul>
          {answeredAll && (
            <Panel tone="accent" className="mt-6 flex flex-wrap items-center gap-3 bg-teal-ink/[0.07]">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-light-ink" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-sm font-bold">
                أنهيت مستحقّ اليوم. كل بطاقة جُدولت لموعدها المذكور تحتها.
              </p>
              <Button tone="secondary" type="button"
                onClick={() => { setPicked({}); setSaved({}); setSnap(null); setReload((n) => n + 1); }} className="min-h-11">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                حدّث القائمة
              </Button>
            </Panel>
          )}
        </>
      )}
    </PortalLayout>
  );
}
