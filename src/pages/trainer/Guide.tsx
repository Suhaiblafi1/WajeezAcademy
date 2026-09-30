/* دليلُ المدرّب — من الألف إلى الياء (٢٩ سبتمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: رسالةُ اعتماد التوقيع تحمل رابطا إلى دليلٍ «يرشدهم لما
   يجب أن يفعله المدرّب داخل منصّته من الألف إلى الياء… لا تترك تفصيلة،
   واجعلها سهلةَ القراءة، واترك صورا من المنصّة لترشده». والمسارُ وعلّةُ كونه
   عامّا في `application/trainer/trainer-guide.ts`، والمحتوى في
   `data/trainer-guide/` — هذا الملفُّ يعرضه ولا يكتبه.

   ═══ والتصميمُ على مثالٍ أرسله صاحبُ المنصّة (٣٠ سبتمبر ٢٠٢٦) ═══

   «التصميم غير جميل! تعلّم من هذا الملفّ وقلّده» — والمثالُ دليلُ منصّةٍ
   بصفحاتٍ طوليّة. ما أُخذ منه لغتُه لا علامتُه، وبألوان وجيز:

   · **ورقٌ كريميٌّ وحبرٌ أخضرُ داكن**، وأربعةُ ألوانٍ للتمييز لا للزينة:
     سماويٌّ، ومرجانيّ، وذهبيّ، ووردي. وكلُّ قسمٍ يأخذ لونا من الأربعة
     بالتناوب، فمربّعُ رقمه وشارةُ «القسم» بلونٍ واحد.
   · **رأسُ كلّ قسمٍ كرأس صفحة**: مربّعُ رقمٍ، ثمّ عنوانٌ كبير، ثمّ شارةٌ
     وسطرٌ يقول لماذا يُفتح هذا الباب — وفي زاويته مربّعاتٌ سماويّة.
   · **«انتبه» و«نصيحة» بطاقتان بشريطٍ جانبيّ** ولونُ الشريط هو المعنى:
     المرجانيُّ لما يُكلِّف، والحبرُ لما يوفّر. وتتجاوران حين تتتاليان.
   · **شريطٌ داكنٌ لجملةٍ واحدةٍ مفتاحيّة**، و**قائمةٌ بمربّعاتِ تعليم**،
     و**صفحةُ ختامٍ ملوّنة**.
   · **والمطبوعُ صفحاتٌ كالمثال**: كلُّ قسمٍ يبدأ صفحتَه، وفي ذيلها اسمُ
     الدليل ورقمُ الصفحة.

   وبقي من التصميم السابق ما لا يعارضه: فهرسٌ ثابتٌ يتبع موضعَ القارئ،
   وأرقامٌ ذهبيّةٌ مستديرةٌ على الصور تقابل شرحَها — والمستديرُ الذهبيُّ لها
   وحدَها، فخطواتُ النصّ مربّعات، لئلّا يُظنّ أنّ الخطوةَ «٢» هي الدائرةُ
   «٢» على صورةٍ لا تقابلها.

   ═══ وما لا يفعله ═══

   لا يطلب دخولا (يُفتح من البريد على أيّ جهاز)، ولا يحفظ عند الخادم شيئا:
   علاماتُ القائمة في متصفّح القارئ وحدَه (`safe-storage`)، وضياعُها لا يمسّ
   شيئا في حسابه. ويُطبَع كاملا: الأسئلةُ تُفتح قبل الطباعة، والشريطُ يُخفى. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  BookOpen, CalendarPlus, Check, ChevronDown, FileSignature, Globe2, LayoutDashboard,
  ExternalLink, Info, LifeBuoy, Mail, Maximize2, MessageCircle, Printer, X,
} from "lucide-react";
import SeoHead from "@/components/SeoHead";
import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";
import { safeGet, safeSet } from "@/services/safe-storage";
import { CONTACT } from "@/data/stories";
import { waHref } from "@/application/site/whatsapp";
import { useWhatsAppNumbers } from "@/services/whatsapp";
import { ORIENTATION_BOOKING_URL, ORIENTATION_CTA_AR } from "@/application/trainer/orientation-session";
import { TRAINER_GUIDE_PATH } from "@/application/trainer/trainer-guide";
import {
  CHECKLIST, FAQ, GUIDE_PARTS, GUIDE_READ_TIME_AR, GUIDE_SECTIONS, GUIDE_UPDATED_AR, JOURNEY, JOURNEY_START,
  shortTitle,
} from "@/data/trainer-guide/content";
import { GUIDE_SHOTS } from "@/data/trainer-guide/shots";
import type { CalloutTone, GuideBlock, GuideSection } from "@/data/trainer-guide/types";

/** مكانُ الصور — تولّدها `scripts/trainer-guide/capture.ts` */
const SHOT_DIR = "/guides/trainer";
const CHECK_KEY = "wajeez.trainer-guide.checklist.v1";

