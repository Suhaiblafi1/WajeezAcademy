/* رحيلُ مدرّب — شيءٌ واحدٌ يُتتبَّع لا ذاكرةُ إداريّ (ن-٩ · ن-١٠).

   ═══ لماذا شاشةٌ بقائمةِ أسماء ═══

   «قائمةُ شعبٍ متأثّرةٍ بكلّ متعلّمٍ مسجَّلٍ فيها، يُحلّ كلٌّ منهم وحدَه، ولا
   تُغلق الحالةُ واسمٌ واحدٌ معلَّق». فالشاشةُ تعرض الأسماءَ لا العدد: من
   يُغلق ملفّا يرى من بقي.

   ═══ وترتيبُ الطرق مقصودٌ في الشاشة كما في القاعدة ═══

   ① **بديلٌ** — قرارٌ واحدٌ على الشعبة يَحُلّ كلَّ من فيها. ولذلك زرُّه على
      الشعبة لا على الاسم: «لا يتحرّك إلّا الاسم».
   ② **نقلٌ إلى نظير** — على الاسم، والنظائرُ مجموعةٌ معرَّفةٌ تأتي من الخادم.
   ③ **والاختيارُ لصاحبه** — تُعرض عليه، ولا يختار عنه من في هذه الشاشة.
      ولذلك لا زرَّ «ردّ» ولا «رصيد» قبل أن يصل اختيارُه.

   ═══ والرسالةُ بعد القرار ═══

   زرُّ الإبلاغ معطَّلٌ ما دام الصفُّ `pending` — والخادمُ يردّه أيضا. فلا
   يقرأ متعلّمٌ «رحل مدرّبُك» بلا أن يكون الجوابُ في الجملة نفسِها. */

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Send, UserMinus, UserPlus } from "lucide-react";
import AdminLayout from "./AdminLayout";
import EmptyState from "@/components/EmptyState";
import { toast, toastError } from "@/components/Toast";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { fmtDateLong } from "@/application/text/format-ar";
import { isResolved } from "@/application/trainer/departure-rules";
import ListToolbar from "@/components/admin/ListToolbar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";

interface Row {
  id: string; trainerName: string; reasonAr: string;
  openedAt: string; closedAt: string | null; total: number; pending: number;
}
interface CaseRow {
  id: string; outcome: string; learnerName: string; learnerEmail: string;
  cohortId: string; cohortTitle: string; courseId: string;
  notifiedAt: string | null; choiceOfferedAt: string | null;
  learnerChoice: string | null; noteAr: string | null; resolvedAt: string | null;
}
/** دفعةٌ يُردّ منها — مربوطةٌ ببندِ هذه الشعبة لا أقربُ دفعةٍ للمتعلّم */
interface Payable {
  paymentId: string; invoiceNumber: string; amount: number; currency: string;
  refunded: number; remaining: number; paidAt: string | null;
}
interface Detail {
  id: string; trainerName: string; reasonAr: string; openedAt: string; closedAt: string | null;
  closeBlockersAr: string[]; canClose: boolean; cases: CaseRow[];
}
interface Sub {
  profileId: string; name: string; hoursTaught: number;
  ratingAvg: number | null; ratingCount: number; liveCohorts: number;
}
interface Equivalent { cohortId: string; title: string; courseTitleAr: string; enrolled: number; capacity: number | null }

const SAID: Record<string, string> = {
  pending: "لم يُقرَّر بعد",
  substituted: "جاء بديلٌ — لم يتحرّك إلّا الاسم",
  moved: "نُقل إلى شعبةٍ نظيرة",
  refund_requested: "اختار الردَّ — رُفع الطلبُ إلى الماليّة",
  credited: "اختار الرصيدَ — صُرف باسمه",
};

