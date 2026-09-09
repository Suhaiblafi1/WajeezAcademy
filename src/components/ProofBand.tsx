/* «يدٌ تكتب» — الشريطُ الذي يمثّل المنصّةَ لا مشهدا منها.

   ═══ ما كان (البند ٥٥) ═══

   رسمٌ متجهيّ يُبنى ويُراجَع ويُختَم، ثمّ ورقةٌ مسطّرةٌ يكتب فيها قلمٌ بخطٍّ
   نسخيّ (٨ سبتمبر ٢٠٢٦)، ثمّ رقعةٌ حبريّةٌ ملوَّنةٌ بلا ورقة (٩ سبتمبر).
   فرأى صاحبُ المنصّة المخرَجَ في الإنتاج: الحبرُ **أحمر** — متصفّحُه رسم
   الخطَّ الملوَّن بلوحته الأصليّة وتجاهل تبديلَها بـ`font-palette` — والقلمُ
   يشغل، والكتابةُ بطيئة، والشارةُ الذهبيّةُ زائدة.

   ═══ القرار (٩ سبتمبر ٢٠٢٦، الجولة الثانية) ═══

   · **الخطُّ رقعةٌ عاديّة** (Aref Ruqaa) لا نسختُها الحبريّة: الحروفُ نفسُها،
     واللونُ من CSS فيصدق في كلّ متصفّح. ذهب تدرّجُ الحبر مع ذهاب الاعتماد
     على لوحة الخطّ — والصدقُ في اللون أولى من زخرفةٍ لا تُضمن.
   · **الحبرُ أبيض** (لونُ النصّ) **وآخرُ كلمتين بفيروزيّ الشعار**.
   · **لا قلم**: الكلماتُ تظهر وحدَها من اليمين إلى اليسار.
   · **أسرعُ بكثير**: نصفُ ثانيةٍ للكلمة بدل ثانيةٍ ونصف.
   · **توقيعٌ مرسوم** بدل شارة «مخرَجٌ يُراجَع ويُعتمَد» وبدل كلمة «وجيز»:
     خطُّ يدٍ عشوائيُّ الشكل كما يوقّع الناسُ فعلا — حلقةٌ وموجٌ وسحبةٌ تحته
     ونقطة — يُرسم بعد الجملة بـ`stroke-dashoffset`.
   · والميلُ باقٍ: الجملةُ ترتفع نحو اليسار ولكلّ كلمةٍ انحرافٌ صغيرٌ ثابت.

   ═══ الشروطُ غيرُ القابلة للتفاوض (كما كانت) ═══

   · **`prefers-reduced-motion`**: كلُّ حركةٍ `forwards` وتنتهي على الحالة
     التامّة — فمن طلب تقليلَ الحركة يرى الجملةَ مكتوبةً موقَّعة لا فارغة.
   · **لا نصَّ داخل SVG**: التوقيعُ رسمٌ `aria-hidden`؛ الجملةُ نصٌّ في DOM.
   · **ولا أصلَ خارجيّا**: لا صورة، والخطُّ من مصدر الخطوط المسموح في CSP.

   وأسماءُ الحركات باقية (`proof-rise` · `proof-draw` · `proof-stamp`) —
   يحرسها `learner-surface.test.ts`. */

/** جملةُ المنصّة — ثلاثةُ مقاطعَ تُكتب واحدا واحدا؛ الأخيرُ بلون الشعار */
const PHRASES = ['تعلّم أسرع.', 'طبّق أكثر.', 'تقدّم أبعد.'] as const
const ACCENT_FROM = 2
/** زمنُ كتابة المقطع الواحد والفاصلُ بينها — يُقرأ من CSS بالمتغيّر نفسِه */
const WORD_SECONDS = 0.5
const GAP_SECONDS = 0.1
/** انحرافُ كلّ مقطعٍ عن الخطّ (درجة، بكسل) — ثابتٌ عمدا: يدٌ واحدةٌ لا نردٌ يُرمى */
const HAND: ReadonlyArray<readonly [number, number]> = [[0, 0], [1.1, 2], [-1.3, -3]]

