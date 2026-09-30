import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Award, Building2, Check, Compass, ExternalLink, Headphones, FolderCheck, ScrollText, type LucideIcon } from 'lucide-react'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import { Panel } from '@/components/ui/Surface'
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
   (الأكاديميةُ من وجيز)، ثمّ تقول ما يميّزنا — وأن يبقى إبداعُ الرسم الذي
   كان. والنصُّ كلُّه في `data/about.ts`، وهنا الرسمُ وحدَه.

   ── الفكرة ──

   خطٌّ في هامش الصفحة يروي الرحلةَ بشكله: **نقطةُ بداية** (التشخيص مع
   المستشار)، ثمّ **ثلاثةُ خيوطٍ** تتفرّع وتلتئم (مصادرُ متنوّعة)، ثمّ
   **طريقٌ بمحطّات** (التدريب العمليّ)، ثمّ **علامةُ اعتماد** (تقييمُ
   الخبراء)، ثمّ **معيّنٌ ذهبيّ** (مشروعُ التخرّج)، ثمّ خطٌّ يبهت (السعر).
   وبجانبه طوال الصفحة **خطٌّ ذهبيٌّ منقَّط** لا ينقطع: المستشارُ الذي
   يرافقك.

   وكان في الصدر رسمٌ أفقيٌّ مصغَّرٌ للرحلة بمحطّاتٍ تحته — حُذف بطلب صاحب
   المنصّة (٣٠ سبتمبر ٢٠٢٦): «لا داعي له»، فالخطُّ في الهامش يقوله.

   ── وما حُرس ──

   · الخطُّ بخطّ المنصّة لا بالرقعة — طلبُ «خطوطٍ مناسبةٍ لنا».
   · الرسمُ زخرفةٌ `aria-hidden`؛ والمعنى كلُّه نصٌّ بعناوينه.
   · رئيسيٌّ ذهبيٌّ واحد («تواصل معنا»)، والتشخيصُ فيروزيٌّ مُثبِت
     (`src/tests/one-primary-per-screen.test.ts`).
   · لا شيءَ من الرئيسيّة يتكرّر هنا: لا شعارات ولا أرقامَ ثقة. */

const anchorOf = (id: string) => `about-${id}`

/* لكلّ أخٍ لونُه: التطبيقُ فيروزيّ، ووجيز مهارات ذهبيّة — والعلامةُ واحدة */
const PRODUCT_STYLE = {
  app: { Icon: Headphones, badge: 'bg-teal text-on-teal', cta: 'bg-teal-deep text-white group-hover:bg-teal-darker' },
  maharat: { Icon: Building2, badge: 'bg-gold text-on-gold', cta: 'bg-gold text-on-gold group-hover:brightness-95' },
} as const

/* ─────────── الافتتاح: هذا نحن ───────────

   طلب صاحبُ المنصّة (٣٠ سبتمبر ٢٠٢٦) أن يُبرَز التعريفُ «هذا نحن»: لوحةٌ
   فيروزيّةٌ بعلامة وجيز، واسمُ الأكاديمية كبيرا. وأن
   يكون أخواها كالإعلان الذي نفخر به: بطاقةٌ بيضاءُ لكلٍّ منهما بعلامةٍ ولونٍ
   واسمٍ لاتينيٍّ وزرٍّ إلى موقعه — والبطاقةُ كلُّها رابط.

   والألوانُ هنا ثابتةٌ في الوضعين عمدا: اللوحةُ فيروزيٌّ عميقٌ بحبرٍ أبيض،
   والبطاقاتُ بيضاءُ بحبر `on-teal` — فلا شيءَ فيها ينقلب فيبهت. */
