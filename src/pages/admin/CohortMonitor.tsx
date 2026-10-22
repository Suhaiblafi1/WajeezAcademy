/* «المتابعة» و«المتعلمون» — الإدارةُ تقرأ ما يجري في الشعبة ولا تديره (٢٢ أكتوبر ٢٠٢٦).

   «نحن يجب أن يكون لنا وصولٌ لمجريات العمل لديه كتقارير من حضر ومن سلّم ومشاريع التخرّج والباقي
   تلقائيّ، ورسائلُه للطلاب، وكأنّنا مراقبون لكلّ مجريات الشعبة ومطّلعون على تفاصيلها بطريقةٍ واضحةٍ
   غير مزدحمة» (صاحب المنصّة).

   فلا نموذجَ هنا ولا زرّ يكتب: تقريرٌ واحدٌ من الخادم (`cohort-monitor.service.ts`) يُعرض في لسانين.
   والترتيبُ ترتيبُ السؤال: ما يستدعي يدا أوّلا، ثمّ الأرقام، ثمّ مشروعُ التخرّج، ثمّ الحضور، ثمّ
   المهامّ، ثمّ الرسائل. والتفصيلُ (أسماءُ الغائبين ومن لم يسلّم) مطويٌّ تحت سطره — يُفتح حين يُسأل. */

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarCheck, ClipboardList, GraduationCap, Loader2, MessageSquare } from "lucide-react";
import { apiGet } from "@/services/api";
import { Inset } from "@/components/ui/Surface";
import { fmtDateAr, fmtShortDateTimeAr } from "@/utils/format";
import { AUDIENCE_AR } from "@/application/learning/cohort-monitor";

interface Report {
  counts: { learners: number; sessionsHeld: number; sessionsTotal: number; attendancePct: number | null; tasks: number; waitingReview: number; messages: number };
  alerts: string[];
  sessions: { id: string; title: string; startsAt: string; marked: boolean; present: number; late: number; absent: number; excused: number; absentNames: string[] }[];
  upcoming: { id: string; title: string; startsAt: string }[];
  tasks: { id: string; title: string; type: string; isProject: boolean; dueAt: string | null; overdue: boolean; submitted: number; accepted: number; waiting: number; total: number; missingNames: string[] }[];
  learners: { enrollmentId: string; name: string; status: string; attended: number; held: number; attendancePct: number | null; tasksDone: number; tasksTotal: number; progressPct: number; certified: boolean }[];
  messages: { id: string; at: string; audience: string; body: string; recipients: number; author: string; byTrainer: boolean; toName: string | null }[];
}

const TYPE_AR: Record<string, string> = { assignment: "واجب", quiz: "اختبار", project: "مشروع" };
const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

function useReport(cohortId: string, refresh?: string) {
  const [r, setR] = useState<Report | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    apiGet<Report>(`/api/admin/cohorts/${cohortId}/monitor`)
      .then((x) => { if (alive) { setR(x); setErr(""); } })
      .catch(() => { if (alive) setErr("تعذر تحميل المتابعة"); });
    return () => { alive = false; };
  }, [cohortId, refresh]);
  return { r, err };
}

function Heading({ icon: Icon, children }: { icon: typeof CalendarCheck; children: React.ReactNode }) {
  return <h3 className="mb-2 flex items-center gap-1.5 text-read font-black text-foreground"><Icon className="h-3.5 w-3.5 text-teal-ink" />{children}</h3>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-fine text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-black">{value}</dd>
    </div>
  );
}

/** تفصيلٌ مطويٌّ تحت سطره — الأسماءُ حين تُسأل */
function Names({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-fine text-muted-foreground">{label} ({names.length})</summary>
      <p className="mt-1 text-read leading-6">{names.join("، ")}</p>
    </details>
  );
}

function TaskRow({ t }: { t: Report["tasks"][number] }) {
  return (
    <li className="border-b border-white/8 py-2 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-read font-bold">{t.title} <span className="font-normal text-muted-foreground">· {TYPE_AR[t.type] ?? t.type}{t.dueAt ? ` · موعده ${fmtDateAr(t.dueAt)}` : ""}</span></p>
        <p className="text-read text-muted-foreground">
          سلم <b className="text-foreground">{t.submitted}/{t.total}</b> · قبل {t.accepted}
          {t.waiting > 0 && <> · <span className="text-gold-ink">ينتظر التصحيح {t.waiting}</span></>}
        </p>
      </div>
      <Names label={t.overdue ? "لم يسلم ومضى الموعد" : "لم يسلم بعد"} names={t.missingNames} />
    </li>
  );
}

