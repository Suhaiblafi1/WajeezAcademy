import { displayedEcosystemOrgs } from '@/data/ecosystemOrganizations'

/* شريط «مؤسسات وثقت بمنظومة وجيز» — إثبات اجتماعي مؤسسي هادئ.
   - المصدر المركزي الوحيد: data/ecosystemOrganizations (لا نسخ في الصفحات).
   - لا marquee ولا autoscroll — شبكة ثابتة تلتف بشكل طبيعي على الجوال.
   - الإطار النصي ينسب الخبرة لمنظومة وجيز/وجيز مهارات صراحة —
     لا «عملاء الأكاديمية» إلا لعقود Academy فعلية (لا توجد حالياً).
   - الشعارات artwork أبيض من المصدر الرسمي، لذا تُعرض على سطح داكن ثابت
     يبقى واضحاً في الوضعين الفاتح والداكن — لذلك لون السطح inline style
     محصّن: إعادة تعريف light.css للأصناف الحرفية لا تمسّه إطلاقا */
export default function EcosystemOrgStrip() {
  const orgs = displayedEcosystemOrgs()
  if (orgs.length === 0) return null

  return (
    <section aria-label="مؤسسات وثقت بمنظومة وجيز" className="py-12 md:py-14">
      <div className="mx-auto max-w-6xl px-5">
        <div className="reveal text-center">
          <h2 className="text-sm font-bold text-teal-light-ink md:text-base">مؤسسات وثقت بمنظومة وجيز</h2>
          <p className="mx-auto mt-2 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
            خبرة مؤسسية تراكمت عبر حلول منظومة وجيز — منها وجيز مهارات — في تطوير فرق العمل وبناء ثقافة التعلّم.
          </p>
        </div>

        <div className="reveal mt-8 rounded-2xl border border-white/5 px-6 py-8 md:px-10" style={{ backgroundColor: '#0D0D0D' }}>
          <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-7 md:gap-x-14">
            {orgs.map((o) => (
              <li key={o.name} className="flex items-center">
                <img
                  src={o.logo}
                  alt={o.name}
                  title={o.name}
                  loading="lazy"
                  className="h-7 w-auto opacity-60 transition hover:opacity-100 md:h-9"
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
