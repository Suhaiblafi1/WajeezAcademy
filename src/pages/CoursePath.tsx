/* «ابنِ مسارك» — مسار يبدأ بدورة واحدة.

   المشكلة التي حلّها: «تفاصيل الدورة» كانت نافذة صغيرة تعرض المحاور والمخرج،
   وزرُّها الوحيد «سجّل في الدورة» ينقل المتعلم إلى صفحة المسار كاملا. فمن أراد
   دورة واحدة وجد ستّ دورات وسعر مسار، ولم يجد بابا يبني به تركيبته الخاصة.

   هذه الصفحة تعامل الدورة التي فتحها بوصفها مسارا من دورة واحدة: تفاصيلها
   كاملة كما هي في الكتالوج (وصف ومخرجات ووحدات ومشروع)، ثم اقتراحات مرتّبة
   بأسبابها، ثم سعر يتبع القاعدة التي نطقها المالك: ما دام المجموع دون سعر
   المسار فهو السعر ولا يُذكر سعر المسار؛ فإذا بلغه صار المسار هو السعر.

   وله أن يسمّي تركيبته — تُحفظ عندنا لعلّها تصير مسارا معتمدا للعامة. */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowRight, BookOpen, CheckCircle2, Clock3, CreditCard, Layers, ListChecks,
  Plus, Route as RouteIcon, Save, Target, Trash2, User, Sparkles,
} from "lucide-react";
import SeoHead from "@/components/SeoHead";
import AuthGate from "@/components/AuthGate";
import Modal from "@/components/Modal";
import StripeCheckout from "@/components/StripeCheckout";
import { Button } from "@/components/ui/button";
import { usePublishedContent } from "@/services/public-content";
import { usePriceFormatter } from "@/services/currency";
import { track } from "@/services/analytics";
import { grantEnrollment } from "@/services/access";
import { bundleNudge, pathPricing, suggestNext, BUNDLE_MIN_COURSES } from "@/application/catalog/course-path";
import { savePathDraft } from "@/services/path-drafts";
import {
  courseById, courseFullById, coursePriceOf, courseDetails,
  pathwayCourses, weeksLabel, type Course,
} from "@/data/courses";
import { hasCoreCatalog } from "@/data/core-catalog-source";

function readUserName(): string | null {
  try {
    const raw = localStorage.getItem("wajeez_user");
    if (!raw) return null;
    const u = JSON.parse(raw) as { name?: string };
    return u.name ?? null;
  } catch {
    return null;
  }
}

type Intent = { title: string; amount: number; kind: "course" | "courses" | "pathway" };

/* الغلاف يعيد تركيب الصفحة عند تغيّر الدورة في الرابط (key) بدل تصفير الحالة
   داخل effect: تصفيرُها هناك يُرسم مرتين ويخالف قاعدة React Compiler. */
export default function CoursePathRoute() {
  const { courseId } = useParams();
  return <CoursePathPage key={courseId ?? "none"} courseId={courseId ?? ""} />;
}

