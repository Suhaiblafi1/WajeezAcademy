import { Link } from 'react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, BadgeCheck, Check, Sparkles, GraduationCap, ShieldCheck, Search, Star, Clock, ChevronDown, BookOpen, MapPin,
} from 'lucide-react'
import { TRAINER_POOLS, TRAINER_PENDING_AR, courseById } from '@/data/courses'
import { apiGet } from '@/services/api'
import { usePublishedContent } from '@/services/public-content'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'
import { seoFor } from '@/application/site/public-pages'
import { Panel, Card, Inset } from '@/components/ui/Surface'
import { countAr } from '@/application/text/count-ar'
import { pitchHeadingAr } from '@/application/trainer/pitch'
import { NO_NEXT_SEASON_AR, seasonHeadingAr, type SeasonGroup } from '@/application/trainer/next-season'

interface PublicTrainer {
  id: string; name: string; headline: string | null; bio: string | null;
  country: string | null; specialties: string[]; assignedCourseIds: string[];
  /* ما يقدّمه للموسم القادم بمواسمه — والعلّةُ في `src/application/trainer/next-season.ts` */
  offer?: SeasonGroup[];
  photoUrl: string | null;
  ratingAvg: number | null; ratingCount: number | null;
  /* ١و — تعليقات اعتمدتها الإدارة للنشر؛ فارغة حتى ذلك */
  testimonials?: { score: number; commentAr: string }[];
  hoursTaught: number | null; graduatesCount: number | null;
  /* «لماذا نفتخر به» المقبولُ وحدَه — فارغٌ حتّى يقبل (`trainer-pitch.service.ts`) */
  pitch?: string[];
}

/* أسماء العائلات بالعربية */
const FAMILY_LABEL: Record<string, string> = {
  FND: 'الأساسيات', STU: 'الطلاب والجاهزية المهنية', CAREER: 'التحول المهني',
  EMP: 'تطوير الموظفين', GOV: 'القطاع الحكومي', BIZ: 'الأعمال وريادة المشاريع',
  FREE: 'العمل الحر', LEAD: 'القيادة', FAM: 'المسارات الأسرية', WELL: 'التركيز والرفاه',
}

const SPECIALTIES_PREVIEW = 6

/* ───────────────── ما يقدّمه المدرّب — دوراتُه ومسارُه ─────────────────

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): في نبذة كلّ مدرّبٍ «كلُّ الدورات التي
   سيقدّمها وأُسندت له، ليصل الناسُ إلى دوراته أو مساره إن كان له مسار،
   فيشتري المشتري مباشرةً من هناك».

   والمسارُ **يُشتقّ** من دوراته لا يُكتب بيد: لا رابطَ في البيانات بين مدرّبٍ
   ومسار، وكلُّ دورةٍ لها مسارُها الأمّ. فمسارُ المدرّب هو ما تجتمع فيه دوراتُه
   المسنَدة — واحدٌ غالبا، وقد يكون اثنين لمن يدرّس في مسارين.

   ═══ وصارت ما يقدّمه للموسم القادم وحدَه، تحت «سيقدم فلان في موسم كذا» (١٩ أكتوبر ٢٠٢٦) ═══
   «لماذا تظهر كلُّ الدورات للمدرّب وليس للموسم القادم؟» (صاحب المنصّة) — `next-season.ts`.
   ثمّ صار الرأسُ اسمَ الموسم وحدَه (٢٠ أكتوبر ٢٠٢٦): «طويلة.. اجعلها فقط اسم الموسم!».

   ═══ ورُفع سطرُ «يقدّم في مسارات» (١٩ أكتوبر ٢٠٢٦) ═══
   «الغِ قسم "ما يقدّم من مسارات"» (صاحب المنصّة) — بعد «الكلام مكتظ» على البطاقة نفسها. فالبطاقةُ دوراتُه
   بمواسمها وحدَها، وكلُّ دورةٍ بابُها إلى صفحتها، وصفحتُها تدلّ على مسارها. */
