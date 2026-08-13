import { useMemo } from "react";
import { Link } from "react-router";
import {
  ArrowLeft, Bell, BookOpen, CalendarDays, CheckCircle2, Clock3,
  Lightbulb, MessageCircle, Sparkles, Target, TrendingUp, Video, LifeBuoy,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import { getEnrollment, isPreview } from "@/services/access";
import { pathwayById, pathways } from "@/data/pathways";
import { courseById, pathwayCourses } from "@/data/courses";
import {
  loadPortal, nextAction, pathwayPercent, pathwaySkills, courseSessions,
  readUserName, courseGate,
} from "@/data/student";

/* مستشارو المجالات — نفس منطق صفحة المسار العامة */
const ADVISORS: Record<string, { name: string; title: string }> = {
  EMP: { name: "د. فيصل العتيبي", title: "مستشار تطوير الموظفين" },
  GOV: { name: "م. سلطان الدوسري", title: "مستشار القطاع الحكومي" },
  STU: { name: "أ. ريم القحطاني", title: "مستشارة الجاهزية المهنية" },
  BIZ: { name: "م. لينا الحربي", title: "مستشارة ريادة الأعمال" },
  LEAD: { name: "م. سلطان الدوسري", title: "مستشار القيادة" },
};
import AdvisorContact from "@/components/AdvisorContact";

export default function StudentDashboard() {
  const enrollment = getEnrollment();
  // في وضع المعاينة نعرض أول مسار غني بالدورات
  const pathwayId = enrollment?.pathwayId ?? pathways.find((p) => (pathwayCourses[p.id] ?? []).length >= 4)?.id ?? pathways[0].id;
  const pathway = pathwayById(pathwayId);
  const state = useMemo(() => loadPortal(pathwayId), [pathwayId]);
  const pct = pathwayPercent(pathwayId, state);
  const next = nextAction(pathwayId, state);
  const skills = pathwaySkills(pathwayId, state);
  const user = readUserName();

  const sessions = useMemo(() => {
    const start = new Date(state.startedAt);
    return (pathwayCourses[pathwayId] ?? [])
      .map((id) => courseById(id))
      .filter(Boolean)
      .flatMap((c) => courseSessions(c!, start))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);
  }, [pathwayId, state.startedAt]);

  const advisor = ADVISORS[pathwayId.split("-")[1]] ?? ADVISORS.EMP;
  const advisorMsg = `مرحبا ${advisor.name}، أنا ${user} طالب مسار «${pathway?.name}» وأريد استشارتك.`;
  const unread = state.notifications.filter((n) => !n.read).length;
  const completedCount = (pathwayCourses[pathwayId] ?? []).filter((id) => courseGate(pathwayId, id, state).status === "completed").length;
  const totalCourses = (pathwayCourses[pathwayId] ?? []).length;

  return (
    <PortalLayout title={`${new Date().getHours() < 12 ? "صباح الخير" : new Date().getHours() < 17 ? "طاب يومك" : "مساء الخير"} يا ${user.split(" ")[0]}`}>
      {isPreview() && (
        <p className="mb-5 rounded-xl border border-dashed border-[#FABC05]/40 bg-[#FABC05]/5 px-4 py-2 text-center text-xs text-[#FABC05]">
          وضع المعاينة التجريبية — بيانات محاكاة لمسار «{pathway?.name}»
        </p>
      )}

      {/* شريط التقدم العام */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/55">مسارك النشط</p>
            <h2 className="mt-1 text-xl font-black">{pathway?.name}</h2>
            <p className="mt-1 text-xs text-white/45">
              {completedCount} من {totalCourses} دورات مكتملة · {pathway?.weeklyHours} أسبوعيا
            </p>
          </div>
          <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke="#38A7B4" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - pct / 100)}
                className="transition-all duration-700"
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-[#6EC7D1]">{pct}%</span>
              <span className="text-[9px] text-white/40">من رحلتك</span>
            </span>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-l from-[#38A7B4] to-[#6EC7D1] transition-all" style={{ width: `${Math.max(3, pct)}%` }} />
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* التالي الآن — إجراء واحد (US-04) */}
        <section className="rounded-3xl border border-[#38A7B4]/40 bg-gradient-to-b from-[#38A7B4]/10 to-transparent p-6 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm font-bold text-[#6EC7D1]">
            <Target className="h-4 w-4" /> التالي الآن
          </div>
          <h3 className="mt-3 text-2xl font-black leading-snug">{next.label}</h3>
          <p className="mt-2 text-sm leading-7 text-white/60">{next.detail}</p>
          <Link
            to={next.courseId ? `/student/course/${next.courseId}` : "/student/project"}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#38A7B4] px-6 py-3 font-black text-[#08272B] transition hover:bg-[#6EC7D1]"
          >
            {next.cta}
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </section>

        {/* المستشار */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-white/70">
            <MessageCircle className="h-4 w-4 text-[#25D366]" /> مستشارك
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#38A7B4] to-[#247B84] text-lg font-black">
              {advisor.name.replace(/^(أ\.|د\.|م\.)\s*/, "").charAt(0)}
            </span>
            <div>
              <p className="font-black">{advisor.name}</p>
              <p className="text-xs text-[#6EC7D1]">{advisor.title}</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-6 text-white/50">آخر ملاحظة: «بداية موفقة — ركز على إنهاء دروس الدورة الأولى هذا الأسبوع.»</p>
          <AdvisorContact
            text={advisorMsg}
            label="راسل مستشارك"
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-[#25D366] py-2.5 text-sm font-black text-white hover:bg-[#25D366]/85"
          />
        </section>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* جدولي */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <CalendarDays className="h-4 w-4 text-[#FABC05]" /> جدولي — الجلسات القادمة
            </div>
            <span className="text-[11px] text-white/40">بتوقيت الرياض (GMT+3)</span>
          </div>
          <div className="mt-4 space-y-2.5">
            {sessions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${s.type === "live" ? "bg-[#FABC05]/15 text-[#FABC05]" : "bg-[#38A7B4]/15 text-[#6EC7D1]"}`}>
                    <Video className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">{s.title}</p>
                    <p className="text-[11px] text-white/45">{s.courseName} · {s.date} · {s.time}</p>
                  </div>
                </div>
                <Link
                  to={`/student/course/${s.courseId}`}
                  className="rounded-full border border-[#38A7B4]/40 px-4 py-1.5 text-xs font-bold text-[#6EC7D1] transition hover:bg-[#38A7B4] hover:text-[#08272B]"
                >
                  التفاصيل والانضمام
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* الإشعارات */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <Bell className="h-4 w-4 text-[#FABC05]" /> الإشعارات
            </div>
            {unread > 0 && <span className="rounded-full bg-[#FABC05] px-2 py-0.5 text-[10px] font-black text-[#0D0D0D]">{unread} جديد</span>}
          </div>
          <div className="mt-4 space-y-2.5">
            {state.notifications.slice(0, 4).map((n) => (
              <p key={n.id} className={`rounded-xl border px-3 py-2.5 text-xs leading-6 ${n.read ? "border-white/5 text-white/40" : "border-[#38A7B4]/25 bg-[#38A7B4]/5 text-white/75"}`}>
                {n.text}
              </p>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* مهاراتي: الحالي مقابل المستهدف */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm font-bold text-white/70">
            <TrendingUp className="h-4 w-4 text-[#6EC7D1]" /> مهاراتي — الحالي مقابل المستهدف (0–5)
          </div>
          <div className="mt-4 space-y-3">
            {skills.map((s) => (
              <div key={s.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">{s.name}</span>
                  <span className="text-white/45">{s.current} / {s.target}</span>
                </div>
                <div className="mt-1.5 flex gap-1">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <span
                      key={lvl}
                      className={`h-2 flex-1 rounded-full ${
                        lvl <= s.current ? "bg-[#38A7B4]" : lvl <= s.target ? "bg-white/10" : "bg-white/5"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-white/35">{s.evidence}</p>
              </div>
            ))}
          </div>
        </section>

        {/* التوصيات + الدعم */}
        <section className="space-y-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <Lightbulb className="h-4 w-4 text-[#FABC05]" /> توصيات لك — ولماذا
            </div>
            <div className="mt-4 space-y-3 text-xs leading-6">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="font-bold text-white/85">ملخص «التركيز العميق» الصوتي</p>
                <p className="mt-1 text-white/45">لأنك ذكرت في تشخيصك أن وقتك محدود — سمعه قبل درسك القادم.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="font-bold text-white/85">جلسة تقوية جماعية الخميس</p>
                <p className="mt-1 text-white/45">طلاب دفعتك الذين أنهوا الدرس الثاني ارتفعت درجاتهم 18%.</p>
              </div>
            </div>
          </div>
          <Link to="/student/pathway" className="block rounded-3xl border border-[#38A7B4]/30 bg-[#38A7B4]/5 p-5 transition hover:border-[#38A7B4]/60">
            <div className="flex items-center gap-2 text-sm font-bold text-[#6EC7D1]">
              <BookOpen className="h-4 w-4" /> خريطة مساري الكاملة
            </div>
            <p className="mt-2 text-xs leading-6 text-white/55">الدورات وحالاتها وقواعد الفتح ومشروع التخرج</p>
          </Link>
          <a href="mailto:support@wajeez.com" className="block rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/30">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <LifeBuoy className="h-4 w-4" /> الدعم
            </div>
            <p className="mt-2 text-xs leading-6 text-white/50">قاعدة المعرفة · تذكرة دعم · السياسات</p>
          </a>
        </section>
      </div>

      <p className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] text-white/35">
        <Sparkles className="h-3.5 w-3.5" />
        <Clock3 className="h-3.5 w-3.5" />
        تقدمك يُحفظ تلقائيا — أكمل من أي جهاز بعد الدخول
        <CheckCircle2 className="h-3.5 w-3.5 text-[#38A7B4]" />
      </p>
    </PortalLayout>
  );
}
