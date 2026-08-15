import { ChevronDown, Clock3, Target, ListChecks, FolderKanban, Award } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { courseFullById, weeksLabel } from "@/data/courses";

/* «ماذا ستحقق من خلال خطتك؟» — الدورات رحلة متتابعة لا بطاقات متفرقة.
   تفاصيل كل دورة تُفتح بـAccordion داخل الصفحة نفسها — لا نوافذ منبثقة هنا.
   كل بند يعمل بالسهم ولوحة المفاتيح وقارئ الشاشة عبر CollapsibleTrigger الأصلي. */
export default function CourseJourney({
  courseIds,
  reasons,
  delivery,
  headingLevel: Heading = "h3",
}: {
  courseIds: string[];
  /** سبب وجود كل دورة في الخطة (للخطط المركبة) — يظهر سطرا واحدا تحت الاسم */
  reasons?: Record<string, string>;
  /** طريقة تقديم المسار — تُعرض ضمن تفاصيل كل دورة */
  delivery?: string;
  headingLevel?: "h2" | "h3";
}) {
  const list = courseIds
    .map((id) => courseFullById(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (list.length === 0) return null;

  return (
    <div className="card-soft mt-8" id="learning-plan">
      <Heading className="h-card flex items-center gap-2">
        <Target className="h-5 w-5 text-[#FABC05]" />
        ماذا ستحقق من خلال خطتك؟
      </Heading>
      <p className="mt-2 text-xs leading-relaxed text-white/50">
        رحلة تعليمية مرتبة تنقلك من احتياجك الحالي إلى نتائج عملية يمكنك استخدامها في عملك وحياتك.
      </p>

      <ol className="mt-6">
        {list.map((c, i) => (
          <li key={c.id} className="relative pb-4 last:pb-0">
            {i < list.length - 1 && (
              <span aria-hidden className="absolute right-[15px] top-10 h-[calc(100%-32px)] w-px bg-white/10" />
            )}
            <Collapsible className="rounded-2xl border border-white/10 bg-white/[0.03] transition-colors data-[state=open]:border-[#38A7B4]/40 data-[state=open]:bg-[#38A7B4]/[0.05]">
              <div className="flex items-start gap-3 p-4">
                <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#38A7B4]/50 bg-[#0D0D0D] text-xs font-black text-[#6EC7D1]">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <CollapsibleTrigger
                    className="group block w-full text-right"
                    aria-label={`تفاصيل دورة ${c.title}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black leading-snug text-white/90">{c.title}</span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-white/40 transition-transform duration-300 group-data-[state=open]:rotate-180 group-data-[state=open]:text-[#6EC7D1]" />
                    </span>
                    {c.shortPromise && (
                      <span className="mt-1 block text-xs leading-relaxed text-white/55">{c.shortPromise}</span>
                    )}
                  </CollapsibleTrigger>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-semibold text-white/60">
                      <Clock3 className="h-3 w-3 text-[#6EC7D1]" />
                      {weeksLabel(Math.max(1, Math.ceil(c.totalHours / 7)))}
                    </span>
                    {c.relatedSkills.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-[#38A7B4]/30 bg-[#38A7B4]/[0.08] px-2.5 py-0.5 text-[11px] font-semibold text-[#6EC7D1]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  {reasons?.[c.id] && (
                    <p className="mt-2 text-[11px] leading-relaxed text-white/45">
                      <span className="font-bold text-[#FABC05]/80">لماذا هي في خطتك: </span>
                      {reasons[c.id]}
                    </p>
                  )}
                  {c.practicalProject && (
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-white/50">
                      <FolderKanban className="mt-0.5 h-3 w-3 shrink-0 text-[#FABC05]" />
                      <span>
                        <span className="font-bold text-white/65">مخرجها العملي: </span>
                        {c.practicalProject}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-[accordion-up_0.25s_ease-out] data-[state=open]:animate-[accordion-down_0.3s_ease-out]">
                <div className="space-y-4 border-t border-white/10 px-4 py-4 pr-[3.25rem] text-xs leading-6">
                  {c.description && <p className="text-white/60">{c.description}</p>}
                  {c.targetAudience && (
                    <p className="text-white/55">
                      <span className="font-bold text-[#6EC7D1]">لمن صُممت؟ </span>
                      {c.targetAudience}
                    </p>
                  )}
                  {c.learningObjectives.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 font-bold text-[#6EC7D1]">
                        <ListChecks className="h-3.5 w-3.5" /> أهداف الدورة
                      </p>
                      <ul className="grid gap-1">
                        {c.learningObjectives.map((o) => (
                          <li key={o} className="flex items-start gap-2 text-white/60">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#38A7B4]" />
                            {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {c.learningOutcomes.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 font-bold text-[#FABC05]">
                        <Target className="h-3.5 w-3.5" /> ماذا ستتمكن من فعله بعدها؟
                      </p>
                      <ul className="grid gap-1">
                        {c.learningOutcomes.map((o) => (
                          <li key={o} className="flex items-start gap-2 text-white/60">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#FABC05]" />
                            {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {c.modules.length > 0 && (
                    <div>
                      <p className="mb-1.5 font-bold text-white/70">الوحدات والمحاور:</p>
                      <ol className="space-y-1.5">
                        {c.modules.map((m, mi) => (
                          <li key={m.id} className="flex items-start gap-2.5 rounded-lg bg-white/[0.03] px-3 py-2">
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[10px] font-black text-white/55">
                              {mi + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-bold text-white/80">{m.title}</span>
                              {m.outcome && <span className="mt-0.5 block text-white/45">{m.outcome}</span>}
                            </span>
                            <span className="shrink-0 text-[10px] text-white/40">{m.hours} س</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-white/[0.07] pt-3 text-[11px] text-white/50">
                    {c.prerequisites && (
                      <span>
                        <span className="font-bold text-white/65">المتطلبات السابقة: </span>
                        {c.prerequisites}
                      </span>
                    )}
                    {c.level && (
                      <span>
                        <span className="font-bold text-white/65">المستوى: </span>
                        {c.level}
                      </span>
                    )}
                    {delivery && (
                      <span>
                        <span className="font-bold text-white/65">طريقة التقديم: </span>
                        {delivery}
                      </span>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </li>
        ))}

        {/* ختام الرحلة */}
        <li className="relative flex items-start gap-3 pt-1">
          <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FABC05] text-xs font-black text-[#0D0D0D]">
            <Award className="h-4 w-4" />
          </span>
          <div className="pt-1">
            <p className="text-sm font-black text-[#FABC05]">شهادة إتمام + تقرير إنجازك الشخصي</p>
            <p className="mt-1 text-xs leading-relaxed text-white/50">
              تُعرض في ملفك ويشاركها أصحاب العمل عبر رابط تحقق.
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
}
