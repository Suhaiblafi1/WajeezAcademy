import { Link } from 'react-router'
import { Building2, Clock, GraduationCap, Landmark, Mail, MapPin, User } from 'lucide-react'
import { CONTACT } from '@/data/stories'
import EcosystemNote from '@/components/EcosystemNote'

/* تذييلُ الموقع العامّ — واحدٌ للرئيسيّة وللصفحات الداخليّة.

   كان التذييلُ الكاملُ (خريطةُ الموقع) في الرئيسيّة وحدَها، وفي غيرها سطرُ
   حقوقٍ وبريد. وطلب صاحبُ المنصّة (٢١ أكتوبر ٢٠٢٦): «ثبّت الفوتر بكافّة
   الصفحات الداخليّة وليس الرئيسيّة فقط». فخرج من `Home.tsx` إلى هنا، وتستعمله
   `SiteShell` و`Static` و`Pathway` و`CoursePath` و`Verify` كما هو. ورابطُ
   «شركاؤنا» `/#partners` لا `#partners`: يصل القسمَ من أيّ صفحة. */
const footerCols: { title: string; icon: typeof GraduationCap; links: { label: string; to: string }[] }[] = [
  {
    title: 'المنصة',
    icon: GraduationCap,
    links: [
      { label: 'كل المسارات', to: '/pathways' },
      { label: 'كل الدورات', to: '/courses' },
      { label: 'مؤشر وجيز والتشخيص', to: '/diagnostic' },
      /* بابُ المرآة (البند ٤٠) — نزل إلى هنا حين رُفعت دعوتُه من شاشة بدء
         التشخيص (١٢ سبتمبر ٢٠٢٦). وصفحةٌ لا يصلها رابطٌ صفحةٌ لا وجودَ لها،
         فالحذفُ من موضعٍ لا يعني الحذفَ من المنصّة. */
      { label: 'مرآة وجيز', to: '/mirror' },
      { label: 'قصص المتعلمين', to: '/stories' },
      { label: 'المدربون والمستشارون', to: '/trainers' },
      { label: 'التحقق من شهادة', to: '/verify' },
    ],
  },
  {
    title: 'عن وجيز',
    icon: User,
    links: [
      { label: 'من نحن', to: '/p/about' },
      { label: 'المنهجية', to: '/methodology' },
      { label: 'شركاؤنا', to: '/#partners' },
      { label: 'انضم كمدرب', to: '/join-trainer' },
    ],
  },
  {
    title: 'الحلول',
    icon: Building2,
    links: [
      { label: 'للأفراد', to: '/pathways' },
      { label: 'للشركات', to: '/contact?type=company' },
      { label: 'للجهات الحكومية', to: '/contact?type=gov' },
      { label: 'خدمات المؤسسات', to: '/contact' },
    ],
  },
  {
    title: 'الدعم',
    icon: Landmark,
    links: [
      { label: 'تواصل معنا', to: '/contact' },
      { label: 'الأسئلة الشائعة', to: '/p/faq' },
      { label: 'شروط الاستخدام', to: '/p/terms' },
      { label: 'سياسة الخصوصية', to: '/p/privacy' },
      { label: 'سياسة الاسترداد', to: '/p/refund' },
    ],
  },
]

/* التذييل: أنعمُ وأصغرُ وأقربُ سطورا.

   وُصف بأنّه «كبير ومبعثر». والسببُ قياسٌ لا ذوق: حشوٌ ٤٨px، وفجوةُ شبكةٍ
   ٣٢px بين الأعمدة، وروابطُ ١٤px بفراغِ ٨px بينها، ورؤوسُ أعمدةٍ بحجم النصّ
   العاديّ — فلا يفترق الرأسُ عن رابطه إلا بالوزن. والتذييلُ آخرُ ما يُقرأ،
   فحجمُه يجب أن يقول ذلك.

   فنزلت الروابطُ إلى ١٢٫٥px بفراغِ ٤px، ورؤوسُ الأعمدة إلى ١٣px بأيقونةٍ
   أصغر، والحشوُ إلى ٣٦px. ولا يُحذف رابطٌ واحد: الشكوى في الحجم لا في العدد. */
export default function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-surface3">
      <div className="shell py-9">
        <div className="grid gap-x-8 gap-y-7 md:grid-cols-3">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5">
              <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
              <div className="font-bold">وجيز <span className="text-teal-light-ink">أكاديمي</span></div>
            </div>
            <p className="mt-2.5 max-w-xs text-read leading-6 text-muted-foreground">
              منصة تفهم الإنسان قبل أن تقترح ما يتعلمه — من مجموعة وجيز wajeez.com
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-4 w-4 text-teal-ink" />
              <span dir="ltr">{CONTACT.email}</span>
            </div>
            <div className="mt-2 space-y-1">
              {CONTACT.locations.map((loc) => (
                <div key={loc.label} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-ink" />
                  {loc.href ? (
                    <a href={loc.href} target="_blank" rel="noreferrer" className="transition hover:text-teal-light-ink">
                      {loc.label}{loc.address ? ` — ${loc.address}` : ''}
                    </a>
                  ) : (
                    <span>{loc.label}{loc.address ? ` — ${loc.address}` : ''}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* ─── وعادت أعمدةً (صاحب المنصّة، ١٢ سبتمبر ٢٠٢٦) ───

              كانت صفوفا أفقيّةً يفصل روابطَها «|»، وقد صِيغت كذلك خوفا من
              طولٍ على الهاتف. والقرارُ ينسخها: «اجعلها كلَّها أعمدةً لا
              جنبا إلى جنب، وأصغرَ ما يكون بأقلّ فراغٍ بين الأسطر».

              والخوفُ القديمُ يُعالَج بالحجم لا بالاتّجاه: أربعةُ أعمدةٍ على
              الهاتف بدل عمودين، ورابطٌ `text-fine` بارتفاعِ سطرٍ ‎16px‎
              وبلا فجوةٍ بينها — فالقائمةُ كلُّها أقصرُ ممّا كانت أفقيّةً،
              وكلُّ رابطٍ يُقرأ وحدَه لا في جملةٍ تفصلها شُرَط. */}
          <nav aria-label="خريطة الموقع" className="grid grid-cols-2 gap-x-5 gap-y-4 md:col-span-2 md:grid-cols-4">
            {footerCols.map((col) => (
              <div key={col.title}>
                <div className="mb-1 flex items-center gap-1 text-fine font-bold">
                  <col.icon className="h-3 w-3 shrink-0 text-teal-ink" />
                  {col.title}
                </div>
                <ul className="flex flex-col text-fine leading-4 text-muted-foreground">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.to.startsWith('/#') ? (
                        <a href={l.to} className="block py-0.5 transition hover:text-teal-light-ink">{l.label}</a>
                      ) : (
                        <Link to={l.to} className="block py-0.5 transition hover:text-teal-light-ink">{l.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-7 flex flex-col items-center justify-between gap-2 border-t border-white/5 pt-5 text-xs text-muted-foreground md:flex-row">
          <div>© 2026 أكاديمية وجيز — جميع الحقوق محفوظة</div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            صنع بعناية — الفهم قبل البيع
          </div>
        </div>
        {/* تعريف المنظومة — انتقل إلى هنا من أسفل الصدر مباشرة: سطر هوية
            ثانوي لا يستحق مكانا في أول ما تراه العين بعد الهيرو. */}
        <EcosystemNote className="mt-3" />
      </div>
    </footer>
  )
}
