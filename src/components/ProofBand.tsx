/* «الدليلُ يُبنى» — مشهدٌ متجهيٌّ يقول ما تقوله الجملةُ فوقه (البند ٥٥).

   ─────────── ما كان ───────────

   شريطُ الصورة كان `band-learners.jpg` (٢٤١ ك.ب): **متعلّمون حول طاولة**.
   والجملةُ فوقَه: «لا نقيس تعلّمك بما شاهدت — بل بما أنجزتَ وأثبتّ».

   فأقوى عنصرٍ بصريٍّ في الصفحة كان **مشهدَ مشاهدة**: يعرض بالضبط ما تنفيه
   الجملةُ التي يحملها. ولا يُصلَح ذلك بلقطةٍ أخرى — الصورةُ الثابتةُ لا تقول
   «يُبنى» ولا «يُراجَع» ولا «يُختَم»، مهما حسُنت.

   ─────────── فالحركةُ حجّةٌ لا زينة ───────────

   ثلاثُ ضرباتٍ في اثنتي عشرةَ ثانية، وهي نصُّ الجملة حرفا بحرف:

   ١) **يُبنى**   — خطوطٌ ترسم مخرَجا: إطارٌ، ثمّ سطورُ عمل، ثمّ مخطَّط.
   ٢) **يُراجَع** — علامةُ مدرّبٍ تُرسم بجانبه، لا تظهر دفعةً واحدة.
   ٣) **يُختَم**  — خاتمٌ يستقرّ، وشريطُ اعتمادٍ ينفرد.

   ─────────── والشروطُ الثلاثةُ غيرُ القابلة للتفاوض ───────────

   · **`prefers-reduced-motion`**: `animation-fill-mode: forwards` تجعل آخرَ
     إطارٍ هو **المخرَجَ مكتملا مختوما** — فمن طلب تقليلَ الحركة يرى المشهدَ
     تامّا لا فارغا. (وقاعدةُ `index.css:251` تختصر المدّةَ إلى ٠٫٠١ms
     وتوقف التكرار، فتقع اللقطةُ على الإطار الأخير بالضبط.)
   · **لا نصَّ داخل الرسم**: الجملةُ تبقى في DOM — تُقرأ بقارئ الشاشة،
     وتُترجَم، وتُفهرَس. والرسمُ `aria-hidden` لأنّه تكرارٌ بصريٌّ لها.
   · **ولا أصلَ خارجيّا**: SVG في الحزمة، فلا `img-src` يُخترق ولا ٢٤١ ك.ب
     تُحمَّل. */

/* الحلقةُ نحوَ ثمانِ ثوانٍ: تُرسم الورقةُ ثمّ سطورُها ثمّ مخطَّطُها (٠–٤)،
   ثمّ علامةُ المراجعة (٤٫٦)، ثمّ الخاتمُ وشريطُه (٦–٧٫٦). والتوقيتُ مكتوبٌ
   عند كلّ عنصرٍ في `--at` فيُقرأ الإيقاعُ من الرسم نفسِه. */

