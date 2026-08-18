import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { GraduationCap, LayoutDashboard, Route as RouteIcon, ShieldCheck, UserCog } from 'lucide-react'
import AuthGate from '@/components/AuthGate'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'
import { enablePreview, isOwnerUnlocked, unlockOwner } from '@/services/access'
import { homePathForRoles, readRoles } from '@/services/auth'

/* بوابات الفريق الداخلية — للمالك أثناء الاطلاع على المنصة.
   تُفتح مرة واحدة عبر ?preview=owner وتُزال من الواجهة العامة عند الربط الحقيقي */
const GATEWAYS = [
  { to: '/student', label: 'بوابة الطالب', desc: 'لوحة المتعلم: مساره ومشروعه وشهاداته', icon: GraduationCap },
  { to: '/trainer', label: 'بوابة المدرب', desc: 'الشعب والتقييم والمستحقات', icon: UserCog },
  { to: '/advisor', label: 'بوابة المستشار', desc: 'التوصيات المعلقة وبطاقات المتعلمين', icon: RouteIcon },
  { to: '/admin', label: 'بوابة الإدارة', desc: 'الشعب والاستثناءات وسير المحتوى', icon: LayoutDashboard },
]

/** صفحة الدخول الرسمية — /auth */
export default function Auth() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  /* وضع المعاينة مشتق من العنوان مباشرة — لا حالة متزامنة داخل تأثير */
  const previewOwner = params.get('preview') === 'owner'
  const [owner] = useState(() => isOwnerUnlocked() || previewOwner)

  useEffect(() => {
    if (previewOwner && !isOwnerUnlocked()) unlockOwner()
  }, [previewOwner])

  const enterGateway = (to: string) => {
    enablePreview() // يفتح حارس بوابة الطالب أيضا — وضع معاينة المالك
    navigate(to)
  }

  return (
    <SiteShell>
      <SeoHead
        title="الدخول أو إنشاء حساب"
        description="سجّل دخولك إلى أكاديمي وجيز أو أنشئ حسابك ليُحفظ تشخيصك ومسارك وشهاداتك في مكان واحد."
        path="/auth"
        noindex
      />
      <div className="py-6">
        {/* بعد الدخول: كل دور إلى بوابته — مدير النظام للإدارة، المدرب لبوابته، وهكذا */}
        <AuthGate onDone={() => navigate(homePathForRoles(readRoles()))} />
      </div>

      {/* بوابات الفريق الداخلية — تظهر للمالك بعد فتحها عبر ?preview=owner */}
      {owner && (
        <div className="mx-auto mt-12 max-w-2xl">
          <div className="rounded-3xl border border-dashed border-[#FABC05]/30 bg-[#FABC05]/[0.04] p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-[#FABC05]">
              <ShieldCheck className="h-4 w-4" />
              بوابات الفريق الداخلية — وضع اطلاع المالك
            </div>
            <p className="mt-2 text-xs leading-6 text-white/45">
              للاطلاع على كل شيء أثناء التطوير. تُخفى في النسخة العامة وتُحمى بأدوار دخول حقيقية عند الربط.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {GATEWAYS.map((g) => (
                <button
                  key={g.to}
                  onClick={() => enterGateway(g.to)}
                  className="group flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-right transition hover:border-[#FABC05]/40"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FABC05]/10 text-[#FABC05]">
                    <g.icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-white/85">{g.label}</span>
                    <span className="mt-1 block text-[11px] leading-5 text-white/45">{g.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-white/55">
            <Link to="/" className="underline-offset-4 transition hover:text-[#6EC7D1] hover:underline">
              عودة للرئيسية
            </Link>
          </p>
        </div>
      )}
    </SiteShell>
  )
}
