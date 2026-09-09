/* «قلمٌ يكتب» — الشريطُ الذي يمثّل المنصّةَ لا مشهدا منها.

   ═══ ما كان (البند ٥٥) ═══

   رسمٌ متجهيّ يُبنى ويُراجَع ويُختَم: ورقةٌ وسطورٌ ومخطَّطٌ وعلامةٌ وخاتم.
   ثمّ (٨ سبتمبر ٢٠٢٦) ورقةٌ برأسيّةٍ وسطورٍ يطير إليها قلمٌ فيكتب جملةَ
   المنصّة بخطٍّ نسخيّ ويوقّع. فرآها صاحبُ المنصّة «طفوليّة: أسطرٌ كأنّها
   مدرسة» وطلب خطّا كالتوقيع، مائلا، «كأنّ شخصا كتبها بطريقةٍ عشوائيّةٍ
   جميلة»، بقلمٍ أجمل، وبلا إطار: الكتابةُ على الشريط نفسِه بخلفيّته.

   ═══ القرار (٩ سبتمبر ٢٠٢٦) ═══

   · **لا ورقةَ ولا إطارَ ولا أسطر**: الحبرُ على خلفيّة الشريط مباشرة.
   · **الخطُّ رقعة** — خطُّ اليد اليوميُّ في العالم العربيّ، لا نسخُ الكتب —
     بنسخته الحبريّة (Aref Ruqaa Ink): خطٌّ ملوَّنٌ (COLRv1) يحمل تدرّجَ الحبر
     في حروفه، ولوحتُه الأصليّةُ حمراءُ فتُبدَّل بـ`font-palette` إلى حبرٍ
     عاجيٍّ ونقاطٍ فيروزيّةٍ على الداكن، وحبرٍ داكنٍ على الفاتح. ومن لا
     يرسم الخطوطَ الملوَّنةَ (Safari) يرى الحروفَ نفسَها بلون النصّ — مقروءةً
     لا مكسورة.
   · **الميلُ**: الجملةُ ترتفع نحو اليسار (٣٫٥°)، ولكلّ كلمةٍ انحرافٌ صغيرٌ
     ثابتٌ (لا عشوائيٌّ عند كلّ زيارة) فتبدو مكتوبةً لا منضَّدة.
   · **القلم**: قلمُ حبرٍ سائلٍ نحيلٌ بريشةٍ فولاذيّة، يسير عند حافّة الحبر.
   · **التوقيع** «وجيز» أكبرَ وبلون المنصّة، يُكتب آخرا ثمّ يُرسم خطُّه.
   · وشارةُ «مخرَجٌ يُراجَع ويُعتمَد» باقيةٌ تحت التوقيع.
   · وميلُ الورقة مع الفأرة ذهب مع الورقة — لا سطحَ يميل.

   ═══ كيف يُكتب بالقلم في HTML ═══

   الكلماتُ نصٌّ في DOM (تُقرأ وتُترجَم وتُفهرَس — شرطُ البند ٥٥ باقٍ)،
   وكلُّ كلمةٍ داخل `clip-path: inset()` يفتح من اليمين إلى اليسار على مهل،
   والقلمُ (SVG) يسير عند حافّة الانفتاح بالتوقيت نفسِه. والتوقيعُ بالآليّة
   نفسِها، ثمّ خطُّه يُرسم بـ`stroke-dashoffset`.

   ═══ الشروطُ غيرُ القابلة للتفاوض (كما كانت) ═══

   · **`prefers-reduced-motion`**: كلُّ حركةٍ `forwards` وتنتهي على الحالة
     التامّة — فمن طلب تقليلَ الحركة يرى الجملةَ مكتوبةً موقَّعة لا فارغة.
   · **لا نصَّ داخل SVG**: القلمُ وخطُّ التوقيع رسمان `aria-hidden`.
   · **ولا أصلَ خارجيّا**: لا صورة، والخطُّ من مصدر الخطوط المسموح في CSP.

   وأسماءُ الحركات باقية (`proof-rise` · `proof-draw` · `proof-stamp`) —
   يحرسها `learner-surface.test.ts`. */