export default function TrainerDepartures() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  /* لوحُ عملٍ واحدٌ مفتوحٌ في كلّ وقت */
  const [subsFor, setSubsFor] = useState<string | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [equivalents, setEquivalents] = useState<Equivalent[]>([]);
  const [settleFor, setSettleFor] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payable[]>([]);
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [bonus, setBonus] = useState("");

  const load = useCallback(() => {
    apiGet<Row[]>("/api/admin/trainer-departures?scope=all")
      .then((r) => { setRows(r); setErr(null); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر تحميل الملفّات"));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openDetail = useCallback((id: string) => {
    apiGet<Detail>(`/api/admin/trainer-departures/${id}`)
      .then(setOpen)
      .catch((e) => toastError(e instanceof ApiError ? e.message : "تعذّر فتح الملفّ"));
  }, []);

  async function run(work: () => Promise<unknown>, okAr: string) {
    setBusy(true);
    try {
      await work();
      toast(okAr);
      setSubsFor(null); setMoveFor(null); setSettleFor(null);
      setAmount(""); setBonus("");
      load();
      if (open) openDetail(open.id);
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ ما طلبت");
    } finally {
      setBusy(false);
    }
  }

  /* شعبُ الملفّ — القرارُ الأوّلُ يقع عليها لا على الأسماء */
  const cohortsOf = (d: Detail) => {
    const seen = new Map<string, { title: string; pending: number }>();
    for (const c of d.cases) {
      const at = seen.get(c.cohortId) ?? { title: c.cohortTitle, pending: 0 };
      if (!isResolved(c.outcome)) at.pending += 1;
      seen.set(c.cohortId, at);
    }
    return [...seen].map(([cohortId, v]) => ({ cohortId, ...v }));
  };

  const matched = (rows ?? []).filter((r) => matchesQuery(q, [r.trainerName, r.reasonAr]));
  const view = paginate(matched, page, 20);

  return (
    <AdminLayout title="رحيلُ المدرّبين">
      <Card className="mb-4">
        <p className="text-sm leading-7 text-muted-foreground">
          حين يترك مدرّبٌ الأكاديميّة، يُفتح ملفٌّ يجمع <b>كلَّ متعلّمٍ</b> في شعبه الحيّة.
          والترتيب: <b>بديلٌ</b> يأخذ مكانَه فلا يتحرّك إلّا الاسم · فإن لم يوجد فـ<b>نقلٌ</b> إلى
          شعبةٍ على الرمز نفسِه · فإن لم يصلح فـ<b>الاختيارُ لصاحبه</b>: ردُّ ما تبقّى أو رصيدٌ باسمه.
          {" "}ولا تخرج رسالةٌ إلى متعلّمٍ قبل أن يُقرَّر أمرُه.
        </p>
      </Card>

      {err ? (
        <Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card>
      ) : !rows ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={UserMinus}
          titleAr="لا ملفَّ رحيلٍ مفتوح"
          reasonAr="حين يترك مدرّبٌ الأكاديميّة يُفتح ملفٌّ من صفحة المدرّب، فتُجمَع شعبُه ومتعلّموه هنا."
        />
      ) : (
        <div className="grid gap-3">
          {/* ملفّاتُ الرحيل تبقى مفتوحةً أسابيعَ — والمغلقُ يبقى للمراجعة.
              فالبحثُ باسم الراحل وسببِه: وهما ما يُتذكَّر حين يُسأل عنه. */}
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="ملفّا"
            placeholder="ابحث باسم المدرّب أو بسبب الرحيل" />
          {view.rows.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-read font-bold text-foreground">{r.trainerName}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{r.reasonAr}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground/70">
                    <span>فُتح {fmtDateLong(r.openedAt)}</span>
                    <span>{r.total} متعلّما</span>
                    {r.pending > 0 ? (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-bold text-red-300">
                        {r.pending} لم يُحَلّ
                      </span>
                    ) : (
                      <span className="rounded-full bg-teal/15 px-2 py-0.5 font-bold text-teal">حُلَّ الجميع</span>
                    )}
                    {r.closedAt ? <span>أُغلق {fmtDateLong(r.closedAt)}</span> : null}
                  </div>
                </div>
                <Button
                  tone={open?.id === r.id ? "ghost" : "secondary"}
                  onClick={() => (open?.id === r.id ? setOpen(null) : openDetail(r.id))}
                >
                  {open?.id === r.id ? "أغلِق العرض" : "افتح الملفّ"}
                </Button>
              </div>

              {open?.id === r.id ? (
                <div className="mt-4 grid gap-3">
                  {/* ① الطريقُ الأوّل — على الشعبة لا على الاسم */}
                  {cohortsOf(open).filter((c) => c.pending > 0).map((c) => (
                    <Inset key={c.cohortId} className="grid gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <b className="text-foreground">{c.title}</b>
                          <span className="text-sm text-muted-foreground"> — {c.pending} متعلّما ينتظر</span>
                        </div>
                        <Button
                          tone="confirm" icon={UserPlus} disabled={busy}
                          onClick={() => {
                            setSubsFor(subsFor === c.cohortId ? null : c.cohortId);
                            setMoveFor(null); setSettleFor(null);
                            apiGet<Sub[]>(`/api/admin/cohorts/${c.cohortId}/substitutes`)
                              .then(setSubs).catch(() => setSubs([]));
                          }}
                        >
                          ابحث عن بديل
                        </Button>
                      </div>

                      {subsFor === c.cohortId ? (
                        subs.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            لا مدرّبَ مؤهَّلا لهذه الدورة غيرَه — فالطريقُ الثاني: انقل متعلّميها إلى نظير.
                          </p>
                        ) : (
                          <div className="grid gap-1.5">
                            {subs.map((s) => (
                              <Inset key={s.profileId} className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm">
                                  <b className="text-foreground">{s.name}</b>
                                  <span className="text-muted-foreground">
                                    {" · "}{s.hoursTaught} ساعةً درّسها
                                    {s.ratingAvg ? ` · تقييمُه ${s.ratingAvg.toFixed(1)} من ${s.ratingCount}` : " · بلا تقييمٍ بعد"}
                                    {" · "}{s.liveCohorts} شعبا حيّة
                                  </span>
                                </div>
                                <Button
                                  tone="confirm" icon={Check} disabled={busy}
                                  onClick={() => run(
                                    () => apiPost(`/api/admin/trainer-departures/${open.id}/substitute`,
                                      { cohortId: c.cohortId, profileId: s.profileId }),
                                    "أُسنِد البديلُ — ولم يتحرّك إلّا الاسم",
                                  )}
                                >
                                  أسنِده
                                </Button>
                              </Inset>
                            ))}
                          </div>
                        )
                      ) : null}
                    </Inset>
                  ))}

                  {/* والأسماءُ واحدا واحدا */}
                  {open.cases.map((c) => (
                    <Inset key={c.id} className="grid gap-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <b className="text-foreground">{c.learnerName}</b>
                          <span className="text-sm text-muted-foreground"> · {c.cohortTitle}</span>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className={
                              "rounded-full px-2 py-0.5 font-bold "
                              + (isResolved(c.outcome) ? "bg-teal/15 text-teal" : "bg-white/10 text-muted-foreground")
                            }>
                              {SAID[c.outcome] ?? c.outcome}
                            </span>
                            {c.learnerChoice ? (
                              <span className="text-muted-foreground/70">
                                اختار: {c.learnerChoice === "refund" ? "ردَّ ما تبقّى" : "رصيدا باسمه"}
                              </span>
                            ) : c.choiceOfferedAt ? (
                              <span className="text-muted-foreground/70">عُرض عليه الاختيارُ ولم يختر بعد</span>
                            ) : null}
                            {c.notifiedAt ? (
                              <span className="text-teal">أُبلغ {fmtDateLong(c.notifiedAt)}</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {!isResolved(c.outcome) ? (
                            <>
                              <Button
                                tone="secondary" disabled={busy}
                                onClick={() => {
                                  setMoveFor(moveFor === c.id ? null : c.id);
                                  setSubsFor(null); setSettleFor(null);
                                  apiGet<Equivalent[]>(`/api/admin/departure-cases/${c.id}/equivalents`)
                                    .then(setEquivalents).catch(() => setEquivalents([]));
                                }}
                              >
                                انقله إلى نظير
                              </Button>
                              {!c.choiceOfferedAt ? (
                                <Button
                                  tone="secondary" disabled={busy}
                                  onClick={() => run(
                                    () => apiPost(`/api/admin/departure-cases/${c.id}/offer-choice`, {}),
                                    "عُرض عليه الاختيار",
                                  )}
                                >
                                  اعرِض عليه الاختيار
                                </Button>
                              ) : null}
                              {/* ولا زرَّ ردٍّ ولا رصيدٍ قبل أن يصل اختيارُه (ن-١٠) */}
                              {c.learnerChoice ? (
                                <Button
                                  tone="confirm" disabled={busy}
                                  onClick={() => {
                                    const next = settleFor === c.id ? null : c.id;
                                    setSettleFor(next); setMoveFor(null);
                                    setPayments([]); setPaymentId("");
                                    /* الردُّ وحدَه يحتاج دفعةً — والرصيدُ يُصرف بلا واحدة */
                                    if (next && c.learnerChoice === "refund") {
                                      apiGet<Payable[]>(`/api/admin/departure-cases/${c.id}/refundable`)
                                        .then((p) => {
                                          setPayments(p);
                                          if (p.length === 1) setPaymentId(p[0].paymentId);
                                        })
                                        .catch(() => setPayments([]));
                                    }
                                  }}
                                >
                                  نفِّذ ما اختاره
                                </Button>
                              ) : null}
                            </>
                          ) : null}
                          <Button
                            tone="confirm" icon={Send}
                            disabled={busy || !isResolved(c.outcome) || !!c.notifiedAt}
                            onClick={() => run(
                              () => apiPost(`/api/admin/departure-cases/${c.id}/notify`),
                              "أُبلغ صاحبُه",
                            )}
                          >
                            أبلِغه
                          </Button>
                        </div>
                      </div>

                      {/* ولماذا الزرُّ معطَّل — يُقال لا يُترك يُخمَّن */}
                      {!isResolved(c.outcome) && !c.notifiedAt ? (
                        <p className="text-read leading-6 text-muted-foreground/70">
                          لا يُبلَّغ قبل أن يُقرَّر أمرُه — فالرسالةُ تحمل ما يجري بعدها لا اعتذارا وانتظارا.
                        </p>
                      ) : null}

                      {moveFor === c.id ? (
                        equivalents.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            لا شعبةَ نظيرةً مفتوحةً على الرمز نفسِه — فاعرِض عليه الاختيار.
                          </p>
                        ) : (
                          <div className="grid gap-1.5">
                            {equivalents.map((e) => (
                              <Inset key={e.cohortId} className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm">
                                  <b className="text-foreground">{e.title}</b>
                                  <span className="text-muted-foreground">
                                    {" · "}{e.courseTitleAr}{" · "}{e.enrolled}{e.capacity ? ` من ${e.capacity}` : ""} التحقوا
                                  </span>
                                </span>
                                <Button
                                  tone="confirm" icon={Check} disabled={busy}
                                  onClick={() => run(
                                    () => apiPost(`/api/admin/departure-cases/${c.id}/move`, { toCohortId: e.cohortId }),
                                    "نُقل إلى النظير",
                                  )}
                                >
                                  انقله إليها
                                </Button>
                              </Inset>
                            ))}
                          </div>
                        )
                      ) : null}

                      {settleFor === c.id ? (
                        <div className="grid gap-2 sm:grid-cols-3">
                          <StaffField label="ما تبقّى من قيمته">
                            <input
                              className={staffControlCls} inputMode="decimal" value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                            />
                          </StaffField>
                          {c.learnerChoice === "credit" ? (
                            <StaffField label="زيادةٌ لأجل ما سبّبناه" hint="تُضاف إلى الرصيد">
                              <input
                                className={staffControlCls} inputMode="decimal" value={bonus}
                                onChange={(e) => setBonus(e.target.value)}
                              />
                            </StaffField>
                          ) : (
                            /* «رُفع الطلبُ إلى الماليّة» جملةٌ يقرؤها صاحبُ المال —
                               فلا تخرج بلا دفعةٍ خلفَها. والدفعاتُ بنودُ هذه الشعبة
                               نفسِها، لا أقربُ ما دفعه. */
                            <StaffField label="الدفعةُ التي يُردّ منها" hint="بنودُ هذه الشعبة وحدَها">
                              <select className={staffControlCls} value={paymentId}
                                onChange={(e) => setPaymentId(e.target.value)}>
                                <option value="">اختر الدفعة…</option>
                                {payments.map((p) => (
                                  <option key={p.paymentId} value={p.paymentId}>
                                    {p.invoiceNumber} — بقي {p.remaining} {p.currency}
                                  </option>
                                ))}
                              </select>
                            </StaffField>
                          )}
                          <div className="flex items-end">
                            <Button
                              tone="confirm" icon={Check} loading={busy}
                              disabled={!(Number(amount) > 0)
                                || (c.learnerChoice === "refund" && !paymentId)}
                              onClick={() => run(
                                () => apiPost(`/api/admin/departure-cases/${c.id}/settle`, {
                                  amount: Number(amount), bonus: Number(bonus) || undefined,
                                  paymentId: paymentId || undefined,
                                }),
                                c.learnerChoice === "credit" ? "صُرف الرصيدُ باسمه" : "رُفع طلبُ الردّ",
                              )}
                            >
                              نفِّذ
                            </Button>
                          </div>
                          {c.learnerChoice === "refund" && payments.length === 0 ? (
                            <p className="text-read leading-6 text-muted-foreground sm:col-span-3">
                              لا دفعةَ على هذه الشعبة باسمه — فلا شيءَ يُردّ منه.
                              راجِع الماليّةَ قبل أن تَعِده بردّ.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </Inset>
                  ))}

                  {/* والإغلاقُ آخرا — ولا يُغلق واسمٌ معلَّق */}
                  {!open.closedAt ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        tone="primary" icon={Check} disabled={busy || !open.canClose}
                        onClick={() => run(
                          () => apiPost(`/api/admin/trainer-departures/${open.id}/close`),
                          "أُغلق الملفّ",
                        )}
                      >
                        أغلِق الملفّ
                      </Button>
                      {open.closeBlockersAr.length > 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {open.closeBlockersAr.join(" · ")}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
