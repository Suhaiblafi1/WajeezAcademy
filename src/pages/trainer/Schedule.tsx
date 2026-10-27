/* «جدولي» — جلساتُ شعبي كلِّها في خطٍّ زمنيٍّ واحد (المهمّة ٧٢).

   البياناتُ موجودةٌ كاملةً منذ زمن، **ولا شاشةَ تجمعها بالوقت**: لوحُ الشعب
   يعرض شعبةً شعبةً، فمن له ثلاثُ شعبٍ يفتح ثلاثَ بطاقاتٍ ويجمع المواعيدَ في
   رأسه. وهذا يُخفي أخطرَ حالة:

   **التزاحمُ بين شعبه هو.** حارسُ الإسناد (`assertNoScheduleConflict`) يمنع
   إسنادَ شعبةٍ جديدةٍ تتعارض جلساتُها مع القائم — ولا يمنع أن تُضاف جلسةٌ
   **بعد** الإسناد إلى شعبةٍ قائمةٍ فتتعارض مع جلسةٍ في شعبةٍ أخرى. فالحارسُ
   صحيحٌ في موضعه، والفجوةُ بعده. وهذه الشاشةُ هي التي تُظهرها — **قبل
   الأسبوع لا صباحَه**، فينقل المدرّبُ لقاءه من صفحة شعبته في وقته.

   وجلسةٌ بلا وقتِ نهايةٍ تُقدَّر ساعةً في حساب التزاحم — والتقديرُ يُقال في
   الشاشة، فلا يُقرأ تزاحمٌ مقدَّرٌ كأنّه محسوب. */

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CalendarDays, Loader2, ServerOff } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import EmptyState from "@/components/EmptyState";
import { apiGet } from "@/services/api";

import { Card, Panel } from "@/components/ui/Surface";
import { fmtDateWith, fmtTime } from "@/application/text/format-ar";
import MonthCalendar from "@/components/MonthCalendar";
import { nextItem } from "@/application/calendar/month-grid";
interface Slot {
  sessionId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  approvalState: string;
  role: string;
  cohortId: string;
  cohortTitle: string;
  courseTitle: string;
  clashesWith: string[];
}

interface Payload {
  days: number;
  cohorts: number;
  sessions: Slot[];
  clashing: number;
  meaningAr: string;
}

const dayKey = (iso: string) => fmtDateWith(iso, {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});

const time = fmtTime;

const ROLE_AR: Record<string, string> = { lead: "مدرّب رئيس", assistant: "مساعد" };

/* ═══ وذهبت «اقتراحات التأجيل» من هنا (٢٧ أكتوبر ٢٠٢٦، المرحلة السادسة — ج) ═══
   كانت تُعرض مآلَ ما اقترحه المدرّبُ قبل ١٧ سبتمبر ٢٠٢٦ — ومنذه ينقل لقاءَه بنفسه. وخرج طابورُ الإدارة الذي
   يقرّرها، وأُغلق ما بقي معلَّقا منها (اختيارُ صاحب المنصّة «a»). */
