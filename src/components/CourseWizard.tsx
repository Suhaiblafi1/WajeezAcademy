/* معالج إضافة دورة من أربع خطوات — بديل النموذج المسطّح الواحد الذي كان
   يحشر المسار والاسم والساعات والمهارات والوحدات كلّها في شاشة تمرير طويلة.

   نفس مبدأ PathwayWizard: خطوة لا تُفتح إلا بعد اكتمال ما يمنع التالية،
   وتعليمة قصيرة فوق كل خطوة بلغة غير تقنية — لا مصطلح برمجي. */

import { useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2 } from "lucide-react";
import {
  COURSE_WIZARD_STEPS, EMPTY_COURSE_DRAFT, EMPTY_MODULE, courseBlockersOf,
  type CourseWizardDraft, type CourseWizardStepKey,
} from "@/application/catalog/course-wizard";
import SkillPicker from "@/components/SkillPicker";
import type { SkillMeasureState } from "@/application/catalog/skill-measurement";
import { apiPost, ApiError } from "@/services/api";
import { toast } from "@/components/Toast";

interface PathwayOption { id: string; title: string }
interface SkillRow {
  id: string; status: string; slug: string; nameAr: string; familyId: string | null;
  measureState?: SkillMeasureState; measuredBy?: string | null; measureNoteAr?: string;
}

const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-gold/60";
const selectCls = `${inputCls} [&>option]:bg-surface`;

