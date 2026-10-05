/* عُدّةُ «دليل المدرّب» — لغةُ صفحاته المشتركة: أنماطُه ونصُّه الصغيرُ وبطاقاتُه ورؤوسُ أقسامه.

   كانت في `pages/trainer/Guide.tsx` كلُّها. ثمّ صارت للدليل أختٌ — «التدريبُ مع
   أكاديمية وجيز» (`pages/trainer/TrainerBrief.tsx`) — على لغته نفسِها (٥ أكتوبر
   ٢٠٢٦)، فاستوردتها من صفحة الدليل. فحسب `one-primary-per-screen.test.ts` ذهبيَّ
   الدليل («افتح بوّابتك») على شاشتها وهو لا يُعرض فيها — ورسمُ الاستيراد صادقٌ في
   ما يقيسه: من استورد صفحةً استورد أزرارَها. فخرجت العُدّةُ إلى هنا، بلا زرٍّ
   ذهبيٍّ ولا صورة: ما يخصّ الدليلَ — لقطاتُه وتكبيرُها وغلافُه وفهرسُه وأزرارُه —
   بقي في صفحته، ولكلّ صفحةٍ ذهبيُّها.

   ويحرس طباعتَها `guide-print.test.ts`، ولغتَها `guide-not-portal.test.ts` — كلاهما
   يقرأ الملفّين معا. */

import { Check, FileSignature, Globe2 } from "lucide-react";
import type { CalloutTone, GuideBlock } from "@/data/trainer-guide/types";
import { pad2, type Hue } from "@/components/guide/hues";

/* ═══ الأنماطُ الخاصّة بالدليل ═══

   ألوانُ الدليل متغيّراتٌ على `.guide-root`: الداكنُ افتراضُ الموقع، والفاتحُ
   تحت `html[data-theme="light"]` كسائر السمات — والطباعةُ فاتحةٌ دائما.

   ═══ وتُصدَّر لصفحةٍ أختٍ (٥ أكتوبر ٢٠٢٦) ═══
   «التدريبُ معنا» (`TrainerBrief.tsx`) على لغة الدليل نفسِها — ألوانِه وبطاقاتِه
   ومربّعاتِه — فتقرأ هذه الأنماطَ ومكوّناتِها من هنا لا من نسخة. وقاعدةُ الصفحة
   المطبوعة (`@page`) خارجَها: ذيلُها «دليلُ المدرّب»، ولكلّ صفحةٍ ذيلُها. */
