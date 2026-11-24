/* ═══ «اسأل المدربين عن موسم شعبهم» — الربيع أو موسم لاحق أو الإلغاء (٢١ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة وعلّتُه في `src/application/trainer/season-choice.ts`. ولا يُرسل شيءٌ عند النشر: الصندوقُ يعاين
   أوّلا شعبَ الموسم الجاري التي لم تبدأ ومدرّبيها، وأوّلَ لقاءٍ لكلٍّ منها في كلّ موسمٍ يُختار. ثمّ المهلةُ (سبعةُ أيّامٍ
   افتراضا)، وما يقع بكلّ خيارٍ وبالسكوت، ثمّ تأكيدٌ يقول من يصله وما يقع إن لم يختر — والإرسالُ قرارُه هو.

   والمسوّدةُ تُوسَم ولا تُختار سلفا، كما في «أجّل شعب الشهر» (`prePicked`، قرارُه ٢٤ أكتوبر ٢٠٢٦) — و«اختر الكل»
   يضمّها بضغطة إن أراد أن يُسأل كلُّ مدرّبٍ له شعبةٌ لم تبدأ.

   ═══ والرسالةُ نصُّه، ويعاينها قبل الإرسال (٢٤ نوفمبر ٢٠٢٦) ═══
   كتب صاحبُ المنصّة «رسالة الاختيار» بنفسه (`season-choice-mail.ts`)، و«عاين الرسالة» يريه ما يصل أوّلَ مدرّبٍ في اختياره
   باسمه وشعبه — قبل أن يُرسل شيء. */

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiGet, apiPost, permissionMessage } from "@/services/api";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip, { type ChipTone } from "@/components/ui/Chip";
import { staffControlCls } from "@/components/FormKit";
import { fmtDateTimeAr } from "@/utils/format";
import { zonedAt, zonedClock, zonedDay } from "@/application/trainer/cohort-period";
import { NOT_ON_SITE_AR, isOnSite, prePicked, type PostponeStatus } from "@/application/trainer/postpone-offer";
import {
  COHORTS, SEASON_CHOICE_STATUS_AR, SEASON_OUTCOMES_AR, TRAINERS, defaultSeasonDeadline, seasonSendConfirmAr,
} from "@/application/trainer/season-choice";
import { countAr } from "@/application/text/count-ar";

interface Row {
  cohortId: string; title: string; status: string; trainersAr: string[]; enrolled: number;
  firstAt: string | null; targets: { year: number; season: string; firstAt: string | null }[]; blockedAr: string | null;
}
interface Preview {
  source: { year: number; season: string; titleAr: string };
  choices: { year: number; season: string; optionAr: string }[];
  rows: Row[];
}
interface Sent {
  id: string; cohortId: string; title: string; status: PostponeStatus; deadlineAt: string; chosenAr: string | null;
}

const STATUS_TONE: Record<PostponeStatus, ChipTone> = {
  pending: "warn", accepted: "positive", declined: "neutral", expired: "danger", withdrawn: "neutral",
};

/** `datetime-local` بتوقيت الأكاديميّة — لا بتوقيت جهاز من يقرأ */
const toLocal = (d: Date) => `${zonedDay(d)}T${zonedClock(d)}`;
const fromLocal = (v: string) => zonedAt(v.slice(0, 10), v.slice(11, 16));

