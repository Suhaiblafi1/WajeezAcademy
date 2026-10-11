/* النصُّ الطويلُ مرتّبا — تعليماتُ المهمّة وملاحظاتُ الإدارة (١١ أكتوبر ٢٠٢٦).

   «لماذا النصوصُ تبدو جريدةً مكتظّة… اختر تصميما بسيطا لا يغيّر مسارَ العمل، بل يحسّن الشكلَ فقط»
   (صاحب المنصّة). فالقراءةُ في `application/trainer/text-layout.ts` محضةٌ، وهنا رسمُها وحدَه:
   خطواتٌ مرقّمة، وحقولٌ بأسمائها، وجدولُ مستويات، والنواقصُ محورا محورا ثمّ «كيف تُصلحه» مرّةً واحدة.
   ولا يُكتب شيءٌ ولا يُغيَّر — وما لا يُقرأ هكذا يُعرض نصّا كما كُتب. */

import { Lightbulb } from "lucide-react";
import Chip from "@/components/ui/Chip";
import { briefBlocks, briefHasLayout, gapLayout, type GapLayout } from "@/application/trainer/text-layout";
import { notePoints } from "@/application/trainer/plan-edits";

/** تعليماتُ المهمّة — مرتّبةً إن كان فيها ما يُرتَّب، وإلّا فقرةً كما كُتبت */
export function BriefView({ text, muted = false, className = "" }: { text: string; muted?: boolean; className?: string }) {
  const blocks = briefBlocks(text);
  const tone = muted ? "text-muted-foreground" : "text-foreground";
  if (!briefHasLayout(blocks)) {
    return <p className={`whitespace-pre-line text-read leading-7 ${tone} ${className}`}>{text}</p>;
  }
  return (
    <div className={`grid gap-3 text-read leading-7 ${tone} ${className}`}>
      {blocks.map((b, k) => {
        if (b.kind === "steps") {
          return (
            <ol key={k} className="grid gap-2">
              {b.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal/15 text-fine font-black text-teal-light-ink" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">{item}</span>
                </li>
              ))}
            </ol>
          );
        }
        if (b.kind === "field") {
          return (
            <div key={k} className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[7rem_minmax(0,1fr)]">
              <span className="font-black text-foreground">{b.labelAr}</span>
              <span className="min-w-0">{b.textAr}</span>
            </div>
          );
        }
        if (b.kind === "rubric") {
          return (
            <div key={k} className="grid gap-2.5" role="group" aria-label={b.titleAr ?? "مستوياتُ التقييم"}>
              {b.titleAr && <span className="font-black text-foreground">{b.titleAr}</span>}
              {b.rows.map((r, i) => (
                <div key={i} className="grid gap-1.5">
                  {r.criterionAr && <span className="font-bold text-foreground">{r.criterionAr}</span>}
                  <div className="grid gap-1.5 sm:grid-cols-3">
                    {r.levels.map((l, j) => (
                      <div key={j} className="rounded-lg bg-teal/10 px-3 py-2">
                        <span className="block text-fine font-black text-teal-light-ink">المستوى {l.level}</span>
                        <span className="block leading-6">{l.textAr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        }
        return <p key={k} className="whitespace-pre-line">{b.textAr}</p>;
      })}
    </div>
  );
}

/** النواقصُ محورا محورا — ثمّ «كيف تُصلحه» مرّةً واحدة */
export function GapList({ layout }: { layout: GapLayout }) {
  return (
    <div className="grid gap-2.5 text-read leading-6">
      <ul className="grid gap-1.5">
        {layout.groups.map((g) => (
          <li key={g.whereAr} className="flex flex-wrap items-center gap-1.5">
            <span className="me-1 font-black text-foreground">{g.whereAr}</span>
            {g.issuesAr.map((x) => (
              <span key={x} className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-muted-foreground">{x}</span>
            ))}
          </li>
        ))}
      </ul>
      {layout.fixesAr.length > 0 && (
        <div className="grid gap-1">
          <span className="font-black text-foreground">كيف تُصلحه</span>
          <ul className="grid gap-1">
            {layout.fixesAr.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Lightbulb className="mt-1 h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-foreground">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** ملاحظةُ الإدارة على خطوة — نقطةً نقطة: اسمُ المعيار ووسمُه، ثمّ «الآن» مرتّبا، ثمّ «نقترح» */
export function NoteBody({ text }: { text: string }) {
  const points = notePoints(text);
  return (
    <ul className="grid gap-3">
      {points.map((p, i) => {
        const gaps = p.nowAr ? gapLayout(p.nowAr) : null;
        const tag = p.tagAr && <Chip tone={p.tagAr === "مطلوب" ? "danger" : "info"}>{p.tagAr}</Chip>;
        const rule = i > 0 ? "border-t border-white/10 pt-3" : "";
        /* والكلمةُ الحرّةُ كما كتبها المعتمِد — سطرا بوسمه */
        if (!p.labelAr) {
          return (
            <li key={i} className={`flex flex-wrap items-start gap-2 text-read leading-7 text-foreground ${rule}`}>
              {tag}<span className="min-w-0 flex-1 whitespace-pre-wrap">{p.textAr}</span>
            </li>
          );
        }
        return (
          <li key={i} className={`grid gap-1.5 ${rule}`}>
            <div className="flex flex-wrap items-center gap-2">
              {tag}
              <span className="text-read font-bold text-foreground">{p.labelAr}</span>
            </div>
            {p.nowAr && (gaps
              ? <GapList layout={gaps} />
              : <p className="text-read leading-6 text-muted-foreground"><b className="text-foreground">الآن:</b> {p.nowAr}</p>)}
            {p.suggestAr && (
              <p className="text-read leading-6 text-foreground"><b className="text-teal-light-ink">نقترح:</b> {p.suggestAr}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