import { useId } from 'react'

/** جملةُ المنصّة — ثلاثُ كلماتٍ تُكتب واحدةً واحدة، ثمّ التوقيع */
const PHRASES = ['تعلّم أسرع.', 'طبّق أكثر.', 'تقدّم أبعد.'] as const
const SIGNATURE = 'وجيز'
/** زمنُ كتابة الكلمة الواحدة والفاصلُ بينها — يُقرأ من CSS بالمتغيّر نفسِه */
const WORD_SECONDS = 1.5
const GAP_SECONDS = 0.45
/** انحرافُ كلّ كلمةٍ عن الخطّ (درجة، بكسل) — ثابتٌ عمدا: يدٌ واحدةٌ لا نردٌ يُرمى */
const HAND: ReadonlyArray<readonly [number, number]> = [[0, 0], [1.1, 2], [-1.3, -3]]

/** قلمُ حبرٍ سائل — جسمٌ نحيلٌ داكن، وحلقةٌ ذهبيّة، وريشةٌ فولاذيّة */
function Pen() {
  const id = useId()
  const steel = `${id}-steel`
  const barrel = `${id}-barrel`
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className="h-10 w-10 md:h-11 md:w-11">
      <defs>
        <linearGradient id={steel} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6f8f8" />
          <stop offset=".5" stopColor="#b9c4c6" />
          <stop offset="1" stopColor="#6f7d80" />
        </linearGradient>
        <linearGradient id={barrel} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3a4649" />
          <stop offset=".45" stopColor="#0f1a1c" />
          <stop offset="1" stopColor="#2a3538" />
        </linearGradient>
      </defs>
      <g transform="rotate(-42 24 24)">
        <rect x="20" y="1" width="8" height="24" rx="3" fill={`url(#${barrel})`} />
        <rect x="20" y="22" width="8" height="1.6" fill="rgb(var(--gold, 250 188 5))" opacity=".9" />
        <path d="M20.6 24h6.8l-.9 6h-5z" fill="#1d2a2d" />
        <path d="M21 30h6l-3 14z" fill={`url(#${steel})`} />
        <path d="M24 33.5v8.5" stroke="#4a5659" strokeWidth=".8" strokeLinecap="round" />
        <circle cx="24" cy="33" r=".9" fill="#4a5659" />
      </g>
    </svg>
  )
}