export default function CourseWizard({ pathways, skills, onDone, onRequestSkill }: {
  pathways: PathwayOption[];
  skills: SkillRow[];
  onDone: () => void;
  onRequestSkill: (input: { slug: string; nameAr: string; reasonAr: string }) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<CourseWizardDraft>(EMPTY_COURSE_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = COURSE_WIZARD_STEPS[step].key as CourseWizardStepKey;
  const blockers = courseBlockersOf(key, d);
  const toggleSkill = (id: string) =>
    setD({ ...d, skillIds: d.skillIds.includes(id) ? d.skillIds.filter((x) => x !== id) : [...d.skillIds, id] });

  const create = async () => {
    setBusy(true); setError(null);
    try {
      await apiPost("/api/admin/catalog/courses", {
        id: d.id.trim(), pathwayId: d.pathwayId, sequence: Number(d.sequence) || 1,
        titleAr: d.titleAr.trim(), shortPromiseAr: d.shortPromiseAr.trim() || undefined,
        levelAr: d.levelAr.trim() || undefined, totalHours: Number(d.totalHours),
        skillIds: d.skillIds,
        modules: d.modules.map((m, i) => ({
          sequence: i + 1, titleAr: m.titleAr.trim(),
          outcomeAr: m.outcomeAr.trim() || undefined, activityAr: m.activityAr.trim() || undefined,
          artifactAr: m.artifactAr.trim() || undefined, bodyAr: m.bodyAr.trim() || undefined,
          checksAr: m.checksAr.trim() || undefined, videoAr: m.videoAr.trim() || undefined,
          scenarioAr: m.scenarioAr.trim() || undefined, hours: Number(m.hours) || 1,
        })),
      });
      toast("أُنشئت الدورة كمسودة مرتبطة بالمسار والمهارات — أكمل سير الاعتماد ثم النشر");
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "فشل إنشاء الدورة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
      {/* شريط الخطوات */}
      <ol className="mb-6 flex flex-wrap gap-2">
        {COURSE_WIZARD_STEPS.map((s, i) => {
          const done = i < step;
          const now = i === step;
          return (
            <li key={s.key} className="flex items-center gap-2">
              {i > 0 && <ArrowLeft className="h-3 w-3 text-white/25" aria-hidden="true" />}
              <button
                type="button"
                disabled={i > step}
                onClick={() => { if (i < step) setStep(i); }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
                  i < step ? "cursor-pointer" : "cursor-default"
                } ${
                  now ? "border-gold bg-gold/15 text-gold-ink"
                    : done ? "border-emerald-400/40 text-emerald-300"
                    : "border-white/12 text-white/50"
                }`}>
                {done ? <Check className="h-3 w-3" aria-hidden="true" /> : <span>{i + 1}</span>}
                {s.labelAr}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mb-4 text-[11px] text-white/60">{COURSE_WIZARD_STEPS[step].hintAr}</p>

      {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {/* ١ · بيانات الدورة */}
      {key === "basics" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input value={d.id} onChange={(e) => setD({ ...d, id: e.target.value })} placeholder="المعرّف — CRS-XXX-000" dir="ltr" className={inputCls} />
          <select value={d.pathwayId} onChange={(e) => setD({ ...d, pathwayId: e.target.value })} className={selectCls}>
            <option value="">المسار الأم…</option>
            {pathways.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.id})</option>)}
          </select>
          <input value={d.sequence} onChange={(e) => setD({ ...d, sequence: e.target.value })} type="number" min={1} placeholder="الترتيب في المسار" className={inputCls} />
          <input value={d.titleAr} onChange={(e) => setD({ ...d, titleAr: e.target.value })} placeholder="اسم الدورة" className={`${inputCls} sm:col-span-2`} />
          <input value={d.totalHours} onChange={(e) => setD({ ...d, totalHours: e.target.value })} type="number" min={1} placeholder="إجمالي الساعات" className={inputCls} />
          <input value={d.shortPromiseAr} onChange={(e) => setD({ ...d, shortPromiseAr: e.target.value })} placeholder="الوعد المختصر (اختياري)" className={`${inputCls} sm:col-span-2`} />
          <input value={d.levelAr} onChange={(e) => setD({ ...d, levelAr: e.target.value })} placeholder="المستوى (اختياري)" className={inputCls} />
        </div>
      )}

      {/* ٢ · الوحدات */}
      {key === "modules" && (
        <div className="space-y-3">
          {d.modules.map((m, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-white/50">الوحدة {i + 1}</span>
                {d.modules.length > 1 && (
                  <button type="button" onClick={() => setD({ ...d, modules: d.modules.filter((_, j) => j !== i) })} className="cursor-pointer text-white/40 hover:text-red-300">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <input value={m.titleAr} onChange={(e) => setD({ ...d, modules: d.modules.map((x, j) => (j === i ? { ...x, titleAr: e.target.value } : x)) })} placeholder="عنوان الوحدة" className={inputCls} />
                <input value={m.hours} onChange={(e) => setD({ ...d, modules: d.modules.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)) })} type="number" min={1} placeholder="الساعات" className={inputCls} />
                <input value={m.outcomeAr} onChange={(e) => setD({ ...d, modules: d.modules.map((x, j) => (j === i ? { ...x, outcomeAr: e.target.value } : x)) })} placeholder="المخرج (اختياري)" className={inputCls} />
                <input value={m.activityAr} onChange={(e) => setD({ ...d, modules: d.modules.map((x, j) => (j === i ? { ...x, activityAr: e.target.value } : x)) })} placeholder="النشاط (اختياري)" className={inputCls} />
                <input value={m.artifactAr} onChange={(e) => setD({ ...d, modules: d.modules.map((x, j) => (j === i ? { ...x, artifactAr: e.target.value } : x)) })} placeholder="الأثر/التسليمة (اختياري)" className={inputCls} />
              </div>
              <textarea
                value={m.bodyAr}
                onChange={(e) => setD({ ...d, modules: d.modules.map((x, j) => (j === i ? { ...x, bodyAr: e.target.value } : x)) })}
                rows={6}
                placeholder="متن الدرس (اختياري) — # عنوان · - قائمة · > اقتباس · **عريض** · [نص](رابط) · ```كود```"
                className={`${inputCls} mt-2 w-full font-mono leading-7`}
              />
              <p className="mt-1 text-micro leading-5 text-white/50">
                ما يُكتب هنا يظهر للمتعلم درسا داخل الدورة. يمرّ بنفس حاكمية النسخ والاعتماد والنشر — ولا يُعدَّل على إصدار منشور بأثر رجعي.
              </p>
              <textarea
                value={m.checksAr}
                onChange={(e) => setD({ ...d, modules: d.modules.map((x, j) => (j === i ? { ...x, checksAr: e.target.value } : x)) })}
                rows={5}
                placeholder={"تمرين استرجاع (اختياري)\nس: نص السؤال\n- خيار\n+ الخيار الصحيح\nش: شرح الخطأ"}
                className={`${inputCls} mt-2 w-full font-mono leading-7`}
              />
              <p className="mt-1 text-micro leading-5 text-white/50">
                ثلاثة أسئلة كافية. علامة <span dir="ltr" className="font-mono">+</span> قبل الجواب الصحيح — واحد فقط لكل سؤال، والصيغة تُتحقَّق عند الحفظ.
                ولربط سؤال بفصل فيديو أضف سطر <span dir="ltr" className="font-mono">ف: 2</span> داخله فيصير نقطة تفتيش بعد الفصل الثاني.
              </p>
              <textarea
                value={m.videoAr}
                onChange={(e) => setD({ ...d, modules: d.modules.map((x, j) => (j === i ? { ...x, videoAr: e.target.value } : x)) })}
                rows={4}
                placeholder={"فيديو الوحدة (اختياري)\nhttps://www.youtube.com/watch?v=…\n0:00 عنوان الفصل الأول\n2:30 عنوان الفصل الثاني"}
                dir="ltr"
                className={`${inputCls} mt-2 w-full font-mono leading-7`}
              />
              <p className="mt-1 text-micro leading-5 text-white/50">
                السطر الأول رابط YouTube أو Vimeo عبر https — لا مضيف آخر. ثم سطر لكل فصل بصيغة «د:ث عنوان الفصل».
              </p>
              <textarea
                value={m.scenarioAr}
                onChange={(e) => setD({ ...d, modules: d.modules.map((x, j) => (j === i ? { ...x, scenarioAr: e.target.value } : x)) })}
                rows={8}
                placeholder={"سيناريو قرار (اختياري)\nموقف: وصف الموقف المهني\n\nعقدة: البداية\nنص: ما أول ما تفعله؟\n> خيار: نص الخيار\n  أثر: ما ترتب عليه\n  إلى: عنوان العقدة التالية\n\nعقدة: عنوان العقدة التالية\nنص: النتيجة\nتأمل: سؤال التأمل"}
                className={`${inputCls} mt-2 w-full font-mono leading-7`}
              />
              <p className="mt-1 text-micro leading-5 text-white/50">
                كل عقدة غير نهائية تحتاج خيارين على الأقل، و«إلى:» لا تشير إلا إلى عقدة موجودة،
                والعقدة النهائية (بلا خيارات) تحتاج «تأمل:». يُتحقَّق المسار كاملا عند الحفظ:
                عقدة لا تُبلَغ أو مسار يدور بلا نهاية يُرفض.
              </p>
            </div>
          ))}
          <button type="button" onClick={() => setD({ ...d, modules: [...d.modules, EMPTY_MODULE] })}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-xs font-bold text-white/60 hover:border-white/40">
            <Plus className="h-3.5 w-3.5" /> وحدة إضافية
          </button>
        </div>
      )}

      {/* ٣ · المهارات */}
      {key === "skills" && (
        <SkillPicker skills={skills} selectedIds={d.skillIds} onToggle={toggleSkill} onRequestSkill={onRequestSkill} />
      )}

      {/* ٤ · المراجعة والإنشاء */}
      {key === "review" && (
        <div className="space-y-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="font-black">{d.titleAr || "—"} <span dir="ltr" className="font-mono text-[11px] text-white/50">({d.id})</span></p>
            <p className="mt-1 text-[11px] text-white/55">
              المسار: {pathways.find((p) => p.id === d.pathwayId)?.title ?? "—"} · {d.totalHours || 0} ساعة · {d.modules.length} وحدة · {d.skillIds.length} مهارة
            </p>
          </div>
          <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[11px] leading-6 text-white/70">
            تُنشأ الدورة مسودة، ثم تمرّ بسير الاعتماد المعتاد (مراجعة فاعتماد فنشر) من «النشر والإصدارات» — لا تُنشر من هنا.
          </p>
        </div>
      )}

      {blockers.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
          {blockers.map((b) => (
            <li key={b} className="flex items-start gap-2 text-[11px] leading-6 text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {b}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-bold hover:border-white/40">
            <ArrowRight className="h-4 w-4" aria-hidden="true" /> السابق
          </button>
        )}
        {step < COURSE_WIZARD_STEPS.length - 1 ? (
          <button disabled={blockers.length > 0} onClick={() => setStep(step + 1)}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-gold px-6 py-2 text-sm font-black text-on-gold disabled:opacity-40">
            التالي <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button disabled={busy} onClick={() => void create()}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-gold px-6 py-2 text-sm font-black text-on-gold disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null} أنشئ المسودة
          </button>
        )}
      </div>
    </div>
  );
}
