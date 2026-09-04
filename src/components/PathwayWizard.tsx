/* ج-٣ · معالج إضافة مسار من خمس خطوات.

   السبب: إضافة مسار تتطلب خمسة مواضع، ونقصُ واحدٍ ينتج «جوكرا» — كيانا بلا
   جمهور ينافس كل مستخدم، أو كيانا بلا مجال يُنشر ولا يُوصى به أبدا. النموذج
   المسطّح كان يقبل النقص، فيظهر العطل في تدقيق بعد أسابيع.

   قرار صريح عن الخطوة الخامسة: خطة البند تقول «زر واحد: انشر». والنشر من هذه
   الشاشة **مستحيل بحكم الحوكمة القائمة**: كل كيان معتمد يحتاج طلب تغيير معتمدا
   من شخص آخر (maker-checker)، والاعتماد الذاتي مرفوض في admin.decide. فالزر
   الأخير «قدّم للاعتماد»، ومعه سطر يقول من ينشر بعدك ولماذا ليس أنت. زرُّ نشرٍ
   يفشل دائما أسوأ من زرٍّ صادق. */

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck, Target } from "lucide-react";
import {
  EMPTY_DRAFT, WIZARD_STEPS, blockersOf, goalOptions, personaOptions, stagesOf,
  unreachableGoals, type WizardDraft, type WizardStepKey,
} from "@/application/catalog/pathway-wizard";
import { domainsV2 } from "@/domain/diagnostic/v2/data";
import { apiPost, apiGet, ApiError } from "@/services/api";
import { toast } from "@/components/Toast";

interface CourseOption { id: string; title: string }

interface Impact {
  runId: string; changedCount: number; totalPersonas: number; changed: { name: string }[]
  verdictAr?: string
}
interface Readiness {
  ok: boolean
  steps: { key: string; labelAr: string; ok: boolean; reasonAr: string }[]
}

const inputCls = "w-full rounded-xl border border-white/10 bg-paper/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/75 outline-none focus:border-gold/60";

const CHIP = (on: boolean) =>
  `cursor-pointer rounded-full border px-3 py-1 text-[11px] font-bold transition ${
    on ? "border-gold bg-gold/15 text-gold-ink" : "border-white/15 text-muted-foreground hover:border-white/40"
  }`;

