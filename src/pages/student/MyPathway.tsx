import { useState } from "react";
import { Link } from "react-router";
import {
  Lock, PlayCircle, CheckCircle2, AlertTriangle, Trophy, RefreshCcw, Loader2,
  BookOpen, ChevronLeft, MessageCircle,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import PathwayMap from "@/components/PathwayMap";
import { usePublishedContent } from "@/services/public-content";
import { buildPathwayMap, type EnrollmentFact } from "@/application/student/pathway-map";
import { getEnrollment } from "@/services/access";
import { pathwayById, pathways } from "@/data/pathways";
import { courseById, pathwayCourses, courseTrainer, coursePriceOf } from "@/data/courses";
import { loadPortal, courseGate, coursePercent, projectConditions, type CourseStatus } from "@/data/student";
import { formatPrice } from "@/services/currency";

const STATUS_META: Record<CourseStatus, { label: string; cls: string; icon: typeof Lock }> = {
  locked: { label: "مقفلة", cls: "border-white/10 text-white/55", icon: Lock },
  available: { label: "متاحة — ابدأ", cls: "border-teal/40 text-teal-light-ink", icon: PlayCircle },
  in_progress: { label: "قيد التنفيذ", cls: "border-teal/40 text-teal-light-ink", icon: PlayCircle },
  needs_action: { label: "تحتاج إجراء", cls: "border-gold/50 text-gold-ink", icon: AlertTriangle },
  completed: { label: "مكتملة", cls: "border-teal/60 text-teal-ink", icon: CheckCircle2 },
};

import AdvisorContact from "@/components/AdvisorContact";
import SimulationNote from "@/components/SimulationNote";

/* ⚠ الكتالوج يُثبَّت كسولا (ع-١): قبل تثبيته تكون pathways فارغة، وكان
   `pathways[0].id` يرمي TypeError فتظهر الصفحة سوداء فارغة. فنبوّب الجسم
   خلف حالة تحميل، ونعيد تركيبه بمفتاح نسخة الكتالوج حتى لا تبقى حالة
   المحاكاة مبنيّة على مسار خاطئ اختير قبل وصول البيانات. */
export default function MyPathway() {
  const catalogVersion = usePublishedContent();
  if (pathways.length === 0) {
    return (
      <PortalLayout title="مساري">
        <div className="grid place-items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="جارٍ تحميل الكتالوج" />
        </div>
      </PortalLayout>
    );
  }
  return <MyPathwayBody key={catalogVersion} />;
}

function MyPathwayBody() {
  const enrollment = getEnrollment();
  const pathwayId = enrollment?.pathwayId ?? pathways.find((p) => (pathwayCourses[p.id] ?? []).length >= 4)?.id ?? pathways[0].id;
  const pathway = pathwayById(pathwayId);
  const [state] = useState(() => loadPortal(pathwayId));
  const ids = pathwayCourses[pathwayId] ?? [];
  const conditions = projectConditions(pathwayId, state);
  /* وقائع التقدم من حالة المحاكاة المحلية — نفس المكوّن يخدم البيانات الحقيقية في اللوحة */
  /* بلا useMemo: مُصرِّف React يتولى التذكير، وتذكير يدوي لا يستطيع الحفاظ عليه
     يُسقط تحسين المكوّن كله. والحساب رخيص — خمس دورات لا أكثر. */
  const map = (() => {
    const facts: EnrollmentFact[] = ids.map((id) => {
      const c = courseById(id);
      const gate = courseGate(pathwayId, id, state);
      const pct = c ? coursePercent(c, state.courses[id] ?? { lessons: {}, quiz: { attempts: 0, best: 0, passed: false }, assignment: { status: "none" }, attendance: null, bookQuiz: {} }) : 0;
      /* المحاكاة لا تعرف «تسجيلا» بل بوابة فتح — فنمرّر enrolled بحسب انفتاحها،
         ونمرّر تسميتها الخاصة («مقفلة»/«متاحة — ابدأ») كي لا تختلف الخريطة عن القائمة أسفلها */
      const open = gate.status !== "locked";
      return {
        courseId: id,
        enrolled: open && (pct > 0 || gate.status === "completed" || gate.status === "in_progress"),
        percent: open ? pct : null,
        completed: gate.status === "completed",
        labelAr: STATUS_META[gate.status].label,
      };
    });
    return buildPathwayMap(pathwayId, facts);
  })();
  const metCount = conditions.filter((c) => c.met).length;
  const reviewMsg = `مرحبا، أنا طالب مسار «${pathway?.name}» وأريد مراجعة مساري (تبديل/إضافة دورة).`;

  return (
    <PortalLayout title={`مساري — ${pathway?.name}`}>
      <SimulationNote what="تفاصيل المسار" />
      {/* ترويسة المسار */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-white/45">بدأ في {new Date(state.startedAt).toLocaleDateString("ar-SA")} · الإصدار 1.0</p>
            <h2 className="mt-1 text-lg font-black">ماذا ستتقن في نهاية هذا المسار؟</h2>
            <p className="mt-1 max-w-2xl text-sm leading-7 text-white/60">{pathway?.output}</p>
          </div>
          <AdvisorContact
            text={reviewMsg}
            label="مراجعة مساري"
            icon={<RefreshCcw className="h-4 w-4" />}
            className="flex items-center gap-2 rounded-full border border-gold/40 px-5 py-2.5 text-sm font-bold text-gold-ink transition hover:bg-gold/10"
          />
        </div>
        <p className="mt-3 text-[11px] text-white/55">
          التبديل لا يتم عشوائيا — تطلب مراجعة مع مستشارك يفحص الأهلية والتكافؤ ثم يُنفذ بأثر موثق.
        </p>
      </section>

      {/* خريطة المسار البصرية (ط-٢) — «أين أنا؟» قبل تفاصيل كل دورة */}
      {map && <PathwayMap map={map} courseLinkBase="/student/course" className="mt-6" />}

      {/* تفاصيل الدورات */}
      <section className="mt-6 space-y-3">
        {ids.map((id, i) => {
          const c = courseById(id);
          if (!c) return null;
          const gate = courseGate(pathwayId, id, state);
          const meta = STATUS_META[gate.status];
          const pct = coursePercent(c, state.courses[id] ?? { lessons: {}, quiz: { attempts: 0, best: 0, passed: false }, assignment: { status: "none" }, attendance: null, bookQuiz: {} });
          const trainer = courseTrainer(c);
          const openable = gate.status !== "locked";
          return (
            <div
              key={id}
              className={`flex flex-wrap items-center gap-4 rounded-3xl border p-5 transition ${meta.cls} ${openable ? "bg-white/[0.03] hover:border-teal/60" : "bg-white/[0.01]"}`}
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-black ${gate.status === "completed" ? "bg-teal text-on-teal" : "bg-white/5"}`}>
                {gate.status === "completed" ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-black ${gate.status === "locked" ? "text-white/50" : ""}`}>{c.name}</p>
                <p className="mt-0.5 text-xs text-white/45">
                  {c.weeks} {c.weeks === 1 ? "أسبوع" : "أسابيع"} · المدرب: {trainer.name} · {c.skill}
                </p>
                {/* قاعدة الفتح — US-05 */}
                {gate.status === "locked" && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/50">
                    <Lock className="h-3 w-3" /> {gate.lockReason}
                  </p>
                )}
                {openable && pct > 0 && pct < 100 && (
                  <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${meta.cls}`}>{meta.label}</span>
                {openable ? (
                  <Link
                    to={`/student/course/${id}`}
                    className="flex items-center gap-1 rounded-full bg-teal px-4 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light"
                  >
                    افتح الدورة <ChevronLeft className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="text-[11px] text-white/55">{gate.unlockHint}</span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* مشروع التخرج — ظاهر منذ البداية، لا يفتح قبل الشروط */}
      <section className="mt-8 rounded-3xl border border-[#FABC05]/30 bg-gradient-to-b from-warmglow/40 to-transparent p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-gold-ink">
              <Trophy className="h-6 w-6" />
            </span>
            <div>
              <h3 className="font-black">مشروع التخرج</h3>
              <p className="text-xs text-white/50">
                {state.project.status === "not_open"
                  ? `مقفل — تحققت ${metCount} من ${conditions.length} شروط`
                  : "مفتوح — التسليم متاح الآن"}
              </p>
            </div>
          </div>
          <Link
            to="/student/project"
            className={`rounded-full px-5 py-2.5 text-sm font-black transition ${
              state.project.status === "not_open"
                ? "cursor-not-allowed border border-white/10 text-white/55"
                : "bg-gold text-on-gold hover:bg-gold/90"
            }`}
          >
            {state.project.status === "not_open" ? "شروط الفتح" : "افتح المشروع"}
          </Link>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {conditions.map((c) => (
            <p key={c.label} className={`flex items-center gap-2 text-xs ${c.met ? "text-teal-light-ink" : "text-white/50"}`}>
              {c.met ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {c.label}
            </p>
          ))}
        </div>
      </section>

      {/* دورات إضافية مقترحة خارج المسار */}
      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-white/70">
          <BookOpen className="h-4 w-4 text-teal-light-ink" /> مقترحة خارج مسارك — تُسعّر منفصلة بشفافية
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(pathways.find((p) => p.id !== pathwayId && (pathwayCourses[p.id] ?? []).length >= 2)
            ? (pathwayCourses[pathways.find((p) => p.id !== pathwayId && (pathwayCourses[p.id] ?? []).length >= 2)!.id] ?? [])
            : []
          ).slice(0, 2).map((cid) => {
            const c = courseById(cid);
            return c ? (
              <div key={cid} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div>
                  <p className="text-sm font-bold">{c.name}</p>
                  <p className="mt-0.5 text-[11px] text-white/45">{c.weeks} أسابيع · {formatPrice(coursePriceOf(c))} منفردة</p>
                </div>
                <AdvisorContact
                  text={`أريد إضافة دورة «${c.name}» لمساري`}
                  label="أضفها عبر مستشارك"
                  icon={<MessageCircle className="h-3 w-3" />}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white/70 transition hover:border-[#25D366] hover:text-[#25D366]"
                />
              </div>
            ) : null;
          })}
        </div>
      </section>
    </PortalLayout>
  );
}
