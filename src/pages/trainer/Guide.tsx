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
  BookOpen, CalendarPlus, Check, ChevronDown, LayoutDashboard,
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
import type { GuideSection } from "@/data/trainer-guide/types";
import { hueOf, pad2 } from "@/components/guide/hues";
import { landOnHash } from "@/components/guide/land-on-hash";
import { Blocks, GUIDE_KIT_CSS, LINK, PageHead, Pixels, Rich } from "@/components/guide/GuideKit";

/** مكانُ الصور — تولّدها `scripts/trainer-guide/capture.ts` */
const SHOT_DIR = "/guides/trainer";
const CHECK_KEY = "wajeez.trainer-guide.checklist.v1";


/** الصفحةُ المطبوعة للدليل وحدَه — وذيلُها اسمُه ورقمُ الصفحة */
const PAGE_CSS = `
@page {
  size: A4; margin: 14mm 12mm 16mm; background: #F4F2E7;
  @bottom-left { content: "دليلُ المدرّب  |  " counter(page); font-size: 8pt; color: #5b6b68; }
}
`;

/* ═══ صورةٌ مؤطَّرة تُكبَّر — والأبعادُ من بيان اللقطات فلا تقفز الصفحة ═══ */
/** شرحُ الصورة: «١ كذا · ٢ كذا» — والرقمُ فيه دائرةٌ ذهبيّةٌ كالتي على الصورة
    نفسِها، فتُطابَق بالعين. وما لا رقمَ في أوّله يُقرأ كما هو.
    وكلُّ بندٍ سطرٌ يلتفّ كالنصّ — لا صفٌّ مرن: الصفُّ لا يكسر رقاقةَ الزرّ ولا يلفّها،
    فكان بندٌ فيه رقاقةٌ طويلةٌ أعرضَ من الهاتف (٥ أكتوبر ٢٠٢٦). */
function Caption({ text }: { text: string }) {
  const parts = text.split(" · ");
  return (
    <>
      {parts.map((part, i) => {
        const m = /^(\d{1,2}) (.+)$/s.exec(part);
        return (
          <span key={i} className="me-3">
            {m ? <><span className="guide-mark me-1.5" aria-label={`الرقم ${m[1]}`}>{m[1]}</span><Rich text={m[2]} /></> : <Rich text={part} />}
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
      <Blocks blocks={s.blocks} figure={(b) => <Shot shot={b.shot} alt={b.alt} caption={b.caption} onZoom={onZoom} />} />
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
  /* رابطٌ إلى قسمٍ بعينه (`#standard`) يهبط عليه لا على أوّل الدليل — والعلّةُ
     في `land-on-hash.ts`: الدليلُ محمّلٌ كسولا، و`ScrollToTop` يرفع إلى الأعلى */
  useEffect(() => landOnHash(window, document, ids), [ids]);

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
      <style>{GUIDE_KIT_CSS + PAGE_CSS}</style>

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