export default function PathwayWizard({ courses, onDone }: { courses: CourseOption[]; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<WizardDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* المسار يُنشأ عند مغادرة الخطوة الرابعة — قبلها لا صفّ في القاعدة */
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  const key = WIZARD_STEPS[step].key as WizardStepKey;
  const blockers = useMemo(() => blockersOf(key, d), [key, d]);
  const unreachable = useMemo(() => unreachableGoals(d), [d]);
  const stages = useMemo(() => stagesOf(d.personas), [d.personas]);
  const personas = useMemo(() => personaOptions(), []);
  const goals = useMemo(() => goalOptions(), []);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(null); }
  };

  /* إنشاء المسودة كاملة في نداء واحد: بياناتها ودوراتها ومجالاتها وجمهورها —
     فلا يوجد مسار أُنشئ ثم ضاع جمهوره لأن الشاشة أُغلقت بين ندائين. */
  const createDraft = () => run("create", async () => {
    const body = {
      id: d.id.trim(), title: d.title.trim(),
      shortTitle: d.shortTitle.trim() || undefined,
      audience: d.audience.trim(),
      beforeText: d.beforeText.trim(), afterText: d.afterText.trim(),
      durationWeeks: d.durationWeeks ? Number(d.durationWeeks) : undefined,
      weeklyHours: d.weeklyHours.trim() || undefined,
      level: d.level.trim() || undefined,
      capstone: d.capstone.trim() || undefined,
      courseIds: d.courseIds,
      domainIds: d.domainIds,
      personas: d.personas,
      goals: d.goals,
      minWeeklyLoad: d.minWeeklyLoad || undefined,
      notesAr: d.notesAr.trim() || undefined,
    };
    const res = await apiPost<{ id: string }>("/api/admin/catalog/pathways", body);
    setCreatedId(res.id);
    setReadiness(await apiGet<Readiness>(`/api/admin/catalog/pathways/${res.id}/readiness`));
    setStep(4);
  });

  const checkImpact = () => run("impact", async () => {
    if (!createdId) return;
    setImpact(await apiPost<Impact>(`/api/admin/catalog/pathways/${createdId}/impact`));
    setReadiness(await apiGet<Readiness>(`/api/admin/catalog/pathways/${createdId}/readiness`));
  });

  const submitForReview = () => run("submit", async () => {
    if (!createdId) return;
    await apiPost("/api/admin/catalog/change-requests", {
      entityType: "pathway", entityId: createdId,
      payload: { action: "create", personas: d.personas, goals: d.goals, domainIds: d.domainIds, courseIds: d.courseIds },
    });
    toast("قُدّم المسار للاعتماد — ينشره مراجع آخر");
    onDone();
  });

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
      {/* شريط الخطوات — الحالة الحقيقية لكل خطوة لا ترقيم أعمى */}
      <ol className="mb-6 flex flex-wrap gap-2">
        {WIZARD_STEPS.map((s, i) => {
          const done = i < step;
          const now = i === step;
          return (
            <li key={s.key} className="flex items-center gap-2">
              {i > 0 && <ArrowLeft className="h-3 w-3 text-muted-foreground/50" aria-hidden="true" />}
              <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
                now ? "border-gold bg-gold/15 text-gold-ink"
                  : done ? "border-emerald-400/40 text-emerald-300"
                  : "border-white/12 text-muted-foreground"
              }`}>
                {done ? <Check className="h-3 w-3" aria-hidden="true" /> : <span>{i + 1}</span>}
                {s.labelAr}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mb-4 text-[11px] text-muted-foreground">{WIZARD_STEPS[step].hintAr}</p>

      {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {/* ١ · بيانات المسار */}
      {key === "basics" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={d.id} onChange={(e) => setD({ ...d, id: e.target.value })} placeholder="المعرف — PW-XXX-000" dir="ltr" className={inputCls} />
          <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="عنوان المسار" className={inputCls} />
          <input value={d.shortTitle} onChange={(e) => setD({ ...d, shortTitle: e.target.value })} placeholder="اسم مختصر (اختياري)" className={inputCls} />
          <input value={d.level} onChange={(e) => setD({ ...d, level: e.target.value })} placeholder="المستوى (اختياري)" className={inputCls} />
          <input value={d.audience} onChange={(e) => setD({ ...d, audience: e.target.value })} placeholder="لمن هذا المسار؟ بجملة مفهومة" className={`${inputCls} sm:col-span-2`} />
          <input value={d.beforeText} onChange={(e) => setD({ ...d, beforeText: e.target.value })} placeholder="الحال قبل المسار" className={inputCls} />
          <input value={d.afterText} onChange={(e) => setD({ ...d, afterText: e.target.value })} placeholder="الحال بعد المسار" className={inputCls} />
          <input value={d.durationWeeks} onChange={(e) => setD({ ...d, durationWeeks: e.target.value })} type="number" min={1} placeholder="المدة بالأسابيع (اختياري)" className={inputCls} />
          <input value={d.weeklyHours} onChange={(e) => setD({ ...d, weeklyHours: e.target.value })} placeholder="الساعات الأسبوعية (اختياري)" className={inputCls} />
          <input value={d.capstone} onChange={(e) => setD({ ...d, capstone: e.target.value })} placeholder="المشروع الختامي (اختياري)" className={`${inputCls} sm:col-span-2`} />
        </div>
      )}

      {/* ٢ · الدورات */}
      {key === "courses" && (
        <>
          <p className="mb-2 text-xs font-black text-foreground">دورات المسار ({d.courseIds.length}) — بالترتيب الذي تختاره به</p>
          <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto">
            {courses.map((c) => (
              <button key={c.id} type="button" onClick={() => setD({ ...d, courseIds: toggle(d.courseIds, c.id) })}
                className={CHIP(d.courseIds.includes(c.id))}>
                {d.courseIds.includes(c.id) && <span className="ml-1">{d.courseIds.indexOf(c.id) + 1}.</span>}
                {c.title} <span className="font-mono text-muted-foreground" dir="ltr">({c.id})</span>
              </button>
            ))}
            {courses.length === 0 && <span className="text-[11px] text-muted-foreground">أنشئ دورات أولا من نموذج الدورة.</span>}
          </div>
        </>
      )}

      {/* ٣ · الجمهور والهدف */}
      {key === "profile" && (
        <div className="space-y-5">
          <div>
            <p className="mb-1 text-xs font-black text-foreground">الشخصيات ({d.personas.length}) — إلزامي</p>
            <p className="mb-2 text-[11px] leading-6 text-muted-foreground">
              الشخصية تفتح المراحل المهنية التي يُرشَّح لها المسار. والفراغ لا يعني «الكل بحذر» — يعني أن المسار
              يطابق كل شخصية بلا قيد، فينافس من لا يناسبه.
            </p>
            <div className="flex flex-wrap gap-2">
              {personas.map((p) => (
                <button key={p.key} type="button" title={`المراحل: ${p.stages.join("، ")}`}
                  onClick={() => setD({ ...d, personas: toggle(d.personas, p.key) })} className={CHIP(d.personas.includes(p.key))}>
                  {p.labelAr}
                </button>
              ))}
            </div>
            {stages.length > 0 && (
              <p className="mt-2 rounded-xl border border-white/10 bg-paper/20 px-3 py-2 text-[11px] leading-6 text-foreground">
                <Target className="mb-0.5 me-1 inline h-3.5 w-3.5 text-teal-light-ink" aria-hidden="true" />
                يفتح {stages.length} مرحلة مهنية: <span dir="ltr" className="font-mono">{stages.join(" · ")}</span>
              </p>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs font-black text-foreground">الأهداف ({d.goals.length}) — إلزامي</p>
            <p className="mb-2 text-[11px] leading-6 text-muted-foreground">
              الأهداف المعروضة هي ما يستطيع تدفق التشخيص إنتاجه فعلا — مشتقة من المحرك لا مكتوبة يدويا.
            </p>
            <div className="flex flex-wrap gap-2">
              {goals.map((g) => (
                <button key={g.legacy} type="button" onClick={() => setD({ ...d, goals: toggle(d.goals, g.legacy) })}
                  className={CHIP(d.goals.includes(g.legacy))}>
                  {g.labelAr}
                </button>
              ))}
            </div>
            {unreachable.length > 0 && (
              <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[11px] leading-6 text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>أهداف لا يُنتجها التدفق الحالي: <span dir="ltr" className="font-mono">{unreachable.join(" · ")}</span> — تُحفظ ولا تمنع، لكن المسار لن يُرشَّح منها؛ يبقى المجال والمهارة والمرحلة.</span>
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input value={d.minWeeklyLoad} onChange={(e) => setD({ ...d, minWeeklyLoad: e.target.value })} placeholder="أدنى عبء أسبوعي — 3_4 (اختياري)" dir="ltr" className={inputCls} />
            <input value={d.notesAr} onChange={(e) => setD({ ...d, notesAr: e.target.value })} placeholder="ملاحظة المؤلّف (اختياري)" className={inputCls} />
          </div>
        </div>
      )}

      {/* ٤ · المجال */}
      {key === "domains" && (
        <>
          <p className="mb-1 text-xs font-black text-foreground">مجالات المسار ({d.domainIds.length}) — إلزامي</p>
          <p className="mb-2 text-[11px] leading-6 text-muted-foreground">
            المجال هو الباب الذي يدخل منه المسار إلى التوصية: يُطابَق بهدف المتعلم ووظيفته.
            بلا مجال يُنشر المسار ولا يُوصى به أبدا — ولذلك لا يجتاز حاجز النشر.
            {d.domainIds.length > 1 && " الأول في اختيارك هو الأقرب."}
          </p>
          <div className="flex flex-wrap gap-2">
            {domainsV2.map((dm) => (
              <button key={dm.id} type="button" title={dm.desc_ar}
                onClick={() => setD({ ...d, domainIds: toggle(d.domainIds, dm.id) })} className={CHIP(d.domainIds.includes(dm.id))}>
                {d.domainIds.includes(dm.id) && <span className="ml-1">{d.domainIds.indexOf(dm.id) + 1}.</span>}
                {dm.name_ar}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ٥ · الأثر والمراجعة */}
      {key === "review" && (
        <div className="space-y-4">
          <p className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 px-4 py-3 text-xs leading-6 text-emerald-300">
            أُنشئ المسار <span dir="ltr" className="font-mono">{createdId}</span> كمسودة بجمهوره ومجالاته ودوراته.
          </p>

          {readiness && (
            <div className="rounded-2xl border border-white/10 bg-paper/20 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-black text-foreground">
                <ShieldCheck className="h-4 w-4 text-gold-ink" aria-hidden="true" /> الجاهزية — نفس ما يفحصه حاجز النشر
              </p>
              <ul className="space-y-1.5">
                {readiness.steps.map((s) => (
                  <li key={s.key} className="flex items-start gap-2 text-[11px] leading-6">
                    <span className={s.ok ? "text-emerald-300" : "text-amber-300"} aria-hidden="true">{s.ok ? "✓" : "•"}</span>
                    <span className="font-bold text-foreground">{s.labelAr}:</span>
                    <span className={s.ok ? "text-muted-foreground" : "text-amber-300"}>{s.reasonAr}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button disabled={busy !== null} onClick={checkImpact}
            className="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm font-bold hover:border-gold/60 disabled:opacity-40">
            {busy === "impact" ? "يحاكي ١٢ شخصية…" : impact ? "أعِد فحص الأثر" : "افحص الأثر التشخيصي"}
          </button>

          {impact && (
            <div className="rounded-2xl border border-white/10 bg-paper/20 p-4 text-xs leading-6 text-foreground">
              <p className="font-bold">تغيّرت توصية {impact.changedCount} من {impact.totalPersonas} شخصية.</p>
              {impact.changed.map((c) => <p key={c.name} className="text-amber-300">• {c.name}</p>)}
              {impact.changedCount === 0 && (
                <p className="mt-1 text-muted-foreground">
                  لا تغيير على الشخصيات الاثنتي عشرة — طبيعيٌّ لمسار جديد لا ينافس أحدا بعد،
                  والأثر يظهر حين يصبح منشورا ويدخل المنافسة.
                </p>
              )}
            </div>
          )}

          <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[11px] leading-6 text-foreground">
            لا يُنشر المسار من هنا: كل كيان معتمد يحتاج طلب تغيير يعتمده <strong>شخص آخر</strong>
            {" "}(maker-checker) — واعتماد الذات مرفوض. الزر التالي يقدّمه للاعتماد، ثم يَنشره
            المعتمد من «النشر والإصدارات» بعد اجتياز البوابة كاملة.
          </p>
        </div>
      )}

      {/* ما يمنع الانتقال — مكتوبا بأثره لا برقم حقل */}
      {blockers.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
          {blockers.map((b) => (
            <li key={b} className="flex items-start gap-2 text-[11px] leading-6 text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {b}
            </li>
          ))}
        </ul>
      )}

      {/* التنقل */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {step > 0 && !createdId && (
          <button onClick={() => setStep(step - 1)} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-bold hover:border-white/40">
            <ArrowRight className="h-4 w-4" aria-hidden="true" /> السابق
          </button>
        )}
        {step < 3 && (
          <button disabled={blockers.length > 0} onClick={() => setStep(step + 1)}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-gold px-6 py-2 text-sm font-black text-on-gold disabled:opacity-40">
            التالي <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {step === 3 && (
          <button disabled={blockers.length > 0 || busy !== null} onClick={createDraft}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-gold px-6 py-2 text-sm font-black text-on-gold disabled:opacity-40">
            {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            أنشئ المسودة وافحص الأثر
          </button>
        )}
        {step === 4 && (
          <button disabled={busy !== null || !impact} onClick={submitForReview}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-gold px-6 py-2 text-sm font-black text-on-gold disabled:opacity-40">
            {busy === "submit" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            قدّم للاعتماد
          </button>
        )}
        {step === 4 && !impact && (
          <span className="text-[11px] text-muted-foreground">افحص الأثر أولا — لا يُقدَّم مسار لم يُعرف أثره.</span>
        )}
      </div>
    </div>
  );
}
