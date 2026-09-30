/* دليلُ المدرّب — من الألف إلى الياء (٢٩ سبتمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: رسالةُ اعتماد التوقيع تحمل رابطا إلى دليلٍ «يرشدهم لما
   يجب أن يفعله المدرّب داخل منصّته من الألف إلى الياء… لا تترك تفصيلة،
   واجعلها سهلةَ القراءة، واترك صورا من المنصّة لترشده». والمسارُ وعلّةُ كونه
   عامّا في `application/trainer/trainer-guide.ts`، والمحتوى في
   `data/trainer-guide/` — هذا الملفُّ يعرضه ولا يكتبه.

   ═══ والتصميمُ من أنماطٍ مقيسة (Mobbin) لا من الذاكرة ═══

   · **فهرسٌ ثابتٌ بجانب المقال يتبع موضعَ القارئ** — مركز مساعدة Figma و
     Better Stack: دليلٌ طويلٌ يُقرأ على مراحل، والقارئُ يعود إلى قسمه.
   · **خطواتٌ مرقّمةٌ فوق صورةٍ مؤطَّرة** — Figma: الخطوةُ ثمّ الشاشةُ التي
     تقع فيها، لا الصورةُ أوّلا ثمّ البحثُ عن معناها.
   · **أرقامٌ ذهبيّةٌ على الصورة تقابل أرقامَ الخطوات** — Tripadvisor، و**بقعةُ
     ضوءٍ على ما يُشرَح** — Zoho CRM وDeel. وهي لغةُ الدليل الواحدة: الذهبيُّ
     للمؤشِّر وحدَه، فلا يُستعمَل لشيءٍ آخر في الصفحة.
   · **قائمةُ الأسبوع الأوّل بتقديرِ وقتٍ لكلّ بند** — Remote وHoneyBook:
     ما يُنجَز يُعلَّم، وما بقي يُعدّ.
   · **رحلةٌ بمحطّاتٍ متتابعة** — Sequence: أين يقف المدرّبُ من الطريق كلِّه.

   ═══ وما لا يفعله ═══

   لا يطلب دخولا (يُفتح من البريد على أيّ جهاز)، ولا يحفظ عند الخادم شيئا:
   علاماتُ القائمة في متصفّح القارئ وحدَه (`safe-storage`)، وضياعُها لا يمسّ
   شيئا في حسابه. ويُطبَع كاملا: الأسئلةُ تُفتح قبل الطباعة، والشريطُ يُخفى. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  BookOpen, CalendarPlus, Check, ChevronDown, FileSignature, Globe2, LayoutDashboard,
  Lightbulb, LifeBuoy, Mail, Maximize2, MessageCircle, Printer, TriangleAlert, X,
} from "lucide-react";
import SeoHead from "@/components/SeoHead";
import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import { safeGet, safeSet } from "@/services/safe-storage";
import { CONTACT } from "@/data/stories";
import { waHref } from "@/application/site/whatsapp";
import { useWhatsAppNumbers } from "@/services/whatsapp";
import { ORIENTATION_BOOKING_URL, ORIENTATION_CTA_AR } from "@/application/trainer/orientation-session";
import { TRAINER_GUIDE_PATH } from "@/application/trainer/trainer-guide";
import {
  CHECKLIST, FAQ, GUIDE_READ_TIME_AR, GUIDE_SECTIONS, GUIDE_UPDATED_AR, JOURNEY, JOURNEY_START,
} from "@/data/trainer-guide/content";
import { GUIDE_SHOTS } from "@/data/trainer-guide/shots";
import type { CalloutTone, GuideBlock, GuideSection } from "@/data/trainer-guide/types";

/** مكانُ الصور — تولّدها `scripts/trainer-guide/capture.ts` */
const SHOT_DIR = "/guides/trainer";
const CHECK_KEY = "wajeez.trainer-guide.checklist.v1";

/* ═══ الأنماطُ الخاصّة بالدليل — بمتغيّرات السمة فتنقلب مع المظهر ═══

   ما هنا ليس سطوحا (تلك من `ui/Surface`)، بل ثلاثةُ أشياءَ لا مكوّنَ لها:
   رقاقةُ اسم الزرّ، ودائرةُ المؤشّر الذهبيّة، وخطُّ الرحلة. */
