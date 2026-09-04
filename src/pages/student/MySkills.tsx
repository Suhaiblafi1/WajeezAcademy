/* ملف مهاراتي (البند ط-١) — الأصل الأكبر في المنصة الذي لم يكن يُعرض للمتعلم.
   المنصة تقيس المهارات وتعطيها ٢٥٪ من وزن الترشيح، وفيها أكثر من ٣٠٠ مهارة مصنّفة،
   ولم يكن المتعلم يرى مهاراته إطلاقا. هذه الصفحة تعرض ما قِيس فعلا لا أكثر.

   قواعد الصدق المطبَّقة:
   - غير المقاس لا يُرسم مستوى صفرا — له مجموعة منفصلة صريحة ودعوة لقياسه.
   - التغطية لا تُحتسب بلا مسار: لا بسط مصطنع ولا مقام مصطنع.
   - المصدر هو المحرك نفسه (assessPathwaySkills)، فلا يتباعد المعروض عن المحتسب.
   - لا أسماء مدربين هنا إطلاقا. */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Target, CheckCircle2, HelpCircle, Compass, Sparkles, ArrowLeft, Loader2, BookOpen, TrendingUp, Ruler, Layers,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import SkillMeter from "@/components/SkillMeter";
import { apiGet } from "@/services/api";
import { loadLastResultSafe } from "@/application/diagnostic/session-store";
import { usePublishedContent } from "@/services/public-content";
import {
  buildSkillsProfile, levelLabelAr, pathwayIdFromSnapshot, skillVectorFromSnapshot,
  type MeasuredSkill, type SkillsProfile, type UnmeasuredSkill,
} from "@/application/student/skills-profile";
import {
  buildGrowthSummary, growthBySlug, mergeMeasured,
  type GrowthSummary, type RemeasureRecord,
} from "@/application/student/skill-growth";
import {
  buildRetrievalSummary, type RetrievalCard,
} from "@/application/student/retrieval-schedule";
import SkillDelta from "@/components/SkillDelta";
import { fmtWhen } from "@/utils/format";

const TARGET_NOTE = "المستهدف: ٤ من ٥ — «جيد عمليا»";

/** صف مهارة مقاسة: الاسم · المقياس · المستوى نصا · الدورة التي تغطّيها */
function MeasuredRow({ s, showDelta }: { s: MeasuredSkill; showDelta: boolean }) {
  return (
    <li className="grid grid-cols-1 gap-2 border-t border-white/5 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{s.nameAr}</p>
        {s.coveredBy.length > 0 && (
          <p className="mt-0.5 flex items-start gap-1.5 truncate text-[11px] text-muted-foreground">
            <BookOpen className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">تُدرّسها: {s.coveredBy.map((c) => c.titleAr).join(" · ")}</span>
          </p>
        )}
      </div>
      <SkillMeter level={s.level} />
      <p className="flex flex-wrap items-center gap-2 text-xs tabular-nums text-foreground">
        <span>{levelLabelAr(s.level)}</span>
        {/* شارة النمو (ح-٧): تُعرض لمن أُعيد قياسه فقط، ولا تُصطنع لغيره */}
        {s.growth && s.growth.delta !== null && s.growth.delta !== 0 && (
          <span
            className={`rounded-full border px-2 py-0.5 text-micro font-bold ${
              s.growth.delta > 0 ? "border-teal/50 text-teal-light-ink" : "border-white/25 text-foreground"
            }`}
            title={s.growth.courseTitleAr ? `قياس بعديّ بعد «${s.growth.courseTitleAr}»` : "قياس بعديّ"}
          >
            كنت {s.growth.beforeLevel} صرت {s.level}
          </span>
        )}
        {showDelta && s.toTarget > 0 && (
          <span className="rounded-full border border-gold/40 px-2 py-0.5 text-micro font-bold text-gold-ink">
            يحتاج <span dir="ltr">+{s.toTarget}</span>
          </span>
        )}
      </p>
    </li>
  );
}

function Section({
  icon: Icon, title, count, note, children,
}: {
  icon: typeof Target; title: string; count: number; note: string; children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-black">
          <Icon className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />
          {title}
          <span className="rounded-full bg-teal-ink/15 px-2 py-0.5 text-[11px] tabular-nums text-teal-light-ink">{count}</span>
        </h2>
        <p className="text-[11px] text-muted-foreground">{note}</p>
      </div>
      <ul className="mt-3">{children}</ul>
    </section>
  );
}