/** التوقيعُ — حلقةٌ عن اليمين، موجٌ إلى اليسار، سحبةٌ تحته، ونقطة. لا حروف. */
function Signature({ at }: { at: number }) {
  return (
    <svg
      viewBox="0 0 220 72"
      aria-hidden="true"
      focusable="false"
      className="proof-swash h-16 w-52 md:h-[4.5rem] md:w-60"
      style={{ ['--at' as string]: at.toFixed(2) }}
    >
      <path
        data-draw
        pathLength={1}
        d="M206 46c-4-24-24-34-28-10-3 20 20 22 30 4-9 3-20 2-28 9-7 6-10-10-20-4-8 5-2 24-16 18-9-4-9-16-18-14-3 1-6 22-7 22-1 0-4-20-6-24-6-8-16 0-22 8-6 8-12 4-20 6-8 2-10 8-18 12M198 63c-32 4-96 11-164 4-9-1-6-9 5-9"
        fill="none"
        stroke="rgb(var(--teal-light-ink))"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        className="proof-seal"
        cx="16"
        cy="44"
        r="2.6"
        fill="rgb(var(--teal-light-ink))"
        style={{ ['--at' as string]: (at + 0.75).toFixed(2) }}
      />
    </svg>
  )
}

export default function ProofBand() {
  const signAt = PHRASES.length * (WORD_SECONDS + GAP_SECONDS) + 0.15

  return (
    <section className="relative overflow-hidden border-y border-white/[0.06] bg-surface">
      <style>{`
        .proof-hand { font-family: "Aref Ruqaa", serif; }
        /* الميلُ: الجملةُ ترتفع نحو اليسار، ولكلّ مقطعٍ انحرافُه الثابت */
        .proof-slant { transform: rotate(-3.5deg); transform-origin: right center; }
        .proof-word { display: inline-block; transform: rotate(var(--tilt, 0deg)) translateY(var(--lift, 0px)); }

        .proof-ink { clip-path: inset(0 0 0 100%); }
        .proof-swash [data-draw] { stroke-dasharray: 1; stroke-dashoffset: 1; }
        .proof-seal { opacity: 0; }

        .reveal.is-visible .proof-ink {
          animation: proof-rise ${WORD_SECONDS}s cubic-bezier(.45,.05,.55,.95) forwards;
          animation-delay: calc(var(--at) * 1s);
        }
        .reveal.is-visible .proof-swash [data-draw] {
          animation: proof-draw .7s cubic-bezier(.4,.1,.5,1) forwards;
          animation-delay: calc(var(--at) * 1s);
        }
        .reveal.is-visible .proof-seal {
          animation: proof-stamp .25s cubic-bezier(.2,.9,.3,1.15) forwards;
          animation-delay: calc(var(--at) * 1s);
        }

        @keyframes proof-rise { from { clip-path: inset(0 0 0 100%) } to { clip-path: inset(0 0 0 0) } }
        @keyframes proof-draw { to { stroke-dashoffset: 0 } }
        @keyframes proof-stamp {
          from { opacity: 0; transform: scale(.4) }
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

        {/* الكتابةُ على الشريط نفسِه — لا ورقةَ ولا إطار. تُكتب حين تُرى. */}
        <div className="reveal mx-auto w-full max-w-md py-4" dir="rtl">
          <div className="proof-hand proof-slant" lang="ar">
            {/* الجملةُ — تُكتب مقطعا مقطعا، وآخرُها بلون الشعار */}
            <p className="text-[2rem] font-bold leading-[1.45] text-foreground md:text-[2.5rem]">
              {PHRASES.map((ph, i) => (
                <span
                  key={ph}
                  className={`proof-word relative whitespace-nowrap${i >= ACCENT_FROM ? ' text-teal-light-ink' : ''}`}
                  style={{
                    ['--at' as string]: (i * (WORD_SECONDS + GAP_SECONDS)).toFixed(2),
                    ['--tilt' as string]: `${HAND[i][0]}deg`,
                    ['--lift' as string]: `${HAND[i][1]}px`,
                    marginInlineEnd: '0.4em',
                  }}
                >
                  <span className="proof-ink inline-block">{ph}</span>
                </span>
              ))}
            </p>

            {/* التوقيع — في الزاوية اليسرى كما تُوقَّع الورقةُ العربيّة (`justify-end` في RTL) */}
            <div className="mt-2 flex justify-end pe-6">
              <Signature at={signAt} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