/** «3 دورات» بصيغتها — والاثنتان «دورتان» لا «2 دورتان» */
const coursesCountAr = (n: number) =>
  n === 2 ? 'دورتان' : countAr(n, { one: 'دورة', two: 'دورتان', few: 'دورات', many: 'دورة' })

function TrainerOffer({ groups }: { groups: SeasonGroup[] }) {
  /* الكتالوجُ يُحمَّل كسولا ويُستبدل وقتَ التشغيل (`core-catalog-source.ts`).
     وكانت النبذةُ تُصيَّر عند فتحها فقط فتجده غالبا قد وصل؛ وصارت تُصيَّر مع
     البطاقة مخفيّةً — فلو حُسبت قبل وصوله لَبقيت «لم تسند إليه شعبة» لمن له
     دورة. فتُعاد عند كلّ تثبيتٍ للقطة. */
  const catalogVersion = usePublishedContent()
  const seasons = useMemo(
    () => groups
      .map((g) => ({ termAr: g.termAr, courses: g.courseIds.map((id) => courseById(id)).filter((c): c is NonNullable<typeof c> => Boolean(c)) }))
      .filter((g) => g.courses.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- إبطال ذاكرة عند تبديل الكتالوج
    [groups, catalogVersion],
  )
  const courses = useMemo(() => seasons.flatMap((g) => g.courses), [seasons])

  if (courses.length === 0) {
    return (
      <p className="text-read leading-6 text-muted-foreground">
        {NO_NEXT_SEASON_AR}
      </p>
    )
  }

  return (
    <div>
      {/* ═══ الأقربُ مفتوحٌ وما بعده يُطوى — بمسافةٍ وخطٍّ أصغرَ وأخفّ (١٩ أكتوبر ٢٠٢٦) ═══
          «الكلام مكتظ.. يجب أن تنسدل دورات الفصول الأخرى، واترك مسافات، وخفّف حجم الخط واجعله لايت»
          (صاحب المنصّة، على بطاقةٍ بثماني دوراتٍ في ثلاثة مواسم). فالموسمُ القادمُ ظاهر، وكلُّ موسمٍ بعده
          سطرٌ واحدٌ بعدد دوراته يُفتح بطلب. وأسماءُ الدورات ١٢ بوزنٍ خفيف (٣٠٠ — خطُّ الموقع يحمله). */}
      {seasons.map((g, i) => {
        const list = (
          <ul className="mt-2.5 grid gap-2">
            {g.courses.map((c) => (
              <li key={c.id}>
                <Inset as={Link} interactive to={`/build/${c.id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="min-w-0 truncate text-fine font-light text-foreground">{c.name}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-fine font-normal text-teal-light-ink">
                    تفاصيل الدورة
                    <ArrowLeft className="h-3 w-3" />
                  </span>
                </Inset>
              </li>
            ))}
          </ul>
        )
        return i === 0 ? (
          <div key={g.termAr ?? "later"} className="mt-5">
            {/* اسمُ الموسم ١٢ لا ١٤ — «اجعل خط اسم الموسم أصغر» (صاحب المنصّة، ٢٠ أكتوبر ٢٠٢٦). وهو رأسٌ
                تحت اسم المدرّب (h3) فـh4، لا فقرةُ متن. */}
            <h4 className="flex items-center gap-1.5 text-fine font-medium text-foreground">
              <BookOpen className="h-3.5 w-3.5 text-teal-light-ink" />
              {seasonHeadingAr(g.termAr)}
            </h4>
            {list}
          </div>
        ) : (
          <details key={g.termAr ?? "later"} className="group mt-4 border-t border-white/10 pt-4">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-fine font-normal text-muted-foreground transition hover:text-foreground [&::-webkit-details-marker]:hidden">
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" />
              <span className="min-w-0 flex-1">{seasonHeadingAr(g.termAr)}</span>
              <span className="shrink-0">{coursesCountAr(g.courses.length)}</span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            {list}
          </details>
        )
      })}
    </div>
  )
}

/* ───────────────── صورةُ المدرّب — وما يحلّ محلَّها ─────────────────

   كانت دائرةً بستّةٍ وخمسين بكسلا، فكان الوجهُ أصغرَ ما في البطاقة وأوسمةُ
   التخصّص أكبرَه. وقرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦) «صورهم أكبر» وهيئةُ
   «الملفّ المهنيّ» من ثلاثٍ عُرضت عليه: مربّعٌ بمئةٍ وستّين بكسلا، والصورةُ
   المرفوعةُ ٥١٢ فتبقى حادّةً على شاشةٍ مضاعفة.

   وصارت الصورةُ تملأ طولَ البطاقة بجوار النصّ (١٩ أكتوبر ٢٠٢٦): «لا تترك فراغا تحت
   الصورة — كبّرها أو غيّر شكل الصندوق». فعرضُها ١٧٦–١٩٢ وطولُها طولُ ما بجوارها، ولا
   تقصر عن ١٧٦. وعلى الهاتف تبقى مربّعا بجوار الاسم، والنصُّ تحتها بعرض البطاقة.

   ── وصورةٌ لا تصل لا تُترك مكسورة ──

   كانت `<img>` بلا `onError`: كائنٌ مُحي من القرص أو رفعٌ تُرك في منتصفه
   (`trainer-review.service.ts` · `startPhotoUpload`) يردّ ٤٠٤، فيرى الزائرُ
   أيقونةَ صورةٍ مكسورةٍ ونصَّها البديل. فالخطأُ يردّها إلى ما يُعرض لمن لا
   صورةَ له أصلا — حروفُ اسمه على أرضيّة العلامة. */

/* «Reine Metlej» ← «RM»، و«احمد صالح» ← «أ». والعربيّةُ حرفٌ واحد: حرفان
   منفصلان منها لا يُقرآن اسما. والألفُ المجرّدةُ تُرسم بهمزتها، وإلّا قُرئت
   خطّا عموديّا أو «I». */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0] ?? ''
  if (/^[A-Za-z]/.test(first)) {
    const last = words.length > 1 ? words[words.length - 1] : ''
    return (first[0] + (last[0] ?? '')).toUpperCase()
  }
  const ch = first.slice(0, 1)
  return ch === 'ا' ? 'أ' : ch
}

/* أرضيّةُ الحروف: فيروزيٌّ معمّقٌ بضوءٍ من زاويةٍ ودوائرَ خافتة — لتُقرأ
   مقصودةً بجوار الصور لا مكانا فارغا. والألوانُ من رموز السمة لا حرفيّة. */
const MONOGRAM_FIELD = {
  backgroundImage:
    'radial-gradient(120% 85% at 80% 0%, rgb(var(--teal-light) / 0.5), transparent 62%), '
    + 'repeating-radial-gradient(circle at 15% 115%, rgb(255 255 255 / 0.08) 0 1.5px, transparent 1.5px 16px)',
}

function TrainerPhoto({ t }: { t: PublicTrainer }) {
  const [failed, setFailed] = useState(false)
  const box = 'h-24 w-24 shrink-0 rounded-2xl sm:row-span-2 sm:h-full sm:min-h-44 sm:w-44 lg:w-48'
  if (t.photoUrl && !failed) {
    return (
      <img
        src={t.photoUrl}
        alt={`صورة ${t.name}`}
        width={160}
        height={160}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`${box} object-cover object-[50%_30%]`}
      />
    )
  }
  /* `bg-teal-deep` مع `text-white` يبقى أبيضَ في المظهر النهاريّ (`styles/light.css`) */
  return (
    <span aria-hidden="true" style={MONOGRAM_FIELD} className={`${box} grid place-items-center bg-teal-deep text-4xl font-black text-white sm:text-5xl`}>
      {initialsOf(t.name)}
    </span>
  )
}

/* ───────────────── بطاقةُ المدرّب — ملفٌّ مهنيّ ─────────────────

   كانت رأسا (اسمٌ وتعريفٌ وأوسمة) ونبذةً مطويّةً كلُّها خلف زرّ — فأوّلُ ما
   يعرّف بالمدرّب، خبرتُه بكلامه، لا يُرى إلّا لمن ضغط. فصارت ثلاثةُ أسطرٍ من
   النبذة ظاهرةً، والزرُّ يكمل النبذةَ ويفتح الأرقامَ والتعليقاتِ ودوراتِه.

   والنبذةُ عنصرٌ واحدٌ يتنقّل بالشبكة: بجوار الصورة على الشاشة العريضة،
   وتحتها بعرض البطاقة على الهاتف — لا نسختان تُخفى إحداهما.

   ── و«لماذا نفتخر به» مكانَ النبذة متى قبله (١٩ أكتوبر ٢٠٢٦) ──

   اختار صاحبُ المنصّة من هيئتين عُرضتا عليه بلقطات: سطورُنا في البطاقة، ونبذتُه
   بكلامه أوّلَ ما يُفتح بالزرّ — لا الاثنتان معا فيطولَ الصندوقُ ويتكرّر المعنى. ومن
   لم يقبل بعدُ تبقى نبذتُه مكانَها كما كانت. */

/** سطورُنا عنه — حقائقُ من نبذته في صندوقٍ يُقرأ بنظرة (`application/trainer/pitch.ts`) */
function PitchBlock({ t }: { t: PublicTrainer }) {
  return (
    <Inset tone="accent" className="col-span-2 mt-3 px-4 py-3 sm:col-span-1 sm:col-start-2">
      <p className="flex items-center gap-1.5 text-sm font-black text-teal-ink">
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
        {pitchHeadingAr(t.name)}
      </p>
      <ul className="mt-2 space-y-1.5">
        {(t.pitch ?? []).map((l) => (
          <li key={l} className="flex items-start gap-2 text-read leading-6 text-foreground/85">
            <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-teal-ink" aria-hidden="true" />
            {l}
          </li>
        ))}
      </ul>
    </Inset>
  )
}
function TrainerCard({ t, open, onToggle }: { t: PublicTrainer; open: boolean; onToggle: () => void }) {
  const panelId = `trainer-bio-${t.id}`
  const courses = new Set(t.assignedCourseIds).size
  const pitched = (t.pitch?.length ?? 0) > 0
  return (
    /* والمعرّفُ مرساةُ «شاهد بطاقتك» في بوّابة المدرّب (`ProfileSuggestions`) */
    <Card as="article" id={`trainer-${t.id}`} className="flex scroll-mt-24 flex-col transition hover:border-teal/40">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 sm:gap-x-5">
        <TrainerPhoto t={t} />
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-lg font-black leading-snug md:text-xl">
            {t.name}
            <BadgeCheck className="h-5 w-5 shrink-0 text-teal-ink" aria-label="مدرب موثق" />
          </h3>
          {t.headline && <p className="mt-1 line-clamp-2 text-read leading-6 text-foreground/80">{t.headline}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-read">
            {t.country && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
                {t.country}
              </span>
            )}
            {courses > 0 && (
              <span className="inline-flex items-center gap-1 font-bold text-teal-light-ink">
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                {countAr(courses, { one: 'دورة', two: 'دورتان', few: 'دورات', many: 'دورة' })}
              </span>
            )}
          </div>
        </div>
        {pitched ? <PitchBlock t={t} /> : t.bio && (
          <p className={`col-span-2 mt-3 whitespace-pre-line text-read leading-6 text-muted-foreground sm:col-span-1 sm:col-start-2 ${open ? '' : 'line-clamp-3'}`}>
            {t.bio}
          </p>
        )}
      </div>

      {t.specialties.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {t.specialties.map((s) => (
            <li key={s} className="rounded-full bg-teal/10 px-2.5 py-1 text-fine text-teal-light-ink">{s}</li>
          ))}
        </ul>
      )}

      <div id={panelId} hidden={!open} className="mt-4 space-y-3">
        {/* ونبذتُه بكلامه أوّلَ ما يُفتح — حين أخذ صندوقُنا مكانَها في البطاقة */}
        {pitched && t.bio && (
          <div>
            <p className="text-sm font-black">النبذة</p>
            <p className="mt-1 whitespace-pre-line text-read leading-6 text-muted-foreground">{t.bio}</p>
          </div>
        )}
        {/* الإحصاءات — تُعرض فقط عند وجود بيانات حقيقية مسجلة */}
        {(t.ratingAvg != null || t.hoursTaught != null || t.graduatesCount != null) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {t.ratingAvg != null && (
              <span className="inline-flex items-center gap-1 font-bold text-gold-ink">
                <Star className="h-3.5 w-3.5 fill-gold" />
                {t.ratingAvg.toFixed(1)}
                {t.ratingCount != null && <span className="font-normal text-muted-foreground">({t.ratingCount} تقييما)</span>}
              </span>
            )}
            {t.hoursTaught != null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-teal-ink" />
                {t.hoursTaught} ساعة تدريب معنا
              </span>
            )}
            {t.graduatesCount != null && (
              <span className="inline-flex items-center gap-1">
                <GraduationCap className="h-3.5 w-3.5 text-teal-ink" />
                {t.graduatesCount} خريجا
              </span>
            )}
          </div>
        )}

        {/* ١و — التعليقات المعتمَدة للنشر. المتوسّط أعلاه محسوبٌ على كل
            التقييمات لا على المعروض منها، فلا يُقرأ الاقتباس رقما. */}
        {t.testimonials && t.testimonials.length > 0 && (
          <div className="space-y-2">
            {t.testimonials.map((c, i) => (
              <Inset as="blockquote" key={i} className="px-3 py-2">
                <span className="mb-0.5 block text-fine font-bold text-gold-ink">{c.score} ★</span>
                <p className="text-read leading-6 text-muted-foreground">{c.commentAr}</p>
              </Inset>
            ))}
            <p className="text-read text-muted-foreground/50">
              تعليقات متعلمين نشرتها الأكاديمية. المتوسط أعلاه من كل التقييمات، لا من المنشور فقط.
            </p>
          </div>
        )}

        <TrainerOffer groups={t.offer ?? [{ termAr: null, courseIds: t.assignedCourseIds }]} />
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="mt-4 flex min-h-11 w-full items-center justify-between gap-2 border-t border-white/10 pt-3 text-sm font-bold text-teal-light-ink transition hover:text-foreground"
      >
        {open ? 'عرض أقل' : pitched ? 'النبذة والدورات' : 'النبذة كاملة والدورات'}
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
    </Card>
  )
}

/* «مدرب الكفاءة الرقمية» ← «الكفاءة الرقمية».

   الأسماءُ في `TRAINER_POOLS` أسماءُ **أدوار**، وتحت عنوان «المجالات التي
   نغطّيها» يبقى صدرُها («مدرب» و«مدربة») يجرّ العينَ إلى شخص — وهو ما نُزعت
   البطاقاتُ لأجله. فيُجرَّد في العرض وحدَه: الترشيحُ يبقى على الأصل، فمن بحث
   عن «مدربة» وجد. */
function domainOf(role: string): string {
  return role.replace(/^مدرّ?بة?\s+/, '')
}

/* ───────────────── صفحة الفريق التدريبي ─────────────────
   نزاهة تسويقية: لا يُنشر اسم مدرب إلا بعد اعتماده رسميا وامتلاكه
   public_visibility وبيانات حقيقية. التقييمات والساعات والخريجون
   تُعرض فقط عندما تُسجَّل فعليا — لا أرقام توضيحية. */
export default function Trainers() {
  /* المدربون المعتمدون للنشر العام — من API حصرا: active + موثق + public_visibility + موافقة نشر */
  const [approved, setApproved] = useState<PublicTrainer[]>([])
  const [q, setQ] = useState('')
  const [showAllSpecialties, setShowAllSpecialties] = useState(false)
  /* المفتوحُ من النبذات — أكثرُ من واحدةٍ معا: من يقارن مدرّبَين يفتحهما جنبا إلى جنب */
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  useEffect(() => {
    apiGet<PublicTrainer[]>('/api/trainers/public').then(setApproved).catch(() => setApproved([]))
  }, [])

  const query = q.trim()

  /* نجمع التخصصات الفريدة من كل العائلات مع عدد المسارات التي تحتاجها */
  const byRole = useMemo(() => {
    const map = new Map<string, Set<string>>()
    Object.entries(TRAINER_POOLS).forEach(([family, list]) =>
      list.forEach((t) => {
        const cur = map.get(t.role) ?? new Set<string>()
        cur.add(family)
        map.set(t.role, cur)
      })
    )
    return [...map.entries()]
  }, [])

  /* ترشيح المدربين المعتمدين: بالاسم أو التعريف أو التخصص أو اسم دورةٍ يقدّمها */
  const filteredApproved = useMemo(() => {
    if (!query) return approved
    const needle = query.toLowerCase()
    return approved.filter((t) =>
      t.name.toLowerCase().includes(needle) ||
      (t.headline ?? '').toLowerCase().includes(needle) ||
      t.specialties.some((s) => s.toLowerCase().includes(needle)) ||
      t.assignedCourseIds.some((id) => (courseById(id)?.name ?? '').toLowerCase().includes(needle))
    )
  }, [approved, query])

  /* ترشيح التخصصات: بالدور أو اسم العائلة */
  const filteredRoles = useMemo(() => {
    if (!query) return byRole
    const needle = query.toLowerCase()
    return byRole.filter(([role, familiesSet]) =>
      role.toLowerCase().includes(needle) ||
      [...familiesSet].some((f) => (FAMILY_LABEL[f] ?? f).toLowerCase().includes(needle))
    )
  }, [byRole, query])

  const visibleRoles = showAllSpecialties || query ? filteredRoles : filteredRoles.slice(0, SPECIALTIES_PREVIEW)

  return (
    <SiteShell>
      <SeoHead {...seoFor('/trainers')} />

      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-4 py-1.5 text-sm text-teal-light-ink">
          <GraduationCap className="h-3.5 w-3.5" />
          الفريق التدريبي
        </div>
        <h1 className="mt-5 text-3xl font-black md:text-4xl">مدربون متخصصون — بمراجعة بشرية حقيقية</h1>
        <p className="mx-auto mt-3 max-w-xl leading-8 text-muted-foreground">
          لكل دورة مدرب متخصص يراجع عملك بنفسه، ولكل مسار مدربان إلى ثلاثة.
        </p>
        <Card as="p" tone="warn" className="mx-auto mt-3 flex max-w-md items-center justify-center gap-2 px-4 py-2.5 text-read font-bold leading-6 text-gold-ink">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          {TRAINER_PENDING_AR} — لا ننشر اسما قبل اعتماده رسميا.
        </Card>

        {/* البحث بالاسم أو المجال أو الدورة */}
        <div className="relative mx-auto mt-6 max-w-md">
          <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو المجال أو الدورة…"
            aria-label="ابحث بالاسم أو المجال أو الدورة"
            className="w-full rounded-2xl border border-white/15 bg-white/[0.04] py-3 pl-4 pr-11 text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-teal/60 focus:outline-none"
          />
        </div>
      </div>

      {/* المدربون المعتمدون رسميا — يظهرون أولا وفقط بعد اكتمال الاعتماد والموافقة.

          البطاقةُ ملفٌّ مهنيّ (`TrainerCard`): صورةٌ كبيرةٌ وثلاثةُ أسطرٍ من النبذة
          ظاهرة، وزرٌّ يكمل الباقي. والطيُّ معلَنٌ لقارئ الشاشة بـ`aria-expanded`
          و`aria-controls`، لا `details` لأنّ الرأسَ يحمل روابطَ وصورةً لا تصلح
          داخل `summary`. */}
      {filteredApproved.length > 0 && (
        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-2xl font-black md:text-3xl">مدربون معتمدون</h2>
            <p className="text-read text-muted-foreground">
              {countAr(filteredApproved.length, { one: 'مدرب', two: 'مدربان', few: 'مدربين', many: 'مدربا' })}
            </p>
          </div>
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
            {filteredApproved.map((t) => (
              <TrainerCard key={t.id} t={t} open={expanded.has(t.id)} onToggle={() => toggle(t.id)} />
            ))}
          </div>
        </section>
      )}

      {/* ═══ ولا اسمَ مدرّبٍ قبل اعتماده — ولو خلت الصفحة ═══

          قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): «لا تظهر أيَّ مدرّبٍ حتّى لو
          مثالا، إلّا أن يكون معتمَدا لدينا».

          وكان هنا بطاقةٌ لكلّ تخصّصٍ: أيقونةُ قبّعةِ تخرّجٍ وعنوانٌ على هيئة
          اسمِ مهنة («مدرب الكفاءة الرقمية») وسطرٌ يقول «يُعلن المدرب بعد
          اعتماد الشعبة». وهي صادقةٌ في نصّها **وتُقرأ أشخاصا في شكلها** —
          فمن مسح الصفحةَ بعينه رأى فريقا، ثمّ قرأ فعلم أنّه لا أحد.

          والمعتمَدون اليومَ صفر (قيس بـ`/api/trainers/public`). فنزعُ
          البطاقات يُفرِغ الصفحة، وتركُها يخالف القرار. فالثالثةُ: تبقى
          التخصّصاتُ **وسوما تُقرأ مجالاتٍ لا أشخاصا**، ويعلو ذلك بيانُ حالٍ
          يقول ما هو واقعٌ فعلا. */}
      {filteredApproved.length === 0 && !query && (
        <Card tone="accent" className="mt-12 text-center">
          <h2 className="text-lg font-black">لم يعتمد نشر اسم مدرّب بعد</h2>
          <p className="mx-auto mt-3 max-w-xl text-read leading-7 text-muted-foreground">
            لا ننشر اسم مدرّب قبل اعتماد نشره. ستظهر هنا أسماء من اجتازوا
            المراجعة فعلا، لا أمثلة ولا صور توضيحية. ويظهر مدرّب كل شعبة
            على بطاقتها عند اعتمادها.
          </p>
        </Card>
      )}

      {/* المجالاتُ التي نغطّيها — وسوما لا بطاقاتٍ تُقرأ أشخاصا */}
      {visibleRoles.length > 0 && (
        <section className="mt-12">
          <h2 className="text-center text-lg font-black">المجالات التي نغطّيها</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-read leading-6 text-muted-foreground">
            تخصّصات يطلبها كتالوج وجيز — لا أسماء مدرّبين.
          </p>
          <ul className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-1.5">
            {visibleRoles.map(([role]) => (
              <li key={role} className="rounded-full border border-teal/25 bg-teal/10 px-2.5 py-1 text-fine text-teal-light-ink">
                {domainOf(role)}
              </li>
            ))}
          </ul>
          {!showAllSpecialties && !query && filteredRoles.length > SPECIALTIES_PREVIEW && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setShowAllSpecialties(true)}
                className="inline-flex items-center gap-2 text-read font-bold text-teal-light-ink underline underline-offset-4"
              >
                عرض كل التخصصات ({filteredRoles.length})
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>
      )}

      {query && filteredApproved.length === 0 && visibleRoles.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">لا نتائج مطابقة لـ«{query}» — جرّب اسما أو مجالا أو دورة.</p>
      )}

      <Panel tone="accent" className="mt-14 p-8 text-center">
        <p className="text-lg font-bold">هل أنت خبير وتريد التدريب معنا؟</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-foreground">
          نبحث دائما عن مدربين يهتمون بالتطبيق العملي مثلنا. قدّم طلبك وسيراجعه فريقنا.
        </p>
        <Link to="/join-trainer" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-teal-deep px-8 py-3.5 font-bold text-white transition hover:bg-teal-darker">
          انضم كمدرب
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Panel>
    </SiteShell>
  )
}
