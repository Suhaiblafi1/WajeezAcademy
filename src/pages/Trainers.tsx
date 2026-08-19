import { Link } from 'react-router'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BadgeCheck, GraduationCap, Users, ShieldCheck, Search, Star, Clock, ChevronDown } from 'lucide-react'
import { TRAINER_POOLS, TRAINER_PENDING_AR } from '@/data/courses'
import { pathways } from '@/data/pathways'
import { apiGet } from '@/services/api'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'

interface PublicTrainer {
  id: string; name: string; headline: string | null; bio: string | null;
  country: string | null; specialties: string[]; assignedCourseIds: string[];
  photoUrl: string | null;
  ratingAvg: number | null; ratingCount: number | null;
  hoursTaught: number | null; graduatesCount: number | null;
}

/* أسماء العائلات بالعربية */
const FAMILY_LABEL: Record<string, string> = {
  FND: 'الأساسيات', STU: 'الطلاب والجاهزية المهنية', CAREER: 'التحول المهني',
  EMP: 'تطوير الموظفين', GOV: 'القطاع الحكومي', BIZ: 'الأعمال وريادة المشاريع',
  FREE: 'العمل الحر', LEAD: 'القيادة', FAM: 'المسارات الأسرية', WELL: 'التركيز والرفاه',
}

const SPECIALTIES_PREVIEW = 6

/* ───────────────── صفحة الفريق التدريبي ─────────────────
   نزاهة تسويقية: لا يُنشر اسم مدرب إلا بعد اعتماده رسميا وامتلاكه
   public_visibility وبيانات حقيقية. التقييمات والساعات والخريجون
   تُعرض فقط عندما تُسجَّل فعليا — لا أرقام توضيحية. */
