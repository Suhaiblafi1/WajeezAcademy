import { Link } from 'react-router'
import { ArrowLeft, GraduationCap, Users, ShieldCheck } from 'lucide-react'
import { TRAINER_POOLS, TRAINER_PENDING_AR } from '@/data/courses'
import { pathways } from '@/data/pathways'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'

/* أسماء العائلات بالعربية */
const FAMILY_LABEL: Record<string, string> = {
  FND: 'الأساسيات', STU: 'الطلاب والجاهزية المهنية', CAREER: 'التحول المهني',
  EMP: 'تطوير الموظفين', GOV: 'القطاع الحكومي', BIZ: 'الأعمال وريادة المشاريع',
  FREE: 'العمل الحر', LEAD: 'القيادة', FAM: 'المسارات الأسرية', WELL: 'التركيز والرفاه',
}

/* ───────────────── صفحة الفريق التدريبي — تخصصات لا أسماء ─────────────────
   نزاهة تسويقية: لا يُنشر اسم مدرب إلا بعد اعتماد الشعبة وحصوله على
   public_visibility. حتى ذلك الحين تعرض الصفحة التخصصات المطلوبة فعلا. */
export default function Trainers() {
  /* نجمع التخصصات الفريدة من كل العائلات مع عدد المسارات التي تحتاجها */
  const byRole = new Map<string, Set<string>>()
  Object.entries(TRAINER_POOLS).forEach(([family, list]) =>
    list.forEach((t) => {
      const cur = byRole.get(t.role) ?? new Set<string>()
      cur.add(family)
      byRole.set(t.role, cur)
    })
  )

  return (
    <SiteShell>
      <SeoHead
        title="الفريق التدريبي"
        description="تخصصات الفريق التدريبي في أكاديمي وجيز — تُعلن أسماء المدربين بعد اعتماد كل شعبة رسميا."
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
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[...byRole.entries()].map(([role, familiesSet]) => {
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
