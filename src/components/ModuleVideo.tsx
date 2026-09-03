/* فيديو الوحدة وفصوله ونقاط تفتيشه (البند ح-٢).
   «لا تبنِ مشغلا؛ استضف واربط» — فالإطار من المضيف، والقيمة عندنا في:
   - الفصول المعنونة: تجعل الفيديو مرجعا يُعاد إليه لا شريطا يُشاهَد مرة
   - نقاط التفتيش: سؤال بعد الفصل يحوّل الاستقبال السلبي إلى استرجاع

   ⚠ لا نزعم قياس المشاهدة: لا نملك وقت الإطار المستضاف، فلا شريط تقدم ولا
   «أكملت ٧٠٪». الفصل يُفتح بالنقر، والتفتيش يفتحه المتعلم بنفسه. */

import { useState } from "react";
import { ChevronDown, ExternalLink, ListVideo, PlayCircle, Sparkles } from "lucide-react";
import CheckQuestion from "./CheckQuestion";
import { parseChecks } from "@/application/content/module-checks";
import { embedAt, parseVideo } from "@/application/content/module-video";
import { track } from "@/services/analytics";

export default function ModuleVideo({
  raw,
  checksRaw,
  moduleId,
  className = "",
}: {
  raw: string;
  /** نص التمرين — تُستخرج منه الأسئلة المربوطة بفصول */
  checksRaw?: string | null;
  moduleId: string;
  className?: string;
}) {
  const { video } = parseVideo(raw);
  const { checks } = parseChecks(checksRaw);
  const [at, setAt] = useState(0);
  const [openCheck, setOpenCheck] = useState<number | null>(null);
  const [picked, setPicked] = useState<Record<number, number>>({});

  if (!video) return null;
  const checkFor = (chapterNo: number) => checks.find((c) => c.chapterIndex === chapterNo);

  return (
    <section aria-labelledby={`video-${moduleId}`} className={`rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 ${className}`.trim()}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`video-${moduleId}`} className="flex items-center gap-2 text-sm font-black">
          <ListVideo className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />
          فيديو الوحدة
          {video.chapters.length > 0 && (
            <span className="rounded-full bg-teal-ink/15 px-2 py-0.5 text-[11px] tabular-nums text-teal-light-ink">
              {video.chapters.length} فصول
            </span>
          )}
        </h3>
        <a
          href={video.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-light-ink hover:underline"
        >
          افتحه في تبويب جديد
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <iframe
          key={at}
          src={embedAt(video, at)}
          title="فيديو الوحدة"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full"
        />
      </div>

      {video.chapters.length > 0 && (
        <ol className="mt-4 space-y-1.5">
          {video.chapters.map((ch, i) => {
            const no = i + 1;
            const check = checkFor(no);
            const open = openCheck === no;
            return (
              <li key={`${ch.atSec}-${i}`} className="rounded-2xl border border-white/8 bg-white/[0.02]">
                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => { setAt(ch.atSec); track("module_video_chapter_opened", { module: moduleId, chapter: no }); }}
                    className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-right text-xs transition hover:text-teal-light-ink"
                  >
                    <PlayCircle className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-bold">{ch.titleAr}</span>
                    <span dir="ltr" className="shrink-0 font-mono text-micro tabular-nums text-muted-foreground">{ch.atAr}</span>
                  </button>
                  {check && (
                    <button
                      type="button"
                      onClick={() => setOpenCheck(open ? null : no)}
                      aria-expanded={open}
                      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold transition ${
                        open ? "border-teal/60 text-teal-light-ink" : "border-gold/40 text-gold-ink hover:border-gold/70"
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      تفتيش
                      <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                  )}
                </div>
                {check && open && (
                  <div className="border-t border-white/8 px-3 pb-3 pt-3">
                    <CheckQuestion
                      check={check}
                      index={null}
                      chosen={picked[no]}
                      onPick={(oi) => {
                        if (picked[no] !== undefined) return;
                        setPicked((p) => ({ ...p, [no]: oi }));
                        track("module_check_answered", { module: moduleId, q: no, correct: oi === check.correctIndex });
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        الفصول تفتح الفيديو من موضعها. ولا نقيس مشاهدتك — التفتيش بعد كل فصل هو ما يثبّت ما شاهدته.
      </p>
    </section>
  );
}
