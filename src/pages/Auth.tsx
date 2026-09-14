import { Link, useNavigate } from 'react-router'
import { Compass, Route as RouteIcon, BookOpen } from 'lucide-react'
import AuthGate from '@/components/AuthGate'
import { Card, Inset } from '@/components/ui/Surface'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'
import { homePathForRoles, readRoles } from '@/services/auth'

/** صفحة الدخول الرسمية — /auth */
export default function Auth() {
  const navigate = useNavigate()

  return (
    <SiteShell>
      <SeoHead
        title="الدخول أو إنشاء حساب"
        description="سجّل دخولك إلى أكاديمية وجيز أو أنشئ حسابك ليُحفظ تشخيصك ومسارك وشهاداتك في مكان واحد."
        path="/auth"
        noindex
      />
      <div className="py-6">
        {/* بعد الدخول: كل دور إلى بوابته — مدير النظام للإدارة، المدرب لبوابته، وهكذا */}
        <AuthGate onDone={() => navigate(homePathForRoles(readRoles()))} />

        {/* ═══ ع-٨ · لا حسابَ يُولد فارغا ═══

            من وصل هذه الصفحةَ من قلبٍ ضغطه أو من شراءٍ بدأه جاء **بنيّة**،
            وتلك محفوظةٌ في بوّابتها (`FavoriteButton`) فيعود إليها بعد
            الدخول. ومن وصلها من زرِّ «دخول» في الترويسة لا نيّةَ معه: يجد
            نموذجا يسأله بريدَه ولا يقول لمَ.

            فالأبوابُ الثلاثةُ هنا هي جوابُ «لماذا حسابٌ أصلا»: يبدأ من
            تشخيصٍ يقيس، أو مسارٍ يختاره، أو دورةٍ بعينها — ثمّ يصير للحساب
            ما يحفظه. وهي تحت النموذج لا فوقه: من جاء ليدخل فعلا لا يُزاح
            نموذجُه من مكانه. */}
        <Card as="section" className="mx-auto mt-8 max-w-md">
          <h2 className="text-sm font-black">أوّلُ مرّةٍ هنا؟</h2>
          <p className="mt-1 text-read leading-6 text-muted-foreground">
            الحسابُ يحفظ ما تبدؤه — فابدأ بشيءٍ يعنيك، ثمّ أنشئه ليبقى معك.
          </p>
          <div className="mt-3 grid gap-2">
            <Inset as="a" interactive href="/#diagnostic" className="flex items-center gap-2.5 text-read leading-6">
              <Compass className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
              <span><b className="text-foreground">قِس مستواك أوّلا</b> — التشخيصُ مجّانيٌّ ويقترح عليك مسارَك</span>
            </Inset>
            <Inset as={Link} interactive to="/pathways" className="flex items-center gap-2.5 text-read leading-6">
              <RouteIcon className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
              <span><b className="text-foreground">تصفّح المسارات</b> — رحلةٌ كاملةٌ من حيث أنت إلى حيث تريد</span>
            </Inset>
            <Inset as={Link} interactive to="/courses" className="flex items-center gap-2.5 text-read leading-6">
              <BookOpen className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
              <span><b className="text-foreground">أو دورةً بعينها</b> — إن كنت تعرف ما ينقصك</span>
            </Inset>
          </div>
        </Card>
      </div>

      {/* حُذفت لوحة «بوابات الفريق الداخلية» التي كانت تفتح بوابات الطالب
          والمدرب والمستشار والإدارة بوضع معاينة بلا حساب. صارت كلُّ بوابة
          تُفتح بصلاحية حقيقية، فلم يبق للاختصار معنى إلا تجاوز الصلاحيات. */}
    </SiteShell>
  )
}
