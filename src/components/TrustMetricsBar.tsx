import { Building2, Users, BookOpen, Route } from 'lucide-react'
import { homeTrustMetrics } from '@/data/trustMetrics'

/* أيقونة معبّرة لكل مقياس — الربط بالمفتاح هنا لا في ملف البيانات (يبقى قابلا للتسلسل) */
const METRIC_ICON: Record<string, typeof Building2> = {
  organizations: Building2,
  employees: Users,
  book_summaries: BookOpen,
  career_tracks: Route,
}

/* شريط الثقة الرقمي — أرقام «وجيز مهارات» الموثقة فقط.
   - يقرأ من المصدر المركزي trustMetrics حصراً (wajeez_skills + approved + selected).
   - لا Counter animation: الأرقام KPI موثقة وتُعرض ثابتة كما في المصدر.
   - لا نسبة للأكاديمية: الإطار النصي «وجيز مهارات بالأرقام» + subcopy يوضح أنها
     أرقام تجربة وجيز مهارات ضمن منظومة وجيز — صغير لكنه غير مضلل.
   - الرقم هو العنصر البصري الأساسي؛ الوصف تحته مختصر جداً. */
/* ═══ قسمٌ قائمٌ تحت المسارات (١٣ نوفمبر ٢٠٢٦) ═══

   كان يُعرض داخلَ «شركاؤنا» (`nested`، قرارُ صاحب المنصّة ٧ سبتمبر ٢٠٢٦) — `div` لا `section`، ومضيفُه يعطيه العرضَ
   والحشو. ثمّ قال: «ضعها أسفل المسارات»، فصار قسما قائما بنفسه يلي شريطَ الدورات والمسارات (`Bestsellers`) في
   الرئيسة. والصندوقُ المستديرُ كما كان — الذي رآه وطلب نقلَه — داخلَ `shell` كباقي الأقسام. والحشوُ: فوقَه حشوُ
   `Bestsellers` السفليّ وحدَه، وتحتَه `pb-2` مع حشو «قصص النجاح» العلويّ — فتتساوى الفجوتان (٤٠ ثمّ ٤٨). */
export default function TrustMetricsBar() {
  const metrics = homeTrustMetrics()
  if (metrics.length === 0) return null

  return (
    <section
      aria-label="وجيز مهارات بالأرقام"
      /* ═══ أرضيّةٌ تفصله، لا خيطٌ شعريّ (١٣ سبتمبر ٢٠٢٦) ═══

         كان الفصلُ خيطا بعرض بكسلٍ واحد. وفي النهاريّ صارت ثلاثُ كتلٍ متتاليةٍ
         على أرضيّةٍ واحدة (`--background: #F6F4EF`) لا يفصلها إلّا شعرة، فقال
         صاحبُ المنصّة إنّ الألوانَ تتداخل ولا يُعرف أين يبدأ القسم.

         و`bg-surface` هو الجوابُ بالرمز لا باللون: **أبيضُ صريحٌ في النهاريّ**
         (`255 255 255`) وسطحُ بطاقةٍ داكنٌ في الليليّ (`#121B1D`). فلو كُتب
         `bg-white` لأضاء الليليَّ بياضا يحرق العين. */
      /* والفجوتان حولَه سواء — «المساحةُ أعلى وجيز مهارات لا تتساوى» (صاحب المنصّة، ١٥ سبتمبر ٢٠٢٦). وكانت تُضبط بهامشٍ
         فوقَه داخلَ «شركاؤنا»، وصارت حشوَ القسمين حولَه (انظر رأسَ الدالّة). */
      className="pb-2"
    >
      <div className="shell">
        <div className="rounded-3xl bg-surface px-5 py-10 md:px-10 md:py-12">
          <div className="reveal text-center">
            <h2 className="text-sm font-bold text-teal-light-ink md:text-base">وجيز مهارات بالأرقام</h2>
            <p className="mx-auto mt-2 max-w-xl text-read leading-relaxed text-muted-foreground">
              أرقام موثقة من تجربة وجيز مهارات مع المؤسسات والمتعلمين — إحدى حلول منظومة وجيز.
            </p>
          </div>

          {/* ═══ الرقمُ يصغر ليُقرأ — والأيقونةُ تنزل إلى سطره ═══

              كان كلُّ مقياسٍ ثلاثَ طبقات: مربّعٌ ٤٨×٤٨ للأيقونة، ثمّ رقمٌ
              بـ٣٦ بكسلا يصير ٤٤ على الواسع، ثمّ لصيقةٌ تحته — واثنان في الصفّ
              على الهاتف بفجوةٍ رأسيّةٍ ٣٢ بكسلا. فالأربعةُ تملأ شاشةً كاملةً
              تقريبا، ووصفها صاحبُ المنصّة بـ«الدفشة» (١٥ سبتمبر ٢٠٢٦).

              والعلاجُ ليس رقما أصغرَ وحدَه بل **طبقةً أقلّ**: المربّعُ يسقط،
              والأيقونةُ تصير حرفا صغيرا في سطر اللصيقة — فتبقى تدلّ ولا تأخذ
              سطرا لنفسها. والرقمُ ٢٤ ثمّ ٣٠: أكبرُ ما في الكتلة ولا يزاحمها.

              وخيطٌ رفيعٌ بين الأعمدة على الواسع (`border-s` منطقيٌّ فينقلب مع
              الاتّجاه): أربعةُ أرقامٍ متجاورةٍ بلا فاصلٍ تُقرأ رقما واحدا
              طويلا — وهي العلّةُ نفسُها التي عولجت في `WorkHeader`. */}
          <dl className="reveal mt-7 grid grid-cols-2 gap-y-7 md:grid-cols-4 md:gap-y-0">
            {metrics.map((m) => {
              const Icon = METRIC_ICON[m.key] ?? Building2
              return (
                /* `div` يجمع المصطلحَ ووصفَه — وهو المسموحُ في `dl`. واللصيقةُ
                   قبل القيمة في البنية (‏`dt` ثمّ `dd`) وبعدها في العرض
                   (`order`)، فيقرأ قارئُ الشاشة «مؤسسة رائدة: ١٠٠+» ويرى
                   الناظرُ الرقمَ أوّلا. */
                <div key={m.key} className="flex flex-col items-center px-3 text-center md:border-s md:border-white/10 md:first:border-s-0">
                  {/* `items-start` لا `items-center`: اللصيقةُ تلتفّ سطرين في
                      مقياسَين، فالأيقونةُ الوسطى تقف بين السطرين معلَّقةً في
                      الفراغ. ومحاذاتُها لأوّل سطرٍ هي النمطُ القائمُ في
                      المستودَع («تتخرّج بـ» في بطاقة المسار). */}
                  <dt className="order-2 mt-1.5 flex items-start justify-center gap-1.5 text-fine leading-snug text-muted-foreground">
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
                    <span>{m.label_ar}</span>
                  </dt>
                  <dd className="order-1 text-2xl font-black tabular-nums tracking-tight text-teal-light-ink md:text-3xl">
                    {m.display_value}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
      </div>
    </section>
  )
}
