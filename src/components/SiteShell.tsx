import { useEffect, useRef, useState } from 'react'
import { safeGet, safeRemove } from '@/services/safe-storage'
import { Link } from 'react-router'
import { Menu, User, X } from 'lucide-react'
import { CONTACT } from '@/data/stories'
import { ECOSYSTEM_NOTE } from '@/data/siteContent'
import ThemeToggle from '@/components/ThemeToggle'
import { homePathForRoles, readRoles } from '@/services/auth'

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
  const [userName] = useState<string | null>(readUserName)
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

  /* في الصفحات الداخلية يشير «مؤشر وجيز» إلى قسمه في الرئيسية */
  const links: { label: string; href: string; route?: boolean }[] = [
    { label: 'مؤشر وجيز', href: '/#diagnostic' },
    { label: 'المسارات', href: '/pathways', route: true },
    { label: 'الدورات', href: '/courses', route: true },
    { label: 'منهجية وجيز', href: '/methodology', route: true },
  ]
  const renderLink = (l: (typeof links)[number], className: string, onClick?: () => void) =>
    l.route ? (
      <Link key={l.href} to={l.href} onClick={onClick} className={className}>{l.label}</Link>
    ) : (
      <a key={l.href} href={l.href} onClick={onClick} className={className}>{l.label}</a>
    )

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-8 w-8 object-contain md:h-10 md:w-10" />
          <span className="text-base font-black leading-none md:text-lg"><span className="hidden min-[370px]:inline">أكاديمية </span><span className="text-teal-light-ink">وجيز</span></span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {links.map((l) =>
            renderLink(l, 'transition hover:text-teal-light-ink')
          )}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {userName ? (
            <Inset as={Link} tone="accent" interactive to={portalHome} className="hidden items-center gap-2 px-4 py-2 text-sm font-semibold text-teal-light-ink transition hover:bg-teal/20 md:inline-flex">
              <User className="h-4 w-4" />
              {userName}
            </Inset>
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
            <Inset as={Link} tone="accent" interactive to={portalHome} onClick={() => setOpen(false)} className="mt-2 flex items-center justify-center gap-2 px-5 py-3 font-semibold text-teal-light-ink">
              <User className="h-4 w-4" /> {userName}
            </Inset>
          ) : (
            <Inset as={Link} interactive to="/auth"
              onClick={() => setOpen(false)} className="mt-2 flex w-full items-center justify-center gap-2 px-5 py-3 font-semibold text-muted-foreground">
              <User className="h-4 w-4" /> دخول / إنشاء حساب
            </Inset>
          )}
          <a href="/#diagnostic" onClick={() => setOpen(false)} className="btn-teal mt-2 flex w-full px-5 py-3">
            ابدأ مؤشر وجيز
          </a>
          <div className="mt-3 flex justify-center">
            <ThemeToggle />
          </div>
        </nav>
      )}
    </header>
  )
}

/* قالب الصفحات العامة الداخلية: ترويسة موحدة + محتوى + تذييل موحد */
export default function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-5 py-12 md:py-16">{children}</div>
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
