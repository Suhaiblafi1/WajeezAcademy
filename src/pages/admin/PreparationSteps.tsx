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
   ولا يُفتح بابٌ جديدٌ على بياناتٍ لم تكن مفتوحةً قبل هذا الملفّ.

   ─────────── والأجرُ لأيٍّ من المدير الأكاديميّ والماليّة (٢٦ أكتوبر ٢٠٢٦) ───────────

   كانت خطوةُ الأجر مقفلةً إلّا على `trainer.compensation.manage`، والمديرُ الأكاديميُّ يضبط الرقمَ نفسَه في مُركِّب
   العقد (قرارُ ١ أكتوبر: «all can change»). فسُئل صاحبُ المنصّة فقال «C»: أيٌّ منهما، والأثرُ يقول من فعل. فصارت
   تُفتح لأيٍّ من الحبّتين، وتحتها سجلُّ أجره بمن ضبط كلَّ قاعدةٍ ومتى (`fee-history`). */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import {
  BadgeCheck, BookPlus, Check, ChevronDown, ChevronUp, CircleDashed, Coins, FileSignature, FileText,
  Link2, Link2Off, Pencil, Send, Trash2,
} from "lucide-react";
import { apiGet, apiPost, apiPatch, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import CoursePicker from "@/components/admin/CoursePicker";
import { staffControlCls as inputCls, staffAreaCls as areaCls } from "@/components/FormKit";
import { RULE_TYPE_AR } from "@/application/trainer/compensation-labels";
import { outContractOf } from "@/application/trainer/contract-fee";
import { foldProposals } from "@/application/trainer/proposal-fold";
import { fmtDateLong, fmtDayMonth } from "@/application/text/format-ar";
import { amendmentLinesOf, contractStoryOf } from "@/application/trainer/contract-story";
import { parseContractDoc } from "@/application/trainer/contract-sections";
import ContractDocument from "@/components/ContractDocument";
import Modal from "@/components/Modal";
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

/** قاعدةٌ من سجلّ أجره — بمن ضبطها (`GET /api/admin/trainers/:profileId/fee-history`) */
interface FeeHistoryRow {
  id: string; type: string; rate: string; currency: string;
  effectiveFrom: string; effectiveTo: string | null; createdByName: string | null;
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
  /** أجرُ العقد كما جُمِّد في نصّه — يقارَن بخطوة الأجر (`outContractOf`) */
  createdAt?: string; compensationType?: string | null; compensationRate?: string | null; currency?: string | null;
  /** قصّتُه وطلبُ تعديله وجوابُه (`contract-story.ts`) — والبصمةُ تقول إنّ له نصّا يُفتح */
  sentAt?: string | null; firstOpenedAt?: string | null; declinedAt?: string | null; declineReplyAr?: string | null;
  signatureApprovedAt?: string | null; revokedAt?: string | null; replacesContractId?: string | null;
  amendmentRequestAr?: string | null; amendmentRequestedAt?: string | null;
  amendmentReplyAr?: string | null; amendmentRepliedAt?: string | null; bodyHash?: string | null;
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

export interface PreparationProps {
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
  /** عقودُه في «العقود» — حيث يُغيَّر الأجرُ مع العقد */
  contractsHref?: string;
  /** مُركِّبُ «العقود» لهذا المدرّب — المُركِّبُ الواحد (`prepare`) */
  composeHref?: string;
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
        <p className="mt-2.5 text-read leading-6 text-gold-ink">{blockerAr}</p>
      )}

      {locked ? (
        <p className="mt-3 text-read leading-6 text-muted-foreground">
          هذه الخطوة تحتاج صلاحيّة لا تملكها، فيمكنك رؤية حالها فقط.
        </p>
      ) : (
        <div className="mt-3">{children}</div>
      )}
    </Panel>
  );
}

/* ═══════════ الخطوةُ الأولى — الاتفاقُ الماليّ ═══════════ */

