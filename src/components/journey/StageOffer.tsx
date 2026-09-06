/* مرحلةٌ لا يملكها بعد — بابُها لا فراغُها.

   كان هذا موزَّعا على شاشتين: «مساري» تعرض ما في خطّته ولها زرُّ شراء، و«دوراتي»
   لا تعرفه أصلا. فمن نقر مرحلةً لم يشترِها في شريط رحلته كان يرى لا شيء.

   وثلاثُ حالاتٍ لا رابعةَ لها، ولكلٍّ فعلُها الصادق:
     • لها شعبةٌ مفتوحة → موعدُها وسعرُها وزرُّ شرائها في مكانها.
     • في خطّته ولا شعبةَ لها → «بانتظار شعبة»، ومعها خياراتُه: إشعارٌ عند
       الفتح، أو استبدالٌ بدورةٍ بديلة.
     • ليست في خطّته ولا يملكها → دورةٌ من المسار يستطيع إضافتَها، وصفحتُها
       العامّة هي موضعُ قرار الشراء لا هنا: هناك السعرُ والخصمُ والتفاصيل. */

import { Link } from "react-router";
import { CalendarClock, Info, ShoppingCart } from "lucide-react";
import CohortPicker from "@/components/CohortPicker";
import BuyCohort from "@/components/BuyCohort";
import AwaitingCourseChoices from "@/components/AwaitingCourseChoices";
import HeldSeatNotice, { type HeldSeat } from "@/components/HeldSeatNotice";
import { formatCohortPrice, type CohortOption } from "@/services/cohort-prices";
import type { JourneyStage } from "@/application/student/journey";

import { Panel, Card } from "@/components/ui/Surface";
export default function StageOffer({
  stage,
  options,
  selectedCohortId,
  onPickCohort,
  heldSeat,
  onChanged,
}: {
  stage: JourneyStage;
  /** شعبُ هذه الدورة المفتوحة — مصدرُها نداءٌ واحد لكلّ الصفحة */
  options: CohortOption[];
  selectedCohortId: string | null;
  onPickCohort: (cohortId: string) => void;
  /** مقعدٌ دُفع ثمنُه ولم يصر تسجيلا — يُقال ويُطفأ الشراءُ فوقه */
  heldSeat: HeldSeat | null;
  onChanged: () => void;
}) {
  const chosen = options.find((o) => o.id === selectedCohortId) ?? options[0] ?? null;

  return (
    <Panel as="section" className="sm:p-5">
      <h3 className="text-base font-black leading-snug">{stage.titleAr}</h3>
      <p className="mt-0.5 text-micro text-muted-foreground">
        {stage.hours > 0 && `${stage.hours} ساعة · `}
        {stage.weeks} {stage.weeks === 1 ? "أسبوع" : "أسابيع"}
        {stage.isGift && " · هديّتك في الخطّة"}
      </p>

      {heldSeat ? (
        <div className="mt-4">
          <HeldSeatNotice seat={heldSeat} />
        </div>
      ) : options.length > 0 ? (
        <>
          {/* الموعدُ في موضع القرار — ومعه سعرُ الشعبة المختارة لا سعرٌ عامّ */}
          <Card className="mt-4 p-3.5">
            <CohortPicker
              cohorts={options}
              selectedId={chosen?.id ?? null}
              onSelect={onPickCohort}
              compact
            />
            {chosen && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
                <span dir="ltr" className="text-lg font-black text-foreground">{formatCohortPrice(chosen)}</span>
                <BuyCohort cohort={chosen} onBought={onChanged} />
              </div>
            )}
          </Card>
          {!stage.inPlan && (
            <p className="mt-2.5 flex items-start gap-1.5 text-micro leading-5 text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                هذه من دورات المسار ولم تُضِفها بعد. تفاصيلُها كاملةً وخصمُ بناء المسار في{" "}
                <Link to={`/build/${stage.courseId}`} className="font-bold text-teal-light-ink underline underline-offset-4">
                  صفحتها
                </Link>
                .
              </span>
            </p>
          )}
        </>
      ) : stage.inPlan ? (
        <>
          <Card as="p" className="mt-4 flex items-start gap-2 px-4 py-3 text-xs leading-6 text-muted-foreground">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-bold text-foreground">بانتظار شعبة.</span>{" "}
              لا تُطلب الآن ولا يُدفع ثمنُها — نُعلمك فور جدولتها، أو استبدلها بدورةٍ بديلة.
            </span>
          </Card>
          <div className="mt-3">
            <AwaitingCourseChoices
              courseId={stage.courseId}
              courseTitle={stage.titleAr}
              notifyOnCohort={false}
              onChanged={onChanged}
            />
          </div>
        </>
      ) : (
        <Card className="mt-4">
          <p className="text-xs leading-6 text-muted-foreground">
            لم تُفتح شعبةٌ لهذه الدورة الآن. صفحتُها العامّة تعرض تفاصيلَها كاملةً، ونُعلمك فور فتح أوّل شعبة.
          </p>
          <Link
            to={`/build/${stage.courseId}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-teal/50 px-4 py-2 text-xs font-black text-teal-light-ink transition hover:bg-teal/10"
          >
            <ShoppingCart className="h-3.5 w-3.5" /> افتح صفحة الدورة
          </Link>
        </Card>
      )}
    </Panel>
  );
}
