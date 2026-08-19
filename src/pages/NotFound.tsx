import { Link } from 'react-router'
import { Compass } from 'lucide-react'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'

/* ───────────────── صفحة 404 ───────────────── */
export default function NotFound() {
  return (
    <SiteShell>
      <SeoHead title="الصفحة غير موجودة" description="الصفحة التي تبحث عنها غير موجودة في أكاديمية وجيز." noindex />
      <div className="flex flex-col items-center py-20 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[#38A7B4]/15">
          <Compass className="h-8 w-8 text-[#6EC7D1]" />
        </span>
        <h1 className="mt-6 text-3xl font-black">هذه الصفحة غير موجودة</h1>
        <p className="mt-3 max-w-md leading-8 text-white/55">
          ربما تغيّر العنوان أو نُقلت الصفحة. أصدق طريق للعودة: التشخيص — يعرف دائما أين تبدأ.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/diagnostic" className="rounded-2xl bg-[#247B84] px-7 py-3.5 font-bold text-white transition hover:bg-[#1E666E]">
            ابدأ التشخيص
          </Link>
          <Link to="/" className="rounded-2xl border border-white/15 px-7 py-3.5 font-bold text-white/75 transition hover:border-white/40">
            الرئيسية
          </Link>
          <Link to="/pathways" className="rounded-2xl border border-white/15 px-7 py-3.5 font-bold text-white/75 transition hover:border-white/40">
            تصفح المسارات
          </Link>
        </div>
      </div>
    </SiteShell>
  )
}
