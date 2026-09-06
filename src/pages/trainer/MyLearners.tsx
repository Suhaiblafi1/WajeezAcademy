/* متعلّموني — «كيف حالُ كلِّ طالبٍ عندي؟» لا «جدولُ حسابات» (البند ٢٣).

   ─────────── ما كان ───────────

   كانت هذه الشاشةُ **حرفيّا مكوّنَ الإدارة نفسَه**: `LearnersPanel` الذي
   تفتحه الإدارةُ والمستشار. والتقييدُ من الخادم صحيحٌ ولا تسريبَ فيه —
   المدرّبُ يقرأ طلبةَ شعبه وحدَهم. لكنّه يقرؤهم **بشكلٍ إداريّ**: صفٌّ
   لكلّ حساب، بحالةِ التسجيل وبريدِه وتاريخِ إنشائه.

   وليس هذا سؤالَ المدرّب. سؤالُه: **من تعثّر؟ من غاب؟ من لم يسلّم؟**

   ─────────── وما صار ───────────

   الصفُّ الواحدُ يحمل ثلاثةَ أرقامٍ يقرؤها المدرّبُ في ثانية — التقدّم،
   والحضور، وما لم يُسلَّم — والترتيبُ **بمن يحتاجه أوّلا** لا بالأبجديّة
   ولا بتاريخ التسجيل.

   والمصدرُ هو المسارُ القائم `/api/trainer/my-cohorts` نفسُه الذي يقرؤه
   لوحُ الشعب: لا مسارَ جديدٌ ولا حقلَ جديد — القراءةُ وحدَها تغيّرت.

   ── وما لا يُقاس لا يُلوَّن ──

   الحضورُ يُحسب على **الجلسات التي مضت وسُجِّل فيها حضورٌ لأحد**: شعبةٌ لم
   تبدأ بعد لا يُقال عن متعلّميها «غابوا»، ولا تُلوَّن صفوفُهم بالأحمر. */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, GraduationCap, Loader2, RefreshCw, ServerOff, Users } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import EmptyState from "@/components/EmptyState";
