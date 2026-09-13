/* إطارُ الصفحة يتبع البوّابةَ التي جاء منها صاحبُها.

   ═══ العطبُ الذي كُتب له ═══

   «حسابي» كانت صفحةً واحدةً بإطارٍ واحد: إطارُ بوّابة المتعلّم. فمديرُ
   النظام يضغط اسمَه في ترويسة الإدارة ليعدّل حسابَه، فتنقلب الشاشةُ إلى
   بوّابة طالب — شريطُ «مساري» و«دوراتي» و«شهاداتي»، ولا أثرَ لبوّابته.
   وشكاها صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «أتحوّل لمنصّة طالب علما أنّ دوري
   سوبر أدمن فقط».

   وليس عطبَ صلاحيّات: `super_admin` يمرّ حارسَ بوّابة المتعلّم عمدا (يملك
   صلاحياتِها جميعا). العطبُ أنّ الصفحةَ كانت تعرف إطارا واحدا — فمن فتحها
   صار طالبا في عينه، وإن بقي مديرا في صلاحيّته.

   ═══ والإطارُ يُقرأ من المسار لا من الأدوار ═══

   لأنّ صاحبَ الأدوار المتعدّدة (مديرٌ ومدرّبٌ معا) يفتحها من بوّابةٍ بعينها،
   ويريد أن يعود إليها لا إلى «أقوى» أدواره. والمسارُ يقول من أين جاء بلا
   تخمين: `/admin/account` إطارُه إطارُ الإدارة، و`/trainer/account` إطارُ
   المدرّب، وهكذا.

   والأطرُ الأربعةُ تقبل `{children, title}` نفسَها — فالاختيارُ سطرٌ لا
   طبقة. */

import { useLocation } from 'react-router'
import { portalPrefixFor } from '@/application/site/portal-paths'
import AdminLayout from './admin/AdminLayout'
import AdvisorLayout from './advisor/AdvisorLayout'
import TrainerLayout from './trainer/TrainerLayout'
import PortalLayout from './student/PortalLayout'

/* والاختيارُ صريحٌ لا جدولَ مكوّناتٍ يُقرأ في التصيير: مكوّنٌ يُنتقى في
   متغيّرٍ أثناء التصيير يفقد حالتَه كلَّما تغيّر المتغيّر — ويُحمِّر
   `react-hooks/static-components` بحقّ. */
export default function PortalFrame({ children, title }: { children: React.ReactNode; title: string }) {
  const prefix = portalPrefixFor(useLocation().pathname)
  if (prefix === '/admin') return <AdminLayout title={title}>{children}</AdminLayout>
  if (prefix === '/trainer') return <TrainerLayout title={title}>{children}</TrainerLayout>
  if (prefix === '/advisor') return <AdvisorLayout title={title}>{children}</AdvisorLayout>
  return <PortalLayout title={title}>{children}</PortalLayout>
}
