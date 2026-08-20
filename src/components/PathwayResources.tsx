import { BookOpen, Headphones, MonitorPlay, Wrench, LayoutTemplate, Briefcase } from "lucide-react";
import { exampleSummaryTitles } from "@/services/wajeezBooks";

/* «المعرفة التي سترافق مسارك» — أنواع المصادر المرافقة للرحلة التعليمية.
   قواعد (بقرار المالك، 2026-08-20):
   - نعرض «أنواع» المصادر ولماذا تدخل في المسار — لا تكاملات جديدة ولا موارد مخترعة.
   - الأمثلة تُذكر فقط لنوع له بيانات فعلية في المنتج (ملخصات الكتب حالياً)،
     وتُجلب من مصدر البيانات نفسه — لا نسخ يدوي ولا روابط Placeholder.
   - لا نعد بأن كل نوع موجود في كل مسار — سطر الختام يوضح ذلك صراحة. */

interface ResourceType {
  icon: typeof BookOpen;
  title: string;
  why: string;
  examples?: string[];
}

const types: ResourceType[] = [
  {
    icon: BookOpen,
    title: "ملخصات كتب",
    why: "خلاصات مركزة لكتب عالمية تبني أرضية المفاهيم قبل كل مرحلة — تسمعها في دقائق ثم تختبر نفسك فيها.",
    examples: exampleSummaryTitles(3),
  },
  {
    icon: Headphones,
    title: "بودكاست",
    why: "حوارات صوتية تُسمع أثناء التنقل — تُبقيك متصلا بموضوع مسارك بين دورة وأخرى.",
  },
  {
    icon: MonitorPlay,
    title: "فيديوهات ومحاضرات",
    why: "مقاطع مركزة تشرح المفاهيم الصعبة بصريا — حين تحتاج أن ترى الفكرة لا أن تقرأ عنها.",
  },
  {
    icon: Wrench,
    title: "أدوات وتطبيقات",
    why: "أدوات عملية تجرب بها ما تعلمته على واقعك مباشرة بدل أن يبقى نظريا.",
  },
  {
    icon: LayoutTemplate,
    title: "قوالب",
    why: "قوالب جاهزة تختصر البدء من الصفر — تعبئها في واجباتك ومشروع تخرجك.",
  },
  {
    icon: Briefcase,
    title: "حالات تطبيقية",
    why: "قصص وحالات واقعية ترى فيها المنهج مطبقا على مواقف تشبه موقفك.",
  },
];

export default function PathwayResources() {
  return (
    <section aria-label="المعرفة التي سترافق مسارك" className="story-fade mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
      <h2 className="flex items-center gap-2 text-xl font-black">
        <BookOpen className="h-5 w-5 text-[#6EC7D1]" />
        المعرفة التي سترافق مسارك
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-loose text-white/65">
        لا نتركك مع الدورات وحدها. نربط كل مرحلة بمصادر مختارة تساعدك على الفهم والتطبيق.
      </p>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => (
          <div key={t.title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#38A7B4]/15">
              <t.icon className="h-4 w-4 text-[#6EC7D1]" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black leading-relaxed">{t.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/50">{t.why}</p>
              {t.examples && t.examples.length > 0 && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#6EC7D1]/80">
                  منها فعليا: {t.examples.join("، ")}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-white/40">
        تختلف المصادر من مسار لآخر بحسب طبيعته — ويظهر لك داخل كل دورة ما يخدمها فعلا.
      </p>
    </section>
  );
}
