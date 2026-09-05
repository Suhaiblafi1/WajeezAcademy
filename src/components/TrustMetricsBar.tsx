import { Building2, Users, BookOpen, Route } from 'lucide-react'
import { homeTrustMetrics } from '@/data/trustMetrics'

/* أيقونة معبّرة لكل مقياس — الربط بالمفتاح هنا لا في ملف البيانات (يبقى قابلا للتسلسل) */
const METRIC_ICON: Record<string, typeof Building2> = {
  organizations: Building2,
  employees: Users,
  book_summaries: BookOpen,
  career_tracks: Route,
}

/* شريط الثقة الرقمي — أرقام «وجيز مهارات» الموثقة فقط.
   - يقرأ من المصدر المركزي trustMetrics حصراً (wajeez_skills + approved + selected).
   - لا Counter animation: الأرقام KPI موثقة وتُعرض ثابتة كما في المصدر.
   - لا نسبة للأكاديمية: الإطار النصي «وجيز مهارات بالأرقام» + subcopy يوضح أنها
     أرقام تجربة وجيز مهارات ضمن منظومة وجيز — صغير لكنه غير مضلل.
   - الرقم هو العنصر البصري الأساسي؛ الوصف تحته مختصر جداً. */
export default function TrustMetricsBar() {
  const metrics = homeTrustMetrics()
  if (metrics.length === 0) return null

  return (
    <section aria-label="وجيز مهارات بالأرقام" className="border-y border-white/5 bg-white/[0.02] py-10 md:py-12">
      <div className="mx-auto max-w-7xl px-5">
        <div className="reveal text-center">
          <h2 className="text-sm font-bold text-teal-light-ink md:text-base">وجيز مهارات بالأرقام</h2>
          <p className="mx-auto mt-2 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
            أرقام موثقة من تجربة وجيز مهارات مع المؤسسات والمتعلمين — إحدى حلول منظومة وجيز.
          </p>
        </div>

        <dl className="reveal mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
          {metrics.map((m) => {
            const Icon = METRIC_ICON[m.key] ?? Building2
            return (
              <div key={m.key} className="flex flex-col items-center text-center">
                <span className="order-1 grid h-12 w-12 place-items-center rounded-2xl border border-teal/25 bg-teal/10">
                  <Icon className="h-5 w-5 text-teal-light-ink" />
                </span>
                <dd className="order-2 mt-3 text-4xl font-black tabular-nums tracking-tight text-teal-light-ink md:text-[2.75rem]">
                  {m.display_value}
                </dd>
                <dt className="order-3 mt-2 text-[11px] leading-snug text-muted-foreground md:text-xs">
                  {m.label_ar}
                </dt>
              </div>
            )
          })}
        </dl>
      </div>
    </section>
  )
}
