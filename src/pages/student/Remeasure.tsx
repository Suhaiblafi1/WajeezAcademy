/* إعادة قياس المهارة بعد إتمام الدورة (البند ح-٧) — الشاشة التي تغلق الدائرة
   بين التشخيص والتعلم: قِيست مهاراتك قبل الدورة، وتُقاس بعدها، ويُحفظ الفرق.

   قواعد الصدق التي تُعلَن هنا صراحةً للمتعلم، لا في الكود وحده:
   - لا قياس قبل إتمام معتمد. سبب الإغلاق يُكتب كما هو لا «قريبا».
   - القياس مرة واحدة: يُقال قبل الإرسال، فلا يُفاجأ أحد بـ٤٠٩.
   - المستوى «قبل» معروض بجانب كل مهارة — لا نسأل في العتمة.
   - لا نسأل عمّا لا تُدرّسه الدورة، ولا نلوّن جوابا «صحيحا»: هذا قياس لا اختبار. */

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, Lock, Loader2, Ruler, TriangleAlert } from "lucide-react";
import PortalLayout from "./PortalLayout";
import SkillMeter from "@/components/SkillMeter";
import SkillDelta from "@/components/SkillDelta";
import { apiGet, apiPost } from "@/services/api";
import { fmtWhen } from "@/utils/format";
import { LEVEL_LABELS_AR, levelLabelAr } from "@/application/student/skills-profile";
import {
  REMEASURE_MAX, REMEASURE_MIN, buildGrowthSummary, validateRemeasure,
  type GrowthSummary, type RemeasureRecord, type RemeasureRow,
} from "@/application/student/skill-growth";

interface Eligibility {
  enrollmentId: string;
  courseId: string;
  courseTitleAr: string | null;
  cohortTitle: string;
  gate: { open: boolean; reasonAr: string };
  form: { rows: RemeasureRow[]; measurable: boolean; skillsSource: "db" | "catalog" };
  measuredAt: string | null;
  alreadyMeasured: boolean;
  measured: { skillSlug: string; beforeLevel: number | null; afterLevel: number }[];
}

const LEVELS = Array.from({ length: REMEASURE_MAX }, (_, i) => i + REMEASURE_MIN);

