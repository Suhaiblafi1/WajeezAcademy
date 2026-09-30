import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Award, Building2, Check, Compass, ExternalLink, Headphones, FolderCheck, ScrollText, type LucideIcon } from 'lucide-react'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import { Card, Panel } from '@/components/ui/Surface'
import { seoFor } from '@/application/site/public-pages'
import { countAr } from '@/application/text/count-ar'
import { usePublishedContent } from '@/services/public-content'
import { pathways, pathwayDomains } from '@/data/pathways'
import { courses } from '@/data/courses'
import {
  CLOSING, FAMILY_INTRO, FEATURES, FEATURE_HERO, HONESTY_LINE, OUTCOMES, PRICE, SOURCE_KINDS,
  type FeatureId, type Outcome,
} from '@/data/about'

/* ═════════ «من نحن» — الرحلةُ خطٌّ واحدٌ يتغيّر شكلُه ═════════

   طلب صاحبُ المنصّة (٣٠ سبتمبر ٢٠٢٦) أن تبدأ الصفحةُ بتعريفٍ مختصر
   (الأكاديميةُ جزءٌ من وجيز)، ثمّ تقول ما يميّزنا — وأن يبقى إبداعُ الرسم
   الذي كان. والنصُّ كلُّه في `data/about.ts`، وهنا الرسمُ وحدَه.

   ── الفكرة ──

   خطٌّ في هامش الصفحة يروي الرحلةَ بشكله: **نقطةُ بداية** (التشخيص مع
   المستشار)، ثمّ **ثلاثةُ خيوطٍ** تتفرّع وتلتئم (مصادرُ متنوّعة)، ثمّ
   **طريقٌ بمحطّات** (التدريب العمليّ)، ثمّ **علامةُ اعتماد** (تقييمُ
   الخبراء)، ثمّ **معيّنٌ ذهبيّ** (مشروعُ التخرّج)، ثمّ خطٌّ يبهت (السعر،
   وما بعد الرحلة). وبجانبه طوال الصفحة **خطٌّ ذهبيٌّ منقَّط** لا ينقطع:
   المستشارُ الذي يرافقك. والصدرُ يرسم ذلك كلَّه أفقيّا مصغَّرا، ومحطّاتُه
   روابطُ إلى أقسامها.

   ── وما حُرس ──

   · الخطُّ بخطّ المنصّة لا بالرقعة — طلبُ «خطوطٍ مناسبةٍ لنا».
   · الحركةُ لحظةٌ واحدة عند الفتح، ولا تُكتب إلّا تحت
     `prefers-reduced-motion: no-preference`.
   · الرسمُ زخرفةٌ `aria-hidden`؛ والمعنى كلُّه نصٌّ بعناوينه.
   · رئيسيٌّ ذهبيٌّ واحد («تواصل معنا»)، والتشخيصُ فيروزيٌّ مُثبِت
     (`src/tests/one-primary-per-screen.test.ts`).
   · لا شيءَ من الرئيسيّة يتكرّر هنا: لا شعارات ولا أرقامَ ثقة. */

const CSS = `
@media (prefers-reduced-motion: no-preference) {
  .about-draw { stroke-dasharray: 1; stroke-dashoffset: 1;
    animation: about-draw .7s cubic-bezier(.4,.1,.4,1) forwards; animation-delay: var(--at); }
  .about-node { transform-box: fill-box; transform-origin: center; transform: scale(0);
    animation: about-node .35s cubic-bezier(.2,.9,.3,1.3) forwards; animation-delay: var(--at); }
  .about-fade-in { opacity: 0; animation: about-fade .9s ease-out forwards; animation-delay: var(--at); }
}
@keyframes about-draw { to { stroke-dashoffset: 0 } }
@keyframes about-node { to { transform: scale(1) } }
@keyframes about-fade { to { opacity: 1 } }
`

const anchorOf = (id: string) => `about-${id}`

/* ─────────── الصدر: رسمُ الرحلة ─────────── */

