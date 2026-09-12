/* ملخّصُ المستشار — ورقةٌ تُحفظ ثمّ محادثةٌ تُفتح (١٢ سبتمبر ٢٠٢٦).

   ─────────── الطلبُ وما يمنعه ───────────

   طلبَ صاحبُ المنصّة أن يفتح زرُّ «راسل مستشار وجيز قبل الدفع» واتسابَ
   **ومعه ملفٌّ مرفقٌ** فيه المسارُ المرشَّحُ وخلاصةُ إجابات التشخيص.

   و`wa.me` لا يحمل مرفقا. مخطّطُ الروابط في واتساب يحمل نصّا وحدَه — لا
   ملفّا ولا صورة، على أيّ منصّة. فالمرفقُ يأتي من يد صاحبِه لا من الرابط.

   ─────────── فالورقةُ تُصنع هنا، ويُرفقها هو ───────────

   خطوتان في نافذةٍ واحدة: **يحفظ الورقةَ PDF** (طباعةُ المتصفّح — بلا
   مكتبةٍ تُضاف، والعربيّةُ تُشكَّل وتُوصَل كما في الشاشة سواءً)، ثمّ
   **يفتح واتساب** برسالةٍ مكتوبةٍ تقول له أن يُرفقها ومعها سيرتُه أو رابطُ
   لينكدإن. ونصُّ الطلب مكتوبٌ في الورقة نفسِها أيضا، فمن أرسل بلا قراءةِ
   الرسالة وجده أمامه.

   ─────────── وما لا يُكتب في الورقة ───────────

   لا رقمَ ولا نسبةَ ثقةٍ ولا تشخيصَ «شخصيّة»: الورقةُ لمستشارٍ بشريٍّ
   يقرؤها قبل مكالمة، فما فيها ما يفيده — المسارُ، ولماذا رُشّح، وأينَ
   الفجوات، وما الذي يريده صاحبُها. وما لم يُشخَّص صاحبُها تُصنع ورقةٌ
   بما يُعرف (المسارُ المعروضُ وحدَه)، ولا يُخترع لها محتوى. */

import { useEffect, useMemo } from "react";
import { FileText, MessageCircle, Printer, X } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/ui/Button";
import { Card, Inset } from "@/components/ui/Surface";
import { loadLastResult } from "@/application/diagnostic/session-store";
import type { DiagResult } from "@/data/diagnostic";
import { CONTACT } from "@/data/stories";

/** ما يُطلب من المرسِل — مكتوبٌ مرّةً ويُقرأ في الورقة وفي الرسالة معا */
export const BRIEF_ATTACH_NOTE_AR =
  "أرجو إرفاق سيرتك الذاتية أو رابط حسابك على لينكدإن ليعرف مستشار المسار المهني عنك أكثر.";

export interface AdvisorBriefProps {
  /** اسمُ المسار المرشَّح — كما يُعرض في صفحته */
  pathwayName: string;
  /** الدوراتُ التي في خطّته الآن، بأسمائها */
  courseNames: string[];
  /** نصُّ رسالة واتساب الأساسيّ — من الصفحة، فلا يُكتب مرّتين */
  message: string;
  onClose: () => void;
}

/* حدُّ ما يُعرض من كلّ قائمة: ورقةٌ لمكالمةٍ مدّتُها نصفُ ساعة، لا تقرير. */
const MAX_ROWS = 6;

