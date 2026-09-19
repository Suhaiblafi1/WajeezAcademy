/* قسمُ العقود — يُركَّب العقدُ هنا ويُعايَن قبل أن يراه أحد.

   ── ولمَ شاشةٌ لا لسانٌ في ملفّ المتقدّم ──

   كان العقدُ طيّةً مطويّةً داخل لوح المتقدّم: تُفتح، فيُكتب فيها عنوانٌ،
   فيُنشأ صفّ. وثمنُ ذلك أنّ **من ينتظر عقدا لا يظهر في أيّ موضع**: من قُبل
   قبولا مشروطا منذ أسبوعين ولم يُرسَل له شيءٌ لا يعرف به أحدٌ حتّى يسأل هو.
   فالشاشةُ هنا تُري ما صُنع **ومن ينتظر**، وهما نصفان لا نصفٌ واحد.

   ── والمعاينةُ قبل التركيب، لا بعده ──

   المتنُ يُجمَّد عند التركيب ولا يُعدَّل بعده. فلو لم تُعايَن الوثيقةُ قبلَه
   لكان أوّلُ قارئٍ لها هو المدرّب. والمعاينةُ تعمل ولو نقصت هويّةُ الأكاديميّة
   — فيرى الموظّفُ مواضعَ النقص في سياقها قبل أن يُطلب منه سدُّها.

   ── والأجرُ يُقرأ ولا يُكتب ──

   `trainer.contract.manage` يركّب ويرسل، و`trainer.compensation.manage` تضبط
   الرقم. فما يظهر هنا من أتعابٍ مقروءٌ لا محرَّر: من يتعاقد يرى ما سيُوقَّع
   عليه، ولا يملك تغييرَه من شاشته. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Ban, FileSignature, FileText, Handshake, IdCard, RefreshCw, Send, X } from "lucide-react";
import { apiGet, apiPost, permissionMessage } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";
import { RULE_TYPE_AR } from "@/application/trainer/compensation-labels";
import {
  CONTRACT_DOCUMENT_KINDS, DEFAULT_REQUIRED_DOCUMENTS, type RequiredDocument,
} from "@/application/trainer/contract-documents";
import {
  ASSIGNMENT_OFFER_RESPONSE_DAYS, COURSE_PREP_DEFAULT_DAYS, COURSE_PREP_MIN_DAYS,
} from "@/application/trainer/notice-periods";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffControlCls as inputCls, staffAreaCls as areaCls } from "@/components/FormKit";
import ListToolbar from "@/components/admin/ListToolbar";
import { paginate } from "@/application/admin/paginate";
import { matchesQuery } from "@/application/text/search-ar";
import AdminLayout from "./AdminLayout";

const STATUS_AR: Record<string, string> = {
  draft: "مسودّة مجمَّدة", sent: "أُرسل — بانتظار التوقيع", revoked: "ملغًى",
  signed: "وقّعه صاحبُه — ينتظر اعتمادك", expired: "منتهٍ", terminated: "مفسوخ",
  declined: "اعتُذر عنه", countersigned: "نافذٌ — اعتمدته الأكاديميّة",
};

const OFFER_STATUS_AR: Record<string, string> = {
  offered: "ينتظر جوابَه", accepted: "قبِله", declined: "اعتذر عنه",
  lapsed: "انقضت مهلتُه", withdrawn: "سُحب",
};

interface CandidateRow { id: string; reference: string; fullName: string; email: string; status: string }

interface ContractRow {
  id: string; title: string; status: string; kind: string; revision: number;
  bodyVersion: string | null; bodyHash: string | null; signerEmail: string | null;
  compensationType: string | null; compensationRate: string | null; currency: string;
  gatesActivation: boolean; sentAt: string | null; signedAt: string | null;
  revokedAt: string | null; revokeReasonAr: string | null; createdAt: string;
  signerLegalName: string | null; declinedAt: string | null; declineReasonAr: string | null;
  countersignedAt: string | null; academySignatoryName: string | null;
  academySignatoryTitle: string | null; countersignNoteAr: string | null;
  documents: { id: string; kind: string; originalName: string; mime: string; uploadedAt: string }[];
  qualifiedSnapshot: { courseId: string; titleAr: string }[] | null;
  profile: { id: string; application: { id: string; reference: string; fullName: string; email: string; status: string } | null } | null;
}

interface Prefill {
  applicationId: string; reference: string; fullName: string; email: string;
  applicationStatus: string; gatesActivation: boolean;
  courses: { courseId: string; titleAr: string }[];
  compensation: { ruleId: string; type: string; rate: string; currency: string; minSeats: number | null; referralRate: string | null } | null;
  feeNotes: { reviewerName: string | null; expectation: string | null; proposal: string | null }[];
  missingLegal: string[];
}

interface OfferRow {
  id: string; status: string; courseId: string; courseTitleAr: string;
  cohortId: string | null; cohort: { id: string; title: string; startsAt: string | null } | null;
  sessionsCount: number | null; startsAt: string | null; feeNoteAr: string | null; noteAr: string | null;
  expiresAt: string; offeredAt: string; respondedAt: string | null;
  declineReasonAr: string | null; withdrawReasonAr: string | null;
  prepDays: number; prepDueAt: string | null; prepConfirmedAt: string | null; prepLapsedAt: string | null;
  profile: { id: string; application: { id: string; fullName: string; email: string } | null } | null;
}

interface OfferOptionCohort {
  id: string; title: string; startsAt: string | null; status: string; hasLead: boolean; mine: boolean;
}
interface OfferOptionCourse {
  courseId: string; titleAr: string; alreadyOpen: boolean; alreadyAccepted: boolean;
  cohorts: OfferOptionCohort[];
}
interface OfferOption {
  profileId: string; fullName: string; email: string; reference: string;
  contract: { id: string; title: string; countersignedAt: string | null } | null;
  courses: OfferOptionCourse[];
}

export default function TrainerContracts() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [missingLegal, setMissingLegal] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [openFor, setOpenFor] = useState<CandidateRow | null>(null);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [docs, setDocs] = useState<RequiredDocument[]>(DEFAULT_REQUIRED_DOCUMENTS);
  const [hoursNoteAr, setHoursNoteAr] = useState("");
  const [waivedAr, setWaivedAr] = useState("");
  const [preview, setPreview] = useState("");
  const [shownBody, setShownBody] = useState<{ title: string; body: string } | null>(null);
  /* الرابطُ يُعرض للموظّف بعد الإرسال — كما في الدعوة الآمنة: قناةُ البريد
     قد تتعثّر، ومن يملك الصلاحيّةَ يحتاج نسخةً يسلّمها بيده. ولا يُخزَّن
     الرمزُ في القاعدة، فهذه فرصتُه الوحيدة. */
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  /* ═══ الاعتمادُ ملحوظتُه معه ═══

     الاعتمادُ مطابقةُ اسمٍ بوثيقة، والملحوظةُ محلُّ ما طابقه المعتمِد — أو
     تفويضِه الخطّيِّ إن لم يكن هو المفوَّضَ في السجلّ. فحقلٌ إلى جانب الزرّ
     لا `window.prompt`: نصٌّ يُقرأ بعد سنةٍ لا يُكتب في صندوقٍ بسطر. */
  const [signOff, setSignOff] = useState<{ id: string; noteAr: string } | null>(null);

  /* ═══ العروضُ في هذه الشاشة لا في شاشةٍ ثالثة ═══

     العرضُ فرعٌ عن عقدٍ نافذ: من يتابع العقودَ يتابع ما بُني عليها، ومن
     فصلهما شاشتين فتح إحداهما ونسي الأخرى. */
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [offerOptions, setOfferOptions] = useState<OfferOption[]>([]);
  const [offerFor, setOfferFor] = useState<OfferOption | null>(null);
  const [offerCourseId, setOfferCourseId] = useState("");
  const [offerCohortId, setOfferCohortId] = useState("");
  const [offerFeeAr, setOfferFeeAr] = useState("");
  const [offerNoteAr, setOfferNoteAr] = useState("");
  const [offerSessions, setOfferSessions] = useState("");
  const [offerPrepDays, setOfferPrepDays] = useState(String(COURSE_PREP_DEFAULT_DAYS));
  const [offerResponseDays, setOfferResponseDays] = useState(String(ASSIGNMENT_OFFER_RESPONSE_DAYS));

  /* ═══ والقائمتان تُبحثان وتُرقَّمان ═══

     كلتاهما تجمع الناسَ كلَّهم لا واحدا بعينه، فتنمو بنموّ العمل: من أراد
     عقدَ فلانٍ بعد عامٍ مرّره بعينه. والبحثُ بـ`matchesQuery` لا بمطابقةٍ
     حرفيّة — فهي تطبّع الهمزةَ والتاءَ المربوطة، والاسمُ يُكتب بوجهين. */
  const [contractQ, setContractQ] = useState("");
  const [contractPage, setContractPage] = useState(1);
  const [offerQ, setOfferQ] = useState("");
  const [offerPage, setOfferPage] = useState(1);

  const contractView = useMemo(() => paginate(
    contracts.filter((c) => matchesQuery(contractQ, [
      c.title, c.profile?.application?.fullName, c.profile?.application?.email,
      c.profile?.application?.reference, c.signerLegalName, STATUS_AR[c.status] ?? c.status,
    ])),
    contractPage, 10,
  ), [contracts, contractQ, contractPage]);

  const offerView = useMemo(() => paginate(
    offers.filter((o) => matchesQuery(offerQ, [
      o.courseTitleAr, o.cohort?.title, o.profile?.application?.fullName,
      o.profile?.application?.email, OFFER_STATUS_AR[o.status] ?? o.status,
    ])),
    offerPage, 10,
  ), [offers, offerQ, offerPage]);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ contracts: ContractRow[]; candidates: CandidateRow[]; missingLegal: string[] }>(
        "/api/admin/trainer-contracts",
      );
      setContracts(d.contracts); setCandidates(d.candidates); setMissingLegal(d.missingLegal);
    } catch (e) { setErr(permissionMessage(e, "تعذّر تحميل العقود")); }
    /* والعروضُ خلف صلاحيّةٍ أخرى (`trainer.assign`): من يملك العقودَ ولا
       يملكها يرى شاشتَه كاملةً بلا قسمِ العروض، لا نصفَ شاشةٍ بخطإٍ أحمر. */
    try {
      const [o, opts] = await Promise.all([
        apiGet<OfferRow[]>("/api/admin/trainer-offers"),
        apiGet<OfferOption[]>("/api/admin/trainer-offers/options"),
      ]);
      setOffers(o); setOfferOptions(opts);
    } catch { setOffers([]); setOfferOptions([]); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openComposer = async (c: CandidateRow) => {
    setErr(""); setNote(""); setPreview("");
    try {
      const p = await apiGet<Prefill>(`/api/admin/trainer-applications/${c.id}/contract-prefill`);
      setPrefill(p); setOpenFor(c);
      setTitle(`اتفاقية تقديم خدمات تدريبية — ${c.fullName}`);
      setPicked(new Set(p.courses.map((x) => x.courseId)));
      setDocs(DEFAULT_REQUIRED_DOCUMENTS);
      setHoursNoteAr(""); setWaivedAr("");
    } catch (e) { setErr(permissionMessage(e, "تعذّر تجهيز الشاشة")); }
  };

  const composeBody = useMemo(() => ({
    title,
    courseIds: [...picked],
    requiredDocuments: docs,
    hoursNoteAr: hoursNoteAr.trim() || null,
    rateWaivedReasonAr: waivedAr.trim() || null,
  }), [title, picked, docs, hoursNoteAr, waivedAr]);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true); setErr(""); setNote("");
    try { await fn(); setNote(ok); } catch (e) { setErr(permissionMessage(e, "تعذّر الإجراء")); }
    finally { setBusy(false); }
  };

  const toggleDoc = (kind: string, labelAr: string) => {
    setDocs((cur) => cur.some((d) => d.kind === kind)
      ? cur.filter((d) => d.kind !== kind)
      : [...cur, { kind, labelAr, required: true }]);
  };

  return (
    <AdminLayout title="عقودُ المدرّبين">
      {missingLegal.length > 0 && (
        <Panel tone="warn" className="mb-5 p-4">
          <h2 className="mb-1 font-bold">هويّةُ الأكاديميّة القانونيّة غيرُ مكتملة</h2>
          <p className="text-sm">
            لا يُركَّب عقدٌ بطرفٍ أوّلَ ناقص. الناقص: <b>{missingLegal.join(" · ")}</b>.
            {" "}يُستكمَل في <code>src/data/academy-legal.ts</code>. والمعاينةُ تعمل قبل ذلك.
          </p>
        </Panel>
      )}

      {err && <Panel tone="danger" className="mb-4 p-3 text-sm" role="alert">{err}</Panel>}
      {note && <Panel tone="positive" className="mb-4 p-3 text-sm" role="status">{note}</Panel>}

      {/* ═══ من ينتظر عقدا ═══ */}
      <Card className="mb-6 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black">
          <FileSignature size={18} aria-hidden="true" /> من ينتظر عقدا ({candidates.length})
        </h2>
        {candidates.length === 0
          ? <p className="text-sm opacity-70">لا أحد — كلُّ من قُبل له عقدٌ قائم.</p>
          : (
            <ul className="space-y-2">
              {candidates.map((c) => (
                <li key={c.id}>
                  <Inset className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <span>
                      <b>{c.fullName}</b>
                      <span className="opacity-70"> — {c.reference} · {c.email}</span>
                    </span>
                    <Button size="sm" tone="primary" onClick={() => void openComposer(c)}>
                      ركّبْ عقدا
                    </Button>
                  </Inset>
                </li>
              ))}
            </ul>
          )}
      </Card>

      {/* ═══ شاشةُ التركيب ═══ */}
      {openFor && prefill && (
        <Card className="mb-6 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black">تركيبُ عقدٍ لـ{prefill.fullName}</h2>
            <Button size="sm" onClick={() => { setOpenFor(null); setPrefill(null); setPreview(""); }}>
              أغلِقْ
            </Button>
          </div>

          <Panel tone={prefill.gatesActivation ? "default" : "warn"} className="mb-4 p-3 text-sm">
            {prefill.gatesActivation
              ? "هذا العقدُ يحبس التفعيل: يُنقل الطلبُ إلى «عقد قيد التوقيع»، ولا يُفتح حسابُه حتّى يُعتمَد توقيعُه."
              : "المدرّبُ نشطٌ أصلا — فهذا العقدُ توثيقٌ على ملفٍّ حيّ، ولا تُمسُّ حالةُ طلبه ولا وصولُه إلى بوّابته."}
          </Panel>

          <label className="mb-1 block text-sm font-bold" htmlFor="contract-title">عنوانُ العقد</label>
          <input id="contract-title" value={title} onChange={(e) => setTitle(e.target.value)}
            className={`${inputCls} mb-4 w-full`} />

          {/* الأجر — مقروءٌ لا محرَّر */}
          <h3 className="mb-1 text-sm font-bold">الأتعاب (الملحق ب)</h3>
          {prefill.compensation ? (
            <Inset className="mb-4 p-3 text-sm">
              {RULE_TYPE_AR[prefill.compensation.type] ?? prefill.compensation.type}
              {" — "}<b>{prefill.compensation.rate} {prefill.compensation.currency}</b>
              {prefill.compensation.minSeats ? ` · حدٌّ أدنى ${prefill.compensation.minSeats} مقعدا` : ""}
              {prefill.compensation.referralRate ? ` · مقعدُ الإحالة ${prefill.compensation.referralRate}` : ""}
              <span className="block opacity-70">تُضبط من «أتعاب المدربين» — وتُقرأ هنا ولا تُحرَّر.</span>
            </Inset>
          ) : (
            <Panel tone="warn" className="mb-4 p-3 text-sm">
              <p className="mb-2">لا قاعدةَ أتعابٍ لهذا المدرّب. تضبطها الماليّةُ من «أتعاب المدربين»، أو يُكتب سببُ الإرسال بلا أجرٍ متّفقٍ عليه:</p>
              <label className="sr-only" htmlFor="waived">سببُ الإرسال بلا أجر</label>
              <input id="waived" value={waivedAr} onChange={(e) => setWaivedAr(e.target.value)}
                placeholder="يُحدَّد قبل أوّل إسناد باتفاقٍ مكتوب" className={`${inputCls} w-full`} />
            </Panel>
          )}

          {prefill.feeNotes.length > 0 && (
            <Inset className="mb-4 p-3 text-sm">
              <b>ما قيل في المقابلة عن الأجر</b> — استئناسا، ولا يُحتسب منه شيء:
              <ul className="mt-1 list-inside list-disc opacity-80">
                {prefill.feeNotes.map((f, i) => (
                  <li key={i}>{f.reviewerName ?? "قارئ"}: {f.expectation ?? "—"} / {f.proposal ?? "—"}</li>
                ))}
              </ul>
            </Inset>
          )}

          {/* الدورات — الملحق أ */}
          <h3 className="mb-1 text-sm font-bold">الدوراتُ المؤهَّل لها (الملحق أ)</h3>
          {prefill.courses.length === 0 ? (
            <Panel tone="warn" className="mb-4 p-3 text-sm">
              لا دورةَ مؤهَّلٌ لها بعد. يُؤهَّل من «طلبات المدربين» أوّلا، وإلّا خرج الملحقُ (أ) خاليا —
              والبندُ الثاني هو صلبُ هذا العقد.
            </Panel>
          ) : (
            <Inset className="mb-4 p-3">
              <ul className="space-y-1 text-sm">
                {prefill.courses.map((c) => (
                  <li key={c.courseId}>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={picked.has(c.courseId)}
                        onChange={() => setPicked((s) => {
                          const n = new Set(s);
                          if (n.has(c.courseId)) n.delete(c.courseId); else n.add(c.courseId);
                          return n;
                        })} />
                      <span>{c.titleAr}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-read opacity-70">
                إدراجُ الدورة تأهيلٌ لا إسناد — والبندُ 2-3 يقول ذلك صراحةً للمدرّب.
              </p>
            </Inset>
          )}

          {/* الوثائق — الملحق ج */}
          <h3 className="mb-1 text-sm font-bold">الوثائقُ المطلوبةُ منه (الملحق ج)</h3>
          <Inset className="mb-4 p-3">
            <ul className="space-y-1 text-sm">
              {CONTRACT_DOCUMENT_KINDS.map((k) => (
                <li key={k.key}>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={docs.some((d) => d.kind === k.key)}
                      onChange={() => toggleDoc(k.key, k.labelAr)} />
                    <span>
                      {k.labelAr}
                      <span className="block text-xs opacity-60">{k.hintAr}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-read opacity-70">
              وثيقةُ هويّةٍ واحدةٌ على الأقلّ — البند 15 يُقرّ باسمه القانونيّ، ولا إقرارَ بلا ما يقابله.
            </p>
          </Inset>

          <label className="mb-1 block text-sm font-bold" htmlFor="hours-note">
            حجمُ العمل المتوقَّع — استرشاديٌّ لا يُحتسب (اختياريّ)
          </label>
          <textarea id="hours-note" value={hoursNoteAr} onChange={(e) => setHoursNoteAr(e.target.value)}
            rows={2} className={`${areaCls} mb-4 w-full`}
            placeholder="مثلا: نحو 20 ساعة تدريبيّة في الفصل، بحسب ما يُسنَد" />

          <div className="flex flex-wrap gap-2">
            <Button tone="secondary" icon={FileText} loading={busy}
              onClick={() => void run(async () => {
                const r = await apiPost<{ bodyAr: string }>(
                  `/api/admin/trainer-applications/${prefill.applicationId}/contract-preview`, composeBody);
                setPreview(r.bodyAr);
              }, "عُرضت المعاينة")}>
              عايِنِ المتنَ كما يراه
            </Button>
            <Button tone="confirm" icon={FileSignature} loading={busy}
              disabled={title.trim().length < 3}
              onClick={() => void run(async () => {
                await apiPost(`/api/admin/trainer-applications/${prefill.applicationId}/contracts/compose`, composeBody);
                setOpenFor(null); setPrefill(null); setPreview("");
                await load();
              }, "رُكّب العقدُ وجُمّد متنُه")}>
              ركّبْ وجمّدِ المتن
            </Button>
          </div>

          {preview && (
            <section className="mt-4">
              <h3 className="mb-2 text-sm font-bold">المعاينة</h3>
              <pre dir="rtl" className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg bg-black/20 p-4 text-sm leading-7">
                {preview}
              </pre>
            </section>
          )}
        </Card>
      )}

      {/* ═══ العقودُ المركَّبة ═══ */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">العقود ({contracts.length})</h2>
          <Button size="sm" icon={RefreshCw} onClick={() => void load()}>حدِّثْ</Button>
        </div>
        {contracts.length > 0 && (
          <ListToolbar q={contractQ} onQ={setContractQ} onPage={setContractPage}
            view={contractView} unit="عقدا"
            placeholder="ابحث باسم المدرّب أو بريده أو مرجعه أو حالة عقده…" />
        )}
        {contracts.length === 0
          ? <p className="text-sm opacity-70">لا عقودَ بعد.</p>
          : contractView.rows.length === 0
            ? <p className="text-sm opacity-70">لا عقدَ يطابق بحثَك.</p>
            : (
            <ul className="space-y-2">
              {contractView.rows.map((c) => (
                <li key={c.id}>
                  <Inset className="p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <b>{c.profile?.application?.fullName ?? "—"}</b>
                        <span className="opacity-70">
                          {" "}— {STATUS_AR[c.status] ?? c.status}
                          {c.bodyVersion ? ` · صياغة ${c.bodyVersion}` : " · بلا متن (البابُ القديم)"}
                          {" · "}{fmtDateTime(c.createdAt)}
                        </span>
                      </span>
                      <span className="flex flex-wrap gap-2">
                        {c.status === "draft" && c.bodyHash && (
                          <Button size="sm" tone="confirm" icon={Send}
                            onClick={() => void run(async () => {
                              const r = await apiPost<{ signingUrl: string }>(
                                `/api/admin/trainer-contracts/${c.id}/send`, {});
                              setLink({ id: c.id, url: r.signingUrl });
                              await load();
                            }, "أُرسل العقدُ — والرابطُ أدناه")}>
                            أرسِلْه للتوقيع
                          </Button>
                        )}
                        {c.status === "sent" && (
                          <Button size="sm" icon={RefreshCw}
                            onClick={() => void run(async () => {
                              const r = await apiPost<{ signingUrl: string }>(
                                `/api/admin/trainer-contracts/${c.id}/resend`, {});
                              setLink({ id: c.id, url: r.signingUrl });
                              await load();
                            }, "جُدِّد الرابطُ — والقديمُ بطل")}>
                            جدِّدِ الرابط
                          </Button>
                        )}
                        {c.bodyHash && (
                          <Button size="sm" icon={FileText}
                            onClick={() => void run(async () => {
                              const full = await apiGet<{ bodyAr: string | null }>(`/api/admin/trainer-contracts/${c.id}/body`);
                              setShownBody({ title: c.title, body: full.bodyAr ?? "" });
                            }, "عُرض المتن")}>
                            المتن
                          </Button>
                        )}
                        {(c.status === "draft" || c.status === "sent") && (
                          <Button size="sm" tone="danger" icon={Ban}
                            onClick={() => void run(async () => {
                              const reasonAr = window.prompt("سببُ الإلغاء — يُقرأ بعد شهرٍ حين يُسأل عنه:");
                              if (!reasonAr) return;
                              await apiPost(`/api/admin/trainer-contracts/${c.id}/revoke`, { reasonAr });
                              await load();
                            }, "أُلغي العقد")}>
                            ألغِ
                          </Button>
                        )}
                      </span>
                    </div>
                    {link?.id === c.id && (
                      <Panel tone="positive" className="mt-2 p-2">
                        <p className="mb-1 text-read">رابطُ التوقيع — انسخْه الآن، فلا يُعرض ثانية:</p>
                        <code className="block break-all">{link.url}</code>
                      </Panel>
                    )}
                    {c.revokeReasonAr && (
                      <p className="mt-1 text-read opacity-70">سببُ الإلغاء: {c.revokeReasonAr}</p>
                    )}
                    {c.declineReasonAr && (
                      <p className="mt-1 text-read opacity-70">سببُ الاعتذار: {c.declineReasonAr}</p>
                    )}

                    {/* ═══ وقّعه صاحبُه — والاعتمادُ مطابقةُ اسمٍ بوثيقة ═══

                        فالوثائقُ تُفتح هنا قبل الزرّ، لا يُضغط الزرُّ على ثقة.
                        ورابطُ كلٍّ منها موقَّتٌ لعشر دقائق، وكلُّ فتحةٍ تُكتب
                        في الأثر باسم من فتح. */}
                    {c.status === "signed" && (
                      <Panel tone="warn" className="mt-3 p-3">
                        <p className="text-read leading-7">
                          وقّع باسم <b>{c.signerLegalName ?? "—"}</b>
                          {c.signedAt ? ` بتاريخ ${fmtDateTime(c.signedAt)}` : ""}. طابِقِ الاسمَ
                          بوثيقة هويّته قبل الاعتماد — فبالاعتماد ينفذ العقدُ
                          {c.gatesActivation ? " ويُفتح حسابُه" : ", ولا تُمسّ حالتُه فهو نشطٌ أصلا"}.
                        </p>
                        {c.documents.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {c.documents.map((d) => (
                              <Button key={d.id} size="sm" icon={IdCard}
                                onClick={() => void run(async () => {
                                  const r = await apiGet<{ url: string }>(
                                    `/api/admin/trainer-contracts/${c.id}/documents/${d.id}/url`);
                                  window.open(r.url, "_blank", "noopener,noreferrer");
                                }, "فُتحت الوثيقة — والفتحةُ مكتوبةٌ في الأثر")}>
                                {CONTRACT_DOCUMENT_KINDS.find((k) => k.key === d.kind)?.labelAr ?? d.kind}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-read opacity-70">لا وثيقةَ مرفوعةٌ مع هذا العقد.</p>
                        )}

                        {signOff?.id === c.id ? (
                          <div className="mt-3 grid gap-2">
                            <textarea
                              className={areaCls} rows={2} maxLength={500}
                              placeholder="ما طابقتَه بالوثيقة — أو تفويضُك الخطّيُّ إن لم تكن المفوَّضَ في السجلّ"
                              value={signOff.noteAr}
                              onChange={(e) => setSignOff({ id: c.id, noteAr: e.target.value })}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button tone="confirm" icon={BadgeCheck} loading={busy}
                                onClick={() => void run(async () => {
                                  const r = await apiPost<{ activated: boolean; activationBlockedAr: string | null }>(
                                    `/api/admin/trainer-contracts/${c.id}/countersign`,
                                    { noteAr: signOff.noteAr.trim() || null });
                                  setSignOff(null);
                                  await load();
                                  if (r.activationBlockedAr) {
                                    setErr(`اعتُمد العقدُ، ولم يُفتح الحساب: ${r.activationBlockedAr}`);
                                  }
                                }, "اعتُمد العقدُ ونفَذ")}>
                                اعتمِدِ التوقيع
                              </Button>
                              <Button tone="ghost" onClick={() => setSignOff(null)}>تراجعْ</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button tone="confirm" icon={BadgeCheck}
                              onClick={() => setSignOff({ id: c.id, noteAr: "" })}>
                              طابقتُ الاسمَ — اعتمِدْ
                            </Button>
                            {/* ورفضُ التوقيع يُغلق العقدَ ولا يمحو دليلَه: من وقّع
                                باسمٍ غيرِ اسمه وقّع وثيقةً تسمّي طرفا آخر، ولا
                                تُصحَّح تسميةُ طرفٍ بتعديل حقل — يُركَّب عقدٌ جديد. */}
                            <Button tone="danger" icon={X}
                              onClick={() => void run(async () => {
                                const reasonAr = window.prompt("ما الذي لم يطابق؟ يصل صاحبَه نصّا:");
                                if (!reasonAr) return;
                                await apiPost(`/api/admin/trainer-contracts/${c.id}/reject-signature`, { reasonAr });
                                await load();
                              }, "رُفض التوقيعُ ووصل صاحبَه")}>
                              لم يطابق — ارفضْ
                            </Button>
                          </div>
                        )}
                      </Panel>
                    )}

                    {c.status === "countersigned" && (
                      <p className="mt-1 text-read opacity-70">
                        اعتُمد {c.countersignedAt ? fmtDateTime(c.countersignedAt) : ""} عن الأكاديميّة
                        {c.academySignatoryName ? ` — ${c.academySignatoryName}` : ""}
                        {c.academySignatoryTitle ? ` (${c.academySignatoryTitle})` : ""}
                        {c.countersignNoteAr ? ` · ${c.countersignNoteAr}` : ""}
                      </p>
                    )}
                    {c.qualifiedSnapshot && c.qualifiedSnapshot.length > 0 && (
                      <p className="mt-1 text-read opacity-70">
                        الملحق (أ): {c.qualifiedSnapshot.map((q) => q.titleAr).join(" · ")}
                      </p>
                    )}
                  </Inset>
                </li>
              ))}
            </ul>
          )}
      </Card>

      {/* ═══════════ عروضُ الإسناد ═══════════

          «ويحقّ للإدارة إسنادُ دورةٍ واحدةٍ أو لا دورةَ أو كافّةَ الدورات
          لهذا الشخص، لكي لا يُلزِمَنا في عقدٍ ثابت». فالتأهيلُ في الملحق (أ)
          بابٌ لا التزام، والعرضُ هو ما يُفتح منه — ويُقبَل أو يُردّ. */}
      {offerOptions.length > 0 && (
        <Card className="mt-6 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black">عروضُ الإسناد ({offers.length})</h2>
            {offerFor && <Button size="sm" tone="ghost" onClick={() => setOfferFor(null)}>أغلِقِ النموذج</Button>}
          </div>

          <p className="mb-3 text-read leading-7 opacity-70">
            العرضُ دعوةٌ لا توجيه: يقبلها المدرّبُ أو يعتذر عنها، ولا يُكتب
            إسنادٌ ولا يُنشَر اسمُه ولا يدخل كشفَ مستحقّاتٍ قبل قبوله. ومهلةُ
            الردّ {ASSIGNMENT_OFFER_RESPONSE_DAYS} أيّام، وأجلُ الإعداد بعد
            القبول {COURSE_PREP_DEFAULT_DAYS} أيّام ({COURSE_PREP_MIN_DAYS} حدّا أدنى).
          </p>

          {!offerFor && (
            <div className="flex flex-wrap gap-2">
              {offerOptions.map((o) => (
                <Button key={o.profileId} size="sm" icon={Handshake}
                  onClick={() => {
                    setOfferFor(o); setOfferCourseId(""); setOfferCohortId("");
                    setOfferFeeAr(""); setOfferNoteAr(""); setOfferSessions("");
                    setOfferPrepDays(String(COURSE_PREP_DEFAULT_DAYS));
                    setOfferResponseDays(String(ASSIGNMENT_OFFER_RESPONSE_DAYS));
                  }}>
                  {o.fullName}{o.contract ? "" : " (بلا عقدٍ نافذ)"}
                </Button>
              ))}
            </div>
          )}

          {offerFor && (
            <Inset className="grid gap-3 p-3">
              <p className="text-read">
                <b>{offerFor.fullName}</b> — {offerFor.reference}
                {offerFor.contract
                  ? ` · عقدُه النافذ: ${offerFor.contract.title}`
                  : " · لا عقدَ نافذٌ في القاعدة (مدرّبٌ سبق هذه المرحلة)"}
              </p>

              <label className="grid gap-1 text-read">
                <span className="font-bold">الدورةُ — من مؤهّلاته وحدها</span>
                <select className={inputCls} value={offerCourseId}
                  onChange={(e) => { setOfferCourseId(e.target.value); setOfferCohortId(""); }}>
                  <option value="">اختر دورة…</option>
                  {offerFor.courses.map((c) => (
                    <option key={c.courseId} value={c.courseId}>
                      {c.titleAr}
                      {c.alreadyOpen ? " — عرضٌ مفتوحٌ عنده" : c.alreadyAccepted ? " — قبِلها" : ""}
                    </option>
                  ))}
                </select>
              </label>

              {offerCourseId && (
                <label className="grid gap-1 text-read">
                  <span className="font-bold">الشعبة — وتُترك فارغةً إن لم تُجدوَل بعد</span>
                  <select className={inputCls} value={offerCohortId}
                    onChange={(e) => setOfferCohortId(e.target.value)}>
                    <option value="">بلا شعبةٍ بعد — الدورةُ وحدها</option>
                    {(offerFor.courses.find((c) => c.courseId === offerCourseId)?.cohorts ?? []).map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.title}{h.startsAt ? ` — ${fmtDateTime(h.startsAt)}` : ""}
                        {h.mine ? " (هو مدرّبُها)" : h.hasLead ? " (لها قائدٌ)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="grid gap-1 text-read">
                <span className="font-bold">الأجرُ نصّا — يقرؤه إنسان</span>
                <input className={inputCls} maxLength={500} value={offerFeeAr}
                  placeholder="مثلا: ٢٥ دولارا لكلّ متعلّم، وبحدٍّ أدنى ٨ مقاعد"
                  onChange={(e) => setOfferFeeAr(e.target.value)} />
              </label>

              <label className="grid gap-1 text-read">
                <span className="font-bold">ملحوظةٌ له — لا تلزم</span>
                <textarea className={areaCls} rows={2} maxLength={1000} value={offerNoteAr}
                  onChange={(e) => setOfferNoteAr(e.target.value)} />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1 text-read">
                  <span className="font-bold">عددُ الجلسات</span>
                  <input className={inputCls} inputMode="numeric" value={offerSessions}
                    onChange={(e) => setOfferSessions(e.target.value.replace(/\D/g, ""))} />
                </label>
                <label className="grid gap-1 text-read">
                  <span className="font-bold">مهلةُ الردّ (أيّام)</span>
                  <input className={inputCls} inputMode="numeric" value={offerResponseDays}
                    onChange={(e) => setOfferResponseDays(e.target.value.replace(/\D/g, ""))} />
                </label>
                <label className="grid gap-1 text-read">
                  <span className="font-bold">أجلُ الإعداد (أيّام)</span>
                  <input className={inputCls} inputMode="numeric" value={offerPrepDays}
                    onChange={(e) => setOfferPrepDays(e.target.value.replace(/\D/g, ""))} />
                </label>
              </div>

              <div>
                <Button tone="confirm" icon={Handshake} loading={busy} disabled={!offerCourseId}
                  onClick={() => void run(async () => {
                    await apiPost("/api/admin/trainer-offers", {
                      profileId: offerFor.profileId,
                      courseId: offerCourseId,
                      cohortId: offerCohortId || null,
                      sessionsCount: offerSessions ? Number(offerSessions) : null,
                      feeNoteAr: offerFeeAr.trim() || null,
                      noteAr: offerNoteAr.trim() || null,
                      prepDays: offerPrepDays ? Number(offerPrepDays) : null,
                      responseDays: offerResponseDays ? Number(offerResponseDays) : null,
                    });
                    setOfferFor(null);
                    await load();
                  }, "أُرسل العرضُ — وينتظر جوابَه")}>
                  اعرِضْها عليه
                </Button>
              </div>
            </Inset>
          )}

          {offers.length > 0 && (
            <div className="mt-4">
              <ListToolbar q={offerQ} onQ={setOfferQ} onPage={setOfferPage}
                view={offerView} unit="عرضا"
                placeholder="ابحث باسم المدرّب أو دورته أو شعبته أو حال عرضه…" />
            </div>
          )}
          {offerView.rows.length > 0 && (
            <ul className="mt-2 space-y-2">
              {offerView.rows.map((o) => (
                <li key={o.id}>
                  <Inset className="p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <b>{o.profile?.application?.fullName ?? "—"}</b>
                        <span className="opacity-70">
                          {" "}— {o.courseTitleAr}
                          {o.cohort ? ` · شعبةُ «${o.cohort.title}»` : " · بلا شعبة"}
                          {" · "}{OFFER_STATUS_AR[o.status] ?? o.status}
                        </span>
                      </span>
                      {o.status === "offered" && (
                        <Button size="sm" tone="danger" icon={Ban}
                          onClick={() => void run(async () => {
                            const reasonAr = window.prompt("سببُ السحب — يصل صاحبَه نصّا:");
                            if (!reasonAr) return;
                            await apiPost(`/api/admin/trainer-offers/${o.id}/withdraw`, { reasonAr });
                            await load();
                          }, "سُحب العرضُ ووصل صاحبَه")}>
                          اسحبْه
                        </Button>
                      )}
                    </div>
                    {o.status === "offered" && (
                      <p className="mt-1 text-read opacity-70">مهلةُ الردّ تنتهي {fmtDateTime(o.expiresAt)}</p>
                    )}
                    {o.status === "accepted" && o.prepDueAt && (
                      <p className="mt-1 text-read opacity-70">
                        {o.prepConfirmedAt
                          ? `أقرّ بجاهزيّته ${fmtDateTime(o.prepConfirmedAt)}`
                          : `أجلُ إعداده ينتهي ${fmtDateTime(o.prepDueAt)}`}
                        {!o.prepConfirmedAt && o.prepLapsedAt
                          ? " — وقد انقضى بلا إقرار، والإسنادُ قائمٌ كما هو" : ""}
                      </p>
                    )}
                    {o.declineReasonAr && (
                      <p className="mt-1 text-read opacity-70">سببُ اعتذاره: {o.declineReasonAr}</p>
                    )}
                    {o.withdrawReasonAr && (
                      <p className="mt-1 text-read opacity-70">سببُ السحب: {o.withdrawReasonAr}</p>
                    )}
                  </Inset>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {shownBody && (
        <Card className="mt-6 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-black">{shownBody.title}</h2>
            <Button size="sm" onClick={() => setShownBody(null)}>أغلِقْ</Button>
          </div>
          <pre dir="rtl" className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-black/20 p-4 text-sm leading-7">
            {shownBody.body}
          </pre>
        </Card>
      )}
    </AdminLayout>
  );
}
