import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Award, ChevronDown, ExternalLink, FolderCheck, Handshake, Play, ScrollText, type LucideIcon } from 'lucide-react'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'
import EcosystemOrgStrip from '@/components/EcosystemOrgStrip'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import { Panel } from '@/components/ui/Surface'
import { seoFor } from '@/application/site/public-pages'
import { countAr } from '@/application/text/count-ar'
import { usePublishedContent } from '@/services/public-content'
import { useReveal } from '@/hooks/useReveal'
import { pathways, pathwayDomains } from '@/data/pathways'
import { courses } from '@/data/courses'
import { partnerLogos } from '@/data/stories'
import { ECOSYSTEM_URL } from '@/data/siteContent'
import type { TrustMetric } from '@/data/trustMetrics'
import {
  ABOUT_HERO, ACADEMY_STEPS, AUDIENCES, AUDIENCES_TITLE, CHAPTERS, CHAPTER_ORDER, CLOSING,
  HONESTY_LINE, OUTCOMES, OUTCOMES_TITLE, aboutSources,
  type AcademyStep, type ChapterId, type Outcome,
} from '@/data/about'

/* ═════════ «من نحن» — الحكايةُ خطٌّ واحدٌ يتغيّر شكلُه ═════════

   طلب صاحبُ المنصّة (٢٣ سبتمبر ٢٠٢٦) أن تكون الصفحةُ «كأنّها رسمة»: أين
   كنّا، وأنّنا ما زلنا هناك، وأنّ ما بعدها إضافةٌ عليه. والنصُّ كلُّه في
   `data/about.ts` — هنا الرسمُ وحدَه.

   ── الفكرةُ: خطٌّ يسري في هامش الصفحة من أوّلها إلى آخرها ──

   وجيز بدأت صوتا، والأكاديميةُ طريق. فالخطُّ يروي ذلك بشكله قبل أن يُقرأ
   حرف: **موجةُ صوتٍ** في فصل التطبيق، ثمّ **ثلاثةُ مساراتٍ متوازية** تتفرّع
   منها في فصل «وجيز مهارات»، ثمّ تلتئم **طريقا واحدا بمحطّاتٍ مرقّمة** في
   فصل الأكاديمية، ثمّ **خطٌّ متقطّعٌ يبهت** نحو ما لم يُرسم بعد. والصدرُ
   يرسم الخطَّ نفسَه أفقيّا مصغَّرا — خريطةً للصفحة، ومحطّاتُها روابطُ إلى
   فصولها.

   وكلماتُ الهامش بخطّ الرقعة — «البداية · ثمّ · والآن · وغدا» — تُقرأ
   جملةً واحدةً من أعلى الصفحة إلى أسفلها. وهي الخطُّ نفسُه الذي يوقّع به
   شريطُ الرئيسيّة (`ProofBand`)، فاليدُ واحدة.

   ── وما حُرس ──

   · الحركةُ لحظةٌ واحدة: رسمُ الصدر يُخطّ عند الفتح، ولا شيءَ غيرُه يتحرّك.
     ومن طلب تقليلَ الحركة رآه مرسوما تامّا من أوّل لحظة — الحالةُ الأولى
     الخفيّة لا تُكتب إلّا تحت `prefers-reduced-motion: no-preference`.
   · الخطُّ زخرفةٌ `aria-hidden`؛ والمعنى كلُّه نصٌّ في DOM بعناوينه.
   · رئيسيٌّ ذهبيٌّ واحد في الشاشة («تواصل معنا» في الختام) — والتشخيصُ
     فيروزيٌّ مُثبِت (`src/tests/one-primary-per-screen.test.ts`).
   · الأسطحُ من `ui/Surface` والأزرارُ من `ui/Button` — لا صيغةَ بيدٍ
     (`src/tests/design-system.test.ts`). */

/* ─────────── الموجة ─────────── */

/** سعةُ الموجة — صوتٌ يعلو في أوّله ثمّ يهدأ حتّى يكاد يصير خطّا.
    دالّةٌ ثابتةٌ لا نردٌ يُرمى: الرسمُ نفسُه في كلّ زيارة وكلّ بناء. */