/** رقم واحد بارز — التغطية هي ما يحكم كم يثق التشخيص بترشيحه */
function Hero({ p }: { p: SkillsProfile }) {
  const pct = p.coverage === null ? null : Math.round(p.coverage * 100);
  return (
    <section className="rounded-3xl border border-teal/30 bg-teal-ink/[0.07] p-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs text-muted-foreground">{pct === null ? "مهارات قِيست لك" : "تغطية القياس على متطلبات مسارك"}</p>
          <p className="mt-1 text-5xl font-black leading-none text-teal-light-ink">
            {pct === null ? p.measuredCount : `${pct}٪`}
          </p>
          {pct !== null && (
            <p className="mt-2 text-xs tabular-nums text-muted-foreground">
              قِيست {p.requiredCount - p.unmeasured.length} من {p.requiredCount} مهارة يتطلبها المسار
            </p>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-5 text-center">
          {[
            { k: "فجوات", v: p.gap.length },
            { k: "في الطريق", v: p.onTrack.length },
            { k: "متقنة", v: p.mastered.length },
          ].map((t) => (
            <div key={t.k}>
              <dd className="text-2xl font-black tabular-nums">{t.v}</dd>
              <dt className="mt-0.5 text-[11px] text-muted-foreground">{t.k}</dt>
            </div>
          ))}
        </dl>
      </div>
      {p.pathwayTitleAr && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          مقيسة على متطلبات
          <Link to={`/pathways/${p.pathwayId}`} className="font-bold text-teal-light-ink underline-offset-4 hover:underline">
            {p.pathwayTitleAr}
          </Link>
        </p>
      )}
    </section>
  );
}

function Unmeasured({ rows }: { rows: UnmeasuredSkill[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-6 rounded-3xl border border-gold/30 bg-gold/[0.06] p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-black">
        <HelpCircle className="h-4 w-4 text-gold-ink" aria-hidden="true" />
        لم تُقس بعد
        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] tabular-nums text-gold-ink">{rows.length}</span>
      </h2>
      <p className="mt-2 text-xs leading-6 text-foreground">
        هذه مهارات يتطلبها مسارك ولم يسألك المؤشر عنها. لا نفترض لك فيها مستوى — لا مرتفعا ولا منخفضا.
        وكلما قِيس أكثر، ارتفعت ثقة التوصية.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {rows.map((s) => (
          <li key={s.slug} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-foreground">
            {s.nameAr}
          </li>
        ))}
      </ul>
      <Link
        to="/diagnostic"
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-gold px-5 text-sm font-black text-on-gold transition hover:bg-gold/90"
      >
        أكمل جولة التعمق لقياسها
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

interface GrowthPayload {
  records: RemeasureRecord[];
  nameBySlug: Record<string, string>;
  invites: { enrollmentId: string; courseId: string; cohortTitle: string }[];
}

/** نموك المقيس (ح-٧) — الفرق بين ما قِيس قبل الدورة وما قِيس بعدها */
function GrowthPanel({ summary }: { summary: GrowthSummary }) {
  if (!summary.hasData) return null;
  return (
    <section className="mt-6 rounded-3xl border border-teal/30 bg-teal-ink/[0.07] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-black">
          <Ruler className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />
          نموك المقيس بعد الدورات
        </h2>
        <p className="text-[11px] text-muted-foreground">قياس بالسلّم نفسه قبل الدورة وبعدها — لا وصف</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "مهارة ارتفعت", v: String(summary.improved), ltr: false },
          { k: "بلغت المستهدف", v: String(summary.crossedTarget), ltr: false },
          /* dir=ltr على الرقم المُوقَّع: بلا ذلك يُعرض «+4» بصورة «4+» */
          { k: "مجموع الدرجات", v: `${summary.netPoints > 0 ? "+" : ""}${summary.netPoints}`, ltr: true },
          { k: "تراجعت", v: String(summary.declined), ltr: false },
        ].map((t) => (
          <div key={t.k} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <dd className="text-2xl font-black tabular-nums" dir={t.ltr ? "ltr" : undefined}>{t.v}</dd>
            <dt className="mt-0.5 text-[11px] text-muted-foreground">{t.k}</dt>
          </div>
        ))}
      </dl>

      {summary.courses.map((c) => (
        <div key={c.courseId} className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
            <span className="font-bold text-foreground">{c.courseTitleAr ?? c.courseId}</span>
            {/* ‎/55 لا ‎/45: الأخيرة تقيس 4.45:1 على سطح البطاقة فتسقط دون 4.5 */}
            <span className="text-muted-foreground">قِيس في {fmtWhen(c.measuredAt)}</span>
          </p>
          <ul className="mt-2">
            {c.skills.map((g) => (
              <SkillDelta key={g.slug} g={g} />
            ))}
          </ul>
        </div>
      ))}

      {summary.firstMeasured > 0 && (
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          {summary.firstMeasured} مهارة قِيست أول مرة بعد الدورة — بلا مرجع قبليّ، فلا تدخل حساب الفرق.
        </p>
      )}
    </section>
  );
}