function FeeStep({
  profileId, live, contracts, contractsHref, onChanged, busy, run,
}: {
  profileId: string; live: PrepRule | null; onChanged: () => void | Promise<void>;
  /** عقودُه — فإن خرج له عقدٌ لم ينفذ قيل قبل الحفظ إنّ نصَّه لا يتغيّر به */
  contracts: PrepContract[];
  /** «العقود» لهذا المدرّب — لمن يملك تركيبَ العقد وحدَه */
  contractsHref?: string;
  busy: boolean; run: (work: () => Promise<unknown>, okAr: string) => Promise<void>;
}) {
  const [type, setType] = useState("per_seat");
  const [rate, setRate] = useState("");
  const [minSeats, setMinSeats] = useState("");
  const [referralRate, setReferralRate] = useState("");
  /* ═══ وسجلُّ أجره — من ضبط كلَّ قاعدةٍ ومتى (قرارُ «C»، ٢٦ أكتوبر ٢٠٢٦) ═══
     يضبطه المديرُ الأكاديميُّ أو الماليّة، «والأثرُ يقول من فعل» — فيُقرأ هنا تحت الرقم لا في شاشةٍ أخرى. */
  const [history, setHistory] = useState<FeeHistoryRow[] | null>(null);
  const loadHistory = useCallback(() => {
    apiGet<FeeHistoryRow[]>(`/api/admin/trainers/${profileId}/fee-history`)
      .then(setHistory)
      .catch(() => setHistory(null));
  }, [profileId]);
  useEffect(() => { loadHistory(); }, [loadHistory]);
  /* ═══ وعقدٌ خرج ولم ينفذ — نصُّه لا يتغيّر بهذا الحفظ (٢٦ أكتوبر ٢٠٢٦) ═══
     التركيبُ والإعادةُ في «العقود» يكتبان القاعدةَ والعقدَ معا، وهذا يكتب القاعدةَ وحدَها. فيُقال الفرقُ قبل الحفظ،
     والخياران بأثر كلٍّ منهما — لا بابٌ يُسدّ (`outContractOf`). */
  const out = outContractOf(contracts);

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
      loadHistory();
      await onChanged();
    }, "ضبط الاتفاق الماليّ");

  return (
    <div className="grid gap-3">
      {live ? (
        <Inset as="p" tone="positive" className="px-3.5 py-2.5 text-read leading-6">
          السارية: <b>{RULE_TYPE_AR[live.type] ?? live.type}</b> ·{" "}
          <span className="tabular-nums" dir="ltr">
            {String(live.rate)} {live.type === "revenue_share" ? "%" : live.currency}
          </span>
          {live.minSeats > 0 && <> · حدّ أدنى {live.minSeats} مقعدا</>}
          {live.referralRate && (
            <> · بالإحالة <span className="tabular-nums" dir="ltr">{String(live.referralRate)}</span></>
          )}
          <span className="text-muted-foreground"> — منذ {fmtDateLong(live.effectiveFrom)}</span>
        </Inset>
      ) : (
        <p className="text-read leading-6 text-muted-foreground">
          لا قاعدة سارية. وبلا قاعدة لا ينشأ كشف مستحقّات، فتبقى «مستحقّاتي»
          عنده صفرا.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-read text-muted-foreground">
          نموذج الأجر
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
              حدّ أدنى للمقاعد المحتسبة <span className="text-muted-foreground/70">(اختياريّ)</span>
              <input
                value={minSeats} onChange={(e) => setMinSeats(e.target.value)}
                inputMode="numeric" dir="ltr" placeholder="0" className={inputCls}
              />
            </label>
            <label className="grid gap-1 text-read text-muted-foreground">
              أجر المقعد بإحالته <span className="text-muted-foreground/70">(اختياريّ)</span>
              <input
                value={referralRate} onChange={(e) => setReferralRate(e.target.value)}
                inputMode="decimal" dir="ltr" placeholder="0.00" className={inputCls}
              />
            </label>
          </>
        )}
      </div>

      {out && (
        <Inset as="p" tone="warn" className="px-3.5 py-2.5 text-read leading-6">
          عقده «{out.contract.title}» {out.phraseAr}، {out.feeAr}. الحفظ هنا يغيّر القاعدة وحدها: يبقى نصّ
          العقد بأجره، ويحسب له الأجر الجديد.
        </Inset>
      )}

      <div>
        <div className="flex flex-wrap gap-2">
          <Button
            tone="confirm" size="sm" icon={Coins} loading={busy}
            disabled={!(Number(rate) > 0)}
            onClick={() => void save()}
          >
            {out ? "غيّره هنا وحده" : live ? "استبدل القاعدة السارية" : "اضبط الاتفاق الماليّ"}
          </Button>
          {out && contractsHref && (
            <Button as={Link} to={contractsHref} tone="secondary" size="sm" icon={FileSignature}>
              غيّره مع العقد في «العقود»
            </Button>
          )}
        </div>
        {live && (
          <p className="mt-1.5 text-read leading-5 text-muted-foreground">
            القاعدة السابقة تغلق بتاريخها ولا تحذف، فيبقى ما حسب عليها واضحا.
          </p>
        )}
      </div>

      {history && history.length > 0 && (
        <div>
          <p className="text-read font-bold text-muted-foreground">سجل أجره</p>
          <ol className="mt-1.5 grid gap-1">
            {history.map((h) => (
              <li key={h.id} className="text-read leading-6 text-muted-foreground">
                <b className={h.effectiveTo ? "text-muted-foreground" : "text-foreground"}>
                  {RULE_TYPE_AR[h.type] ?? h.type}{" "}
                  <span className="tabular-nums" dir="ltr">{h.rate} {h.type === "revenue_share" ? "%" : h.currency}</span>
                </b>
                {" — "}{h.createdByName ? `ضبطه ${h.createdByName}` : "لا يعرف من ضبطه"} · {fmtDateLong(h.effectiveFrom)}
                {h.effectiveTo ? <> · أغلق {fmtDateLong(h.effectiveTo)}</> : <> · السارية</>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ═══════════ الخطوةُ الثانية — المؤهّلاتُ والدورات ═══════════ */

const PROPOSAL_STATUS_AR: Record<string, string> = {
  draft: "مسودّة عنده", submitted: "بانتظار التصنيف", info_requested: "سئل — ننتظر جوابه",
  linked: "ربطت برمز قائم", became_course: "صارت دورة", rejected: "ردّت",
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
  const [showDecided, setShowDecided] = useState(false);

  const qualified = qualifications.filter((q) => q.status === "qualified");
  /* المفتوحُ بطاقاتٌ، والمبتوتُ سطرٌ يُفتح — والعلّةُ في `proposal-fold.ts` */
  const { open, decided, decidedSummaryAr } = foldProposals(proposals);

  const close = () => {
    setLinkFor(null); setLinkCourse("");
    setEditFor(null); setEditTitle(""); setEditSummary("");
    setRejectFor(null); setRejectNote("");
  };

  /* بطاقةُ اقتراحٍ واحد — مفتوحا كان أو مبتوتا. وما صار دورةً أو رُدّ يُقرأ ولا
     يُعمل فيه من هنا؛ والمربوطُ يبقى ببابَي رجوعه (اربِطْها بغيرها · انقُضِ الربط). */
  const renderProposal = (p: PrepProposal) => (
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
                ربطت بـ «{courseTitle(p.course, p.courseId ?? "—")}»
              </p>
            )}
            {p.status === "became_course" && (
              <p className="mt-1.5 text-read font-bold text-teal-light-ink">
                صارت «{courseTitle(p.course, p.courseId ?? "—")}»
              </p>
            )}
            {p.status === "rejected" && p.decisionNoteAr && (
              <p className="mt-1.5 text-read leading-6 text-muted-foreground">
                سبب الردّ: {p.decisionNoteAr}
              </p>
            )}
          </div>
          <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-fine text-muted-foreground">
            {PROPOSAL_STATUS_AR[p.status] ?? p.status}
          </span>
        </div>

        {canClassify && p.status !== "became_course" && p.status !== "rejected" && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button
              tone="secondary" size="sm" icon={Link2}
              onClick={() => { close(); setLinkFor(p.id); setLinkCourse(p.courseId ?? ""); }}
            >
              {p.status === "linked" ? "اربطها بغيرها" : "اربطها برمز قائم"}
            </Button>
            {p.status === "linked" && (
              <Button
                tone="ghost" size="sm" icon={Link2Off} loading={busy}
                onClick={() => void run(async () => {
                  await apiPost(`/api/admin/course-proposals/${p.id}/unlink`, {});
                  await onChanged();
                }, "نقض الربط — عادت إلى الطابور")}
              >
                انقض الربط
              </Button>
            )}
            <Button
              tone="ghost" size="sm" icon={Pencil}
              onClick={() => {
                close(); setEditFor(p.id);
                setEditTitle(p.titleAr); setEditSummary(p.summaryAr ?? "");
              }}
            >
              صحّح نصّها
            </Button>
            {p.status !== "linked" && (
              <Button
                tone="danger" size="sm" icon={Trash2}
                onClick={() => { close(); setRejectFor(p.id); }}
              >
                ردّها
              </Button>
            )}
          </div>
        )}

        {linkFor === p.id && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            <label className="sr-only" htmlFor={`link-${p.id}`}>الرمز الذي تربط به</label>
            <div className="min-w-[16rem] flex-1">
              <CoursePicker
                id={`link-${p.id}`} courses={courses}
                value={linkCourse} onChange={setLinkCourse}
                labelAr="الرمز الذي تربط به"
              />
            </div>
            <Button
              tone="confirm" size="sm" loading={busy} disabled={!linkCourse}
              onClick={() => void run(async () => {
                await apiPost(`/api/admin/course-proposals/${p.id}/link`, { courseId: linkCourse });
                close();
                await onChanged();
              }, "ربط الاقتراح بالرمز")}
            >
              اربط
            </Button>
            <Button tone="ghost" size="sm" onClick={close}>تراجع</Button>
          </div>
        )}

        {editFor === p.id && (
          <div className="mt-2.5 grid gap-2">
            <input
              value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
              maxLength={200} placeholder="عنوان الدورة" className={inputCls}
            />
            <textarea
              value={editSummary} onChange={(e) => setEditSummary(e.target.value)}
              rows={2} maxLength={2000} placeholder="نبذة عنها" className={areaCls}
            />
            <p className="text-read leading-5 text-muted-foreground">
              هذه كلمات صاحبها، ويسجّل التعديل كاملا في الأثر.
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
                }, "صحّح نصّ الاقتراح")}
              >
                احفظ
              </Button>
              <Button tone="ghost" size="sm" onClick={close}>تراجع</Button>
            </div>
          </div>
        )}

        {rejectFor === p.id && (
          <div className="mt-2.5 grid gap-2">
            <textarea
              value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
              rows={2} maxLength={2000} className={areaCls}
              placeholder="سبب الرفض — يصل صاحبها، وبلا سبب يعيدها كما هي"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                tone="danger" size="sm" loading={busy} disabled={rejectNote.trim().length < 5}
                onClick={() => void run(async () => {
                  await apiPost(`/api/admin/course-proposals/${p.id}/reject`, { noteAr: rejectNote.trim() });
                  close();
                  await onChanged();
                }, "ردّ الاقتراح بسببه")}
              >
                ردّها
              </Button>
              <Button tone="ghost" size="sm" onClick={close}>تراجع</Button>
            </div>
          </div>
        )}
      </Card>
    </li>
  );

  return (
    <div className="grid gap-4">
      {/* ── ما هو مؤهَّلٌ له ── */}
      <div>
        <h5 className="text-read font-black text-foreground">الدورات المؤهّل لها — {qualified.length}</h5>
        {qualified.length === 0 ? (
          <p className="mt-1.5 text-read leading-6 text-muted-foreground">
            لا دورة بعد. دورات الكتالوج التي ذكرها في طلبه تضاف تلقائيا عند قبوله داخليّا.
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
            <label className="sr-only" htmlFor={`qualify-${profileId}`}>دورة يؤهّل لها</label>
            <select
              id={`qualify-${profileId}`} value={qualifyCourse}
              onChange={(e) => setQualifyCourse(e.target.value)}
              className={`${inputCls} min-w-[14rem] flex-1`}
            >
              <option value="">أضف دورة يؤهّل لها…</option>
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
              }, "أهّل للدورة")}
            >
              أهّله
            </Button>
          </div>
        )}
      </div>

      {/* ── دوراتٌ يقترحها هو: المفتوحُ بطاقاتٌ، والمبتوتُ سطرٌ يُفتح (`proposal-fold.ts`) ── */}
      <div className="border-t border-white/10 pt-3.5">
        <h5 className="text-read font-black text-foreground">
          دورات يقترحها — {proposals.length}
          {open.length > 0 && (
            <span className="ms-2 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-fine font-bold text-amber-300">
              {open.length} بانتظار التصنيف
            </span>
          )}
        </h5>

        {proposals.length === 0 ? (
          <p className="mt-1.5 text-read leading-6 text-muted-foreground">
            لا اقتراح منه خارج الكتالوج.
          </p>
        ) : (
          <>
            {open.length > 0 ? (
              <ul className="mt-2.5 grid gap-2.5">{open.map(renderProposal)}</ul>
            ) : (
              <p className="mt-1.5 text-read leading-6 text-muted-foreground">
                لا اقتراح ينتظر قرارا — قرّرت فيها كلّها.
              </p>
            )}

            {decided.length > 0 && (
              <div className="mt-2.5">
                <Button
                  tone="ghost" size="sm" icon={showDecided ? ChevronUp : ChevronDown}
                  onClick={() => setShowDecided(!showDecided)} aria-expanded={showDecided}
                >
                  ما قرّرت فيه — {decidedSummaryAr}
                </Button>
                {showDecided && <ul className="mt-2.5 grid gap-2.5">{decided.map(renderProposal)}</ul>}
              </div>
            )}
          </>
        )}

        <p className="mt-2.5 text-read leading-5 text-muted-foreground">
          و«الدورة الجديدة» تنشأ في شاشة الكتالوج بكامل بياناتها (المهارات والساعات)،
          ثمّ تربط من طابور الاقتراحات. ولا تنشأ من هنا حتّى لا ينسب إليه ما لم يكتبه.
        </p>
      </div>
    </div>
  );
}

