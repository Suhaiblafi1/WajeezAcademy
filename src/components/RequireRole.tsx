/* حارس مسارات البوابات — يتحقق من الجلسة والأدوار عند الخادم (/api/auth/me)
   وليس من التخزين المحلي، فالكوكي هو دليل الدخول الوحيد.
   - بلا جلسة → يوجَّه إلى /auth
   - جلسة بلا الدور المطلوب → يوجَّه إلى بوابة دوره (لا صفحة خطأ صمّاء)
   - معاينة المالك (?preview=owner) تعمل في بناء الديمو فقط — مستحيلة في الإنتاج
     لأن VITE_DEMO_MODE لا يُضبط في بناء الإنتاج أصلا */

import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router'
import { homePathForRoles, refreshSession } from '../services/auth'


/** أدوار بوابة الإدارة — تطابق مصفوفة الصلاحيات في server/auth/permissions.ts */
export const ADMIN_ROLES = [
  'super_admin',
  'academic_manager',
  'diagnostic_manager',
  'operations_manager',
  'finance',
  'support',
] as const

/** بوابتا المدرب والمستشار: دورهما + مدير النظام (يملك صلاحياتهما جميعا) */
export const TRAINER_ROLES = ['trainer', 'super_admin'] as const
export const ADVISOR_ROLES = ['advisor', 'super_admin'] as const

type GuardState = 'loading' | 'ok' | 'anon' | 'forbidden'

export default function RequireRole({ allow }: { allow: readonly string[] }) {
  /* حُذف تجاوزُ «معاينة المالك»: كان علمٌ في localStorage مع VITE_DEMO_MODE
     يجعل الحارس يمرّر أيَّ دورٍ بلا جلسة. حارسُ صلاحياتٍ له بابٌ خلفي ليس حارسا. */
  const [state, setState] = useState<GuardState>('loading')
  const [home, setHome] = useState('/student')

  useEffect(() => {
    let alive = true
    void refreshSession().then((s) => {
      if (!alive) return
      if (!s) {
        setState('anon')
      } else if (s.roles.some((r) => allow.includes(r))) {
        setState('ok')
      } else {
        setHome(homePathForRoles(s.roles))
        setState('forbidden')
      }
    })
    return () => { alive = false }
    // allow قائمة ثابتة من ثوابت الملف — لا تتغير بين التصييرات
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state === 'loading') {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5" aria-busy="true" aria-label="التحقق من الصلاحيات">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[#38A7B4]" />
        <p className="mt-4 text-sm font-semibold text-white/50">نتحقق من صلاحياتك…</p>
      </div>
    )
  }
  if (state === 'anon') return <Navigate to="/auth" replace />
  if (state === 'forbidden') return <Navigate to={home} replace />
  return <Outlet />
}