export default function ProofBand() {
  return (
    <section className="relative overflow-hidden border-y border-white/[0.06] bg-surface">
      <style>{`
        @keyframes proof-draw { to { stroke-dashoffset: 0 } }
        @keyframes proof-rise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes proof-stamp {
          0%   { opacity: 0; transform: scale(1.35) rotate(-14deg) }
          70%  { opacity: 1; transform: scale(0.97) rotate(-6deg) }
          100% { opacity: 1; transform: scale(1) rotate(-7deg) }
        }
        .proof-band [data-draw] {
          stroke-dasharray: var(--len);
          stroke-dashoffset: var(--len);
          animation: proof-draw var(--dur, 1.6s) ease-in-out var(--at, 0s) forwards;
        }
        .proof-band [data-rise] { opacity: 0; animation: proof-rise .7s ease-out var(--at, 0s) forwards }
        .proof-band [data-stamp] { opacity: 0; transform-origin: center; animation: proof-stamp .9s cubic-bezier(.2,.9,.3,1.2) var(--at, 0s) forwards }
      `}</style>

      {/* على الهاتف يقف الرسمُ تحت الجملة، فطولُه يُضاف إلى طولها. والقياسُ
          على ٣٩٠×٨٤٤ قال إنّ القسمَ بلغ ٥٣٣ بكسلا — أطولَ من الصورة التي حلّ
          محلَّها (٣٤٠). فيُقيَّد عرضُ الرسم على الهاتف ويُخفَّف الحشو: المشهدُ
          حجّةٌ تُرى في لمحة، لا لوحةٌ تُتأمَّل. */}
      <div className="mx-auto grid max-w-7xl items-center gap-5 px-5 py-10 md:gap-8 md:py-16 md:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="reveal max-w-xl text-2xl font-bold leading-relaxed md:text-3xl">
            لا نقيس تعلمك بما شاهدت —
            <span className="text-teal-light-ink"> بل بما أنجزت وأثبتّ.</span>
          </p>
          <p className="reveal mt-3 max-w-md text-sm leading-7 text-foreground">
            مدرب يراجع عملك بيده، ومشروع تخرج يدخل ملفك المهني من أول يوم.
          </p>
        </div>

        {/* الرسمُ تكرارٌ بصريٌّ للجملة — فلا يُقرأ مرّتين */}
        <div className="proof-band relative mx-auto w-full max-w-[230px] md:max-w-md">
          <svg viewBox="0 0 320 220" className="w-full" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="proof-edge" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgb(var(--teal-light))" />
                <stop offset="100%" stopColor="rgb(var(--teal))" />
              </linearGradient>
            </defs>

            {/* ١ · يُبنى — الورقةُ ثمّ سطورُ العمل ثمّ المخطَّط */}
            <rect
              data-draw x="34" y="18" width="184" height="176" rx="12"
              fill="none" stroke="url(#proof-edge)" strokeWidth="2"
              style={{ ['--len' as string]: 740, ['--dur' as string]: '2.2s', ['--at' as string]: '0s' }}
            />
            {[62, 82, 102].map((y, i) => (
              <line
                key={y} data-draw x1="58" y1={y} x2={y === 102 ? 150 : 194} y2={y}
                stroke="rgb(var(--teal-light))" strokeWidth="3" strokeLinecap="round" opacity="0.55"
                style={{ ['--len' as string]: 140, ['--dur' as string]: '.6s', ['--at' as string]: `${2 + i * 0.35}s` }}
              />
            ))}
            {/* مخطَّطٌ صغير: العملُ نفسُه لا زخرفةٌ حوله */}
            {[
              { x: 62, h: 26 }, { x: 84, h: 42 }, { x: 106, h: 34 }, { x: 128, h: 56 },
            ].map((b, i) => (
              <rect
                key={b.x} data-rise x={b.x} y={168 - b.h} width="13" height={b.h} rx="3"
                fill="rgb(var(--teal))" opacity="0.75"
                style={{ ['--at' as string]: `${3.4 + i * 0.14}s` }}
              />
            ))}

            {/* ٢ · يُراجَع — علامةُ المدرّب تُرسم، لا تظهر دفعةً واحدة */}
            <path
              data-draw d="M150 128 l16 17 l32 -38"
              fill="none" stroke="rgb(var(--gold))" strokeWidth="5"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ ['--len' as string]: 90, ['--dur' as string]: '.85s', ['--at' as string]: '4.6s' }}
            />

            {/* ٣ · يُختَم — الخاتمُ يستقرّ، والشريطُ ينفرد */}
            <g data-stamp style={{ ['--at' as string]: '6s' }}>
              <circle cx="236" cy="150" r="34" fill="none" stroke="rgb(var(--gold))" strokeWidth="2.5" opacity="0.9" />
              <circle cx="236" cy="150" r="26" fill="rgb(var(--gold))" opacity="0.12" />
              <path
                d="M223 150 l9 10 l19 -22" fill="none" stroke="rgb(var(--gold))"
                strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
              />
            </g>
            <g data-rise style={{ ['--at' as string]: '6.9s' }}>
              <path d="M226 182 l-9 26 l19 -10 l19 10 l-9 -26 z" fill="rgb(var(--gold))" opacity="0.85" />
            </g>
          </svg>
        </div>
      </div>
    </section>
  )
}
