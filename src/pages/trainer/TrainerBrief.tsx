/* «التدريبُ مع أكاديمية وجيز» — صفحةٌ تُرسَل مع الدعوة (٥ أكتوبر ٢٠٢٦).

   القرارُ وعلّةُ الإخفاء في `application/trainer/trainer-brief.ts`، والمحتوى في
   `data/trainer-brief/` — هذا الملفُّ يعرضه ولا يكتبه.

   ═══ وعلى لغة الدليل ═══

   «على تصميم الدليل نفسِه أو أفضل — النبرةِ نفسها واللمسةِ نفسها» (صاحب المنصّة).
   فأنماطُ الدليل ومكوّناتُه تُقرأ من `Guide.tsx` نفسِه — الورقُ الكريميّ والحبرُ
   الأخضر، ومربّعاتُ الأرقام بألوانها الأربعة، والبطاقاتُ بأشرطتها — لا من نسخةٍ
   تفترق عنها عند أوّل تعديل.

   وما يختلف عن الدليل فلأنّها **صفحتان لا كتاب**: لا فهرسَ جانبيّ ولا قسمَ يبدأ
   ورقتَه، والمطبوعُ مضغوطٌ ليقع في صفحتين كما طُلب، وذيلُه اسمُها لا اسمُ الدليل. */

import { useMemo } from "react";
import { Link } from "react-router";
import { Mail, MessageCircle, Printer, Send, Sparkles } from "lucide-react";
import SeoHead from "@/components/SeoHead";
import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";
import { CONTACT } from "@/data/stories";
import { waHref } from "@/application/site/whatsapp";
import { useWhatsAppNumbers } from "@/services/whatsapp";
import { startAdvice } from "@/application/trainer/start-advice";
import { TRAINER_BRIEF_PATH, TRAINER_BRIEF_TITLE_AR } from "@/application/trainer/trainer-brief";
import { hueOf, pad2 } from "@/components/guide/hues";
import type { GuideBlock, GuideSection } from "@/data/trainer-guide/types";
import { Blocks, GUIDE_KIT_CSS, PageHead, Pixels, Rich } from "@/components/guide/GuideKit";
import {
  APPLY_PATH, BRIEF_FACTS, BRIEF_SECTIONS, BRIEF_START_ADVICE, BRIEF_STEPS, BRIEF_UPDATED_AR,
  PAY_EXAMPLE_AR, PAY_MODELS, PAY_SECTION, PAY_TERMS, STEPS_NOTE_AR, STEPS_SECTION,
} from "@/data/trainer-brief/content";

/* ═══ ما يخصّ هذه الصفحة وحدَها — والباقي من الدليل ═══ */
const BRIEF_CSS = `
.brief-tile { background: rgb(255 255 255 / .88); border-radius: .75rem; color: rgb(var(--g-dark-ink)); }
.brief-pick { border-color: rgb(var(--g-amber)); box-shadow: 0 0 0 1px rgb(var(--g-amber)); }
.brief-printonly { display: none; }
/* رؤوسٌ أصغرُ من الدليل: صفحتان لا كتاب */
.brief-section h2.guide-h { font-size: 1.75rem; line-height: 1.35; }
@media (min-width: 768px) { .brief-section h2.guide-h { font-size: 2rem; } }

@page {
  size: A4; margin: 8mm 9mm 11mm; background: #F4F2E7;
  @bottom-left { content: "التدريبُ مع أكاديمية وجيز  |  " counter(page); font-size: 8pt; color: #5b6b68; }
}
@media print {
  /* صفحتان كما طُلب: الحرفُ أصغر، والعرضُ عرضُ الورقة، والشبكاتُ أعمدةٌ كالشاشة العريضة */
  html { font-size: 9.2px !important; }
  .brief-body { max-width: none !important; padding-inline: 0 !important; padding-bottom: 1rem !important; }
  .brief-cover > div { max-width: none !important; padding: 1.4rem 1.6rem 1.2rem !important; }
  .brief-section { padding-top: 1rem !important; }
  .brief-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .brief-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .brief-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .brief-pay-card, .brief-step, .brief-fact { break-inside: avoid; }
  .brief-step, .brief-fact, .brief-pay-card { padding: .7rem .9rem !important; }
  /* ولا يبقى رأسُ قسمٍ وحدَه في ذيل ورقة، ولا ينقسم قسمُ الخطوات */
  .brief-section > .relative { break-inside: avoid; break-after: avoid; }
  .brief-cover .brief-tile { padding-top: .5rem !important; padding-bottom: .5rem !important; }
  .brief-span { grid-column: 1 / -1 !important; }
  .guide-root .leading-8 { line-height: 1.65rem !important; }
  .guide-root .leading-9 { line-height: 1.8rem !important; }
  .guide-root .leading-7 { line-height: 1.55rem !important; }
  /* والختامُ أزرارٌ لا تُضغط على ورق — فيحلّ محلَّه سطرٌ بعنوان التقديم */
  .brief-end { display: none !important; }
  .brief-printonly { display: inline !important; }
  .brief-cover h1 { font-size: 2.6rem !important; }
  .brief-end > div { padding-top: 1.2rem !important; padding-bottom: 1.2rem !important; }
  .guide-root .brief-tile { background-color: #fff !important; }
  .guide-root .brief-pick { border-color: rgb(var(--g-amber)) !important; }
}
`;

