/* تعديلاتي على دوراتي — بابُ «خمسةِ أيّامٍ لوضع محاور دوراتك ومصادرها».

   ═══ لماذا شاشةٌ الآن، وقد حُذفت مسالكُها مرّة ═══

   حُذفت مسالكُ الاقتراح في ٨ سبتمبر ٢٠٢٦ **لأنّها كانت بلا شاشة**، وكان
   الحذفُ صحيحا: بابٌ لا يفتحه أحدٌ هو «المساراتُ الميّتة» بعينها. ثمّ وعد
   العقدُ (٢٧ سبتمبر) في طوره المشروط بأنّ للمدرّب خمسةَ أيّامٍ يضع فيها
   محاورَ دوراتِه ومصادرَها — فصار الوعدُ منشورا في وثيقةٍ تُوقَّع، والبابُ
   مغلقا. فالمسالكُ عادت **وهذه شاشتُها**: لم تُنقَض علّةُ الحذف، بل استُوفيت.

   ═══ وما تعرضه لا تحكمه ═══

   حكمُ النطاق لكلّ دورةٍ يأتي من الخادم (`scope` في المؤهّلات) — لا تُعيد
   الشاشةُ حسابَه ولا تخمّنه. فلو حكمت بنفسها لَقالت «يمكنك» ثمّ ردَّ الخادمُ،
   أو منعت ما يجيزه. ونصُّ السببِ يُعرَض كما ورد، فما يقرؤه هو ما حكم.

   ═══ وشكلُ كلِّ نوعٍ هو ما يطبّقه الناشر ═══

   `publishToCatalog` يقرأ لكلّ نوعٍ مفاتيحَ بعينها — `titleAr` للمحور،
   و`order` للترتيب، و`totalHours` للمدّة، و`text` لثمانيةٍ تُعلَّق على محور.
   فالنموذجُ يبني ما يقرؤه هو، لا ما يُشبهه. ويحرس ذلك
   `server/tests/trainer/own-course-authoring.test.ts` — وإلّا فبابٌ يُرسل ما
   لا يُطبَّق: اقتراحٌ يُعتمَد ثمّ لا يتغيّر به شيءٌ في الدورة. */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, CircleAlert, Layers, Loader2, Lock, Plus, Send,
  ServerOff, Trash2, X,
} from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import EmptyState from "@/components/EmptyState";
import { toast, toastError } from "@/components/Toast";
import { apiGet, apiPost } from "@/services/api";
import { staffAreaCls, staffControlCls, staffSelectCls, StaffField } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { fmtDateLong } from "@/application/text/format-ar";
import ListToolbar from "@/components/admin/ListToolbar";
import { paginate } from "@/application/admin/paginate";
import { matchesQuery } from "@/application/text/search-ar";
import {
  CHANGE_TYPE_LABELS_AR, MIN_CHANGE_REASON_LEN, NEEDS_MODULE, TEXT_TYPES,
  afterValueFor, changeTypeLabelAr, draftProblemsAr, emptyChangeDraft,
  type ChangeDraft, type ModuleRef,
} from "@/application/catalog/change-types";

/* والحدودُ من موضعها: أدنى السببِ في الطبقة المشتركة مع بناءِ العناصر،
   والأقصى وسقفُ العناصر ممّا يفرضه المسلك (`trainer-portal.routes`). */
const MAX_REASON = 4000;
const MAX_ITEMS = 40;

interface ScopeGate { allowed: boolean; basis: string; reasonAr: string }
interface Qualification {
  courseId: string; title: string; currentVersion: number; qualifiedAt: string;
  scope: ScopeGate | null; modules: ModuleRef[];
}
interface ChangeItem { changeType: string; targetKey?: string | null; note?: string | null }
interface ChangeRequest {
  id: string; courseId: string; scope: string; status: string; reason: string;
  createdAt: string; checkerComment?: string | null;
  items: ChangeItem[];
  course?: { versions?: { titleAr?: string }[] } | null;
}

