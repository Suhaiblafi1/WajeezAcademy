import { Link } from 'react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, BadgeCheck, GraduationCap, ShieldCheck, Search, Star, Clock, ChevronDown, Route, BookOpen,
} from 'lucide-react'
import { TRAINER_POOLS, TRAINER_PENDING_AR, courseById } from '@/data/courses'
import { pathwayById } from '@/data/pathways'
import { apiGet } from '@/services/api'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'
import { seoFor } from '@/application/site/public-pages'
import { Panel, Card, Inset } from '@/components/ui/Surface'

interface PublicTrainer {
  id: string; name: string; headline: string | null; bio: string | null;
  country: string | null; specialties: string[]; assignedCourseIds: string[];
  photoUrl: string | null;
  ratingAvg: number | null; ratingCount: number | null;
  /* ١و — تعليقات اعتمدتها الإدارة للنشر؛ فارغة حتى ذلك */
  testimonials?: { score: number; commentAr: string }[];
  hoursTaught: number | null; graduatesCount: number | null;
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
   المسنَدة — واحدٌ غالبا، وقد يكون اثنين لمن يدرّس في مسارين. */
function TrainerOffer({ ids }: { ids: string[] }) {
  const courses = useMemo(
    () => [...new Set(ids)].map((id) => courseById(id)).filter((c): c is NonNullable<typeof c> => Boolean(c)),
    [ids],
  )
  const offeredPathways = useMemo(
    () => [...new Set(courses.map((c) => c.pathwayId))].map((id) => pathwayById(id)).filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [courses],
  )

  if (courses.length === 0) {
    return (
      <p className="text-read leading-6 text-muted-foreground">
        لم تُسنَد إليه شعبةٌ منشورةٌ بعد — تظهر دوراتُه هنا فور إسنادها.
      </p>
    )
  }

  return (
    <div>
      {offeredPathways.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-read leading-6 text-foreground">
          <Route className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" />
          <span className="font-bold">{offeredPathways.length === 1 ? 'يقدّم في مسار:' : 'يقدّم في مسارات:'}</span>
          {offeredPathways.map((p, i) => (
            <span key={p.id}>
              <Link to={`/pathways/${p.id}`} className="font-bold text-teal-light-ink underline decoration-dotted underline-offset-4 transition hover:text-foreground">
                {p.shortName}
              </Link>
              {i < offeredPathways.length - 1 && '،'}
            </span>
          ))}
        </p>
      )}
      <p className="mt-2 flex items-center gap-1.5 text-read font-bold text-foreground">
        <BookOpen className="h-3.5 w-3.5 text-teal-light-ink" />
        دوراتُه — تُشترى من صفحتها
      </p>
      <ul className="mt-1.5 grid gap-1.5">
        {courses.map((c) => (
          <li key={c.id}>
            <Inset as={Link} interactive to={`/build/${c.id}`} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 truncate text-read font-bold text-foreground">{c.name}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-read font-semibold text-teal-light-ink">
                تفاصيل الدورة
                <ArrowLeft className="h-3 w-3" />
              </span>
            </Inset>
          </li>
        ))}
      </ul>
    </div>
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
          كل دورة بمدرب متخصص يراجع مخرجك بيده، وكل مسار يجمع اثنين إلى ثلاثة مدربين.
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

          البطاقةُ رأسٌ ثابت (الاسمُ والتعريفُ والتخصّصات) ونبذةٌ تنسدل بزرّ:
          السيرةُ والأرقامُ والتعليقاتُ ودوراتُه ومسارُه. قرارُ صاحب المنصّة
          (٨ سبتمبر ٢٠٢٦) — والطيُّ معلَنٌ لقارئ الشاشة بـ`aria-expanded` و
          `aria-controls`، لا `details` لأنّ الرأسَ يحمل روابطَ وصورةً لا
          تصلح داخل `summary`. */}
      {filteredApproved.length > 0 && (
        <section className="mt-12">
          <h2 className="text-center text-2xl font-black">مدربون معتمدون</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredApproved.map((t) => {
              const open = expanded.has(t.id)
              const panelId = `trainer-bio-${t.id}`
              return (
                <Panel as="article" tone="accent" key={t.id} className="flex flex-col transition hover:border-teal/50">
                  <div className="flex items-center gap-3">
                    {t.photoUrl ? (
                      <img
                        src={t.photoUrl}
                        alt={`صورة ${t.name}`}
                        className="h-14 w-14 shrink-0 rounded-full border border-teal/40 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-teal/20 text-xl font-black text-teal-light-ink">
                        {t.name.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-1.5 font-black">
                        {t.name}
                        <BadgeCheck className="h-4 w-4 shrink-0 text-teal-ink" aria-label="مدرب موثق" />
                      </h3>
                      {t.headline && <p className="mt-0.5 text-read leading-5 text-muted-foreground">{t.headline}</p>}
                      {t.country && <p className="mt-0.5 text-read text-muted-foreground">{t.country}</p>}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.specialties.map((s) => (
                      <span key={s} className="rounded-full border border-teal/25 bg-teal/10 px-2.5 py-1 text-fine text-teal-light-ink">{s}</span>
                    ))}
                  </div>

                  {/* عددُ الدورات في الرأس: يقول إنّ في النبذة ما يُشترى قبل أن تُفتح */}
                  <button
                    type="button"
                    onClick={() => toggle(t.id)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="mt-3 flex min-h-11 w-full items-center justify-between gap-2 border-t border-white/10 pt-3 text-sm font-bold text-teal-light-ink transition hover:text-foreground"
                  >
                    <span>
                      نبذةٌ ودوراتُه
                      {t.assignedCourseIds.length > 0 && (
                        <span className="ms-2 rounded-full bg-teal/15 px-2 py-0.5 text-read font-black text-teal-light-ink">
                          {new Set(t.assignedCourseIds).size}
                        </span>
                      )}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>

                  {open && (
                    <div id={panelId} className="mt-3 space-y-3">
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

                      {t.bio && <p className="text-read leading-6 text-muted-foreground">{t.bio}</p>}

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
                            تعليقات متعلّمين، منشورة باعتماد الأكاديمية. والمتوسّط أعلاه من كل التقييمات لا من المعروض منها.
                          </p>
                        </div>
                      )}

                      <TrainerOffer ids={t.assignedCourseIds} />
                    </div>
                  )}
                </Panel>
              )
            })}
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
          <h2 className="text-lg font-black">لم يُعتمد نشرُ اسمِ مدرّبٍ بعد</h2>
          <p className="mx-auto mt-3 max-w-xl text-read leading-7 text-muted-foreground">
            قاعدتُنا ألّا يُنشر اسمُ مدرّبٍ قبل اعتماد نشره. فما يظهر هنا حين يمتلئ
            أسماءُ من اجتازوا المراجعةَ فعلا — لا أمثلةَ ولا صورا توضيحيّة. ومدرّبُ
            كلّ شعبةٍ يُعلن على بطاقتها عند اعتمادها.
          </p>
        </Card>
      )}

      {/* المجالاتُ التي نغطّيها — وسوما لا بطاقاتٍ تُقرأ أشخاصا */}
      {visibleRoles.length > 0 && (
        <section className="mt-12">
          <h2 className="text-center text-lg font-black">المجالات التي نغطّيها</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-read leading-6 text-muted-foreground">
            تخصّصاتٌ يطلبها كتالوجُ وجيز — لا أسماءَ مدرّبين.
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
          نبحث دائما عن مدربين يقدّرون المخرج العملي مثلنا. قدّم طلبك وسيراجعه فريقنا.
        </p>
        <Link to="/join-trainer" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-teal-deep px-8 py-3.5 font-bold text-white transition hover:bg-teal-darker">
          انضم كمدرب
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Panel>
    </SiteShell>
  )
}
