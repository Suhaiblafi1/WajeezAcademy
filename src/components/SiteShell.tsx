import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { CONTACT } from '@/data/stories'
import { ECOSYSTEM_NOTE } from '@/data/siteContent'

/* قالب الصفحات العامة الداخلية: ترويسة عودة + محتوى + تذييل موحد */
export default function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-ground text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ground/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2 text-white/70 transition hover:text-white">
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm font-medium">الرئيسية</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-white/55 md:flex">
            <Link to="/pathways" className="transition hover:text-teal-light-ink">المسارات</Link>
            <Link to="/courses" className="transition hover:text-teal-light-ink">الدورات</Link>
            <Link to="/stories" className="transition hover:text-teal-light-ink">القصص</Link>
            <Link to="/trainers" className="transition hover:text-teal-light-ink">المدربون</Link>
            <Link to="/contact" className="transition hover:text-teal-light-ink">تواصل</Link>
          </nav>
          <Link to="/diagnostic" className="rounded-xl bg-teal-deep px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-darker">
            ابدأ التشخيص
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-12 md:py-16">{children}</div>
      <footer className="border-t border-white/5 py-8 text-center text-xs leading-6 text-white/55">
        <div>© 2026 {ECOSYSTEM_NOTE}</div>
        <div className="mt-1">
          {CONTACT.email} ·{' '}
          {CONTACT.locations.map((loc, i) => (
            <span key={loc.label}>
              {i > 0 && ' · '}
              {loc.href ? (
                <a href={loc.href} target="_blank" rel="noreferrer" className="transition hover:text-teal-light-ink">{loc.label}</a>
              ) : (
                loc.label
              )}
            </span>
          ))}
        </div>
        <div className="mt-2">
          <Link to="/methodology" className="font-semibold text-white/50 transition hover:text-teal-light-ink">
            منهجية وجيز
          </Link>
        </div>
      </footer>
    </div>
  )
}
