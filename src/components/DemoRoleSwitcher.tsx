/* مبدّل أدوار الديمو — شريط عائم لبيئة العرض المحلية فقط.
   شروط الظهور مجتمعة:
   1) VITE_DEMO_MODE=true وقت البناء (لا يُبنى أصلا في حزمة الإنتاج).
   2) الخادم نفسه يؤكد DEMO_MODE عبر /api/demo/status — وإلا يختفي الشريط.
   التبديل ينشئ جلسة حقيقية لحساب الديمو المطلوب ثم يوجّه لبوابته. */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { apiGet, apiPost } from '../services/api'
import { enablePreview } from '../services/access'

type DemoRole = 'student' | 'consultant' | 'trainer' | 'admin' | 'superadmin'

const ROLES: { key: DemoRole; label: string; to: string }[] = [
  { key: 'student', label: 'طالب', to: '/student' },
  { key: 'consultant', label: 'مستشار', to: '/advisor' },
  { key: 'trainer', label: 'مدرب', to: '/trainer' },
  { key: 'admin', label: 'إدارة', to: '/admin' },
  { key: 'superadmin', label: 'النظام', to: '/admin' },
]

export default function DemoRoleSwitcher() {
  const navigate = useNavigate()
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState<DemoRole | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    apiGet<{ enabled: boolean }>('/api/demo/status')
      .then((r) => { if (alive) setEnabled(r.enabled) })
      .catch(() => { if (alive) setEnabled(false) })
    return () => { alive = false }
  }, [])

  if (!enabled) return null

  const switchRole = async (role: DemoRole, to: string) => {
    if (busy) return
    setBusy(role)
    setError('')
    try {
      await apiPost('/api/demo/switch-role', { role })
      /* بوابة الطالب النموذجية تُفتح باستحقاق محلي — في الديمو نمنح معاينة موسومة */
      if (role === 'student') enablePreview()
      navigate(to)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر التبديل')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div dir="rtl" className="fixed inset-x-0 bottom-3 z-[90] flex justify-center px-3" role="region" aria-label="مبدل أدوار الديمو">
      <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-amber-400/30 bg-[#161513]/95 px-3 py-2 shadow-2xl backdrop-blur">
        <span className="px-1 text-[11px] font-bold text-amber-300">وضع الديمو</span>
        {ROLES.map((r) => (
          <button
            key={r.key}
            type="button"
            disabled={busy !== null}
            onClick={() => switchRole(r.key, r.to)}
            className="rounded-xl bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-white/80 transition hover:bg-white/[0.12] hover:text-white disabled:opacity-40"
          >
            {busy === r.key ? '…' : r.label}
          </button>
        ))}
        {error && <span className="w-full pt-1 text-center text-[11px] text-red-300">{error}</span>}
      </div>
    </div>
  )
}