/** ألوانُ التمييز الأربعة بالتناوب — مربّعُ الرقم وشارةُ القسم بلونٍ واحد */
const HUES = ["amber", "coral", "sky", "blush"] as const;
type Hue = (typeof HUES)[number];
const hueOf = (i: number): Hue => HUES[i % HUES.length];
const pad2 = (n: number) => String(n).padStart(2, "0");

/* ═══ الأنماطُ الخاصّة بالدليل ═══

   ألوانُ الدليل متغيّراتٌ على `.guide-root`: الداكنُ افتراضُ الموقع، والفاتحُ
   تحت `html[data-theme="light"]` كسائر السمات — والطباعةُ فاتحةٌ دائما. */
const CSS = `
.guide-root {
  --g-paper: 16 27 27; --g-card: 24 38 38; --g-line: 44 64 63;
  --g-ink: 226 238 235; --g-deep: 13 55 57; --g-on-deep: 240 247 245;
  --g-sky: 110 199 209; --g-coral: 191 82 70; --g-amber: 250 188 5; --g-blush: 240 195 191;
  --g-dark-ink: 15 63 59;
  background: rgb(var(--g-paper));
}
html[data-theme="light"] .guide-root {
  --g-paper: 244 242 231; --g-card: 255 255 255; --g-line: 226 222 207;
  --g-ink: 15 63 59; --g-deep: 15 63 59; --g-on-deep: 255 255 255;
}
.guide-h { color: rgb(var(--g-ink)); font-weight: 800; letter-spacing: -.01em; }
.guide-card { background: rgb(var(--g-card)); border: 1px solid rgb(var(--g-line)); border-radius: .75rem; }
.guide-deep { background: rgb(var(--g-deep)); color: rgb(var(--g-on-deep)); border-radius: .5rem; }
.guide-blush { background: rgb(var(--g-blush)); color: rgb(var(--g-dark-ink)); border-radius: .5rem; }

/* مربّعُ الرقم وشارتُه — بلون القسم، والحبرُ عليه بما يُقرأ */
.guide-sq {
  flex: none; display: inline-grid; place-items: center; min-width: 2.25rem; height: 2.25rem; padding: 0 .35rem;
  font-weight: 800; font-size: .95rem; font-variant-numeric: tabular-nums; border-radius: .2rem;
}
.guide-sq-sm { min-width: 1.6rem; height: 1.6rem; font-size: .8rem; }
.guide-pill { display: inline-flex; align-items: center; gap: .4rem; padding: .3rem .9rem; border-radius: .4rem;
  font-weight: 800; font-size: .88rem; white-space: nowrap; }
[data-hue="amber"] { background: rgb(var(--g-amber)); color: rgb(var(--g-dark-ink)); }
[data-hue="coral"] { background: rgb(var(--g-coral)); color: #fff; }
[data-hue="sky"] { background: rgb(var(--g-sky)); color: rgb(var(--g-dark-ink)); }
[data-hue="blush"] { background: rgb(var(--g-blush)); color: rgb(var(--g-dark-ink)); }

/* المربّعاتُ الزخرفيّة — شكلان من المثال: «V» في أعلى اليسار، ودرجٌ في أسفل اليمين.
   وجهتاهما مادّيّتان (left/right) لا منطقيّتان: الشبكةُ ltr لتثبت صورتُها،
   فـ\`end\` فيها يمينٌ — وبه وقعت المربّعاتُ فوق العنوان أوّلَ مرّة. */
.guide-px { display: grid; grid-template-columns: repeat(3, var(--px)); grid-auto-rows: var(--px); pointer-events: none; }
.guide-px > i { display: block; }

/* رقاقةُ اسم الزرّ — كما في البوّابة */
.guide-ui {
  display: inline-block; padding: 0 .45em; margin: 0 .1em; border-radius: .4em;
  border: 1px solid rgb(var(--g-line)); background: rgb(var(--g-card));
  font-weight: 700; font-size: .92em; line-height: 1.7; white-space: nowrap;
}
/* دائرةُ المؤشّر الذهبيّة — على الصورة وفي شرحها وحدَهما */
.guide-mark {
  flex: none; display: inline-grid; place-items: center; width: 1.35rem; height: 1.35rem;
  border-radius: 999px; background: rgb(var(--g-amber)); color: #162220;
  font-weight: 800; font-size: .78rem; font-variant-numeric: tabular-nums; transform: translateY(.2em);
}
.guide-list > li { position: relative; padding-inline-start: 1.25rem; }
.guide-list > li::before { content: ""; position: absolute; inset-inline-start: .15rem; top: .8em;
  width: .42rem; height: .42rem; border-radius: 999px; background: rgb(var(--g-coral)); }

.guide-shot { display: block; width: 100%; cursor: zoom-in; border-radius: .5rem; overflow: hidden; }
.guide-shot-tag { position: absolute; z-index: 1; top: .9rem; inset-inline-start: .9rem; padding: .1rem .55rem;
  border-radius: .35rem; font-size: .72rem; font-weight: 800; pointer-events: none;
  background: rgb(var(--g-deep)); color: rgb(var(--g-on-deep)); opacity: .92; }
.guide-shot:focus-visible { outline: 2px solid rgb(var(--g-sky)); outline-offset: 3px; }

/* «انتبه» و«نصيحة»: بطاقةٌ بشريطٍ جانبيٍّ لونُه معناه */
.guide-callout { border-inline-end-width: 6px; }
.guide-callout[data-tone="important"] { border-inline-end-color: rgb(var(--g-coral)); }
.guide-callout[data-tone="tip"] { border-inline-end-color: rgb(var(--g-sky)); }
.guide-callout[data-tone="public"] { border-inline-end-color: rgb(var(--g-amber)); }
.guide-callout[data-tone="contract"] { border-inline-end-color: rgb(var(--g-ink)); }
.guide-dot { flex: none; display: inline-grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 999px; }

/* مربّعُ التعليم في القائمة — مربّعٌ كالمثال لا مربّعُ المتصفّح */
.guide-check {
  appearance: none; flex: none; width: 1.6rem; height: 1.6rem; margin: .2rem 0 0; cursor: pointer;
  border: 2px solid rgb(var(--g-ink)); border-radius: .4rem; background: transparent;
  display: inline-grid; place-items: center;
}
.guide-check:checked { background: rgb(var(--g-ink)); }
.guide-check:checked::after { content: ""; width: .45rem; height: .8rem; margin-top: -.15rem;
  border: solid rgb(var(--g-card)); border-width: 0 .18rem .18rem 0; transform: rotate(45deg); }
.guide-check:focus-visible { outline: 2px solid rgb(var(--g-sky)); outline-offset: 2px; }

.guide-toc a[aria-current="true"] { color: rgb(var(--g-ink)); font-weight: 800; border-inline-start-color: rgb(var(--g-coral)); }
dialog.guide-zoom { max-width: min(96vw, 1400px); max-height: 92vh; padding: 0; border: 0; border-radius: 1rem; background: transparent; }
dialog.guide-zoom::backdrop { background: rgb(10 18 18 / .78); }

@page {
  size: A4; margin: 14mm 12mm 16mm; background: #F4F2E7;
  @bottom-left { content: "دليلُ المدرّب  |  " counter(page); font-size: 8pt; color: #5b6b68; }
}
@media print {
  .guide-noprint { display: none !important; }
  body { zoom: 1 !important; }
  .guide-root, html[data-theme="light"] .guide-root {
    --g-paper: 244 242 231; --g-card: 255 255 255; --g-line: 226 222 207;
    --g-ink: 15 63 59; --g-deep: 15 63 59; --g-on-deep: 255 255 255;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    background: rgb(var(--g-paper)) !important; color: #16211f !important;
  }
  /* كلُّ قسمٍ يبدأ صفحتَه كالمثال — ولا يُمنع من الانقسام، فالقسمُ بصوره
     أطولُ من ورقة، ومنعُه كان يدفعه كلَّه ويترك خلفه صفحةً بيضاء */
  .guide-page { break-before: page; }
  .guide-cover { min-height: 262mm; }
  .guide-end { min-height: 262mm; display: grid; place-items: center; }
  .guide-figure, .guide-callout { break-inside: avoid; }
  .guide-figure img { max-height: 225mm; width: auto; max-width: 100%; margin-inline: auto; }
  /* الصورةُ داخلَ زرِّ التكبير، وفي \`index.css\` قاعدةٌ تُخفي كلَّ زرٍّ في الطباعة —
     فخرج الدليلُ المطبوعُ نصّا بلا صورة واحدة (٣٠ سبتمبر ٢٠٢٦). والمحدِّدُ
     أثقلُ من \`button:not([aria-expanded])\` ليغلبه أينما وقع. */
  .guide-figure button.guide-shot { display: block !important; }
  /* ومربّعاتُ القائمة تُطبع فارغةً تُعلَّم بالقلم — والقاعدةُ نفسُها تُخفي كلَّ حقل */
  .guide-root input.guide-check { display: inline-grid !important; }
  /* ═══ وألوانُ الدليل تُعاد بعد تسطيح الموقع ═══
     \`index.css\` يُسطِّح في الطباعة كلَّ سطحٍ (\`* { background-color: transparent
     !important; color: #111 !important }\`) — وهو صوابٌ لشاشات الإدارة الداكنة،
     وخطأٌ هنا: الدليلُ المطبوعُ على مثال صاحب المنصّة ورقٌ ملوّن. فخرج الغلافُ
     والمربّعاتُ والأشرطةُ بيضاءَ كلُّها. والقاعدةُ هناك بلا خصوصيّة، فأيُّ صنفٍ
     هنا مع \`!important\` يغلبها. */
  .guide-root [data-hue="amber"] { background-color: rgb(var(--g-amber)) !important; }
  .guide-root [data-hue="coral"] { background-color: rgb(var(--g-coral)) !important; }
  .guide-root [data-hue="sky"] { background-color: rgb(var(--g-sky)) !important; }
  .guide-root [data-hue="blush"] { background-color: rgb(var(--g-blush)) !important; }
  .guide-root [data-hue="coral"], .guide-root [data-hue="coral"] * { color: #fff !important; }
  .guide-root .guide-deep { background-color: rgb(var(--g-deep)) !important; }
  .guide-root .guide-deep, .guide-root .guide-deep * { color: #fff !important; }
  .guide-root .guide-blush { background-color: rgb(var(--g-blush)) !important; }
  .guide-root .guide-card, .guide-root .guide-ui { background-color: #fff !important; border-color: rgb(var(--g-line)) !important; }
  .guide-root .guide-callout[data-tone="important"] { border-inline-end-color: rgb(var(--g-coral)) !important; }
  .guide-root .guide-callout[data-tone="tip"] { border-inline-end-color: rgb(var(--g-sky)) !important; }
  .guide-root .guide-callout[data-tone="public"] { border-inline-end-color: rgb(var(--g-amber)) !important; }
  .guide-root .guide-callout[data-tone="contract"] { border-inline-end-color: rgb(var(--g-ink)) !important; }
  .guide-root .guide-h, .guide-root .guide-h * { color: rgb(var(--g-ink)) !important; }
  .guide-root .guide-deep .guide-h { color: #fff !important; }
  .guide-root .guide-mark { background-color: rgb(var(--g-amber)) !important; }
  .guide-root .guide-list > li::before { background-color: rgb(var(--g-coral)) !important; }
  .guide-root .guide-check { border-color: rgb(var(--g-ink)) !important; }
  .guide-root .guide-dot[style] { background-color: rgb(var(--g-ink)) !important; color: #fff !important; }
  a { color: inherit; text-decoration: none; }
}
`;

