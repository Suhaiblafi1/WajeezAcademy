import { X, BookOpen, User, ListChecks, Target, Clock3 } from "lucide-react";
import { courseDetails, coursePriceOf, type Course } from "@/data/courses";
import { formatPrice } from "@/services/currency";
import Modal from "@/components/Modal";

/** نافذة تفاصيل الدورة — المدرب، المحاور، المخرج، السعر (وصول كامل: حبس تركيز وEscape) */
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
    <Modal onClose={onClose} label={`تفاصيل دورة ${course.name}`} panelClassName="w-full max-w-lg">
      <div
        dir="rtl"
        className="story-fade max-h-[85vh] overflow-y-auto rounded-3xl border border-white/10 bg-surface p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="rounded-full border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-3 py-1 text-[11px] font-bold text-[#6EC7D1]">
              {course.category}
            </span>
            <h3 className="mt-3 text-xl font-black leading-relaxed">{course.name}</h3>
            <p className="mt-1 text-xs text-white/45">من مسار «{course.pathwayName}»</p>
          </div>
          <button onClick={onClose} aria-label="إغلاق نافذة التفاصيل" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/40 transition hover:bg-white/5 hover:text-white">
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

        {/* المدرب — الاسم يُعلن بعد اعتماد الشعبة؛ يظهر التخصص التدريبي فقط */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#38A7B4]/25 bg-[#38A7B4]/5 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#38A7B4] to-[#247B84] text-base font-black text-[#08272B]">
            <User className="h-5 w-5" />
          </span>
          <div>
            <p className="flex items-center gap-1.5 text-[11px] text-white/45">
              <User className="h-3 w-3" /> مدرب الدورة
            </p>
            <p className="text-sm font-black">{d.trainer.role}</p>
            <p className="text-xs text-[#6EC7D1]">{d.trainer.name}</p>
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

        {/* منهجية تصميم الدورة — سطر واحد صادق */}
        <p className="mt-4 text-[11px] leading-6 text-white/45">
          صُممت مخرجات هذه الدورة انطلاقًا مما يجب أن تتمكن من إنجازه عمليًا بعد إتمامها.{" "}
          <a href="/methodology" className="font-bold text-[#6EC7D1] transition hover:text-white">
            كيف نصمم دورات وجيز؟
          </a>
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
    </Modal>
  );
}