export const GUIDE_KIT_CSS = `
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
/* والطويلةُ (عنوانُ خطوات) تلتفّ — بصنفٍ من هنا لا من Tailwind: \`whitespace-normal\`
   يُكتب قبل هذه الورقة وبمثل وزنها، فيغلبه \`nowrap\` أعلاه. وهو ما كان يمدّ الدليلَ
   على الهاتف إلى 470 بكسلا فينزاح جانبا (٥ أكتوبر ٢٠٢٦) */
.guide-pill-wrap { white-space: normal; }
/* «جديد» — رقاقةٌ مرجانيّةٌ صغيرةٌ بجانب اسم القسم (٥ أكتوبر ٢٠٢٦) */
.guide-new { display: inline-block; padding: 0 .45rem; border-radius: .3rem; font-size: .72rem; font-weight: 800;
  line-height: 1.35rem; white-space: nowrap; vertical-align: middle; }
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
/* وسمُ الصورة شريطٌ فوقها لا لصيقةٌ عليها — كانت تغطّي الرقمَ «١» ونصَّ الشاشة */
.guide-shot-tag { display: flex; align-items: center; gap: .4rem; margin: 0 .25rem .45rem;
  font-size: .78rem; font-weight: 800; color: rgb(var(--g-ink) / .75); }
.guide-shot-tag::before { content: ""; width: .5rem; height: .5rem; border-radius: 2px; background: rgb(var(--g-sky)); }
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

@media print {
  .guide-noprint { display: none !important; }
  /* ورابطُ «تجاوز إلى المحتوى» في رأس التطبيق (\`App.tsx\`) — للوحة المفاتيح لا للورق.
     وكان يُطبع في ذيل كلّ صفحةٍ من الدليل (٥ أكتوبر ٢٠٢٦) */
  .skip-link { display: none !important; }
  /* وما تحت آخر المحتوى ورقٌ كريميٌّ كسائره — لا قماشُ المتصفّح الأبيض، وقد
     أفرغه تسطيحُ \`index.css\` لكلّ خلفيّة (٥ أكتوبر ٢٠٢٦) */
  html, body { background-color: #F4F2E7 !important; }
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
export const LINK = "font-bold text-teal-light-ink underline decoration-teal/40 underline-offset-4 hover:decoration-teal";

export function Rich({ text }: { text: string }) {
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

export function Pixels({ shape, hue, size = "1.6rem", className = "" }: { shape: keyof typeof PX_SHAPES; hue: Hue; size?: string; className?: string }) {
  const on = new Set<number>(PX_SHAPES[shape]);
  const cells = shape === "v" ? 6 : 9;
  return (
    <div aria-hidden="true" dir="ltr" className={`guide-px ${className}`} style={{ ["--px" as string]: size }}>
      {Array.from({ length: cells }, (_, i) => <i key={i} data-hue={on.has(i) ? hue : undefined} />)}
    </div>
  );
}

/* ═══ «انتبه» و«نصيحة» — والعنوانُ الصغيرُ فوق عنوانها يقول نوعَها ═══ */
const CALLOUT: Record<CalloutTone, { label: string; hue: Hue | "ink"; icon: "!" | typeof Check }> = {
  important: { label: "انتبه", hue: "coral", icon: "!" },
  tip: { label: "نصيحة", hue: "ink", icon: Check },
  public: { label: "يراه الناس", hue: "amber", icon: Globe2 },
  contract: { label: "من عقدك", hue: "sky", icon: FileSignature },
};

export function Callout({ b }: { b: Extract<GuideBlock, { kind: "callout" }> }) {
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
        <p className="text-sm font-bold text-muted-foreground">{b.label ?? c.label}</p>
        <p className="guide-h mt-0.5 text-base leading-7">{b.title}</p>
        <p className="mt-1 text-base leading-8"><Rich text={b.text} /></p>
      </div>
    </div>
  );
}

/** صورةُ الكتلة يُصيّرها من يملك صورَها — الدليلُ بلقطاته؛ ومن لا صورَ له لا يمرّرها */
export type FigureRenderer = (b: Extract<GuideBlock, { kind: "figure" }>) => React.ReactNode;

function Block({ b, figure }: { b: GuideBlock; figure?: FigureRenderer }) {
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
          {b.title && <h3 className="mb-4"><span className="guide-pill guide-pill-wrap" data-hue="sky">{b.title}</span></h3>}
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
      return figure ? figure(b) : null;
    case "callout":
      return <div className="mt-6"><Callout b={b} /></div>;
    case "table":
      return (
        /* `relative` لأنّ نصَّ قارئ الشاشة في رقاقات الجدول (`sr-only`) مطلقُ الموضع: بلا
           أصلٍ مُموضَعٍ يُقاس من خارج اللفّاف فلا يقصّه، ويمدّ الصفحةَ كلَّها على الهاتف
           إلى حيث يقع في الجدول — وهو أكثرُ ما كان يزيحها جانبا (٥ أكتوبر ٢٠٢٦) */
        <div className="guide-card relative mt-6 overflow-x-auto p-0">
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
export function Blocks({ blocks, figure }: { blocks: GuideBlock[]; figure?: FigureRenderer }) {
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
      out.push(<Block key={i} b={b} figure={figure} />);
    }
  }
  return <>{out}</>;
}

/* ═══ رأسُ القسم كرأس صفحةٍ في المثال ═══ */
export function PageHead({ id, n, hue, title, children }: { id: string; n?: number; hue: Hue; title: string; children?: React.ReactNode }) {
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