export default function SeasonChoiceBox({ onChanged, onFlash }: {
  onChanged: () => void;
  onFlash: (f: { kind: "ok" | "error"; text: string }) => void;
}) {
  const [data, setData] = useState<Preview | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [deadline, setDeadline] = useState(() => toLocal(defaultSeasonDeadline(new Date())));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent[]>([]);
  const [mailHtml, setMailHtml] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const loadSent = useCallback(() => {
    apiGet<Sent[]>("/api/admin/cohort-season-choices").then(setSent).catch(() => setSent([]));
  }, []);
  const load = useCallback(() => {
    setData(null);
    apiGet<Preview>("/api/admin/cohort-season-choices/preview")
      .then((p) => { setData(p); setPicked(new Set(prePicked(p.rows))); setConfirming(false); })
      .catch(() => setData({ source: { year: 0, season: "", titleAr: "" }, choices: [], rows: [] }));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSent(); }, [loadSent]);

  const deadlineAt = deadline ? fromLocal(deadline) : null;
  const rows = data?.rows ?? [];
  /** تبدأ قبل المهلة — لا يصلها السؤال، فقد تبدأ قبل أن يختار */
  const tooSoon = (r: Row) => Boolean(deadlineAt && r.firstAt && new Date(r.firstAt).getTime() <= deadlineAt.getTime());
  const chosen = rows.filter((r) => picked.has(r.cohortId) && !tooSoon(r));
  const trainers = new Set(chosen.flatMap((r) => r.trainersAr)).size;
  const problem = !deadlineAt ? "اختر موعد المهلة" : deadlineAt.getTime() <= Date.now() ? "المهلة مضت — اختر موعدا قادما" : null;

  const toggle = (id: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  /** ما يُرسل ويُعاين: الشعبُ والمهلة */
  const mailBody = () => ({ cohortIds: chosen.map((c) => c.cohortId), deadlineAt: deadlineAt!.toISOString() });

  const previewMail = async () => {
    if (!deadlineAt || chosen.length === 0) return;
    setPreviewing(true);
    try {
      const r = await apiPost<{ subject: string; html: string }>("/api/admin/cohort-season-choices/mail-preview", mailBody());
      setMailHtml(r.html);
    } catch (e) {
      onFlash({ kind: "error", text: permissionMessage(e, "تعذرت المعاينة") });
    } finally {
      setPreviewing(false);
    }
  };

  const send = async () => {
    if (!deadlineAt) return;
    setBusy(true);
    try {
      const r = await apiPost<{ sent: number; trainers: number; skipped: { title: string; reasonAr: string }[] }>(
        "/api/admin/cohort-season-choices",
        mailBody(),
      );
      const skippedAr = r.skipped.length ? ` · لم يرسل لـ${r.skipped.length}: ${r.skipped.map((s) => `${s.title} (${s.reasonAr})`).join("، ")}` : "";
      onFlash({ kind: "ok", text: `أرسلنا السؤال عن ${countAr(r.sent, COHORTS)} إلى ${countAr(r.trainers, TRAINERS)}${skippedAr}` });
      load(); loadSent(); onChanged();
    } catch (e) {
      onFlash({ kind: "error", text: permissionMessage(e, "تعذر إرسال السؤال") });
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id: string) => {
    setBusy(true);
    try {
      await apiPost(`/api/admin/cohort-postpones/${id}/withdraw`);
      onFlash({ kind: "ok", text: "سحبنا السؤال — تبقى الشعبة في موعدها" });
      load(); loadSent();
    } catch (e) {
      onFlash({ kind: "error", text: permissionMessage(e, "تعذر سحب السؤال") });
    } finally {
      setBusy(false);
    }
  };

  const short = (optionAr: string) => optionAr.split(" — ")[0];

  return (
    <Panel as="section" className="space-y-3">
      <div>
        <h2 className="font-black">اسأل المدربين عن موسم شعبهم{data?.source.titleAr ? ` — ${data.source.titleAr}` : ""}</h2>
        <p className="mt-0.5 text-read text-muted-foreground">
          لكل شعبة لم تبدأ يختار مدربها: الإلغاء، أو إعادة إطلاقها في {data?.choices.map((c) => short(c.optionAr)).join("، أو ") || "موسم قادم"}.
          تصله رسالة واحدة بكل شعبه.
        </p>
      </div>

      {data === null ? (
        <div className="grid place-items-center py-6"><Loader2 className="h-5 w-5 animate-spin text-teal-ink" /></div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-read text-muted-foreground">لا شعبة لم تبدأ في هذا الموسم.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {rows.some((c) => !isOnSite(c.status)) && (
              <p className="text-read text-muted-foreground">الشعب غير المنشورة لم نخترها. اخترها إن أردت أن يصل مدربها السؤال.</p>
            )}
            <Button tone="secondary" size="sm" onClick={() => setPicked(new Set(rows.filter((r) => !r.blockedAr).map((r) => r.cohortId)))}>
              اختر الكل
            </Button>
          </div>
          <ul className="space-y-2">
            {rows.map((c) => (
              <li key={c.cohortId}>
                <Card as="label" className={`flex items-start gap-3 ${c.blockedAr ? "opacity-70" : "cursor-pointer"}`}>
                  <input type="checkbox" className="mt-1 accent-teal" disabled={Boolean(c.blockedAr)}
                    checked={picked.has(c.cohortId)} onChange={() => { toggle(c.cohortId); setConfirming(false); setMailHtml(null); }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{c.title}</span>
                      {!isOnSite(c.status) && <Chip tone="neutral">{NOT_ON_SITE_AR}</Chip>}
                    </span>
                    <span className="block text-read text-muted-foreground">
                      {c.trainersAr.join("، ") || "بلا مدرب"} · المسجلون {c.enrolled}
                    </span>
                    <span className="mt-1 block text-read">
                      أول لقاء الآن <b>{c.firstAt ? fmtDateTimeAr(c.firstAt) : "لا موعد بعد"}</b>
                    </span>
                    {c.firstAt && (
                      <span className="block text-read text-muted-foreground">
                        {c.targets.map((t, i) => `${short(data.choices[i]?.optionAr ?? t.season)}: ${fmtDateTimeAr(t.firstAt)}`).join(" · ")}
                      </span>
                    )}
                    {c.blockedAr && <span className="mt-1 block text-read text-gold-ink">{c.blockedAr}</span>}
                    {!c.blockedAr && tooSoon(c) && (
                      <span className="mt-1 block text-read text-gold-ink">تبدأ قبل المهلة — لن يصلها السؤال. قدم المهلة إن أردتها.</span>
                    )}
                  </span>
                </Card>
              </li>
            ))}
          </ul>

          <label className="block max-w-xs">
            <span className="mb-1.5 block text-read font-bold text-muted-foreground">آخر موعد للاختيار (بتوقيت عمان)</span>
            <input type="datetime-local" dir="ltr" value={deadline} onChange={(e) => { setDeadline(e.target.value); setConfirming(false); setMailHtml(null); }}
              className={`${staffControlCls} text-left`} />
          </label>

          <Inset as="ul" className="space-y-1 text-read">
            <li><b>يختار الإلغاء:</b> {SEASON_OUTCOMES_AR.cancel}</li>
            <li><b>يختار الربيع:</b> {SEASON_OUTCOMES_AR.season}</li>
            <li><b>لا يرد حتى المهلة:</b> {SEASON_OUTCOMES_AR.silence}</li>
          </Inset>

          <div className="space-y-2" data-testid="season-mail-preview">
            <Button tone="secondary" size="sm" loading={previewing} disabled={chosen.length === 0 || !deadlineAt}
              onClick={() => void previewMail()}>
              عاين الرسالة
            </Button>
            <p className="text-read text-muted-foreground">ترى ما يصل أول مدرب في اختيارك، باسمه وشعبه.</p>
            {mailHtml && (
              <iframe title="معاينة رسالة الموسم" srcDoc={mailHtml} sandbox="" className="h-[32rem] w-full rounded-lg border border-border bg-white" />
            )}
          </div>

          {problem && chosen.length > 0 && <p className="text-read text-danger-ink" role="alert">{problem}</p>}

          <div className="flex flex-wrap items-center gap-2">
            {!confirming ? (
              <Button tone="confirm" disabled={chosen.length === 0 || Boolean(problem) || busy} onClick={() => setConfirming(true)}>
                أرسل السؤال عن {countAr(chosen.length, COHORTS)}
              </Button>
            ) : (
              <>
                <span className="text-read font-bold">{seasonSendConfirmAr(trainers, chosen.length, fmtDateTimeAr(deadlineAt!.toISOString()))}</span>
                <Button tone="confirm" loading={busy} onClick={send}>نعم، أرسل</Button>
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
                <Chip tone={STATUS_TONE[o.status]}>{SEASON_CHOICE_STATUS_AR[o.status]}</Chip>
                <b>{o.title}</b>
                {o.chosenAr && <span>{o.chosenAr}</span>}
                {o.status === "pending" && <span className="text-muted-foreground">المهلة {fmtDateTimeAr(o.deadlineAt)}</span>}
                {o.status === "pending" && (
                  <Button tone="secondary" size="sm" disabled={busy} onClick={() => withdraw(o.id)}>اسحب السؤال</Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
