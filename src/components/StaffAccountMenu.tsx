/* قائمة الحساب لبوّابات العاملين — إدارةً وتدريبا واستشارة.

   العطب: البوّابات الثلاث كانت تعرض اسمَ الداخل نصّا في الترويسة، لا قائمةً
   ولا زرَّ خروج. فمن دخل بحسابٍ إداريّ لم يجد سبيلا للخروج منه أصلا —
   ولا حتى نداءً بالعنوان، لأنّ `/api/auth/logout` من نوع POST. فالحلُّ
   الوحيد كان مسحَ ملفّات الارتباط من إعدادات المتصفّح.

   وذلك خطرٌ لا نقصٌ في الراحة: حسابٌ إداريّ يبقى مفتوحا على جهازٍ مشترك،
   وهو الحساب الذي يفتح الشعب ويرى الفواتير ويحذف الطلبات. والمتعلّم وحده
   كان له ما يخرج به — وهو أقلُّ الحسابات خطرا.

   وما فيها غير الخروج: من أنت، وبأيّ بريد، وبأيّ أدوار — فالإداريّ يرى
   لماذا يُفتح له بابٌ ويُغلق آخر بدل أن يصطدم بالمنع فيظنّه عطبا. */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronDown, LogOut, UserCog } from 'lucide-react'
import { signOut } from '@/services/auth'
import type { SessionUser } from '@/services/session'
import { Inset } from '@/components/ui/Surface'

/* أسماء الأدوار بالعربية — مطابقةٌ لما في `server/auth/permissions.ts` */
const ROLE_NAMES_AR: Record<string, string> = {
  super_admin: 'مدير النظام الأعلى',
  academic_manager: 'المدير الأكاديمي',
  academic_coordinator: 'منسّق أكاديميّ',
  diagnostic_manager: 'مدير التشخيص',
  operations_manager: 'مدير العمليات',
  advisor: 'مستشار',
  trainer: 'مدرب',
  trainer_applicant: 'متقدّم لعضوية التدريب',
  finance: 'المالية',
  support: 'الدعم',
  learner: 'متعلم',
}

export default function StaffAccountMenu({ user }: { user: SessionUser | null }) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const navigate = useNavigate()

  /* الخروج ينتظر مسح الجلسة عند الخادم قبل التنقّل — وإلّا سبق التنقّلُ
     المسحَ فعاد الداخلُ داخلا وهو يظنّ أنّه خرج. */
  const doSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    await signOut()
    navigate('/auth', { replace: true })
  }

  const name = user?.displayName ?? '—'
  const roles = (user?.roles ?? []).map((r) => ROLE_NAMES_AR[r] ?? r)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="قائمة الحساب"
        className={`flex h-10 min-w-0 cursor-pointer items-center gap-2 rounded-full border px-2.5 text-xs font-bold transition ${
          open ? 'border-gold/50 bg-gold/10 text-gold-ink' : 'border-white/12 text-foreground hover:border-white/30 hover:text-foreground'
        }`}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold/20 text-[11px] font-black text-gold-ink">
          {name.trim().charAt(0) || 'و'}
        </span>
        <span className="hidden max-w-[7rem] truncate sm:block">{name.split(' ')[0]}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <button
            aria-label="إغلاق قائمة الحساب"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <Inset role="menu" className="absolute left-0 top-12 z-50 w-72 bg-surface p-2 shadow-2xl">
            <div className="px-3 pb-3 pt-2">
              <p className="truncate text-sm font-black">{name}</p>
              <p dir="ltr" className="mt-0.5 truncate text-right text-[11px] text-muted-foreground">{user?.email ?? '—'}</p>
              {roles.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {roles.map((r) => (
                    <span key={r} className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-micro font-bold text-muted-foreground">
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 pt-1.5">
              {/* صفحةُ الحساب واحدةٌ للجميع: الاسمُ وكلمةُ المرور وإنهاءُ كلّ
                  الجلسات فيها. وهي تُصيَّر بإطار بوّابة المتعلّم — وذلك ما
                  عندنا اليوم، ولها إطارٌ خاصٌّ بالعاملين حين يلزم. */}
              <Link
                to="/student/account"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-foreground transition hover:bg-white/[0.04] hover:text-foreground"
              >
                <UserCog className="h-4 w-4" />
                حسابي — الاسم وكلمة المرور والجلسات
              </Link>
              <button
                type="button"
                onClick={doSignOut}
                disabled={signingOut}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-foreground transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                {signingOut ? 'يُسجَّل الخروج…' : 'تسجيل الخروج'}
              </button>
            </div>
          </Inset>
        </>
      )}
    </div>
  )
}
