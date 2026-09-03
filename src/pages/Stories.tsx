import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Award, BookOpen, CheckCircle2, Compass, FileCheck, Quote, Route, Star, Target, X } from 'lucide-react'
import { appReviews, stories, STORY_ILLUSTRATIVE_BADGE_AR, type Story } from '@/data/stories'
import Modal from '@/components/Modal'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'
import StoryAvatar from '@/components/StoryAvatar'

/* ───────────────── صفحة القصص: كل قصص المتعلمين + آراء تطبيق وجيز ─────────────────

   ما يُعرض في القصّة ثلاثةٌ لا رابعَ لها: كيف دخل (تشخيصٌ أم مسارٌ جاهز)،
   ودوراتُ الكتالوج التي أخذها وماذا خرج من كلٍّ منها، ومشروعُ التخرّج —
   ومعها قياسُ المهارة قبل وبعد. وحُذف المدرّب: قاعدتُنا ألّا يُعرض اسمُ
   مدرّبٍ قبل اعتماد شعبته، فكان حقلا يعرض الجملةَ المؤقّتة نفسَها في كلّ
   بطاقة. والتنويه بأنّها نماذجُ توضيحية باقٍ — بخطٍّ ثانويّ لا يزاحم. */
export default function StoriesPage() {
  const [open, setOpen] = useState<Story | null>(null)

  return (
    <SiteShell>
      <SeoHead
        title="نماذج رحلات التعلم"
        description="نماذج توضيحية لرحلات تعلم تبدأ بالتشخيص أو بمسار جاهز وتنتهي بمشروع تخرج — مع قياس المهارة قبل وبعد."
        path="/stories"
      />

      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-sm font-bold text-gold-ink">
          <Quote className="h-3.5 w-3.5" />
          رحلات التعلم
        </div>
        <h1 className="mt-5 text-2xl font-black sm:text-3xl md:text-4xl">هكذا تبدو الرحلة عندنا</h1>
        <p className="mx-auto mt-3 max-w-xl leading-8 text-muted-foreground">
          كل رحلة تبدأ بتشخيص أو بمسار جاهز، وتمر بدورات الكتالوج، وتنتهي بمشروع تخرج يدخل ملفك — ومعها قياس لما تغير فعلا.
        </p>
        <p className="mx-auto mt-3 max-w-lg text-[11px] leading-5 text-muted-foreground">
          نماذج توضيحية مركبة من أنماط شائعة بين المتعلمين — ليست شهادات لأشخاص حقيقيين.
          قصص المتعلمين الموثقة بموافقة أصحابها تُنشر هنا بعد اعتمادها.
        </p>
      </div>

      {/* شبكة القصص الكاملة */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stories.map((s) => (
          <button
            key={s.id}
            onClick={() => setOpen(s)}
            className="group flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] text-right transition hover:border-teal/40 hover:shadow-[0_20px_60px_-30px_rgba(56,167,180,0.4)]"
          >
            <div className="relative h-40 overflow-hidden">
              <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_60%_20%,rgba(56,167,180,0.35),transparent_65%)]">
                <StoryAvatar id={s.id} name={s.name} look={s.look} className="h-28 w-28" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
              <span className="absolute bottom-3 right-4 rounded-full bg-[#247B84] px-3 py-1 text-[11px] font-bold text-white">{s.tag}</span>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="text-sm font-bold">
                {s.name} <span className="font-normal text-muted-foreground">— {s.role}</span>
              </p>
              <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">{s.before}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">
                <span className="font-bold text-gold-ink">النتيجة: </span>
                {s.result}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-teal-light-ink">
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
          <h2 className="text-xl font-black sm:text-2xl md:text-3xl">ماذا يقول مستخدمو تطبيق وجيز عن تجربتهم مع العلامة</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            هذه الآراء عن تطبيق وجيز للكتب والملخصات — المنصة الأم التي خرجت منها الأكاديمية — من تقييمات المستخدمين على المتجرين.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {appReviews.map((r) => (
            <figure key={r.name} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-teal/40">
              <div className="flex items-center gap-1 text-gold-ink">
                {[...Array(5)].map((_, s) => <Star key={s} className="h-4 w-4 fill-current" />)}
              </div>
              <blockquote className="mt-4 text-sm leading-8 text-muted-foreground">"{r.text}"</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-teal/15 text-sm font-bold text-teal-light-ink">
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
        <Link to="/diagnostic" className="inline-flex items-center gap-2 rounded-2xl bg-teal-deep px-8 py-4 font-bold text-white transition hover:bg-teal-darker">
          <Compass className="h-4 w-4" />
          قصتك التالية تبدأ من تشخيصك
        </Link>
      </div>

      {/* نافذة القصة الكاملة */}
      {open && (
        <Modal onClose={() => setOpen(null)} label={`قصة ${open.name} كاملة`} panelClassName="my-8 w-full max-w-3xl">
          <div dir="rtl" className="overflow-hidden rounded-3xl border border-white/10 bg-surface">
            {/* ─────────── لماذا يتوقّف التراكب عند الهاتف ───────────

                كان الاسمُ والدورُ والشارةُ صفّا **مطلقا** أسفلَ الترويسة فوق
                الظِّلّ. وعلى شاشة الهاتف يلتفّ هذا الصفُّ إلى ثلاثة أسطر
                فيصعد داخل الترويسة — فيقع الكلامُ فوق الصورة ويُقرأ الاثنان
                معا كطبقتين متضاربتين. وهذا ما وقع فعلا.

                فصار على الهاتف: ظِلٌّ في الأعلى، ثمّ الاسمُ تحته في السياق
                العاديّ — لا تراكبَ ولا التفافَ فوق صورة. والتراكبُ يعود من
                `md:` حيث العرضُ يتّسع للصفّ في سطرٍ واحد. */}
            <div className="relative overflow-hidden md:h-60">
              <div className="grid h-40 w-full place-items-center bg-[radial-gradient(circle_at_60%_20%,rgba(56,167,180,0.35),transparent_65%)] md:h-full">
                <StoryAvatar id={open.id} name={open.name} look={open.look} className="h-32 w-32 md:h-36 md:w-36" />
              </div>
              <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-t from-surface via-surface/30 to-transparent md:h-full" />
              <button
                onClick={() => setOpen(null)}
                aria-label="إغلاق القصة"
                className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-paper/50 text-muted-foreground backdrop-blur transition hover:bg-paper/70 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-6 pb-1 pt-3 md:absolute md:bottom-4 md:right-6 md:p-0">
                <span className="rounded-full bg-teal-deep px-4 py-1.5 text-sm font-bold text-white">{open.tag}</span>
                <span className="text-sm text-muted-foreground">{open.name} — {open.role}</span>
                <span className="w-full text-[11px] font-normal text-muted-foreground md:w-auto">{STORY_ILLUSTRATIVE_BADGE_AR}</span>
              </div>
            </div>

            <div className="border-b border-white/5 p-8 md:p-10">
              <Quote className="h-8 w-8 text-teal-ink/50" />
              <p className="mt-5 text-lg leading-9 text-muted-foreground md:text-xl md:leading-10">
                {open.before} {open.turn}
              </p>
            </div>

            <div className="grid gap-px bg-white/5 md:grid-cols-3">
              <div className="bg-surface p-6">
                <div className="flex items-center gap-2 text-xs text-[#6EC7D1]">
                  {open.entry === 'diagnostic' ? <Compass className="h-4 w-4" /> : <Route className="h-4 w-4" />}
                  {open.entry === 'diagnostic' ? 'بدأ بالتشخيص' : 'اشترى مسارا جاهزا'}
                </div>
                <div className="mt-2 text-sm leading-7 text-muted-foreground">
                  {open.entry === 'diagnostic'
                    ? 'لم يكن يعرف من أين يبدأ — فرسم له التشخيص المسار.'
                    : 'كان يعرف وجهته، فبدأ المسار مباشرة.'}
                </div>
              </div>
              <div className="bg-surface p-6">
                <div className="flex items-center gap-2 text-xs text-[#6EC7D1]"><Route className="h-4 w-4" /> المسار</div>
                <div className="mt-2 font-bold leading-7">{open.pathway}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {open.weeks} أسبوعا · {open.weeklyHours} · {open.courses.length} دورات
                </div>
              </div>
              <div className="bg-surface p-6">
                <div className="flex items-center gap-2 text-xs text-[#6EC7D1]"><FileCheck className="h-4 w-4" /> مشروع التخرّج</div>
                <div className="mt-2 text-sm font-bold leading-7">{open.capstone}</div>
              </div>
            </div>

            <div className="border-t border-white/5 p-8 md:px-10">
              <div className="flex items-center gap-2 text-xs text-teal-light-ink">
                <BookOpen className="h-4 w-4" /> دورات المسار — وماذا خرج من كلّ واحدة
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {open.courses.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-bold leading-relaxed">{c.name}</p>
                    <p className="mt-2 flex items-start gap-1.5 text-xs leading-6 text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-ink" />
                      {c.output}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* القياس قبل/بعد — النتيجةُ تُروى، وهذه تُقاس */}
            <div className="border-t border-white/5 p-8 md:px-10">
              <div className="flex items-center gap-2 text-xs text-teal-light-ink">
                <Target className="h-4 w-4" /> قياس المهارة — قبل المسار وبعده
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                {open.measure.map((m, i) => (
                  <div
                    key={m.skill}
                    className={`grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] sm:items-center ${i ? 'border-t border-white/10' : ''}`}
                  >
                    <p className="text-sm font-bold leading-relaxed">{m.skill}</p>
                    <p className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">
                      <span className="mt-0.5 shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-micro font-bold">قبل</span>
                      {m.before}
                    </p>
                    <p className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">
                      <span className="mt-0.5 shrink-0 rounded-full bg-teal/15 px-2 py-0.5 text-micro font-bold text-teal-light-ink">بعد</span>
                      {m.after}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/5 bg-gradient-to-l from-teal/10 to-transparent p-8 md:px-10">
              <div className="flex items-start gap-3">
                <Award className="mt-1 h-6 w-6 shrink-0 text-gold-ink" />
                <div>
                  <div className="text-sm font-semibold text-gold-ink">وكيف انتهت القصة؟</div>
                  <p className="mt-2 leading-8 text-muted-foreground">{open.result}</p>
                  <div className="mt-4 text-xs text-muted-foreground">— {open.name}، {open.role}</div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/5 p-6 text-center">
              <Link to="/diagnostic" className="inline-flex items-center gap-2 font-semibold text-teal-light-ink transition hover:text-teal-ink">
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
