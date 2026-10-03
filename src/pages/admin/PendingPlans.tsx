/* ═══ «خططٌ تنتظر اعتمادك» — كلُّ خطّةٍ أرسلها مدرّبٌ، في شاشةٍ واحدة (٣ أكتوبر ٢٠٢٦) ═══

   سؤالُ صاحب المنصّة: «كيف أعتمد كلَّ شعبةٍ أنهى مدرّبُها موادَّ دوراته وتنتظر
   اعتمادي؟». وكان الجوابُ: افتح الشعبَ واحدةً واحدة — من لوح دورات المدرّب في
   «العقود» إلى بطاقة كلّ شعبةٍ في «الشعب»، ولا موضعَ يقول كم ينتظر ولا أين.
   فاختار أن تُجمع: كلُّ خطّةٍ مرسَلةٍ من كلّ مدرّب، وأمام كلٍّ «اعتمدها» و«اطلب
   تعديلات».

   ── ولا اعتمادَ بالجملة ──

   الخيارُ كان «تقرأ كلَّ خطّة، لكن في موضعٍ واحد». فالخطّةُ تُفتح هنا بمراجعتها
   الكاملة نفسِها التي في بطاقة شعبتها (`TrainerPlanReview`) — المنهجُ وما تغيّر
   وما يُعتمَد معها — ولا زرَّ يعتمد ما لم يُفتح.

   ── وخططُ المدرّب الواحد معا ──

   مدرّبُ الإعداد يُفعَّل حين تُعتمَد دوراتُه كلُّها، فمن يعتمد يسأل «كم بقي له؟»
   لا «ما أقدمُ خطّة؟». فتُجمع خططُ كلِّ مدرّبٍ تحت اسمه، والمدرّبون بترتيب أقدم
   ما أرسلوه — فلا يُؤخَّر من انتظر أطول.

   ── وما قُضي لا يختفي من تحت عين قارئه ──

   الخطّةُ التي اعتُمدت أو رُدّت تبقى في موضعها معلَّمةً بما قُضي فيها حتّى تُفتح
   الشاشةُ ثانية: لو سقطت من القائمة ساعةَ القرار لقفزت الصفحةُ تحت يده، وضاعت
   رسالةُ ما وقع — وفيها: أهذه آخرُ دوراته ففُعِّل؟ */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { BookOpen, ChevronUp, ClipboardCheck, ExternalLink, ServerOff } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, ApiError } from "@/services/api";