/** قسمٌ كقسم الدليل — ولا يبدأ ورقتَه. والقوائمُ المرقّمةُ المتتاليةُ («ما تجده» و«ما
    تضيفه») تتجاور في عمودين، كما تتجاور «نصيحة» و«انتبه» في الدليل */
function BriefSection({ s, n, extraFacts }: { s: GuideSection; n: number; extraFacts?: string[][] }) {
  const steps = s.blocks.filter((b) => b.kind === "steps");
  const facts = s.blocks.filter((b): b is Extract<GuideBlock, { kind: "table" }> => b.kind === "table" && b.head.length === 2);
  const rest = s.blocks.filter((b) => b.kind !== "steps" && !facts.includes(b as never));
  return (
    <section id={s.id} aria-labelledby={`${s.id}-h`} className="brief-section scroll-mt-24 pt-10">
      <BriefHead id={s.id} n={n} title={s.title} why={s.why} />
      {steps.length > 1
        ? <div className="brief-grid-2 grid gap-x-8 md:grid-cols-2"><Blocks blocks={steps} /></div>
        : <Blocks blocks={steps} />}
      {facts.map((t, i) => <Facts key={i} rows={[...t.rows, ...(extraFacts ?? [])]} label={t.head[0]} />)}
      <Blocks blocks={rest} />
    </section>
  );
}

/** جدولُ عمودين — بندٌ وجوابُه — بطاقاتٌ في عمودين: نصفُ طوله، ولا فراغَ في عرضه.
    والفردُ الأخيرُ يأخذ العرضَ كلَّه فلا يبقى بجانبه فراغ */
function Facts({ rows, label }: { rows: string[][]; label: string }) {
  return (
    <dl className="brief-grid-2 mt-5 grid gap-3 sm:grid-cols-2" aria-label={label}>
      {rows.map(([k, v], i) => (
        <div key={k} className={`brief-fact guide-card px-4 py-3 ${rows.length % 2 && i === rows.length - 1 ? "brief-span sm:col-span-2" : ""}`}>
          <dt className="guide-h text-sm leading-6">{k}</dt>
          <dd className="mt-0.5 text-base leading-7"><Rich text={v} /></dd>
        </div>
      ))}
    </dl>
  );
}

/** رأسُ القسم كالدليل — ولا يبدأ ورقتَه: صفحتان لا كتاب */
function BriefHead({ id, n, title, why }: { id: string; n: number; title: string; why: string }) {
  return (
    <PageHead id={id} n={n} hue={hueOf(n - 1)} title={title}>
      <p className="mt-2 text-base leading-8 text-muted-foreground"><Rich text={why} /></p>
    </PageHead>
  );
}

