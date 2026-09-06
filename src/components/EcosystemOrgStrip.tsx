import { displayedEcosystemOrgs } from '@/data/ecosystemOrganizations'

/* شريط «مؤسسات وثقت بمنظومة وجيز» — إثبات اجتماعي مؤسسي هادئ.
   - المصدر المركزي الوحيد: data/ecosystemOrganizations (لا نسخ في الصفحات).
   - لا marquee ولا autoscroll — شبكة ثابتة تلتف بشكل طبيعي على الجوال.
   - الإطار النصي ينسب الخبرة لمنظومة وجيز/وجيز مهارات صراحة —
     لا «عملاء الأكاديمية» إلا لعقود Academy فعلية (لا توجد حالياً).
   - الشعارات artwork أبيض من المصدر الرسمي. كان السطح لونا صريحا محصّنا
     (#0D0D0D inline) كي تبقى بيضاء مقروءة — فبقي القسم داكنا في الوضع
     الفاتح وحده بين كل الصفحة. العلاج نفس علاج شعارات التغطية: السطح
     رمز دلالي يتبدل، والشعار يحمل partner-logo فينقلب في الفاتح إلى حبر
     مقروء (grayscale + invert في light.css). */
/* ــ ويُركَّب داخل «شركاؤنا» لا وحدَه (البند ٥٦) ــ

   كان قسما مستقلّا بحشوه وعنوانه، **وبينه وبين «شركاؤنا» قسمُ المختارات
   كلُّه**: جدارا شعاراتٍ متباعدان يقولان الشيءَ نفسَه للزائر — «جهاتٌ تعرفنا».
   والقياسُ على هاتفٍ ٣٩٠: القسمان ٧٧٢ بكسلا من ١٠٨٢٥، ووقفتان من أربعَ عشرةَ
   في صفحةٍ طولُها ١٢٫٨ شاشة.

   فصار صفّا ثانيا تحت الأوّل: الادّعاءان مختلفان (تغطيةٌ إعلاميّة · ثقةٌ
   مؤسسيّة) فيبقى لكلٍّ عنوانُه، والوقفةُ واحدة. */
export default function EcosystemOrgStrip({ nested = false }: { nested?: boolean } = {}) {
  const orgs = displayedEcosystemOrgs()
  if (orgs.length === 0) return null

  const Wrapper = nested ? 'div' : 'section'
  return (
    <Wrapper aria-label="مؤسسات وثقت بمنظومة وجيز" className={nested ? 'mt-12' : 'py-12 md:py-14'}>
      <div className={nested ? '' : 'mx-auto max-w-7xl px-5'}>
        <div className="reveal text-center">
          <h2 className="text-sm font-bold text-teal-light-ink md:text-base">مؤسسات وثقت بمنظومة وجيز</h2>
          <p className="mx-auto mt-2 max-w-xl text-fine leading-relaxed text-muted-foreground">
            خبرة مؤسسية تراكمت عبر حلول منظومة وجيز — منها وجيز مهارات — في تطوير فرق العمل وبناء ثقافة التعلّم.
          </p>
        </div>

        <div className="reveal mt-8 rounded-2xl border border-white/5 bg-surface px-6 py-8 md:px-10">
          <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-7 md:gap-x-14">
            {orgs.map((o) => (
              <li key={o.name} className="flex items-center">
                <img
                  src={o.logo}
                  alt={o.name}
                  title={o.name}
                  loading="lazy"
                  className="partner-logo h-7 w-auto opacity-60 transition hover:opacity-100 md:h-9"
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Wrapper>
  )
}