import { fmtDateTimeAr } from "@/utils/format";
import { countAr } from "@/application/text/count-ar";
import { paginate } from "@/application/admin/paginate";
import { matchesQuery } from "@/application/text/search-ar";
import { Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import ListToolbar from "@/components/admin/ListToolbar";
import WorkHeader from "@/components/admin/WorkHeader";
import { revealRow } from "@/components/admin/reveal";
import TrainerPlanReview, { type PlanOutcome } from "@/components/admin/TrainerPlanReview";
import { prepNoteAr, type PrepFlags } from "@/application/trainer/plan-decision";

/** خطّةٌ تنتظر — كما يردّها `CohortPlanService.pending` */
interface PendingPlan {
  id: string;
  cohort: { id: string; title: string; courseId: string };
  courseTitle: string;
  trainerName: string;
  trainerProfileId: string | null;
  submittedAt: string | null;
  trainerConfirmedAt: string | null;
  /* شعبةُ إعداد؟ — `qualifies`: اعتمادُها يؤهّله لدورتها، و`onboarding`: هو في
     الطور فقد يفعّله اعتمادُها إن كانت آخرَ ما ينتظر (`trainer-prep.service.ts`) */
  prep: PrepFlags | null;
}

const PLAN_FORMS = { one: "خطّةٌ", two: "خطّتان", few: "خطط", many: "خطّةً" };
const PAGE = 20;

/** «من مدرّبٍ واحد» لا «من 1 مدرّب» — والعددُ يُقرأ لا يُحسب */
function fromTrainersAr(n: number): string {
  if (n === 1) return "من مدرّبٍ واحد";
  if (n === 2) return "من مدرّبَين";
  return `من ${countAr(n, { one: "مدرّب", two: "مدرّبين", few: "مدرّبين", many: "مدرّبا" })}`;
}

const trainerKey = (r: PendingPlan) => r.trainerProfileId ?? `name:${r.trainerName}`;

/** خططُ كلِّ مدرّبٍ متجاورة، والمدرّبون بترتيب أقدم ما أرسلوه. والفرزُ ثابتٌ،
    فالخادمُ يردّها أقدمَها أوّلا فتبقى كذلك داخل كلّ مدرّب. */
function byTrainer(rows: readonly PendingPlan[]): PendingPlan[] {
  const first = new Map<string, number>();
  rows.forEach((r, i) => { if (!first.has(trainerKey(r))) first.set(trainerKey(r), i); });
  return [...rows].sort((a, b) => first.get(trainerKey(a))! - first.get(trainerKey(b))!);
}

const OUTCOME_AR: Record<PlanOutcome, { label: string; tone: "positive" | "warn" }> = {
  approved: { label: "اعتُمدت الآن", tone: "positive" },
  changes_requested: { label: "رُدّت بملاحظاتك", tone: "warn" },
};

export default function PendingPlans() {
  const [rows, setRows] = useState<PendingPlan[] | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  /* من لوح دورات المدرّب في «العقود»: خططُه وحدَه، وخطّةُ الشعبة المنقورة مفتوحة */
  const trainerFilter = params.get("trainer");
  const wantedCohort = params.get("cohort");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [decided, setDecided] = useState<Record<string, PlanOutcome>>({});
  /* الخطّةُ التي تُبلَغ بعد أن تُرسَم — مرجعٌ لا حال: بلوغُها أثرٌ في الصفحة
     لا شيءٌ يُرسَم، فلا يُحدث رسما ثانيا */
  const revealNext = useRef<string | null>(null);
  useEffect(() => {
    if (!revealNext.current) return;
    revealRow(`plan-${revealNext.current}`);
    revealNext.current = null;
  });

  /* بلوغُ خطّةٍ بعينها: صفحتُها، ثمّ فتحُها، ثمّ الانزلاقُ إليها بعد أن تُرسَم */
  const goTo = useCallback((list: readonly PendingPlan[], id: string) => {
    const at = list.findIndex((r) => r.id === id);
    if (at < 0) return;
    revealNext.current = id;
    setPage(Math.floor(at / PAGE) + 1);
    setOpen((s) => new Set(s).add(id));
  }, []);

  useEffect(() => {
    let alive = true;
    apiGet<PendingPlan[]>("/api/admin/cohort-plans/pending")
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setOffline(null);
        /* والرابطُ الذي يسمّي شعبةً يفتح خطّتَها عند الوصول (من لوح دورات المدرّب) */
        if (!wantedCohort) return;
        const list = byTrainer(r.filter((x) => !trainerFilter || x.trainerProfileId === trainerFilter));
        const hit = list.find((x) => x.cohort.id === wantedCohort);
        if (hit) goTo(list, hit.id);
      })
      .catch((e: unknown) => { if (alive) setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل"); });
    return () => { alive = false; };
  }, [wantedCohort, trainerFilter, goTo]);

  const scoped = (rows ?? []).filter((r) => !trainerFilter || r.trainerProfileId === trainerFilter);
  /* يُبحث بالشعبة والدورة والمدرّب — وهي ما يُسأل به فعلا */
  const ordered = byTrainer(scoped.filter((r) => matchesQuery(q, [r.cohort.title, r.courseTitle, r.trainerName])));
  const view = paginate(ordered, page, PAGE);
  const waiting = scoped.filter((r) => !decided[r.id]);
  const filteredName = trainerFilter ? scoped[0]?.trainerName ?? null : null;

  const toggle = (id: string) => setOpen((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (offline) {
    return (
      <AdminLayout title="خططٌ تنتظر اعتمادك">
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-read leading-7 text-muted-foreground">{offline}</p>
        </Panel>
      </AdminLayout>
    );
  }

  /* مجموعاتُ الصفحة المعروضة — والعددُ تحت كلّ اسمٍ من القائمة كلِّها لا من الصفحة */
  const groups: { key: string; name: string; rows: PendingPlan[] }[] = [];
  for (const r of view.rows) {
    const last = groups[groups.length - 1];
    if (last && last.key === trainerKey(r)) last.rows.push(r);
    else groups.push({ key: trainerKey(r), name: r.trainerName, rows: [r] });
  }
  const trainers = new Set(waiting.map(trainerKey)).size;
  const inPrep = waiting.filter((r) => r.prep?.onboarding).length;

  return (
    <AdminLayout title="خططٌ تنتظر اعتمادك">
      <p className="mb-4 max-w-3xl text-read leading-7 text-muted-foreground">
        كلُّ خطّةِ شعبةٍ أرسلها مدرّبُها وأكّد موافقتَه على ما فيها — من المدرّبين كلِّهم، وخططُ كلِّ مدرّبٍ تحت اسمه.
        افتح أيَّها تقرأ منهجَها كاملا كما في بطاقة شعبتها، ثمّ «اعتمدها» أو «اطلب تعديلات». ولا يُفتح تسجيلُ شعبةٍ قبل اعتماد خطّتها.
      </p>

      {trainerFilter && (
        <Inset className="mb-4 flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="text-read text-foreground">
            {filteredName ? <>تُعرض خططُ <b>{filteredName}</b> وحدها.</> : "لا خطّةَ تنتظر اعتمادك لهذا المدرّب الآن."}
          </p>
          <Button size="sm" tone="ghost" onClick={() => {
            setParams((p) => { const n = new URLSearchParams(p); n.delete("trainer"); n.delete("cohort"); return n; });
            setPage(1);
          }}>
            اعرض خططَ المدرّبين كلِّهم
          </Button>
        </Inset>
      )}

      <WorkHeader
        loading={rows === null}
        icon={ClipboardCheck}
        count={waiting.length}
        forms={PLAN_FORMS}
        waitingAr="تنتظر اعتمادك"
        stats={rows ? [
          fromTrainersAr(trainers),
          ...(inPrep > 0 ? [`في طور الإعداد: ${countAr(inPrep, PLAN_FORMS)}`] : []),
        ] : []}
        actionAr="ابدأ بأقدمها"
        /* الأقدمُ أوّلُ ما لم يُقضَ فيه في الترتيب المعروض — والبحثُ قد يُخفيه */
        disabledReasonAr={waiting.length > 0 && !ordered.some((r) => !decided[r.id])
          ? "البحثُ الحاليُّ لا يُظهر منها ما ينتظر — امسحه لتبدأ."
          : undefined}
        onAction={() => {
          const first = ordered.find((r) => !decided[r.id]);
          if (first) goTo(ordered, first.id);
        }}
        doneAr="لا خطّةَ تنتظر اعتمادك — وحين يرسل مدرّبٌ خطّةَ شعبته ويؤكّد موافقتَه عليها تظهر هنا، ويظهر عددُها إلى جانب اسم هذه الشاشة."
      />

      {rows !== null && scoped.length > 0 && (
        <>
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="خطّة"
            placeholder="ابحث باسم الشعبة أو الدورة أو المدرّب…" />
          {view.rows.length === 0 ? (
            /* «لا نتائج» غيرُ «لا خطط»: الأولى تُمسح كلمتُها، والثانية تُنتظر */
            <Panel as="p" className="py-12 text-center text-read text-muted-foreground">
              لا خطّةَ تطابق بحثَك — امسح الكلمة أو جرّب غيرها.
            </Panel>
          ) : (
            <div className="space-y-6">
              {groups.map((g) => {
                const all = scoped.filter((r) => trainerKey(r) === g.key);
                const left = all.filter((r) => !decided[r.id]).length;
                const onboarding = all.some((r) => r.prep?.onboarding);
                return (
                  <section key={g.key} aria-label={`خططُ ${g.name}`}>
                    <h2 className="flex flex-wrap items-baseline gap-x-2 text-read font-black text-foreground">
                      {g.name}
                      <span className="font-normal text-muted-foreground">
                        {left > 0 ? `— ${countAr(left, PLAN_FORMS)} تنتظر` : "— قُضي فيها كلِّها"}
                      </span>
                    </h2>
                    {onboarding && (
                      <p className="mt-1 text-read leading-6 text-muted-foreground">
                        في طور الإعداد — التفعيلُ حين تُعتمَد دوراتُ الإعداد كلُّها، ويقول لك الاعتمادُ عند كلّ خطّةٍ كم بقي منها.
                      </p>
                    )}
                    <ul className="mt-3 space-y-3">
                      {g.rows.map((r) => {
                        const isOpen = open.has(r.id);
                        const done = decided[r.id];
                        return (
                          /* هدفُ زرِّ الرأس — يقبل التركيزَ ليُقرأ حين يُبلَغ بلوحة المفاتيح */
                          <Panel as="li" key={r.id} id={`plan-${r.id}`} tabIndex={-1} className="outline-none">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-read font-black text-foreground">{r.cohort.title}</p>
                                <p className="mt-1 text-read leading-6 text-muted-foreground">
                                  دورةُ «{r.courseTitle}»
                                  {r.submittedAt && <> · أرسلها {fmtDateTimeAr(r.submittedAt)}</>}
                                  {r.trainerConfirmedAt && <> وأكّد موافقتَه على كلّ ما فيها</>}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {r.prep && <Chip tone="accent" srPrefixAr="نوعُها">شعبةُ إعداد</Chip>}
                                {done && <Chip tone={OUTCOME_AR[done].tone} srPrefixAr="القرار">{OUTCOME_AR[done].label}</Chip>}
                              </div>
                            </div>
                            {r.prep && !done && (
                              <p className="mt-2 text-read leading-6 text-muted-foreground">{prepNoteAr(r.prep)}</p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Button size="sm" tone={isOpen ? "ghost" : "primary"} icon={isOpen ? ChevronUp : BookOpen}
                                aria-expanded={isOpen} onClick={() => toggle(r.id)}>
                                {isOpen ? "اطوِها" : done ? "اعرضها" : "اقرأها وقرّر"}
                              </Button>
                              <Button as={Link} to={`/admin/cohorts?cohort=${r.cohort.id}`} size="sm" tone="ghost" icon={ExternalLink}>
                                افتح بطاقةَ الشعبة
                              </Button>
                            </div>
                            {/* تُجلب حين تُفتح لا قبلها: عشرون خطّةً لا تُجلب مناهجُها
                                كلُّها لمن جاء ليقرأ واحدة */}
                            {isOpen && (
                              <div className="mt-4 border-t border-white/10 pt-4">
                                <TrainerPlanReview
                                  cohortId={r.cohort.id}
                                  cohortTitle={r.cohort.title}
                                  onPlanDecided={(outcome) => setDecided((d) => ({ ...d, [r.id]: outcome }))}
                                />
                              </div>
                            )}
                          </Panel>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
