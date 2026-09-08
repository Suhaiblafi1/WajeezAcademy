/* طابور عمل المدرب (ف-١) — كل سطر عمل واحد وزر واحد ووجهة واحدة.
   الترتيب بالإلحاح لا بالنوع: الجلسة الجارية قبل التسجيل المنسي قبل التقييم. */

import { Link } from "react-router";
import { AlertTriangle, ClipboardCheck, ClipboardList, ListChecks, Radio, Video, Upload, ArrowLeft } from "lucide-react";
import type { QueueItem, QueueKind } from "@/application/trainer/work-queue";

import WorkHeader from "@/components/admin/WorkHeader";
const ICON: Record<QueueKind, typeof Video> = {
  session_now: Radio,
  session_soon: Video,
  attendance_missing: ClipboardList,
  grading_pending: ClipboardCheck,
  not_submitted: AlertTriangle,
  recording_missing: Upload,
};

/* الإلحاح يحمله الشكل والنص؛ اللون تعزيز لا مصدرا وحيدا */
const TONE: Record<QueueKind, string> = {
  session_now: "border-teal/60 bg-teal-ink/[0.10]",
  session_soon: "border-white/10 bg-white/[0.03]",
  attendance_missing: "border-gold/40 bg-gold/[0.06]",
  grading_pending: "border-gold/40 bg-gold/[0.06]",
  not_submitted: "border-white/10 bg-white/[0.03]",
  recording_missing: "border-white/10 bg-white/[0.03]",
};

/* «١ بندٌ» و«٢ بندان» و«٣ بنود» و«١١ بندا» — والبنودُ مختلفةُ الأجناس
   (جلسةٌ وحضورٌ وتقييم)، فالجامعُ بينها «بند» لا اسمُ أحدها. */
const ITEM_FORMS = { one: "بندٌ", two: "بندان", few: "بنود", many: "بندا" };

export default function TrainerWorkQueue({ items, className = "" }: { items: QueueItem[]; className?: string }) {
  /* أعجلُها أوّلا — والقائمةُ تصل مرتَّبةً بالإلحاح، فأوّلُها هو المقصود */
  const first = items[0];
  return (
    /* والقسمُ يسمّيه رأسُه لا عنوانٌ فوقه: كان «ما ينتظرك الآن» عنوانا ثمّ
       صارت الجملةُ تقولها بعددها، وعنوانان بالمعنى نفسِه فوق بعضهما حشو.
       فالاسمُ لقارئ الشاشة في `aria-label`، والمرئيُّ هو الجملة. */
    <section
      aria-label="ما ينتظرك الآن"
      className={`rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 ${className}`.trim()}
    >
      {/* ── العملُ قبل العنوان ──

          كان عنوانا («ما ينتظرك الآن») ولصيقةَ عددٍ فوق قائمةٍ متساويةِ
          الوزن: بنودٌ بلا أوّل. فصار العددُ جملةً وأعجلُ البنود مُسمًّى
          تحتها، وللزرِّ وجهةٌ واحدة — كما صار في لوحة الإدارة.

          والوجهةُ الخارجيّةُ تُفتح في لسانٍ جديدٍ لا بـ`Link`: رابطُ
          الاجتماع يخرج من المنصّة، و`Link` يحاول مطابقتَه بمسارٍ داخليّ. */}
      <WorkHeader
        icon={ListChecks}
        count={items.length}
        forms={ITEM_FORMS}
        waitingAr="تنتظرك الآن"
        stats={first ? [`أعجلُها: ${first.titleAr}`] : []}
        actionAr={first?.actionAr ?? "ابدأ"}
        {...(first && !first.external
          ? { to: first.href }
          : { onAction: () => { if (first) window.open(first.href, "_blank", "noreferrer") } })}
        doneAr="لا شيءَ ينتظرك الآن — الحضورُ مسجَّلٌ والتسليماتُ مقيَّمةٌ ولا جلسةَ قريبة. ويظهر هنا كلُّ ما يحتاج إجراءً منك فورَ حدوثه."
      />

      {items.length === 0 ? null : (
        <>
        <p className="text-read text-muted-foreground">مرتّبة بالإلحاح — لكل سطر إجراء واحد</p>
        <ul className="mt-3 space-y-2.5">
          {items.map((it, i) => {
            const Icon = ICON[it.kind];
            const cta = (
              <>
                {it.actionAr}
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </>
            );
            return (
              <li
                key={`${it.kind}-${i}`}
                className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${TONE[it.kind]}`}
              >
                <Icon className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-read font-bold leading-5">{it.titleAr}</p>
                  <p className="mt-0.5 truncate text-read text-muted-foreground">{it.detailAr}</p>
                </div>
                {it.external ? (
                  <a
                    href={it.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-teal px-4 text-xs font-black text-on-teal transition hover:bg-teal-light"
                  >
                    {cta}
                  </a>
                ) : (
                  <Link
                    to={it.href}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-4 text-xs font-bold transition hover:border-teal/60 hover:text-teal-light-ink"
                  >
                    {cta}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        </>
      )}
    </section>
  );
}
