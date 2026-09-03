import { useCourseCohorts } from "@/services/cohort-prices";
import CohortPicker from "@/components/CohortPicker";
import { useEffect, useState } from "react";
import { ChevronDown, Clock3, Target, ListChecks, FolderKanban, Award, RefreshCcw, X, Gift, Plus, UserRound, LifeBuoy, Tag, Trophy } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { courseFullById, weeksLabel, MIN_PATHWAY_COURSES, MAX_PATHWAY_COURSES } from "@/data/courses";
import { apiGet } from "@/services/api";

/** مقترح استبدال/إضافة/هدية — يحسبه المحرك من مجال المسار وفجوات المتعلم */
export interface CourseSuggestion {
  id: string;
  name: string;
  note: string;
}

/** وضع التخصيص داخل رحلة الدورات — يُمرَّر فقط لمن يملك حسابا، وللمسارات الأساسية */
export interface CourseJourneyEdit {
  /** دورة الهدية المجانية إن اختيرت — تظهر آخر القائمة بشارة ولا تُحتسب في العدد */
  giftId: string | null;
  /** الدورة المفتوحة بدائلها حاليا */
  swapForId: string | null;
  /** مقترحات مفلترة: خارج المختارة والهدية، مرتبة بأولوية معالجة الفجوات */
  pool: CourseSuggestion[];
  minReached: boolean;
  maxReached: boolean;
  /* التبديل وحده — للخطة المركّبة: يستبدل المتعلم دورة بأخرى تناسب احتياجه،
     ولا يحذف ولا يضيف ولا يختار هدية. والسبب أن عدد الدورات هو ما يحدد السعر،
     فتثبيته يُبقي السعر ثابتا ويفتح الاختيار في الوقت نفسه. */
  swapOnly?: boolean;
  /** لماذا يضيف بدل أن يكتفي — جملةٌ يكتبها النداء بأرقامه هو.

      لا تُحسب هنا: سلّمُ خصم المسار الجاهز غير سلّم البناء الحرّ، فرقمٌ
      مكتوبٌ داخل المكوّن يصدق في صفحةٍ ويكذب في أخرى. */
  addReason?: string;
  onSwapToggle: (id: string | null) => void;
  onSwapPick: (oldId: string, newId: string) => void;
  onRemove: (id: string) => void;
  onAdd: (id: string) => void;
  onGiftToggle: (id: string) => void;
}

/* «ماذا ستحقق من خلال خطتك؟» — الدورات رحلة متتابعة لا بطاقات متفرقة.
   تفاصيل كل دورة تُفتح بـAccordion داخل الصفحة نفسها — لا نوافذ منبثقة هنا.
   وعند تمرير edit تصبح الرحلة نفسها قابلة للتخصيص: استبدال في المكان بكل
   التفاصيل، حذف حتى النواة، إضافة حتى السقف، وهدية مجانية فوق العدد. */