/* ═══ لغةُ النصّ الصغيرة: «زرّ» و[رابط](#قسم) ═══ */
const TOKEN = /(«[^»]+»|\[[^\]]+\]\([^)\s]+\))/g;
const LINK = "font-bold text-teal-light-ink underline decoration-teal/40 underline-offset-4 hover:decoration-teal";

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
          /* ما خرج من الدليل — إلى البوّابة أو خارج الموقع — يُفتح في لسانٍ آخر،
             فيبقى الدليلُ بجانب ما يشرحه. والمرساةُ (#قسم) تبقى في الصفحة. */
          return href.startsWith("#")
            ? <a key={i} href={href} className={LINK}>{label}</a>
            : <a key={i} href={href} className={LINK} target="_blank" rel={href.startsWith("http") ? "noreferrer noopener" : "noopener"}>{label}</a>;
        }
        return part;
      })}
    </>
  );
}

/* ═══ المربّعاتُ الزخرفيّة ═══ */
const PX_SHAPES = {
  /** «V» — رأسُ الصفحة في المثال */
  v: [0, 2, 4],
  /** درجٌ — زاويةُ الصفحة */
  stair: [2, 4, 6, 8],
} as const;

function Pixels({ shape, hue, size = "1.6rem", className = "" }: { shape: keyof typeof PX_SHAPES; hue: Hue; size?: string; className?: string }) {
  const on = new Set<number>(PX_SHAPES[shape]);
  const cells = shape === "v" ? 6 : 9;
  return (
    <div aria-hidden="true" dir="ltr" className={`guide-px ${className}`} style={{ ["--px" as string]: size }}>
      {Array.from({ length: cells }, (_, i) => <i key={i} data-hue={on.has(i) ? hue : undefined} />)}
    </div>
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
            {m ? <><span className="guide-mark" aria-label={`الرقم ${m[1]}`}>{m[1]}</span><Rich text={m[2]} /></> : <Rich text={part} />}
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
      <div className="guide-card relative p-2">
        <span className="guide-shot-tag" aria-hidden="true">صورةٌ للتوضيح</span>
        <button type="button" className="guide-shot" onClick={() => onZoom(shot, alt)} aria-label={`كبّرِ الصورة: ${alt}`}>
          <img
            src={`${SHOT_DIR}/${shot}.webp`} alt={alt} loading="lazy" decoding="async"
            width={dims?.w} height={dims?.h} className="block h-auto w-full"
          />
        </button>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm leading-6 text-muted-foreground">
        <span>{caption ? <Caption text={caption} /> : alt}</span>
        <span className="guide-noprint inline-flex items-center gap-1"><Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> اضغط الصورةَ لتكبيرها</span>
      </figcaption>
    </figure>
  );
}