/** صف قياس: خمسة أزرار اختيار حقيقية — يعملان بلوحة المفاتيح وبقارئ الشاشة */
function MeasureRow({
  row, value, onPick,
}: { row: RemeasureRow; value: number | null; onPick: (level: number) => void }) {
  return (
    <li className="border-t border-white/5 py-4 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold">{row.nameAr}</p>
        {row.beforeLevel === null ? (
          <span className="text-fine text-muted-foreground">لم يقسها المؤشر قبل الدورة</span>
        ) : (
          <span className="flex items-center gap-2 text-fine text-muted-foreground">
            قبل الدورة: {levelLabelAr(row.beforeLevel)}
            <span className="w-16">
              <SkillMeter level={row.beforeLevel} className="opacity-45" />
            </span>
          </span>
        )}
      </div>
      <fieldset className="mt-3">
        <legend className="sr-only">مستواك الآن في {row.nameAr}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {LEVELS.map((lvl) => {
            const active = value === lvl;
            return (
              <label
                key={lvl}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-xs transition ${
                  active ? "border-teal bg-teal-ink/15 font-bold text-foreground" : "border-white/10 text-foreground hover:border-white/30"
                }`}
              >
                <input
                  type="radio"
                  name={`skill-${row.slug}`}
                  value={lvl}
                  checked={active}
                  onChange={() => onPick(lvl)}
                  className="h-4 w-4 shrink-0 accent-teal"
                />
                <span className="tabular-nums">{lvl}</span>
                <span className="truncate">{LEVEL_LABELS_AR[lvl - 1]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </li>
  );
}

/** لوحة النتيجة بعد الحفظ — أو بعد فتح صفحة قِيست سابقا */
function Result({ summary, courseTitle }: { summary: GrowthSummary; courseTitle: string }) {
  const c = summary.courses[0];
  if (!c) return null;
  return (
    <section className="rounded-3xl border border-teal/30 bg-teal-ink/[0.07] p-6">
      <h2 className="flex items-center gap-2 text-lg font-black">
        <CheckCircle2 className="h-5 w-5 text-teal-light-ink" aria-hidden="true" />
        هذا ما تغيّر بعد «{courseTitle}»
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { k: "ارتفعت", v: String(c.improved), ltr: false },
          { k: "بلغت المستهدف", v: String(c.crossedTarget), ltr: false },
          /* dir=ltr على الرقم المُوقَّع فلا يُقرأ «+4» بصورة «4+» */
          { k: "مجموع الدرجات", v: `${c.netPoints > 0 ? "+" : ""}${c.netPoints}`, ltr: true },
          { k: "تراجعت", v: String(c.declined), ltr: false },
        ].map((t) => (
          <div key={t.k} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <dd className="text-2xl font-black tabular-nums" dir={t.ltr ? "ltr" : undefined}>{t.v}</dd>
            <dt className="mt-0.5 text-fine text-muted-foreground">{t.k}</dt>
          </div>
        ))}
      </dl>
      <ul className="mt-5">
        {c.skills.map((s) => (
          <SkillDelta key={s.slug} g={s} />
        ))}
      </ul>
      {c.firstMeasured > 0 && (
        <p className="mt-4 text-fine leading-relaxed text-muted-foreground">
          {c.firstMeasured} مهارة قِيست هنا أول مرة — لا مرجع قبليّ لها، فلا تدخل حساب الفرق.
          لو أكملت جولة التعمق في المؤشر قبل دورتك القادمة، صار لها فرق يُقاس.
        </p>
      )}
      <Link
        to="/student/skills"
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-gold px-6 text-sm font-black text-on-gold transition hover:bg-gold/90"
      >
        اذهب إلى ملف مهاراتي
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

export default function Remeasure() {
  const { enrollmentId = "" } = useParams();
  const [data, setData] = useState<Eligibility | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<RemeasureRecord[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await apiGet<Eligibility>(`/api/learner/enrollments/${enrollmentId}/skill-remeasure`).catch(
        (e: unknown) => (e instanceof Error ? e.message : "تعذر تحميل استمارة القياس"),
      );
      if (!alive) return;
      if (typeof r === "string") setLoadError(r);
      else setData(r);
    })();
    return () => { alive = false; };
  }, [enrollmentId]);

  const rows = data?.form.rows ?? [];
  const complete = rows.length > 0 && rows.every((r) => levels[r.slug] !== undefined);

  /* السجلات المعروضة: ما حُفظ الآن، أو ما كان محفوظا من قبل */
  const shownRecords: RemeasureRecord[] | null = useMemo(() => {
    if (saved) return saved;
    if (!data?.alreadyMeasured) return null;
    return data.measured.map((m) => ({
      courseId: data.courseId,
      skillSlug: m.skillSlug,
      beforeLevel: m.beforeLevel,
      afterLevel: m.afterLevel,
      measuredAt: data.measuredAt ?? "",
    }));
  }, [saved, data]);

  /* الاعتماد على data لا على rows: المصفوفة تُبنى في كل رسم فتُبطل الذاكرة عبثا */
  const summary = useMemo(() => {
    if (!shownRecords) return null;
    const names = Object.fromEntries((data?.form.rows ?? []).map((r) => [r.slug, r.nameAr]));
    return buildGrowthSummary(shownRecords, names);
  }, [shownRecords, data]);

  const submit = async () => {
    const check = validateRemeasure(levels, rows.map((r) => r.slug));
    if (!check.ok) {
      setSaveError(check.errorsAr.join(" · "));
      return;
    }
    setSaving(true);
    setSaveError(null);
    const res = await apiPost<{ records: RemeasureRecord[] }>(
      `/api/learner/enrollments/${enrollmentId}/skill-remeasure`,
      { levels: check.clean },
    ).catch((e: unknown) => (e instanceof Error ? e.message : "تعذر حفظ القياس"));
    setSaving(false);
    if (typeof res === "string") setSaveError(res);
    else setSaved(res.records);
  };

  if (loadError) {
    return (
      <PortalLayout title="قياس نموي">
        <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">{loadError}</p>
      </PortalLayout>
    );
  }

  if (!data) {
    return (
      <PortalLayout title="قياس نموي">
        <div className="grid place-items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="جارٍ التحميل" />
        </div>
      </PortalLayout>
    );
  }

  const courseTitle = data.courseTitleAr ?? data.cohortTitle;

  return (
    <PortalLayout title="قياس نموي">
      {summary ? (
        <>
          <Result summary={summary} courseTitle={courseTitle} />
          {data.measuredAt && !saved && (
            <p className="mt-4 text-fine text-muted-foreground">قِيس هذا النمو في {fmtWhen(data.measuredAt)} — ويُقاس مرة واحدة لكل دورة.</p>
          )}
        </>
      ) : (
        <>
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h1 className="flex items-center gap-2 text-lg font-black">
              <Ruler className="h-5 w-5 text-teal-light-ink" aria-hidden="true" />
              أعد قياس مهاراتك بعد «{courseTitle}»
            </h1>
            <p className="mt-3 text-sm leading-7 text-foreground">
              قِيست مهاراتك قبل الدورة بمؤشر وجيز، والآن نقيسها بعدها بالسلّم نفسه — فيظهر الفرق مقيسا
              لا موصوفا. الإجابة تقديرك أنت لمستواك الآن: لا صحيح ولا خطأ هنا، والرقم يُحفظ
              <span className="font-bold text-foreground"> مرة واحدة </span>
              فاختر بصدق.
            </p>
            {!data.gate.open && (
              <p className="mt-4 flex items-start gap-2 rounded-2xl border border-gold/30 bg-gold/[0.07] px-4 py-3 text-xs leading-6 text-foreground">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />
                <span>{data.gate.reasonAr} — لأن فرقا بلا إتمام لا يدل على شيء.</span>
              </p>
            )}
            {!data.form.measurable && (
              <p className="mt-4 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-6 text-foreground">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />
                لا مهارات مصنّفة مرتبطة بهذه الدورة بعد — فلا قياس بعديّ لها.
              </p>
            )}
          </section>

          {data.gate.open && data.form.measurable && (
            <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
              <h2 className="text-sm font-black">
                مستواك الآن في {rows.length} مهارة
                <span className="ms-2 rounded-full bg-teal-ink/15 px-2 py-0.5 text-fine tabular-nums text-teal-light-ink">
                  {Object.keys(levels).length}/{rows.length}
                </span>
              </h2>
              <ul className="mt-2">
                {rows.map((r) => (
                  <MeasureRow
                    key={r.slug}
                    row={r}
                    value={levels[r.slug] ?? null}
                    onPick={(lvl) => setLevels((prev) => ({ ...prev, [r.slug]: lvl }))}
                  />
                ))}
              </ul>
              {saveError && (
                <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">{saveError}</p>
              )}
              {/* العدد المتبقي في سطر كامل التباين لا داخل زر معطَّل باهت:
                  التوجيه لا يُدفن في عنصر خامل. */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!complete || saving}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-gold px-6 text-sm font-black text-on-gold transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  احفظ القياس واعرض الفرق
                </button>
                {!complete && (
                  <p className="text-xs font-bold text-foreground">
                    بقيت {rows.length - Object.keys(levels).length} مهارة بلا جواب
                  </p>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </PortalLayout>
  );
}