/** ما لم يُبتّ فيه — يُسحَب. ونسخةُ `withdraw` في الخدمة. */
const OPEN = ["draft", "submitted", "under_review", "changes_requested"];

/** بلغةِ صاحبها لا بلغةِ الطابور: «بانتظار المراجعة» لا «مُقدَّم» */
const STATUS_AR: Record<string, string> = {
  draft: "مسودّة",
  submitted: "بانتظار المراجعة",
  under_review: "قيد المراجعة",
  changes_requested: "رُدّ إليك بملاحظات",
  approved_for_cohort: "اعتُمد لشعبتك",
  approved_for_catalog: "اعتُمد للدورة",
  published: "نُشر في الدورة",
  rejected: "لم يُعتمَد",
  withdrawn: "سحبتَه",
  superseded: "تجاوزه اقتراحٌ أحدث",
};

export default function TrainerMyCourseEdits() {
  const [quals, setQuals] = useState<Qualification[] | null>(null);
  const [mine, setMine] = useState<ChangeRequest[] | null>(null);
  const [down, setDown] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [draft, setDraft] = useState<ChangeDraft>(emptyChangeDraft);
  const [items, setItems] = useState<{ draft: ChangeDraft; afterValue: Record<string, unknown> }[]>([]);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  /* طابورُ اقتراحاتي ينمو بكلّ فصلٍ ودورة، فيُبحَث ويُصفَّح كسائر طوابير
     المنصّة (`src/tests/design/staff-surface.test.ts`). والبحثُ على ما يُقرأ
     في السطر: اسمُ الدورة، وسببُ التعديل، وحالُه بالعربيّة. */
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(() =>
    Promise.all([
      apiGet<Qualification[]>("/api/trainer/me/qualifications"),
      apiGet<ChangeRequest[]>("/api/trainer/changes"),
    ])
      .then(([q, m]) => { setQuals(q); setMine(m); setDown(false); })
      .catch(() => setDown(true)), []);

  useEffect(() => { void load(); }, [load]);

  const course = useMemo(() => quals?.find((q) => q.courseId === courseId) ?? null, [quals, courseId]);
  const matched = (mine ?? []).filter((r) => matchesQuery(query, [
    r.course?.versions?.[0]?.titleAr, r.reason, STATUS_AR[r.status] ?? r.status,
  ]));
  const view = paginate(matched, page, 20);
  const modules = course?.modules ?? [];

  /* وتبديلُ الدورة يُفرِغ ما بُني: عنصرٌ يشير إلى محورٍ في دورةٍ أخرى
     يُرسَل ثمّ لا يجد هدفَه، فيُعتمَد ولا يفعل شيئا. */
  const pickCourse = (id: string) => {
    setCourseId(id);
    setItems([]);
    setDraft({ ...emptyChangeDraft(), order: (quals?.find((q) => q.courseId === id)?.modules ?? []).map((m) => m.id) });
  };

  const problems = course ? draftProblemsAr(draft, modules) : ["اختَرْ دورةً أوّلا"];
  const reasonShort = reason.trim().length < MIN_CHANGE_REASON_LEN;

  const addItem = () => {
    if (problems.length > 0) return;
    if (items.length >= MAX_ITEMS) { toastError(`لا يزيد الاقتراحُ على ${MAX_ITEMS} عنصرا`); return; }
    setItems((xs) => [...xs, { draft, afterValue: afterValueFor(draft) }]);
    setDraft({ ...emptyChangeDraft(), order: modules.map((m) => m.id) });
  };

  const move = (i: number, by: number) => {
    setDraft((d) => {
      const next = [...d.order];
      const j = i + by;
      if (j < 0 || j >= next.length) return d;
      [next[i]!, next[j]!] = [next[j]!, next[i]!];
      return { ...d, order: next };
    });
  };

  const send = async () => {
    if (!course || items.length === 0 || reasonShort) return;
    setSending(true);
    try {
      await apiPost("/api/trainer/changes", {
        courseId: course.courseId,
        scope: "catalog",
        reason: reason.trim(),
        items: items.map((x) => ({
          changeType: x.draft.changeType,
          ...(x.draft.targetKey ? { targetKey: x.draft.targetKey } : {}),
          afterValue: x.afterValue,
          ...(x.draft.note.trim() ? { note: x.draft.note.trim() } : {}),
        })),
      });
      toast("أُرسل اقتراحُك — يصلك قرارُ الإدارة هنا");
      setItems([]); setReason(""); setDraft({ ...emptyChangeDraft(), order: modules.map((m) => m.id) });
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "تعذّر الإرسال");
    } finally {
      setSending(false);
    }
  };

  const withdraw = async (id: string) => {
    try {
      await apiPost(`/api/trainer/changes/${id}/withdraw`);
      toast("سُحب اقتراحُك");
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "تعذّر السحب");
    }
  };

  if (down) {
    return (
      <TrainerLayout title="تعديلاتي على دوراتي">
        <EmptyState
          icon={ServerOff}
          titleAr="تعذّر الوصول إلى الخادم"
          reasonAr="لم يُجب الخادمُ على طلب دوراتك واقتراحاتك. تحقّق من اتصالك ثمّ أعد المحاولة."
          actions={[{ labelAr: "أعد المحاولة", onClick: () => void load() }]}
        />
      </TrainerLayout>
    );
  }

  if (!quals || !mine) {
    return (
      <TrainerLayout title="تعديلاتي على دوراتي">
        <div className="grid place-items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" />
        </div>
      </TrainerLayout>
    );
  }

  return (
    <TrainerLayout title="تعديلاتي على دوراتي">
      <div className="space-y-8">
        <section>
          <h2 className="flex items-center gap-2 text-lg font-black">
            <Layers className="h-5 w-5 text-teal" aria-hidden="true" />
            ضَعْ محاورَ دوراتِك ومصادرَها
          </h2>
          <p className="mt-1 text-sm leading-7 text-muted-foreground">
            ما تكتبه هنا <b>اقتراحٌ يمرّ بالمراجعة</b> ثمّ يُنشر في الدورة إصدارا جديدا — لا كتابةً فوق القائم. ويُعرَض على المراجع أثرُ تعديلك قبل أن يعتمده.
          </p>

          {quals.length === 0 ? (
            <EmptyState
              className="mt-4"
              icon={Layers}
              titleAr="لا دورةَ مؤهَّلٌ لها بعد"
              reasonAr="تُؤهَّل لكلّ دورةٍ ذكرتَ في طلبك أنّك تستطيع تدريسَها، وتضيف الإدارةُ فوقَها ما تراه. وحين تُؤهَّل تجدها هنا لتضع محاورَها."
              actions={[{ to: "/trainer/qualifications", labelAr: "مؤهّلاتي", hintAr: "ما أُهِّلتُ له" }]}
            />
          ) : (
            <Card className="mt-4 space-y-4 p-5">
              <StaffField label="الدورة">
                <select
                  className={staffSelectCls}
                  value={courseId}
                  onChange={(e) => pickCourse(e.target.value)}
                >
                  <option value="">— اختَرْ دورةً من مؤهّلاتك —</option>
                  {quals.map((q) => (
                    <option key={q.courseId} value={q.courseId}>
                      {q.title || "دورةٌ بلا اسمٍ في الكتالوج"}
                    </option>
                  ))}
                </select>
              </StaffField>

              {course && course.scope && !course.scope.allowed && (
                <Inset tone="warn" className="flex gap-3 p-4 text-sm leading-7">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{course.scope.reasonAr}</span>
                </Inset>
              )}

              {course && course.scope?.allowed && (
                <>
                  <Inset tone="positive" className="p-4 text-sm leading-7">
                    {course.scope.reasonAr}
                  </Inset>

                  <StaffField label="ما تضيفه">
                    <select
                      className={staffSelectCls}
                      value={draft.changeType}
                      onChange={(e) => setDraft((d) => ({ ...d, changeType: e.target.value }))}
                    >
                      {Object.keys(CHANGE_TYPE_LABELS_AR).map((t) => (
                        <option key={t} value={t}>{CHANGE_TYPE_LABELS_AR[t]}</option>
                      ))}
                    </select>
                  </StaffField>

                  {NEEDS_MODULE.has(draft.changeType) && (
                    modules.length === 0 ? (
                      <Inset tone="warn" className="p-4 text-sm leading-7">
                        لا محورَ في هذه الدورة بعد، وهذا النوعُ يتعلّق بمحورٍ قائم. ابدأْ بـ«إضافةُ محور».
                      </Inset>
                    ) : (
                      <StaffField label="المحورُ المقصود">
                        <select
                          className={staffSelectCls}
                          value={draft.targetKey}
                          onChange={(e) => setDraft((d) => ({ ...d, targetKey: e.target.value }))}
                        >
                          <option value="">— اختَرْ محورا —</option>
                          {modules.map((m) => (
                            <option key={m.id} value={m.id}>{m.sequence}. {m.titleAr}</option>
                          ))}
                        </select>
                      </StaffField>
                    )
                  )}

                  {(draft.changeType === "module_add" || draft.changeType === "module_title_edit") && (
                    <StaffField label={draft.changeType === "module_add" ? "عنوانُ المحور" : "العنوانُ الجديد"}>
                      <input
                        className={staffControlCls}
                        value={draft.titleAr}
                        onChange={(e) => setDraft((d) => ({ ...d, titleAr: e.target.value }))}
                        placeholder="مثالا: التفاوضُ على الحدود — تطبيقٌ عمليّ"
                      />
                    </StaffField>
                  )}

                  {(TEXT_TYPES.has(draft.changeType) || draft.changeType === "module_add") && (
                    <StaffField
                      label={draft.changeType === "module_add" ? "نشاطُ المحور (اختياريّ)" : "النصّ"}
                      hint="يُضاف إلى ما في المحور ولا يمحوه"
                    >
                      <textarea
                        className={staffAreaCls}
                        rows={4}
                        value={draft.text}
                        onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                      />
                    </StaffField>
                  )}

                  {(draft.changeType === "duration_propose" || draft.changeType === "module_add") && (
                    <StaffField label={draft.changeType === "duration_propose" ? "مجموعُ ساعاتِ الدورة" : "ساعاتُ المحور (اختياريّ)"}>
                      <input
                        className={staffControlCls}
                        type="number"
                        min={1}
                        value={draft.hours}
                        onChange={(e) => setDraft((d) => ({ ...d, hours: e.target.value }))}
                      />
                    </StaffField>
                  )}

                  {draft.changeType === "module_reorder" && (
                    modules.length < 2 ? (
                      <Inset tone="warn" className="p-4 text-sm leading-7">
                        الترتيبُ يحتاج محورَين على الأقلّ، وفي هذه الدورة {modules.length}.
                      </Inset>
                    ) : (
                      <StaffField label="الترتيبُ المقترَح" hint="حرّكْ كلَّ محورٍ إلى موضعه">
                        <ul className="space-y-2">
                          {draft.order.map((id, i) => (
                            <li key={id} className="flex items-center gap-2 rounded-lg border border-white/10 p-2">
                              <span className="w-6 text-center text-xs font-black text-muted-foreground">{i + 1}</span>
                              <span className="flex-1 text-sm">{modules.find((m) => m.id === id)?.titleAr ?? id}</span>
                              <Button size="sm" tone="ghost" icon={ArrowUp} aria-label="إلى أعلى" onClick={() => move(i, -1)} disabled={i === 0} />
                              <Button size="sm" tone="ghost" icon={ArrowDown} aria-label="إلى أسفل" onClick={() => move(i, 1)} disabled={i === draft.order.length - 1} />
                            </li>
                          ))}
                        </ul>
                      </StaffField>
                    )
                  )}

                  <StaffField label="ملحوظةٌ للمراجع (اختياريّة)">
                    <input
                      className={staffControlCls}
                      value={draft.note}
                      onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                    />
                  </StaffField>

                  {/* ولا زرٌّ مطفأٌ بلا سبب: ما ينقص يُسمّى بأسمائه */}
                  {problems.length > 0 && (
                    <p className="flex items-start gap-2 text-sm text-amber-300">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>ينقص: {problems.join(" · ")}</span>
                    </p>
                  )}

                  <Button icon={Plus} tone="secondary" onClick={addItem} disabled={problems.length > 0}>
                    أضِفْ إلى الاقتراح
                  </Button>
                </>
              )}
            </Card>
          )}
        </section>

        {items.length > 0 && course && (
          <section>
            <h2 className="text-lg font-black">اقتراحٌ قيد التكوين ({items.length})</h2>
            <Card className="mt-3 space-y-4 p-5">
              <ul className="space-y-2">
                {items.map((x, i) => (
                  <li key={`${x.draft.changeType}-${i}`} className="flex items-start gap-3 rounded-lg border border-white/10 p-3">
                    <span className="flex-1 text-sm leading-7">
                      <b>{changeTypeLabelAr(x.draft.changeType)}</b>
                      {x.draft.targetKey && (
                        <span className="text-muted-foreground">
                          {" — "}{modules.find((m) => m.id === x.draft.targetKey)?.titleAr ?? x.draft.targetKey}
                        </span>
                      )}
                      {x.draft.titleAr && <span className="block text-muted-foreground">«{x.draft.titleAr}»</span>}
                      {x.draft.text && <span className="block text-muted-foreground">{x.draft.text.slice(0, 160)}</span>}
                    </span>
                    <Button
                      size="sm" tone="ghost" icon={X} aria-label="أزِلْ هذا العنصر"
                      onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
                    />
                  </li>
                ))}
              </ul>

              <StaffField label="سببُ التعديل" hint={`يُقرأ في المراجعة — ${MIN_CHANGE_REASON_LEN} حرفا على الأقلّ`}>
                <textarea
                  className={staffAreaCls}
                  rows={3}
                  maxLength={MAX_REASON}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </StaffField>

              <Button icon={Send} tone="primary" loading={sending} onClick={() => void send()} disabled={reasonShort}>
                أرسِلْ للمراجعة
              </Button>
              {reasonShort && (
                <p className="text-sm text-muted-foreground">اكتُبْ سببا لا يقلّ عن {MIN_CHANGE_REASON_LEN} حرفا.</p>
              )}
            </Card>
          </section>
        )}

        <section>
          <h2 className="text-lg font-black">
            اقتراحاتي <span className="text-xs font-bold text-muted-foreground">({mine.length})</span>
          </h2>
          {mine.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">لم تُرسِلْ اقتراحا بعد.</p>
          ) : (
            <>
              <div className="mt-3">
                <ListToolbar
                  q={query} onQ={setQuery} onPage={setPage} view={view}
                  unit="اقتراحا" placeholder="ابحَثْ باسم الدورة أو بالسبب أو بالحال"
                />
              </div>
              <ul className="space-y-3">
                {view.rows.map((r) => (
                <Card as="li" key={r.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black">
                      {r.course?.versions?.[0]?.titleAr || "دورةٌ بلا اسمٍ في الكتالوج"}
                    </span>
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs font-bold">
                      {STATUS_AR[r.status] ?? r.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{fmtDateLong(r.createdAt)}</span>
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground">{r.reason}</p>
                  <p className="text-read text-muted-foreground">
                    {r.items.map((i) => changeTypeLabelAr(i.changeType)).join(" · ")}
                  </p>
                  {r.checkerComment && (
                    <Inset tone="accent" className="p-3 text-sm leading-7">
                      <b>من المراجع:</b> {r.checkerComment}
                    </Inset>
                  )}
                  {OPEN.includes(r.status) && (
                    <Button size="sm" tone="danger" icon={Trash2} onClick={() => void withdraw(r.id)}>
                      اسحَبْه
                    </Button>
                  )}
                </Card>
                ))}
              </ul>
              {view.total === 0 && (
                <p className="text-sm text-muted-foreground">لا اقتراحَ يطابق بحثَك.</p>
              )}
            </>
          )}
        </section>
      </div>
    </TrainerLayout>
  );
}
