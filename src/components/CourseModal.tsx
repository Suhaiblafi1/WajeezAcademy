import { X, BookOpen, User, ListChecks, Target, Clock3 } from "lucide-react";
import { courseDetails, coursePriceOf, type Course } from "@/data/courses";
import { formatPrice } from "@/services/currency";

/** نافذة تفاصيل الدورة — المدرب، المحاور، المخرج، السعر */
export default function CourseModal({
  course,
  onClose,
  onBuy,
}: {
  course: Course;
  onClose: () => void;
  onBuy?: (c: Course) => void;
}) {
  const d = courseDetails(course);
  const price = coursePriceOf(course);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        dir="rtl"
        className="story-fade max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#121B1D] p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="rounded-full border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-3 py-1 text-[11px] font-bold text-[#6EC7D1]">
              {course.category}
            </span>
            <h3 className="mt-3 text-xl font-black leading-relaxed">{course.name}</h3>
            <p className="mt-1 text-xs text-white/45">من مسار «{course.pathwayName}»</p>
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="text-white/40 transition hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/[0.04] p-3">
            <p className="flex items-center gap-1.5 text-[11px] text-white/45">
              <Clock3 className="h-3.5 w-3.5" /> المدة
            </p>
            <p className="mt-1 text-sm font-black">{course.weeks} {course.weeks === 1 ? "أسبوع" : "أسابيع"}</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-3">
            <p className="flex items-center gap-1.5 text-[11px] text-white/45">
              <BookOpen className="h-3.5 w-3.5" /> المهارة المحورية
            </p>
            <p className="mt-1 text-sm font-black leading-relaxed">{course.skill}</p>
          </div>
        </div>

        {/* المدرب */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#38A7B4]/25 bg-[#38A7B4]/5 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#38A7B4] to-[#247B84] text-base font-black text-white">
            {d.trainer.name.replace(/^(أ\.|د\.|م\.)\s*/, "").charAt(0)}
          </span>
          <div>
            <p className="flex items-center gap-1.5 text-[11px] text-white/45">
              <User className="h-3 w-3" /> مدرب الدورة
            </p>
            <p className="text-sm font-black">{d.trainer.name}</p>
            <p className="text-xs text-[#6EC7D1]">{d.trainer.role}</p>
          </div>
        </div>

        {/* المحاور */}
        <p className="mt-5 mb-2 flex items-center gap-1.5 text-sm font-black text-white/80">
          <ListChecks className="h-4 w-4 text-[#6EC7D1]" /> محاور الدورة
        </p>
        <ul className="space-y-2">
          {d.topics.map((t, i) => (
            <li key={t} className="flex items-start gap-2.5 text-sm text-white/65">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#38A7B4]/15 text-[10px] font-black text-[#6EC7D1]">
                {i + 1}
              </span>
              {t}
            </li>
          ))}
        </ul>

        {/* المخرج */}
        <p className="mt-5 rounded-xl border border-[#FABC05]/30 bg-[#FABC05]/5 p-4 text-sm leading-relaxed text-white/75">
          <span className="mb-1 flex items-center gap-1.5 font-black text-[#FABC05]">
            <Target className="h-4 w-4" /> المخرج العملي
          </span>
          {d.outcome}
        </p>

        {/* السعر والشراء */}
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/10 pt-5">
          <div>
            <p className="text-2xl font-black text-white">{formatPrice(price)}</p>
            <p className="text-[11px] text-[#6EC7D1]">تُخصم كاملة من مسارها لو أكملته لاحقا</p>
          </div>
          {onBuy && (
            <button
              onClick={() => onBuy(course)}
              className="rounded-xl bg-[#FABC05] px-6 py-3 text-sm font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90"
            >
              سجّل في الدورة
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