const CSS = `
.guide-hand { font-family: "Aref Ruqaa", serif; }
.guide-ui {
  display: inline-block; padding: 0 .45em; margin: 0 .1em; border-radius: .45em;
  border: 1px solid hsl(var(--border)); background: hsl(var(--background));
  font-weight: 700; font-size: .92em; line-height: 1.7; white-space: nowrap;
  box-shadow: 0 1px 0 hsl(var(--border));
}
.guide-mark {
  flex: none; display: inline-grid; place-items: center; width: 1.9rem; height: 1.9rem;
  border-radius: 999px; background: rgb(var(--gold)); color: #162220;
  font-weight: 800; font-size: .95rem; font-variant-numeric: tabular-nums;
  box-shadow: 0 0 0 3px hsl(var(--background)), 0 0 0 4px rgb(var(--gold) / .45);
}
.guide-mark-sm { width: 1.35rem; height: 1.35rem; font-size: .78rem; box-shadow: none; transform: translateY(.2em); }
.guide-step {
  flex: none; display: inline-grid; place-items: center; width: 1.75rem; height: 1.75rem;
  border-radius: 999px; border: 1.5px solid rgb(var(--teal-ink) / .45); color: rgb(var(--teal-ink));
  font-weight: 700; font-size: .9rem; font-variant-numeric: tabular-nums;
}
.guide-secno {
  flex: none; display: inline-grid; place-items: center; width: 2.6rem; height: 2.6rem;
  border-radius: .9rem; border: 1.5px solid rgb(var(--teal-ink) / .5); color: rgb(var(--teal-ink));
  font-weight: 800; font-size: 1.05rem; font-variant-numeric: tabular-nums;
}
.guide-rail { position: relative; }
.guide-rail::before {
  content: ""; position: absolute; inset-inline-start: 1.05rem; top: 1rem; bottom: 1rem;
  border-inline-start: 2px dashed hsl(var(--border));
}
@media (min-width: 900px) {
  .guide-rail::before { inset-inline: 1.5rem; top: 1.05rem; bottom: auto; border-inline-start: 0;
    border-top: 2px dashed hsl(var(--border)); }
}
.guide-stop-dot {
  position: relative; z-index: 1; flex: none; display: inline-grid; place-items: center;
  width: 2.1rem; height: 2.1rem; border-radius: 999px; font-weight: 800; font-size: .9rem;
  background: hsl(var(--background)); border: 2px solid hsl(var(--border)); color: hsl(var(--muted-foreground));
}
.guide-stop-dot[data-state="done"] { border-color: rgb(var(--teal-ink)); color: rgb(var(--teal-ink)); }
.guide-stop-dot[data-state="start"] { border-color: rgb(var(--gold)); background: rgb(var(--gold)); color: #162220; }
.guide-shot { display: block; width: 100%; cursor: zoom-in; border-radius: .7rem; overflow: hidden;
  box-shadow: 0 1px 2px rgb(0 0 0 / .08), 0 8px 24px -12px rgb(0 0 0 / .25); }
.guide-shot:focus-visible { outline: 2px solid rgb(var(--teal)); outline-offset: 3px; }
.guide-toc a[aria-current="true"] { color: rgb(var(--teal-ink)); font-weight: 800; border-inline-start-color: rgb(var(--teal-ink)); }
dialog.guide-zoom { max-width: min(96vw, 1400px); max-height: 92vh; padding: 0; border: 0; border-radius: 1rem; background: transparent; }
dialog.guide-zoom::backdrop { background: rgb(10 18 18 / .78); }
@media print {
  .guide-noprint { display: none !important; }
  body { zoom: 1 !important; }
  /* لا يُمنع قسمٌ كاملٌ من الانقسام: القسمُ بصوره أطولُ من ورقة، فكان يُدفع
     كلُّه إلى الصفحة التالية ويترك خلفه صفحةً بيضاء. والصورةُ لا تُقسم، ولا
     تطول عن ورقة — لقطةُ الخطوة الخامسة أطولُ من أربع صفحاتٍ بعرضها. */
  .guide-figure, .guide-callout { break-inside: avoid; }
  .guide-figure img { max-height: 225mm; width: auto; max-width: 100%; margin-inline: auto; }
  .guide-shot { box-shadow: none; border: 1px solid #ddd; }
  /* الصورةُ داخلَ زرِّ التكبير، وفي \`index.css\` قاعدةٌ تُخفي كلَّ زرٍّ في الطباعة —
     فخرج الدليلُ المطبوعُ نصّا بلا صورة واحدة (٣٠ سبتمبر ٢٠٢٦). والمحدِّدُ
     أثقلُ من \`button:not([aria-expanded])\` ليغلبه أينما وقع. */
  .guide-figure button.guide-shot { display: block !important; }
  a { color: inherit; text-decoration: none; }
}
`;

