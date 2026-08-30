/* خريطة المسار البصرية (البند ط-٢) — سكة أفقية على الشاشات الواسعة ورأسية على الجوال.
   قواعد التمثيل المطبَّقة:
   - الشكل يحمل الحالة لا اللون وحده: دائرة مملوءة بعلامة صح للمكتملة، حلقة
     بقوس تقدم للجارية، حلقة باهتة لغير المسجّلة — ومعها تسمية نصية دائما.
   - لون واحد للتعبئة (--teal-ink) يمرّ 6.13:1 على الداكن و5.91:1 على الأبيض.
   - «لم تُسجّل بعد» لا يُرسم شريط تقدم إطلاقا: غياب التسجيل ليس صفرا.
   - المشروع الختامي عقدة نهائية مميّزة الشكل (كأس) لا مجرد دورة أخرى. */

import { Link } from "react-router";
import { Check, Trophy } from "lucide-react";
import { NODE_LABEL_AR, type CourseNode, type PathwayMapModel } from "@/application/student/pathway-map";

function NodeDot({ node, isCurrent }: { node: CourseNode; isCurrent: boolean }) {
  const done = node.state === "completed";
  const active = node.state === "in_progress";
  return (
    <span
      aria-hidden="true"
      className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-[11px] font-black transition ${
        done
          ? "border-teal-ink bg-teal-ink text-on-teal"
          : active
            ? "border-teal-ink bg-surface text-teal-light-ink"
            : isCurrent
              ? "border-gold bg-surface text-gold-ink"
              : "border-white/20 bg-surface text-white/45"
      }`}
    >
      {done ? <Check className="h-4 w-4" /> : node.sequence}
    </span>
  );
}

/** بطاقة عقدة — الاسم والحالة وشريط التقدم عند وجود تسجيل فقط */
function NodeCard({ node, isCurrent, linkTo }: { node: CourseNode; isCurrent: boolean; linkTo?: string }) {
  const body = (
    <>
      <p className={`text-xs font-bold leading-5 ${node.state === "not_enrolled" ? "text-white/55" : ""}`}>{node.titleAr}</p>
      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-white/50">
        <span>{node.labelAr ?? NODE_LABEL_AR[node.state]}</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{node.hours} ساعة</span>
        {isCurrent && <span className="rounded-full border border-gold/50 px-1.5 font-bold text-gold-ink">أنت هنا</span>}
      </p>
      {node.percent !== null && node.percent > 0 && node.percent < 100 && (
        <span className="mt-1.5 flex items-center gap-1.5">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-teal-ink/15">
            <span className="block h-full rounded-full bg-teal-ink" style={{ width: `${node.percent}%` }} />
          </span>
          <span className="text-[10px] tabular-nums text-white/55">{node.percent}٪</span>
        </span>
      )}
    </>
  );
  const cls = "block min-w-0 rounded-2xl border px-3 py-2 transition " +
    (node.state === "not_enrolled" ? "border-white/8 bg-white/[0.02]" : "border-white/10 bg-white/[0.03]");
  return linkTo ? (
    <Link to={linkTo} className={`${cls} hover:border-teal/50`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default function PathwayMap({
  map,
  courseLinkBase,
  className = "",
}: {
  map: PathwayMapModel;
  /** أساس رابط الدورة، مثل "/student/course" — بدونه لا روابط */
  courseLinkBase?: string;
  className?: string;
}) {
  const { nodes, currentIndex, completedCount, totalCount, capstoneAr, doneHours, totalHours } = map;
  const positionAr =
    currentIndex === -1
      ? "أكملت المسار"
      : `الدورة ${currentIndex + 1} من ${totalCount}`;

  return (
    <section
      aria-label="خريطة المسار"
      className={`rounded-3xl border border-teal/30 bg-teal-ink/[0.06] p-5 sm:p-6 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-white/60">أين أنت من رحلتك</p>
          <p className="mt-1 text-2xl font-black leading-none text-teal-light-ink">{positionAr}</p>
        </div>
        <dl className="flex gap-5 text-center">
          <div>
            <dd className="text-xl font-black tabular-nums">{completedCount}</dd>
            <dt className="mt-0.5 text-[10px] text-white/55">مكتملة</dt>
          </div>
          <div>
            <dd className="text-xl font-black tabular-nums">{totalCount - completedCount}</dd>
            <dt className="mt-0.5 text-[10px] text-white/55">باقية</dt>
          </div>
          <div>
            <dd className="text-xl font-black tabular-nums">{doneHours}</dd>
            <dt className="mt-0.5 text-[10px] text-white/55">من {totalHours} ساعة</dt>
          </div>
        </dl>
      </div>

      {/* السكة: رأسية على الجوال وأفقية من sm — الخط زخرفي والحالة في النص */}
      <ol className="mt-5 grid gap-3 sm:grid-flow-col sm:auto-cols-fr sm:gap-2">
        {nodes.map((n, i) => (
          <li key={n.id} className="relative flex items-start gap-3 sm:flex-col sm:items-stretch sm:gap-2">
            <div className="relative flex shrink-0 items-center sm:justify-start">
              <NodeDot node={n} isCurrent={i === currentIndex} />
              {i < nodes.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-9 right-4 h-[calc(100%+0.75rem)] w-0.5 sm:right-9 sm:top-4 sm:h-0.5 sm:w-[calc(100%+0.5rem)] ${
                    n.state === "completed" ? "bg-teal-ink/60" : "bg-white/15"
                  }`}
                />
              )}
            </div>
            <NodeCard node={n} isCurrent={i === currentIndex} linkTo={courseLinkBase ? `${courseLinkBase}/${n.id}` : undefined} />
          </li>
        ))}
      </ol>

      {/* المشروع خارج السكّة لا محطّةً عليها.

          كان آخر عنصرٍ في <ol> فيُقرأ خطوةً تالية تُقطع كالدورات — بينما هو
          مهمّةٌ إضافية بعد المسار، لا تُعدّ في «الدورة ن من م» ولا في ساعاته.
          فأُخرج من القائمة إلى كتلةٍ تحتها مفصولةٍ بحدّ، تقول ذلك صراحة. */}
      {capstoneAr && (
        <div className="mt-5 flex items-start gap-3 border-t border-dashed border-white/15 pt-4">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-gold/60 bg-surface text-gold-ink"
          >
            <Trophy className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs font-bold leading-5 text-gold-ink">
              مشروع التخرج
              <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-black text-gold-ink/90">
                إضافيّ — خارج دورات المسار
              </span>
            </p>
            <p className="mt-1 text-[10px] leading-4 text-white/55">{capstoneAr}</p>
          </div>
        </div>
      )}
    </section>
  );
}
