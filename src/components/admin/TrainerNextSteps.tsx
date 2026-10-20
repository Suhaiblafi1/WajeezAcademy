/* ═══ ما بقي عليك بعد الاعتماد الأخير — في الموضع الذي اعتُمد فيه (٣ أكتوبر ٢٠٢٦) ═══

   سار صاحبُ المنصّة في المسار حتّى آخره: اعتمد آخرَ خطّةٍ لمدرّب الإعداد ففُعِّل،
   ثمّ لا شيءَ يقول ما بقي. وبقي قراران: شعبُه مسوّداتٌ تُفتح بقرارٍ منفصل
   («2-b») — وتُولَد بلا سعة، فيردّ أوّلُ «افتح الشعبة» بـ«لا سعة محددة» —
   واسمُه لا يظهر للعامّة حتّى يُعتمَد نشرُه (`publishApprovedAt`).

   واختار («3a») لوحا هنا: لكلّ شعبةٍ سعتُها مملوءةً سلفا و«افتحها»، و«اعتمِد
   ظهورَه العامّ». والقرارُ بعدُ له: لكلّ زرٍّ أثرُه مكتوبا قبله، وتركُه الآن
   خيارٌ قائمٌ يُقال (قاعدةُ «لا إجبار») — والبابان باقيان في بطاقة الشعبة
   و«المدربون». والفتحُ بالبابين القائمين نفسَيهما (السعةُ ثمّ الفتح)،
   فشروطُ الفتح هي هي ولا يُفتح من هنا ما لا يُفتح من البطاقة. */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { apiGet, apiPatch, apiPost, ApiError } from "@/services/api";
import { useRealSession } from "@/services/session";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffControlCls } from "@/components/FormKit";
import { OPEN_GAP } from "@/application/learning/open-gaps";

interface NextSteps {
  trainer: { profileId: string; name: string; active: boolean; publiclyVisible: boolean };
  suggestedCapacity: number;
  cohorts: {
    id: string; title: string; capacity: number | null; startsAt: string | null;
    price: number | null; currency: string;
    /** نواقصُ الفتح بشروطه (`openChecklist`) */
    missing: string[];
  }[];
}

/** النقصُ الذي يُوفى في اللوح نفسِه — وما سواه بابُه بطاقةُ الشعبة */
const CAPACITY_GAP: string = OPEN_GAP.capacity;

type Said = { ok: boolean; text: string };

