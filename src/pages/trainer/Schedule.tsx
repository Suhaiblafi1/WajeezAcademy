/* «جدولي» — جلساتُ شعبي كلِّها في خطٍّ زمنيٍّ واحد (المهمّة ٧٢).

   البياناتُ موجودةٌ كاملةً منذ زمن، **ولا شاشةَ تجمعها بالوقت**: لوحُ الشعب
   يعرض شعبةً شعبةً، فمن له ثلاثُ شعبٍ يفتح ثلاثَ بطاقاتٍ ويجمع المواعيدَ في
   رأسه. وهذا يُخفي أخطرَ حالة:

   **التزاحمُ بين شعبه هو.** حارسُ الإسناد (`assertNoScheduleConflict`) يمنع
   إسنادَ شعبةٍ جديدةٍ تتعارض جلساتُها مع القائم — ولا يمنع أن تُضاف جلسةٌ
   **بعد** الإسناد إلى شعبةٍ قائمةٍ فتتعارض مع جلسةٍ في شعبةٍ أخرى. فالحارسُ
   صحيحٌ في موضعه، والفجوةُ بعده. وهذه الشاشةُ هي التي تُظهرها — **قبل
   الأسبوع لا صباحَه**، فيراجعها المدرّبُ مع الإدارة ويُقترح تأجيلٌ في وقته.

   وجلسةٌ بلا وقتِ نهايةٍ تُقدَّر ساعةً في حساب التزاحم — والتقديرُ يُقال في
   الشاشة، فلا يُقرأ تزاحمٌ مقدَّرٌ كأنّه محسوب. */

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CalendarDays, Loader2, ServerOff } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import EmptyState from "@/components/EmptyState";
import { apiGet } from "@/services/api";

interface Slot {
  sessionId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
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

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("ar", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});

const time = (iso: string) => new Date(iso).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });

const ROLE_AR: Record<string, string> = { lead: "مدرّبٌ رئيس", assistant: "مساعد" };

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
          titleAr="تعذّر تحميلُ جدولك"
          reasonAr="لم يُجب الخادم. أعد تحميلَ الصفحة، وإن تكرّر فأبلغ الإدارة."
        />
      </TrainerLayout>
    );
  }

  if (!data) {
    return (
      <TrainerLayout title="جدولي">
        <div className="grid place-items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" />
        </div>
      </TrainerLayout>
    );
  }

  /* التجميعُ باليوم يقع هنا لا في الخادم: الخادمُ يُرجع خطّا زمنيّا واحدا،
     وشكلُ العرض (يومٌ يومٌ) قرارُ واجهةٍ يتغيّر دون أن يتغيّر المسار. */
  const byDay = new Map<string, Slot[]>();
  for (const s of data.sessions) {
    const k = dayKey(s.startsAt);
    const list = byDay.get(k);
    if (list) list.push(s);
    else byDay.set(k, [s]);
  }

  return (
    <TrainerLayout title="جدولي">
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="flex items-center gap-2 text-base font-black">
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {data.days} يوما القادمة
        </h2>
        <p className="mt-1 text-sm leading-7 text-muted-foreground">{data.meaningAr}</p>

        {data.clashing > 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-400/40 bg-rose-500/[0.07] p-3 text-xs leading-6 text-danger-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              جلساتٌ من شعبَتين تتزاحم في وقتٍ واحد. حارسُ الإسناد يمنع الشعبةَ المتعارضةَ عند إسنادها،
              ولا يمنع جلسةً تُضاف بعده — فهذه تُراجَع مع الإدارة، ويمكنك اقتراحُ تأجيلٍ من{" "}
              <Link to="/trainer/board" className="font-bold underline">لوح شعبي</Link>.
              {" "}وجلسةٌ بلا وقتِ نهايةٍ تُحسب ساعةً واحدة.
            </span>
          </p>
        )}
      </section>

      {data.sessions.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={CalendarDays}
          titleAr="لا جلسةَ في الأفق"
          reasonAr={`لا جلسةَ مجدولةً لك في ${data.days} يوما القادمة — وما إن تُسنَد إليك شعبةٌ بجلسات حتّى تظهر هنا مرتّبةً باليوم.`}
        />
      ) : (
        <div className="mt-5 space-y-5">
          {[...byDay.entries()].map(([day, slots]) => (
            <section key={day} aria-labelledby={`d-${day}`} className="rounded-3xl border border-white/10 bg-white/[0.02] p-4">
              <h3 id={`d-${day}`} className="text-sm font-black">{day}</h3>
              <ul className="mt-3 space-y-2">
                {slots.map((s) => {
                  const clash = s.clashesWith.length > 0;
                  return (
                    <li
                      key={s.sessionId}
                      className={`rounded-2xl border p-3 ${clash ? "border-rose-400/40 bg-rose-500/[0.06]" : "border-white/10 bg-white/[0.02]"}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-bold">{s.title}</p>
                          <p className="mt-0.5 text-micro text-muted-foreground">
                            {s.courseTitle} · {s.cohortTitle} · {ROLE_AR[s.role] ?? s.role}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-xs font-black">
                          {clash && (
                            <span className="rounded-full border border-rose-400/40 px-2 py-0.5 text-micro text-danger-ink">
                              تتزاحم مع {s.clashesWith.length === 1 ? "جلسةٍ أخرى" : `${s.clashesWith.length} جلسات`}
                            </span>
                          )}
                          <span>
                            {time(s.startsAt)}
                            {s.endsAt ? ` — ${time(s.endsAt)}` : " (بلا وقتِ نهاية)"}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </TrainerLayout>
  );
}