export default function TrainerBrief() {
  const waLink = waHref(useWhatsAppNumbers(), "advisor", CONTACT.whatsapp, "مرحبا، قرأتُ صفحةَ «التدريب مع أكاديمية وجيز» وعندي سؤال:");
  /* نصيحةُ موسم الشتاء — تسكت من نفسها حين يحلّ ديسمبر */
  const advice = useMemo(() => startAdvice(null, new Date().toISOString().slice(0, 10)) !== null, []);
  const nav = [...BRIEF_SECTIONS, PAY_SECTION, STEPS_SECTION];
  /* عنوانُ التقديم كما يُكتب على ورق — من الموقع الذي طُبعت منه الصفحة */
  const applyUrl = `${typeof window === "undefined" ? "" : window.location.host}${APPLY_PATH}`;
  const paySection = BRIEF_SECTIONS.length + 1;
  const stepsSection = BRIEF_SECTIONS.length + 2;

  return (
    <div dir="rtl" className="guide-root min-h-screen text-foreground">
      <SeoHead
        title={TRAINER_BRIEF_TITLE_AR}
        description="لمن تدرّس، وماذا، وكيف ومتى، وما تُعِدّه أنت، وكيف تُحاسَب ويجري التعاقد — لمن دعوناه إلى التدريب معنا."
        path={TRAINER_BRIEF_PATH}
        noindex
      />
      <style>{GUIDE_KIT_CSS + BRIEF_CSS}</style>

      <header className="guide-noprint sticky top-0 z-40 border-b border-[rgb(var(--g-line))] bg-[rgb(var(--g-paper)/.92)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-2.5">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 shrink-0 object-contain" />
            <span className="guide-h block truncate leading-6"><span className="hidden sm:inline">وجيز | </span>التدريبُ معنا</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Button as="a" href={APPLY_PATH} tone="primary" icon={Send}>قدّم طلبك</Button>
          </div>
        </div>
      </header>

      {/* ── الغلاف ── */}
      <section className="brief-cover relative overflow-hidden" data-hue="sky" aria-labelledby="brief-title">
        <Pixels shape="v" hue="blush" size="2rem" className="absolute top-0 left-8 md:left-16" />
        <Pixels shape="stair" hue="amber" size="1.4rem" className="absolute bottom-0 right-0" />
        <div className="relative mx-auto max-w-5xl px-5 pb-10 pt-12 md:pt-14">
          <span className="guide-pill" data-hue="amber">دعوةٌ للتدريب</span>
          <h1 id="brief-title" className="mt-4 text-4xl font-black leading-tight md:text-5xl" style={{ color: "rgb(var(--g-dark-ink))" }}>
            {TRAINER_BRIEF_TITLE_AR}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-9" style={{ color: "rgb(var(--g-dark-ink))" }}>
            صفحتان تجيبان عمّا يُسأل قبل القرار: لمن تدرّس، وماذا، وكيف ومتى، وما تُعِدّه أنت، وكيف تُحاسَب ويجري التعاقد.
          </p>
          <div className="mt-5 flex max-w-2xl items-start gap-3 rounded-xl bg-white/85 px-5 py-4 text-base leading-8" style={{ color: "rgb(var(--g-dark-ink))" }}>
            <Sparkles className="mt-1.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>وعدُنا لمن يتعلّم معنا: لا نقيس تعلّمك بما شاهدت، بل بما أنجزت وأثبتّ. والمدرّبُ من يقوده إلى ذلك — ولهذا لا يبدأ عندنا من صفحةٍ بيضاء.</p>
          </div>
          <ul className="brief-grid-4 mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {BRIEF_FACTS.map((f) => (
              <li key={f.value} className="brief-tile px-4 py-3">
                <p className="text-xl font-black leading-8">{f.value}</p>
                <p className="text-sm leading-6 opacity-80">{f.label}</p>
              </li>
            ))}
          </ul>
          <div className="guide-noprint mt-6 flex flex-wrap items-center gap-3">
            <Button icon={Printer} onClick={() => window.print()}>اطبعها أو احفظها PDF</Button>
          </div>
          <p className="mt-4 text-sm leading-7" style={{ color: "rgb(var(--g-dark-ink) / .8)" }}>حُدِّث في {BRIEF_UPDATED_AR}</p>
        </div>
      </section>

      <div className="brief-body mx-auto max-w-5xl px-5 pb-14">
        {/* ── أقسامُ الصفحة في سطر — للقفز على الهاتف ── */}
        <nav aria-label="أقسام الصفحة" className="guide-noprint mt-7 flex flex-wrap gap-2">
          {nav.map((s, i) => (
            <a key={s.id} href={`#${s.id}`} className="guide-card inline-flex items-center gap-2 px-3 py-1.5 text-sm font-bold hover:border-[rgb(var(--g-ink)/.4)]">
              <span className="guide-sq guide-sq-sm" data-hue={hueOf(i)} aria-hidden="true">{pad2(i + 1)}</span>
              {s.title.split(":")[0]}
            </a>
          ))}
        </nav>

        {/* لمن وماذا — قصيران، فيتجاوران */}
        <div className="brief-grid-2 grid gap-x-10 lg:grid-cols-2">
          {BRIEF_SECTIONS.slice(0, 2).map((s, i) => <BriefSection key={s.id} s={s} n={i + 1} />)}
        </div>
        {BRIEF_SECTIONS.slice(2).map((s, i) => (
          <BriefSection key={s.id} s={s} n={i + 3}
            extraFacts={s.id === "how" && advice ? [[BRIEF_START_ADVICE.title, BRIEF_START_ADVICE.text]] : undefined} />
        ))}

        {/* ── الأتعاب ── */}
        <section id={PAY_SECTION.id} aria-labelledby={`${PAY_SECTION.id}-h`} className="brief-section scroll-mt-24 pt-10">
          <BriefHead id={PAY_SECTION.id} n={paySection} title={PAY_SECTION.title} why={PAY_SECTION.why} />
          {/* الموصى بها بعرض القسم — بنودُها ثلاثةٌ متجاورة — والأخريان تحتها */}
          <ul className="brief-grid-2 mt-6 grid gap-4 md:grid-cols-2">
            {PAY_MODELS.map((m, i) => (
              <li key={m.id} className={`brief-pay-card guide-card p-4 ${m.recommended ? "brief-pick brief-span md:col-span-2" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="guide-sq guide-sq-sm" data-hue={hueOf(i)} aria-hidden="true">{i + 1}</span>
                  <p className="guide-h text-lg leading-7">{m.title}</p>
                  {m.recommended && <span className="guide-pill" data-hue="amber">نوصي بها</span>}
                </div>
                <p className="mt-2 text-base leading-8">{m.text}</p>
                {m.points && (
                  <ul className="brief-grid-3 guide-list mt-2 grid gap-x-6 gap-y-1.5 text-sm leading-7 md:grid-cols-3">
                    {m.points.map((p) => <li key={p}><Rich text={p} /></li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <p className="guide-deep mt-5 px-6 py-4 text-base font-bold leading-8"><Rich text={PAY_EXAMPLE_AR} /></p>
          <ul className="guide-list mt-4 space-y-2 text-base leading-8">
            {PAY_TERMS.map((t) => <li key={t}><Rich text={t} /></li>)}
          </ul>
        </section>

        {/* ── التعاقد ── */}
        <section id={STEPS_SECTION.id} aria-labelledby={`${STEPS_SECTION.id}-h`} className="brief-section scroll-mt-24 pt-10">
          <BriefHead id={STEPS_SECTION.id} n={stepsSection} title={STEPS_SECTION.title} why={STEPS_SECTION.why} />
          <ol className="brief-grid-3 mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {BRIEF_STEPS.map((st, i) => (
              <li key={st.title} className="brief-step guide-card flex items-start gap-3 p-4">
                <span className="guide-sq" data-hue={hueOf(i)} aria-hidden="true">{pad2(i + 1)}</span>
                <span className="min-w-0">
                  <span className="guide-h block text-base leading-7">{st.title}</span>
                  <span className="mt-0.5 block text-sm leading-6 text-muted-foreground"><Rich text={st.detail} /></span>
                </span>
              </li>
            ))}
          </ol>
          <p className="guide-blush mt-5 px-6 py-4 text-base font-bold leading-8">
            {STEPS_NOTE_AR}
            <span className="brief-printonly"> وللتقديم: <span dir="ltr">{applyUrl}</span></span>
          </p>
        </section>
      </div>

      {/* ── الختام ── */}
      <section className="brief-end guide-deep relative overflow-hidden" style={{ borderRadius: 0 }} aria-labelledby="brief-end">
        <Pixels shape="v" hue="sky" size="1.8rem" className="absolute top-0 left-8 md:left-16" />
        <Pixels shape="stair" hue="blush" size="1.4rem" className="absolute bottom-0 right-0" />
        <div className="relative mx-auto max-w-3xl px-5 py-12 text-center">
          <p id="brief-end" className="text-3xl font-black leading-tight md:text-4xl">هل تناسبك؟</p>
          <p className="mt-3 text-lg leading-9 opacity-90">قدّم طلبك، وما بقي من أسئلتك نجيب عنه في الاجتماع التعريفيّ.</p>
          <div className="guide-noprint mt-6 flex flex-wrap items-center justify-center gap-3">
            {/* ذهبيٌّ واحدٌ في الشاشة (`one-primary-per-screen.test.ts`) — وهو في الرأس؛
                وهذا فعلُ قسمه، فنبرتُه المُثبِتة */}
            <Button as="a" href={APPLY_PATH} tone="confirm" icon={Send}>قدّم طلبك</Button>
            {waLink && <Button as="a" href={waLink} target="_blank" rel="noreferrer noopener" icon={MessageCircle}>اسألنا على واتساب</Button>}
            <Button as="a" href={`mailto:${CONTACT.email}`} icon={Mail}>{CONTACT.email}</Button>
          </div>
          <p className="mt-6 text-sm opacity-75">أكاديمية وجيز · {TRAINER_BRIEF_TITLE_AR}</p>
        </div>
      </section>
    </div>
  );
}
