import { useEffect, useMemo, useState } from "react";
import {
  BookOpen, BookMarked, Headphones, Video, Wrench, LayoutTemplate, Clock3,
} from "lucide-react";
import BookSummaryCard from "@/components/BookSummaryCard";
import type { BookSummary } from "@/services/wajeezBooks";
import {
  courseResources,
  type CourseResource,
  type CourseResourceType,
  type ResourceNecessity,
} from "@/services/courseResources";

/* «مصادر هذه الدورة» — واجهة موحدة لكل أنواع المصادر التعليمية.
   قواعد (بقرار المالك، 2026-08-20):
   - التبويبات تُشتق من البيانات: نوع بلا مصادر لا يظهر إطلاقا (لا Empty Tabs).
   - ملخصات وجيز تبقى تعمل عبر BookSummaryCard نفسها — الاستماع والاختبار لا يتغيران.
   - البطاقة العامة تحمل الحقول المستقبلية كاملة: الزمن، لماذا رُشح، متى يُستخدم،
     درجة الأهمية (إلزامي/موصى به/اختياري)، والفعل — جاهزة للأنواع القادمة. */

const TYPE_META: Record<CourseResourceType, { label: string; icon: typeof BookOpen }> = {
  summary: { label: "ملخصات وجيز", icon: Headphones },
  book: { label: "كتب", icon: BookMarked },
  podcast: { label: "بودكاست", icon: Headphones },
  video: { label: "فيديو", icon: Video },
  tool: { label: "أدوات", icon: Wrench },
  template: { label: "قوالب", icon: LayoutTemplate },
};
const TYPE_ORDER: CourseResourceType[] = ["summary", "book", "podcast", "video", "tool", "template"];

const NECESSITY_META: Record<ResourceNecessity, { label: string; className: string }> = {
  required: { label: "إلزامي", className: "border-gold/50 bg-gold/10 text-gold-ink" },
  recommended: { label: "موصى به", className: "border-teal/50 bg-teal/10 text-teal-light-ink" },
  optional: { label: "اختياري", className: "border-white/15 bg-white/[0.04] text-white/50" },
};

/* بطاقة مورد عامة — للأنواع التي لا مكوّن متخصصا لها بعد */
function GenericResourceCard({ resource }: { resource: CourseResource }) {
  const meta = TYPE_META[resource.type];
  const necessity = NECESSITY_META[resource.necessity];
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold">{resource.title}</p>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${necessity.className}`}>
          {necessity.label}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
        <span className="flex items-center gap-1">
          <meta.icon className="h-3 w-3 text-teal-light-ink" /> {meta.label}
        </span>
        {resource.estimatedMinutes !== undefined && (
          <span className="flex items-center gap-1">
            <Clock3 className="h-3 w-3 text-teal-light-ink" /> {resource.estimatedMinutes} دقيقة
          </span>
        )}
      </div>
      {resource.whyRecommended && (
        <p className="mt-2 text-[11px] leading-5 text-white/50">
          <span className="font-bold text-white/65">لماذا رُشح: </span>{resource.whyRecommended}
        </p>
      )}
      {resource.whenToUse && (
        <p className="mt-1 text-[11px] leading-5 text-white/50">
          <span className="font-bold text-white/65">متى تستخدمه: </span>{resource.whenToUse}
        </p>
      )}
      {resource.actionLabel && (
        <p className="mt-2.5 text-[11px] font-bold text-teal-light-ink">{resource.actionLabel}</p>
      )}
    </div>
  );
}

export default function CourseResources({
  courseId,
  savedQuiz,
  onQuizPass,
}: {
  courseId: string;
  savedQuiz: Record<string, { passed: boolean; score: number } | undefined>;
  onQuizPass: (book: BookSummary, score: number) => void;
}) {
  const [resources, setResources] = useState<CourseResource[]>([]);
  const [activeType, setActiveType] = useState<CourseResourceType | null>(null);

  useEffect(() => {
    let on = true;
    courseResources.getResourcesForCourse(courseId).then((list) => {
      if (!on) return;
      setResources(list);
      const first = TYPE_ORDER.find((t) => list.some((r) => r.type === t)) ?? null;
      setActiveType(first);
    }).catch(() => {
      if (on) { setResources([]); setActiveType(null); }
    });
    return () => { on = false; };
  }, [courseId]);

  const presentTypes = useMemo(
    () => TYPE_ORDER.filter((t) => resources.some((r) => r.type === t)),
    [resources],
  );
  const shown = useMemo(
    () => resources.filter((r) => r.type === activeType),
    [resources, activeType],
  );

  if (presentTypes.length === 0) return null;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <h3 className="flex items-center gap-2 text-sm font-black">
        <BookOpen className="h-4 w-4 text-teal-light-ink" /> مصادر هذه الدورة
      </h3>
      <p className="mt-1.5 text-[11px] leading-5 text-white/45">
        مصادر مختارة ترافق وحدات الدورة — تُعمّق الفهم وتقرّب التطبيق.
      </p>

      {/* التبويبات: الأنواع الموجودة فقط — تُخفى تماما عندما لا بيانات لها */}
      {presentTypes.length > 1 && (
        <div
          role="tablist"
          aria-label="أنواع المصادر"
          className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {presentTypes.map((t) => {
            const meta = TYPE_META[t];
            const active = t === activeType;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveType(t)}
                className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                  active
                    ? "border-teal/60 bg-teal/15 text-teal-light-ink"
                    : "border-white/10 text-white/55 hover:border-white/25"
                }`}
              >
                <meta.icon className="h-3.5 w-3.5" /> {meta.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {shown.map((r) =>
          r.type === "summary" ? (
            <BookSummaryCard
              key={r.id}
              book={r.payload as BookSummary}
              saved={savedQuiz[r.id]}
              onPass={(score) => onQuizPass(r.payload as BookSummary, score)}
            />
          ) : (
            <GenericResourceCard key={r.id} resource={r} />
          ),
        )}
      </div>

      {activeType === "summary" && (
        <p className="mt-3 text-[11px] text-white/55">
          اسمع الملخص كاملا ثم اجتز اختباره القصير — يُوثق في ملف مهاراتك.
        </p>
      )}
    </section>
  );
}