/* ═══ «انتبه» و«نصيحة» — والعنوانُ الصغيرُ فوق عنوانها يقول نوعَها ═══ */
const CALLOUT: Record<CalloutTone, { label: string; hue: Hue | "ink"; icon: "!" | typeof Check }> = {
  important: { label: "انتبه", hue: "coral", icon: "!" },
  tip: { label: "نصيحة", hue: "ink", icon: Check },
  public: { label: "يراه الناس", hue: "amber", icon: Globe2 },
  contract: { label: "من عقدك", hue: "sky", icon: FileSignature },
};

function Callout({ b }: { b: Extract<GuideBlock, { kind: "callout" }> }) {
  const c = CALLOUT[b.tone];
  const Icon = c.icon;
  return (
    <div className="guide-card guide-callout flex h-full items-start gap-3 p-4" data-tone={b.tone}>
      <span
        className="guide-dot text-base font-black"
        {...(c.hue === "ink"
          ? { style: { background: "rgb(var(--g-ink))", color: "rgb(var(--g-card))" } }
          : { "data-hue": c.hue })}
        aria-hidden="true"
      >
        {Icon === "!" ? "!" : <Icon className="h-4 w-4" strokeWidth={3} />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-muted-foreground">{c.label}</p>
        <p className="guide-h mt-0.5 text-base leading-7">{b.title}</p>
        <p className="mt-1 text-base leading-8"><Rich text={b.text} /></p>
      </div>
    </div>
  );
}

function Block({ b, onZoom }: { b: GuideBlock; onZoom: (s: string, alt: string) => void }) {
  switch (b.kind) {
    case "p":
      return <p className="mt-4 text-base leading-8"><Rich text={b.text} /></p>;
    case "list":
      return (
        <ul className="guide-list mt-4 space-y-2 text-base leading-8">
          {b.items.map((it, i) => <li key={i}><Rich text={it} /></li>)}
        </ul>
      );
    case "steps":
      return (
        <div className="mt-7">
          {b.title && <h3 className="mb-4"><span className="guide-pill whitespace-normal" data-hue="sky">{b.title}</span></h3>}
          <ol className="space-y-4">
            {b.items.map((it, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="guide-sq guide-sq-sm mt-1" style={{ border: "1.5px solid rgb(var(--g-ink) / .5)", color: "rgb(var(--g-ink))" }} aria-hidden="true">{i + 1}</span>
                <div className="min-w-0">
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
    case "callout":
      return <div className="mt-6"><Callout b={b} /></div>;
    case "table":
      return (
        <div className="guide-card mt-6 overflow-x-auto p-0">
          <table className="w-full min-w-[32rem] text-start text-sm leading-7">
            <thead>
              <tr className="guide-deep" style={{ borderRadius: 0 }}>
                {b.head.map((h) => <th key={h} className="px-4 py-2.5 text-start font-bold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, i) => (
                <tr key={i} className="align-top" style={{ borderTop: i ? "1px solid rgb(var(--g-line))" : undefined }}>
                  {row.map((cell, j) => <td key={j} className="px-4 py-2.5"><Rich text={cell} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/** كتلُ القسم بترتيبها — و«انتبه»/«نصيحة» المتتاليتان تتجاوران كالمثال */
function Blocks({ blocks, onZoom }: { blocks: GuideBlock[]; onZoom: (s: string, alt: string) => void }) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.kind === "callout" && blocks[i + 1]?.kind === "callout") {
      const run: Extract<GuideBlock, { kind: "callout" }>[] = [];
      while (blocks[i]?.kind === "callout") run.push(blocks[i++] as Extract<GuideBlock, { kind: "callout" }>);
      i--;
      out.push(
        <div key={i} className="mt-6 grid gap-4 sm:grid-cols-2">
          {run.map((c, j) => <Callout key={j} b={c} />)}
        </div>,
      );
    } else {
      out.push(<Block key={i} b={b} onZoom={onZoom} />);
    }
  }
  return <>{out}</>;
}

/* ═══ رأسُ القسم كرأس صفحةٍ في المثال ═══ */
function PageHead({ id, n, hue, title, children }: { id: string; n?: number; hue: Hue; title: string; children?: React.ReactNode }) {
  return (
    <div className="relative">
      <Pixels shape="v" hue="sky" size="1.1rem" className="absolute top-0 left-0" />
      {n !== undefined && <span className="guide-sq" data-hue={hue} aria-hidden="true">{pad2(n)}</span>}
      <h2 id={`${id}-h`} className={`guide-h text-3xl leading-snug md:text-4xl ${n !== undefined ? "mt-3" : "pt-6"}`}>
        {n !== undefined && <span className="sr-only">{n}. </span>}{title}
      </h2>
      {children}
    </div>
  );
}

function Section({ s, n, onZoom }: { s: GuideSection; n: number; onZoom: (shot: string, alt: string) => void }) {
  const hue = hueOf(n - 1);
  return (
    <section id={s.id} aria-labelledby={`${s.id}-h`} className="guide-section guide-page scroll-mt-24 pt-16">
      <PageHead id={s.id} n={n} hue={hue} title={s.title}>
        <div className="mt-4 flex flex-wrap items-start gap-x-4 gap-y-2">
          <span className="guide-pill" data-hue={hue}>القسم {pad2(n)}</span>
          {s.tab && s.path && (
            <a href={s.path} target="_blank" rel="noopener" className="guide-pill guide-card guide-noprint" style={{ color: "rgb(var(--g-ink))" }}>
              افتح «{s.tab}» في بوّابتك <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
        <p className="mt-3 text-lg leading-9 text-muted-foreground"><Rich text={s.why} /></p>
      </PageHead>
      <Blocks blocks={s.blocks} onZoom={onZoom} />
    </section>
  );
}

/* ═══ الغلاف ═══ */
function Cover() {
  return (
    <section className="guide-cover relative overflow-hidden" data-hue="sky" aria-labelledby="guide-title">
      <Pixels shape="v" hue="blush" size="2.2rem" className="absolute top-0 left-8 md:left-16" />
      <Pixels shape="stair" hue="amber" size="1.6rem" className="absolute bottom-0 right-0" />
      <div className="relative mx-auto flex max-w-6xl flex-col items-start px-5 pb-20 pt-24 md:pt-28">
        <span className="grid h-20 w-20 place-items-center rounded-2xl bg-white shadow-sm">
          <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-14 w-14 object-contain" />
        </span>
        <h1 id="guide-title" className="mt-8 text-5xl font-black leading-tight md:text-6xl" style={{ color: "rgb(var(--g-dark-ink))" }}>
          دليلُ المدرّب
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-9" style={{ color: "rgb(var(--g-dark-ink))" }}>
          دليلٌ يرشدك كيف تهيّئ بوّابتك وتعمل فيها — من اعتماد عقدك إلى أوّل كشفِ مستحقّاتك، خطوةً خطوة.
        </p>
        {/* ═══ الدليلُ ليس البوّابة (٣٠ سبتمبر ٢٠٢٦) ═══
            صاحبُ المنصّة: «أخشى أن يعتقد أنّ هذا هو المنصّةُ نفسُها». فالصفحةُ
            مملوءةٌ بصورٍ من البوّابة، ومن يرى زرّا يضغطه. فيقولها الغلافُ صريحة،
            ويقولها رأسُ الصفحة الثابت، وتحمل كلُّ صورةٍ وسمَها «صورةٌ للتوضيح»،
            وكلُّ رابطٍ إلى البوّابة يُفتح في لسانٍ آخر فيبقى الدليلُ بجانبها. */}
        <div className="mt-6 flex max-w-2xl items-start gap-3 rounded-xl bg-white/85 px-5 py-4 text-base leading-8" style={{ color: "rgb(var(--g-dark-ink))" }}>
          <Info className="mt-1.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>
            هذه صفحةُ شرحٍ، لا بوّابتُك. الصورُ فيها للتوضيح ولا تعمل أزرارُها — والعملُ نفسُه في
            بوّابتك: افتحها في لسانٍ بجانب هذا الدليل، واتبع الخطواتِ فيها.
          </p>
        </div>
        <div className="guide-noprint mt-7 flex flex-wrap items-center gap-3">
          {/* و«افتح بوّابتك» في الرأس وحدَه: ذهبيٌّ واحدٌ في الشاشة */}
          <Button icon={Printer} onClick={() => window.print()}>اطبعه أو احفظه PDF</Button>
        </div>
        <p className="mt-5 text-sm leading-7" style={{ color: "rgb(var(--g-dark-ink) / .8)" }}>
          حُدِّث في {GUIDE_UPDATED_AR} · {GUIDE_READ_TIME_AR}
        </p>
      </div>
    </section>
  );
}

/* ═══ رحلتُك — محطّاتٌ مرقّمةٌ في شبكة، كصفحة «رحلتك في المنصّة» ═══ */
function Journey() {
  return (
    <section id="journey" aria-labelledby="journey-h" className="guide-page scroll-mt-24 pt-14">
      <PageHead id="journey" hue="sky" title="رحلتُك في المنصّة" />
      <p className="guide-deep mt-6 px-6 py-5 text-lg leading-9">
        ثماني محطّاتٍ من توقيع عقدك إلى أوّل مستحقّاتك. أنجزتَ اثنتين، ومن الثالثة تبدأ — وكلُّ محطّةٍ مشروحةٌ في أقسام الدليل.
      </p>
      <ol className="mt-6 grid gap-4 sm:grid-cols-2">
        {JOURNEY.map((stop, i) => {
          const state = i < JOURNEY_START ? "done" : i === JOURNEY_START ? "start" : "next";
          return (
            <li key={stop.title}>
              <a
                href={`#${stop.anchor}`}
                className="guide-card flex h-full items-start gap-3 p-4 transition-colors hover:border-[rgb(var(--g-ink)/.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                style={state === "start" ? { borderColor: "rgb(var(--g-amber))", boxShadow: "0 0 0 1px rgb(var(--g-amber))" } : undefined}
              >
                <span className="guide-sq" data-hue={hueOf(i)} aria-hidden="true">
                  {state === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : pad2(i + 1)}
                </span>
                <span className="min-w-0">
                  <span className="guide-h block text-base leading-7">{stop.title}</span>
                  <span className="mt-0.5 block text-sm leading-6 text-muted-foreground">{stop.detail}</span>
                  {state === "start" && <span className="mt-1 inline-block text-sm font-black text-gold-ink">من هنا تبدأ</span>}
                  {state === "done" && <span className="mt-1 inline-block text-sm text-muted-foreground">تمّت</span>}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      <p className="guide-blush mt-6 px-6 py-4 text-center text-base font-bold leading-8">
        مهلتُك لإعداد موادّ دوراتك خمسةُ أيّامٍ تبدأ من اعتماد توقيعك — فابدأ بها قبل كلّ شيء.
      </p>
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

  return (
    <section id="first-week" aria-labelledby="first-week-h" className="guide-page scroll-mt-24 pt-16">
      <PageHead id="first-week" hue="coral" title="أسبوعُك الأوّل" />
      <div className="guide-deep mt-6 flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <p className="text-lg leading-9">ما تفعله بعد اعتماد عقدك، بالترتيب. علِّمْ ما أنجزتَه — تبقى علاماتُك في هذا المتصفّح.</p>
        <p className="guide-noprint shrink-0 text-base font-black tabular-nums" aria-live="polite">أنجزتَ {doneCount} من {required.length}</p>
      </div>
      <ul className="guide-card mt-6 px-5 py-1">
        {CHECKLIST.map((c, i) => {
          const on = done.has(c.id);
          return (
            <li key={c.id} className="flex items-start gap-4 py-4" style={{ borderTop: i ? "1px solid rgb(var(--g-line))" : undefined }}>
              <input id={`chk-${c.id}`} type="checkbox" checked={on} onChange={() => toggle(c.id)} className="guide-check" />
              <label htmlFor={`chk-${c.id}`} className={`min-w-0 flex-1 cursor-pointer text-base leading-8 ${on ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""}`}>
                <Rich text={c.text} />
                {c.optional && <span className="ms-2 text-sm text-muted-foreground">(اختياريّ)</span>}
              </label>
              <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                <span className="text-muted-foreground tabular-nums">{c.time}</span>
                <a href={`#${c.anchor}`} className={`guide-noprint ${LINK}`}>كيف؟</a>
              </div>
            </li>
          );
        })}
      </ul>
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

type TocItem = { id: string; label: string; n?: number };
type TocGroup = { title: string; items: TocItem[] };

/** الفهرسُ أجزاءٌ بعناوين، وتحت كلٍّ أسماءُ أقسامه قصيرةً في سطرٍ واحد —
    لا تسعةَ عشرَ عنوانا طويلا يلتفّ كلٌّ منها على سطرين. */
function Toc({ groups, active }: { groups: TocGroup[]; active: string }) {
  return (
    <nav aria-label="محتويات الدليل" className="guide-toc guide-noprint">
      <p className="guide-h mb-4 flex items-center gap-2 text-sm">
        <BookOpen className="h-4 w-4" aria-hidden="true" /> محتويات الدليل
      </p>
      <div className="space-y-5">
        {groups.map((g, gi) => (
          <div key={g.title}>
            <p className="mb-1.5 flex items-center gap-2 text-sm font-black text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-[2px]" data-hue={hueOf(gi)} aria-hidden="true" />
              {g.title}
            </p>
            <ol className="text-sm">
              {g.items.map((it) => (
                <li key={it.id}>
                  <a
                    href={`#${it.id}`}
                    aria-current={active === it.id ? "true" : undefined}
                    className="flex items-baseline gap-2 truncate border-s-2 border-transparent py-1 ps-3 leading-6 text-muted-foreground hover:text-foreground"
                  >
                    {it.n !== undefined && <span className="w-5 shrink-0 text-xs tabular-nums opacity-60">{pad2(it.n)}</span>}
                    <span className="truncate">{it.label}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
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

  const tocGroups = useMemo<TocGroup[]>(() => {
    const byId = new Map(GUIDE_SECTIONS.map((s, i) => [s.id, { id: s.id, label: shortTitle(s.title), n: i + 1 }]));
    return [
      { title: "قبل أن تبدأ", items: [{ id: "journey", label: "رحلتُك في المنصّة" }, { id: "first-week", label: "أسبوعُك الأوّل" }] },
      ...GUIDE_PARTS.map((p) => ({ title: p.title, items: p.ids.map((id) => byId.get(id)!).filter(Boolean) })),
      { title: "مساعدة", items: [{ id: "faq", label: "أسئلةٌ شائعة" }, { id: "help", label: "تحتاج مساعدة؟" }] },
    ];
  }, []);
  const ids = useMemo(() => tocGroups.flatMap((g) => g.items.map((t) => t.id)), [tocGroups]);
  const active = useActiveSection(ids);

  const help = [
    { title: "جلسةُ تهيئة", text: "من يمشي معك في إعداد محاورك وموادّك، في موعدٍ تختاره.", action: <Button as="a" href={ORIENTATION_BOOKING_URL} target="_blank" rel="noreferrer noopener" icon={CalendarPlus}>{ORIENTATION_CTA_AR}</Button> },
    ...(waLink ? [{ title: "واتساب", text: "سؤالٌ سريعٌ عن خطوةٍ وقفتَ عندها.", action: <Button as="a" href={waLink} target="_blank" rel="noreferrer noopener" icon={MessageCircle}>راسِلنا على واتساب</Button> }] : []),
    { title: "البريد", text: "ما يحتاج شرحا أطول أو مرفقا.", action: <Button as="a" href={`mailto:${CONTACT.email}`} icon={Mail}>{CONTACT.email}</Button> },
  ];

  return (
    <div dir="rtl" className="guide-root min-h-screen text-foreground">
      <SeoHead
        title="دليلُ المدرّب"
        description="كلُّ ما يفعله مدرّبُ أكاديمية وجيز في بوّابته بعد اعتماد عقده — خطوةً خطوة، بصورٍ من المنصّة."
        path={TRAINER_GUIDE_PATH}
        noindex
      />
      <style>{CSS}</style>

      <header className="guide-noprint sticky top-0 z-40 border-b border-[rgb(var(--g-line))] bg-[rgb(var(--g-paper)/.92)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-2.5">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 shrink-0 object-contain" />
            <span className="min-w-0">
              <span className="guide-h block truncate leading-6"><span className="hidden sm:inline">وجيز | </span>دليلُ المدرّب</span>
              <span className="hidden truncate text-xs leading-5 text-muted-foreground sm:block">صفحةُ شرح — العملُ في بوّابتك</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Button as="a" href="/trainer" target="_blank" rel="noopener" tone="primary" icon={LayoutDashboard}>افتح بوّابتك</Button>
          </div>
        </div>
      </header>

      <Cover />

      <div className="mx-auto max-w-6xl px-5 pb-20">
        <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6 pt-14">
              <Toc groups={tocGroups} active={active} />
            </div>
          </aside>

          <article className="min-w-0 max-w-3xl">
            {/* على الهاتف: فهرسٌ يُطوى في رأس المقال */}
            <details className="guide-noprint guide-card mt-8 px-4 lg:hidden">
              <summary className="guide-h flex cursor-pointer list-none items-center justify-between gap-2 py-3">
                <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" aria-hidden="true" /> محتويات الدليل</span>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </summary>
              <div className="pb-3"><Toc groups={tocGroups} active={active} /></div>
            </details>

            <Journey />
            <FirstWeek />

            {GUIDE_SECTIONS.map((s, i) => <Section key={s.id} s={s} n={i + 1} onZoom={openZoom} />)}

            {/* ── أسئلةٌ شائعة ── */}
            <section id="faq" aria-labelledby="faq-h" className="guide-section guide-page scroll-mt-24 pt-16">
              <PageHead id="faq" hue="amber" title="أسئلةٌ شائعة" />
              <div className="mt-6 space-y-3">
                {FAQ.map((f) => (
                  <details key={f.q} className="guide-card group">
                    <summary className="guide-h flex cursor-pointer list-none items-start justify-between gap-3 p-4 text-base leading-7">
                      <span>{f.q}</span>
                      <ChevronDown className="mt-1.5 h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <p className="px-4 pb-4 text-base leading-8 text-muted-foreground"><Rich text={f.a} /></p>
                  </details>
                ))}
              </div>
            </section>

            {/* ── المساعدة — كصفحة «الدعم والمساعدة» في المثال ── */}
            <section id="help" aria-labelledby="help-h" className="guide-page scroll-mt-24 pt-16">
              <PageHead id="help" hue="sky" title="تحتاج مساعدة؟" />
              <p className="guide-deep mt-6 flex items-start gap-3 px-6 py-5 text-lg leading-9">
                <LifeBuoy className="mt-1.5 h-5 w-5 shrink-0" aria-hidden="true" />
                إن وقفتَ عند خطوةٍ لم يشرحها هذا الدليل، أو أردتَ من يمشي معك في إعداد موادّك، فنحن هنا.
              </p>
              <div className="mt-6 space-y-4">
                {help.map((h) => (
                  <div key={h.title} className="guide-card guide-callout flex flex-wrap items-center justify-between gap-4 p-5" data-tone="contract">
                    <div className="min-w-0">
                      <p className="guide-h text-lg">{h.title}</p>
                      <p className="mt-1 text-base leading-8 text-muted-foreground">{h.text}</p>
                    </div>
                    <div className="guide-noprint shrink-0">{h.action}</div>
                  </div>
                ))}
              </div>
            </section>
          </article>
        </div>
      </div>

      {/* ── الختام — صفحةٌ ملوّنةٌ كآخر المثال ── */}
      <section className="guide-page guide-end guide-deep relative overflow-hidden" style={{ borderRadius: 0 }} aria-label="ختام الدليل">
        <Pixels shape="v" hue="sky" size="2rem" className="absolute top-0 left-8 md:left-16" />
        <Pixels shape="stair" hue="blush" size="1.6rem" className="absolute bottom-0 right-0" />
        <div className="relative mx-auto max-w-6xl px-5 py-24 text-center">
          <p className="text-4xl font-black leading-tight md:text-5xl">بالتوفيق في دوراتك</p>
          <p className="mt-4 text-lg leading-9 opacity-90">متعلّموك ينتظرون ما عندك — ونحن معك في كلّ خطوة.</p>
          <p className="mt-8 text-sm opacity-75">أكاديمية وجيز · دليلُ المدرّب</p>
        </div>
      </section>

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