export default function TrainerNextSteps({ cohortId }: { cohortId: string }) {
  const { user } = useRealSession();
  const can = (p: string) => user?.permissions.includes(p) ?? false;
  /* الفتحُ بابان: السعةُ (`cohort.manage`) ثمّ الفتح (`cohort.open`) */
  const canOpen = can("cohort.open") && can("cohort.manage");
  const canPublish = can("trainer.publish");
  const [steps, setSteps] = useState<NextSteps | null>(null);
  const [capacity, setCapacity] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<Record<string, Said>>({});
  const load = useCallback(async () => {
    try { setSteps(await apiGet<NextSteps | null>(`/api/admin/cohorts/${cohortId}/next-steps`)); }
    catch { setSteps(null); }
  }, [cohortId]);
  useEffect(() => { void load(); }, [load]);
  if (!steps) return null;

  const tell = (key: string, s: Said) => setSaid((prev) => ({ ...prev, [key]: s }));

  const openCohort = async (c: NextSteps["cohorts"][number]) => {
    const n = Number((capacity[c.id] ?? String(c.capacity ?? steps.suggestedCapacity)).trim());
    if (!Number.isInteger(n) || n < 1) { tell(c.id, { ok: false, text: "السعة عدد صحيح من ١ فأكثر" }); return; }
    setBusy(c.id);
    let stored = false;
    try {
      if (n !== c.capacity) { await apiPatch(`/api/admin/cohorts/${c.id}`, { capacity: n }); stored = true; }
      await apiPost(`/api/admin/cohorts/${c.id}/open`);
      tell(c.id, { ok: true, text: `فتحت بسعة ${n} — التسجيل متاح الآن` });
    } catch (e) {
      const why = e instanceof ApiError ? e.message : "تعذّر الفتح";
      /* والسعةُ إن حُفظت ثمّ ردّ الفتحُ — تُقال: حُفظت، ولم تُفتح لسببه */
      tell(c.id, { ok: false, text: stored ? `حفظت السعة (${n})، ولم تفتح: ${why}` : why });
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    setBusy("publish");
    try {
      await apiPost(`/api/admin/trainers/${steps.trainer.profileId}/publish-approval`);
      tell("publish", { ok: true, text: "اعتمد ظهوره العامّ — اسمه وسيرته ظاهران للعامّة، ووصله الخبر" });
    } catch (e) {
      tell("publish", { ok: false, text: e instanceof ApiError ? e.message : "تعذّر الاعتماد" });
    } finally {
      setBusy(null);
    }
  };

  const nothingLeft = steps.cohorts.length === 0 && steps.trainer.publiclyVisible;
  if (nothingLeft) return null;

  /* ═══ ولا تُفتح شعبةُ مدرّبٍ لم يفعّل بعد (١٨ أكتوبر ٢٠٢٦) ═══
     صار اللوحُ يظهر على كلّ خطّةٍ معتمَدة، ومنها خططُ مدرّبٍ في طور الإعداد. وأوّلُ دورةٍ تُعتمَد له تفعّله (٢٠ أكتوبر
     ٢٠٢٦، `trainer-prep.service.ts`) — فلا يبقى هنا إلّا من منع تفعيلَه مانع: يُقال ذلك ولا يُعرض فتحٌ ولا ظهور. */
  if (!steps.trainer.active) {
    return steps.cohorts.length === 0 ? null : (
      <Inset className="mt-3" role="region" aria-label="ما بقي عليك">
        <p className="text-read leading-6 text-muted-foreground">
          {steps.trainer.name} لم يفعّل بعد. تفتح شعبه المعتمدة بعد تفعيله من ملفّه.
        </p>
      </Inset>
    );
  }

  return (
    <Inset className="mt-3" role="region" aria-label="ما بقي عليك">
      <p className="text-read font-black text-foreground">ما بقي لك</p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        {steps.trainer.name} مدرّب نشط. افتح شعبه المعتمدة الآن، أو لاحقا من بطاقة كل شعبة.
      </p>

      {steps.cohorts.length > 0 && (
        <div className="mt-3">
          <p className="text-read font-bold text-foreground">شعبه — مسوّدات لا يسجّل فيها أحد حتّى تفتحها</p>
          <ul className="mt-2 space-y-2">
            {steps.cohorts.map((c) => {
              const others = c.missing.filter((m) => m !== CAPACITY_GAP);
              const done = said[c.id]?.ok === true;
              return (
                <Inset as="li" key={c.id}>
                  <p className="text-read font-bold text-foreground">{c.title}</p>
                  <p className="mt-0.5 text-read text-muted-foreground">
                    {c.startsAt ? <>تبدأ {cohortDayAr(c.startsAt)}</> : "بلا تاريخ بدء بعد"}
                    {c.price !== null && <> · {c.price} {c.currency}</>}
                  </p>
                  {done ? (
                    <p className="mt-2 flex items-center gap-1.5 text-read font-bold text-teal-light-ink" role="status">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {said[c.id]!.text}
                    </p>
                  ) : others.length > 0 ? (
                    /* نقصٌ لا يُوفى هنا — يُسمّى بأسمائه، وبابُه البطاقة */
                    <div className="mt-2 text-read leading-6">
                      <p className="text-gold-ink">لا تفتح بعد — ينقصها: {others.join(" · ")}</p>
                      <Link to={`/admin/cohorts?cohort=${c.id}`} className="mt-1 inline-flex items-center gap-1 font-bold text-teal-light-ink">
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> أكملها من بطاقتها
                      </Link>
                    </div>
                  ) : canOpen ? (
                    <div className="mt-2">
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="text-fine text-muted-foreground">
                          السعة
                          <input type="number" min={1} inputMode="numeric"
                            value={capacity[c.id] ?? String(c.capacity ?? steps.suggestedCapacity)}
                            onChange={(e) => setCapacity((prev) => ({ ...prev, [c.id]: e.target.value }))}
                            className={`${staffControlCls} mt-1 w-28`} aria-label={`سعة ${c.title}`} />
                        </label>
                        <Button tone="confirm" size="sm" disabled={busy !== null} onClick={() => void openCohort(c)}>
                          افتحها للتسجيل
                        </Button>
                      </div>
                      <p className="mt-1.5 text-read leading-6 text-muted-foreground">
                        تقبل المسجّلين حتّى تمتلئ — أو اتركها مسوّدة وافتحها لاحقا من بطاقتها.
                      </p>
                      {said[c.id] && !said[c.id]!.ok && (
                        <p className="mt-1.5 text-read font-bold text-red-300" role="alert">{said[c.id]!.text}</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-read text-muted-foreground">فتحها لمن يملك صلاحيّة فتح الشعب.</p>
                  )}
                </Inset>
              );
            })}
          </ul>
        </div>
      )}

      {!steps.trainer.publiclyVisible && (
        <div className="mt-3">
          <p className="text-read font-bold text-foreground">ظهوره للعامّة</p>
          {said.publish?.ok ? (
            <p className="mt-1 flex items-center gap-1.5 text-read font-bold text-teal-light-ink" role="status">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {said.publish.text}
            </p>
          ) : (
            <>
              <p className="mt-1 text-read leading-6 text-muted-foreground">
                لا يظهر اسمه على الموقع حتّى تعتمد نشره. «اعتمد ظهوره العامّ» يوثّق ملفّه ويظهر اسمه وسيرته وصورته في صفحاته — أو اعتمده لاحقا من «المدربون».
              </p>
              {canPublish ? (
                <Button tone="secondary" size="sm" className="mt-2" disabled={busy !== null} onClick={() => void publish()}>
                  اعتمد ظهوره العامّ
                </Button>
              ) : (
                <p className="mt-1 text-read text-muted-foreground">اعتماده لمن يملك صلاحيّة النشر.</p>
              )}
              {said.publish && !said.publish.ok && (
                <p className="mt-1.5 text-read font-bold text-red-300" role="alert">{said.publish.text}</p>
              )}
            </>
          )}
        </div>
      )}
    </Inset>
  );
}