function waveAmplitudes(n: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    const texture = 0.5 + 0.5 * Math.abs(Math.sin(i * 1.93) * Math.cos(i * 0.71))
    const envelope = t < 0.15 ? 0.6 + t * 2.6 : 1 - Math.pow((t - 0.15) / 0.85, 1.4) * 0.88
    return Math.max(0.1, Math.min(1, texture * envelope))
  })
}

const SPINE_WAVE = waveAmplitudes(64)
const HERO_WAVE = waveAmplitudes(22)

/* ─────────── الحركة ─────────── */

const CSS = `
.about-hand { font-family: "Aref Ruqaa", serif; }
@media (prefers-reduced-motion: no-preference) {
  .about-bar { transform-box: fill-box; transform-origin: center; transform: scaleY(.08);
    animation: about-bar .5s cubic-bezier(.3,.7,.3,1) forwards; animation-delay: calc(.1s + var(--i) * 28ms); }
  .about-draw { stroke-dasharray: 1; stroke-dashoffset: 1;
    animation: about-draw .7s cubic-bezier(.4,.1,.4,1) forwards; animation-delay: var(--at); }
  .about-node { transform-box: fill-box; transform-origin: center; transform: scale(0);
    animation: about-node .35s cubic-bezier(.2,.9,.3,1.3) forwards; animation-delay: var(--at); }
  .about-fade-in { opacity: 0; animation: about-fade .9s ease-out forwards; animation-delay: var(--at); }
}
@keyframes about-bar { to { transform: scaleY(1) } }
@keyframes about-draw { to { stroke-dashoffset: 0 } }
@keyframes about-node { to { transform: scale(1) } }
@keyframes about-fade { to { opacity: 1 } }
`

/* ─────────── الصدر: رسمُ الرحلة مصغَّرا ─────────── */

/** ألوانُ كلمة الهامش — الحاضرُ ذهبيّ، والآتي خافت */
const MARGIN_INK: Record<ChapterId, string> = {
  app: 'text-teal-light-ink',
  maharat: 'text-teal-light-ink',
  academy: 'text-gold-ink',
  next: 'text-muted-foreground',
}

const anchorOf = (id: ChapterId) => `about-${id}`

/* المقاطعُ الأربعة بإحداثيّات الرسم (٠–١٠٠٠، من اليمين إلى اليسار كما
   تُقرأ الحكاية)، وعرضُ كلّ عمودٍ في شبكة الروابط تحته يساوي عرضَ مقطعه —
   فتقع كلُّ محطّةٍ تحت رسمها. */
const STEP_NODES_X = [505, 459, 413, 367, 321] as const

