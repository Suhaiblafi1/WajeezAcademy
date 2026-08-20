import { homeTrustMetrics } from '@/data/trustMetrics'

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
      <div className="mx-auto max-w-6xl px-5">
        <div className="reveal text-center">
          <h2 className="text-sm font-bold text-teal-light md:text-base">وجيز مهارات بالأرقام</h2>
          <p className="mx-auto mt-2 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
            أرقام موثقة من تجربة وجيز مهارات مع المؤسسات والمتعلمين — إحدى حلول منظومة وجيز.
          </p>
        </div>

        <dl className="reveal mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-5 md:gap-x-6">
          {metrics.map((m, i) => (
            <div
              key={m.key}
              className={`flex flex-col items-center text-center ${i === metrics.length - 1 && metrics.length % 2 === 1 ? 'col-span-2 md:col-span-1' : ''}`}
            >
              <dt className="order-2 mt-2 text-[11px] leading-snug text-muted-foreground md:text-xs">
                {m.label_ar}
              </dt>
              <dd className="order-1 text-4xl font-black tabular-nums tracking-tight text-teal-light md:text-[2.75rem]">
                {m.display_value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
