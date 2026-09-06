/* شاشة دراسة الوحدة — درسٌ واحدٌ في الشاشة، لا جدارُ نصّ.

   كانت الوحدة تُفتح في أكورديون داخل صفحة الدورة: ألفا كلمةٍ وخمسةُ أسئلة
   وسيناريو ونشاطٌ — كلُّه دفعةً واحدة في عمودٍ واحد. فوصفه صاحب المنصّة
   بأنّه ممل، وهو محقّ: القارئُ لا يرى أين هو ولا كم بقي، ولا شيءَ يقول له
   «توقّف هنا واسترجع». وذلك يخالف ما تقوله مهاراتُنا نفسُها عن الحمل
   المعرفيّ والاسترجاع المتباعد.

   فالشاشة هنا مشغّلُ دروس: خطوةٌ في الشاشة، وشريطُ تقدّمٍ يُرى، وبعد كل
   درسٍ سؤالُ استرجاعٍ يخصّه، ثمّ السيناريو، ثمّ النشاطُ والمخرَج. والموضعُ
   يُحفظ فيعود المتعلّم إلى حيث وقف.

   والتقدّم هنا **تقدّمُ قراءةٍ لا تقدّمُ إتمام**: إكمالُ الوحدة يظلّ
   محتاجا دليلا من مدرّبٍ أو تسليمٍ مقبول، ولا يُكتب في حساب المتعلّم من
   هنا. فما يُحفظ محلّيّا موضعُ القراءة وحده. */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock, FileText,
  Loader2, Sparkles, Target,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import LessonBody from "@/components/LessonBody";
import CheckQuestion from "@/components/CheckQuestion";
import ModuleCheck from "@/components/ModuleCheck";
import DecisionScenario from "@/components/DecisionScenario";
import ModuleVideo from "@/components/ModuleVideo";
import PracticeActivity from "@/components/PracticeActivity";
import RubricSelfReview from "@/components/RubricSelfReview";
import { splitLessons } from "@/application/content/lesson-split";
import { parseChecks, type ModuleCheck as Check } from "@/application/content/module-checks";
import { parsePractice } from "@/application/content/practice";
import { usePublishedContent } from "@/services/public-content";
import { useRealSession } from "@/services/session";
import { safeGet, safeSet } from "@/services/safe-storage";
import { track } from "@/services/analytics";
import { countAr } from "@/application/text/count-ar";
import { courseFullById } from "@/data/courses";