function JourneyDrawing() {
  return (
    <div className="mt-12 md:mt-16">
      <svg viewBox="0 0 1000 120" className="h-auto w-full overflow-visible" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="about-horizon-grad" x1="1" x2="0" y1="0" y2="0">
            <stop offset="0" stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          {/* ⚠ `userSpaceOnUse` لا الافتراضيّ: القناعُ يُقاس افتراضيّا على صندوق
              ما يُقنَّع — وصندوقُ خطٍّ أفقيٍّ ارتفاعُه صفر، فيُخفي الخطَّ كلَّه. */}
          <mask id="about-horizon-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="262" height="120">
            <rect x="0" y="0" width="262" height="120" fill="url(#about-horizon-grad)" />
          </mask>
        </defs>

        {/* ١) موجةُ الصوت — التطبيق */}
        {HERO_WAVE.map((a, i) => {
          const h = 8 + a * 84
          return (
            <rect
              key={i}
              className="about-bar fill-teal"
              style={{ ['--i' as string]: i }}
              x={985 - i * 10 - 2.25}
              y={60 - h / 2}
              width={4.5}
              height={h}
              rx={2.25}
            />
          )
        })}

        {/* ٢) ثلاثةُ مسارات تتفرّع ثمّ تلتئم — وجيز مهارات */}
        <g fill="none" strokeLinecap="round" strokeWidth={3} style={{ ['--at' as string]: '.75s' }}>
          <path className="about-draw stroke-teal" pathLength={1} d="M770 60 H530" />
          <path className="about-draw stroke-teal/50" pathLength={1} d="M770 60 C745 60 740 36 715 36 H585 C560 36 555 60 530 60" />
          <path className="about-draw stroke-teal/50" pathLength={1} d="M770 60 C745 60 740 84 715 84 H585 C560 84 555 60 530 60" />
        </g>

        {/* ٣) طريقٌ واحدٌ بمحطّات — الأكاديمية */}
        <path className="about-draw stroke-teal" style={{ ['--at' as string]: '1.2s' }} pathLength={1} d="M530 60 H262" fill="none" strokeWidth={3.5} strokeLinecap="round" />
        {STEP_NODES_X.map((x, i) => (
          <circle
            key={x}
            className="about-node fill-paper stroke-teal"
            style={{ ['--at' as string]: `${1.35 + i * 0.09}s` }}
            cx={x}
            cy={60}
            r={7}
            strokeWidth={3}
          />
        ))}
        <rect
          className="about-node fill-gold"
          style={{ ['--at' as string]: '1.85s' }}
          x={262}
          y={51}
          width={18}
          height={18}
          rx={3}
          transform="rotate(45 271 60)"
        />

        {/* ٤) خطٌّ متقطّعٌ يبهت — ما بعدها */}
        <g mask="url(#about-horizon-mask)">
          <path
            className="about-fade-in stroke-muted-foreground"
            style={{ ['--at' as string]: '2s' }}
            d="M248 60 H6"
            fill="none"
            strokeWidth={3}
            strokeDasharray="2 11"
            strokeLinecap="round"
          />
        </g>
      </svg>

      {/* المحطّاتُ روابطُ إلى فصولها — فالرسمُ فهرسُ الصفحة */}
      <nav aria-label="فصول الحكاية">
        <ol className="grid grid-cols-[23fr_24fr_27fr_26fr] gap-x-2 md:gap-x-4">
          {CHAPTER_ORDER.map((id) => {
            const c = CHAPTERS[id]
            return (
              <li key={id}>
                <a href={`#${anchorOf(id)}`} className="group block pt-3 md:pt-4">
                  <span className={`about-hand block text-xl leading-tight md:text-2xl ${MARGIN_INK[id]}`}>{c.margin}</span>
                  <span className="mt-1 block text-read font-black leading-snug text-foreground transition group-hover:text-teal-light-ink md:text-base">
                    {c.station}
                  </span>
                  <span className="mt-0.5 hidden text-fine leading-snug text-muted-foreground sm:block">{c.stationNote}</span>
                </a>
              </li>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}

function Hero() {
  return (
    <div className="pb-4">
      <h1 className="max-w-4xl text-[2.1rem] font-black leading-[1.4] md:text-5xl md:leading-[1.3]">
        {ABOUT_HERO.lines.map((line) => (
          <span key={line} className="block text-balance">{line}</span>
        ))}
      </h1>
      <p className="mt-6 max-w-2xl text-base leading-loose text-muted-foreground md:text-lg md:leading-loose">
        {ABOUT_HERO.lead}
      </p>
      <JourneyDrawing />
    </div>
  )
}

/* ─────────── الصفّ: خطٌّ في الهامش، وكلمةٌ بخطّ اليد، ومتن ───────────

   كلُّ صفٍّ شبكةٌ بالقالب نفسِه، والصفوفُ تتلاصق بلا فراغٍ بينها — فيبدو
   الخطُّ في عموده الأوّل خطّا واحدا وهو قطعٌ متجاورة. وعلى الهاتف ينزل
   الهامشُ فوق المتن ويبقى الخطُّ في عموده الضيّق. */

const ROW = 'grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[3rem_8.5rem_minmax(0,1fr)] md:gap-x-8'

/* أربعةُ أنواعٍ من الصفوف، ولكلٍّ حشوُه — ومحطّتُه على الخطّ تقف حيث يبدأ
   عنوانُ صفّها. فالحشوُ والموضعُ يُكتبان هنا معا، لا في موضعين يفترقان. */
type RowKind = 'chapter' | 'lead' | 'step' | 'end'
const PAD: Record<RowKind, { margin: string; content: string; node: string }> = {
  chapter: { margin: 'pt-12 md:pt-16', content: 'pb-14 md:pb-20 md:pt-16', node: 'top-12 md:top-16' },
  lead: { margin: 'pt-12 md:pt-16', content: 'pb-8 md:pb-10 md:pt-16', node: 'top-12 md:top-16' },
  step: { margin: '', content: 'pt-6 pb-6 md:pb-8 md:pt-8', node: 'top-6 md:top-8' },
  end: { margin: '', content: 'pt-6 pb-14 md:pb-20 md:pt-8', node: 'top-6 md:top-8' },
}

function StoryRow({
  kind, spine, margin, children, as: Tag = 'div', ...rest
}: {
  kind: RowKind
  spine: ReactNode
  margin?: ReactNode
  children: ReactNode
  as?: 'div' | 'li'
}) {
  const pad = PAD[kind]
  return (
    <Tag className={ROW} {...rest}>
      <div aria-hidden="true" className="relative col-start-1 row-span-2 row-start-1 md:row-span-1">{spine}</div>
      {margin && <div className={`col-start-2 row-start-1 ${pad.margin}`}>{margin}</div>}
      <div className={`col-start-2 md:col-start-3 md:row-start-1 ${pad.content} ${margin ? 'row-start-2 pt-3' : 'row-start-1'}`}>
        {children}
      </div>
    </Tag>
  )
}

function Margin({ id }: { id: ChapterId }) {
  const c = CHAPTERS[id]
  return (
    <p className="flex items-baseline gap-3 md:block">
      <span className={`about-hand block -rotate-3 text-[1.75rem] leading-tight md:text-[2.1rem] ${MARGIN_INK[id]}`}>{c.margin}</span>
      {c.year && <span className="block text-fine font-bold tabular-nums text-muted-foreground md:mt-1">{c.year}</span>}
    </p>
  )
}

/* ─────────── أشكالُ الخطّ ─────────── */

const LINE = 'absolute left-1/2 -translate-x-1/2'

function WaveSpine() {
  return (
    <div className="absolute inset-0 flex flex-col items-center pb-1 pt-12 md:pt-16">
      {/* بدايةُ التشغيل — الحكايةُ تبدأ صوتا */}
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal text-on-teal md:h-8 md:w-8">
        <Play className="h-3 w-3 translate-x-px fill-current md:h-3.5 md:w-3.5" />
      </span>
      <div className="mt-3 flex w-full flex-1 flex-col items-center justify-between">
        {SPINE_WAVE.map((a, i) => (
          <span key={i} className="block h-[3px] rounded-full bg-teal/75" style={{ width: `${Math.round(a * 100)}%` }} />
        ))}
      </div>
    </div>
  )
}

/* المساراتُ الثلاثة: تتفرّع من الموجة وتلتئم في الطريق. ومواضعُها نِسَبٌ من
   عرض العمود (١٤ و٢٤ و٣٤ من ٤٨) في الرسم وفي الخطوط معا — فيلتقيان على
   الهاتف (٢٤ بكسلا) وعلى الحاسوب (٤٨) بلا حسابٍ لكلٍّ منهما. */
const TRACK_X = ['29.17%', '50%', '70.83%'] as const

function Fork({ merge = false }: { merge?: boolean }) {
  const paths = merge
    ? ['M24 0 V40', 'M14 0 C14 22 24 18 24 40', 'M34 0 C34 22 24 18 24 40']
    : ['M24 0 V40', 'M24 0 C24 22 14 18 14 40', 'M24 0 C24 22 34 18 34 40']
  return (
    <svg viewBox="0 0 48 40" preserveAspectRatio="none" className="h-10 w-full shrink-0 overflow-visible" focusable="false">
      {paths.map((d, i) => (
        <path key={d} d={d} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" className={i === 0 ? 'stroke-teal' : 'stroke-teal/45'} />
      ))}
    </svg>
  )
}

function TracksSpine() {
  return (
    <div className="absolute inset-0 flex flex-col">
      <Fork />
      <div className="relative flex-1">
        {TRACK_X.map((x, i) => (
          <span key={x} className={`absolute inset-y-0 w-0.5 -translate-x-1/2 ${i === 1 ? 'bg-teal' : 'bg-teal/45'}`} style={{ left: x }} />
        ))}
      </div>
      <Fork merge />
    </div>
  )
}

/** الطريق: خطٌّ متّصلٌ ومحطّةٌ على مستوى عنوان صفّها */
function RouteSpine({ kind, node }: { kind: RowKind; node: ReactNode }) {
  return (
    <>
      <span className={`${LINE} inset-y-0 w-[3px] bg-teal`} />
      <span className={`${LINE} ${PAD[kind].node}`}>{node}</span>
    </>
  )
}

function StepNode({ n }: { n: number }) {
  return (
    <span className="grid h-6 w-6 place-items-center rounded-full bg-paper text-fine font-black tabular-nums text-teal-light-ink ring-[3px] ring-teal md:h-8 md:w-8 md:text-xs">
      {n}
    </span>
  )
}

const NowNode = () => <span className="block h-4 w-4 rounded-full bg-gold ring-4 ring-gold/25 md:h-5 md:w-5" />
const GoalNode = () => <span className="block h-5 w-5 rotate-45 rounded-[3px] bg-gold md:h-6 md:w-6" />

function HorizonSpine() {
  return (
    <>
      <span
        className={`${LINE} inset-y-0 border-l-2 border-dashed border-muted-foreground/50`}
        style={{ maskImage: 'linear-gradient(to bottom, black 45%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black 45%, transparent)' }}
      />
      <span className={`${LINE} ${PAD.chapter.node} block h-4 w-4 rounded-full bg-paper ring-2 ring-muted-foreground/60 md:h-5 md:w-5`} />
    </>
  )
}

/* ─────────── قطعُ المتن ─────────── */

function ChapterTitle({ id }: { id: ChapterId }) {
  return (
    <h2 id={`${anchorOf(id)}-title`} className="max-w-2xl text-2xl font-black leading-snug md:text-[2rem] md:leading-snug">
      {CHAPTERS[id].title}
    </h2>
  )
}

function Prose({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="mt-5 max-w-2xl space-y-4">
      {paragraphs.map((p) => (
        <p key={p} className="text-base leading-loose text-foreground md:text-[1.0625rem] md:leading-loose">{p}</p>
      ))}
    </div>
  )
}

/** أرقامُ الفصل — من السجلّ بمصدرها، والقيمةُ قبل وصفها في العرض لا في البنية */
function Facts({ metrics }: { metrics: TrustMetric[] }) {
  return (
    <dl className="mt-9 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
      {metrics.map((m) => (
        <div key={m.key} className="flex flex-col border-s-2 border-teal/40 ps-4">
          <dt className="order-2 mt-1 text-fine leading-snug text-muted-foreground">{m.label_ar}</dt>
          <dd className="order-1 text-2xl font-black tabular-nums tracking-tight text-foreground md:text-3xl">{m.display_value}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ─────────── الفصول ─────────── */

function AppChapter() {
  const c = CHAPTERS.app
  return (
    <section id={anchorOf('app')} aria-labelledby={`${anchorOf('app')}-title`} className="scroll-mt-24">
      <StoryRow kind="chapter" spine={<WaveSpine />} margin={<Margin id="app" />}>
        <ChapterTitle id="app" />
        <Prose paragraphs={c.paragraphs} />
        <Facts metrics={c.metrics} />
        {/* الإعلامُ الذي غطّى المنصّةَ الأمّ — الشعاراتُ نفسُها في الرئيسيّة */}
        <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
          <p className="text-read font-bold text-muted-foreground">تحدّثت عن وجيز</p>
          <ul className="flex flex-wrap items-center gap-x-8 gap-y-4">
            {partnerLogos.map((l) => (
              <li key={l.name}>
                <img src={l.src} alt={l.name} loading="lazy" className="partner-logo h-6 w-auto opacity-70 md:h-7" />
              </li>
            ))}
          </ul>
        </div>
        <a
          href={ECOSYSTEM_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-7 inline-flex min-h-[44px] items-center gap-1.5 text-read font-bold text-teal-light-ink underline-offset-4 hover:underline"
        >
          تعرّف على تطبيق وجيز
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">(يفتح في نافذة جديدة)</span>
        </a>
      </StoryRow>
    </section>
  )
}

function MaharatChapter() {
  const c = CHAPTERS.maharat
  return (
    <section id={anchorOf('maharat')} aria-labelledby={`${anchorOf('maharat')}-title`} className="scroll-mt-24">
      <StoryRow kind="chapter" spine={<TracksSpine />} margin={<Margin id="maharat" />}>
        <ChapterTitle id="maharat" />
        <Prose paragraphs={c.paragraphs} />
        <Facts metrics={c.metrics} />
        <div className="max-w-3xl">
          <EcosystemOrgStrip nested headingAs="h3" />
        </div>
        <Button as={Link} to="/contact?type=company" tone="secondary" className="mt-8">
          لمؤسستك أو جهتك: اطلب عرضا
        </Button>
      </StoryRow>
    </section>
  )
}

const PATHWAY_FORMS = { one: 'مسار', two: 'مساران', few: 'مسارات', many: 'مسارا' }
const COURSE_FORMS = { one: 'دورة', two: 'دورتان', few: 'دورات', many: 'دورة' }
const DOMAIN_FORMS = { one: 'مجال', two: 'مجالين', few: 'مجالات', many: 'مجالا' }

/** ما يلحق بكلّ محطّة: الروابطُ التي تكمل جملتَها */
function StepExtras({ id }: { id: AcademyStep['id'] }) {
  const inline = 'inline-flex min-h-[44px] items-center text-read font-bold text-teal-light-ink underline-offset-4 hover:underline'
  switch (id) {
    case 'diagnose':
      return (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Button as={Link} to="/diagnostic" tone="confirm" size="lg">ابدأ التشخيص مجّانا</Button>
          <Link to="/methodology" className={inline}>كيف نصل إلى التوصية؟ اقرأ منهجية وجيز</Link>
        </div>
      )
    case 'path': {
      const domains = pathwayDomains.filter((d) => d !== 'الكل')
      return (
        <>
          <p className="mt-5 max-w-2xl text-read leading-relaxed text-muted-foreground">
            في الكتالوج اليوم {countAr(pathways.length, PATHWAY_FORMS)} و{countAr(courses.length, COURSE_FORMS)}، في {countAr(domains.length, DOMAIN_FORMS)}:
          </p>
          <ul className="mt-3 flex max-w-2xl flex-wrap gap-2">
            {domains.map((d) => (
              <li key={d}><Chip>{d}</Chip></li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button as={Link} to="/pathways" tone="secondary">تصفّح المسارات</Button>
            <Button as={Link} to="/courses" tone="secondary">تصفّح الدورات</Button>
          </div>
        </>
      )
    }
    case 'learn':
      return (
        <div className="mt-4 flex flex-wrap gap-x-6">
          <Link to="/trainers" className={inline}>تعرّف على الفريق التدريبي</Link>
          <Link to="/calendar" className={inline}>تقويم الفصل</Link>
        </div>
      )
    default:
      return null
  }
}

const OUTCOME_ICON: Record<Outcome['id'], LucideIcon> = {
  certificate: Award,
  recommendation: ScrollText,
  partner: Handshake,
  portfolio: FolderCheck,
}

function AcademyChapter() {
  const c = CHAPTERS.academy
  return (
    <section id={anchorOf('academy')} aria-labelledby={`${anchorOf('academy')}-title`} className="scroll-mt-24">
      <StoryRow kind="lead" spine={<RouteSpine kind="lead" node={<NowNode />} />} margin={<Margin id="academy" />}>
        <ChapterTitle id="academy" />
        <Prose paragraphs={c.paragraphs} />
      </StoryRow>

      {/* المحطّاتُ تسلسلٌ حقيقيّ — فهي قائمةٌ مرقّمة، ورقمُها على الخطّ */}
      <ol aria-label="كيف تسير رحلتك في الأكاديمية">
        {ACADEMY_STEPS.map((s, i) => (
          <StoryRow key={s.id} as="li" kind="step" spine={<RouteSpine kind="step" node={<StepNode n={i + 1} />} />}>
            <h3 className="text-xl font-black leading-snug md:text-2xl">{s.title}</h3>
            <p className="mt-3 max-w-2xl text-base leading-loose text-muted-foreground">{s.body}</p>
            <StepExtras id={s.id} />
          </StoryRow>
        ))}
      </ol>

      {/* المحطّةُ الأخيرة: ما يخرج به المتعلّم — وما يعنيه لكلّ من يأتي */}
      <StoryRow kind="end" spine={<RouteSpine kind="end" node={<GoalNode />} />}>
        <h3 className="text-xl font-black leading-snug text-gold-ink md:text-2xl">{OUTCOMES_TITLE}</h3>
        <ul className="mt-6 grid max-w-2xl gap-x-10 gap-y-7 sm:grid-cols-2">
          {OUTCOMES.map((o) => {
            const Icon = OUTCOME_ICON[o.id]
            return (
              <li key={o.id} className="flex items-start gap-3">
                <Icon className="mt-1 h-5 w-5 shrink-0 text-gold-ink" aria-hidden="true" />
                <div>
                  <p className="font-black leading-snug text-foreground">{o.title}</p>
                  <p className="mt-1 text-read leading-relaxed text-muted-foreground">
                    {o.body}
                    {o.link && (
                      <>
                        {' '}
                        <Link to={o.link.to} className="font-bold text-teal-light-ink underline underline-offset-4">{o.link.label}</Link>.
                      </>
                    )}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>

        <h3 className="mt-12 text-lg font-black leading-snug md:text-xl">{AUDIENCES_TITLE}</h3>
        <ul className="mt-5 grid max-w-2xl gap-x-10 gap-y-5 sm:grid-cols-2">
          {AUDIENCES.map((a) => (
            <li key={a.who} className="border-t border-white/10 pt-4">
              <p className="font-bold text-foreground">{a.who}</p>
              <p className="mt-1 text-read leading-relaxed text-muted-foreground">{a.gets}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-2xl text-read font-bold leading-relaxed text-foreground">{HONESTY_LINE}</p>
      </StoryRow>
    </section>
  )
}

function NextChapter() {
  const c = CHAPTERS.next
  return (
    <section id={anchorOf('next')} aria-labelledby={`${anchorOf('next')}-title`} className="scroll-mt-24">
      <StoryRow kind="chapter" spine={<HorizonSpine />} margin={<Margin id="next" />}>
        <ChapterTitle id="next" />
        <Prose paragraphs={c.paragraphs} />
        {/* التوقيعُ بخطّ اليد — كما تُختم الرسالة */}
        <p className="about-hand mt-8 -rotate-2 text-[1.75rem] leading-tight text-teal-light-ink md:text-[2.1rem]">فريق وجيز</p>
      </StoryRow>
    </section>
  )
}

/* ─────────── الختام ─────────── */

function Closing() {
  return (
    <Panel as="section" tone="accent" aria-labelledby="about-talk-title" className="md:p-10">
      <h2 id="about-talk-title" className="text-2xl font-black md:text-[2rem]">{CLOSING.title}</h2>
      <p className="mt-3 max-w-2xl text-base leading-loose text-foreground">{CLOSING.body}</p>
      <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button as={Link} to="/contact" tone="primary" size="lg">تواصل معنا</Button>
        <Button as={Link} to="/contact?type=company" tone="ghost">عرضٌ لمؤسستك أو جهتك</Button>
        <Button as={Link} to="/join-trainer" tone="ghost">انضمّ إلى فريقنا التدريبي</Button>
      </div>
    </Panel>
  )
}

function Sources() {
  return (
    <details className="group mt-10 max-w-3xl">
      {/* `inline-flex` يُسقط مثلّثَ الكشف الذي يرسمه المتصفّح — فالسهمُ هنا
          يقول «يُفتح»، وينقلب حين يُفتح. */}
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden gap-1.5 text-read font-bold text-muted-foreground transition hover:text-foreground">
        من أين هذه الأرقام؟
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="mt-3 space-y-4">
        {aboutSources().map((s) => (
          <li key={`${s.claim}|${s.url}`} className="text-read leading-relaxed text-muted-foreground">
            <span className="font-bold text-foreground">{s.claim}</span>
            {' — '}
            {s.source}
            {' '}
            <a href={s.url} target="_blank" rel="noreferrer" className="font-bold text-teal-light-ink underline underline-offset-4">
              المصدر<span className="sr-only"> (يفتح في نافذة جديدة)</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  )
}

export default function About() {
  /* الكتالوجُ حيّ: عددُ المسارات والدورات يُقرأ من اللقطة المنشورة لا يُكتب */
  usePublishedContent()
  /* جدارُ المؤسّسات يظهر بـ`.reveal` — ولا يظهر بلا هذا الخطّاف */
  useReveal()
  return (
    <SiteShell>
      <SeoHead {...seoFor('/p/about')} />
      <style>{CSS}</style>
      <div className="mx-auto max-w-6xl">
        <Hero />
        <div className="mt-4 md:mt-8">
          <AppChapter />
          <MaharatChapter />
          <AcademyChapter />
          <NextChapter />
        </div>
        <div className="mt-4 md:mt-8">
          <Closing />
          <Sources />
        </div>
      </div>
    </SiteShell>
  )
}
