/* «قلمٌ يكتب» — الشريطُ الذي يمثّل المنصّةَ لا مشهدا منها.

   ═══ ما كان (البند ٥٥) ═══

   رسمٌ متجهيّ يُبنى ويُراجَع ويُختَم: ورقةٌ وسطورٌ ومخطَّطٌ وعلامةٌ وخاتم.
   كان حجّةً صحيحة — يقول ما تقوله الجملةُ فوقه — لكنّ صاحبَ المنصّة رآه
   «تقليديّا جدّا وليس إبداعيّا» وطلب «شيئا يمثّل المنصّة بشكل عام»
   (٨ سبتمبر ٢٠٢٦).

   ═══ القرار ═══

   ورقةٌ برأسيّة الأكاديمية، وقلمٌ يطير إليها فيكتب جملةَ المنصّة كلمةً
   كلمة — «تعلّم أسرع. طبّق أكثر. تقدّم أبعد.» — ثمّ يوقّع تحتها «وجيز» ويرسم
   خطَّ التوقيع. الخطُّ نسخيٌّ (Amiri) بقرار صاحب المنصّة، والورقةُ تميل
   ميلا خفيفا مع الفأرة (ثلاثيُّ الأبعاد بلا صخب). والأسلوبُ مؤسّسيّ:
   لا ألوانَ صارخة، لا قفزات — حركةٌ واحدةٌ تُروى مرّةً وتثبت.

   ═══ كيف يُكتب بالقلم في HTML ═══

   الكلماتُ نصٌّ في DOM (تُقرأ وتُترجَم وتُفهرَس — شرطُ البند ٥٥ باقٍ)،
   وكلُّ كلمةٍ داخل `clip-path: inset()` يفتح من اليمين إلى اليسار على مهل،
   وقلمٌ صغير (SVG) يسير عند حافّة الانفتاح بالتوقيت نفسِه. فالعينُ ترى
   الكلمةَ تُكتب حيث يمرّ القلم. والتوقيعُ بالآليّة نفسِها، ثمّ خطُّه يُرسم
   بـ`stroke-dashoffset`.

   ═══ الشروطُ غيرُ القابلة للتفاوض (كما كانت) ═══

   · **`prefers-reduced-motion`**: كلُّ حركةٍ `forwards` وتنتهي على الحالة
     التامّة — فمن طلب تقليلَ الحركة يرى الورقةَ مكتوبةً موقَّعة لا فارغة.
     (قاعدةُ `index.css` تختصر المدّةَ إلى ٠٫٠١ms.) والميلُ لا يُطبَّق له.
   · **لا نصَّ داخل SVG**: القلمُ وخطُّ التوقيع رسمان `aria-hidden`؛ الجملةُ
     والتوقيعُ نصّان.
   · **ولا أصلَ خارجيّا**: لا صورة، والخطُّ من مصدر الخطوط المسموح في CSP.

   وأسماءُ الحركات باقية (`proof-rise` · `proof-draw` · `proof-stamp`) —
   يحرسها `learner-surface.test.ts` — وقد تبدّل ما تفعله لا ما تُسمّى به. */

import { useCallback, useRef } from 'react'
import { Card } from '@/components/ui/Surface'

/** جملةُ المنصّة — ثلاثُ كلماتٍ تُكتب واحدةً واحدة، ثمّ التوقيع */
const PHRASES = ['تعلّم أسرع.', 'طبّق أكثر.', 'تقدّم أبعد.'] as const
const SIGNATURE = 'وجيز'
/** زمنُ كتابة الكلمة الواحدة والفاصلُ بينها — يُقرأ من CSS بالمتغيّر نفسِه */
const WORD_SECONDS = 1.5
const GAP_SECONDS = 0.45

const NASKH = '"Amiri", "Scheherazade New", "Noto Naskh Arabic", serif'