/* ═══════════ الخطوةُ الثالثة — العقد ═══════════

   ─────────── ومُركِّبٌ واحدٌ لا اثنان (المرحلةُ الرابعة، ٢٦ أكتوبر ٢٠٢٦) ───────────

   كان هنا مُركِّبٌ ثانٍ أنحفُ من مُركِّب «العقود»: عنوانٌ ووثائقُ وسببُ الإرسال بلا أجر، ثمّ «جهّز وأرسل» بنقرة —
   بلا معاينةٍ قبل التركيب ولا شروطٍ خاصّةٍ ولا اسمٍ قانونيٍّ يُصحَّح. فعقدٌ واحدٌ له بابان يفترقان فيما يُكتب فيه. والمقترحُ
   المعتمَد (3c): «يذهب المُركِّبُ الثاني». فـ«جهّز العقد» يفتح مُركِّبَ «العقود» لهذا المدرّب بعينه (`prepare`)، ويبقى
   هنا ما يُقرأ في سياقه: قصّةُ كلِّ عقدٍ بتواريخها (`contractStoryOf`)، وطلبُ التعديل وجوابُه تحتها (`amendmentLinesOf`)،
   ونصُّه — ومعها اعتمادُ التوقيع وتجديدُ الرابط كما كانا. */

const CONTRACT_STATUS_AR: Record<string, string> = {
  draft: "مسودّة", sent: "أرسل — بانتظار توقيعه", declined: "اعتذر عنه",
  revoked: "ألغي", signed: "وقّعه — بانتظار اعتمادنا",
  amendment_requested: "طلب تعديله — ينتظر جوابنا",
  /* اعتمدنا توقيعَه ولم نوقّعه — نوقّعه باعتماد دوراته (١ أكتوبر ٢٠٢٦) */
  signature_approved: "اعتمدنا توقيعه — نوقّعه باعتماد دوراته",
  countersigned: "نافذ — وقّعناه",
  expired: "انقضى", terminated: "فسخ", superseded: "حلّ محلّه أحدث",
};

