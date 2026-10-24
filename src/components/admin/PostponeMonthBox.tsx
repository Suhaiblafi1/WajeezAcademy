/* ═══ «أجّل شعب الشهر» — نقترح التأجيل على مدرّبيها، ومن لم يقبل تتوقّف شعبتُه (٢٤ أكتوبر ٢٠٢٦) ═══

   قولُ صاحب المنصّة: «افحص كلَّ الدورات التي تبدأ بشهر ١١ واقترح تأجيلا لها وأرسلها للمدرّب مع إعلامه بأنّه سيتمّ
   توقيفُ الشعبة تلقائيّا.. هذا شيءٌ يخصّ هذا الفصل لأنّنا بدأنا متأخّرين نوعا ما بالتسويق».

   فالصندوقُ يعاين أوّلا ولا يرسل: شعبُ الشهر بموعدها الآن وبعد التأجيل، وكلُّها مختارةٌ إلّا ما لا يُرسل لها. ثمّ
   المهلةُ والسببُ يُحرَّران، وتُقال الخياراتُ الثلاثةُ وما يقع بكلٍّ منها قبل الزرّ — فالإرسالُ قرارٌ يُرى أثرُه. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiGet, apiPost, permissionMessage } from "@/services/api";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip, { type ChipTone } from "@/components/ui/Chip";
import { staffAreaCls, staffControlCls, staffSelectCls } from "@/components/FormKit";
import { fmtDateTimeAr } from "@/utils/format";
import { zonedAt, zonedClock, zonedDay } from "@/application/trainer/cohort-period";
import {
  DEFAULT_POSTPONE_REASON_AR, POSTPONE_STATUS_AR, academyMonth, deadlineProblemAr, defaultDeadline, nextMonth,
  type PostponeStatus,
} from "@/application/trainer/postpone-offer";

interface Candidate {
  cohortId: string; title: string; status: string; trainersAr: string[]; enrolled: number;
  fromFirstAt: string; toFirstAt: string; weeks: number; blockedAr: string | null;
}
interface SentOffer {
  id: string; cohortId: string; title: string; status: PostponeStatus;
  fromFirstAt: string; toFirstAt: string; deadlineAt: string;
}

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const weeksAr = (n: number) => (n === 1 ? "أسبوع" : n === 2 ? "أسبوعان" : n <= 10 ? `${n} أسابيع` : `${n} أسبوعا`);
const monthAr = (m: { year: number; month: number }) => `${MONTHS_AR[m.month - 1]} ${m.year}`;

const STATUS_TONE: Record<PostponeStatus, ChipTone> = {
  pending: "warn", accepted: "positive", declined: "danger", expired: "danger", withdrawn: "neutral",
};

/** `datetime-local` بتوقيت الأكاديميّة — لا بتوقيت جهاز من يقرأ */
const toLocal = (d: Date) => `${zonedDay(d)}T${zonedClock(d)}`;
const fromLocal = (v: string) => zonedAt(v.slice(0, 10), v.slice(11, 16));