function CoursePathPage({ courseId }: { courseId: string }) {
  usePublishedContent();
  const navigate = useNavigate();
  const fmt = usePriceFormatter();

  const anchor = courseById(courseId);
  const [picked, setPicked] = useState<string[]>(courseId ? [courseId] : []);
  const [user, setUser] = useState<string | null>(readUserName);
  const [checkout, setCheckout] = useState<Intent | null>(null);
  const [pending, setPending] = useState<Intent | null>(null);
  const [name, setName] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  useEffect(() => {
    if (anchor) track("course_path_opened", { course: anchor.id, pathway: anchor.pathwayId });
  }, [anchor]);

  const suggestions = useMemo(() => suggestNext(picked, 8), [picked]);
  const pricing = useMemo(() => pathPricing(picked), [picked]);
  const nudge = useMemo(
    () => bundleNudge(picked, suggestions.map((s) => s.courseId)),
    [picked, suggestions],
  );

  /* هل صارت مختاراته مسارا جاهزا بعينه؟ حينها نقوله له بدل ادّعاء تركيب جديد */
  const matchesPathway = useMemo(() => {
    if (!anchor || picked.length < BUNDLE_MIN_COURSES) return null;
    const full = pathwayCourses[anchor.pathwayId] ?? [];
    if (full.length === 0 || picked.length !== full.length) return null;
    return full.every((id) => picked.includes(id)) ? anchor.pathwayId : null;
  }, [anchor, picked]);

  if (!anchor) {
    if (!hasCoreCatalog()) {
      return (
        <div dir="rtl" className="grid min-h-screen place-items-center bg-paper text-white/60">
          جارٍ تحميل الكتالوج…
        </div>
      );
    }
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-paper px-6 text-center text-white">
        <div>
          <p className="text-lg font-black">لم نجد هذه الدورة</p>
          <p className="mt-2 text-sm text-white/55">قد تكون أُعيدت تسميتها أو نُقلت إلى مسار آخر.</p>
          <Link to="/courses" className="mt-5 inline-block rounded-2xl bg-teal-deep px-7 py-3 font-bold">
            تصفّح الدورات
          </Link>
        </div>
      </div>
    );
  }

  const full = courseFullById(anchor.id);
  const details = courseDetails(anchor);
  const pickedCourses = picked.map((id) => courseById(id)).filter((c): c is Course => Boolean(c));
  const totalWeeks = pickedCourses.reduce((s, c) => s + c.weeks, 0);

  const add = (id: string) => {
    setPicked((p) => (p.includes(id) ? p : [...p, id]));
    track("course_path_added", { course: id, count: picked.length + 1 });
  };
  const remove = (id: string) => {
    /* الدورة التي فتح بها الصفحة لا تُحذف — هي عنوان الصفحة نفسها */
    if (id === anchor.id) return;
    setPicked((p) => p.filter((x) => x !== id));
  };

  const start = (intent: Intent) => {
    if (user) setCheckout(intent);
    else setPending(intent);
  };

  const buy = () =>
    start({
      title:
        picked.length === 1
          ? `دورة «${anchor.name}»`
          : matchesPathway
            ? `مسار «${anchor.pathwayName}» كاملا (${picked.length} دورات)`
            : `مسارك المبني: ${name.trim() || `${picked.length} دورات`}`,
      amount: pricing.payable,
      kind: picked.length === 1 ? "course" : matchesPathway ? "pathway" : "courses",
    });

  const saveDraft = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) return;
    setSaveState("saving");
    const ok = await savePathDraft({ name: trimmed, courseIds: picked });
    setSaveState(ok ? "saved" : "failed");
    if (ok) track("course_path_named", { count: picked.length });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-white">
      <SeoHead
        title={`ابنِ مسارك من «${anchor.name}»`}
        description={`ابدأ بدورة «${anchor.name}» وأضف إليها ما يكملها — وادفع ثمن ما اخترته وحده.`}
        path={`/build/${anchor.id}`}
      />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link to="/courses" className="flex items-center gap-2 text-white/70 hover:text-white">
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm font-medium">الدورات</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
            <span className="font-black">أكاديمية وجيز</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24 pt-8">
        {/* ترويسة: هذه دورة واحدة، وهي مسارك حتى الآن */}
        <div className="rounded-3xl border border-teal/30 bg-teal/[0.05] p-6 md:p-8">
          <span className="rounded-full border border-teal/40 bg-teal/10 px-3 py-1 text-[11px] font-bold text-teal-light-ink">
            {anchor.category}
          </span>
          <h1 className="mt-3 text-2xl font-black leading-snug md:text-3xl">{anchor.name}</h1>
          <p className="mt-2 text-sm text-white/50">من مسار «{anchor.pathwayName}»</p>
          {full?.shortPromise && <p className="mt-4 leading-loose text-white/70">{full.shortPromise}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 font-bold text-white/70">
              <Clock3 className="h-3.5 w-3.5 text-teal-light-ink" /> {weeksLabel(anchor.weeks)}
            </span>
            {full && (
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 font-bold text-white/70" dir="ltr">
                {full.totalHours} ساعة
              </span>
            )}
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 font-bold text-white/70">
              <BookOpen className="h-3.5 w-3.5 text-teal-light-ink" /> {anchor.skill}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 font-bold text-white/70">
              <User className="h-3.5 w-3.5 text-teal-light-ink" /> {details.trainer.name}
            </span>
          </div>
        </div>

        {/* التفاصيل الكاملة — لا مقتطف: هذا ما كانت النافذة تخفيه */}
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {full?.description && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-sm font-black text-white/80">عن الدورة</h2>
              <p className="mt-2 text-sm leading-loose text-white/60">{full.description}</p>
            </div>
          )}
          {full?.targetAudience && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-sm font-black text-white/80">لمن هذه الدورة</h2>
              <p className="mt-2 text-sm leading-loose text-white/60">{full.targetAudience}</p>
              {full.prerequisites && (
                <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-white/45">
                  <span className="font-bold text-white/60">ما يُفترض أن تعرفه قبلها: </span>
                  {full.prerequisites}
                </p>
              )}
            </div>
          )}
        </section>

        {full && full.learningOutcomes.length > 0 && (
          <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="flex items-center gap-2 text-sm font-black text-white/80">
              <Target className="h-4 w-4 text-gold-ink" /> ما ستقدر عليه بعدها
            </h2>
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {full.learningOutcomes.map((o) => (
                <li key={o} className="flex items-start gap-2 text-sm leading-relaxed text-white/65">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-light-ink" />
                  {o}
                </li>
              ))}
            </ul>
          </section>
        )}

        {full && full.modules.length > 0 && (
          <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="flex items-center gap-2 text-sm font-black text-white/80">
              <ListChecks className="h-4 w-4 text-teal-light-ink" /> وحدات الدورة ({full.modules.length})
            </h2>
            <ol className="mt-3 space-y-2.5">
              {full.modules.map((m, i) => (
                <li key={m.id} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-teal/15 text-[11px] font-black text-teal-light-ink" dir="ltr">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-snug">{m.title}</span>
                    {m.outcome && <span className="mt-0.5 block text-xs leading-relaxed text-white/50">{m.outcome}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {full?.practicalProject && (
          <section className="mt-4 rounded-2xl border border-gold/30 bg-gold/[0.06] p-5">
            <h2 className="flex items-center gap-2 text-sm font-black text-gold-ink">
              <Target className="h-4 w-4" /> مشروعها العملي
            </h2>
            <p className="mt-2 text-sm leading-loose text-white/70">{full.practicalProject}</p>
          </section>
        )}

        {/* ══ مسارك حتى الآن ══ */}
        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <RouteIcon className="h-5 w-5 text-teal-light-ink" />
              مسارك حتى الآن
            </h2>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-white/60" dir="ltr">
              {picked.length} {picked.length === 1 ? "دورة" : "دورات"} · {totalWeeks} أسبوعا
            </span>
          </div>

          <ol className="mt-4 space-y-2.5">
            {pickedCourses.map((c, i) => (
              <li key={c.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                <span className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-teal/15 text-xs font-black text-teal-light-ink" dir="ltr">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black leading-snug">{c.name}</span>
                    <span className="mt-0.5 block text-[11px] text-white/45">
                      {weeksLabel(c.weeks)} · من مسار «{c.pathwayName}»
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-black text-white/85">{fmt(coursePriceOf(c))}</span>
                  {c.id !== anchor.id && (
                    <button
                      onClick={() => remove(c.id)}
                      aria-label={`احذف ${c.name} من مسارك`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-white/35 transition hover:bg-white/5 hover:text-white/70"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ol>

          {/* السعر — القاعدة: ما دام المجموع دون سعر المسار فلا يُذكر سعر المسار */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs text-white/50">
                  {pricing.useBundle ? "سعر مسارك كاملا" : picked.length === 1 ? "سعر الدورة" : "مجموع دوراتك"}
                </p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">{fmt(pricing.payable)}</span>
                  {pricing.useBundle && pricing.separate > pricing.payable && (
                    <span className="text-sm text-white/40 line-through">{fmt(pricing.separate)}</span>
                  )}
                </p>
                {pricing.useBundle && pricing.savingPct > 0 && (
                  <p className="mt-1 text-xs text-teal-light-ink">
                    بدل {fmt(pricing.separate)} لو اشتريتها منفردة — توفير {pricing.savingPct}٪
                  </p>
                )}
              </div>
              <Button
                onClick={buy}
                className="h-12 rounded-full bg-gold px-8 font-black text-on-gold hover:bg-gold/90"
              >
                <CreditCard className="ml-2 h-4 w-4" />
                {picked.length === 1 ? "اشترِ هذه الدورة" : `اشترِ مسارك (${picked.length})`}
              </Button>
            </div>

            {/* التنبيه — يُقال قبل الحزمة بخطوة واحدة، وبأرقام تصدق على أرخص إضافة */}
            {nudge && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-[12px] font-semibold leading-relaxed text-gold-ink">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  أضف دورة واحدة أخرى ويصير مسارك بـ{fmt(nudge.nextPayable)} — بدل {fmt(nudge.nextSeparate)}
                  {" "}لو اشتريت الـ{nudge.nextCount} منفردة. أي أن الدورة الإضافية تكلّفك أقل من ثمنها بـ{fmt(nudge.saves)}.
                </span>
              </p>
            )}

            {matchesPathway && (
              <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-teal-light-ink">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  اخترت دورات مسار «{anchor.pathwayName}» كلها — فتأخذ شهادته كما هي.{" "}
                  <Link to={`/pathways/${matchesPathway}`} className="font-bold underline">
                    استعرض صفحته
                  </Link>
                </span>
              </p>
            )}
          </div>
        </section>

        {/* ══ ما يكمل مسارك ══ */}
        {suggestions.length > 0 && (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Layers className="h-5 w-5 text-teal-light-ink" />
              ما يكمل مسارك
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-white/45">
              مرتّبة لا معروضة: تبدأ ببقية المسار الذي بدأت منه بترتيبه المصمَّم، ثم ما يبني على المهارة نفسها،
              ثم ما يوسّعها خارج مجالك. ولكل واحدة سببها مكتوبا.
            </p>
            <div className="mt-4 grid gap-2.5 md:grid-cols-2">
              {suggestions.map((s) => {
                const c = courseById(s.courseId);
                if (!c) return null;
                return (
                  <button
                    key={s.courseId}
                    onClick={() => add(s.courseId)}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-right transition hover:border-teal/50 hover:bg-teal/[0.06]"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-black leading-snug">{c.name}</span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-teal-light-ink">{s.reason_ar}</span>
                      <span className="mt-1 block text-[11px] text-white/40">{weeksLabel(c.weeks)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-sm font-black text-white/85">{fmt(coursePriceOf(c))}</span>
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal/15 text-teal-light-ink">
                        <Plus className="h-4 w-4" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ══ سمِّ مسارك ══ */}
        {picked.length >= 2 && (
          <section className="mt-6 rounded-3xl border border-gold/30 bg-gold/[0.05] p-5 md:p-6">
            <h2 className="flex items-center gap-2 text-lg font-black text-gold-ink">
              <Save className="h-5 w-5" />
              سمِّ مسارك
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-white/65">
              أنت رتّبت هذه الدورات لحاجتك. سمِّها، ونحفظها عندنا — فقد تصير مسارا معتمدا لغيرك، وقد نعود إليك
              فيه. الاسم وقائمة دوراتك فقط، بلا شيء آخر.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setSaveState("idle"); }}
                maxLength={80}
                placeholder="مثال: مسار التفاوض والبيع للمستقلين"
                aria-label="اسم مسارك"
                className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm placeholder:text-white/30 focus:border-gold focus:outline-none"
              />
              <Button
                onClick={() => void saveDraft()}
                disabled={name.trim().length < 3 || saveState === "saving" || saveState === "saved"}
                variant="outline"
                className="h-12 rounded-xl border-gold/60 px-6 font-black text-gold-ink hover:bg-gold/10 disabled:opacity-40"
              >
                {saveState === "saving" ? "جارٍ الحفظ…" : saveState === "saved" ? "حُفظ — شكرا لك" : "احفظ اسمه"}
              </Button>
            </div>
            {saveState === "failed" && (
              <p className="mt-2 text-xs text-white/55">
                تعذّر الحفظ الآن — مسارك أمامك كما هو ويمكنك الشراء، وأعد المحاولة لاحقا.
              </p>
            )}
          </section>
        )}

        <p className="mt-8 text-center text-[11px] text-white/40">
          دفع آمن — يصلك تأكيد فوري على بريدك وتُفتح منصة الطالب الخاصة بك
        </p>
      </main>

      {/* التسجيل يُطلب لحظة الدفع لا قبله */}
      {pending && (
        <Modal onClose={() => setPending(null)} label="التسجيل قبل الدفع" panelClassName="w-full max-w-md">
          <div className="story-fade rounded-3xl border border-white/10 bg-surface p-6">
            <p className="mb-4 text-center text-sm leading-relaxed text-white/65">
              خطوة واحدة قبل الدفع: حساب يحفظ مسارك وشهاداتك.
            </p>
            <AuthGate
              onDone={() => {
                setUser(readUserName());
                setCheckout(pending);
                setPending(null);
              }}
              initialMode="signup"
              source="course_path_checkout"
            />
          </div>
        </Modal>
      )}

      {checkout && (
        <StripeCheckout
          title={checkout.title}
          amount={checkout.amount}
          onClose={() => setCheckout(null)}
          onSuccess={() => {
            grantEnrollment({
              pathwayId: matchesPathway ?? anchor.pathwayId,
              pathwayName: matchesPathway ? anchor.pathwayName : (name.trim() || `مسارك من «${anchor.name}»`),
              courseIds: picked,
              giftId: null,
              kind: checkout.kind,
              amount: checkout.amount,
            });
            track("payment_completed", { kind: checkout.kind, courses: picked.length });
            setCheckout(null);
            navigate("/student");
          }}
        />
      )}
    </div>
  );
}
