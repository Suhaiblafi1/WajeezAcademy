import { Link, useNavigate } from 'react-router'
import { Compass, Presentation } from 'lucide-react'
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
            نموذجا يسأله بريدَه ولا يقول لمَ. فهذا جوابُ «لماذا حسابٌ أصلا»،
            وهو تحت النموذج لا فوقه: من جاء ليدخل فعلا لا يُزاح نموذجُه.

            ═══ وثلاثةٌ صارت اثنتين — لأنّ الثلاثةَ كانت تخاطب واحدا ═══

            كانت ثلاثةَ أبواب: تشخيصٌ ومساراتٌ ودورةٌ بعينها. وكلُّها تفترض
            **متعلّما**. وبلّغ صاحبُ المنصّة (١٥ سبتمبر ٢٠٢٦): «أنت تدعوه
            إلى التشخيص وهو أصلا مدرّب — فكيف تدعوه؟».

            والبلاغُ يصدّقه ما في الشيفرة: `‎/join-trainer` يُحيل من قدّم
            طلبَه إلى هذه الصفحة ليدخل (`JoinTrainer.tsx`)، و`TrainerLayout`
            كذلك. فالمدرّبُ يبلغها بابا معلوما، ويُعرض عليه أن يقيس مستواه.

            فصارتا سطرَين يسأل كلٌّ منهما **من أنت** قبل أن يقول ما تفعل.
            وسقط «تصفّح المسارات» و«دورةٌ بعينها»: كلاهما في ترويسة الموقع
            على بُعد نقرةٍ، وليسا جوابا لسؤالِ الهويّة. */}
        <Card as="section" className="mx-auto mt-8 max-w-md">
          <h2 className="text-sm font-black">أوّلُ مرّةٍ هنا؟</h2>
          <p className="mt-1 text-read leading-6 text-muted-foreground">
            الحسابُ يحفظ ما تبدؤه — وبدايتُك تختلف باختلافك:
          </p>
          <div className="mt-3 grid gap-2">
            <Inset as="a" interactive href="/#diagnostic" className="flex items-center gap-2.5 text-read leading-6">
              <Compass className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
              <span><b className="text-foreground">إن كنت متعلّما</b> — ابدأ بالتشخيص المجّانيّ: يقيس مستواك ويقترح مسارَك</span>
            </Inset>
            <Inset as={Link} interactive to="/join-trainer" className="flex items-center gap-2.5 text-read leading-6">
              <Presentation className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
              <span><b className="text-foreground">إن كنت مدرّبا ولم تقدّم طلبَ الانضمام</b> — ابدأ من هنا</span>
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