import { Panel, Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
/** خطوةٌ في المشغّل: درسٌ، أو سيناريو، أو النشاط والمخرَج */
type Step =
  | { kind: "lesson"; title: string; body: string; minutes: number; checks: Check[] }
  | { kind: "scenario"; raw: string }
  | { kind: "apply" };

/* «١ دقائق قراءة» عربيةٌ مكسورة يراها المتعلّم في أوّل سطر */
const MIN_FORMS = { one: "دقيقة", two: "دقيقتان", few: "دقائق", many: "دقيقة" } as const;

const POS_KEY = (moduleId: string) => `wajeez_module_pos_${moduleId}`;

/** الموضعُ المحفوظ لهذه الوحدة — صفرٌ إن لم يوجد أو تعذّر التخزين */
function readPos(moduleId: string): number {
  const saved = Number(safeGet(POS_KEY(moduleId)) ?? "0");
  return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
}

export default function ModuleStudy() {
  const { courseId = "", moduleId = "" } = useParams();
  const catalogVersion = usePublishedContent();
  const { user, checked } = useRealSession();
  const navigate = useNavigate();

  const full = useMemo(() => { void catalogVersion; return courseFullById(courseId); }, [courseId, catalogVersion]);
  const mod = full?.modules.find((m) => m.id === moduleId) ?? null;
  const modIndex = full?.modules.findIndex((m) => m.id === moduleId) ?? -1;
  const next = full && modIndex >= 0 ? full.modules[modIndex + 1] ?? null : null;

  /* الأسئلة تُوزَّع على الدروس بالترتيب: سؤالٌ (أو اثنان) بعد كلّ درس بدل
     أن تنهال خمسةً في آخر الوحدة. والباقي — إن زاد عن قسمة الدروس — يُعرض
     مع تمرين الوحدة الكامل في آخر خطوةٍ من الدروس. */
  const steps: Step[] = useMemo(() => {
    if (!mod) return [];
    const lessons = splitLessons(mod.body);
    const all = parseChecks(mod.checks).checks.filter((c) => c.chapterIndex === null);
    const out: Step[] = [];
    const per = lessons.length > 0 ? Math.floor(all.length / lessons.length) : 0;
    lessons.forEach((l, i) => {
      const from = i * per;
      const to = i === lessons.length - 1 ? all.length : from + per;
      out.push({ kind: "lesson", title: l.title, body: l.body, minutes: l.minutes, checks: all.slice(from, to) });
    });
    if (mod.scenario) out.push({ kind: "scenario", raw: mod.scenario });
    out.push({ kind: "apply" });
    return out;
  }, [mod]);

  const [at, setAt] = useState(() => readPos(moduleId));
  const [picked, setPicked] = useState<Record<string, number>>({});

  /* الانتقال إلى وحدةٍ أخرى لا يُعيد تركيب المكوّن (المسار نفسُه بمُعامل
     آخر)، فيبقى الموضعُ والإجاباتُ من الوحدة السابقة. وإعادةُ الضبط أثناء
     التصيير هي ما توصي به React لهذه الحالة بعينها — لا تأثيرٌ يُصيّر
     مرّتين. */
  const [seenModule, setSeenModule] = useState(moduleId);
  if (seenModule !== moduleId) {
    setSeenModule(moduleId);
    setAt(readPos(moduleId));
    setPicked({});
  }

  /* الموضعُ المعروض مقيَّدٌ بعدد الخطوات: المخزَّن قد يسبق متنا قُصّر */
  const pos = steps.length > 0 ? Math.min(at, steps.length - 1) : 0;

  useEffect(() => {
    if (steps.length > 0) safeSet(POS_KEY(moduleId), String(pos));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pos, moduleId, steps.length]);

  if (!checked) {
    return <PortalLayout title="الوحدة"><div className="grid place-items-center py-24"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div></PortalLayout>;
  }
  if (!user) { navigate("/auth", { replace: true }); return null; }

  if (!full || !mod) {
    return (
      <PortalLayout title="الوحدة">
        <Panel as="section" className="grid place-items-center py-16 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground" />
          <p className="mt-5 text-sm text-muted-foreground">لم نجد هذه الوحدة في هذه الدورة.</p>
          <Link to={`/student/course/${courseId}`} className="mt-6 rounded-full border border-white/15 px-6 py-3 text-sm font-bold text-foreground hover:border-white/40">
            عُد إلى محطّات الدورة
          </Link>
        </Panel>
      </PortalLayout>
    );
  }

  const lessonCount = steps.filter((s) => s.kind === "lesson").length;
  const step = steps[pos];
  const isLast = pos === steps.length - 1;
  /* زمنُ خطوة النشاط — من النشاط المؤلَّف نفسِه لا من تقديرٍ ثابت، وعشرٌ
     للمراجعة بالروبرك حين يوجد. وكان صفرا فكان الشريطُ يقول للمتعلّم إنّ
     الوحدةَ نصفُ ساعةٍ وهي ساعتان. */
  const applyMinutes =
    (parsePractice(mod.practice).practice?.minutes ?? 0) + (mod.rubric ? 10 : 0);
  const totalMinutes = steps.reduce(
    (s, x) => s + (x.kind === "lesson" ? x.minutes : x.kind === "scenario" ? 10 : applyMinutes),
    0,
  );

  const go = (to: number) => {
    setAt(Math.max(0, Math.min(steps.length - 1, to)));
    track("module_step", { module: moduleId, step: to + 1, of: steps.length });
  };

  return (
    <PortalLayout title={mod.title}>
      {/* شريطُ الموضع — أين أنا، وكم بقي */}
      <nav aria-label="خطوات الوحدة" className="sticky top-16 z-20 -mx-5 mb-6 border-b border-white/10 bg-paper/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <Link to={`/student/course/${courseId}`} className="flex shrink-0 items-center gap-1.5 text-fine font-bold text-muted-foreground transition hover:text-foreground">
            <ArrowRight className="h-3.5 w-3.5" /> محطّات الدورة
          </Link>
          <span className="truncate text-fine text-muted-foreground">
            الوحدة {modIndex + 1} من {full.modules.length} · خطوة {pos + 1} من {steps.length}
            {totalMinutes > 0 && <> · <Clock className="mb-0.5 inline h-3 w-3" /> {countAr(totalMinutes, MIN_FORMS)}</>}
          </span>
        </div>
        <ol className="mt-2.5 flex gap-1.5" aria-hidden="true">
          {steps.map((s, i) => (
            <li
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < pos ? "bg-teal" : i === pos ? "bg-teal-light" : "bg-white/10"
              }`}
              title={s.kind === "lesson" ? s.title : s.kind === "scenario" ? "سيناريو قرار" : "نشاطك ومخرَجك"}
            />
          ))}
        </ol>
      </nav>

      {/* ── وحدةٌ لم يُكتب متنُها بعد ──

          ٣٠٨ وحداتٍ من ٤٠٤ بلا متنِ دراسةٍ ذاتيّة (والعنوانُ والمخرَجُ
          والنشاطُ والمخرَجُ المطلوبُ مؤلَّفةٌ في الأربعِ مئةٍ كلِّها). فكان
          المشغّلُ يُسقط خطوةَ الدرس صامتا ويهبط بالمتعلّم إلى «نشاطك
          ومخرَجك» مباشرةً — **بلا كلمةٍ تقول لماذا**.

          فيقرأ من دفع ثمنَ دورةٍ وحدةً من خطوةٍ واحدة، ويظنّ العطبَ في
          حسابه أو في المنصّة. والحقيقةُ أبسطُ وأصدق: الوحدةُ تُدرَّس مباشرةً
          مع مدرّبها، ومتنُها المكتوبُ قيد التأليف. **وقولُها خيرٌ من إخفائها.** */}
      {lessonCount === 0 && (
        <Card as="p" tone="warn" className="mb-6 flex items-start gap-2 p-4 text-xs leading-7 text-gold-ink">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            متنُ هذه الوحدة المكتوب <b>قيد التأليف</b> — وهي تُدرَّس مع مدرّبك في جلستها.
            ومخرَجُ الوحدة ونشاطُها والمخرَجُ المطلوبُ منك أدناه كما هي.
          </span>
        </Card>
      )}

      {step?.kind === "lesson" && (
        <Panel as="article" className="md:p-9">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-fine font-bold text-teal-light-ink">
            <span className="rounded-full bg-teal/15 px-2.5 py-1">الدرس {pos + 1} من {lessonCount}</span>
            {step.minutes > 0 && <span className="text-muted-foreground">{countAr(step.minutes, MIN_FORMS)} قراءة</span>}
          </p>
          {step.title && <h2 className="mt-3 text-xl font-black leading-snug md:text-2xl">{step.title}</h2>}

          {/* الفيديو مع الدرس الأوّل وحده — لا يتكرّر في كل خطوة */}
          {pos === 0 && mod.video && <ModuleVideo raw={mod.video} checksRaw={mod.checks} moduleId={mod.id} className="mt-5" />}

          <LessonBody body={step.body} className="mt-5 text-base leading-9" />

          {/* استرجاعٌ بعد الدرس مباشرة — لا في آخر الوحدة وحدها */}
          {step.checks.length > 0 && (
            <Card as="section" tone="accent" className="mt-8">
              <p className="flex items-center gap-2 text-xs font-black text-teal-light-ink">
                <Sparkles className="h-3.5 w-3.5" /> استرجعْ قبل أن تمضي
              </p>
              <p className="mt-1 text-fine leading-6 text-muted-foreground">
                لا درجةَ لهذا ولا وزن — الغرضُ أن تُخرِج الفكرة من رأسك لا أن تعيد قراءتها.
              </p>
              <div className="mt-4 space-y-5">
                {step.checks.map((c, i) => {
                  const key = `${pos}-${i}`;
                  return (
                    <div key={key}>
                      <CheckQuestion
                        check={c}
                        index={i + 1}
                        chosen={picked[key]}
                        onPick={(oi) => {
                          if (picked[key] !== undefined) return;
                          setPicked((p) => ({ ...p, [key]: oi }));
                          track("module_check_answered", { module: moduleId, q: key, correct: oi === c.correctIndex });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </Panel>
      )}

      {step?.kind === "scenario" && (
        <Panel as="article" className="md:p-9">
          <p className="text-fine font-bold text-teal-light-ink">
            <span className="rounded-full bg-teal/15 px-2.5 py-1">سيناريو قرار</span>
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            لا إجابةَ واحدة هنا. اختر ما كنت ستفعله فعلا، واقرأ ما يترتّب عليه.
          </p>
          <DecisionScenario raw={step.raw} moduleId={mod.id} className="mt-5" />
        </Panel>
      )}

      {step?.kind === "apply" && (
        <article className="space-y-4">
          {/* النشاطُ المؤلَّف (ح-٦) إن وُجد — وإلّا فعبارةُ الكتالوج، وهي كلُّ
              ما كان يُعرض قبل أن يكون للنشاط حقلٌ يحمله. */}
          {mod.practice ? (
            <PracticeActivity raw={mod.practice} moduleId={mod.id} />
          ) : (
            <>
              <Panel tone="accent" className="md:p-8">
                <p className="flex items-center gap-2 text-xs font-black text-teal-light-ink">
                  <Target className="h-4 w-4" /> نشاطك الآن
                </p>
                <p className="mt-3 text-base leading-9 text-foreground">{mod.activity}</p>
              </Panel>
              <Panel tone="warn" className="md:p-8">
                <p className="flex items-center gap-2 text-xs font-black text-gold-ink">
                  <FileText className="h-4 w-4" /> ما تخرج به — ويدخل ملفّك
                </p>
                <p className="mt-3 text-base leading-9 text-foreground">{mod.artifact}</p>
              </Panel>
            </>
          )}

          {/* المراجعةُ الذاتيّة (ح-٧) — قبل التسليم لا بعد التقييم */}
          {mod.rubric && <RubricSelfReview raw={mod.rubric} moduleId={mod.id} />}

          {/* تمرينُ الوحدة كاملا مع الجدولة المتباعدة — مكانُه بعد الفهم لا قبله */}
          {mod.checks && (
            <Panel className="md:p-8">
              <ModuleCheck raw={mod.checks} moduleId={mod.id} />
            </Panel>
          )}

          <Panel className="text-center md:p-8">
            <CheckCircle2 className="mx-auto h-8 w-8 text-teal-light-ink" />
            <p className="mt-3 text-sm font-black">انتهت قراءةُ هذه الوحدة</p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-muted-foreground">
              وإكمالُها يحتاج دليلا: تسليمٌ مقبول، أو تقييمٌ مجتاز، أو حضورُ جلستها.
              فلا زرَّ «أنهيتُها» تضغطه على نفسك.
            </p>
            {next && (
              <Link
                to={`/student/course/${courseId}/module/${next.id}`}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-teal px-6 py-3 text-sm font-black text-on-teal transition hover:bg-teal-light"
              >
                الوحدة التالية: {next.title}
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}
          </Panel>
        </article>
      )}

      {/* التنقّل — ثابتٌ أسفل الشاشة على الهاتف */}
      <div className="sticky bottom-0 -mx-5 mt-6 flex items-center justify-between gap-3 border-t border-white/10 bg-paper/95 px-5 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
        <Button tone="secondary" type="button"
          onClick={() => go(pos - 1)}
          disabled={pos === 0} className="disabled:cursor-not-allowed disabled:opacity-30">
          <ArrowRight className="h-4 w-4" /> السابق
        </Button>
        {!isLast ? (
          <Button tone="confirm" type="button"
            onClick={() => go(pos + 1)}>
            التالي <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <Link
            to={`/student/course/${courseId}`}
            className="flex items-center gap-2 rounded-full border border-teal/50 px-7 py-2.5 text-xs font-black text-teal-light-ink transition hover:bg-teal/10"
          >
            محطّات الدورة <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
      </div>
    </PortalLayout>
  );
}