/* ═══ لغةُ النصّ الصغيرة: «زرّ» و[رابط](#قسم) ═══ */
const TOKEN = /(«[^»]+»|\[[^\]]+\]\([^)\s]+\))/g;

function Rich({ text }: { text: string }) {
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("«") && part.endsWith("»")) {
          /* القوسان يبقيان لقارئ الشاشة وللطباعة بالأبيض والأسود — والرقاقةُ للعين */
          return (
            <span key={i} className="guide-ui">
              <span className="sr-only">«</span>{part.slice(1, -1)}<span className="sr-only">»</span>
            </span>
          );
        }
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
        if (link) {
          const [, label, href] = link;
          const cls = "font-bold text-teal-light-ink underline decoration-teal/40 underline-offset-4 hover:decoration-teal";
          return href.startsWith("#") || href.startsWith("http")
            ? <a key={i} href={href} className={cls} {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer noopener" } : {})}>{label}</a>
            : <Link key={i} to={href} className={cls}>{label}</Link>;
        }
        return part;
      })}
    </>
  );
}

/* ═══ صورةٌ مؤطَّرة تُكبَّر — والأبعادُ من بيان اللقطات فلا تقفز الصفحة ═══ */
/** شرحُ الصورة: «١ كذا · ٢ كذا» — والرقمُ فيه دائرةٌ ذهبيّةٌ كالتي على الصورة
    نفسِها، فتُطابَق بالعين. وما لا رقمَ في أوّله يُقرأ كما هو. */
function Caption({ text }: { text: string }) {
  const parts = text.split(" · ");
  return (
    <>
      {parts.map((part, i) => {
        const m = /^(\d{1,2}) (.+)$/s.exec(part);
        return (
          <span key={i} className="me-3 inline-flex items-baseline gap-1.5">
            {m ? <><span className="guide-mark guide-mark-sm" aria-label={`الرقم ${m[1]}`}>{m[1]}</span><Rich text={m[2]} /></> : <Rich text={part} />}
          </span>
        );
      })}
    </>
  );
}

function Shot({ shot, alt, caption, onZoom }: { shot: string; alt: string; caption?: string; onZoom: (s: string, alt: string) => void }) {
  const dims = GUIDE_SHOTS[shot];
  return (
    <figure className="guide-figure mt-6">
      <Inset tone="accent" className="p-2 sm:p-3">
        <button type="button" className="guide-shot" onClick={() => onZoom(shot, alt)} aria-label={`كبّرِ الصورة: ${alt}`}>
          <img
            src={`${SHOT_DIR}/${shot}.webp`} alt={alt} loading="lazy" decoding="async"
            width={dims?.w} height={dims?.h} className="block h-auto w-full"
          />
        </button>
      </Inset>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm leading-6 text-muted-foreground">
        <span>{caption ? <Caption text={caption} /> : alt}</span>
        <span className="guide-noprint inline-flex items-center gap-1"><Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> اضغط الصورةَ لتكبيرها</span>
      </figcaption>
    </figure>
  );
}

const CALLOUT: Record<CalloutTone, { icon: typeof Lightbulb; tone: "accent" | "warn" | "positive" | "default" }> = {
  tip: { icon: Lightbulb, tone: "accent" },
  important: { icon: TriangleAlert, tone: "warn" },
  public: { icon: Globe2, tone: "positive" },
  contract: { icon: FileSignature, tone: "default" },
};

