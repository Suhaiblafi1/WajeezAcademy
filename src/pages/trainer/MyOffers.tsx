/* عروضي — ما عُرض عليّ من دوراتٍ أُهِّلتُ لها، وجوابي عليه.

   ═══ ولمَ شاشةٌ لا إشعارٌ وحدَه ═══

   البندُ الثاني من العقد يقول إنّ التأهيلَ لا يُلزم الأكاديميّةَ بإسنادٍ،
   والبندُ الثالثُ يقول إنّ الإسنادَ **عرضٌ يُقبَل ويُردّ**. وعرضٌ يُقرأ في
   جرسٍ ثمّ يُنسى ليس عرضا: مهلتُه أيّامٌ معدودة، وانقضاؤها يُغلقه. فله
   موضعٌ يُفتح فيُرى فيه ما بقي من المهلة.

   ═══ وثلاثةُ أشياءَ تُقال صراحةً في هذه الشاشة ═══

   ① **الاعتذارُ جوابٌ لا عطب.** زرُّه إلى جانب زرِّ القبول بالحجم نفسِه،
      ونصُّه يقول ذلك. وعقدُ عملٍ حرٍّ يُقرأ فيه ردُّ العرض إخلالا ليس حرّا.
   ② **وانقضاءُ المهلة ليس مأخذا.** البندُ ٣-٣ يجعله ردّا، فتقوله الشاشة.
   ③ **وأجلُ الإعداد يُرى قبل أن ينقضي.** «لن نستعجل أكثر» — فالأجلُ
      معلومٌ من يوم القبول، لا مفاجأةٌ في رسالةٍ يوم انقضائه. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, ClipboardCheck, Handshake, Loader2, X } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import EmptyState from "@/components/EmptyState";
import { toast, toastError } from "@/components/Toast";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { fmtDateLong } from "@/application/text/format-ar";
import ListToolbar from "@/components/admin/ListToolbar";
import { paginate } from "@/application/admin/paginate";
import { matchesQuery } from "@/application/text/search-ar";

interface Offer {
  id: string;
  status: string;
  courseId: string;
  courseTitleAr: string;
  cohortId: string | null;
  cohort: { id: string; title: string; startsAt: string | null } | null;
  sessionsCount: number | null;
  startsAt: string | null;
  feeNoteAr: string | null;
  noteAr: string | null;
  expiresAt: string;
  offeredAt: string;
  respondedAt: string | null;
  declineReasonAr: string | null;
  withdrawReasonAr: string | null;
  prepDays: number;
  prepDueAt: string | null;
  prepConfirmedAt: string | null;
  prepLapsedAt: string | null;
}

const SAID: Record<string, { label: string; tone: "wait" | "good" | "bad" }> = {
  offered: { label: "ينتظر جوابك", tone: "wait" },
  accepted: { label: "قبِلتَه", tone: "good" },
  declined: { label: "اعتذرتَ عنه", tone: "bad" },
  lapsed: { label: "انقضت مهلتُه", tone: "bad" },
  withdrawn: { label: "سحبته الإدارة", tone: "bad" },
};

const TONE_CLS: Record<"wait" | "good" | "bad", string> = {
  wait: "border-gold/50 bg-gold/10 text-foreground",
  good: "border-emerald-400/40 bg-emerald-400/10 text-foreground",
  bad: "border-white/15 bg-white/[0.03] text-muted-foreground",
};

/** كم بقي من مهلة — والعددُ بالعربيّة لا بتاريخٍ يُحسب في الرأس */
function remainingAr(iso: string, now: number): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "انقضت";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 2) return `بقي ${days} يوما`;
  if (days === 1) return "بقي يومان تقريبا";
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return `بقي ${hours} ساعة`;
}

