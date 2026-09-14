/* دوراتي المقترحة — ما أقدر عليه وليس في كتالوجكم (ح-٢).

   ═══ لماذا شاشةٌ لا فقرةٌ في «مؤهّلاتي» ═══

   لأنّ هنا يصل **قرارُ الإدارة**: «رُفض، والسببُ كذا» و«صار دورةً في
   الكتالوج». وقرارٌ يُدفن أسفلَ صفحةٍ طويلةٍ لا يُقرأ — يبقى صاحبُه ينتظر
   جوابا وصله ولم يره. والعدّادُ في التبويب يقول إنّ فيها جديدا.

   ═══ وحدودُ ما يملكه ═══

   يضيف ويعدّل ويحذف **ما لم يُبتّ فيه**. وما بُتّ فيه يقرؤه ولا يكتبه:
   اقتراحٌ صار دورةً في الكتالوج لا يُحذف من تحت قرارِ من اعتمده — ولو حُذف
   لبقيت الدورةُ بلا أصلٍ يُنسب إليه.

   ═══ ولا يدخل الكتالوجَ من هنا شيء ═══

   ما يكتبه المدرّبُ هنا **اقتراحٌ لا دورة**: لا يظهر في «الدورات» ولا
   يُحسب في التشخيص المهنيّ حتّى تُصنّفه الإدارة (ح-٤). وهذا يُقال له في
   الشاشة صراحةً — فمن ظنّ اقتراحَه دورةً انتظر طلّابا لا يأتون. */

import { useCallback, useEffect, useState } from "react";
import { BookPlus, Check, Link2, Loader2, Pencil, Trash2, X } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import EmptyState from "@/components/EmptyState";
import { toast, toastError } from "@/components/Toast";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/services/api";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { fmtDateLong } from "@/application/text/format-ar";

/** حدودُ الحقول — نسخةُ الواجهة ممّا يفرضه `course-proposal.service` */
const MIN_TITLE = 3;
const MAX_TITLE = 200;
const MAX_AUDIENCE = 300;

/** ما لم يُبتّ فيه — وهو وحدَه ما يُعدَّل ويُحذف. نسخةُ `OPEN_PROPOSAL` */
const OPEN = ["draft", "submitted"];

interface Proposal {
  id: string;
  titleAr: string;
  audienceAr: string | null;
  status: string;
  courseId: string | null;
  decisionNoteAr: string | null;
  decidedAt: string | null;
  createdAt: string;
  course: { id: string; status: string; titleAr: string | null } | null;
}

/* حالُ كلِّ اقتراحٍ بجملةٍ تقول ما جرى وما بقي — لا بكلمةٍ تُترجَم في الذهن */
function stateOf(p: Proposal): { label: string; tone: "wait" | "good" | "bad"; sayAr: string } {
  if (p.status === "linked") {
    return {
      label: "نسختُك من دورةٍ قائمة",
      tone: "good",
      sayAr: `هذه عندنا دورةٌ قائمة${p.course?.titleAr ? ` — «${p.course.titleAr}»` : ""}. `
        + "فاطلب من الإدارة تأهيلَك لها، ثمّ اقترِح اسمَك ومحاورَك عليها من ورشةِ شعبتك — "
        + "فتصير نسختَك منها لا دورةً ثانية.",
    };
  }
  if (p.status === "became_course") {
    return {
      label: "صارت دورةً في الكتالوج",
      tone: "good",
      sayAr: `دخلت الكتالوجَ${p.course?.id ? ` برمز ${p.course.id}` : ""}`
        + " — ويبقى تأهيلُك لها بيدِ الإدارة.",
    };
  }
  if (p.status === "rejected") {
    return { label: "لم تُقبل", tone: "bad", sayAr: p.decisionNoteAr || "بلا سببٍ مكتوب." };
  }
  return {
    label: "عند الإدارة",
    tone: "wait",
    sayAr: "وصلت الإدارةَ ولم تُصنَّف بعد. ولك أن تعدّلها أو تحذفها ما دامت كذلك.",
  };
}