export default function TrainerSchedule() {
  const [data, setData] = useState<Payload | null>(null);
  const [down, setDown] = useState(false);

  useEffect(() => {
    let on = true;
    apiGet<Payload>("/api/trainer/me/schedule")
      .then((d) => on && setData(d))
      .catch(() => on && setDown(true));
    return () => { on = false; };
  }, []);

  if (down) {
    return (
      <TrainerLayout title="جدولي">
        <EmptyState
          icon={ServerOff}
          titleAr="تعذّر تحميل جدولك"
          reasonAr="أعد تحميل الصفحة، وإن تكرّر فأبلغ الإدارة."
        />
      </TrainerLayout>
    );
  }

  if (!data) {
    return (
      <TrainerLayout title="جدولي">
        <div className="grid place-items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جار التحميل" />
        </div>
      </TrainerLayout>
    );
  }

  /* التجميعُ باليوم يقع هنا لا في الخادم: الخادمُ يُرجع خطّا زمنيّا واحدا،
     وشكلُ العرض (يومٌ يومٌ) قرارُ واجهةٍ يتغيّر دون أن يتغيّر المسار. */
  /* «القادمة» تُميَّز في التقويم — وما مضى ليس قادما ولو بدقيقة */
  const nextSession = nextItem(data.sessions, (x) => new Date(x.startsAt));

  const byDay = new Map<string, Slot[]>();
  for (const s of data.sessions) {
    const k = dayKey(s.startsAt);
    const list = byDay.get(k);
    if (list) list.push(s);
    else byDay.set(k, [s]);
  }

  return (
    <TrainerLayout title="جدولي">
      <Panel as="section">
        <h2 className="flex items-center gap-2 text-base font-black">
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {data.days} يوما القادمة
        </h2>
        <p className="mt-1 text-sm leading-7 text-muted-foreground">{data.meaningAr}</p>

        {data.clashing > 0 && (
          <Card as="p" tone="danger" className="mt-3 flex items-start gap-2 text-read leading-6 text-danger-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              جلسات من شعبتين في وقت واحد — حارس الإسناد لا يمنع جلسة تضاف بعده. انقل إحداها بنفسك من صفحة شعبتها في{" "}
              <Link to="/trainer/board" className="font-bold underline">شعبي</Link>، من «اللقاءات».
              {" "}وجلسة بلا نهاية تحسب ساعة واحدة.
            </span>
          </Card>
        )}
      </Panel>

      {/* ═══ تقويمٌ أوّلا، ثمّ القائمةُ تحته ═══

          شكوى ١٣ سبتمبر ٢٠٢٦: «جدولي» قائمةٌ مبعثرةٌ لا تقويم. والقائمةُ
          تقول «متى» ولا تقول «أين أنا من الشهر»: من له جلستان يوم الأحد
          وثالثةٌ بعد أسبوعين يقرأ ثلاثةَ أسطرٍ ولا يرى الأسبوعَ الفارغَ
          بينها.

          ولم تُحذف القائمةُ بل نزلت تحته: التقويمُ يقول الشكلَ، والقائمةُ
          تقول التفصيلَ — اسمَ الدورة والشعبةِ والدور ووقتَ النهاية. وخانةُ
          يومٍ لا تسع ذلك، ومن حشره فيها أعاد الازدحامَ من بابٍ آخر. */}
      <Panel as="section" className="mt-5">
        <MonthCalendar
          items={data.sessions}
          at={(x) => new Date(x.startsAt)}
          isNext={(x) => x.sessionId === nextSession?.sessionId}
          emptyAr="لا جلسة في هذا الشهر — تنقّل بالأسهم أو ارجع إلى اليوم."
          renderItem={(x, { isNext }) => (
            <span
              title={`${x.title} — ${x.courseTitle}`}
              className={
                'block truncate rounded px-1 py-0.5 text-fine leading-4 '
                + (x.clashesWith.length > 0
                  ? 'bg-red-400/15 text-danger-ink'
                  : isNext
                    ? 'bg-teal/25 font-black text-teal-light-ink'
                    : 'bg-white/[0.06] text-foreground')
              }
            >
              <span className="tabular-nums">{time(x.startsAt)}</span>{' '}
              <span className="hidden sm:inline">{x.title}</span>
            </span>
          )}
        />
      </Panel>

      {data.sessions.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={CalendarDays}
          titleAr="لا جلسة في الأفق"
          reasonAr={`لا جلسة مجدولة لك في ${data.days} يوما القادمة. تظهر هنا حين تسند إليك شعبة.`}
        />
      ) : (
        <div className="mt-5 space-y-5">
          {[...byDay.entries()].map(([day, slots]) => (
            <Panel as="section" key={day} aria-labelledby={`d-${day}`}>
              <h3 id={`d-${day}`} className="text-sm font-black">{day}</h3>
              <ul className="mt-3 space-y-2">
                {slots.map((s) => {
                  const clash = s.clashesWith.length > 0;
                  return (
                    <Card as="li" tone={clash ? "danger" : "default"} key={s.sessionId}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-bold">{s.title}</p>
                          <p className="mt-0.5 text-read text-muted-foreground">
                            {s.courseTitle} · {s.cohortTitle} · {ROLE_AR[s.role] ?? s.role}
                          </p>
                          {/* ═══ والمنتظِرةُ في جدوله تُرى — وتُقال منتظِرة ═══
                              كانت تسقط من هذه الشاشة أصلا (بوّابةُ المتعلّم
                              طُبّقت على المدرّب)، فيقرأ غيابَ ما أنشأه ضياعا.
                              والمعتمَدُ بلا حبّة — شارةٌ على كلّ صفٍّ تُعمي
                              عن الصفراء. */}
                          {s.approvalState === "pending" && (
                            <p className="mt-1 text-read leading-6 text-muted-foreground">
                              <span className="me-1.5 inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-fine font-black text-gold-ink">
                                بانتظار اعتماد الإدارة
                              </span>
                              لا يراها المتعلّمون بعد.
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-xs font-black">
                          {clash && (
                            <span className="rounded-full border border-rose-400/40 px-2 py-0.5 text-fine text-danger-ink">
                              تتزاحم مع {s.clashesWith.length === 1 ? "جلسة أخرى" : `${s.clashesWith.length} جلسات`}
                            </span>
                          )}
                          <span>
                            {time(s.startsAt)}
                            {s.endsAt ? ` — ${time(s.endsAt)}` : " (بلا وقت نهاية)"}
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </TrainerLayout>
  );
}