/** شريط المراجعة المستحقة (ح-٤) — سطر واحد لا لوحة: البطاقات مربوطة بمهارات،
    فمكان التذكير بها هو ملف المهارات. ولا يظهر السطر بلا استحقاق. */
function DueReviewStrip({ due }: { due: number }) {
  if (due <= 0) return null;
  return (
    <Link
      to="/student/review"
      className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal/30 bg-teal-ink/[0.07] px-5 py-4 transition hover:border-teal/60"
    >
      <span className="flex items-center gap-2 text-sm font-bold">
        <Layers className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
        <span className="tabular-nums text-teal-light-ink">{due}</span>
        بطاقة استرجاع استحقّت اليوم
      </span>
      <span className="flex items-center gap-1.5 text-xs font-bold text-teal-light-ink">
        اذهب إلى «تثبيتُ ما تعلّمت»
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

/** دعوة القياس البعديّ — لدورات أتمّها المتعلم ولم يُقس نموه فيها بعد */
function GrowthInvites({ invites }: { invites: GrowthPayload["invites"] }) {
  if (invites.length === 0) return null;
  return (
    <section className="mt-6 rounded-3xl border border-gold/30 bg-gold/[0.06] p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-black">
        <Ruler className="h-4 w-4 text-gold-ink" aria-hidden="true" />
        أتممت دورة — قِس نموك فيها
        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] tabular-nums text-gold-ink">{invites.length}</span>
      </h2>
      <p className="mt-2 text-xs leading-6 text-foreground">
        قِيست مهاراتك قبل الدورة. أعد القياس الآن بالسلّم نفسه ليُحفظ الفرق — مرة واحدة لكل دورة.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {invites.map((i) => (
          <li key={i.enrollmentId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="min-w-0 truncate text-xs font-bold text-foreground">{i.cohortTitle}</span>
            <Link
              to={`/student/remeasure/${i.enrollmentId}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gold px-5 text-xs font-black text-on-gold transition hover:bg-gold/90"
            >
              ابدأ القياس
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function MySkills() {
  const catalogVersion = usePublishedContent();
  const [server, setServer] = useState<{ done: boolean; snapshot: unknown }>({ done: false, snapshot: null });
  const [growth, setGrowth] = useState<GrowthPayload>({ records: [], nameBySlug: {}, invites: [] });
  const [dueReview, setDueReview] = useState(0);

  /* لقطة الخادم تعبر الأجهزة — نطلبها مرة، ونتابع بلا حجب لو تعذّرت.
     والقياس البعديّ (ح-٧) يُجلب معها بالتوازي: فشله لا يحجب ملف المهارات. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const safe = async <T,>(pr: Promise<T>): Promise<T | null> => pr.then((v) => v).catch(() => null);
      const [prof, grw, ret] = await Promise.all([
        safe(apiGet<{ profile?: { diagnosticSnapshot?: unknown } }>("/api/learner/profile")),
        safe(apiGet<GrowthPayload>("/api/learner/skill-growth")),
        safe(apiGet<{ cards: RetrievalCard[] }>("/api/learner/retrieval")),
      ]);
      if (!alive) return;
      setServer({ done: true, snapshot: prof?.profile?.diagnosticSnapshot ?? null });
      setGrowth({
        records: grw?.records ?? [],
        nameBySlug: grw?.nameBySlug ?? {},
        invites: grw?.invites ?? [],
      });
      /* الاستحقاق يُحسب على لحظة الجلب لا على ساعة كل رسم */
      setDueReview(buildRetrievalSummary(ret?.cards ?? [], new Date()).due);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ⚠ النتيجة المحلية تُقرأ بعد تثبيت الكتالوج لا قبله (البند ع-١): قبل التثبيت
     لا تُعرف المسارات الصالحة فتُرفض كل نتيجة. لذا القراءة داخل useMemo المرتبط
     بنسخة الكتالوج، لا في useEffect يسبقه. */
  const snapshot = useMemo(() => {
    if (!server.done || catalogVersion === 0) return undefined;
    const local = loadLastResultSafe();
    const localSnap = local.status === "ok" || local.status === "migrated" ? local.result : null;
    return Object.keys(skillVectorFromSnapshot(server.snapshot)).length > 0
      ? server.snapshot
      : (localSnap ?? server.snapshot);
  }, [server, catalogVersion]);

  const summary = useMemo(
    () => buildGrowthSummary(growth.records, growth.nameBySlug),
    [growth],
  );

  const profile = useMemo(() => {
    /* الكتالوج يُحمَّل كسولا (ع-١): تغيّر نسخته يعيد الحساب بعد وصول المهارات والدورات */
    void catalogVersion;
    if (snapshot === undefined) return null;
    /* القياس البعديّ أحدث من التشخيص فيغلب في العرض — ولا تُعاد كتابة اللقطة نفسها:
       تلك سجل تاريخي، وهذا ما عليه المتعلم الآن. */
    const vector = mergeMeasured(skillVectorFromSnapshot(snapshot), growth.records);
    const pathwayId = pathwayIdFromSnapshot(snapshot) ?? null;
    return buildSkillsProfile(vector, pathwayId, growthBySlug(summary));
  }, [snapshot, catalogVersion, growth.records, summary]);

  if (profile === null) {
    return (
      <PortalLayout title="ملف مهاراتي">
        <div className="grid place-items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="جارٍ التحميل" />
        </div>
      </PortalLayout>
    );
  }

  if (!profile.hasData) {
    return (
      <PortalLayout title="ملف مهاراتي">
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-black">لا قياس بعد</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
            يُبنى ملف مهاراتك من مؤشر وجيز — أسئلة قصيرة تقيس مستواك الحالي في مهارات مسارك.
            لا نعرض هنا رقما لم نقسه.
          </p>
          <Link
            to="/diagnostic"
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-gold px-6 text-sm font-black text-on-gold transition hover:bg-gold/90"
          >
            ابدأ مؤشر وجيز
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <DueReviewStrip due={dueReview} />
        <GrowthInvites invites={growth.invites} />
        <GrowthPanel summary={summary} />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="ملف مهاراتي">
      <Hero p={profile} />
      <DueReviewStrip due={dueReview} />
      <GrowthInvites invites={growth.invites} />
      <GrowthPanel summary={summary} />

      <Section
        icon={Target}
        title="فجواتك — ابدأ من هنا"
        count={profile.gap.length}
        note={TARGET_NOTE}
      >
        {profile.gap.map((s) => (
          <MeasuredRow key={s.slug} s={s} showDelta />
        ))}
      </Section>

      <Section icon={TrendingUp} title="في الطريق" count={profile.onTrack.length} note={TARGET_NOTE}>
        {profile.onTrack.map((s) => (
          <MeasuredRow key={s.slug} s={s} showDelta />
        ))}
      </Section>

      <Section
        icon={CheckCircle2}
        title="تُتقنها أصلا"
        count={profile.mastered.length}
        note="لن نعيد تعليمك إياها — تُحسب لك في اختيار الدورات"
      >
        {profile.mastered.map((s) => (
          <MeasuredRow key={s.slug} s={s} showDelta={false} />
        ))}
      </Section>

      <Unmeasured rows={profile.unmeasured} />

      <Section
        icon={Sparkles}
        title="رصيد خارج مسارك"
        count={profile.outsidePathway.length}
        note="قِيست لك ولا يتطلبها هذا المسار — لا تُحسب في التغطية"
      >
        {profile.outsidePathway.map((s) => (
          <MeasuredRow key={s.slug} s={s} showDelta={false} />
        ))}
      </Section>

      <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4 text-[11px] leading-relaxed text-muted-foreground">
        سلّم القياس خمس درجات: لا يعرفها · مبتدئ · يستخدمها أحيانا · جيد عمليا · متقدم.
        وتُصنَّف المهارة فجوةً دون «يستخدمها أحيانا»، ومتقنةً من «جيد عمليا» — وهو الحدّ نفسه
        الذي يستعمله المؤشر في حساب الترشيح، فلا يختلف ما تراه عما احتُسب لك.
      </p>
    </PortalLayout>
  );
}
