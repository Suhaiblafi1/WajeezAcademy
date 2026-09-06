import { Link } from "react-router";
import { Compass, Target, Route, GraduationCap, MessageSquareText, AlertTriangle, ExternalLink, ArrowLeft } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { usePublishedContent } from "@/services/public-content";
import { publicReferences } from "@/data/methodology";
import { pathways } from "@/data/pathways";

import { Panel, Card } from "@/components/ui/Surface";
/* «منهجية وجيز» — المراجع المهنية والتعليمية التي استرشدت بها الأكاديمية.
   لا تُعرض هنا مراجع هندسية أو قانونية (تصميم الواجهة، حماية الملفات...) —
   تلك التزامات داخلية، وهذه الصفحة رسالة مهنية للعميل. */

const DISCLAIMER_METHODOLOGY_AR =
  "المراجع المذكورة أطر مهنية وتعليمية استرشدت بها أكاديمية وجيز في تطوير منهجيتها. ولا يعني ذكرها وجود شراكة أو اعتماد أو تأييد رسمي من الجهات الناشرة.";

function RefCard({ id }: { id: string }) {
  const ref = publicReferences().find((r) => r.id === id);
  if (!ref) return null;
  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-black text-muted-foreground">{ref.name_ar}</p>
        <span className="text-[11px] text-muted-foreground" dir="ltr">
          {ref.name_en}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">الجهة الناشرة: {ref.organization}</p>
      <div className="mt-3 space-y-2 text-xs leading-6">
        <p className="text-muted-foreground">
          <span className="font-bold text-teal-light-ink">كيف تستخدمه وجيز: </span>
          {ref.purpose_ar}
        </p>
        <p className="text-muted-foreground">
          <span className="font-bold text-gold-ink">فائدته لك: </span>
          {ref.customer_benefit_ar}
        </p>
        <p className="text-muted-foreground">
          <span className="font-bold text-muted-foreground">حدود استخدامه: </span>
          {ref.limitations_ar}
        </p>
      </div>
      <a
        href={ref.source_url}
        target="_blank"
        rel="noreferrer"
        /* min-h و py: مساحة اللمس لا تقل عن ٢٤×٢٤ (WCAG 2.5.8) — النص وحده
           كان ١٦ بكسل ارتفاعا، أصغر مما تطاله الإصبع بثقة. */
        className="mt-3 inline-flex min-h-[24px] items-center gap-1.5 py-1 text-xs font-bold text-teal-light-ink transition hover:text-foreground"
      >
        المصدر الأصلي
        <ExternalLink className="h-3 w-3" />
      </a>
    </Card>
  );
}

const SECTIONS: { icon: typeof Compass; q: string; a: string; refs: string[] }[] = [
  {
    icon: Compass,
    q: "كيف نفهم ميولك؟",
    a: "بأسئلة ميول مهنية مبنية على نموذج RIASEC ومقياس O*NET Interest Profiler — ستة أبعاد (قيادية، اجتماعية، تحليلية، إبداعية، تنظيمية، عملية) تُقرأ مع هدفك وواقعك، لا منفردة.",
    refs: ["REF-RIASEC-ONET-IP"],
  },
  {
    icon: Target,
    q: "كيف نحدد فجوات مهاراتك؟",
    a: "نصنّف المهارات بالرجوع إلى نموذج المحتوى O*NET والتصنيف الأوروبي ESCO، وللكفاءة الرقمية إطار DigComp 2.2 — فتُقاس فجواتك بمعايير مهنية موحدة لا بانطباع عابر.",
    refs: ["REF-ONET-CM", "REF-ESCO", "REF-DIGCOMP"],
  },
  {
    icon: Route,
    q: "كيف نربط مهاراتك بالمسار؟",
    a: "بهندسة التصميم المتمحور حول الدليل (ECD): كل استنتاج عنك مرتبط بإجابة قدّمتها، وكل توصية تحمل أثر قرار يمكنك مراجعته — لا صناديق سوداء.",
    refs: ["REF-ECD"],
  },
  {
    icon: GraduationCap,
    q: "كيف نصمم أهداف الدورات ومخرجاتها؟",
    a: "بالتصميم العكسي (Backward Design): نبدأ مما يجب أن تتمكن من إنجازه عمليا، ثم نبني التقييم والأنشطة والمحتوى. وتُصاغ المخرجات وفق تصنيف بلوم بأفعال أداء قابلة للملاحظة والقياس.",
    refs: ["REF-BACKWARD-DESIGN", "REF-BLOOM"],
  },
  {
    icon: MessageSquareText,
    q: "ماذا تستطيع توصيتنا أن تخبرك؟",
    a: "تخبرك بأنسب مسار أو خطة مركبة لحالتك، وبفجواتك المهارية ذات الأولوية، وبمستوى ثبات التوصية وسببها، وبما قد يغيّر النتيجة — كل ذلك مفسَّرا وقابلا للمراجعة والتخصيص.",
    refs: [],
  },
  {
    icon: AlertTriangle,
    q: "ما حدود التشخيص؟",
    a: "التشخيص تعليمي مهني: ليس تقييما نفسيا أو طبيا، ولا وعدا بوظيفة أو دخل. جودة التوصية بجودة إجاباتك، وعند التناقض أو انخفاض الثقة نحيلك لمستشار بشري قبل أي قرار.",
    refs: [],
  },
];

export default function Methodology() {
  usePublishedContent();
  const refs = publicReferences();
  return (
    <SiteShell>
      <SeoHead
        title="منهجية وجيز"
        description="المراجع المهنية والتعليمية التي استرشدت بها أكاديمية وجيز في فهم ميولك وتحديد فجواتك وربطك بالمسار الأنسب."
        path="/methodology"
      />
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold tracking-wide text-teal-light-ink">منهجية وجيز</p>
        <h1 className="mt-3 text-3xl font-black leading-snug md:text-4xl">
          توصية مبنية على منهجية،
          <span className="text-teal-light-ink"> لا على التخمين</span>
        </h1>
        <p className="mt-4 max-w-xl leading-loose text-muted-foreground">
          يحلل مؤشر وجيز ميولك وأهدافك وفجوات مهاراتك، ثم يربطها بما تحتاج إلى تعلمه ضمن مسار ذي مخرجات واضحة —
          بالاستفادة من {refs.length} أطر مهنية وتعليمية معروفة، نعرضها هنا بشفافية كاملة: كيف نستخدمها، وما فائدتها لك، وما حدودها.
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <Panel as="section" key={s.q} className="md:p-8">
              <h2 className="flex items-center gap-2.5 text-lg font-black">
                <s.icon className="h-5 w-5 text-gold-ink" />
                {s.q}
              </h2>
              <p className="mt-3 text-sm leading-loose text-muted-foreground">{s.a}</p>
              {s.refs.map((id) => (
                <RefCard key={id} id={id} />
              ))}
            </Panel>
          ))}
        </div>

        <p className="mt-10 rounded-2xl border border-gold/30 bg-gold/5 p-5 text-xs leading-loose text-muted-foreground">
          {DISCLAIMER_METHODOLOGY_AR} الأسماء تُذكر نصيا فقط دون شعارات، التزاما بتراخيص الجهات الناشرة.
        </p>

        <div className="mt-10 text-center">
          <Link
            to="/diagnostic"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-gold px-8 font-black text-on-gold transition hover:bg-gold/90"
          >
            جرّب المنهجية على نفسك — ابدأ التشخيص
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            {pathways.length} مسارا في الكتالوج، كلها مبنية بهذه المنهجية.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
