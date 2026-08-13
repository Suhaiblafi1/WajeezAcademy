import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Award, BookOpen, CheckCircle2, Compass, FileCheck, Quote, Route, Star, User, X } from 'lucide-react'
import { appReviews, stories, type Story } from '@/data/stories'
import Modal from '@/components/Modal'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'

/* ───────────────── صفحة القصص: كل قصص المتعلمين + آراء تطبيق وجيز ───────────────── */
export default function StoriesPage() {
  const [open, setOpen] = useState<Story | null>(null)

  return (
    <SiteShell>
      <SeoHead
        title="قصص المتعلمين"
        description="قصص حقيقية لمتعلمين بدأوا بالتشخيص وانتهوا بمخرج يمكنك رؤيته — مع آراء مستخدمي تطبيق وجيز عن العلامة."
        path="/stories"
      />

      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#38A7B4]/30 bg-[#38A7B4]/10 px-4 py-1.5 text-sm text-[#6EC7D1]">
          <Quote className="h-3.5 w-3.5" />
          قصص حدثت بالفعل
        </div>
        <h1 className="mt-5 text-3xl font-black md:text-4xl">مسارات مشى فيها غيرك قبلك</h1>
        <p className="mx-auto mt-3 max-w-xl leading-8 text-white/60">
          كل قصة بدأت بتشخيص، ومرّت بمسار ومدرب، وانتهت بمخرج يمكنك أن تراه — اختر قصة واقرأها كاملة.
        </p>
      </div>

      {/* شبكة القصص الكاملة */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stories.map((s) => (
          <button
            key={s.id}
            onClick={() => setOpen(s)}
            className="group flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] text-right transition hover:border-[#38A7B4]/40 hover:shadow-[0_20px_60px_-30px_rgba(56,167,180,0.4)]"
          >
            <div className="relative h-44 overflow-hidden">
              <img
                src={s.img}
                alt={`قصة ${s.name}`}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#101415] to-transparent" />
              <span className="absolute bottom-3 right-4 rounded-full bg-[#247B84] px-3 py-1 text-[11px] font-bold text-white">{s.tag}</span>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="text-sm font-bold">
                {s.name} <span className="font-normal text-white/50">— {s.role}</span>
              </p>
              <p className="mt-2 line-clamp-2 text-xs leading-6 text-white/55">{s.before}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-6 text-white/80">
                <span className="font-bold text-[#FABC05]">النتيجة: </span>
                {s.result}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#6EC7D1]">
                اقرأ القصة كاملة
                <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-1" />
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* آراء مستخدمي تطبيق وجيز — بسياق واضح يفصلها عن الأكاديمية */}
      <section className="mt-16 border-t border-white/5 pt-14">
        <div className="text-center">
          <h2 className="text-2xl font-black md:text-3xl">ماذا يقول مستخدمو تطبيق وجيز عن تجربتهم مع العلامة</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/55">
            هذه الآراء عن تطبيق وجيز للكتب والملخصات — المنصة الأم التي خرجت منها الأكاديمية — من تقييمات المستخدمين على المتجرين.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {appReviews.map((r) => (
            <figure key={r.name} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-[#38A7B4]/40">
              <div className="flex items-center gap-1 text-[#FABC05]">
                {[...Array(5)].map((_, s) => <Star key={s} className="h-4 w-4 fill-current" />)}
              </div>
              <blockquote className="mt-4 text-sm leading-8 text-white/85">"{r.text}"</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#38A7B4]/15 text-sm font-bold text-[#6EC7D1]">
                  {r.name.charAt(0)}
                </span>
                <span className="text-sm font-semibold">{r.name}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* دعوة */}
      <div className="mt-14 text-center">
        <Link to="/diagnostic" className="inline-flex items-center gap-2 rounded-2xl bg-[#247B84] px-8 py-4 font-bold text-white transition hover:bg-[#1E666E]">
          <Compass className="h-4 w-4" />
          قصتك التالية تبدأ من تشخيصك
        </Link>
      </div>

      {/* نافذة القصة الكاملة */}
      {open && (
        <Modal onClose={() => setOpen(null)} label={`قصة ${open.name} كاملة`} panelClassName="my-8 w-full max-w-3xl">
          <div dir="rtl" className="overflow-hidden rounded-3xl border border-white/10 bg-[#101415]">
            <div className="relative h-56 overflow-hidden md:h-72">
              <img src={open.img} alt={`صورة رمزية لقصة ${open.name}`} loading="lazy" width="1200" height="600" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#101415] via-[#101415]/40 to-transparent" />
              <button
                onClick={() => setOpen(null)}
                aria-label="إغلاق القصة"
                className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white/80 backdrop-blur transition hover:bg-black/70 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="absolute bottom-4 right-6 flex items-center gap-3">
                <span className="rounded-full bg-[#247B84] px-4 py-1.5 text-sm font-bold text-white">{open.tag}</span>
                <span className="text-sm text-white/80">{open.name} — {open.role}</span>
              </div>
            </div>

            <div className="border-b border-white/5 p-8 md:p-10">
              <Quote className="h-8 w-8 text-[#38A7B4]/50" />
              <p className="mt-5 text-lg leading-9 text-white/90 md:text-xl md:leading-10">
                {open.before} {open.turn}
              </p>
            </div>

            <div className="grid gap-px bg-white/5 md:grid-cols-3">
              <div className="bg-[#101415] p-6">
                <div className="flex items-center gap-2 text-xs text-[#6EC7D1]"><Route className="h-4 w-4" /> المسار الذي {open.gender === 'f' ? 'سلكته' : 'سلكه'}</div>
                <div className="mt-2 font-bold leading-7">{open.pathway}</div>
                <div className="mt-1 text-xs text-white/50">{open.duration}</div>
              </div>
              <div className="bg-[#101415] p-6">
                <div className="flex items-center gap-2 text-xs text-[#6EC7D1]"><User className="h-4 w-4" /> المدرب</div>
                <div className="mt-2 font-bold">{open.trainer}</div>
                <div className="mt-1 text-xs text-white/50">{open.gender === 'f' ? 'رافقها' : 'رافقه'} في التقييم والمتابعة طوال المسار</div>
              </div>
              <div className="bg-[#101415] p-6">
                <div className="flex items-center gap-2 text-xs text-[#6EC7D1]"><FileCheck className="h-4 w-4" /> المخرج العملي</div>
                <div className="mt-2 font-bold leading-7">{open.output}</div>
              </div>
            </div>

            <div className="border-t border-white/5 p-8 md:px-10">
              <div className="flex items-center gap-2 text-xs text-[#6EC7D1]">
                <BookOpen className="h-4 w-4" /> الدورات التي {open.gender === 'f' ? 'أخذتها' : 'أخذها'} {open.name} — وماذا خرج{open.gender === 'f' ? 'ت' : ''} من كل واحدة
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {open.courses.map((c) => (
                  <div key={c.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-bold leading-relaxed">{c.name}</p>
                    <p className="mt-2 flex items-start gap-1.5 text-xs leading-6 text-white/55">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#38A7B4]" />
                      {c.output}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/5 bg-gradient-to-l from-[#38A7B4]/10 to-transparent p-8 md:px-10">
              <div className="flex items-start gap-3">
                <Award className="mt-1 h-6 w-6 shrink-0 text-[#FABC05]" />
                <div>
                  <div className="text-sm font-semibold text-[#FABC05]">وكيف انتهت القصة؟</div>
                  <p className="mt-2 leading-8 text-white/90">{open.result}</p>
                  <div className="mt-4 text-xs text-white/50">— {open.name}، {open.role}</div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/5 p-6 text-center">
              <Link to="/diagnostic" className="inline-flex items-center gap-2 font-semibold text-[#6EC7D1] transition hover:text-[#38A7B4]">
                قصتك التالية تبدأ من تشخيصك
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Modal>
      )}
    </SiteShell>
  )
}