export default function MyOffers() {
  const [rows, setRows] = useState<Offer[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* محرّرُ اعتذارٍ واحدٌ في كلّ وقت — والسببُ يُكتب قبل الإرسال لا بعده */
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const now = Date.now();
  /* والقائمةُ تُبحث وتُرقَّم: عروضُه القديمةُ تبقى معروضةً بجوابها — وهي
     سجلُّه، فمن أراد عرضا مضى فصلٌ عليه بحث عنه ولا يمرّره بعينه. */
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const view = useMemo(() => paginate(
    (rows ?? []).filter((o) => matchesQuery(q, [
      o.courseTitleAr, o.cohort?.title, o.feeNoteAr, o.noteAr,
      SAID[o.status]?.label ?? o.status,
    ])),
    page, 10,
  ), [rows, q, page]);

  const load = useCallback(() => {
    apiGet<Offer[]>("/api/trainer/offers")
      .then((r) => { setRows(r); setErr(null); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر تحميل عروضك"));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function run(work: () => Promise<unknown>, okAr: string) {
    setBusy(true);
    try {
      await work();
      toast(okAr);
      setDeclining(null);
      setReason("");
      load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ ما طلبت");
    } finally {
      setBusy(false);
    }
  }

  return (
    <TrainerLayout title="عروضي">
      <p className="mb-5 max-w-2xl text-read leading-7 text-muted-foreground">
        ما عُرض عليك من دوراتٍ أُهِّلتَ لها. والعرضُ دعوةٌ لا توجيه: تقبله أو
        تعتذر عنه، والاعتذارُ جوابٌ مشروعٌ لا يُحسَب عليك. وما قبِلتَه يظهر
        أدناه بأجلِ إعداده.
      </p>

      {err && <Inset tone="danger" className="mb-4 p-4 text-sm">{err}</Inset>}

      {rows === null && (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <EmptyState
          icon={Handshake}
          titleAr="لا عرضَ عليك الآن"
          reasonAr="التأهيلُ لدورةٍ لا يعني إسنادَها — والإسنادُ يصلك عرضا حين تُجدوَل شعبةٌ تناسبك. ولا شيءَ عليك أن تفعله حتّى ذلك الحين."
        />
      )}

      {rows !== null && rows.length > 0 && (
        <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="عرضا"
          placeholder="ابحث باسم الدورة أو شعبتها أو حال العرض…" />
      )}

      {rows !== null && rows.length > 0 && view.rows.length === 0 && (
        <p className="text-read opacity-70">لا عرضَ يطابق بحثَك.</p>
      )}

      <div className="grid gap-3">
        {view.rows.map((o) => {
          const said = SAID[o.status] ?? { label: o.status, tone: "bad" as const };
          const open = o.status === "offered";
          const expired = open && new Date(o.expiresAt).getTime() <= now;
          return (
            <Card key={o.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-black">{o.courseTitleAr}</h2>
                  {o.cohort && (
                    <p className="mt-1 text-read text-muted-foreground">
                      شعبةُ «{o.cohort.title}»
                      {o.cohort.startsAt ? ` — تبدأ ${fmtDateLong(o.cohort.startsAt)}` : ""}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full border px-3 py-1 text-fine font-black ${TONE_CLS[said.tone]}`}>
                  {said.label}
                </span>
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {o.sessionsCount !== null && (
                  <div className="flex gap-2 text-read">
                    <dt className="text-muted-foreground">عددُ الجلسات:</dt>
                    <dd className="font-bold">{o.sessionsCount}</dd>
                  </div>
                )}
                {o.startsAt && (
                  <div className="flex gap-2 text-read">
                    <dt className="text-muted-foreground">البداية:</dt>
                    <dd className="font-bold">{fmtDateLong(o.startsAt)}</dd>
                  </div>
                )}
                {o.feeNoteAr && (
                  <div className="flex gap-2 text-read sm:col-span-2">
                    <dt className="text-muted-foreground">الأجر:</dt>
                    <dd className="font-bold">{o.feeNoteAr}</dd>
                  </div>
                )}
              </dl>

              {o.noteAr && (
                <Inset className="mt-3 p-3 text-read leading-7">{o.noteAr}</Inset>
              )}

              {open && (
                <p className="mt-3 text-read font-bold text-gold-ink">
                  مهلةُ الردّ تنتهي {fmtDateLong(o.expiresAt)} — {remainingAr(o.expiresAt, now)}.
                </p>
              )}

              {o.status === "lapsed" && (
                <p className="mt-3 text-read leading-7 text-muted-foreground">
                  انقضت مهلةُ الردّ فأُغلِق العرض. وهو ليس مأخذا عليك — راسِل
                  الإدارةَ إن كنت ما زلت ترغب فيه.
                </p>
              )}

              {o.status === "withdrawn" && o.withdrawReasonAr && (
                <p className="mt-3 text-read leading-7 text-muted-foreground">
                  سحبته الإدارة: {o.withdrawReasonAr}
                </p>
              )}

              {o.status === "declined" && o.declineReasonAr && (
                <p className="mt-3 text-read leading-7 text-muted-foreground">
                  سببُ اعتذارك: {o.declineReasonAr}
                </p>
              )}

              {/* ═══ أجلُ الإعداد — بعد القبول وحدَه ═══ */}
              {o.status === "accepted" && o.prepDueAt && (
                <Inset
                  tone={o.prepConfirmedAt ? "positive" : o.prepLapsedAt ? "warn" : "default"}
                  className="mt-3 flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <p className="text-read leading-7">
                    <CalendarClock className="ms-0 me-1.5 inline h-4 w-4 align-[-2px]" aria-hidden="true" />
                    {o.prepConfirmedAt
                      ? `أقررتَ بجاهزيّتك ${fmtDateLong(o.prepConfirmedAt)}.`
                      : `أجلُ إعدادك ${o.prepDays} أيّام، وينتهي ${fmtDateLong(o.prepDueAt)}.`}
                    {!o.prepConfirmedAt && o.prepLapsedAt && " وقد انقضى — والإسنادُ قائمٌ كما هو، وتنظر فيه الإدارة."}
                  </p>
                  {!o.prepConfirmedAt && (
                    <Button
                      tone="confirm" size="sm" icon={ClipboardCheck} disabled={busy}
                      onClick={() => run(
                        () => apiPost(`/api/trainer/offers/${o.id}/prep-confirm`, {}),
                        "سُجّل إقرارُك بالجاهزيّة",
                      )}
                    >
                      أقِرّ بجاهزيّتي
                    </Button>
                  )}
                </Inset>
              )}

              {/* ═══ الجواب — والزرّان بحجمٍ واحد ═══ */}
              {open && !expired && declining !== o.id && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    tone="confirm" icon={Check} disabled={busy}
                    onClick={() => run(
                      () => apiPost(`/api/trainer/offers/${o.id}/accept`, {}),
                      "قبِلتَ العرض — وأُسنِدت إليك",
                    )}
                  >
                    أقبل هذا العرض
                  </Button>
                  <Button tone="secondary" icon={X} disabled={busy} onClick={() => { setDeclining(o.id); setReason(""); }}>
                    أعتذر عنه
                  </Button>
                </div>
              )}

              {open && expired && (
                <p className="mt-3 text-read leading-7 text-muted-foreground">
                  انقضت مهلةُ هذا العرض — يُغلَق تلقائيّا، وراسِل الإدارةَ إن كنت ما زلت ترغب فيه.
                </p>
              )}

              {declining === o.id && (
                <Inset className="mt-4 grid gap-3 p-3">
                  <StaffField label="سببُ اعتذارك" hint="سطرٌ واحدٌ يكفي — ويساعدنا أن نرتّب، ولا يُحسَب عليك">
                    <input
                      value={reason} maxLength={500} className={staffControlCls}
                      placeholder="مثلا: جدولي مشغولٌ في هذه الفترة"
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </StaffField>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      tone="danger" icon={X} disabled={busy || reason.trim().length < 5}
                      onClick={() => run(
                        () => apiPost(`/api/trainer/offers/${o.id}/decline`, { reasonAr: reason.trim() }),
                        "وصل اعتذارُك",
                      )}
                    >
                      أرسِل اعتذاري
                    </Button>
                    <Button tone="ghost" disabled={busy} onClick={() => setDeclining(null)}>تراجعْ</Button>
                  </div>
                </Inset>
              )}
            </Card>
          );
        })}
      </div>
    </TrainerLayout>
  );
}