/** ما مضى من عقوده — يُقرأ طلبُ تعديله في خلَفه ولا يُعرض صفّا */
const PAST_STATUSES = new Set(["revoked", "superseded"]);

function ContractStep({
  contracts, canManage, busy, run, onChanged, composeHref,
}: {
  contracts: PrepContract[]; canManage: boolean;
  busy: boolean; run: (work: () => Promise<unknown>, okAr: string) => Promise<void>;
  onChanged: () => void | Promise<void>;
  /** مُركِّبُ «العقود» لهذا المدرّب — المُركِّبُ الواحد */
  composeHref?: string;
}) {
  const [signOff, setSignOff] = useState<string | null>(null);
  const [signOffNote, setSignOffNote] = useState("");
  const [shown, setShown] = useState<{ title: string; body: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const live = contracts.filter((c) => !PAST_STATUSES.has(c.status));
  const awaitingCountersign = live.find((c) => c.status === "signed") ?? null;
  const sent = live.find((c) => c.status === "sent") ?? null;

  /* النصُّ من مسار «العقود» نفسِه (`/body`) — ويُرسم بالمكوِّن الذي ترسمه به «العقود» والمدرّبُ، فلا تفترق الورقة.
     وقراءةٌ لا فعل: فلا خبرَ «تمّ» يقفز بعدها، ويُقال الخطأُ وحدَه. */
  const openText = async (c: PrepContract) => {
    setOpening(c.id);
    try {
      const full = await apiGet<{ bodyAr: string | null }>(`/api/admin/trainer-contracts/${c.id}/body`);
      setShown({ title: c.title, body: full.bodyAr ?? "" });
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر فتح نصّ العقد");
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="grid gap-3">
      {live.length === 0 ? (
        <p className="text-read leading-6 text-muted-foreground">
          لا عقد بعد. يجهّز العقد مرّة ويثبّت نصّه، ثمّ يرسل إليه رابط للتوقيع.
        </p>
      ) : (
        <ul className="grid gap-2">
          {live.map((c) => {
            const story = contractStoryOf(c);
            const amendments = amendmentLinesOf(c, contracts);
            return (
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
                  {story.length > 0 && (
                    <p className="mt-1.5 text-read leading-6 text-muted-foreground">
                      {story.map((e, i) => (
                        <span key={e.key}>
                          {i > 0 && " · "}{e.ar} <span className="text-foreground">{fmtDayMonth(e.at)}</span>
                        </span>
                      ))}
                    </p>
                  )}
                  {c.signerLegalName && (
                    <p className="mt-1.5 text-read leading-6 text-muted-foreground">
                      وقّعه باسم <b className="text-foreground">{c.signerLegalName}</b>
                    </p>
                  )}
                  {amendments.map((m) => (
                    <Inset
                      key={m.previous ? "previous" : "own"} as="div" tone={m.pending ? "warn" : "default"}
                      className="mt-2 px-3.5 py-2.5 text-read leading-6"
                    >
                      <p className="whitespace-pre-wrap">
                        {m.previous ? "طلب تعديل سابق" : "طلب تعديله"}
                        {m.requestedAt && <> {fmtDayMonth(m.requestedAt)}</>}: «{m.requestAr}»
                      </p>
                      {m.replyAr ? (
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                          جوابنا{m.repliedAt && <> {fmtDayMonth(m.repliedAt)}</>}: {m.replyAr}
                        </p>
                      ) : m.pending && (
                        <p className="mt-1 text-muted-foreground">ينتظر جوابنا — يكتب في «العقود».</p>
                      )}
                    </Inset>
                  ))}
                  {c.declineReasonAr && (
                    <p className="mt-1.5 text-read leading-6 text-gold-ink">
                      اعتذر: {c.declineReasonAr}
                      {c.declineReplyAr && <span className="text-muted-foreground"> — ردّنا: {c.declineReplyAr}</span>}
                    </p>
                  )}
                  {canManage && c.bodyHash && (
                    <div className="mt-2.5">
                      <Button tone="ghost" size="sm" icon={FileText} loading={opening === c.id} onClick={() => void openText(c)}>
                        افتح النصّ
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
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
                  placeholder="ما طابقته بالوثيقة — أو تفويضك الخطّيّ إن لم تكن المفوّض في السجلّ"
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
                    }, awaitingCountersign.gatesActivation === false
                      ? "وقّعنا العقد عن الأكاديميّة فنفذ — وتمّت الخطوة الثالثة"
                      /* والعرضُ المشروطُ لا ينفذ باعتماد توقيعه (١ أكتوبر ٢٠٢٦): كان
                         هنا «نفَذ العقدُ» للبابَين */
                      : "اعتمد توقيعه وفتحت بوّابته — ونوقّع الاتفاقيّة حين تعتمد دوراته")}
                  >
                    {awaitingCountersign.gatesActivation === false ? "اعتمد ووقّع عن الأكاديميّة" : "اعتمد التوقيع"}
                  </Button>
                  <Button tone="ghost" size="sm" onClick={() => setSignOff(null)}>تراجع</Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  tone="confirm" size="sm" icon={BadgeCheck}
                  onClick={() => setSignOff(awaitingCountersign.id)}
                >
                  طابقت الاسم بالهويّة — اعتمد توقيعه
                </Button>
                {/* وكان يقول «هذا لا يفتح حسابه: القبول النهائيّ قرارك، أسفل هذه الخطوات» — ونقيضُه منذ ٢١ أكتوبر
                    ٢٠٢٦: اعتمادُ التوقيع يفتح بوّابتَه ويعبر به إلى «المدربون» (`approveSignature`)، كما يقول خبرُ الزرّ نفسِه. */}
                <p className="mt-1.5 text-read leading-5 text-muted-foreground">
                  {awaitingCountersign.gatesActivation === false
                    ? "اعتماده توقيع منّا عن الأكاديميّة، فينفذ العقد الآن."
                    : "اعتماده يفتح بوّابته ويعبر به إلى «المدربون». ونوقّع الاتفاقيّة حين نعتمد دوراته."}
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
                }, "جدّد الرابط وأرسل — والقديم لم يعد يعمل")}
              >
                جدّد الرابط وأعد الإرسال
              </Button>
            </div>
          )}

          {/* ── والتركيبُ في المُركِّب الواحد ── */}
          {composeHref && (
            <div>
              <Button
                as={Link} to={composeHref}
                tone={live.length === 0 ? "confirm" : "ghost"} size="sm" icon={FileSignature}
              >
                {live.length === 0 ? "جهّز العقد في «العقود»" : "جهّز عقدا جديدا في «العقود»"}
              </Button>
            </div>
          )}
        </>
      )}

      {shown && (
        <Modal onClose={() => setShown(null)} label={shown.title} panelClassName="w-full max-w-3xl">
          <Inset dir="rtl" tone="solid" className="max-h-[86vh] overflow-y-auto text-foreground sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-black">{shown.title}</h2>
              <Button tone="ghost" size="sm" onClick={() => setShown(null)}>أغلق</Button>
            </div>
            <ContractDocument doc={parseContractDoc(shown.body)} />
          </Inset>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════ الشاشةُ نفسُها ═══════════ */

export default function PreparationSteps({
  profileId, readiness, activeRule, proposals, contracts,
  qualifications, permissions, onChanged, contractsHref, composeHref,
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
        <h4 className="text-sm font-black text-foreground">لم يبدأ تجهيزه بعد</h4>
        <p className="mt-2 text-read leading-7 text-muted-foreground">
          التجهيز يبدأ بـ<b className="text-foreground">«اقبله داخليّا»</b> في شريط القرار أعلاه:
          يفتح له ملفّ مدرّب وتضاف مؤهّلاته ممّا ذكره في طلبه، ثمّ تضبط أتعابه
          وتصنّف دوراته وتجهّز عقده — <b className="text-foreground">ولا يصله خبر قبول بعد</b>.
          والقبول النهائيّ بعد إكمال الخطوات الثلاث.
        </p>
      </Panel>
    );
  }

  return (
    <div className="grid gap-3">
      <Panel as="section" tone="accent">
        <h4 className="flex items-center gap-2 text-sm font-black text-foreground">
          <CircleDashed className="h-4 w-4" aria-hidden="true" /> تجهيزه قبل القبول الكامل
        </h4>
        {/* وكان يقول «وحين تتمّ يفتح زرّ «اعتمده نهائيّا» في شريط القرار» — وذاك بابُ تجاوز منذ ٢١ أكتوبر ٢٠٢٦:
            اعتمادُ توقيعه يفعّله (`approveSignature`) */}
        <p className="mt-2 text-read leading-7 text-muted-foreground">
          ثلاث خطوات تنجزها من هنا: الأجر، ثمّ دوراته، ثمّ عقده. وحين يوقّع
          وتعتمد توقيعه <b className="text-foreground">يعبر إلى «المدربون»</b> ويصله خبر اعتماده وتفتح بوّابته.
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
        locked={!can("trainer.compensation.manage") && !can("trainer.contract.manage")}
      >
        <FeeStep
          profileId={profileId} live={activeRule} contracts={contracts} onChanged={onChanged} busy={busy} run={run}
          contractsHref={can("trainer.contract.manage") ? contractsHref : undefined}
        />
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
          contracts={contracts} composeHref={composeHref}
          canManage={can("trainer.contract.manage")} busy={busy} run={run} onChanged={onChanged}
        />
      </Step>
    </div>
  );
}
