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
/* `nested`: يُعرض داخلَ قسمٍ قائمٍ (تحت «شركاؤنا» وفوق «مؤسسات وثقت») بقرار
   صاحب المنصّة (٧ سبتمبر ٢٠٢٦). فيصير `div` لا `section` — قسمٌ داخل قسمٍ
   يضاعف معالمَ الصفحة على قارئ الشاشة — ويترك العرضَ والحشوَ لمضيفه.
   والنمطُ نفسُه في `EcosystemOrgStrip` المجاور له، ولا يُخترع ثانٍ. */
export default function TrustMetricsBar({ nested = false }: { nested?: boolean } = {}) {
  const metrics = homeTrustMetrics()
  if (metrics.length === 0) return null

  const Wrapper = nested ? 'div' : 'section'
  return (
    <Wrapper
      aria-label="وجيز مهارات بالأرقام"
      /* ═══ أرضيّةٌ تفصله، لا خيطٌ شعريّ (١٣ سبتمبر ٢٠٢٦) ═══

         كان الفصلُ خيطا بعرض بكسلٍ واحد. وفي النهاريّ صارت ثلاثُ كتلٍ متتاليةٍ
         على أرضيّةٍ واحدة (`--background: #F6F4EF`) لا يفصلها إلّا شعرة، فقال
         صاحبُ المنصّة إنّ الألوانَ تتداخل ولا يُعرف أين يبدأ القسم.

         و`bg-surface` هو الجوابُ بالرمز لا باللون: **أبيضُ صريحٌ في النهاريّ**
         (`255 255 255`) وسطحُ بطاقةٍ داكنٌ في الليليّ (`#121B1D`). فلو كُتب
         `bg-white` لأضاء الليليَّ بياضا يحرق العين. */
      /* ═══ والفجوتان حولَه سواء (١٥ سبتمبر ٢٠٢٦) ═══

         «المساحةُ أعلى وجيز مهارات لا تتساوي بالمسافة بينها وبين قسم مؤسسات
         وثقت بوجيز» (صاحب المنصّة). والحسابُ يصدّقه: فوقَه `mt-12/md:mt-16`
         وحدَه — ٤٨ بكسلا ثمّ ٦٤. وتحتَه فجوةٌ مركّبة، لأنّ `EcosystemOrgStrip`
         يفصل بخيطٍ فيجمع `mt-12` قبلَ الخيط و`pt-12` بعدَه — ٩٦ ثمّ ١٢٨.
         فالسفلى ضعفُ العليا بالضبط، وهذا ما تراه العين.

         والمعتمَدُ السفلى كما طُلب: `mt-24/md:mt-32` يساويان مجموعَها، فيقف
         الصندوقُ في وسطِ فراغَين متساويَين. ولا يُمسّ ما تحته — مجموعُه هو
         المقياسُ الذي عُدّل إليه. */
      className={nested
        ? 'mt-24 rounded-3xl bg-surface px-5 py-10 md:mt-32 md:px-10 md:py-12'
        : 'border-y border-white/5 bg-surface py-10 md:py-12'}
    >
      <div className={nested ? '' : 'shell'}>
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
    </Wrapper>
  )
}
