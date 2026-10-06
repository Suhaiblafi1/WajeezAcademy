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
   الشاشة صراحةً — فمن ظنّ اقتراحَه دورةً انتظر طلّابا لا يأتون.

   ═══ والفورمُ أسئلةٌ لا خانتان (٢٩ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «حسّن شكلَ فورم إضافة الدورات وأضِفِ الأسئلةَ التي
   تسهّل علينا دمجَ الدورة أو إضافتَها للكتالوج». فصار أقساما مرقّمة — عن
   الدورة · لمن هي · محتواها · الدمجُ أو الإضافة · جاهزيّتُك — والأسئلةُ
   وعلّتُها في `application/trainer/proposal-details.ts`. والعنوانُ وحدَه
   يلزم؛ ما سواه يُجاب بقدر ما يعرف. */

import { useCallback, useEffect, useState } from "react";
import { BookPlus, Check, CheckCheck, Hourglass, Link2, Loader2, MessageCircleQuestion, Pencil, Trash2, X } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import EmptyState from "@/components/EmptyState";
import { toast, toastError } from "@/components/Toast";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/services/api";
import { OptionGrid, staffAreaCls, staffControlCls, StaffField } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { fmtDateLong } from "@/application/text/format-ar";
import {
  MAX_DETAIL_LINE, MAX_DETAIL_TEXT, MAX_PROPOSAL_HOURS,
  PROPOSAL_EXPERIENCE, PROPOSAL_FORMATS, PROPOSAL_LEVELS, PROPOSAL_MATERIALS,
  proposalDetailRows, type ProposalDetails,
} from "@/application/trainer/proposal-details";

/** حدودُ الحقول — نسخةُ الواجهة ممّا يفرضه `course-proposal.service` */
const MIN_TITLE = 3;
const MAX_TITLE = 200;
const MAX_SUMMARY = 1500;
const MAX_ANSWER = 2000;

/** ما لم يُبتّ فيه — وهو وحدَه ما يُعدَّل ويُحذف. نسخةُ `OPEN_PROPOSAL` */
const OPEN = ["draft", "submitted", "info_requested"];

interface Proposal {
  id: string;
  titleAr: string;
  summaryAr: string | null;
  details: ProposalDetails | null;
  status: string;
  courseId: string | null;
  questionAr: string | null;
  questionAt: string | null;
  answerAr: string | null;
  answeredAt: string | null;
  decisionNoteAr: string | null;
  decidedAt: string | null;
  createdAt: string;
  course: { id: string; status: string; titleAr: string | null } | null;
}

/** ما يُكتب في الفورم — العنوانُ والنبذةُ وأجوبةُ الأسئلة معا */
interface Draft { titleAr: string; summaryAr: string; details: ProposalDetails }
const EMPTY: Draft = { titleAr: "", summaryAr: "", details: {} };

const opts = (dict: Record<string, string>) => Object.entries(dict).map(([value, label]) => ({ value, label }));

/** قسمٌ مرقّمٌ في الفورم — عنوانٌ صغيرٌ ثمّ حقولُه، بلا بطاقةٍ داخلَ بطاقة */
function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-3 border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
      <legend className="contents">
        <span className="flex items-center gap-2 text-read font-bold text-foreground">
          <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-teal/15 text-fine font-black tabular-nums text-teal-light-ink">{n}</span>
          {title}
        </span>
      </legend>
      {hint ? <p className="-mt-1 text-sm leading-6 text-muted-foreground">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

/* ═══ الفورمُ واحدٌ للإضافة والتعديل ═══

   كان التعديلُ خانتين والإضافةُ خانتين، فلمّا صارت أسئلةً لزم أن يكون
   فورما واحدا: فورمٌ للإضافة وآخرُ أنحفُ للتعديل يُسقط الأجوبةَ عند أوّل
   حفظ. */
function ProposalForm({
  value, onChange,
}: { value: Draft; onChange: (d: Draft) => void }) {
  const d = value.details;
  const set = (patch: Partial<ProposalDetails>) => onChange({ ...value, details: { ...d, ...patch } });
  /* الخيارُ الواحدُ يُلغى بالضغط عليه ثانيةً — فلا يعلق جوابٌ لم يقصده */
  const one = <K extends keyof ProposalDetails>(k: K) => (v: string) =>
    set({ [k]: d[k] === v ? undefined : v } as Partial<ProposalDetails>);
  const materials = d.materials ?? [];
  return (
    <div className="grid gap-5">
      <Section n={1} title="عن الدورة">
        <div className="grid gap-3 sm:grid-cols-2">
          <StaffField label="عنوانُ الدورة *" hint="كما تريد أن يقرأه المتدرّب">
            <input
              value={value.titleAr} maxLength={MAX_TITLE} className={staffControlCls}
              placeholder="مثلا: أتمتةُ التقارير الماليّة بالجداول"
              onChange={(e) => onChange({ ...value, titleAr: e.target.value })}
            />
          </StaffField>
          <StaffField label="لمن هي؟" hint="الوظيفةُ أو المرحلةُ المهنيّة">
            <input
              value={d.audienceAr ?? ""} maxLength={MAX_DETAIL_LINE} className={staffControlCls}
              placeholder="مثلا: محاسبون في سنواتهم الأولى"
              onChange={(e) => set({ audienceAr: e.target.value })}
            />
          </StaffField>
        </div>
        <StaffField label="نبذةٌ عن الدورة" hint="فقرةٌ تُقرأ قبل أن تُصنَّف">
          <textarea
            value={value.summaryAr} maxLength={MAX_SUMMARY} rows={3} className={staffAreaCls}
            placeholder="ماذا فيها، ولماذا يحتاجها من تستهدفه"
            onChange={(e) => onChange({ ...value, summaryAr: e.target.value })}
          />
        </StaffField>
      </Section>

      <Section n={2} title="شكلُها">
        <StaffField as="div" label="المستوى">
          <OptionGrid cols={2} name="المستوى" items={opts(PROPOSAL_LEVELS)} isOn={(v) => d.level === v} onToggle={one("level")} />
        </StaffField>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <StaffField label="عددُ الساعات" hint="تقديرُك">
            <input
              type="number" inputMode="numeric" min={1} max={MAX_PROPOSAL_HOURS} dir="ltr"
              value={d.hours ?? ""} className={staffControlCls} placeholder="12"
              onChange={(e) => set({ hours: e.target.value ? Number(e.target.value) : undefined })}
            />
          </StaffField>
          <StaffField as="div" label="الصيغة">
            <OptionGrid cols={2} name="الصيغة" items={opts(PROPOSAL_FORMATS)} isOn={(v) => d.format === v} onToggle={one("format")} />
          </StaffField>
        </div>
      </Section>

      <Section n={3} title="محتواها" hint="بالمحاور والمخرجات نقارنها بكتالوجنا — فنعرف أهي جديدةٌ أم قريبةٌ من دورةٍ قائمة.">
        <div className="grid gap-3 sm:grid-cols-2">
          <StaffField label="المحاورُ الرئيسة" hint="محورٌ في كلّ سطر">
            <textarea
              value={d.topicsAr ?? ""} maxLength={MAX_DETAIL_TEXT} rows={4} className={staffAreaCls}
              placeholder={"بناءُ جدولٍ مرجعيّ\nالدوالُّ الشرطيّة\nلوحةُ مؤشّرات"}
              onChange={(e) => set({ topicsAr: e.target.value })}
            />
          </StaffField>
          <StaffField label="ما الذي يخرج به المتدرّب؟" hint="ما يقدر عليه بعدها ولم يكن يقدر">
            <textarea
              value={d.outcomesAr ?? ""} maxLength={MAX_DETAIL_TEXT} rows={4} className={staffAreaCls}
              placeholder="مثلا: يبني تقريرا شهريّا يتحدّث وحدَه"
              onChange={(e) => set({ outcomesAr: e.target.value })}
            />
          </StaffField>
        </div>
      </Section>

      {/* وكان هنا قسمٌ رابعٌ «دمجٌ أم دورةٌ جديدة؟» يسأل المدرّبَ أقربَ دورةٍ
          وهل يقبل الدمج. حُذف بقرار صاحب المنصّة (٣٠ سبتمبر ٢٠٢٦): «هذا
          نحن نقرّره لا هو». فالدمجُ حكمُ الإدارة من المحاور والمخرجات، ولا
          يُسأل عنه صاحبُ الاقتراح. والإجاباتُ القديمة تبقى تُقرأ حيث حُفظت. */}
      <Section n={4} title="جاهزيّتُك" hint="بها نقدّر متى يمكن أن تنطلق.">
        <StaffField as="div" label="هل درّستها من قبل؟">
          <OptionGrid cols={3} name="الخبرة" items={opts(PROPOSAL_EXPERIENCE)} isOn={(v) => d.experience === v} onToggle={one("experience")} />
        </StaffField>
        <StaffField as="div" label="ما الجاهزُ لديك منها؟" hint="اختر كلَّ ما ينطبق">
          <OptionGrid
            cols={3} name="الموادّ الجاهزة" items={opts(PROPOSAL_MATERIALS)}
            isOn={(v) => materials.includes(v as never)}
            onToggle={(v) => set({
              materials: (materials as string[]).includes(v)
                ? materials.filter((m) => m !== v)
                : [...materials, v as (typeof materials)[number]],
            })}
          />
        </StaffField>
      </Section>
    </div>
  );
}

/** ما يُرسَل — نصوصٌ مشذّبةٌ، والنظافةُ الأخيرةُ في الخادم */
function payloadOf(d: Draft) {
  return { titleAr: d.titleAr.trim(), summaryAr: d.summaryAr.trim() || null, details: d.details };
}

/* حالُ كلِّ اقتراحٍ بجملةٍ تقول ما جرى وما بقي — لا بكلمةٍ تُترجَم في الذهن */
function stateOf(p: Proposal): { label: string; tone: "wait" | "good" | "bad"; sayAr: string } {
  if (p.status === "linked") {
    return {
      label: "نسختُك من دورةٍ قائمة",
      tone: "good",
      sayAr: `هذه عندنا دورةٌ قائمة${p.course?.titleAr ? ` — «${p.course.titleAr}»` : ""}. `
        + "فاطلب من الإدارة أن تضيفها إلى دوراتك، ثمّ اقترِح اسمَك ومحاورَك عليها من ورشةِ شعبتك — "
        + "فتصير نسختَك منها لا دورةً ثانية.",
    };
  }
  if (p.status === "became_course") {
    return {
      label: "صارت دورةً في الكتالوج",
      tone: "good",
      /* ═══ باسمها لا برمزها (ح-١ · س-٥) ═══

         كان يُعرض «دخلت الكتالوجَ برمز C-BIZ-101» — ورمزُ الدورة مفتاحُ
         نظامٍ لا اسمٌ يقرؤه صاحبُه. والعنوانُ كان في الحمولة أصلا
         (`course.titleAr`) ولم يُستعمل.

         ═══ وحالُها تُقال (س-٦) ═══

         و`course.status` كان مُعلَنا في النوع ولا يُصيَّر — فمن قيل له «صارت
         دورةً» لا يعرف أمنشورةٌ هي أم مسوّدةٌ تنتظر. وهما حالان مختلفان
         عليه: الأولى يُدرّسها، والثانية ينتظرها. */
      sayAr: `دخلت الكتالوجَ${p.course?.titleAr ? ` باسم «${p.course.titleAr}»` : ""}`
        + (p.course?.status === "published"
          ? " وهي منشورةٌ الآن"
          : " ولمّا تُنشر بعدُ")
        + " — وإضافتُها إلى دوراتك بيدِ الإدارة.",
    };
  }
  if (p.status === "info_requested") {
    return {
      label: "الإدارةُ تسألك",
      tone: "wait",
      sayAr: "سؤالٌ واحدٌ يقف عليه قرارُها — أجِبْ عنه أدناه، ولك أن تعدّل العنوانَ والنبذةَ معه.",
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
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft>(EMPTY);
  /* جوابُ سؤالٍ واحدٍ في كلّ وقت — والمسوّدةُ بمعرّف اقتراحها كي لا يُكتب
     جوابٌ في بطاقةٍ ويُرسَل في أخرى. */
  const [answerFor, setAnswerFor] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");

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

  const canAdd = draft.titleAr.trim().length >= MIN_TITLE;
  const pending = (rows ?? []).filter((p) => OPEN.includes(p.status));
  const decided = (rows ?? []).filter((p) => !OPEN.includes(p.status));

  /* بطاقةُ اقتراحٍ واحد — تُعرض في القسمين: ما عند الإدارة، وما بُتّ فيه */
  const card = (p: Proposal) => {
    const st = stateOf(p);
    const open = OPEN.includes(p.status);
    const editing = editId === p.id;
    return (
      <Card key={p.id}>
        {editing ? (
          <div className="grid gap-4">
            <ProposalForm value={edit} onChange={setEdit} />
            <div className="flex gap-2 border-t border-white/10 pt-4">
              <Button
                tone="confirm" icon={Check} loading={busy}
                disabled={edit.titleAr.trim().length < MIN_TITLE}
                onClick={() => run(
                  () => apiPatch(`/api/trainer/course-proposals/${p.id}`, payloadOf(edit))
                    .then(() => setEditId(null)),
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
              {p.summaryAr ? (
                <div className="mt-1 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {p.summaryAr}
                </div>
              ) : null}
              {proposalDetailRows(p.details, "trainer").length > 0 ? (
                <dl className="mt-2 grid gap-x-5 gap-y-1 text-sm sm:grid-cols-2">
                  {proposalDetailRows(p.details, "trainer").map((r) => (
                    <div key={r.labelAr} className="min-w-0">
                      <dt className="inline text-muted-foreground">{r.labelAr}: </dt>
                      <dd className="inline whitespace-pre-wrap text-foreground">{r.valueAr}</dd>
                    </div>
                  ))}
                </dl>
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
                    setEdit({ titleAr: p.titleAr, summaryAr: p.summaryAr ?? "", details: p.details ?? {} });
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

        {/* ── سؤالُ الإدارة، وموضعُ جوابه ──

            والسؤالُ يبقى معروضا بعد الجواب وبعد القرار: من قرأ
            «رُفضت» بعد شهرٍ يحتاج أن يرى ما سُئل عنه وبمَ أجاب —
            وجوابٌ بلا سؤالِه نصفُ جملة. */}
        {!editing && p.questionAr ? (
          <Inset className="mt-3 grid gap-3 text-sm leading-7">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <MessageCircleQuestion className="h-4 w-4 text-teal" aria-hidden />
                سألتك الإدارة
                {p.questionAt ? (
                  <span className="text-xs font-normal text-muted-foreground/70">
                    {fmtDateLong(p.questionAt)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{p.questionAr}</p>
            </div>

            {p.answerAr ? (
              <div>
                <div className="font-bold text-foreground">
                  وأجبتَ
                  {p.answeredAt ? (
                    <span className="ms-1.5 text-xs font-normal text-muted-foreground/70">
                      {fmtDateLong(p.answeredAt)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{p.answerAr}</p>
              </div>
            ) : null}

            {p.status === "info_requested" ? (
              answerFor === p.id ? (
                <div className="grid gap-2">
                  <StaffField label="جوابُك">
                    <textarea
                      value={answerText} maxLength={MAX_ANSWER} rows={4}
                      className={staffControlCls}
                      placeholder="أجِبْ بما يكفي لتُصنَّف دورتُك — وعدّل عنوانَها ونبذتَها إن لزم"
                      onChange={(e) => setAnswerText(e.target.value)}
                    />
                  </StaffField>
                  <div className="flex gap-2">
                    <Button
                      tone="confirm" icon={Check} loading={busy}
                      disabled={answerText.trim().length < 2}
                      onClick={() => run(
                        () => apiPost(`/api/trainer/course-proposals/${p.id}/answer`, {
                          answerAr: answerText.trim(),
                        }).then(() => { setAnswerFor(null); setAnswerText(""); }),
                        "وصل جوابُك الإدارةَ",
                      )}
                    >
                      أرسِل الجواب
                    </Button>
                    <Button tone="ghost" icon={X} onClick={() => setAnswerFor(null)}>تراجَع</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Button
                    tone="confirm" icon={MessageCircleQuestion} disabled={busy}
                    onClick={() => { setAnswerFor(p.id); setAnswerText(""); }}
                  >
                    أجِبْ عن السؤال
                  </Button>
                </div>
              )
            ) : null}
          </Inset>
        ) : null}
      </Card>
    );
  };


  return (
    <TrainerLayout title="دوراتي المقترحة">
      {/* ما هذه الشاشة — تُقال مرّةً في رأسها لا في رسالةِ خطأٍ بعد الإرسال */}
      <p className="mb-5 max-w-3xl text-sm leading-7 text-muted-foreground">
        دوراتٌ تقدر عليها وليست في كتالوجنا. ما تكتبه هنا <b className="text-foreground">اقتراحٌ لا دورة</b>:
        لا يظهر في «الدورات» ولا يُحسب في التشخيص المهنيّ حتّى تصنّفه الإدارة — فتجعله
        <b className="text-foreground"> نسختَك من دورةٍ قائمة</b> إن كانت قريبةً منها، أو
        <b className="text-foreground"> دورةً جديدةً</b> تدخل الكتالوجَ بمهاراتها. وما كتبتَه في طلبِ انضمامك موجودٌ أدناه.
      </p>

      {err ? (
        <Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card>
      ) : !rows ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" />
        </div>
      ) : (
        <>
          {/* ── الإضافة ── */}
          <Card className="mb-6 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-black text-foreground">
                <BookPlus className="h-5 w-5 text-teal" aria-hidden />
                أضِف دورةً تقترحها
              </h2>
              <p className="text-sm text-muted-foreground">العنوانُ وحدَه يلزم — وكلُّ جوابٍ يوفّر سؤالا تنتظره.</p>
            </div>
            <ProposalForm value={draft} onChange={setDraft} />
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
              <Button
                tone="confirm" icon={BookPlus} loading={busy} disabled={!canAdd}
                onClick={() => run(
                  () => apiPost("/api/trainer/course-proposals", payloadOf(draft)).then(() => setDraft(EMPTY)),
                  "وصلت الإدارةَ",
                )}
              >
                أرسِلها للإدارة
              </Button>
              {!canAdd ? <span className="text-sm text-muted-foreground">اكتب عنوانَ الدورة أوّلا</span> : null}
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
            <>
              {/* ── قسمان لا قائمةٌ واحدة (٣٠ سبتمبر ٢٠٢٦) ──

                  قرارُ صاحب المنصّة: ما بُتّ فيه — صار دورةً أو نسخةً من
                  قائمةٍ أو لم يُقبل — قسمٌ منفصلٌ بعنوانه، فلا يختلط بما ينتظر
                  المدرّبُ فيه جوابا أو يعدّله. */}
              {pending.length > 0 ? (
                <section aria-labelledby="proposals-open-h" className="mb-8">
                  <h2 id="proposals-open-h" className="mb-3 flex items-center gap-2 text-base font-black text-foreground">
                    <Hourglass className="h-5 w-5 text-teal" aria-hidden />
                    اقتراحاتُك عند الإدارة
                  </h2>
                  <div className="grid gap-3">{pending.map(card)}</div>
                </section>
              ) : null}
              {decided.length > 0 ? (
                <section aria-labelledby="proposals-decided-h">
                  <h2 id="proposals-decided-h" className="flex items-center gap-2 text-base font-black text-foreground">
                    <CheckCheck className="h-5 w-5 text-teal" aria-hidden />
                    ما بُتّ فيه من اقتراحاتك
                  </h2>
                  <p className="mb-3 mt-1 text-sm leading-7 text-muted-foreground">
                    ما صار دورةً في الكتالوج، أو نسختَك من دورةٍ قائمة، أو لم يُقبل — مع ما قالته الإدارة.
                  </p>
                  <div className="grid gap-3">{decided.map(card)}</div>
                </section>
              ) : null}
            </>
          )}
        </>
      )}
    </TrainerLayout>
  );
}
