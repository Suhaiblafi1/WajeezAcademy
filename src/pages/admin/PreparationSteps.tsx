/* ═══ التجهيز — ثلاثُ خطواتٍ في ملفّ المدرّب، لا في ثلاث شاشات ═══

   ─────────── العطبُ الذي وُلدت منه هذه الشاشة ───────────

   كان تجهيزُ مدرّبٍ واحدٍ يمرّ بأربعة أبواب: أتعابُه في `/admin/trainer-compensation`،
   ودوراتُه المقترحةُ في `/admin/course-proposals`، وعقدُه في `/admin/trainer-contracts`،
   وقرارُه في `/admin/trainers`. فمن أراد أن يقبل إنسانا واحدا تنقّل بين
   أربعِ قوائمَ يبحث في كلٍّ منها عن اسمه، ثمّ عاد لا يذكر أيَّها أتمّ.

   قرارُ صاحب المنصّة (٢٠ سبتمبر ٢٠٢٦): «أذهب إلى ملفّ المدرّب فأفعل كلَّ ما
   يتعلّق به وأقبله، وانتهى. لا أنتقل من صفحةٍ إلى صفحةٍ لأجمع أشياء».

   ─────────── ولمَ بقيت الشاشاتُ الأربعُ قائمة ───────────

   لأنّها تجيب سؤالا آخر: «مَن ينتظر عقدا؟» و«أيُّ اقتراحٍ لم يُصنَّف؟» —
   نظرةٌ عبرَ المدرّبين كلِّهم لا داخلَ واحد. والمساران يكتبان في المصدر
   نفسِه بالمسالك نفسِها، فلا ثالثَ يفترق عنهما.

   ─────────── وحارسُ الصلاحيّات قائمٌ كما كان ───────────

   `TrainerCompensation.tsx` يشرح لمَ خرج محرِّرُ الأتعاب من هذه الشاشة:
   المالية تملك `trainer.compensation.manage` ولا تملك `trainer.applications.view`،
   ولا تلتقيان إلّا في المدير الأعلى. فكلُّ خطوةٍ هنا تُعرض بصلاحيّتها
   وحدَها: من لا يملكها يقرأ «تمّ / لم يتمّ» ولا يرى الرقمَ ولا النموذج.
   ولا يُفتح بابٌ جديدٌ على بياناتٍ لم تكن مفتوحةً قبل هذا الملفّ. */

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck, BookPlus, Check, CircleDashed, Coins, FileSignature,
  Link2, Link2Off, Pencil, Send, Trash2,
} from "lucide-react";
import { apiGet, apiPost, apiPatch, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import CoursePicker from "@/components/admin/CoursePicker";
import { staffControlCls as inputCls, staffAreaCls as areaCls } from "@/components/FormKit";
import { RULE_TYPE_AR } from "@/application/trainer/compensation-labels";
import { fmtDateLong } from "@/application/text/format-ar";
import {
  READINESS_LABELS_AR, type Readiness, type ReadinessStepKey,
} from "@/application/trainer/readiness";

/* ─────────── ما تقرؤه هذه الشاشةُ من ردّ الملفّ ─────────── */

/* ═══ القاعدةُ السارية كما يقولها الخادم ═══

   ولا تُستنتَج هنا بمقارنة تواريخ: «أيُّ قاعدةٍ سارية؟» جوابُها في
   `EarningsService.activeRule` — نطاقُ الشعبة ثمّ الدورة ثمّ العامّة،
   والأحدثُ سريانا. ونسخةٌ ثانيةٌ في المتصفّح تفترق عنها في أوّل تعديل،
   فتقول للموظّف رقما غيرَ الذي يُحتسب به أجرُ إنسان. */
export interface PrepRule {
  id: string; type: string; rate: string | number; currency: string;
  minSeats: number; referralRate: string | number | null;
  effectiveFrom: string;
}

export interface PrepProposal {
  id: string; titleAr: string; summaryAr: string | null; status: string;
  courseId: string | null;
  course?: { id: string; versions: { titleAr: string }[] } | null;
  decisionNoteAr?: string | null;
}

export interface PrepContract {
  id: string; title: string; status: string; revision: number;
  signerLegalName: string | null; signedAt: string | null; countersignedAt: string | null;
  declineReasonAr?: string | null; gatesActivation?: boolean;
}

export interface PrepQualification {
  courseId: string; status: string;
  course?: { versions: { titleAr: string }[] } | null;
}

/* والمساراتُ والمجالاتُ يردّهما `/api/admin/catalog/courses` من قبلُ —
   وكان النوعُ هنا أضيقَ ممّا يصل، فيُرمى ما لا يُعلَن. ومرشِّحُ
   «المجال» يُبنى منهما، فلو بقي النوعُ ضيّقا لَما ظهر المرشِّحُ أصلا. */
interface CourseOption {
  id: string; status: string; title: string;
  pathwayNames?: string[]; diagnosticDomains?: string[];
}

interface PrefillCourse { courseId: string; titleAr: string }
interface Prefill {
  profileId: string; fullName: string; email: string; gatesActivation: boolean;
  courses: PrefillCourse[];
  compensation: {
    ruleId: string; type: string; rate: string; currency: string;
    minSeats: number; referralRate: string | null;
  } | null;
  feeNotes: { reviewerName: string | null; expectation: string | null; proposal: string | null }[];
  defaultDocuments: { kind: string; labelAr: string; required: boolean }[];
  documentKinds: { kind: string; labelAr: string }[];
  missingLegal: string[];
  openContract: { id: string; status: string; title: string } | null;
}

export interface PreparationProps {
  applicationId: string;
  profileId: string | null;
  readiness?: Readiness;
  proposals: PrepProposal[];
  contracts: PrepContract[];
  qualifications: PrepQualification[];
  /** القاعدةُ السارية كما حسبها الخادم — و`null` تعني «لا اتّفاقَ بعد» */
  activeRule: PrepRule | null;
  /** صلاحيّاتُ من يقرأ — كلُّ خطوةٍ تُعرض بصلاحيّتها وحدَها */
  permissions: string[];
  /** يُعاد تحميلُ الملفّ بعد كلّ فعلٍ يغيّر شيئا */
  onChanged: () => void | Promise<void>;
}

const courseTitle = (c?: { versions: { titleAr: string }[] } | null, fallback = "") =>
  c?.versions?.[0]?.titleAr ?? fallback;

/* ─────────── قِشرةُ الخطوة: رقمٌ وحالٌ وعنوانٌ وما ينقص ─────────── */

function Step({
  n, stepKey, done, blockerAr, icon: Icon, children, locked,
}: {
  n: number; stepKey: ReadinessStepKey; done: boolean; blockerAr: string | null;
  icon: typeof Coins; children: React.ReactNode;
  /** لا صلاحيّةَ لتحريرها — تُقرأ حالُها ولا يُفتح نموذجُها */
  locked?: boolean;
}) {
  return (
    <Panel as="section" tone={done ? "positive" : "default"}>
      <header className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-fine font-black ${
            done ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.07] text-muted-foreground"
          }`}
        >
          {done ? <Check className="h-4 w-4" /> : n}
        </span>
        <h4 className="flex items-center gap-2 text-sm font-black text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {READINESS_LABELS_AR[stepKey]}
        </h4>
        <span
          className={`rounded-full px-2.5 py-0.5 text-fine font-bold ${
            done ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
          }`}
        >
          {done ? "تمّ" : "لم يتمّ"}
        </span>
      </header>

      {!done && blockerAr && (
        <p className="mt-2.5 text-read leading-6 text-amber-200/90">{blockerAr}</p>
      )}

      {locked ? (
        <p className="mt-3 text-read leading-6 text-muted-foreground">
          تُدار هذه الخطوةُ بصلاحيّةٍ لا تملكها — وحالُها أعلاه يُقرأ ولا يُحرَّر.
        </p>
      ) : (
        <div className="mt-3">{children}</div>
      )}
    </Panel>
  );
}

/* ═══════════ الخطوةُ الأولى — الاتفاقُ الماليّ ═══════════ */

function FeeStep({
  profileId, live, onChanged, busy, run,
}: {
  profileId: string; live: PrepRule | null; onChanged: () => void | Promise<void>;
  busy: boolean; run: (work: () => Promise<unknown>, okAr: string) => Promise<void>;
}) {
  const [type, setType] = useState("per_seat");
  const [rate, setRate] = useState("");
  const [minSeats, setMinSeats] = useState("");
  const [referralRate, setReferralRate] = useState("");

  const save = () =>
    run(async () => {
      await apiPost("/api/admin/trainer-compensation-rules", {
        profileId,
        type,
        rate: Number(rate),
        ...(minSeats.trim() ? { minSeats: Number(minSeats) } : {}),
        ...(type === "per_seat" && referralRate.trim() ? { referralRate: Number(referralRate) } : {}),
      });
      setRate("");
      setMinSeats("");
      setReferralRate("");
      await onChanged();
    }, "ضُبط الاتفاقُ الماليّ");

  return (
    <div className="grid gap-3">
      {live ? (
        <Inset as="p" tone="positive" className="px-3.5 py-2.5 text-read leading-6">
          السارية: <b>{RULE_TYPE_AR[live.type] ?? live.type}</b> ·{" "}
          <span className="tabular-nums" dir="ltr">
            {String(live.rate)} {live.type === "revenue_share" ? "%" : live.currency}
          </span>
          {live.minSeats > 0 && <> · حدٌّ أدنى {live.minSeats} مقعدا</>}
          {live.referralRate && (
            <> · بالإحالة <span className="tabular-nums" dir="ltr">{String(live.referralRate)}</span></>
          )}
          <span className="text-muted-foreground"> — منذ {fmtDateLong(live.effectiveFrom)}</span>
        </Inset>
      ) : (
        <p className="text-read leading-6 text-muted-foreground">
          لا قاعدةَ سارية. وبلا قاعدةٍ لا يُولَّد كشفُ مستحقّاتٍ أصلا — فتبقى «مستحقّاتي»
          عنده صفرا ولا يعلم أحدٌ لماذا.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-read text-muted-foreground">
          نموذجُ الأجر
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {Object.entries(RULE_TYPE_AR).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-read text-muted-foreground">
          {type === "revenue_share" ? "النسبة من الإيراد (٪)" : "المبلغ"}
          <input
            value={rate} onChange={(e) => setRate(e.target.value)}
            inputMode="decimal" dir="ltr" placeholder="0.00" className={inputCls}
          />
        </label>
        {type === "per_seat" && (
          <>
            <label className="grid gap-1 text-read text-muted-foreground">
              حدٌّ أدنى للمقاعد المحتسبة <span className="text-muted-foreground/70">(اختياريّ)</span>
              <input
                value={minSeats} onChange={(e) => setMinSeats(e.target.value)}
                inputMode="numeric" dir="ltr" placeholder="0" className={inputCls}
              />
            </label>
            <label className="grid gap-1 text-read text-muted-foreground">
              أجرُ المقعد بإحالته <span className="text-muted-foreground/70">(اختياريّ)</span>
              <input
                value={referralRate} onChange={(e) => setReferralRate(e.target.value)}
                inputMode="decimal" dir="ltr" placeholder="0.00" className={inputCls}
              />
            </label>
          </>
        )}
      </div>

      <div>
        <Button
          tone="confirm" size="sm" icon={Coins} loading={busy}
          disabled={!(Number(rate) > 0)}
          onClick={() => void save()}
        >
          {live ? "استبدِلِ القاعدةَ السارية" : "اضبطِ الاتفاقَ الماليّ"}
        </Button>
        {live && (
          <p className="mt-1.5 text-read leading-5 text-muted-foreground">
            القاعدةُ السابقةُ تُغلق بتاريخها ولا تُمحى — فما حُسب عليها يبقى مفسَّرا.
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════ الخطوةُ الثانية — المؤهّلاتُ والدورات ═══════════ */

const PROPOSAL_STATUS_AR: Record<string, string> = {
  draft: "مسودّة عنده", submitted: "بانتظار التصنيف", info_requested: "سُئل — ننتظر جوابَه",
  linked: "رُبطت برمزٍ قائم", became_course: "صارت دورةً", rejected: "رُدّت",
};

function CoursesStep({
  profileId, proposals, qualifications, courses, canQualify, canClassify, busy, run, onChanged,
}: {
  profileId: string; proposals: PrepProposal[]; qualifications: PrepQualification[];
  courses: CourseOption[]; canQualify: boolean; canClassify: boolean;
  busy: boolean; run: (work: () => Promise<unknown>, okAr: string) => Promise<void>;
  onChanged: () => void | Promise<void>;
}) {
  const [qualifyCourse, setQualifyCourse] = useState("");
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [linkCourse, setLinkCourse] = useState("");
  const [editFor, setEditFor] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const qualified = qualifications.filter((q) => q.status === "qualified");
  /* المفتوحُ والمربوطُ معا — والمربوطُ يُراجَع (انظر `QUEUE_VISIBLE`) */
  const shown = proposals.filter((p) => p.status !== "rejected" && p.status !== "became_course");
  const open = proposals.filter((p) => ["draft", "submitted", "info_requested"].includes(p.status));

  const close = () => {
    setLinkFor(null); setLinkCourse("");
    setEditFor(null); setEditTitle(""); setEditSummary("");
    setRejectFor(null); setRejectNote("");
  };

  return (
    <div className="grid gap-4">
      {/* ── ما هو مؤهَّلٌ له ── */}
      <div>
        <h5 className="text-read font-black text-foreground">الدورات المؤهَّل لها — {qualified.length}</h5>
        {qualified.length === 0 ? (
          <p className="mt-1.5 text-read leading-6 text-muted-foreground">
            لا دورةَ بعد. وما ذكره في طلبه من دورات الكتالوج يُبذَر آليّا عند قبوله داخليّا.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {qualified.map((q) => (
              <li
                key={q.courseId}
                className="rounded-full border border-teal/35 bg-teal/[0.08] px-3 py-1 text-read font-bold text-teal-light-ink"
              >
                {courseTitle(q.course, q.courseId)}
              </li>
            ))}
          </ul>
        )}

        {canQualify && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            <label className="sr-only" htmlFor={`qualify-${profileId}`}>دورةٌ يُؤهَّل لها</label>
            <select
              id={`qualify-${profileId}`} value={qualifyCourse}
              onChange={(e) => setQualifyCourse(e.target.value)}
              className={`${inputCls} min-w-[14rem] flex-1`}
            >
              <option value="">أضِفْ دورةً يُؤهَّل لها…</option>
              {courses
                .filter((c) => !qualified.some((q) => q.courseId === c.id))
                .map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <Button
              tone="secondary" size="sm" loading={busy} disabled={!qualifyCourse}
              onClick={() => void run(async () => {
                await apiPost(`/api/admin/trainers/${profileId}/qualifications`, { courseId: qualifyCourse });
                setQualifyCourse("");
                await onChanged();
              }, "أُهِّل للدورة")}
            >
              أهِّلْه
            </Button>
          </div>
        )}
      </div>

      {/* ── دوراتٌ يقترحها هو ── */}
      <div className="border-t border-white/10 pt-3.5">
        <h5 className="text-read font-black text-foreground">
          دوراتٌ يقترحها — {shown.length}
          {open.length > 0 && (
            <span className="ms-2 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-fine font-bold text-amber-300">
              {open.length} بانتظار التصنيف
            </span>
          )}
        </h5>

        {shown.length === 0 ? (
          <p className="mt-1.5 text-read leading-6 text-muted-foreground">
            لا اقتراحَ منه خارجَ الكتالوج.
          </p>
        ) : (
          <ul className="mt-2.5 grid gap-2.5">
            {shown.map((p) => (
              <li key={p.id}>
                <Card className="bg-paper/20 p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-[12rem] flex-1">
                      <div className="text-read font-bold text-foreground">{p.titleAr}</div>
                      {p.summaryAr && (
                        <p className="mt-1 whitespace-pre-wrap text-read leading-6 text-muted-foreground">
                          {p.summaryAr}
                        </p>
                      )}
                      {p.status === "linked" && (
                        /* ولا يختفي المربوطُ: الربطُ حكمُ تشابهٍ يُراجَع */
                        <p className="mt-1.5 text-read font-bold text-teal-light-ink">
                          رُبطت بـ «{courseTitle(p.course, p.courseId ?? "—")}»
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-fine text-muted-foreground">
                      {PROPOSAL_STATUS_AR[p.status] ?? p.status}
                    </span>
                  </div>

                  {canClassify && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button
                        tone="secondary" size="sm" icon={Link2}
                        onClick={() => { close(); setLinkFor(p.id); setLinkCourse(p.courseId ?? ""); }}
                      >
                        {p.status === "linked" ? "اربِطْها بغيرها" : "اربِطْها برمزٍ قائم"}
                      </Button>
                      {p.status === "linked" && (
                        <Button
                          tone="ghost" size="sm" icon={Link2Off} loading={busy}
                          onClick={() => void run(async () => {
                            await apiPost(`/api/admin/course-proposals/${p.id}/unlink`, {});
                            await onChanged();
                          }, "نُقض الربطُ — عادت إلى الطابور")}
                        >
                          انقُضِ الربط
                        </Button>
                      )}
                      <Button
                        tone="ghost" size="sm" icon={Pencil}
                        onClick={() => {
                          close(); setEditFor(p.id);
                          setEditTitle(p.titleAr); setEditSummary(p.summaryAr ?? "");
                        }}
                      >
                        صحِّحْ نصَّها
                      </Button>
                      {p.status !== "linked" && (
                        <Button
                          tone="danger" size="sm" icon={Trash2}
                          onClick={() => { close(); setRejectFor(p.id); }}
                        >
                          ردَّها
                        </Button>
                      )}
                    </div>
                  )}

                  {linkFor === p.id && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <label className="sr-only" htmlFor={`link-${p.id}`}>الرمزُ الذي تُربط به</label>
                      <div className="min-w-[16rem] flex-1">
                        <CoursePicker
                          id={`link-${p.id}`} courses={courses}
                          value={linkCourse} onChange={setLinkCourse}
                          labelAr="الرمزُ الذي تُربط به"
                        />
                      </div>
                      <Button
                        tone="confirm" size="sm" loading={busy} disabled={!linkCourse}
                        onClick={() => void run(async () => {
                          await apiPost(`/api/admin/course-proposals/${p.id}/link`, { courseId: linkCourse });
                          close();
                          await onChanged();
                        }, "رُبط الاقتراحُ بالرمز")}
                      >
                        اربِطْ
                      </Button>
                      <Button tone="ghost" size="sm" onClick={close}>تراجعْ</Button>
                    </div>
                  )}

                  {editFor === p.id && (
                    <div className="mt-2.5 grid gap-2">
                      <input
                        value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                        maxLength={200} placeholder="عنوانُ الدورة" className={inputCls}
                      />
                      <textarea
                        value={editSummary} onChange={(e) => setEditSummary(e.target.value)}
                        rows={2} maxLength={2000} placeholder="نبذةٌ عنها" className={areaCls}
                      />
                      <p className="text-read leading-5 text-muted-foreground">
                        وهي كلماتُ صاحبها — فما كان يُكتب في سجلّ الأثر كاملا.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          tone="confirm" size="sm" loading={busy} disabled={editTitle.trim().length < 3}
                          onClick={() => void run(async () => {
                            await apiPatch(`/api/admin/course-proposals/${p.id}`, {
                              titleAr: editTitle.trim(),
                              summaryAr: editSummary.trim() || null,
                            });
                            close();
                            await onChanged();
                          }, "صُحِّح نصُّ الاقتراح")}
                        >
                          احفظْ
                        </Button>
                        <Button tone="ghost" size="sm" onClick={close}>تراجعْ</Button>
                      </div>
                    </div>
                  )}

                  {rejectFor === p.id && (
                    <div className="mt-2.5 grid gap-2">
                      <textarea
                        value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
                        rows={2} maxLength={2000} className={areaCls}
                        placeholder="لمَ رُدَّت — يصل صاحبَها، وبلا سببٍ يعيدها كما هي"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          tone="danger" size="sm" loading={busy} disabled={rejectNote.trim().length < 5}
                          onClick={() => void run(async () => {
                            await apiPost(`/api/admin/course-proposals/${p.id}/reject`, { noteAr: rejectNote.trim() });
                            close();
                            await onChanged();
                          }, "رُدَّ الاقتراحُ بسببه")}
                        >
                          ردَّها
                        </Button>
                        <Button tone="ghost" size="sm" onClick={close}>تراجعْ</Button>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-2.5 text-read leading-5 text-muted-foreground">
          و«دورةٌ جديدة» تُنشأ في شاشة الكتالوج بنموذجها الكامل — مهاراتِها وساعاتِها —
          ثمّ تُربط من طابور الاقتراحات. ولا تُنشأ من هنا كي لا يُكتب باسمه ما لم يكتبه.
        </p>
      </div>
    </div>
  );
}

/* ═══════════ الخطوةُ الثالثة — العقد ═══════════ */

const CONTRACT_STATUS_AR: Record<string, string> = {
  draft: "مسودّة", sent: "أُرسل — بانتظار توقيعه", declined: "اعتذر عنه",
  revoked: "أُلغي", signed: "وقّعه — بانتظار اعتمادنا", countersigned: "نافذ",
  expired: "انقضى", terminated: "فُسخ",
};

function ContractStep({
  applicationId, contracts, canManage, busy, run, onChanged,
}: {
  applicationId: string; contracts: PrepContract[]; canManage: boolean;
  busy: boolean; run: (work: () => Promise<unknown>, okAr: string) => Promise<void>;
  onChanged: () => void | Promise<void>;
}) {
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [hoursNote, setHoursNote] = useState("");
  const [waived, setWaived] = useState("");
  const [docs, setDocs] = useState<Record<string, boolean>>({});
  const [signOff, setSignOff] = useState<string | null>(null);
  const [signOffNote, setSignOffNote] = useState("");

  const live = contracts.filter((c) => c.status !== "revoked");
  const awaitingCountersign = live.find((c) => c.status === "signed") ?? null;
  const sent = live.find((c) => c.status === "sent") ?? null;

  const openComposer = () =>
    run(async () => {
      const p = await apiGet<Prefill>(`/api/admin/trainer-applications/${applicationId}/contract-prefill`);
      setPrefill(p);
      setTitle(`عقد تدريب ${new Date().getFullYear()}`);
      setDocs(Object.fromEntries(p.defaultDocuments.map((d) => [d.kind, d.required])));
      setComposing(true);
    }, "جاهزٌ للتركيب");

  return (
    <div className="grid gap-3">
      {live.length === 0 ? (
        <p className="text-read leading-6 text-muted-foreground">
          لا عقدَ بعد. والعقدُ يُركَّب مرّةً ويُجمَّد نصُّه، ثمّ يُرسَل رابطا يوقّع منه.
        </p>
      ) : (
        <ul className="grid gap-2">
          {live.map((c) => (
            <li key={c.id}>
              <Card className="bg-paper/20 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-read font-bold text-foreground">
                    {c.title} <span className="text-muted-foreground">· نسخة {c.revision}</span>
                  </span>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-fine text-muted-foreground">
                    {CONTRACT_STATUS_AR[c.status] ?? c.status}
                  </span>
                </div>
                {c.signerLegalName && (
                  <p className="mt-1.5 text-read leading-6 text-muted-foreground">
                    وقّعه <b className="text-foreground">{c.signerLegalName}</b>
                    {c.signedAt && <> · {fmtDateLong(c.signedAt)}</>}
                  </p>
                )}
                {c.declineReasonAr && (
                  <p className="mt-1.5 text-read leading-6 text-amber-200/90">
                    اعتذر: {c.declineReasonAr}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {!canManage ? null : (
        <>
          {/* ── اعتمادُ التوقيع ── */}
          {awaitingCountersign && (
            signOff === awaitingCountersign.id ? (
              <div className="grid gap-2">
                <textarea
                  value={signOffNote} onChange={(e) => setSignOffNote(e.target.value)}
                  rows={2} maxLength={500} className={areaCls}
                  placeholder="ما طابقتَه بالوثيقة — أو تفويضُك الخطّيُّ إن لم تكن المفوَّضَ في السجلّ"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    tone="confirm" size="sm" icon={BadgeCheck} loading={busy}
                    onClick={() => void run(async () => {
                      await apiPost(`/api/admin/trainer-contracts/${awaitingCountersign.id}/countersign`, {
                        noteAr: signOffNote.trim() || null,
                      });
                      setSignOff(null); setSignOffNote("");
                      await onChanged();
                    }, "نفَذ العقدُ — وتمّت الخطوةُ الثالثة")}
                  >
                    اعتمِدِ التوقيع
                  </Button>
                  <Button tone="ghost" size="sm" onClick={() => setSignOff(null)}>تراجعْ</Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  tone="confirm" size="sm" icon={BadgeCheck}
                  onClick={() => setSignOff(awaitingCountersign.id)}
                >
                  طابقتُ الاسمَ بالهويّة — اعتمِدْ توقيعَه
                </Button>
                <p className="mt-1.5 text-read leading-5 text-muted-foreground">
                  ولا يُفتح حسابُه بهذا: القبولُ الكاملُ قرارُك أنت، أسفلَ هذه الخطوات.
                </p>
              </div>
            )
          )}

          {/* ── إرسالٌ وتجديدٌ لعقدٍ قائم ── */}
          {sent && (
            <div className="flex flex-wrap gap-2">
              <Button
                tone="secondary" size="sm" icon={Send} loading={busy}
                onClick={() => void run(async () => {
                  await apiPost(`/api/admin/trainer-contracts/${sent.id}/resend`, {});
                  await onChanged();
                }, "جُدّد الرابطُ وأُرسل — والقديمُ مات لحظتَها")}
              >
                جدِّدِ الرابطَ وأعِدِ الإرسال
              </Button>
            </div>
          )}

          {/* ── تركيبُ عقدٍ جديد ── */}
          {!composing ? (
            <div>
              <Button tone={live.length === 0 ? "confirm" : "ghost"} size="sm" icon={FileSignature}
                loading={busy} onClick={() => void openComposer()}>
                {live.length === 0 ? "ركِّبِ العقدَ" : "ركِّبْ عقدا جديدا"}
              </Button>
            </div>
          ) : prefill && (
            <Card className="bg-paper/20 p-3.5">
              {prefill.missingLegal.length > 0 && (
                <Inset as="p" tone="warn" className="mb-3 px-3.5 py-2.5 text-read leading-6">
                  ناقصٌ في هويّة الأكاديميّة: {prefill.missingLegal.join(" · ")} — يُستكمَل قبل الإرسال.
                </Inset>
              )}

              <div className="grid gap-2">
                <label className="grid gap-1 text-read text-muted-foreground">
                  عنوانُ العقد
                  <input value={title} onChange={(e) => setTitle(e.target.value)}
                    maxLength={160} className={inputCls} />
                </label>

                <p className="text-read leading-6 text-muted-foreground">
                  الملحقُ (أ) — الدوراتُ المؤهَّل لها يومَ الإرسال:{" "}
                  {prefill.courses.length === 0
                    ? <b className="text-amber-300">لا دورةَ بعد — الملحقُ يخرج فارغا</b>
                    : <b className="text-foreground">{prefill.courses.map((c) => c.titleAr).join(" · ")}</b>}
                </p>

                <p className="text-read leading-6 text-muted-foreground">
                  الملحقُ (ب) — الأتعاب:{" "}
                  {prefill.compensation
                    ? (
                      <b className="text-foreground" dir="ltr">
                        {RULE_TYPE_AR[prefill.compensation.type] ?? prefill.compensation.type}{" "}
                        {prefill.compensation.rate}{" "}
                        {prefill.compensation.type === "revenue_share" ? "%" : prefill.compensation.currency}
                      </b>
                    )
                    : <b className="text-amber-300">لا قاعدةَ سارية — اضبطِ الخطوةَ الأولى أوّلا</b>}
                </p>

                {prefill.feeNotes.length > 0 && (
                  <div className="text-read leading-6 text-muted-foreground">
                    ممّا قيل في المقابلة عن الأجر — للاستئناس لا للاحتساب:
                    <ul className="mt-1 grid gap-0.5">
                      {prefill.feeNotes.map((n, i) => (
                        <li key={i}>
                          {n.reviewerName ?? "مراجع"}: {[n.expectation, n.proposal].filter(Boolean).join(" — ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!prefill.compensation && (
                  <label className="grid gap-1 text-read text-muted-foreground">
                    ولا يُرسَل بلا أجرٍ إلّا بسببٍ مكتوب
                    <input value={waived} onChange={(e) => setWaived(e.target.value)}
                      maxLength={500} className={inputCls}
                      placeholder="لمَ يُرسَل العقدُ بلا قاعدةِ أتعابٍ قائمة" />
                  </label>
                )}

                <label className="grid gap-1 text-read text-muted-foreground">
                  ما يُقال عن الساعات والكلفة <span className="text-muted-foreground/70">(اختياريّ)</span>
                  <textarea value={hoursNote} onChange={(e) => setHoursNote(e.target.value)}
                    rows={2} maxLength={500} className={areaCls} />
                </label>

                <fieldset className="grid gap-1.5">
                  <legend className="text-read text-muted-foreground">
                    الملحقُ (ج) — ما يُطلب منه رفعُه قبل التوقيع
                  </legend>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {prefill.documentKinds.map((k) => (
                      <label key={k.kind} className="flex items-center gap-1.5 text-read text-foreground">
                        <input
                          type="checkbox" checked={docs[k.kind] ?? false}
                          onChange={(e) => setDocs({ ...docs, [k.kind]: e.target.checked })}
                        />
                        {k.labelAr}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="flex flex-wrap gap-2">
                  <Button
                    tone="confirm" size="sm" icon={Send} loading={busy}
                    disabled={title.trim().length < 3 || (!prefill.compensation && waived.trim().length < 5)}
                    onClick={() => void run(async () => {
                      const body = {
                        title: title.trim(),
                        requiredDocuments: prefill.documentKinds
                          .filter((k) => docs[k.kind])
                          .map((k) => ({ kind: k.kind, labelAr: k.labelAr, required: true })),
                        hoursNoteAr: hoursNote.trim() || null,
                        rateWaivedReasonAr: prefill.compensation ? null : waived.trim(),
                      };
                      const made = await apiPost<{ id: string }>(
                        `/api/admin/trainer-applications/${applicationId}/contracts/compose`, body);
                      await apiPost(`/api/admin/trainer-contracts/${made.id}/send`, {});
                      setComposing(false);
                      setPrefill(null);
                      await onChanged();
                    }, "رُكّب العقدُ وأُرسل — يوقّع من رابطه")}
                  >
                    ركِّبْ وأرسِلْ
                  </Button>
                  <Button tone="ghost" size="sm" onClick={() => { setComposing(false); setPrefill(null); }}>
                    تراجعْ
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════ الشاشةُ نفسُها ═══════════ */

export default function PreparationSteps({
  applicationId, profileId, readiness, activeRule, proposals, contracts,
  qualifications, permissions, onChanged,
}: PreparationProps) {
  const [busy, setBusy] = useState(false);
  const [courses, setCourses] = useState<CourseOption[]>([]);

  const can = useCallback((p: string) => permissions.includes(p), [permissions]);

  useEffect(() => {
    let alive = true;
    apiGet<CourseOption[]>("/api/admin/catalog/courses")
      .then((c) => { if (alive) setCourses(c); })
      /* والكتالوجُ خلف صلاحيّته: من لا يملكها يجهّز ما عداه ولا تسقط الشاشة */
      .catch(() => { if (alive) setCourses([]); });
    return () => { alive = false; };
  }, []);

  const run = useCallback(async (work: () => Promise<unknown>, okAr: string) => {
    setBusy(true);
    try {
      await work();
      toast(okAr);
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ الإجراء");
    } finally {
      setBusy(false);
    }
  }, []);

  const stepOf = (k: ReadinessStepKey) => readiness?.steps.find((s) => s.key === k);

  if (!profileId) {
    return (
      <Panel as="section" tone="warn">
        <h4 className="text-sm font-black text-foreground">لم يبدأ تجهيزُه بعد</h4>
        <p className="mt-2 text-read leading-7 text-muted-foreground">
          التجهيزُ يبدأ بـ<b className="text-foreground">«اقبَلْه داخليّا»</b> في شريط القرار أعلاه:
          يُفتح له ملفُّ مدرّبٍ، وتُبذَر مؤهّلاتُه ممّا ذكره في طلبه، فتُضبط أتعابُه
          وتُصنَّف دوراتُه ويُركَّب عقدُه — <b className="text-foreground">ولا يصله خبرُ قبولٍ بعد</b>.
          والقبولُ الكاملُ بعد أن تتمّ الثلاث.
        </p>
      </Panel>
    );
  }

  return (
    <div className="grid gap-3">
      <Panel as="section" tone="accent">
        <h4 className="flex items-center gap-2 text-sm font-black text-foreground">
          <CircleDashed className="h-4 w-4" aria-hidden="true" /> تجهيزُه قبل القبول الكامل
        </h4>
        <p className="mt-2 text-read leading-7 text-muted-foreground">
          ثلاثُ خطواتٍ تُعمل من هنا ولا تُجمع من شاشاتٍ أخرى. وحين تتمّ الثلاثُ يُفتح
          زرُّ <b className="text-foreground">«اعتمِدْه نهائيّا»</b> في شريط القرار — وعندها وحدَها
          يصله خبرُ اعتماده وتُفتح بوّابتُه.
        </p>
        {readiness && (
          <ol className="mt-3 grid gap-1.5">
            {readiness.steps.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2 text-read">
                {s.done
                  ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                  : <CircleDashed className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />}
                <span className={s.done ? "text-muted-foreground line-through" : "text-foreground"}>
                  {i + 1}. {s.labelAr}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Step
        n={1} stepKey="compensation" icon={Coins}
        done={stepOf("compensation")?.done ?? false}
        blockerAr={stepOf("compensation")?.blockerAr ?? null}
        locked={!can("trainer.compensation.manage")}
      >
        <FeeStep profileId={profileId} live={activeRule} onChanged={onChanged} busy={busy} run={run} />
      </Step>

      <Step
        n={2} stepKey="qualifications" icon={BookPlus}
        done={stepOf("qualifications")?.done ?? false}
        blockerAr={stepOf("qualifications")?.blockerAr ?? null}
        locked={!can("trainer.qualify") && !can("trainer.change.review")}
      >
        <CoursesStep
          profileId={profileId} proposals={proposals} qualifications={qualifications}
          courses={courses} canQualify={can("trainer.qualify")} canClassify={can("trainer.change.review")}
          busy={busy} run={run} onChanged={onChanged}
        />
      </Step>

      <Step
        n={3} stepKey="contract" icon={FileSignature}
        done={stepOf("contract")?.done ?? false}
        blockerAr={stepOf("contract")?.blockerAr ?? null}
        locked={!can("trainer.contract.manage")}
      >
        <ContractStep
          applicationId={applicationId} contracts={contracts}
          canManage={can("trainer.contract.manage")} busy={busy} run={run} onChanged={onChanged}
        />
      </Step>
    </div>
  );
}
