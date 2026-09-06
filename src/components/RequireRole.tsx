/* حارس مسارات البوابات — يتحقق من الجلسة والأدوار عند الخادم (/api/auth/me)
   وليس من التخزين المحلي، فالكوكي هو دليل الدخول الوحيد.
   - بلا جلسة → يوجَّه إلى /auth
   - جلسة بلا الدور المطلوب → يوجَّه إلى بوابة دوره (لا صفحة خطأ صمّاء)

   ─────────── وتعذُّرُ الوصول ليس جوابا ───────────

   كان `refreshSession` يسقط عند فشل النداء إلى النسخة المحلّية في
   `localStorage`، وكان هذا الحارسُ يبني قرارَه عليها — أي أنّ السطر الأوّل
   من هذا التعليق كان يكذب كلّما تعذّرت الشبكة. وأثرُه في الاتّجاهين:
   من صار `super_admin` بعد آخر كتابةٍ للنسخة يهبط إلى بوابة المتعلّم (وهي
   شكوى صاحب المنصّة)، ومن سُحبت أدوارُه يمرّ ما دامت نسختُه في متصفّحه.

   وتعذُّرُ الوصول حالةٌ متوقَّعة لا استثناءٌ نادر — كان سببُه إقلاعَ دالّةِ
   Vercel الباردَ بعد خمول، وصار سببُه على الخادم الدائم إعادةَ تشغيل
   العمليّة بعد كلّ نشرة وانقطاعَ الشبكة. والعلاجُ واحدٌ في الحالتين:
   يُعاد المحاولةُ مرّتين بتراخٍ،
   ثمّ يُقال للمستخدم إنّ التحقّق تعذّر ويُعرض زرُّ إعادة — ولا يُحوَّل إلى
   أيّ بوابة على غير جوابٍ من الخادم. */

import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router'
import { RefreshCw, ServerOff } from 'lucide-react'
import { homePathForRoles, verifySession } from '../services/auth'


import Button from "@/components/ui/Button";
/** أدوار بوابة الإدارة — تطابق مصفوفة الصلاحيات في server/auth/permissions.ts */
export const ADMIN_ROLES = [
  'super_admin',
  'academic_manager',
  'academic_coordinator',
  'diagnostic_manager',
  'operations_manager',
  'finance',
  'support',
] as const

/** بوابتا المدرب والمستشار: دورهما + مدير النظام (يملك صلاحياتهما جميعا) */
export const TRAINER_ROLES = ['trainer', 'super_admin'] as const
export const ADVISOR_ROLES = ['advisor', 'super_admin'] as const
/* بوابةُ المتعلّم — كانت مساراتها كلُّها خارج أيّ حارس.

   والحمايةُ الحقيقيّة عند الخادم (كلُّ مسار في `learning-portal` بحارس
   صلاحيّة)، فلم تكن ثغرةَ بيانات. لكنّ من يفتح `/student/learning` بدورٍ
   آخر كان يرى هيكلَ الصفحة ثمّ أخطاءَ ٤٠٣ متفرّقة بدل أن يُوجَّه إلى
   بوابته — وهو ما يقرأه المستخدم عطبا لا منعا. */
export const LEARNER_ROLES = ['learner', 'super_admin'] as const
/** صفحةُ حالة طلب الانضمام: للمتقدّم، وللمدرّب الذي كان متقدّما */
export const APPLICANT_ROLES = ['trainer_applicant', 'trainer', 'super_admin'] as const

type GuardState = 'loading' | 'ok' | 'anon' | 'forbidden' | 'unreachable'

/* محاولتان بعد الأولى — تكفيان لإيقاظ دالّةٍ باردة، ولا تُبقيان المستخدم
   ينتظر دهرا إن كان الانقطاع حقيقيّا. */
const RETRY_DELAYS_MS = [500, 1500] as const

export default function RequireRole({ allow }: { allow: readonly string[] }) {
  /* حُذف تجاوزُ «معاينة المالك»: كان علمٌ في localStorage مع VITE_DEMO_MODE
     يجعل الحارس يمرّر أيَّ دورٍ بلا جلسة. حارسُ صلاحياتٍ له بابٌ خلفي ليس حارسا. */
  const [state, setState] = useState<GuardState>('loading')
  const [home, setHome] = useState('/student')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const run = async () => {
      for (let i = 0; ; i += 1) {
        const r = await verifySession()
        if (!alive) return
        if (r.status === 'ok') {
          if (r.session.roles.some((role) => allow.includes(role))) setState('ok')
          else { setHome(homePathForRoles(r.session.roles)); setState('forbidden') }
          return
        }
        if (r.status === 'anon') { setState('anon'); return }
        /* تعذَّر الوصول — نُعيد المحاولة، ولا نقرّر شيئا */
        if (i >= RETRY_DELAYS_MS.length) { setState('unreachable'); return }
        await new Promise((res) => setTimeout(res, RETRY_DELAYS_MS[i]))
        if (!alive) return
      }
    }
    setState('loading')
    void run()
    return () => { alive = false }
    /* `allow` في الاعتماديّات عمدا. الحرّاسُ الخمسة في App.tsx إخوةٌ في الموضع
       نفسِه من شجرة المسارات، فحين يُحوَّل متعلّمٌ من `/admin` إلى `/student`
       يُعيد React استعمالَ هذه النسخةِ نفسِها بقائمةٍ جديدة — ولو لم يُعَد
       التحقّق لبقيت الحالةُ «ممنوع» و`<Navigate>` إلى الصفحةِ التي نحن فيها،
       فتُعرض صفحةٌ سوداءُ بلا شيء (شُوهدت في جولة ٢٠٢٦-٠٩). */
  }, [attempt, allow])

  if (state === 'loading') {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5" aria-busy="true" aria-label="التحقق من الصلاحيات">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[#38A7B4]" />
        <p className="mt-4 text-sm font-semibold text-muted-foreground">نتحقق من صلاحياتك…</p>
      </div>
    )
  }
  /* لا تحويلَ على تعذُّرِ وصول: من يُحوَّل هنا يظنّ أنّ صلاحيّته سُحبت */
  if (state === 'unreachable') {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-foreground">
        <ServerOff className="h-12 w-12 text-muted-foreground/50" />
        <h1 className="mt-5 text-xl font-black">تعذّر التحقّق من صلاحيّتك</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-7 text-muted-foreground">
          لم يصلنا ردٌّ من الخادم، ولا نُقرّر صلاحيّتك بلا ردّ — فلن نأخذك إلى بوابةٍ قد لا تكون بوابتك.
          جرّب مرّة أخرى بعد لحظة.
        </p>
        <Button tone="secondary" onClick={() => setAttempt((n) => n + 1)} className="mt-6">
          <RefreshCw className="h-3.5 w-3.5" /> أعد المحاولة
        </Button>
      </div>
    )
  }
  if (state === 'anon') return <Navigate to="/auth" replace />
  if (state === 'forbidden') return <Navigate to={home} replace />
  return <Outlet />
}