/** قلمُ حبرٍ صغير — جسمٌ وريشة، بلون الحبر */
function Pen() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className="h-8 w-8 md:h-9 md:w-9">
      <g transform="rotate(-38 20 20)">
        <rect x="16" y="2" width="8" height="22" rx="2.5" fill="rgb(var(--teal-deep, 31 110 119))" />
        <rect x="16" y="10" width="8" height="2.2" fill="rgb(var(--gold, 250 188 5))" opacity="0.9" />
        <path d="M16 24h8l-4 12z" fill="rgb(var(--teal-light, 110 199 209))" />
        <path d="M20 26v7" stroke="rgb(var(--teal-deep, 31 110 119))" strokeWidth="1" strokeLinecap="round" />
      </g>
    </svg>
  )
}

export default function ProofBand() {
  const cardRef = useRef<HTMLDivElement>(null)

  /* الميلُ مع الفأرة — على المؤشّرات الدقيقة وحدَها، ولمن لم يطلب تقليلَ الحركة */
  const tilt = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(pointer: fine)').matches) return
    const r = e.currentTarget.getBoundingClientRect()
    const dx = ((e.clientX - r.left) / r.width - 0.5) * 2
    const dy = ((e.clientY - r.top) / r.height - 0.5) * 2
    el.style.transform = `rotateX(${(-dy * 5).toFixed(2)}deg) rotateY(${(dx * 7).toFixed(2)}deg)`
  }, [])
  const untilt = useCallback(() => {
    if (cardRef.current) cardRef.current.style.transform = ''
  }, [])

  const signAt = PHRASES.length * (WORD_SECONDS + GAP_SECONDS) + 0.3

  return (
    <section className="relative overflow-hidden border-y border-white/[0.06] bg-surface">
      <style>{`
        .proof-card { transform-style: preserve-3d; transition: transform .25s ease-out; }
        .proof-ink { clip-path: inset(0 0 0 100%); }
        .proof-pen { position: absolute; top: 50%; right: 0; opacity: 0; transform: translate(45%, -78%); }
        .proof-swash [data-draw] { stroke-dasharray: var(--len); stroke-dashoffset: var(--len); }
        .proof-seal { opacity: 0; }

        .reveal.is-visible .proof-ink {
          animation: proof-rise ${WORD_SECONDS}s cubic-bezier(.45,.05,.55,.95) forwards;
          animation-delay: calc(var(--at) * 1s);
        }
        .reveal.is-visible .proof-pen {
          animation: proof-pen ${WORD_SECONDS}s cubic-bezier(.45,.05,.55,.95) forwards;
          animation-delay: calc(var(--at) * 1s);
        }
        .reveal.is-visible .proof-swash [data-draw] {
          animation: proof-draw .8s ease-out forwards;
          animation-delay: calc(var(--at) * 1s);
        }
        .reveal.is-visible .proof-seal {
          animation: proof-stamp .7s cubic-bezier(.2,.9,.3,1.15) forwards;
          animation-delay: calc(var(--at) * 1s);
        }

        @keyframes proof-rise { from { clip-path: inset(0 0 0 100%) } to { clip-path: inset(0 0 0 0) } }
        @keyframes proof-pen {
          0%   { opacity: 0; right: 0;    transform: translate(45%, -78%) translateY(-6px) }
          10%  { opacity: 1;              transform: translate(45%, -78%) }
          90%  { opacity: 1;              transform: translate(45%, -78%) }
          100% { opacity: 0; right: 100%; transform: translate(45%, -78%) translateY(-6px) }
        }
        @keyframes proof-draw { to { stroke-dashoffset: 0 } }
        @keyframes proof-stamp {
          from { opacity: 0; transform: translateY(4px) }
          to   { opacity: 1; transform: none }
        }
      `}</style>

      <div className="shell grid items-center gap-6 py-10 md:gap-10 md:py-14 md:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="reveal max-w-xl text-2xl font-bold leading-relaxed md:text-3xl">
            لا نقيس تعلمك بما شاهدت —
            <span className="text-teal-light-ink"> بل بما أنجزت وأثبتّ.</span>
          </p>
          <p className="reveal mt-3 max-w-md text-sm leading-7 text-foreground">
            مدرب يراجع عملك بيده، ومشروع تخرج يدخل ملفك المهني من أول يوم.
          </p>
        </div>

        {/* الورقةُ — تميل مع الفأرة، وتُكتب حين تُرى.
            الميلُ على غلافٍ بلا شكل، والورقةُ نفسُها `Card` من سلّم الأسطح
            (لا سطحَ مكتوبا بيده — حارسُ `design-system.test.ts`). */}
        <div
          className="mx-auto w-full max-w-md [perspective:1100px]"
          onMouseMove={tilt}
          onMouseLeave={untilt}
        >
          <div ref={cardRef} className="proof-card reveal">
          <Card
            tone="solid"
            className="relative overflow-hidden px-6 pb-6 pt-5 shadow-[0_30px_70px_-40px_rgba(56,167,180,0.45)] md:px-8"
            dir="rtl"
          >
            {/* سطورُ الورقة — باهتةٌ تحت الكتابة */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-6 top-[4.6rem] bottom-6 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_47px,rgba(56,167,180,0.14)_47px,rgba(56,167,180,0.14)_48px)] md:inset-x-8"
            />

            {/* رأسيّةُ الورقة */}
            <div className="relative flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-read font-bold tracking-wide text-muted-foreground">أكاديمية وجيز</span>
              <span className="h-1.5 w-1.5 rounded-full bg-teal" />
            </div>

            {/* الجملةُ — تُكتب كلمةً كلمة */}
            <p
              className="relative mt-5 text-[1.9rem] font-bold leading-[3rem] text-foreground md:text-[2.2rem]"
              style={{ fontFamily: NASKH }}
              lang="ar"
            >
              {PHRASES.map((ph, i) => (
                <span
                  key={ph}
                  className="relative inline-block whitespace-nowrap"
                  style={{ ['--at' as string]: (i * (WORD_SECONDS + GAP_SECONDS)).toFixed(2), marginInlineEnd: '0.45em' }}
                >
                  <span className="proof-ink inline-block">{ph}</span>
                  <span aria-hidden="true" className="proof-pen"><Pen /></span>
                </span>
              ))}
            </p>

            {/* التوقيع — في الزاوية اليسرى كما تُوقَّع الورقةُ العربيّة (`justify-end` في RTL) */}
            <div className="relative mt-4 flex justify-end pe-2">
              <span className="relative inline-block" style={{ ['--at' as string]: signAt.toFixed(2) }}>
                <span
                  className="proof-ink inline-block text-3xl font-bold text-teal-ink"
                  style={{ fontFamily: NASKH, transform: 'skewX(-7deg)', display: 'inline-block' }}
                  lang="ar"
                >
                  {SIGNATURE}
                </span>
                <span aria-hidden="true" className="proof-pen"><Pen /></span>
                <svg
                  viewBox="0 0 120 16"
                  aria-hidden="true"
                  focusable="false"
                  className="proof-swash absolute -bottom-2 right-0 h-4 w-[120%]"
                  style={{ ['--at' as string]: (signAt + WORD_SECONDS * 0.8).toFixed(2) }}
                >
                  <path
                    data-draw
                    d="M116 6C96 -2 74 14 56 8 40 3 26 4 4 12"
                    fill="none"
                    stroke="rgb(var(--teal))"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    style={{ ['--len' as string]: 130 }}
                  />
                </svg>
              </span>
            </div>

            {/* ختمُ الاعتماد الصغير — يستقرّ آخرَ الكلّ، بلا ضجيج */}
            <span
              className="proof-seal absolute bottom-6 right-6 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-fine font-black text-gold-ink md:right-8"
              style={{ ['--at' as string]: (signAt + WORD_SECONDS + 0.6).toFixed(2) }}
            >
              مخرَجٌ يُراجَع ويُعتمَد
            </span>
          </Card>
          </div>
        </div>
      </div>
    </section>
  )
}