import { apiGet, ApiError } from "@/services/api";
import { matchesQuery } from "@/application/text/search-ar";
import { Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

interface TrainerCohort {
  cohort: {
    id: string; title: string; status: string;
    course: { versions: { titleAr: string }[] };
    sessions: { id: string; title: string; startsAt: string; status: string }[];
    enrollments: {
      id: string; userId: string; status: string;
      user: { displayName: string; email: string };
      courseProgress: { percent: number } | null;
      attendance: { sessionId: string; status: string }[];
    }[];
  };
}

interface QueueItem {
  id: string; status: string;
  enrollment: { userId: string };
}

interface Row {
  enrollmentId: string;
  /* مفتاحُ طابور التصحيح هو `userId` لا معرِّفُ التسجيل — والخلطُ بينهما
     يُظهر «٠ ينتظر تصحيحك» لمن ينتظر. */
  userId: string;
  name: string;
  email: string;
  cohortTitle: string;
  courseTitle: string;
  enrollmentStatus: string;
  progress: number;
  /* `null` = لا جلسةَ مضت بعد، فلا نسبةَ حضورٍ تُقال */
  attendedOf: { attended: number; countable: number } | null;
  /* حاجةُ الاهتمام — كلّما كبرت تقدّم الصفّ. تُشتقّ ولا تُخترع: تقدّمٌ متأخّر
     وغيابٌ متكرّر، ولا شيءَ سواهما. */
  concern: number;
  concernsAr: string[];
}

const ENROLLMENT_AR: Record<string, string> = {
  active: "مسجَّل", completed: "أتمّها", withdrawn: "انسحب", cancelled: "أُلغي", waitlisted: "قائمةُ انتظار",
};

const ABSENT = new Set(["absent", "excused"]);

function buildRows(cohorts: TrainerCohort[]): Row[] {
  const rows: Row[] = [];
  const now = Date.now();
  for (const { cohort } of cohorts) {
    const courseTitle = cohort.course.versions[0]?.titleAr ?? cohort.title;
    /* الجلساتُ التي مضت — وحدَها تُحسب في الحضور */
    const past = new Set(
      cohort.sessions.filter((s) => s.status === "done" || new Date(s.startsAt).getTime() < now).map((s) => s.id),
    );
    for (const e of cohort.enrollments) {
      const marks = e.attendance.filter((a) => past.has(a.sessionId));
      const countable = marks.length;
      const attended = marks.filter((a) => !ABSENT.has(a.status)).length;
      const progress = Math.round(e.courseProgress?.percent ?? 0);
      const concernsAr: string[] = [];
      let concern = 0;
      /* تعثّرٌ ظاهر: مضى نصفُ جلسات الشعبة وتقدّمُه دون الثلث */
      if (past.size > 0 && past.size * 2 >= cohort.sessions.length && progress < 34) {
        concern += 2;
        concernsAr.push("تقدّمُه متأخّرٌ عن سير الشعبة");
      }
      if (countable >= 2 && attended * 2 < countable) {
        concern += 2;
        concernsAr.push(`غاب ${countable - attended} من ${countable}`);
      } else if (countable > 0 && attended < countable) {
        concern += 1;
        concernsAr.push(`غاب ${countable - attended} من ${countable}`);
      }
      rows.push({
        enrollmentId: e.id,
        userId: e.userId,
        name: e.user.displayName,
        email: e.user.email,
        cohortTitle: cohort.title,
        courseTitle,
        enrollmentStatus: e.status,
        progress,
        attendedOf: countable > 0 ? { attended, countable } : null,
        concern,
        concernsAr,
      });
    }
  }
  /* من يحتاجني أوّلا: أشدُّ حاجةً، ثمّ أدنى تقدّما */
  return rows.sort((a, b) => b.concern - a.concern || a.progress - b.progress);
}

export default function TrainerMyLearners() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pending, setPending] = useState<Record<string, number>>({});
  const [offline, setOffline] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      const cohorts = await apiGet<TrainerCohort[]>("/api/trainer/my-cohorts");
      setOffline(null);
      setRows(buildRows(cohorts));
      /* ما ينتظر تصحيحي لكلّ متعلّم — نداءٌ ثانٍ، وفشلُه لا يُفرِّغ الشاشة */
      const queue = await apiGet<QueueItem[]>("/api/trainer/grading-queue").catch(() => [] as QueueItem[]);
      const byUser: Record<string, number> = {};
      for (const item of queue) byUser[item.enrollment.userId] = (byUser[item.enrollment.userId] ?? 0) + 1;
      setPending(byUser);
    } catch (err) {
      setOffline(err instanceof ApiError ? err.message : "الخادم غير متصل — هذه الصفحة تتطلب جلسة مدرب حقيقية");
    }
  }, []);

  /* استدعاء غير متزامن: لا setState يجري قبل أول await، فالتصيير
     المتتالي الذي تحذّر منه القاعدة لا يقع هنا. القاعدة لا ترى عبر
     الحدّ غير المتزامن فتَعُدّ كل دالة تنتهي بـsetState متزامنة —
     وهذا الإسكاتُ هو نفسُه المستعمَل في «مستحقاتي». */
  // eslint-disable-next-line react-hooks/set-state-in-effect -- setState بعد await لا قبله
  useEffect(() => { void load(); }, [load]);

  if (offline) {
    return (
      <TrainerLayout title="متعلّموني">
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول لمتعلّميك</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
          <Button onClick={() => void load()} icon={RefreshCw} className="mt-5">إعادة المحاولة</Button>
        </Panel>
      </TrainerLayout>
    );
  }

  if (rows === null) {
    return (
      <TrainerLayout title="متعلّموني">
        <div className="grid place-items-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" /></div>
      </TrainerLayout>
    );
  }

  const shown = rows.filter((r) => matchesQuery(q, [r.name, r.email, r.cohortTitle, r.courseTitle]));
  const needing = rows.filter((r) => r.concern > 0).length;

  return (
    <TrainerLayout title="متعلّموني">
      {rows.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          titleAr="لا متعلّمَ في شعبك بعد"
          reasonAr="ما إن يُسجَّل أحدٌ في شعبةٍ من شعبك حتّى يظهر هنا بتقدّمه وحضوره."
        />
      ) : (
        <>
          <Panel as="section">
            <h2 className="flex items-center gap-2 text-base font-black">
              <Users className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> {rows.length} متعلّما في شعبك
            </h2>
            <p className="mt-1 text-sm leading-7 text-muted-foreground">
              {needing === 0
                ? "لا أحدَ متعثّرٌ اليوم — التقدّمُ والحضورُ في مسارهما."
                : `${needing} ${needing === 1 ? "متعلّمٌ يحتاج" : "متعلّمين يحتاجون"} التفاتَك — وهم في أوّل القائمة.`}
            </p>
            <label className="relative mt-3 block max-w-sm">
              <span className="sr-only">ابحث في متعلّميك</span>
              <input
                value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسمٍ أو شعبة"
                className="w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none"
              />
            </label>
          </Panel>

          {shown.length === 0 ? (
            <Panel as="p" className="mt-5 py-12 text-center text-sm text-muted-foreground">
              لا متعلّمَ يطابق بحثك.
            </Panel>
          ) : (
            <ul className="mt-5 space-y-3">
              {shown.map((r) => {
                const waiting = pending[r.userId] ?? 0;
                return (
                  <li
                    key={r.enrollmentId}
                    className={`rounded-2xl border p-4 ${r.concern >= 2 ? "border-gold/35 bg-gold/[0.05]" : "border-white/10 bg-white/[0.02]"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black">{r.name}</p>
                        <p className="mt-0.5 text-micro text-muted-foreground">
                          {r.courseTitle} · {r.cohortTitle}
                          {r.enrollmentStatus !== "active" && ` · ${ENROLLMENT_AR[r.enrollmentStatus] ?? r.enrollmentStatus}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 text-micro font-black">
                        <span className="rounded-full bg-teal/15 px-3 py-1 text-teal-light-ink">تقدّمُه {r.progress}٪</span>
                        <span className="rounded-full border border-white/15 px-3 py-1 text-muted-foreground">
                          {r.attendedOf
                            ? `حضر ${r.attendedOf.attended} من ${r.attendedOf.countable}`
                            : "لا جلسةَ مضت بعد"}
                        </span>
                        {waiting > 0 && (
                          <span className="rounded-full bg-gold/20 px-3 py-1 text-gold-ink">
                            {waiting} ينتظر تصحيحك
                          </span>
                        )}
                      </div>
                    </div>
                    {r.concernsAr.length > 0 && (
                      <p className="mt-2.5 flex items-start gap-1.5 text-micro leading-6 text-gold-ink">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {r.concernsAr.join(" · ")}
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap gap-2 text-micro font-bold">
                      <Link to="/trainer/board" className="rounded-full border border-white/15 px-3 py-1 text-muted-foreground transition hover:border-teal/50 hover:text-foreground">
                        افتح شعبتَه وخاطبه
                      </Link>
                      {waiting > 0 && (
                        <Link to="/trainer/grading" className="rounded-full border border-gold/35 px-3 py-1 text-gold-ink transition hover:border-gold">
                          صحّح تسليماته
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </TrainerLayout>
  );
}
