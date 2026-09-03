/* شريطُ المسار — المراحلُ في أعلى الصفحة، وعملُ المرحلة أسفلَها.

   بكلام صاحب المنصّة: «اجعل صفحة التعلم له جميلة ومبنية على مراحل ينجزها
   وينتقل لما بعده… كشريطٍ للمسار أعلاه، وعند النقر على المرحلة التي هو فيها
   يظهر أسفلها ما يجب أن يظهر له».

   وثلاثةُ قراراتٍ في هذا الشريط:

   ١) **النقرُ يختار لا ينقل.** كانت كلُّ محطّةٍ رابطا إلى صفحةٍ أخرى، فيخرج
      المتعلّم من سياق رحلته ليعود إليه. هنا المرحلةُ تُنتقى والعملُ يُفتح
      تحتها في المكان نفسِه.

   ٢) **الشكلُ يحمل الحالة لا اللونُ وحده**: صحٌّ للمنجَزة، وقوسُ تقدّمٍ
      للجارية، وقفلٌ باهتٌ لما لا يملكه — ومعها تسميةٌ نصّيّة دائما، فمن لا
      يفرّق الألوان يقرأ الحالة.

   ٣) **المشروعُ الختاميّ عقدةٌ نهائيّةٌ مميّزةُ الشكل** (كأس) لا دورةً أخرى:
      هو بعد المسار لا مرحلةٌ فيه، فلا يُعدّ في «المرحلة ن من م». */

import { Check, Lock, Trophy } from "lucide-react";
import { STAGE_LABEL_AR, type JourneyStage, type JourneyTrack } from "@/application/student/journey";

export const CAPSTONE_ID = "__capstone__";

/** رقمُ المرحلة يُحسب في الشريط لا في النموذج: هو موضعٌ في العرض لا صفةٌ للدورة */
type WithSeq = JourneyStage & { sequenceLabel: number };