export default function CourseJourney({
  courseIds,
  reasons,
  delivery,
  headingLevel: Heading = "h3",
  edit,
  giftId,
  supportReasons,
  showSchedule = false,
  graduationProjectAr,
}: {
  courseIds: string[];
  /** سبب وجود كل دورة في الخطة (للخطط المركبة) — يظهر سطرا واحدا تحت الاسم */
  reasons?: Record<string, string>;
  /** طريقة تقديم المسار — تُعرض ضمن تفاصيل كل دورة */
  delivery?: string;
  /** مشروع التخرّج — سطرٌ أخيرٌ في الرحلة نفسها لا صندوقٌ منفصلٌ خارجها */
  graduationProjectAr?: string | null;
  headingLevel?: "h2" | "h3";
  edit?: CourseJourneyEdit;
  /** شارة «هدية مجانية» بلا أدوات تخصيص — للعرض فقط كصفحة المسار */
  giftId?: string | null;
  /* موعدُ كلّ دورة تحت اسمها — قرارُ صاحب المنتج: «يجب أن يكون هناك تاريخ
     لأقرب شعبة لكلّ دورة بالمسار، ويحقّ له اختيار الشعبة التي يريد».

     ومتى يبدأ سؤالٌ في قلب قرار الشراء لا تفصيلٌ بعده: من يقرأ عن مسارٍ من
     ستّ دورات يريد أن يعرف متى يبدأ قبل أن يدفع. وكان الجواب في صفحةٍ أخرى
     («الشعب المفتوحة») حُذفت لأنّها فصلت الموعد عن الدورة. */
  showSchedule?: boolean;
  /** الدورات المساندة وسببُ كلٍّ منها — تُفصل عن الأساسية بفاصلٍ معنون.

      المساندة ليست خطوةً خامسة في الرحلة: هي مهارةٌ عامّة يحتاجها صاحب هذا
      المسار من مسارٍ آخر. فترقيمُها امتدادا للرحلة يقول ما ليس صحيحا — ولذلك
      لا رقم لها بل أيقونة، ولها سببٌ مكتوب لأنّ دورةً من مجالٍ آخر بلا تفسير
      تُقرأ حشوا. */
  supportReasons?: Record<string, string>;
}) {
  /* نداءٌ واحد للمواعيد، والاختيار محفوظٌ بالدورة — يُقرأ عند الشراء */
  const { cohorts } = useCourseCohorts();
  const [picked, setPicked] = useState<Record<string, string>>({});
  /* صندوقُ المقترحات مطويٌّ افتراضا — العرضُ قائمٌ في سطره، والشبكةُ تُفتح بطلب */
  const [poolOpen, setPoolOpen] = useState(false);
  const list = courseIds
    .map((id) => courseFullById(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (list.length === 0) return null;
  const isSupportId = (id: string) => Boolean(supportReasons?.[id]);
  const firstSupport = list.findIndex((c) => isSupportId(c.id));
  const coreCount = firstSupport === -1 ? list.length : firstSupport;

  return (
    <div className="card-soft mt-8" id="learning-plan">
      <Heading className="h-card flex items-center gap-2">
        <Target className="h-5 w-5 text-gold-ink" />
        ماذا ستحقق من خلال خطتك؟
      </Heading>
      <p className="mt-2 text-xs leading-relaxed text-white/50">
        {!edit
          ? "رحلة تعليمية مرتبة تنقلك من احتياجك الحالي إلى نتائج عملية يمكنك استخدامها في عملك وحياتك."
          : edit.swapOnly
            ? "خطة مبنية لك من أكثر من مجال — وكل دورة فيها قابلة للاستبدال بأخرى تناسب احتياجك. العدد ثابت، فالسعر لا يتغير."
            : `رحلتك مرتبة من احتياجك إلى نتيجة عملية — وكل دورة فيها قابلة للاستبدال أو الحذف (بين ${MIN_PATHWAY_COURSES} و${MAX_PATHWAY_COURSES})، والهدية المجانية فوقها.`}
      </p>

      {/* سياسة المدربين تُقال مرة واحدة هنا بدل أن تتكرر شارةً على كل بطاقة —
          كانت خمس دورات تحمل خمس نسخ من الجملة نفسها فتغرق ما يختلف بينها.
          والشارة أدناه تبقى للمدرب المُعلَن، لأن اسمه معلومة تخص بطاقته وحدها. */}
      <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">
        نُعلن اسم مدرب كل دورة عند اعتماد شعبتها — ولا نعرض اسما قبل ذلك.
      </p>

      <ol className="mt-6">
        {list.map((c, i) => {
          const isGift = edit ? edit.giftId === c.id : giftId === c.id;
          const swapOpen = edit?.swapForId === c.id;
          const isSupport = isSupportId(c.id);
          return (
          <li key={c.id} className="relative pb-5 last:pb-0">
            {isSupport && i === firstSupport && (
              <div className="mb-4 border-t border-dashed border-white/15 pt-4">
                <p className="flex items-center gap-2 text-xs font-black text-teal-light-ink">
                  <LifeBuoy className="h-4 w-4" />
                  دورات مساندة ({list.length - coreCount})
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                  مهارات من مسارات أخرى يحتاجها صاحب هذا المسار في عمله — تُكمل الرحلة ولا تُكرّرها.
                </p>
              </div>
            )}
            {i < list.length - 1 && !(isSupportId(list[i + 1].id) && i + 1 === firstSupport) && (
              <span aria-hidden className="absolute right-[15px] top-10 h-[calc(100%-32px)] w-px bg-white/10" />
            )}
            {/* الهديّةُ تُعرَف بشارتها لا بإطارٍ ذهبيّ يميّز بطاقتها كلَّها —
                بطاقةٌ عاديّة كسائر البطاقات، وشارة واحدة تكفي. */}
            <Collapsible className="rounded-2xl border border-white/10 bg-white/[0.03] transition-colors data-[state=open]:border-teal/40 data-[state=open]:bg-teal/[0.05]">
              <div className="flex items-start gap-3 p-4">
                <span className={`z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-black ${
                  isGift
                    ? "border-[#FABC05]/60 bg-[#FABC05] text-[#0D0D0D]"
                    : "border-[#38A7B4]/50 bg-paper text-[#6EC7D1]"
                }`}>
                  {isGift ? <Gift className="h-3.5 w-3.5" /> : isSupport ? <LifeBuoy className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <CollapsibleTrigger
                    className="group block w-full text-right"
                    aria-label={`تفاصيل دورة ${c.title}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black leading-snug text-white/90">
                        {c.title}
                        {isGift && (
                          <span className="mr-2 rounded-full bg-gold px-2 py-0.5 align-middle text-micro font-black text-on-gold">
                            هدية مجانية
                          </span>
                        )}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-white/40 transition-transform duration-300 group-data-[state=open]:rotate-180 group-data-[state=open]:text-teal-light-ink" />
                    </span>
                    {c.shortPromise && (
                      <span className="mt-1 block text-xs leading-relaxed text-white/55">{c.shortPromise}</span>
                    )}
                  </CollapsibleTrigger>
                  {showSchedule && (
                    <div className="mt-2">
                      <CohortPicker
                        compact
                        cohorts={cohorts.get(c.id) ?? []}
                        selectedId={picked[c.id] ?? null}
                        onSelect={(cid) => setPicked((prev) => ({ ...prev, [c.id]: cid }))}
                      />
                    </div>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-semibold text-white/60">
                      <Clock3 className="h-3 w-3 text-teal-light-ink" />
                      {weeksLabel(Math.max(1, Math.ceil(c.totalHours / 7)))}
                    </span>
                    {c.relatedSkills.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-teal/30 bg-teal/[0.08] px-2.5 py-0.5 text-[11px] font-semibold text-teal-light-ink"
                      >
                        {s}
                      </span>
                    ))}
                    <CourseTrainer courseId={c.id} />
                  </div>
                  {reasons?.[c.id] && (
                    <p className="mt-2 text-[11px] leading-relaxed text-white/45">
                      <span className="font-bold text-gold-ink/80">لماذا هي في خطتك: </span>
                      {reasons[c.id]}
                    </p>
                  )}
                  {isSupport && supportReasons?.[c.id] && (
                    <p className="mt-2 text-[11px] leading-relaxed text-white/45">
                      <span className="font-bold text-teal-light-ink">لماذا هي مساندة لهذا المسار: </span>
                      {supportReasons[c.id]}
                    </p>
                  )}
                  {/* أدوات التخصيص — داخل البطاقة نفسها، والهديّة تُستبدل كغيرها
                      (فتنتقل الصفة لبديلتها) لا تُقفَل. */}
                  {edit && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => edit.onSwapToggle(swapOpen ? null : c.id)}
                        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                          swapOpen
                            ? "border-teal-light bg-teal/20 text-teal-light-ink"
                            : "border-teal/40 text-teal-light-ink hover:bg-teal/15"
                        }`}
                      >
                        <RefreshCcw className="h-3 w-3" />
                        {swapOpen ? "إخفاء البدائل" : "استبدالها"}
                      </button>
                      {!edit.swapOnly && (
                      <button
                        onClick={() => edit.onRemove(c.id)}
                        disabled={edit.minReached}
                        aria-label={`حذف ${c.title}`}
                        className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-bold text-white/50 transition hover:border-red-400/50 hover:text-red-300 disabled:opacity-30"
                      >
                        <X className="h-3 w-3" />
                        حذفها
                      </button>
                      )}
                    </div>
                  )}
                  {edit && !edit.swapOnly && isGift && (
                    <div className="mt-3">
                      <button
                        onClick={() => edit.onGiftToggle(c.id)}
                        className="flex items-center gap-1 rounded-full border border-gold/40 px-2.5 py-1 text-[11px] font-bold text-gold-ink transition hover:bg-gold/10"
                      >
                        <X className="h-3 w-3" />
                        إلغاء الهدية
                      </button>
                    </div>
                  )}

                  {/* بدائل الاستبدال — تظهر تحت الدورة نفسها، والاختيار يحل مكانها فورا بكل تفاصيله */}
                  {edit && swapOpen && (
                    <div className="mt-3 rounded-xl border border-teal/30 bg-teal/[0.06] p-3">
                      <p className="mb-2 text-[11px] font-bold text-teal-light-ink">
                        بدائل مقترحة لك خصيصا — تحل مكان «{c.title}» فورا بكل تفاصيلها:
                      </p>
                      <div className="grid gap-1.5">
                        {edit.pool.filter((p) => p.id !== c.id).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => edit.onSwapPick(c.id, p.id)}
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-right transition hover:border-teal-light/50 hover:bg-white/[0.07]"
                          >
                            <span className="block text-xs font-bold text-white/85">{p.name}</span>
                            <span className="mt-0.5 block text-micro text-white/45">{p.note}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-[accordion-up_0.25s_ease-out] data-[state=open]:animate-[accordion-down_0.3s_ease-out]">
                <div className="space-y-5 border-t border-white/10 px-4 py-5 pr-[3.25rem] text-xs leading-7">
                  {c.description && <p className="text-white/60">{c.description}</p>}
                  {c.targetAudience && (
                    <p className="text-white/55">
                      <span className="font-bold text-teal-light-ink">لمن صُممت؟ </span>
                      {c.targetAudience}
                    </p>
                  )}
                  {c.learningObjectives.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 font-bold text-teal-light-ink">
                        <ListChecks className="h-3.5 w-3.5" /> أهداف الدورة
                      </p>
                      <ul className="grid gap-1">
                        {c.learningObjectives.map((o) => (
                          <li key={o} className="flex items-start gap-2 text-white/60">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal" />
                            {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {c.learningOutcomes.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 font-bold text-gold-ink">
                        <Target className="h-3.5 w-3.5" /> ماذا ستتمكن من فعله بعدها؟
                      </p>
                      <ul className="grid gap-1">
                        {c.learningOutcomes.map((o) => (
                          <li key={o} className="flex items-start gap-2 text-white/60">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
                            {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {c.practicalProject && (
                    <p className="flex items-start gap-1.5 text-white/55">
                      <FolderKanban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-ink" />
                      <span>
                        <span className="font-bold text-white/70">مخرجها العملي: </span>
                        {c.practicalProject}
                      </span>
                    </p>
                  )}
                  {c.modules.length > 0 && (
                    <div>
                      <p className="mb-1.5 font-bold text-white/70">الوحدات والمحاور:</p>
                      <ol className="space-y-1.5">
                        {c.modules.map((m, mi) => (
                          <li key={m.id} className="flex items-start gap-2.5 rounded-lg bg-white/[0.03] px-3 py-2">
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.06] text-micro font-black text-white/55">
                              {mi + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-bold text-white/80">{m.title}</span>
                              {m.outcome && <span className="mt-0.5 block text-white/45">{m.outcome}</span>}
                            </span>
                            <span className="shrink-0 text-micro text-white/40">{m.hours} س</span>
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
          );
        })}

        {/* ختام الرحلة */}
        <li className="relative flex items-start gap-3 pt-1">
          <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold text-xs font-black text-on-gold">
            <Award className="h-4 w-4" />
          </span>
          <div className="pt-1">
            <p className="text-sm font-black text-gold-ink">شهادة إتمام + تقرير إنجازك الشخصي</p>
            <p className="mt-1 text-xs leading-relaxed text-white/50">
              تُعرض في ملفك ويشاركها أصحاب العمل عبر رابط تحقق — ومعها شهادات توصية من مدربيك المحترفين،
              ومن الجهات التي طُبّقت لديها مشاريعك إن وُجدت.
            </p>
          </div>
        </li>

        {/* مشروع التخرّج — سطرٌ داخل الرحلة نفسها لا صندوقٌ منفصلٌ خارجها،
            بنفس نمط سطر «شهادة إتمام» أعلاه. */}
        {graduationProjectAr && (
          <li className="relative flex items-start gap-3 pt-4">
            <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold text-xs font-black text-on-gold">
              <Trophy className="h-4 w-4" />
            </span>
            <div className="pt-1">
              <p className="text-sm font-black text-gold-ink">
                مشروع التخرّج <span className="font-bold text-white/40">— إضافيّ، خارج دورات المسار</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/50">{graduationProjectAr}</p>
            </div>
          </li>
        )}
      </ol>

      {/* الهدية والإضافة — أسفل الرحلة مباشرة.
          ولا شيء منهما في وضع التبديل: الهدية تزيد العدد والإضافة كذلك، وكلاهما
          يمسّ السعر. وقبل هذا الشرط كانت بطاقة الهدية تظهر في الخطة المركّبة
          وأزرارها موصولة بدالة فارغة — عرضٌ لخيار لا يعمل. */}
      {edit && !edit.swapOnly && (
        <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
          {/* قائمةٌ واحدة لا قائمتان.

              كانت الدورات المقترحة تُعرض مرّتين: صفَّ شرائحَ للهديّة، وتحته
              صفَّ شرائحِ «+ أضف» — الأسماء نفسها بالترتيب نفسه. فسبعُ دوراتٍ
              تصير أربعَ عشرة شريحةً بعرضٍ متفاوت تلتفّ بلا محاذاة، وعلى
              القارئ أن يكتشف بنفسه أنّ الصفّين شيءٌ واحد باحتمالين.

              فصارت الدورة سطرا واحدا في شبكة: اسمُها، وإلى جانبه ما يمكن
              فعله بها. والهديّةُ لم تعد تُختار من هنا: هي سادسة الخطّة
              افتراضا، واستبدالُها من بطاقتها في الرحلة نفسِها — لا صندوقٌ
              يعرض دوراتٍ خارج الخطّة كأنها هديّةٌ ممكنة ثم لا تدخلها. */}
          {/* الصندوقُ مطويٌّ افتراضا — سطرٌ يُغري بالفتح لا شبكةٌ تبتلع الشاشة.

              كان مفتوحا دائما بستّ دورات في شبكةٍ من عمودين، فيأخذ على الهاتف
              حيّزا أكبر من رحلة الدورات نفسِها — وهي أصلُ الصفحة. والمطويُّ
              يبقي العرضَ قائما في سطرٍ واحد: من أراده فتحه، ومن لم يُرده مرّ.

              والسببُ صار مكتوبا. كان الصندوق يقول «أضف دورة أخرى» بلا أن يقول
              **لماذا** — والسببُ الحقيقيّ أنّ الدورات تُشترى معا بخصمٍ لا
              تناله الدورةُ وحدَها. فمن حذف دورةً كان يقرأ دعوةً بلا مقابل. */}
          {edit.pool.length > 0 && !edit.maxReached && (
            <Collapsible
              open={poolOpen}
              onOpenChange={setPoolOpen}
              className="rounded-2xl border border-white/10 bg-white/[0.02]"
            >
              <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 p-4 text-right">
                <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-black text-white/70">
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">أضف دورة أخرى إلى مسارك</span>
                </span>
                <span className="shrink-0 text-[11px] font-bold text-white/40">{edit.pool.length}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-white/45 transition ${poolOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
              <p className="text-[11px] leading-5 text-white/45">
                حتى {MAX_PATHWAY_COURSES} دورات في المسار.
              </p>
              {edit.addReason && (
                <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-teal-light/25 bg-teal/[0.06] px-3 py-2 text-[11px] leading-5 text-teal-light-ink">
                  <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0">{edit.addReason}</span>
                </p>
              )}

              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {edit.pool.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-1.5 pe-2 ps-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/70" title={p.name}>
                      {p.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {!edit.maxReached && (
                        <button
                          onClick={() => edit.onAdd(p.id)}
                          aria-label={`أضف «${p.name}» إلى مسارك`}
                          className="grid h-6 w-6 cursor-pointer place-items-center rounded-full border border-white/15 text-white/55 transition hover:border-teal-light/60 hover:text-teal-light-ink"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              </CollapsibleContent>
            </Collapsible>
          )}
          {edit.minReached && !edit.swapOnly && (
            <p className="text-[11px] text-gold-ink/80">وصلت للحد الأدنى — {MIN_PATHWAY_COURSES} دورات هي نواة المسار.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* شارة مدرب الدورة المعلن — من الخادم؛ تختفي بهدوء عند غياب الشبكة أو الخادم */
function CourseTrainer({ courseId }: { courseId: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ announced: boolean; messageAr?: string; trainers: { id: string; name: string; headline: string | null }[] }>(
      `/api/courses/${encodeURIComponent(courseId)}/trainer`,
    )
      .then((res) => {
        if (cancelled) return;
        /* المُعلَن وحده يستحق شارة على بطاقته. أما «لم يُعلن بعد» فسياسة عامة
           تُقال مرة فوق القائمة (انظر أعلى المكوّن)، لا خمس مرات داخلها. */
        if (res.announced && res.trainers.length > 0) {
          const names = res.trainers.map((t) => t.name).join("، ");
          setLabel(`المدرب: ${names}`);
        }
      })
      .catch(() => {
        /* بلا خادم — لا شارة */
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  if (!label) return null;
  return (
    <span className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/[0.07] px-2.5 py-0.5 text-[11px] font-semibold text-gold-ink/90">
      <UserRound className="h-3 w-3" />
      {label}
    </span>
  );
}
