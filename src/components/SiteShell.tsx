import { useEffect, useRef, useState } from 'react'
import { safeGet, safeRemove } from '@/services/safe-storage'
import { Link } from 'react-router'
import PublicSearch from './PublicSearch'
import { LogOut, Menu, Search as SearchIcon, User, X } from 'lucide-react'
import { CONTACT } from '@/data/stories'
import { ECOSYSTEM_NOTE } from '@/data/siteContent'
import ThemeToggle from '@/components/ThemeToggle'
import SiteAccountMenu from '@/components/SiteAccountMenu'
import { homePathForRoles, readRoles, signOut } from '@/services/auth'

import { Inset } from "@/components/ui/Surface";
/* اسم المستخدم المحفوظ محليا — نفس منطق ترويسة الرئيسية */
function readUserName(): string | null {
  const raw = safeGet('wajeez_user')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { name?: string; exp?: number }
    if (typeof parsed.exp === 'number' && Date.now() > parsed.exp) {
      safeRemove('wajeez_user')
      return null
    }
    return parsed.name ?? raw
  } catch {
    return raw
  }
}

/* ترويسة موحدة مع الرئيسية: شعار + روابط + حساب + زر المؤشر + قائمة جوال */
function SiteNav() {
  const [open, setOpen] = useState(false)
  /* والاسمُ حالةٌ تُكتب لا قراءةٌ واحدة: من خرج من قائمة الاسم تعود به
     الترويسةُ إلى «دخول» في مكانها، بلا إعادة تحميلٍ للصفحة. */
  const [userName, setUserName] = useState<string | null>(readUserName)
  /* وجهةُ الاسم بوّابةُ صاحبه لا بوّابةُ المتعلّم دائما: كان مديرُ النظام
     يضغط اسمَه فيجد نفسه طالبا — وليس عطبا في الصلاحيات بل في الرابط. */
  const [portalHome] = useState(() => homePathForRoles(readRoles()))
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const mobileNavRef = useRef<HTMLElement>(null)

  /* قائمة الجوال: عند فتحها ينتقل التركيز إليها، وتُغلق بـEscape ويعود التركيز لزرها */
  useEffect(() => {
    if (!open) return
    const first = mobileNavRef.current?.querySelector<HTMLElement>('a, button')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        menuBtnRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  /* في الصفحات الداخلية يشير «مؤشر وجيز» إلى قسمه في الرئيسية.

     و«من نحن» أوّلُ الشريط، في مكان «منهجية وجيز» — قرارُ صاحب المنصّة (٢٣
     سبتمبر ٢٠٢٦) حين صارت حكايةَ وجيز كاملة. والمنهجيّةُ خرجت من الشريط لا
     من الموقع: في التذييل أدناه، ومن محطّة التشخيص في «من نحن» نفسِها.
     والروابطُ نفسُها في رأس الرئيسيّة — يحرس تطابقَهما `site-nav-size.test.ts`. */
  const links: { label: string; href: string; route?: boolean }[] = [
    { label: 'من نحن', href: '/p/about', route: true },
    { label: 'مؤشر وجيز', href: '/#diagnostic' },
    { label: 'المسارات', href: '/pathways', route: true },
    { label: 'الدورات', href: '/courses', route: true },
    { label: 'انضم كمدرب', href: '/join-trainer', route: true },
  ]
  const renderLink = (l: (typeof links)[number], className: string, onClick?: () => void) =>
    l.route ? (
      <Link key={l.href} to={l.href} onClick={onClick} className={className}>{l.label}</Link>
    ) : (
      <a key={l.href} href={l.href} onClick={onClick} className={className}>{l.label}</a>
    )

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-paper/80 backdrop-blur-xl">
      <div className="shell flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-8 w-8 object-contain md:h-10 md:w-10" />
          <span className="text-base font-black leading-none md:text-lg"><span className="hidden min-[370px]:inline">أكاديمية </span><span className="text-teal-light-ink">وجيز</span></span>
        </Link>
        {/* ═══ ولماذا يكبر الشريطُ على الحاسوب وحدَه ═══

            شكا صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦) من صغر التبويبات على الشاشة
            العريضة. وكانت ١٤px بفراغٍ ثابتٍ مهما اتّسعت الشاشة: مقاسٌ وُلد
            للّوح فبقي على الحاسوب، فيبدو الشريطُ هامشا لا طريقا.

            والكِبَرُ من `lg` لا من `md`: على اللّوح تتزاحم الخمسةُ مع العلامة
            وأزرارِ اليمين، فما يُصلح الحاسوبَ يكسر ما دونه. */}
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex lg:gap-9 lg:text-base">
          {links.map((l) =>
            renderLink(l, 'transition hover:text-teal-light-ink')
          )}
        </nav>
        <div className="flex items-center gap-3">
          {/* بحثُ الزائر — كان لوحُ البحث محجوبا على الموظّفين وحدَهم */}
          <button
            onClick={() => window.dispatchEvent(new Event('wajeez:open-public-search'))}
            aria-label="ابحث في المسارات والدورات"
            title="ابحث (Ctrl+K)"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/12 text-muted-foreground transition hover:border-teal/50 hover:text-teal-light-ink"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
          <ThemeToggle />
          {userName ? (
            /* الاسمُ قائمةٌ لا رابطا: فيها «بوّابتي» وفيها الخروج — والخروجُ
               كان يحتاج دخولَ البوّابة أوّلا (`SiteAccountMenu.tsx`). */
            <SiteAccountMenu
              name={userName} portalHome={portalHome} onSignedOut={() => setUserName(null)}
              className="hidden md:block"
            />
          ) : (
            <Inset as={Link} tone="accent" interactive to="/auth" className="hidden items-center gap-2 px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:border-teal/50 hover:text-teal-light-ink md:inline-flex">
              <User className="h-4 w-4" />
              دخول
            </Inset>
          )}
          <a
            href="/#diagnostic"
            className="btn-teal hidden px-5 py-2.5 text-sm md:inline-flex"
          >
            ابدأ مؤشر وجيز
          </a>
          <button
            ref={menuBtnRef}
            className="md:hidden grid h-11 w-11 place-items-center text-foreground"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'إغلاق قائمة التنقل' : 'فتح قائمة التنقل'}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-menu" ref={mobileNavRef} aria-label="قائمة التنقل الرئيسية" className="border-t border-white/5 bg-paper px-5 py-4 md:hidden">
          {links.map((l) =>
            renderLink(l, 'block py-2.5 text-muted-foreground hover:text-teal-light-ink', () => setOpen(false))
          )}
          {userName ? (
            <>
              <Inset as={Link} tone="accent" interactive to={portalHome} onClick={() => setOpen(false)} className="mt-2 flex items-center justify-center gap-2 px-5 py-3 font-semibold text-teal-light-ink">
                <User className="h-4 w-4" /> {userName}
              </Inset>
              {/* وفي الجوّال يُعرض الخروجُ صريحا لا منسدلا: القائمةُ مفتوحةٌ
                  أصلا، ومنسدلةٌ داخل منسدلةٍ لا تُفتح بإصبع. */}
              <button
                type="button"
                onClick={() => { setOpen(false); void signOut().then(() => setUserName(null)) }}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold text-muted-foreground transition hover:bg-red-500/10 hover:text-red-300"
              >
                <LogOut className="h-4 w-4" /> تسجيل الخروج
              </button>
            </>
          ) : (
            <Inset as={Link} interactive to="/auth"
              onClick={() => setOpen(false)} className="mt-2 flex w-full items-center justify-center gap-2 px-5 py-3 font-semibold text-muted-foreground">
              <User className="h-4 w-4" /> دخول / إنشاء حساب
            </Inset>
          )}
          <a href="/#diagnostic" onClick={() => setOpen(false)} className="btn-teal mt-2 flex w-full px-5 py-3">
            ابدأ مؤشر وجيز
          </a>
          <ThemeToggle variant="row" />
        </nav>
      )}
      {/* اللوحُ نفسُه — يُصيَّر مرّةً مع الترويسة فيُفتح من أيّ صفحةٍ عامّة */}
      <PublicSearch />
    </header>
  )
}

/* قالب الصفحات العامة الداخلية: ترويسة موحدة + محتوى + تذييل موحد */
export default function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <SiteNav />
      <div className="shell py-12 md:py-16">{children}</div>
      <footer className="border-t border-white/5 py-8 text-center text-xs leading-6 text-muted-foreground">
        <div>© 2026 {ECOSYSTEM_NOTE}</div>
        <div className="mt-1">
          {CONTACT.email} ·{' '}
          {CONTACT.locations.map((loc, i) => (
            <span key={loc.label}>
              {i > 0 && ' · '}
              {loc.href ? (
                <a href={loc.href} target="_blank" rel="noreferrer" className="inline-flex min-h-[24px] items-center py-1 transition hover:text-teal-light-ink">{loc.label}</a>
              ) : (
                loc.label
              )}
            </span>
          ))}
        </div>
        <div className="mt-2">
          <Link to="/methodology" className="inline-flex min-h-[24px] items-center py-1 font-semibold text-muted-foreground transition hover:text-teal-light-ink">
            منهجية وجيز
          </Link>
        </div>
      </footer>
    </div>
  )
}
