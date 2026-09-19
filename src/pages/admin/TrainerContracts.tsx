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
import { FileSignature, FileText, Ban, RefreshCw } from "lucide-react";
import { apiGet, apiPost, permissionMessage } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";
import { RULE_TYPE_AR } from "@/application/trainer/compensation-labels";
import {
  CONTRACT_DOCUMENT_KINDS, DEFAULT_REQUIRED_DOCUMENTS, type RequiredDocument,
} from "@/application/trainer/contract-documents";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffControlCls as inputCls, staffAreaCls as areaCls } from "@/components/FormKit";
import AdminLayout from "./AdminLayout";

const STATUS_AR: Record<string, string> = {
  draft: "مسودّة مجمَّدة", sent: "أُرسل — بانتظار التوقيع", revoked: "ملغًى",
  signed: "موقَّع", expired: "منتهٍ", terminated: "مفسوخ",
};

interface CandidateRow { id: string; reference: string; fullName: string; email: string; status: string }

interface ContractRow {
  id: string; title: string; status: string; kind: string; revision: number;
  bodyVersion: string | null; bodyHash: string | null; signerEmail: string | null;
  compensationType: string | null; compensationRate: string | null; currency: string;
  gatesActivation: boolean; sentAt: string | null; signedAt: string | null;
  revokedAt: string | null; revokeReasonAr: string | null; createdAt: string;
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

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ contracts: ContractRow[]; candidates: CandidateRow[]; missingLegal: string[] }>(
        "/api/admin/trainer-contracts",
      );
      setContracts(d.contracts); setCandidates(d.candidates); setMissingLegal(d.missingLegal);
    } catch (e) { setErr(permissionMessage(e, "تعذّر تحميل العقود")); }
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
        {contracts.length === 0
          ? <p className="text-sm opacity-70">لا عقودَ بعد.</p>
          : (
            <ul className="space-y-2">
              {contracts.map((c) => (
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
                      <span className="flex gap-2">
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
                    {c.revokeReasonAr && (
                      <p className="mt-1 text-read opacity-70">سببُ الإلغاء: {c.revokeReasonAr}</p>
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
