/* تقويمُ الفصل — الصفحةُ العامّة (البند ٥٠).

   ─────────── ما لم يكن ───────────

   الرئيسةُ لا تعرض بياناتِ شعبٍ إطلاقا، والطالبُ ليس عنده تقويمٌ في بوّابته،
   والشاشةُ الزمنيّةُ الوحيدةُ في المنصّة كلِّها جدولُ المدرّب. فمن سأل «ماذا
   يُفتح هذا الفصل؟» لم يجد جوابا في مكانٍ واحد.

   ─────────── وثلاثةُ أعمدةٍ لا قائمةٌ واحدة ───────────

   الفصلُ ثلاثةُ أشهر، والسؤالُ الذي يسأله الزائرُ زمنيّ: «ما الذي يبدأ
   قريبا؟». فالعمودُ شهرٌ، والبطاقةُ شعبة — يُقرأ الأفقُ في نظرةٍ لا في
   تمريرِ قائمةٍ من ثمانين.

   ─────────── وما لا يُعرض ───────────

   الجلساتُ لا تُعرض هنا: مواعيدُها تفصيلُ من اشترى. وأسماءُ المدرّبين لمن
   اعتُمد نشرُه وحدَه — والخادمُ يفرضها، وهذه الشاشةُ تعرض ما وصلها. */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { CalendarDays, Loader2, Users } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import EmptyState from "@/components/EmptyState";
import { apiGet } from "@/services/api";
import { fmtDateAr, daysLabelAr } from "@/utils/format";
import { courseTitleAr } from "@/application/catalog/course-title";

interface Entry {
  cohortId: string; courseId: string; titleAr: string;
  domainAr: string | null; startsAt: string | null; monthWithinTerm: number | null;
  daysOfWeek: string[]; startTime: string | null;
  price: string | null; currency: string; seatsLeft: number | null;
  trainerNameAr: string | null; enrolled?: boolean;
}
interface TermCalendar {
  termId: string; titleAr: string; startsOn: string; endsOn: string;
  registrationOpen: boolean; registrationOpensAt: string | null;
  months: { month: number; entries: Entry[] }[];
  total: number;
}

const MONTH_LABEL = ["الشهر الأوّل", "الشهر الثاني", "الشهر الثالث"];

export default function CalendarPage() {
  const [data, setData] = useState<TermCalendar | null | undefined>(undefined);
  const [domain, setDomain] = useState("الكل");

  useEffect(() => {
    let on = true;
    apiGet<{ calendar: TermCalendar | null }>("/api/public/term-calendar")
      .then((r) => { if (on) setData(r.calendar); })
      .catch(() => { if (on) setData(null); });
    return () => { on = false; };
  }, []);

  const domains = useMemo(() => {
    if (!data) return [];
    const all = data.months.flatMap((m) => m.entries).map((e) => e.domainAr).filter((d): d is string => Boolean(d));
    return ["الكل", ...[...new Set(all)].sort((a, b) => a.localeCompare(b, "ar"))];
  }, [data]);

  return (
    <SiteShell>
      <SeoHead
        title="تقويم الفصل"
        description="ما يُفتح هذا الفصل من دورات أكاديمية وجيز — بأشهره الثلاثة ومواعيد بدايته ونافذة التسجيل."
        path="/calendar"
      />

      {data === undefined ? (
        <div className="grid place-items-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      ) : data === null ? (
        <EmptyState
          icon={CalendarDays}
          titleAr="لا تقويمَ منشورٌ بعد"
          reasonAr="حين يُنشر تقويمُ الفصل القادم تظهر هنا دوراتُه بأشهرها الثلاثة ومواعيد بدايتها. والفصلُ المخطَّطُ لا يُعرض قبل نشره — لا نَعِد بما لم يُقرَّر."
        />
      ) : (
        <>
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-4 py-1.5 text-sm text-teal-light-ink">
              <CalendarDays className="h-3.5 w-3.5" /> تقويم الفصل
            </div>
            <h1 className="mt-5 text-3xl font-black md:text-4xl">{data.titleAr}</h1>
            <p className="mx-auto mt-3 max-w-xl leading-8 text-muted-foreground">
              {fmtDateAr(data.startsOn)} — {fmtDateAr(data.endsOn)} · {data.total} دورة
              {data.registrationOpen ? (
                <span className="block text-teal-light-ink">التسجيل مفتوح الآن</span>
              ) : data.registrationOpensAt ? (
                <span className="block">التسجيل يبدأ {fmtDateAr(data.registrationOpensAt)}</span>
              ) : null}
            </p>
          </div>

          {domains.length > 2 && (
            <div className="scrollbar-hide -mx-5 mt-8 flex snap-x items-center gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {domains.map((d) => (
                <button
                  key={d} onClick={() => setDomain(d)}
                  className={`inline-flex shrink-0 snap-start items-center rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition ${
                    domain === d ? "border-teal bg-teal/15 text-teal-light-ink" : "border-white/15 text-muted-foreground hover:border-white/35"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {data.months.map((m) => {
              const shown = m.entries.filter((e) => domain === "الكل" || e.domainAr === domain);
              return (
                <section key={m.month} className="rounded-3xl border border-white/10 bg-white/[0.02] p-4">
                  <h2 className="flex items-center justify-between text-sm font-black">
                    {MONTH_LABEL[m.month - 1] ?? `الشهر ${m.month}`}
                    <span className="text-fine font-bold text-muted-foreground">{shown.length}</span>
                  </h2>
                  {shown.length === 0 ? (
                    <p className="mt-4 rounded-2xl border border-white/8 py-8 text-center text-xs text-muted-foreground">
                      لا دورةَ في هذا الشهر ضمن ما اخترت.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2.5">
                      {shown.map((e) => (
                        <li key={e.cohortId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                          <Link to={`/build/${e.courseId}`} className="block">
                            <p className="text-[13px] font-bold leading-6 text-foreground">{courseTitleAr(e.titleAr)}</p>
                          </Link>
                          <p className="mt-1 text-fine leading-5 text-muted-foreground">
                            {e.startsAt && <>تبدأ {fmtDateAr(e.startsAt)}</>}
                            {e.daysOfWeek.length > 0 && <> · {daysLabelAr(e.daysOfWeek)}{e.startTime ? ` ${e.startTime}` : ""}</>}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {e.domainAr && (
                              <span className="rounded-full border border-white/10 px-2 py-0.5 text-fine text-muted-foreground">{e.domainAr}</span>
                            )}
                            {/* اسمُ المدرّب لمن اعتُمد نشرُه وحدَه — والخادمُ يفرضها */}
                            {e.trainerNameAr && (
                              <span className="rounded-full border border-teal/25 px-2 py-0.5 text-fine text-teal-light-ink">{e.trainerNameAr}</span>
                            )}
                            {typeof e.seatsLeft === "number" && e.seatsLeft <= 5 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-fine font-black text-gold-ink">
                                <Users className="h-3 w-3" /> {e.seatsLeft} مقاعد
                              </span>
                            )}
                            {e.enrolled && (
                              <span className="rounded-full bg-teal/20 px-2 py-0.5 text-fine font-black text-teal-light-ink">مسجَّلٌ فيها</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </SiteShell>
  );
}
