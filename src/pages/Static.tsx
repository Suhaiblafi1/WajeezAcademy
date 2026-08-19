import { Link, useParams } from "react-router";
import { ArrowRight, CheckCircle2, ChevronDown } from "lucide-react";
import { useState } from "react";
import { staticPageBySlug, faqs } from "@/data/siteContent";
import SeoHead from "@/components/SeoHead";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-[#0D0D0D] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0D0D0D]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2 text-white/70 transition hover:text-white">
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm font-medium">الرئيسية</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
            <span className="font-black">أكاديمية وجيز</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12 md:py-16">{children}</main>
      <footer className="border-t border-white/5 py-8 text-center text-xs text-white/55">
        © 2026 أكاديمية وجيز — من مجموعة wajeez.com
      </footer>
    </div>
  );
}

/* ─── صفحة محتوى عامة (من نحن، الخصوصية، الشروط، الاسترداد) ─── */
function StaticContent({ slug }: { slug: string }) {
  const page = staticPageBySlug(slug);
  if (!page) {
    return (
      <Shell>
        <p className="py-20 text-center text-xl font-bold">هذه الصفحة غير موجودة</p>
      </Shell>
    );
  }
  return (
    <Shell>
      <SeoHead title={page.title} description={page.intro} path={`/p/${page.slug}`} />
      <h1 className="text-3xl font-black leading-snug md:text-4xl">{page.title}</h1>
      <p className="mt-4 text-lg leading-loose text-white/60">{page.intro}</p>
      <div className="mt-10 space-y-8">
        {page.sections.map((s, i) => (
          <section key={i} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            {s.heading && (
              <h2 className="flex items-center gap-2 text-xl font-black text-[#6EC7D1]">
                <CheckCircle2 className="h-5 w-5" />
                {s.heading}
              </h2>
            )}
            {s.paragraphs?.map((p, j) => (
              <p key={j} className="mt-4 leading-loose text-white/70">{p}</p>
            ))}
            {s.bullets && (
              <ul className="mt-4 space-y-3">
                {s.bullets.map((b, j) => (
                  <li key={j} className="flex items-start gap-3 leading-relaxed text-white/70">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FABC05]" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <div className="mt-8 rounded-3xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 p-6 text-center md:p-8">
        <h2 className="text-xl font-black">لم تجد إجابتك؟</h2>
        <p className="mt-2 text-sm text-white/60">فريقنا يقرأ كل رسالة بنفسه ويرد خلال يوم عمل واحد.</p>
        <Link
          to="/contact"
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#247B84] px-6 py-3 font-bold text-white transition hover:bg-[#1E666E]"
        >
          صفحة التواصل
        </Link>
      </div>
      <div className="mt-10 text-center">
        <Link to="/diagnostic" className="inline-flex items-center gap-2 rounded-2xl bg-[#38A7B4] px-8 py-4 font-black text-[#0D0D0D] transition hover:bg-[#6EC7D1]">
          ابدأ التشخيص الذكي مجانا
        </Link>
      </div>
    </Shell>
  );
}

/* ─── صفحة الأسئلة الشائعة ─── */
function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Shell>
      <SeoHead title="الأسئلة الشائعة" description="إجابات صريحة عن أكثر ما يسألنا عنه الزوار: التشخيص، الأسعار، الشهادات، والاسترداد." path="/p/faq" />
      <h1 className="text-3xl font-black leading-snug md:text-4xl">الأسئلة الشائعة</h1>
      <p className="mt-4 text-lg leading-loose text-white/60">جمعنا ما يسألنا عنه الزوار فعلا — وأجبنا بلا مجاملة.</p>
      <div className="mt-10 space-y-3">
        {faqs.map((f, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-right font-bold"
            >
              {f.q}
              <ChevronDown className={`h-5 w-5 shrink-0 text-[#6EC7D1] transition-transform duration-300 ${open === i ? "rotate-180" : ""}`} />
            </button>
            <div className={`grid transition-all duration-300 ${open === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
              <div className="overflow-hidden">
                <p className="px-6 pb-6 leading-loose text-white/60">{f.a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-10 text-center">
        <Link to="/contact" className="text-sm font-bold text-[#6EC7D1] underline-offset-4 hover:underline">
          لم تجد سؤالك؟ راسلنا مباشرة
        </Link>
      </div>
    </Shell>
  );
}

export default function StaticPage() {
  const { slug } = useParams();
  if (slug === "faq") return <FaqPage />;
  return <StaticContent slug={slug ?? ""} />;
}