export default function MyCourseProposals() {
  const [rows, setRows] = useState<Proposal[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* صفُّ الإضافة، وصفُّ التعديل — واحدٌ في كلِّ وقت */
  const [newTitle, setNewTitle] = useState("");
  const [newAudience, setNewAudience] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAudience, setEditAudience] = useState("");

  const load = useCallback(() => {
    apiGet<Proposal[]>("/api/trainer/course-proposals")
      .then((r) => { setRows(r); setErr(null); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر تحميل اقتراحاتك"));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function run(work: () => Promise<unknown>, okAr: string) {
    setBusy(true);
    try {
      await work();
      toast(okAr);
      load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ ما طلبت");
    } finally {
      setBusy(false);
    }
  }

  const canAdd = newTitle.trim().length >= MIN_TITLE;

  return (
    <TrainerLayout title="دوراتي المقترحة">
      {/* ما هذه الشاشة — تُقال مرّةً في رأسها لا في رسالةِ خطأٍ بعد الإرسال */}
      <Card className="mb-4">
        <h2 className="mb-1 text-read font-bold text-foreground">دوراتٌ أقدر عليها وليست في الكتالوج</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          ما تكتبه هنا <b>اقتراحٌ لا دورة</b>: لا يظهر في «الدورات» ولا يُحسب في التشخيص المهنيّ
          حتّى تصنّفه الإدارة. وقد تجعله <b>نسختَك من دورةٍ قائمةٍ عندنا</b> إن كانت قريبةً منها،
          أو <b>دورةً جديدةً</b> تدخل الكتالوجَ بمهاراتها.
          {" "}وما كتبتَه في طلبِ انضمامك موجودٌ هنا — تعدّله كما تشاء.
        </p>
      </Card>

      {err ? (
        <Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card>
      ) : !rows ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" />
        </div>
      ) : (
        <>
          {/* ── الإضافة ── */}
          <Card className="mb-4">
            <h3 className="mb-3 flex items-center gap-2 text-read font-bold text-foreground">
              <BookPlus className="h-4 w-4 text-teal" aria-hidden />
              أضِف دورةً تقترحها
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <StaffField label="عنوانُ الدورة">
                <input
                  value={newTitle} maxLength={MAX_TITLE} className={staffControlCls}
                  placeholder="مثلا: أتمتةُ التقارير الماليّة بالجداول"
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </StaffField>
              <StaffField label="لمن هي؟" hint="لا تلزم">
                <input
                  value={newAudience} maxLength={MAX_AUDIENCE} className={staffControlCls}
                  placeholder="مثلا: محاسبون في شركاتٍ صغيرة"
                  onChange={(e) => setNewAudience(e.target.value)}
                />
              </StaffField>
            </div>
            <div className="mt-3">
              <Button
                tone="confirm" icon={BookPlus} loading={busy} disabled={!canAdd}
                onClick={() => run(
                  () => apiPost("/api/trainer/course-proposals", {
                    titleAr: newTitle.trim(), audienceAr: newAudience.trim() || null,
                  }).then(() => { setNewTitle(""); setNewAudience(""); }),
                  "وصلت الإدارةَ",
                )}
              >
                أرسِلها للإدارة
              </Button>
            </div>
          </Card>

          {/* ── القائمة ── */}
          {rows.length === 0 ? (
            <EmptyState
              icon={BookPlus}
              titleAr="لا اقتراحَ بعد"
              reasonAr="اكتب أوّلَ دورةٍ تقدر عليها ولا تجدها في كتالوجنا — تصل الإدارةَ فتُصنَّف."
            />
          ) : (
            <div className="grid gap-3">
              {rows.map((p) => {
                const st = stateOf(p);
                const open = OPEN.includes(p.status);
                const editing = editId === p.id;
                return (
                  <Card key={p.id}>
                    {editing ? (
                      <div className="grid gap-3">
                        <StaffField label="عنوانُ الدورة">
                          <input
                            value={editTitle} maxLength={MAX_TITLE} className={staffControlCls}
                            onChange={(e) => setEditTitle(e.target.value)}
                          />
                        </StaffField>
                        <StaffField label="لمن هي؟" hint="لا تلزم">
                          <input
                            value={editAudience} maxLength={MAX_AUDIENCE} className={staffControlCls}
                            onChange={(e) => setEditAudience(e.target.value)}
                          />
                        </StaffField>
                        <div className="flex gap-2">
                          <Button
                            tone="confirm" icon={Check} loading={busy}
                            disabled={editTitle.trim().length < MIN_TITLE}
                            onClick={() => run(
                              () => apiPatch(`/api/trainer/course-proposals/${p.id}`, {
                                titleAr: editTitle.trim(), audienceAr: editAudience.trim() || null,
                              }).then(() => setEditId(null)),
                              "حُفظ التعديل",
                            )}
                          >
                            احفظ
                          </Button>
                          <Button tone="ghost" icon={X} onClick={() => setEditId(null)}>تراجَع</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-[14rem] flex-1">
                          <div className="text-read font-bold text-foreground">{p.titleAr}</div>
                          {p.audienceAr ? (
                            <div className="mt-0.5 text-sm text-muted-foreground">لمن: {p.audienceAr}</div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={
                                "rounded-full px-2.5 py-0.5 text-xs font-bold "
                                + (st.tone === "good"
                                  ? "bg-teal/15 text-teal"
                                  : st.tone === "bad"
                                    ? "bg-red-500/15 text-red-300"
                                    : "bg-white/10 text-muted-foreground")
                              }
                            >
                              {st.label}
                            </span>
                            <span className="text-xs text-muted-foreground/70">
                              {p.decidedAt ? `بُتّ فيها ${fmtDateLong(p.decidedAt)}` : `أُرسلت ${fmtDateLong(p.createdAt)}`}
                            </span>
                          </div>
                        </div>
                        {open ? (
                          <div className="flex gap-2">
                            <Button
                              tone="ghost" icon={Pencil} disabled={busy}
                              onClick={() => {
                                setEditId(p.id);
                                setEditTitle(p.titleAr);
                                setEditAudience(p.audienceAr ?? "");
                              }}
                            >
                              عدّل
                            </Button>
                            <Button
                              tone="danger" icon={Trash2} disabled={busy}
                              onClick={() => run(
                                () => apiDelete(`/api/trainer/course-proposals/${p.id}`),
                                "حُذف الاقتراح",
                              )}
                            >
                              احذف
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* جوابُ الإدارة — وهو ما جاء المدرّبُ ليقرأه */}
                    {!editing ? (
                      <Inset className="mt-3 text-sm leading-7 text-muted-foreground">
                        {st.tone === "good" && p.status === "linked" ? (
                          <Link2 className="ms-0 me-1 inline h-4 w-4 text-teal" aria-hidden />
                        ) : null}
                        {st.sayAr}
                      </Inset>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </TrainerLayout>
  );
}