export default function Trainers() {
  /* المدربون المعتمدون للنشر العام — من API حصرا: active + موثق + public_visibility + موافقة نشر */
  const [approved, setApproved] = useState<PublicTrainer[]>([])
  const [q, setQ] = useState('')
  const [showAllSpecialties, setShowAllSpecialties] = useState(false)
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

  /* ترشيح المدربين المعتمدين: بالاسم أو التعريف أو التخصص */
  const filteredApproved = useMemo(() => {
    if (!query) return approved
    const needle = query.toLowerCase()
    return approved.filter((t) =>
      t.name.toLowerCase().includes(needle) ||
      (t.headline ?? '').toLowerCase().includes(needle) ||
      t.specialties.some((s) => s.toLowerCase().includes(needle))
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
      <SeoHead
        title="الفريق التدريبي"
        description="تخصصات الفريق التدريبي في أكاديمية وجيز — تُعلن أسماء المدربين بعد اعتماد كل شعبة رسميا."
        path="/trainers"
      />

      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#38A7B4]/30 bg-[#38A7B4]/10 px-4 py-1.5 text-sm text-[#6EC7D1]">
          <GraduationCap className="h-3.5 w-3.5" />
          الفريق التدريبي
        </div>
        <h1 className="mt-5 text-3xl font-black md:text-4xl">مدربون متخصصون — بمراجعة بشرية حقيقية</h1>
        <p className="mx-auto mt-3 max-w-xl leading-8 text-white/60">
          كل دورة بمدرب متخصص يراجع مخرجك بيده، وكل مسار يجمع اثنين إلى ثلاثة مدربين.
        </p>
        <p className="mx-auto mt-3 flex max-w-md items-center justify-center gap-2 rounded-2xl border border-[#FABC05]/30 bg-[#FABC05]/[0.06] px-4 py-2.5 text-xs font-bold leading-6 text-[#FABC05]">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          {TRAINER_PENDING_AR} — لا ننشر اسما قبل اعتماده رسميا.
        </p>

        {/* البحث بالاسم أو المجال */}
        <div className="relative mx-auto mt-6 max-w-md">
          <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو المجال…"
            aria-label="ابحث بالاسم أو المجال"
            className="w-full rounded-2xl border border-white/15 bg-white/[0.04] py-3 pl-4 pr-11 text-sm text-white placeholder:text-white/35 focus:border-[#38A7B4]/60 focus:outline-none"
          />
        </div>
      </div>

      {/* المدربون المعتمدون رسميا — يظهرون أولا وفقط بعد اكتمال الاعتماد والموافقة */}
      {filteredApproved.length > 0 && (
        <section className="mt-12">
          <h2 className="text-center text-2xl font-black">مدربون معتمدون</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredApproved.map((t) => (
              <article key={t.id} className="rounded-3xl border border-[#38A7B4]/30 bg-[#38A7B4]/[0.06] p-6 transition hover:border-[#38A7B4]/50">
                <div className="flex items-center gap-3">
                  {t.photoUrl ? (
                    <img
                      src={t.photoUrl}
                      alt={`صورة ${t.name}`}
                      className="h-14 w-14 shrink-0 rounded-full border border-[#38A7B4]/40 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#38A7B4]/20 text-xl font-black text-[#6EC7D1]">
                      {t.name.slice(0, 1)}
                    </span>
                  )}
                  <div>
                    <h3 className="flex items-center gap-1.5 font-black">
                      {t.name}
                      <BadgeCheck className="h-4 w-4 text-[#38A7B4]" aria-label="مدرب موثق" />
                    </h3>
                    {t.headline && <p className="mt-0.5 text-xs text-white/55">{t.headline}</p>}
                    {t.country && <p className="mt-0.5 text-[11px] text-white/40">{t.country}</p>}
                  </div>
                </div>

                {/* الإحصاءات — تُعرض فقط عند وجود بيانات حقيقية مسجلة */}
                {(t.ratingAvg != null || t.hoursTaught != null || t.graduatesCount != null) && (
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/10 pt-3 text-xs text-white/65">
                    {t.ratingAvg != null && (
                      <span className="inline-flex items-center gap-1 font-bold text-[#FABC05]">
                        <Star className="h-3.5 w-3.5 fill-[#FABC05]" />
                        {t.ratingAvg.toFixed(1)}
                        {t.ratingCount != null && <span className="font-normal text-white/45">({t.ratingCount} تقييما)</span>}
                      </span>
                    )}
                    {t.hoursTaught != null && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-[#38A7B4]" />
                        {t.hoursTaught} ساعة تدريب معنا
                      </span>
                    )}
                    {t.graduatesCount != null && (
                      <span className="inline-flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5 text-[#38A7B4]" />
                        {t.graduatesCount} خريجا
                      </span>
                    )}
                  </div>
                )}

                {t.bio && <p className="mt-3 text-xs leading-6 text-white/60">{t.bio}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.specialties.map((s) => (
                    <span key={s} className="rounded-full border border-[#38A7B4]/25 bg-[#38A7B4]/10 px-2.5 py-1 text-[11px] text-[#6EC7D1]">{s}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* التخصصات المطلوبة فعلا — عدد محدود مع خيار عرض الكل */}
      {visibleRoles.length > 0 && (
        <section className="mt-12">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleRoles.map(([role, familiesSet]) => {
              const families = [...familiesSet].map((f) => FAMILY_LABEL[f] ?? f)
              const pathwayCount = pathways.filter((p) => familiesSet.has(p.id.split('-')[1] ?? '')).length
              return (
                <article key={role} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-[#38A7B4]/40">
                  <div className="flex items-center gap-4">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#38A7B4]/15 text-xl font-black text-[#6EC7D1]">
                      <GraduationCap className="h-6 w-6" />
                    </span>
                    <div>
                      <h2 className="font-bold leading-relaxed">{role}</h2>
                      <p className="mt-1 text-xs text-white/55">{TRAINER_PENDING_AR}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {families.map((f) => (
                      <span key={f} className="rounded-full border border-[#38A7B4]/25 bg-[#38A7B4]/10 px-2.5 py-1 text-[11px] text-[#6EC7D1]">
                        {f}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 flex items-center gap-1.5 text-[11px] text-white/45">
                    <Users className="h-3.5 w-3.5 text-[#38A7B4]" />
                    يغطي {pathwayCount} {pathwayCount === 1 ? 'مسارا' : 'مسارات'} من كتالوج وجيز
                  </p>
                </article>
              )
            })}
          </div>
          {!showAllSpecialties && !query && filteredRoles.length > SPECIALTIES_PREVIEW && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setShowAllSpecialties(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white/70 transition hover:border-[#38A7B4]/40 hover:text-white"
              >
                عرض كل التخصصات ({filteredRoles.length})
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>
      )}

      {query && filteredApproved.length === 0 && visibleRoles.length === 0 && (
        <p className="mt-12 text-center text-sm text-white/50">لا نتائج مطابقة لـ«{query}» — جرّب اسما أو مجالا آخر.</p>
      )}

      <div className="mt-14 rounded-3xl border border-[#38A7B4]/25 bg-[#38A7B4]/5 p-8 text-center">
        <p className="text-lg font-bold">هل أنت خبير وتريد التدريب معنا؟</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-white/55">
          نبحث دائما عن مدربين يقدّرون المخرج العملي مثلنا. قدّم طلبك وسيراجعه فريقنا.
        </p>
        <Link to="/join-trainer" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#247B84] px-8 py-3.5 font-bold text-white transition hover:bg-[#1E666E]">
          انضم كمدرب
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    </SiteShell>
  )
}