export function CohortMonitor({ cohortId, refresh }: { cohortId: string; refresh?: string }) {
  const { r, err } = useReport(cohortId, refresh);
  if (err) return <p className="text-read text-muted-foreground">{err}</p>;
  if (!r) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />;

  const projects = r.tasks.filter((t) => t.isProject);
  const others = r.tasks.filter((t) => !t.isProject);

  return (
    <div className="space-y-5">
      {r.alerts.length > 0 ? (
        <Inset tone="warn" className="px-4 py-3">
          <p className="flex items-center gap-1.5 text-read font-black text-gold-ink"><AlertTriangle className="h-3.5 w-3.5" /> يحتاج نظرتك</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pr-5 text-read leading-6">
            {r.alerts.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </Inset>
      ) : r.counts.sessionsHeld > 0 && (
        <p className="text-read text-teal-light-ink">لا شيء يحتاج نظرتك الآن.</p>
      )}

      <dl className="grid gap-3 sm:grid-cols-4">
        <Stat label="المتعلمون" value={String(r.counts.learners)} />
        <Stat label="اللقاءات" value={`${r.counts.sessionsHeld} من ${r.counts.sessionsTotal}`} />
        <Stat label="الحضور" value={pct(r.counts.attendancePct)} />
        <Stat label="ينتظر التصحيح" value={String(r.counts.waitingReview)} />
      </dl>

      <section>
        <Heading icon={GraduationCap}>مشروع التخرج</Heading>
        {projects.length === 0
          ? <p className="text-read text-muted-foreground">لا مشروع في خطة هذه الشعبة.</p>
          : <ul>{projects.map((t) => <TaskRow key={t.id} t={t} />)}</ul>}
      </section>

      <section>
        <Heading icon={CalendarCheck}>الحضور</Heading>
        {r.sessions.length === 0 ? (
          <p className="text-read text-muted-foreground">
            لم يعقد لقاء بعد.{r.upcoming[0] ? ` أول لقاء ${fmtShortDateTimeAr(r.upcoming[0].startsAt)}.` : ""}
          </p>
        ) : (
          <ul>
            {[...r.sessions].reverse().map((s) => (
              <li key={s.id} className="border-b border-white/8 py-2 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-read font-bold">{s.title} <span className="font-normal text-muted-foreground">· {fmtShortDateTimeAr(s.startsAt)}</span></p>
                  {s.marked ? (
                    <p className="text-read text-muted-foreground">
                      حضر <b className="text-foreground">{s.present + s.late}</b>{s.late > 0 ? ` (متأخر ${s.late})` : ""}
                      {" · "}غاب {s.absentNames.length}{s.excused > 0 ? ` · بعذر ${s.excused}` : ""}
                    </p>
                  ) : <p className="text-read text-gold-ink">لم يسجل الحضور</p>}
                </div>
                <Names label="الغائبون" names={s.absentNames} />
              </li>
            ))}
          </ul>
        )}
        {r.upcoming.length > 0 && r.sessions.length > 0 && (
          <p className="mt-2 text-read text-muted-foreground">القادم: {r.upcoming.map((u) => `${u.title} (${fmtShortDateTimeAr(u.startsAt)})`).join(" · ")}</p>
        )}
      </section>

      <section>
        <Heading icon={ClipboardList}>المهام والتسليمات</Heading>
        {others.length === 0
          ? <p className="text-read text-muted-foreground">لا مهام منشورة بعد.</p>
          : <ul>{others.map((t) => <TaskRow key={t.id} t={t} />)}</ul>}
      </section>

      <section>
        <Heading icon={MessageSquare}>رسائل المدرب للطلاب</Heading>
        {r.messages.length === 0 ? (
          <p className="text-read text-muted-foreground">لم ترسل رسالة بعد.</p>
        ) : (
          <ul className="space-y-2">
            {r.messages.map((m) => (
              <li key={m.id}>
                <Inset className="px-3 py-2">
                  <p className="text-fine text-muted-foreground">
                    {fmtShortDateTimeAr(m.at)} · {m.author}{m.byTrainer ? "" : " (ليس المدرب)"} · {m.toName ? `إلى ${m.toName}` : AUDIENCE_AR[m.audience] ?? m.audience}
                    {m.recipients > 1 ? ` · وصلت ${m.recipients}` : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-read leading-6">{m.body}</p>
                </Inset>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const STATUS_AR: Record<string, string> = { enrolled: "مسجل", completed: "أنهى", dropped: "أسقط" };

/** جدولُ المتعلّمين — من فيها وأين وصل كلٌّ */
export function CohortLearners({ cohortId, refresh }: { cohortId: string; refresh?: string }) {
  const { r, err } = useReport(cohortId, refresh);
  if (err) return <p className="text-read text-muted-foreground">{err}</p>;
  if (!r) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />;
  if (r.learners.length === 0) return <p className="text-read text-muted-foreground">لا متعلمين بعد.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-right text-read">
        <thead className="text-fine text-muted-foreground">
          <tr>
            <th className="py-1.5 font-bold">المتعلم</th>
            <th className="py-1.5 font-bold">الحضور</th>
            <th className="py-1.5 font-bold">المهام</th>
            <th className="py-1.5 font-bold">التقدم</th>
            <th className="py-1.5 font-bold">الشهادة</th>
          </tr>
        </thead>
        <tbody>
          {r.learners.map((l) => (
            <tr key={l.enrollmentId} className={`border-t border-white/8 ${l.status === "dropped" ? "text-muted-foreground" : ""}`}>
              <td className="py-1.5">{l.name}{l.status !== "enrolled" ? <span className="text-fine text-muted-foreground"> · {STATUS_AR[l.status] ?? l.status}</span> : null}</td>
              <td className="py-1.5">{pct(l.attendancePct)}{l.held > 0 ? <span className="text-fine text-muted-foreground"> ({l.attended}/{l.held})</span> : null}</td>
              <td className="py-1.5">{l.tasksDone}/{l.tasksTotal}</td>
              <td className="py-1.5">{l.progressPct}%</td>
              <td className="py-1.5">{l.certified ? "صدرت" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