function Block({ b, onZoom }: { b: GuideBlock; onZoom: (s: string, alt: string) => void }) {
  switch (b.kind) {
    case "p":
      return <p className="mt-4 text-base leading-8"><Rich text={b.text} /></p>;
    case "list":
      return (
        <ul className="mt-4 list-disc space-y-2 ps-6 text-base leading-8 marker:text-muted-foreground">
          {b.items.map((it, i) => <li key={i}><Rich text={it} /></li>)}
        </ul>
      );
    case "steps":
      return (
        <div className="mt-5">
          {b.title && <h3 className="mb-3 text-lg font-black">{b.title}</h3>}
          <ol className="space-y-4">
            {b.items.map((it, i) => (
              <li key={i} className="flex items-start gap-3">
                {/* خطوةُ النصّ بدائرةٍ هادئة، والذهبيّةُ لأرقام الصور وحدَها — فلا
                    يُظنّ أنّ الخطوةَ «٢» هي الدائرةُ «٢» على صورةٍ لا تقابلها */}
                <span className="guide-step" aria-hidden="true">{i + 1}</span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-base leading-8"><Rich text={it.text} /></p>
                  {it.detail && <p className="mt-1 text-sm leading-7 text-muted-foreground"><Rich text={it.detail} /></p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      );
    case "figure":
      return <Shot shot={b.shot} alt={b.alt} caption={b.caption} onZoom={onZoom} />;
    case "callout": {
      const c = CALLOUT[b.tone];
      return (
        <Inset tone={c.tone} className="guide-callout mt-5 flex items-start gap-3">
          <c.icon className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-black">{b.title}</p>
            <p className="mt-1 text-base leading-8"><Rich text={b.text} /></p>
          </div>
        </Inset>
      );
    }
    case "table":
      return (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-start text-sm leading-7">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {b.head.map((h) => <th key={h} className="py-2 pe-4 text-start font-bold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, i) => (
                <tr key={i} className="border-b border-border/60 align-top">
                  {row.map((cell, j) => <td key={j} className="py-2.5 pe-4"><Rich text={cell} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function Section({ s, n, onZoom }: { s: GuideSection; n: number; onZoom: (shot: string, alt: string) => void }) {
  return (
    <section id={s.id} aria-labelledby={`${s.id}-h`} className="guide-section scroll-mt-24 border-t border-border py-10">
      <div className="flex items-start gap-3">
        <span className="guide-secno" aria-hidden="true">{n}</span>
        <div className="min-w-0">
          <h2 id={`${s.id}-h`} className="text-2xl font-black leading-snug">{s.title}</h2>
          {s.tab && s.path && (
            <p className="mt-1 text-sm text-muted-foreground">
              في بوّابتك: <Link to={s.path} className="font-bold text-teal-light-ink underline decoration-teal/40 underline-offset-4">{s.tab}</Link>
            </p>
          )}
        </div>
      </div>
      <p className="mt-4 text-base leading-8 text-muted-foreground"><Rich text={s.why} /></p>
      {s.blocks.map((b, i) => <Block key={i} b={b} onZoom={onZoom} />)}
    </section>
  );
}

/* ═══ قائمةُ الأسبوع الأوّل — تُحفظ في متصفّح القارئ وحدَه ═══ */
function FirstWeek() {
  const [done, setDone] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(safeGet(CHECK_KEY) ?? "[]") as string[]); } catch { return new Set(); }
  });
  const toggle = (id: string) => setDone((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    safeSet(CHECK_KEY, JSON.stringify([...next]));
    return next;
  });
  const required = CHECKLIST.filter((c) => !c.optional);
  const doneCount = required.filter((c) => done.has(c.id)).length;
  const pct = Math.round((doneCount / Math.max(1, required.length)) * 100);

  return (
    <Panel as="section" id="first-week" aria-labelledby="first-week-h" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="first-week-h" className="text-2xl font-black">أسبوعُك الأوّل</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            ما تفعله بعد اعتماد عقدك، بالترتيب. علِّمْ ما أنجزتَه — تبقى علاماتُك في هذا المتصفّح.
          </p>
        </div>
        <p className="text-sm font-bold tabular-nums" aria-live="polite">
          أنجزتَ {doneCount} من {required.length}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10" aria-hidden="true">
        <div className="h-full rounded-full bg-teal transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-5 space-y-2">
        {CHECKLIST.map((c) => {
          const on = done.has(c.id);
          return (
            <li key={c.id}>
              <Card className="flex items-start gap-3 p-3.5">
                <input
                  id={`chk-${c.id}`} type="checkbox" checked={on} onChange={() => toggle(c.id)}
                  className="mt-1.5 h-5 w-5 shrink-0 accent-teal"
                />
                <label htmlFor={`chk-${c.id}`} className={`min-w-0 flex-1 cursor-pointer text-base leading-8 ${on ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""}`}>
                  <Rich text={c.text} />
                  {c.optional && <span className="ms-2 text-sm text-muted-foreground">(اختياريّ)</span>}
                </label>
                <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                  <span className="text-muted-foreground tabular-nums">{c.time}</span>
                  <a href={`#${c.anchor}`} className="guide-noprint font-bold text-teal-light-ink underline decoration-teal/40 underline-offset-4">كيف؟</a>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ═══ الرحلة — من التوقيع إلى أوّل مستحقّ ═══ */
function Journey() {
  return (
    <section aria-labelledby="journey-h" className="mt-8">
      <h2 id="journey-h" className="sr-only">رحلتُك في المنصّة</h2>
      <ol className="guide-rail grid gap-3 md:grid-cols-[repeat(var(--stops),minmax(0,1fr))] md:gap-3" style={{ ["--stops" as string]: JOURNEY.length }}>
        {JOURNEY.map((stop, i) => {
          const state = i < JOURNEY_START ? "done" : i === JOURNEY_START ? "start" : "next";
          return (
            <li key={stop.title} className="flex items-start gap-3 md:flex-col md:items-center md:text-center">
              <span className="guide-stop-dot" data-state={state} aria-hidden="true">
                {state === "done" ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <a href={`#${stop.anchor}`} className="min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
                <span className="block text-sm font-black leading-6">{stop.title}</span>
                <span className="block text-sm leading-6 text-muted-foreground">{stop.detail}</span>
                {state === "start" && <span className="mt-1 inline-block text-sm font-black text-gold-ink">من هنا تبدأ</span>}
                {state === "done" && <span className="sr-only">(تمّت)</span>}
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ═══ الفهرس — يتبع موضعَ القارئ ═══ */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

function Toc({ items, active }: { items: { id: string; label: string }[]; active: string }) {
  return (
    <nav aria-label="محتويات الدليل" className="guide-toc guide-noprint">
      <p className="mb-2 flex items-center gap-2 text-sm font-black text-muted-foreground">
        <BookOpen className="h-4 w-4" aria-hidden="true" /> محتويات الدليل
      </p>
      <ol className="space-y-0.5 text-sm">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              aria-current={active === it.id ? "true" : undefined}
              className="block border-s-2 border-transparent py-1.5 ps-3 leading-6 text-muted-foreground hover:text-foreground"
            >
              {it.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function TrainerGuide() {
  const [zoom, setZoom] = useState<{ shot: string; alt: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const openZoom = useCallback((shot: string, alt: string) => setZoom({ shot, alt }), []);
  /* رقمُ الإدارة من إعداداتها لا مكتوبٌ هنا — والمدمجُ رجوعٌ وحدَه */
  const waLink = waHref(useWhatsAppNumbers(), 'advisor', CONTACT.whatsapp, 'مرحبا، أنا مدرّبٌ في وجيز وأقرأ دليلَ المدرّب، وعندي سؤال:');

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (zoom && !d.open) d.showModal();
    if (!zoom && d.open) d.close();
  }, [zoom]);

  /* الطباعةُ تفتح الأسئلةَ كلَّها — ورقةٌ مطويّةُ الأجوبة لا تُقرأ */
  useEffect(() => {
    const open = () => document.querySelectorAll<HTMLDetailsElement>("details").forEach((d) => { d.open = true; });
    window.addEventListener("beforeprint", open);
    return () => window.removeEventListener("beforeprint", open);
  }, []);

  const tocItems = useMemo(() => [
    { id: "first-week", label: "أسبوعُك الأوّل" },
    ...GUIDE_SECTIONS.map((s, i) => ({ id: s.id, label: `${i + 1}. ${s.title}` })),
    { id: "faq", label: "أسئلةٌ شائعة" },
    { id: "help", label: "تحتاج مساعدة؟" },
  ], []);
  const ids = useMemo(() => tocItems.map((t) => t.id), [tocItems]);
  const active = useActiveSection(ids);

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <SeoHead
        title="دليلُ المدرّب"
        description="كلُّ ما يفعله مدرّبُ أكاديمية وجيز في بوّابته بعد اعتماد عقده — خطوةً خطوة، بصورٍ من المنصّة."
        path={TRAINER_GUIDE_PATH}
        noindex
      />
      <style>{CSS}</style>

      <header className="guide-noprint sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-2.5">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 shrink-0 object-contain" />
            <span className="truncate font-black"><span className="hidden sm:inline">وجيز | </span>دليلُ المدرّب</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Button as={Link} to="/trainer" tone="primary" icon={LayoutDashboard}>افتح بوّابتك</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-16">
        {/* ── الصدر ── */}
        <section className="pt-10 md:pt-14">
          <h1 className="guide-hand text-5xl leading-[1.5] md:text-6xl">دليلُ المدرّب</h1>
          <p className="mt-2 max-w-2xl text-lg leading-9 text-muted-foreground">
            من الألف إلى الياء: كلُّ ما تفعله في بوّابتك بعد اعتماد عقدك، خطوةً خطوة، بصورٍ من المنصّة
            نفسِها، فتعرف أين كلُّ زرٍّ قبل أن تبحث عنه.
          </p>
          <div className="guide-noprint mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button icon={Printer} onClick={() => window.print()}>اطبعه أو احفظه PDF</Button>
            <span className="text-sm text-muted-foreground">حُدِّث في {GUIDE_UPDATED_AR}</span>
            <span className="text-sm text-muted-foreground">{GUIDE_READ_TIME_AR}</span>
          </div>
        </section>

        <Journey />

        {/* ── المحتوى والفهرس ── */}
        <div className="mt-10 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6">
              <Toc items={tocItems} active={active} />
            </div>
          </aside>

          <article className="min-w-0 max-w-3xl">
            {/* على الهاتف: فهرسٌ يُطوى في رأس المقال */}
            <details className="guide-noprint mb-6 lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-1 py-2 font-black">
                <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" aria-hidden="true" /> محتويات الدليل</span>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </summary>
              <div className="mt-3"><Toc items={tocItems} active={active} /></div>
            </details>

            <FirstWeek />

            {GUIDE_SECTIONS.map((s, i) => <Section key={s.id} s={s} n={i + 1} onZoom={openZoom} />)}

            {/* ── أسئلةٌ شائعة ── */}
            <section id="faq" aria-labelledby="faq-h" className="guide-section scroll-mt-24 border-t border-border py-10">
              <h2 id="faq-h" className="text-2xl font-black">أسئلةٌ شائعة</h2>
              <div className="mt-5 space-y-2">
                {FAQ.map((f) => (
                  <Card as="details" key={f.q} className="group p-0">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 text-base font-bold leading-7">
                      <span>{f.q}</span>
                      <ChevronDown className="mt-1.5 h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <p className="px-4 pb-4 text-base leading-8 text-muted-foreground"><Rich text={f.a} /></p>
                  </Card>
                ))}
              </div>
            </section>

            {/* ── المساعدة ── */}
            <Panel as="section" id="help" aria-labelledby="help-h" tone="accent" className="scroll-mt-24">
              <h2 id="help-h" className="flex items-center gap-2 text-2xl font-black">
                <LifeBuoy className="h-6 w-6 text-teal-light-ink" aria-hidden="true" /> تحتاج مساعدة؟
              </h2>
              <p className="mt-2 text-base leading-8">
                إن وقفتَ عند خطوةٍ لم يشرحها هذا الدليل، أو أردتَ من يمشي معك في إعداد موادّك، فنحن هنا.
              </p>
              <div className="guide-noprint mt-4 flex flex-wrap gap-2">
                <Button as="a" href={ORIENTATION_BOOKING_URL} target="_blank" rel="noreferrer noopener" icon={CalendarPlus}>
                  {ORIENTATION_CTA_AR}
                </Button>
                {waLink && (
                  <Button as="a" href={waLink} target="_blank" rel="noreferrer noopener" icon={MessageCircle}>
                    راسِلنا على واتساب
                  </Button>
                )}
                <Button as="a" href={`mailto:${CONTACT.email}`} icon={Mail}>{CONTACT.email}</Button>
              </div>
            </Panel>
          </article>
        </div>
      </div>

      {/* ── تكبيرُ الصورة ── */}
      <dialog
        ref={dialogRef}
        className="guide-zoom guide-noprint"
        aria-label={zoom?.alt ?? "صورة مكبّرة"}
        onClose={() => setZoom(null)}
        onClick={(e) => { if (e.target === e.currentTarget) setZoom(null); }}
      >
        {zoom && (
          <div className="relative">
            <img src={`${SHOT_DIR}/${zoom.shot}.webp`} alt={zoom.alt} className="block h-auto max-h-[90vh] w-auto max-w-full rounded-xl" />
            <Button tone="secondary" size="sm" icon={X} onClick={() => setZoom(null)} className="absolute top-3 left-3">أغلق</Button>
          </div>
        )}
      </dialog>
    </div>
  );
}

