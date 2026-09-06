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

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CalendarClock, CalendarDays, Loader2, ServerOff } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import EmptyState from "@/components/EmptyState";
import { toast, toastError } from "@/components/Toast";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { fmtDateTimeAr } from "@/utils/format";

import { Card, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
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

/* ── اقتراحاتُ التأجيل: مآلُها هنا، حيث المواعيد (البند ٢٣) ──

   كانت تُعرَض في لوح الشعب — وهو الموضعُ الذي يُقترَح منه، لا الموضعُ الذي
   يُتابَع فيه: يُقترح المدرّبُ موعدا من بطاقة الجلسة، ثمّ يبحث عن مآله
   أسفلَ ستّةِ أقسامٍ في الشاشة نفسِها. والمآلُ سؤالٌ عن **الجدول**: هل
   تغيّر موعدي أم لا؟ فمكانُه الجدول. */
interface RescheduleItem {
  id: string; status: string; proposedStartsAt: string; reason: string; createdAt: string;
  reviewerComment: string | null;
  session: { title: string; cohort: { title: string } };
}

const RESCHEDULE_STATUS_AR: Record<string, string> = {
  pending: "بانتظار قرار الإدارة", approved: "اعتُمد", rejected: "رُفض", withdrawn: "سُحب",
};

export default function TrainerSchedule() {
  const [data, setData] = useState<Payload | null>(null);
  const [down, setDown] = useState(false);
  const [reschedules, setReschedules] = useState<RescheduleItem[]>([]);
  const [busy, setBusy] = useState(false);

  /* الاقتراحاتُ نداءٌ مستقلّ: فشلُها لا يُخفي الجدولَ، وغيابُها ليس عطبا */
  const loadReschedules = useCallback(async () => {
    try { setReschedules(await apiGet<RescheduleItem[]>("/api/trainer/reschedules")); }
    catch { /* لا اقتراحاتِ تُعرَض — والجدولُ يبقى */ }
  }, []);

  useEffect(() => {
    let on = true;
    apiGet<Payload>("/api/trainer/me/schedule")
      .then((d) => on && setData(d))
      .catch(() => on && setDown(true));
    void loadReschedules();
    return () => { on = false; };
  }, [loadReschedules]);

  const withdrawReschedule = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await apiPost(`/api/trainer/reschedules/${id}/withdraw`);
      toast("سُحب اقتراحك");
      await loadReschedules();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "تعذّر سحبُ الاقتراح");
    } finally {
      setBusy(false);
    }
  };

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
      <Panel as="section">
        <h2 className="flex items-center gap-2 text-base font-black">
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {data.days} يوما القادمة
        </h2>
        <p className="mt-1 text-sm leading-7 text-muted-foreground">{data.meaningAr}</p>

        {data.clashing > 0 && (
          <Card as="p" tone="danger" className="mt-3 flex items-start gap-2 text-xs leading-6 text-danger-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              جلساتٌ من شعبَتين تتزاحم في وقتٍ واحد. حارسُ الإسناد يمنع الشعبةَ المتعارضةَ عند إسنادها،
              ولا يمنع جلسةً تُضاف بعده — فهذه تُراجَع مع الإدارة، ويمكنك اقتراحُ تأجيلٍ من{" "}
              <Link to="/trainer/board" className="font-bold underline">لوح شعبي</Link>.
              {" "}وجلسةٌ بلا وقتِ نهايةٍ تُحسب ساعةً واحدة.
            </span>
          </Card>
        )}
      </Panel>

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
                    </Card>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>
      )}

      {/* ── اقتراحاتُ تأجيلي ومآلُها ── */}
      {reschedules.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-black">
            <CalendarClock className="h-4 w-4 text-gold-ink" aria-hidden="true" /> اقتراحاتُ التأجيل
          </h2>
          <p className="mb-3 text-xs leading-6 text-muted-foreground">
            تُقترَح من بطاقة الجلسة في <Link to="/trainer/board" className="font-bold underline">لوح شعبي</Link> —
            و<b className="text-foreground">الموعدُ لا يتغيّر عند المتعلّمين حتّى تعتمده الإدارة</b>.
          </p>
          <ul className="space-y-3">
            {reschedules.map((r) => (
              <Card as="li" key={r.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{r.session.title} — {r.session.cohort.title}</p>
                    <p className="mt-0.5 text-micro text-muted-foreground">موعد مقترح: {fmtDateTimeAr(r.proposedStartsAt)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                    {r.reviewerComment && (
                      <p className="mt-1 text-micro text-muted-foreground">ملاحظة الإدارة: {r.reviewerComment}</p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-micro font-bold ${r.status === "approved" ? "border-teal/40 text-teal-light-ink" : r.status === "rejected" ? "border-red-400/40 text-red-300" : r.status === "withdrawn" ? "border-white/15 text-muted-foreground" : "border-gold/40 text-gold-ink"}`}>
                    {RESCHEDULE_STATUS_AR[r.status] ?? r.status}
                  </span>
                  {r.status === "pending" && (
                    <Button type="button" size="sm" tone="danger" disabled={busy}
                      onClick={() => void withdrawReschedule(r.id)} className="shrink-0">
                      سحب الاقتراح
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </ul>
        </section>
      )}
    </TrainerLayout>
  );
}
