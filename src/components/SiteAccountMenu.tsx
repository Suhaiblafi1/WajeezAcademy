/* اسمُ الداخل في ترويسة الموقع العامّ — وقائمةٌ فيها الخروج.

   ═══ العطبُ الذي كُتب له ═══

   كان الاسمُ في الترويسة رابطا واحدا إلى البوّابة، لا غير. فمن أراد أن يخرج
   — وهو في صفحةٍ عامّة — لزمه أن **يدخل** بوّابتَه أوّلا ثمّ يفتح قائمتَها
   ثمّ يخرج. ثلاثُ خطواتٍ وتحميلُ بوّابةٍ كاملةٍ لفعلٍ واحد. وشكاها صاحبُ
   المنصّة (١٣ سبتمبر ٢٠٢٦): «أحتاج أن ينسدل من اسمي في الصفحة الرئيسيّة
   خيارُ الخروج بدل أن أدخل للداخل وبعدها أخرج».

   وليست راحةً فحسب: الخروجُ من جهازٍ مشتركٍ يجب أن يكون في متناول اليد —
   والبابُ الذي يحتاج ثلاثَ خطواتٍ لا يُستعمل.

   ═══ وما فيها ═══

   بابان لا أكثر: **بوّابتي** (وهي ما كان الاسمُ يفعله) و**تسجيل الخروج**.
   وشؤونُ الحساب تبقى في البوّابة حيث تُعرض بإطارها الصحيح. */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, LayoutDashboard, LogOut, User } from 'lucide-react'
import { signOut } from '@/services/auth'
import { Inset } from '@/components/ui/Surface'

export interface SiteAccountMenuProps {
  name: string
  /** وجهةُ «بوّابتي» — بوّابةُ صاحب الاسم لا بوّابةُ المتعلّم دائما */
  portalHome: string
  /** تُنادى بعد نجاح الخروج كي تعود الترويسةُ إلى «دخول» بلا إعادة تحميل */
  onSignedOut: () => void
  className?: string
}

export default function SiteAccountMenu({ name, portalHome, onSignedOut, className = '' }: SiteAccountMenuProps) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  /* مستمعٌ على المستند لا ستارةٌ `fixed`: ترويسةُ الموقع تحمل `backdrop-blur`،
     و`backdrop-filter` يجعل حاملَه كتلةً حاضنةً لكلّ `fixed` في ذرّيّته —
     فالستارةُ لا تمتدّ إلّا على الترويسة. والشرحُ في `StaffAccountMenu`. */
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  /* الخروجُ ينتظر مسحَ الجلسة عند الخادم قبل أن تتغيّر الشاشة — وإلّا قيل
     له «خرجت» والكوكي حيّ. ولا يُنقل من مكانه: هو في صفحةٍ عامّةٍ يقرؤها،
     فتبقى مفتوحةً أمامه وقد صار زائرا. */
  const doSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    await signOut()
    setOpen(false)
    setSigningOut(false)
    onSignedOut()
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <Inset
        as="button"
        type="button"
        tone="accent"
        interactive
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="قائمة الحساب"
        className="flex w-full cursor-pointer items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-teal-light-ink transition hover:bg-teal/20"
      >
        <User className="h-4 w-4" />
        <span className="max-w-[8rem] truncate">{name}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </Inset>

      {open && (
        <Inset role="menu" tone="solid" className="absolute left-0 top-12 z-50 w-60 p-2 shadow-2xl">
          <Link
            to={portalHome}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-read font-bold text-foreground transition hover:bg-white/[0.04]"
          >
            <LayoutDashboard className="h-4 w-4" />
            بوّابتي
          </Link>
          <button
            type="button"
            onClick={doSignOut}
            disabled={signingOut}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-read font-bold text-foreground transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {signingOut ? 'يُسجَّل الخروج…' : 'تسجيل الخروج'}
          </button>
        </Inset>
      )}
    </div>
  )
}