export default function ProofBand() {
  const signAt = PHRASES.length * (WORD_SECONDS + GAP_SECONDS) + 0.3

  return (
    <section className="relative overflow-hidden border-y border-white/[0.06] bg-surface">
      <style>{`
        /* لوحةُ الحبر — الخطُّ الملوَّنُ يحمل خمسةَ ألوان: حبرٌ (٠ باهت، ١ كامل)
           ونقاطٌ (٢ و٤ كاملة، ٣ باهتة). تُبدَّل هنا بألوان المنصّة على الوجهين. */
        @font-palette-values --proof-ink {
          font-family: "Aref Ruqaa Ink"; base-palette: 0;
          override-colors: 0 rgb(250 250 250 / .45), 1 #fafafa, 2 #6ec7d1, 3 rgb(110 199 209 / .5), 4 #6ec7d1;
        }
        @font-palette-values --proof-ink-light {
          font-family: "Aref Ruqaa Ink"; base-palette: 0;
          override-colors: 0 rgb(22 34 32 / .45), 1 #162220, 2 #1a5c64, 3 rgb(26 92 100 / .5), 4 #1a5c64;
        }
        @font-palette-values --proof-sig {
          font-family: "Aref Ruqaa Ink"; base-palette: 0;
          override-colors: 0 rgb(110 199 209 / .7), 1 #6ec7d1, 2 #6ec7d1, 3 rgb(110 199 209 / .7), 4 #6ec7d1;
        }
        @font-palette-values --proof-sig-light {
          font-family: "Aref Ruqaa Ink"; base-palette: 0;
          override-colors: 0 rgb(26 92 100 / .7), 1 #1a5c64, 2 #1a5c64, 3 rgb(26 92 100 / .7), 4 #1a5c64;
        }
        .proof-hand { font-family: "Aref Ruqaa Ink", "Aref Ruqaa", serif; font-palette: --proof-ink; }
        .proof-sig { font-palette: --proof-sig; }
        html[data-theme="light"] .proof-hand { font-palette: --proof-ink-light; }
        html[data-theme="light"] .proof-sig { font-palette: --proof-sig-light; }

        /* الميلُ: الجملةُ ترتفع نحو اليسار، ولكلّ كلمةٍ انحرافُها الثابت */
        .proof-slant { transform: rotate(-3.5deg); transform-origin: right center; }
        .proof-word { display: inline-block; transform: rotate(var(--tilt, 0deg)) translateY(var(--lift, 0px)); }

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

        {/* الكتابةُ على الشريط نفسِه — لا ورقةَ ولا إطار. تُكتب حين تُرى.
            والشارةُ خارجَ `proof-hand` كي لا ترث خطَّ اليد. */}
        <div className="reveal mx-auto w-full max-w-md py-4" dir="rtl">
          <div className="proof-hand proof-slant" lang="ar">
            {/* الجملةُ — تُكتب كلمةً كلمة */}
            <p className="text-[2rem] font-normal leading-[1.45] text-foreground md:text-[2.5rem]">
              {PHRASES.map((ph, i) => (
                <span
                  key={ph}
                  className="proof-word relative whitespace-nowrap"
                  style={{
                    ['--at' as string]: (i * (WORD_SECONDS + GAP_SECONDS)).toFixed(2),
                    ['--tilt' as string]: `${HAND[i][0]}deg`,
                    ['--lift' as string]: `${HAND[i][1]}px`,
                    marginInlineEnd: '0.4em',
                  }}
                >
                  <span className="proof-ink inline-block">{ph}</span>
                  <span aria-hidden="true" className="proof-pen"><Pen /></span>
                </span>
              ))}
            </p>

            {/* التوقيع — في الزاوية اليسرى كما تُوقَّع الورقةُ العربيّة (`justify-end` في RTL) */}
            <div className="relative mt-3 flex justify-end pe-4">
              <span className="relative inline-block" style={{ ['--at' as string]: signAt.toFixed(2) }}>
                <span
                  className="proof-ink proof-sig inline-block text-[2.6rem] font-normal text-teal-light-ink md:text-[3.2rem]"
                  style={{ transform: 'rotate(-8deg)', display: 'inline-block' }}
                >
                  {SIGNATURE}
                </span>
                <span aria-hidden="true" className="proof-pen"><Pen /></span>
                <svg
                  viewBox="0 0 120 16"
                  aria-hidden="true"
                  focusable="false"
                  className="proof-swash absolute -bottom-1 right-0 h-4 w-[130%]"
                  style={{ ['--at' as string]: (signAt + WORD_SECONDS * 0.8).toFixed(2) }}
                >
                  <path
                    data-draw
                    d="M116 10C96 -2 74 14 56 8 40 3 26 6 4 14"
                    fill="none"
                    stroke="rgb(var(--teal-light-ink))"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    style={{ ['--len' as string]: 130 }}
                  />
                </svg>
              </span>
            </div>
          </div>

          {/* ختمُ الاعتماد الصغير — يستقرّ آخرَ الكلّ، بلا ضجيج، وبخطّ الموقع لا خطّ اليد */}
          <div className="mt-9 flex justify-end pe-2 md:mt-10">
            <span
              className="proof-seal inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-fine font-black text-gold-ink"
              style={{ ['--at' as string]: (signAt + WORD_SECONDS + 0.6).toFixed(2) }}
            >
              مخرَجٌ يُراجَع ويُعتمَد
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