export default function AdvisorBrief({ pathwayName, courseNames, message, onClose }: AdvisorBriefProps) {
  /* النتيجةُ من مخزن التشخيص لا من الصفحة: هي مصدرُها الوحيد، ومن لم
     يُشخَّص يعود `null` فتُطبع ورقةُ المسار وحدَها بلا اختلاق. */
  const result = useMemo(() => loadLastResult<DiagResult>(), []);

  const reasons = (result?.reasons ?? []).slice(0, MAX_ROWS);
  const gaps = (result?.gapDetails ?? []).slice(0, MAX_ROWS);
  const answered = Number(result?.resultJson?.answered_count ?? 0);

  const waHref = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(
    `${message}\n\n${BRIEF_ATTACH_NOTE_AR}`,
  )}`;

  /* وسمُ الجسد يحكم الطباعة: بوجوده يُخفى `#root` فلا تُطبع الصفحةُ خلف
     النافذة. ويُرفع عند الإغلاق مهما كان سببُه — وإلّا بقيت كلُّ طباعةٍ
     بعده ورقةً بيضاء. */
  useEffect(() => {
    document.body.setAttribute("data-printing", "advisor-brief");
    return () => document.body.removeAttribute("data-printing");
  }, []);

  const today = new Date().toLocaleDateString("ar", { year: "numeric", month: "long", day: "numeric" });

  return (
    <Modal onClose={onClose} label="ملخّصك لمستشار وجيز" panelClassName="w-full max-w-2xl">
      <Card className="max-h-[85vh] overflow-y-auto p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 print:hidden">
          <div>
            <h2 className="flex items-center gap-2 text-base font-black">
              <FileText className="h-4 w-4 shrink-0 text-teal-light-ink" />
              ملخّصك لمستشار وجيز
            </h2>
            {/* الخطوتان مكتوبتان قبل الزرّين لا بعدهما: من لا يعرف أنّ عليه
                إرفاقَ الملفّ بيده يضغط «واتساب» ويرسل بلا شيء. */}
            <p className="mt-1 text-read leading-6 text-muted-foreground">
              احفظ الورقة أدناه ملفّا (PDF)، ثمّ افتح واتساب وأرفقها في المحادثة.
            </p>
          </div>
          <Button tone="ghost" icon={X} onClick={onClose} aria-label="أغلق" className="shrink-0" />
        </div>

        {/* ─── الورقة نفسُها — هي وحدَها ما يُطبع ─── */}
        <Inset id="advisor-brief-sheet" className="mt-4 px-5 py-5 print:mt-0 print:border-0 print:px-0">
          <p className="text-read font-bold leading-6 text-teal-light-ink">أكاديمية وجيز — ملخّص لمستشار المسار المهني</p>
          <h3 className="mt-2 text-lg font-black leading-snug">المسار المرشَّح: {pathwayName}</h3>
          <p className="mt-1 text-read leading-6 text-muted-foreground">
            حُرّر في {today}
            {answered > 0 && ` · بعد تشخيصٍ من ${answered} سؤالا`}
          </p>

          {reasons.length > 0 && (
            <section className="mt-4">
              <h4 className="text-sm font-black">لماذا رُشّح لي هذا المسار</h4>
              <ul className="mt-1.5 space-y-1 text-read leading-6 text-muted-foreground">
                {reasons.map((r) => (
                  <li key={r}>— {r}</li>
                ))}
              </ul>
            </section>
          )}

          {gaps.length > 0 && (
            <section className="mt-4">
              <h4 className="text-sm font-black">الفجوات التي أعمل عليها</h4>
              <ul className="mt-1.5 space-y-1 text-read leading-6 text-muted-foreground">
                {gaps.map((g) => (
                  <li key={g.skill}>
                    — <span className="font-bold text-foreground">{g.skill}</span>: من {g.current} إلى {g.target} (أولوية {g.priority})
                  </li>
                ))}
              </ul>
            </section>
          )}

          {courseNames.length > 0 && (
            <section className="mt-4">
              <h4 className="text-sm font-black">الدورات في خطّتي الآن</h4>
              <ul className="mt-1.5 space-y-1 text-read leading-6 text-muted-foreground">
                {courseNames.map((n) => (
                  <li key={n}>— {n}</li>
                ))}
              </ul>
            </section>
          )}

          {/* ما لم يُشخَّص صاحبُها: تُقال حالُها صراحةً بدل أقسامٍ فارغة */}
          {!result && (
            <p className="mt-4 text-read leading-6 text-muted-foreground">
              لم أُكمل مؤشّر وجيز بعد — هذه الورقة تحمل المسار الذي أنظر إليه وحدَه.
            </p>
          )}

          <p className="mt-5 border-t border-white/10 pt-3 text-read leading-6 text-muted-foreground">
            {BRIEF_ATTACH_NOTE_AR}
          </p>
        </Inset>

        <div className="mt-4 flex flex-wrap items-center gap-2.5 print:hidden">
          <Button tone="secondary" icon={Printer} onClick={() => window.print()} className="rounded-full">
            احفظ الملخّص PDF
          </Button>
          {/* رابطٌ لا زرّ (`as="a"`): يُفتح في لسانٍ جديد ويعمل بلا جافاسكربت
              — ونبرتُه من السلّم لا مكتوبةً في مكانها. */}
          <Button tone="confirm" as="a" icon={MessageCircle} href={waHref} target="_blank" rel="noreferrer">
            تابع إلى واتساب
          </Button>
        </div>
      </Card>
    </Modal>
  );
}