function FamilyIntro() {
  return (
    <section
      aria-labelledby="about-family-title"
      className="relative isolate overflow-hidden rounded-[2rem] bg-teal-deep bg-gradient-to-bl from-teal-deep via-teal-darker to-teal-deep px-5 py-9 text-white md:px-12 md:py-14"
    >
      {/* علامةُ وجيز خلفيّةً كبيرةً باهتة — توقيعُ العائلة */}
      <img src="/logo-mark.png" alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-16 -z-10 h-72 w-72 rotate-12 opacity-[0.12] md:h-[26rem] md:w-[26rem]" />

      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-md shadow-black/10 md:h-14 md:w-14">
          <img src="/logo-mark.png" alt="" aria-hidden="true" className="h-8 w-8 rounded-lg md:h-10 md:w-10" />
        </span>
        <span className="rounded-full bg-white/15 px-3 py-1 text-read font-bold">من نحن</span>
      </div>

      <h1 id="about-family-title" className="mt-6 text-[2.4rem] font-black leading-[1.25] md:text-6xl">{FAMILY_INTRO.title}</h1>
      <p className="mt-5 max-w-2xl text-base leading-loose text-white md:text-lg md:leading-loose">{FAMILY_INTRO.body}</p>

      <ul className="mt-9 grid gap-4 md:grid-cols-2">
        {FAMILY_INTRO.products.map((p) => {
          const st = PRODUCT_STYLE[p.id]
          return (
            <li key={p.url}>
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="group flex h-full flex-col rounded-3xl bg-white p-5 text-on-teal shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold md:p-6"
              >
                <span className="flex items-center gap-3">
                  <span className="relative shrink-0">
                    <img src="/logo-mark.png" alt="" aria-hidden="true" className="h-14 w-14 rounded-2xl" />
                    <span className={`absolute -bottom-1.5 -left-1.5 grid h-7 w-7 place-items-center rounded-full ring-[3px] ring-white ${st.badge}`}>
                      <st.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xl font-black leading-tight">{p.name}</span>
                    <span className="block text-read font-bold tracking-wide opacity-60" dir="ltr">{p.latin}</span>
                  </span>
                </span>
                <span className="mt-4 block text-base font-bold leading-relaxed">{p.note}</span>
                <span className="mt-1 block text-read leading-relaxed opacity-75">{p.pitch}</span>
                <span className={`mt-5 inline-flex min-h-[44px] items-center gap-2 self-start rounded-full px-4 text-read font-black transition ${st.cta}`}>
                  <span dir="ltr">{p.host}</span>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="sr-only">(يفتح في نافذة جديدة)</span>
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** يُلوّن من السطر ما سُمّي في `highlights` — والسطرُ نفسُه لا يتغيّر نصّا */
function Highlighted({ line }: { line: string }) {
  const hit = FEATURE_HERO.highlights.find((h) => line.includes(h))
  if (!hit) return <>{line}</>
  const [before, after] = line.split(hit)
  const gold = hit === FEATURE_HERO.highlights[1]
  return (
    <>
      {before}
      <span className={gold ? 'bg-gold/25 px-1.5 [box-decoration-break:clone] rounded-lg text-foreground' : 'text-teal-light-ink'}>{hit}</span>
      {after}
    </>
  )
}

function Hero() {
  return (
    <div className="pb-4 pt-14 md:pt-20">
      <p className="text-read font-black text-teal-light-ink">ما يميّزنا</p>
      <h2 className="mt-3 max-w-4xl text-[1.85rem] font-black leading-[1.5] md:text-5xl md:leading-[1.35]">
        {FEATURE_HERO.lines.map((line) => (
          <span key={line} className="block text-balance"><Highlighted line={line} /></span>
        ))}
      </h2>
      <p className="mt-6 max-w-2xl border-s-4 border-gold ps-4 text-base leading-loose text-foreground md:text-lg md:leading-loose">
        {FEATURE_HERO.lead}
      </p>
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
      <div className="mx-auto max-w-6xl">
        <FamilyIntro />
        <Hero />
        <div className="mt-4 md:mt-8"><FeatureChapters /></div>
        <div className="mt-4 md:mt-8"><Closing /></div>
      </div>
    </SiteShell>
  )
}