export default function PostponeMonthBox({ onChanged, onFlash }: {
  onChanged: () => void;
  onFlash: (f: { kind: "ok" | "error"; text: string }) => void;
}) {
  const months = useMemo(() => {
    const now = academyMonth(new Date());
    return [now, nextMonth(now), nextMonth(nextMonth(now))];
  }, []);
  const [month, setMonth] = useState(months[1]);
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [deadline, setDeadline] = useState("");
  const [reason, setReason] = useState(DEFAULT_POSTPONE_REASON_AR);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<SentOffer[]>([]);

  const loadSent = useCallback(() => {
    apiGet<SentOffer[]>("/api/admin/cohort-postpones").then(setSent).catch(() => setSent([]));
  }, []);

  const load = useCallback(() => {
    setRows(null);
    apiGet<Candidate[]>(`/api/admin/cohort-postpones/preview?year=${month.year}&month=${month.month}`)
      .then((r) => {
        setRows(r);
        setPicked(new Set(r.filter((c) => !c.blockedAr).map((c) => c.cohortId)));
        const first = r.find((c) => !c.blockedAr);
        setDeadline(first ? toLocal(defaultDeadline(new Date(), new Date(first.fromFirstAt))) : "");
        setConfirming(false);
      })
      .catch(() => setRows([]));
  }, [month]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSent(); }, [loadSent]);

  const chosen = (rows ?? []).filter((c) => picked.has(c.cohortId));
  const earliest = chosen[0] ? new Date(chosen[0].fromFirstAt) : null;
  const deadlineAt = deadline ? fromLocal(deadline) : null;
  const problem = !deadlineAt ? "اختر موعد المهلة"
    : earliest ? deadlineProblemAr(deadlineAt, new Date(), earliest) : null;

  const toggle = (id: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const send = async () => {
    if (!deadlineAt) return;
    setBusy(true);
    try {
      const r = await apiPost<{ sent: number; skipped: { title: string; reasonAr: string }[] }>("/api/admin/cohort-postpones", {
        cohortIds: chosen.map((c) => c.cohortId), deadlineAt: deadlineAt.toISOString(), reasonAr: reason.trim(),
      });
      const skippedAr = r.skipped.length ? ` · لم يرسل لـ${r.skipped.length}: ${r.skipped.map((s) => `${s.title} (${s.reasonAr})`).join("، ")}` : "";
      onFlash({ kind: "ok", text: `أرسل الاقتراح لمدربي ${r.sent} شعبة${skippedAr}` });
      load(); loadSent(); onChanged();
    } catch (e) {
      onFlash({ kind: "error", text: permissionMessage(e, "تعذر إرسال الاقتراح") });
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id: string) => {
    setBusy(true);
    try {
      await apiPost(`/api/admin/cohort-postpones/${id}/withdraw`);
      onFlash({ kind: "ok", text: "سحبنا الاقتراح — تبقى الشعبة في موعدها" });
      load(); loadSent();
    } catch (e) {
      onFlash({ kind: "error", text: permissionMessage(e, "تعذر سحب الاقتراح") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel as="section" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-black">أجّل شعب شهر إلى الشهر التالي</h2>
          <p className="mt-0.5 text-read text-muted-foreground">نرسل لكل مدرب اقتراحا بموعد جديد. يقبله أو تتوقف الشعبة.</p>
        </div>
        <label className="flex items-center gap-2 text-read">
          <span className="font-bold text-muted-foreground">الشهر</span>
          <span className="block w-40">
            <select value={`${month.year}-${month.month}`} className={staffSelectCls}
              onChange={(e) => setMonth(months.find((m) => `${m.year}-${m.month}` === e.target.value) ?? months[1])}>
              {months.map((m) => <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>{monthAr(m)}</option>)}
            </select>
          </span>
        </label>
      </div>

      {rows === null ? (
        <div className="grid place-items-center py-6"><Loader2 className="h-5 w-5 animate-spin text-teal-ink" /></div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-read text-muted-foreground">لا شعبة لم تبدأ وأول لقاء فيها في {monthAr(month)}.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((c) => (
              <li key={c.cohortId}>
                <Card as="label" className={`flex items-start gap-3 ${c.blockedAr ? "opacity-70" : "cursor-pointer"}`}>
                  <input type="checkbox" className="mt-1 accent-teal" disabled={Boolean(c.blockedAr)}
                    checked={picked.has(c.cohortId)} onChange={() => toggle(c.cohortId)} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{c.title}</span>
                    <span className="block text-read text-muted-foreground">
                      {c.trainersAr.join("، ") || "بلا مدرب"} · المسجلون {c.enrolled}
                    </span>
                    <span className="mt-1 block text-read">
                      الآن <b>{fmtDateTimeAr(c.fromFirstAt)}</b> ← بعد التأجيل <b>{fmtDateTimeAr(c.toFirstAt)}</b>
                      <span className="text-muted-foreground"> ({weeksAr(c.weeks)})</span>
                    </span>
                    {c.blockedAr && <span className="mt-1 block text-read text-gold-ink">{c.blockedAr}</span>}
                  </span>
                </Card>
              </li>
            ))}
          </ul>

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-read font-bold text-muted-foreground">آخر موعد للرد (بتوقيت عمان)</span>
              <input type="datetime-local" dir="ltr" value={deadline} onChange={(e) => { setDeadline(e.target.value); setConfirming(false); }}
                className={`${staffControlCls} text-left`} />
            </label>
            <label>
              <span className="mb-1.5 block text-read font-bold text-muted-foreground">السبب — يصل المدرب كما هو</span>
              <textarea value={reason} onChange={(e) => { setReason(e.target.value); setConfirming(false); }} rows={2} className={staffAreaCls} />
            </label>
          </div>

          <Inset as="ul" className="space-y-1 text-read">
            <li><b>يقبل:</b> تتحرك كل مواعيد الشعبة بنفس اليوم والساعة، ويصل المتعلمين الموعد الجديد.</li>
            <li><b>لا يقبل:</b> تتوقف الشعبة الآن، ويصل متعلميها الخبر.</li>
            <li><b>لا يرد حتى المهلة:</b> تتوقف الشعبة تلقائيا.</li>
          </Inset>

          {problem && chosen.length > 0 && <p className="text-read text-danger-ink" role="alert">{problem}</p>}

          <div className="flex flex-wrap items-center gap-2">
            {!confirming ? (
              <Button tone="primary" disabled={chosen.length === 0 || Boolean(problem) || !reason.trim() || busy}
                onClick={() => setConfirming(true)}>
                أرسل الاقتراح لمدربي {chosen.length} شعبة
              </Button>
            ) : (
              <>
                <span className="text-read font-bold">يصل كل مدرب جرس وبريد الآن. متأكد؟</span>
                <Button tone="primary" loading={busy} onClick={send}>نعم، أرسل</Button>
                <Button tone="secondary" disabled={busy} onClick={() => setConfirming(false)}>تراجع</Button>
              </>
            )}
          </div>
        </>
      )}

      {sent.length > 0 && (
        <div className="space-y-2 border-t border-white/10 pt-3">
          <h3 className="text-read font-bold text-muted-foreground">ما أرسلناه</h3>
          <ul className="space-y-2">
            {sent.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 text-read">
                <Chip tone={STATUS_TONE[o.status]}>{POSTPONE_STATUS_AR[o.status]}</Chip>
                <b>{o.title}</b>
                <span className="text-muted-foreground">
                  {fmtDateTimeAr(o.fromFirstAt)} ← {fmtDateTimeAr(o.toFirstAt)}
                  {o.status === "pending" && ` · المهلة ${fmtDateTimeAr(o.deadlineAt)}`}
                </span>
                {o.status === "pending" && (
                  <Button tone="secondary" size="sm" disabled={busy} onClick={() => withdraw(o.id)}>اسحب الاقتراح</Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