function JourneyDrawing() {
  const at = (s: number) => ({ ['--at' as string]: `${s}s` })
  return (
    <div className="mt-12 md:mt-16">
      <svg viewBox="0 0 1000 130" className="h-auto w-full overflow-visible" aria-hidden="true" focusable="false">
        {/* المستشار: خطٌّ ذهبيٌّ منقَّطٌ تحت الرحلة كلّها */}
        <path className="about-fade-in stroke-gold" style={at(1.9)} d="M900 104 H100" fill="none" strokeWidth={2.5} strokeDasharray="1 9" strokeLinecap="round" />
        <circle className="about-node fill-gold" style={at(0.2)} cx={900} cy={104} r={4} />

        {/* ١) البداية — نقطةٌ واحدةٌ منها يبدأ كلّ شيء */}
        <circle className="about-node fill-teal" style={at(0.1)} cx={900} cy={52} r={11} />
        <path className="about-draw stroke-teal" style={at(0.3)} pathLength={1} d="M889 52 H780" fill="none" strokeWidth={3.5} strokeLinecap="round" />

        {/* ٢) مصادرُ متنوّعة — ثلاثةُ خيوطٍ تتفرّع ثمّ تلتئم */}
        <g fill="none" strokeLinecap="round" strokeWidth={3} style={at(0.7)}>
          <path className="about-draw stroke-teal" pathLength={1} d="M780 52 H620" />
          <path className="about-draw stroke-teal/50" pathLength={1} d="M780 52 C755 52 750 26 725 26 H675 C650 26 645 52 620 52" />
          <path className="about-draw stroke-teal/50" pathLength={1} d="M780 52 C755 52 750 78 725 78 H675 C650 78 645 78 620 52" />
        </g>

        {/* ٣) تدريبٌ عمليّ — طريقٌ بمحطّات */}
        <path className="about-draw stroke-teal" style={at(1.1)} pathLength={1} d="M620 52 H100" fill="none" strokeWidth={3.5} strokeLinecap="round" />
        {[560, 500, 440].map((x, i) => (
          <circle key={x} className="about-node fill-paper stroke-teal" style={at(1.2 + i * 0.08)} cx={x} cy={52} r={7} strokeWidth={3} />
        ))}

        {/* ٤) تقييمُ الخبراء — علامةُ اعتماد */}
        <g className="about-node" style={at(1.5)}>
          <circle className="fill-teal" cx={300} cy={52} r={13} />
          <path className="stroke-on-teal" d="M294 52 l4.5 4.5 l8 -9" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* ٥) مشروعُ التخرّج — الغاية */}
        <rect className="about-node fill-gold" style={at(1.75)} x={91} y={43} width={18} height={18} rx={3} transform="rotate(45 100 52)" />
      </svg>

      <nav aria-label="محطّات الرحلة">
        <ol className="grid grid-cols-5 gap-x-2 text-center md:gap-x-4">
          {FEATURES.map((f) => (
            <li key={f.id}>
              <a href={`#${anchorOf(f.id)}`} className="group block pt-3 md:pt-4">
                <span className="block text-read font-black leading-snug text-foreground transition group-hover:text-teal-light-ink md:text-base">
                  {f.station}
                </span>
                <span className="mt-0.5 hidden text-fine leading-snug text-muted-foreground sm:block">{f.stationNote}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <p className="mt-6 flex items-center justify-center gap-2 text-read font-bold text-gold-ink">
        <span className="inline-block w-8 border-t-2 border-dotted border-gold" aria-hidden="true" />
        مستشارُك معك على طول الطريق
      </p>
    </div>
  )
}

const PRODUCT_ICON = [Headphones, Building2] as const

/* الافتتاح: من نحن في سطرين، ثمّ أخوا الأكاديمية بموقعيهما — لا تاريخَ
   انتقالٍ ولا أرقام، فالأرقامُ في الرئيسيّة ومواقعِهما. */
function FamilyIntro() {
  return (
    <section aria-labelledby="about-family-title" className="grid gap-6 border-b border-white/10 pb-10 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-center md:gap-12 md:pb-12">
      <div>
        <p className="text-read font-black text-teal-light-ink">من نحن</p>
        <h1 id="about-family-title" className="mt-2 text-xl font-black leading-snug md:text-2xl">{FAMILY_INTRO.title}</h1>
        <p className="mt-3 max-w-2xl text-base leading-loose text-muted-foreground">{FAMILY_INTRO.body}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
        {FAMILY_INTRO.products.map((p, i) => {
          const Icon = PRODUCT_ICON[i]
          return (
            <li key={p.url}>
              <Card as="a" interactive href={p.url} target="_blank" rel="noreferrer" className="flex min-h-[44px] items-center gap-3 !px-4 !py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal-light-ink">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-black leading-snug text-foreground">{p.name}</span>
                  <span className="block text-fine leading-snug text-muted-foreground">{p.note}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-fine font-bold text-teal-light-ink" dir="ltr">
                  <span className="hidden sm:inline">{p.host}</span>
                  <ExternalLink className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                </span>
                <span className="sr-only">(يفتح في نافذة جديدة)</span>
              </Card>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Hero() {
  return (
    <div className="pb-4 pt-10 md:pt-14">
      <h2 className="max-w-4xl text-[2.1rem] font-black leading-[1.4] md:text-5xl md:leading-[1.3]">
        {FEATURE_HERO.lines.map((line) => (
          <span key={line} className="block text-balance">{line}</span>
        ))}
      </h2>
      <p className="mt-6 max-w-2xl text-base leading-loose text-muted-foreground md:text-lg md:leading-loose">
        {FEATURE_HERO.lead}
      </p>
      <JourneyDrawing />
    </div>
  )
}

/* ─────────── الصفّ: خطٌّ في الهامش، وكلمةٌ، ومتن ─────────── */

const ROW = 'grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[3.5rem_8.5rem_minmax(0,1fr)] md:gap-x-8'
const PAD = { margin: 'pt-12 md:pt-16', content: 'pb-14 md:pb-20 md:pt-16', node: 'top-12 md:top-16' }

function StoryRow({ spine, margin, children }: { spine: ReactNode; margin: ReactNode; children: ReactNode }) {
  return (
    <div className={ROW}>
      <div aria-hidden="true" className="relative col-start-1 row-span-2 row-start-1 md:row-span-1">
        {spine}
        {/* المستشار — خطٌّ ذهبيٌّ منقَّطٌ لا ينقطع بجانب كلّ فصل */}
        <span className="absolute inset-y-0 left-[88%] border-l-2 border-dotted border-gold/70" />
      </div>
      <div className={`col-start-2 row-start-1 ${PAD.margin}`}>{margin}</div>
      <div className={`col-start-2 row-start-2 pt-3 md:col-start-3 md:row-start-1 ${PAD.content}`}>{children}</div>
    </div>
  )
}

function Margin({ n, word, tone = 'teal' }: { n?: number; word: string; tone?: 'teal' | 'gold' }) {
  return (
    <p className="flex items-baseline gap-3 md:block">
      {n !== undefined && <span className="block text-fine font-bold tabular-nums text-muted-foreground">{String(n).padStart(2, '0')}</span>}
      <span className={`block text-xl font-black leading-tight md:mt-1 md:text-2xl ${tone === 'gold' ? 'text-gold-ink' : 'text-teal-light-ink'}`}>{word}</span>
    </p>
  )
}

/* ─────────── أشكالُ الخطّ ─────────── */

const LINE = 'absolute left-[42%] -translate-x-1/2'

function StartSpine() {
  return (
    <>
      <span className={`${LINE} bottom-0 top-12 w-[3px] bg-teal md:top-16`} />
      <span className={`${LINE} ${PAD.node} grid h-7 w-7 place-items-center rounded-full bg-teal text-on-teal md:h-9 md:w-9`}>
        <Compass className="h-4 w-4 md:h-5 md:w-5" />
      </span>
    </>
  )
}

const TRACK_X = ['22%', '42%', '62%'] as const

function Fork({ merge = false }: { merge?: boolean }) {
  const paths = merge
    ? ['M20 0 V40', 'M10.5 0 C10.5 22 20 18 20 40', 'M29.5 0 C29.5 22 20 18 20 40']
    : ['M20 0 V40', 'M20 0 C20 22 10.5 18 10.5 40', 'M20 0 C20 22 29.5 18 29.5 40']
  return (
    <svg viewBox="0 0 48 40" preserveAspectRatio="none" className="h-10 w-full shrink-0 overflow-visible" focusable="false">
      {paths.map((d, i) => (
        <path key={d} d={d} fill="none" strokeWidth={i === 0 ? 3 : 2} vectorEffect="non-scaling-stroke" className={i === 0 ? 'stroke-teal' : 'stroke-teal/45'} />
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
          <span key={x} className={`absolute inset-y-0 -translate-x-1/2 ${i === 1 ? 'w-[3px] bg-teal' : 'w-0.5 bg-teal/45'}`} style={{ left: x }} />
        ))}
      </div>
      <Fork merge />
    </div>
  )
}

function RouteSpine({ node }: { node: ReactNode }) {
  return (
    <>
      <span className={`${LINE} inset-y-0 w-[3px] bg-teal`} />
      <span className={`${LINE} ${PAD.node}`}>{node}</span>
    </>
  )
}

const StepNodes = () => (
  <span className="flex flex-col items-center gap-3">
    {[0, 1, 2].map((i) => <span key={i} className="block h-4 w-4 rounded-full bg-paper ring-[3px] ring-teal md:h-5 md:w-5" />)}
  </span>
)
const CheckNode = () => (
  <span className="grid h-7 w-7 place-items-center rounded-full bg-teal text-on-teal md:h-9 md:w-9">
    <Check className="h-4 w-4 md:h-5 md:w-5" strokeWidth={3} />
  </span>
)
const GoalNode = () => <span className="block h-5 w-5 rotate-45 rounded-[3px] bg-gold md:h-6 md:w-6" />

function HorizonSpine() {
  return (
    <span
      className={`${LINE} inset-y-0 border-l-2 border-dashed border-teal/50`}
      style={{ maskImage: 'linear-gradient(to bottom, black 40%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent)' }}
    />
  )
}

const SPINE: Record<FeatureId, ReactNode> = {
  advisor: <StartSpine />,
  sources: <TracksSpine />,
  training: <RouteSpine node={<StepNodes />} />,
  experts: <RouteSpine node={<CheckNode />} />,
  graduation: <RouteSpine node={<GoalNode />} />,
}

/* ─────────── قطعُ المتن ─────────── */

function Title({ id, children, gold = false }: { id: string; children: ReactNode; gold?: boolean }) {
  return (
    <h2 id={`${anchorOf(id)}-title`} className={`max-w-2xl text-2xl font-black leading-snug md:text-[2rem] md:leading-snug ${gold ? 'text-gold-ink' : ''}`}>
      {children}
    </h2>
  )
}

function Prose({ paragraphs }: { paragraphs: readonly string[] }) {
  return (
    <div className="mt-5 max-w-2xl space-y-4">
      {paragraphs.map((p) => (
        <p key={p} className="text-base leading-loose text-foreground md:text-[1.0625rem] md:leading-loose">{p}</p>
      ))}
    </div>
  )
}

const inline = 'inline-flex min-h-[44px] items-center text-read font-bold text-teal-light-ink underline-offset-4 hover:underline'
const PATHWAY_FORMS = { one: 'مسار', two: 'مساران', few: 'مسارات', many: 'مسارا' }
const COURSE_FORMS = { one: 'دورة', two: 'دورتان', few: 'دورات', many: 'دورة' }

const OUTCOME_ICON: Record<Outcome['id'], LucideIcon> = {
  certificate: Award,
  recommendation: ScrollText,
  portfolio: FolderCheck,
}

function Extras({ id }: { id: FeatureId }) {
  switch (id) {
    case 'advisor':
      return (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Button as={Link} to="/diagnostic" tone="confirm" size="lg">ابدأ التشخيص مجّانا</Button>
          <Link to="/methodology" className={inline}>كيف نصل إلى التوصية؟</Link>
        </div>
      )
    case 'sources':
      return (
        <ul className="mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          {SOURCE_KINDS.map((k) => (
            <li key={k} className="border-s-2 border-teal/40 ps-3 text-read font-bold text-foreground">{k}</li>
          ))}
        </ul>
      )
    case 'training': {
      const domains = pathwayDomains.filter((d) => d !== 'الكل')
      return (
        <>
          <p className="mt-5 max-w-2xl text-read leading-relaxed text-muted-foreground">
            في الكتالوج اليوم {countAr(pathways.length, PATHWAY_FORMS)} و{countAr(courses.length, COURSE_FORMS)}:
          </p>
          <ul className="mt-3 flex max-w-2xl flex-wrap gap-2">
            {domains.map((d) => <li key={d}><Chip>{d}</Chip></li>)}
          </ul>
          <div className="mt-6 flex flex-wrap gap-x-6">
            <Link to="/pathways" className={inline}>تصفّح المسارات</Link>
            <Link to="/courses" className={inline}>تصفّح الدورات</Link>
            <Link to="/trainers" className={inline}>تعرّف على الفريق التدريبي</Link>
          </div>
        </>
      )
    }
    case 'graduation':
      return (
        <>
          <ul className="mt-7 grid max-w-2xl gap-x-10 gap-y-6 sm:grid-cols-2">
            {OUTCOMES.map((o) => {
              const Icon = OUTCOME_ICON[o.id]
              return (
                <li key={o.id} className="flex items-start gap-3">
                  <Icon className="mt-1 h-5 w-5 shrink-0 text-gold-ink" aria-hidden="true" />
                  <div>
                    <p className="font-black leading-snug text-foreground">{o.title}</p>
                    <p className="mt-1 text-read leading-relaxed text-muted-foreground">
                      {o.body}
                      {o.link && (<>{' '}<Link to={o.link.to} className="font-bold text-teal-light-ink underline underline-offset-4">{o.link.label}</Link>.</>)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-8 max-w-2xl text-read font-bold leading-relaxed text-foreground">{HONESTY_LINE}</p>
        </>
      )
    default:
      return null
  }
}

function FeatureChapters() {
  return (
    <>
      {FEATURES.map((f, i) => (
        <section key={f.id} id={anchorOf(f.id)} aria-labelledby={`${anchorOf(f.id)}-title`} className="scroll-mt-24">
          <StoryRow spine={SPINE[f.id]} margin={<Margin n={i + 1} word={f.margin} tone={f.id === 'graduation' ? 'gold' : 'teal'} />}>
            <Title id={f.id} gold={f.id === 'graduation'}>{f.title}</Title>
            <Prose paragraphs={f.paragraphs} />
            <Extras id={f.id} />
          </StoryRow>
        </section>
      ))}
      <section id={anchorOf('price')} aria-labelledby={`${anchorOf('price')}-title`} className="scroll-mt-24">
        <StoryRow spine={<HorizonSpine />} margin={<Margin word={PRICE.margin} />}>
          <Title id="price">{PRICE.title}</Title>
          <Prose paragraphs={PRICE.paragraphs} />
          <p className="mt-8 text-2xl font-black text-teal-light-ink">فريق وجيز</p>
        </StoryRow>
      </section>
    </>
  )
}

function Closing() {
  return (
    <Panel as="section" tone="accent" aria-labelledby="about-talk-title" className="md:p-10">
      <h2 id="about-talk-title" className="text-2xl font-black md:text-[2rem]">{CLOSING.title}</h2>
      <p className="mt-3 max-w-2xl text-base leading-loose text-foreground">{CLOSING.body}</p>
      <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button as={Link} to="/contact" tone="primary" size="lg">تواصل معنا</Button>
        <Button as={Link} to="/join-trainer" tone="ghost">انضمّ إلى فريقنا التدريبي</Button>
      </div>
    </Panel>
  )
}

export default function About() {
  usePublishedContent()
  return (
    <SiteShell>
      <SeoHead {...seoFor('/p/about')} />
      <style>{CSS}</style>
      <div className="mx-auto max-w-6xl">
        <FamilyIntro />
        <Hero />
        <div className="mt-4 md:mt-8"><FeatureChapters /></div>
        <div className="mt-4 md:mt-8"><Closing /></div>
      </div>
    </SiteShell>
  )
}
