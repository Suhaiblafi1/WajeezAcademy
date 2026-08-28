import { useNavigate } from 'react-router'
import AuthGate from '@/components/AuthGate'
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
      </div>

      {/* حُذفت لوحة «بوابات الفريق الداخلية» التي كانت تفتح بوابات الطالب
          والمدرب والمستشار والإدارة بوضع معاينة بلا حساب. صارت كلُّ بوابة
          تُفتح بصلاحية حقيقية، فلم يبق للاختصار معنى إلا تجاوز الصلاحيات. */}
    </SiteShell>
  )
}