function Dot({ stage, selected }: { stage: WithSeq; selected: boolean }) {
  const done = stage.state === "completed";
  const open = stage.state === "in_progress" || stage.state === "enrolled";
  return (
    <span
      aria-hidden="true"
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-[11px] font-black transition ${
        done
          ? "border-teal-ink bg-teal-ink text-on-teal"
          : open
            ? `border-teal-ink text-teal-light-ink ${selected ? "bg-teal/20" : "bg-surface"}`
            : "border-white/20 bg-surface text-white/40"
      }`}
    >
      {done ? <Check className="h-4 w-4" /> : open ? stage.sequenceLabel : <Lock className="h-3 w-3" />}
    </span>
  );
}

export default function StageRail({
  track,
  selectedId,
  onSelect,
}: {
  track: JourneyTrack;
  /** معرّفُ الدورة المختارة، أو `CAPSTONE_ID` للمشروع الختاميّ */
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const stages: WithSeq[] = track.stages.map((s, i) => ({ ...s, sequenceLabel: i + 1 }));
  const { currentIndex, counts, hours, capstoneAr } = track;
  const donePct = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;

  return (
    <section aria-label="شريط مسارك" className="rounded-3xl border border-teal/25 bg-teal-ink/[0.05] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[11px] text-white/55">أين أنت من رحلتك</p>
          <p className="mt-0.5 text-lg font-black leading-tight text-teal-light-ink">
            {currentIndex === -1
              ? "أنجزت مراحلك كلها"
              : `المرحلة ${currentIndex + 1} من ${counts.total}`}
          </p>
        </div>
        <dl className="flex gap-4 text-center">
          <div>
            <dd className="text-base font-black tabular-nums">{counts.completed}</dd>
            <dt className="text-micro text-white/50">أنجزتها</dt>
          </div>
          <div>
            <dd className="text-base font-black tabular-nums">{counts.owned - counts.completed}</dd>
            <dt className="text-micro text-white/50">تعمل فيها</dt>
          </div>
          {hours.total > 0 && (
            <div>
              <dd className="text-base font-black tabular-nums">{hours.done}</dd>
              <dt className="text-micro text-white/50">من {hours.total} ساعة</dt>
            </div>
          )}
        </dl>
      </div>

      {/* السكّةُ نفسُها: قضيبٌ يحمل ما أُنجز، والمراحلُ عليه أزرارٌ تُنتقى.
          والقضيبُ زخرفةٌ — النسبةُ مكتوبةٌ فوقه في العدّادات. */}
      <div aria-hidden="true" className="relative mt-4 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="absolute inset-y-0 right-0 rounded-full bg-teal-ink transition-all" style={{ width: `${donePct}%` }} />
      </div>

      <ol className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {stages.map((s, i) => {
          const selected = selectedId === s.courseId;
          const isCurrent = i === currentIndex;
          return (
            <li key={s.courseId} className="min-w-[10rem] flex-1 shrink-0 snap-start">
              <button
                type="button"
                onClick={() => onSelect(s.courseId)}
                aria-current={selected ? "step" : undefined}
                className={`flex h-full w-full cursor-pointer items-start gap-2.5 rounded-2xl border p-2.5 text-right transition ${
                  selected
                    ? "border-teal bg-teal/[0.12]"
                    : "border-white/10 bg-white/[0.03] hover:border-teal/40 hover:bg-teal/[0.05]"
                }`}
              >
                <Dot stage={s} selected={selected} />
                <span className="min-w-0 flex-1">
                  {/* سطران لا سطرٌ مقصوص: عناوينُ الدورات جملٌ كاملة، و`truncate`
                      كان يُخرج «دورة التخطيط لل…» فلا يُعرف أيُّ مرحلةٍ هي. */}
                  <span className={`block text-[11.5px] font-bold leading-[1.3] line-clamp-2 ${s.state === "not_owned" ? "text-white/50" : ""}`}>
                    {s.titleAr}
                  </span>
                  <span className="mt-1 block text-micro leading-4 text-white/45">{STAGE_LABEL_AR[s.state]}</span>
                  {isCurrent && (
                    <span className="mt-1 inline-block rounded-full border border-gold/50 px-1.5 text-micro font-black text-gold-ink">
                      أنت هنا
                    </span>
                  )}
                  {/* شريطُ التقدّم لمن له تسجيلٌ فقط: غيابُ التسجيل ليس صفرا */}
                  {s.percent !== null && s.percent > 0 && s.percent < 100 && (
                    <span className="mt-1.5 flex items-center gap-1.5">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-teal-ink/15">
                        <span className="block h-full rounded-full bg-teal-ink" style={{ width: `${s.percent}%` }} />
                      </span>
                      <span className="text-micro tabular-nums text-white/50">{s.percent}٪</span>
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}

        {/* المشروعُ الختاميّ — آخرُ الشريط وشكلُه مختلف: نهايةٌ لا مرحلة */}
        {capstoneAr && (
          <li className="min-w-[10rem] flex-1 shrink-0 snap-start">
            <button
              type="button"
              onClick={() => onSelect(CAPSTONE_ID)}
              aria-current={selectedId === CAPSTONE_ID ? "step" : undefined}
              className={`flex h-full w-full cursor-pointer items-start gap-2.5 rounded-2xl border border-dashed p-2.5 text-right transition ${
                selectedId === CAPSTONE_ID
                  ? "border-gold bg-gold/[0.12]"
                  : "border-gold/40 bg-gold/[0.04] hover:border-gold/70 hover:bg-gold/[0.08]"
              }`}
            >
              <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-gold/60 bg-surface text-gold-ink">
                <Trophy className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11.5px] font-bold leading-4 text-gold-ink">مشروع التخرج</span>
                <span className="mt-1 block text-micro leading-4 text-white/45">نهاية المسار · وشهادته</span>
              </span>
            </button>
          </li>
        )}
      </ol>
    </section>
  );
}
