import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eye, FileText, Loader2, ShieldCheck, Trash2, Upload, X,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import { toast } from "@/components/Toast";
import { fmtWhen } from "@/utils/format";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";

import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
/* الخادم هو مصدر الحقيقة: POST/GET /api/learner/cv و POST /api/cv/:id/delete.
   كان هنا `@/data/cv` — محاكاةٌ كاملة للسلوك نفسه في localStorage، فيرفع
   المتعلم سيرته ويراها في صفحته ولا تصل إلى مستشاره أبدا. */
const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

const CV_ACCEPT = "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png";
const CV_MAX_LABEL = "10MB";

interface Cv { id: string; originalName: string; mime: string; sizeBytes: number; createdAt: string }

function cvKindLabel(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("word")) return "Word";
  if (mime.startsWith("image/")) return "صورة";
  return "ملف";
}

/** سيرتي الذاتية — رفع بموافقة صريحة إلزامية، تحقق نوع وحجم، حذف منطقي بسبب موثق */
export default function MyCv() {
  const { fileUploads } = usePlatformConfig();
  const [cvs, setCvs] = useState<Cv[] | null>(null);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [delReason, setDelReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    apiGet<Cv[]>("/api/learner/cv").then(setCvs).catch(() => setCvs([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  /* كان هذا يسجّل الوصفَ ولا يرسل الملفَّ قطّ: نداءٌ واحدٌ بالاسم والحجم،
     ثمّ «رُفعت» — والمستشارُ يفتحها فيجد «الملفّ لم يرفع بعد». والرابطُ
     الموقّعُ الذي يعيده الخادمُ كان يُهمَل. شُوهد في جولة ٢٠٢٦-٠٩. */
  const onFile = async (f: File) => {
    setErr(null); setBusy(true);
    try {
      const res = await apiPost<{ uploadUrl?: string }>("/api/learner/cv", { originalName: f.name, mime: f.type, sizeBytes: f.size, consent });
      if (res.uploadUrl) {
        const put = await fetch(`${API_BASE}${res.uploadUrl}`, {
          method: "PUT", credentials: "include",
          headers: { "content-type": "application/octet-stream" },
          body: f,
        });
        if (!put.ok) throw new ApiError("upload_failed", "سُجّل طلبُك ولم يصل الملفّ — أبلغ الأكاديمية", put.status);
      }
      toast(`رُفعت «${f.name}» — يراها مستشارك المسند فقط، وتُسجل كل مشاهدة.`);
      setConsent(false);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر رفع السيرة الآن");
    } finally { setBusy(false); }
  };

  const confirmDelete = async () => {
    if (!delId) return;
    setBusy(true);
    try {
      await apiPost(`/api/cv/${delId}/delete`, { reason: delReason });
      setErr(null);
      toast("حُذفت السيرة حذفا منطقيا بسبب موثق — لم تعد تظهر لمستشارك ولا في ملفك.");
      setDelId(null); setDelReason("");
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحذف الآن");
    } finally { setBusy(false); }
  };

  return (
    <PortalLayout title="سيرتي الذاتية">
      {/* شرحُ الرفع لا يُقال حيث لا رفع — وإلّا نقض القسمَ الذي تحته */}
      {fileUploads && (
        <Card as="p" className="mb-5 max-w-2xl px-4 py-3 text-xs leading-6 text-muted-foreground">
          تُرفع السيرة بموافقة صريحة منك فقط، وبصيغة PDF أو Word حتى {CV_MAX_LABEL}.
          مستشارك المسند يفتحها برابط قراءة موقع وتُسجل كل مشاهدة — والحذف بسبب موثق لا يمحو الأثر.
        </Card>
      )}

      {err && (
        <Card as="p" tone="danger" role="alert" className="mb-4 px-4 py-3 text-sm font-semibold text-red-300">{err}</Card>
      )}

      {/* رفع جديد — لا يُعرض إلّا حين يستطيع الخادمُ حفظَ الملفّ */}
      {!fileUploads && (
        <Panel as="section" tone="warn">
          <h2 className="flex items-center gap-2 text-sm font-black text-gold-ink"><ShieldCheck className="h-4 w-4" /> رفعُ السيرة غيرُ مفعّلٍ بعد</h2>
          <p className="mt-3 text-xs leading-7 text-foreground">
            المنصّةُ لا تحفظ الملفّاتَ في هذه المرحلة، فلن نطلب منك ملفًّا لا يصل. أعطِ سيرتك لمستشارك في جلستكم الأولى،
            أو تواصل مع الأكاديمية — ويظهر هذا القسمُ تلقائيّا يومَ يُفعَّل الرفع.
          </p>
        </Panel>
      )}
      {fileUploads && (
      <Panel as="section">
        <h2 className="flex items-center gap-2 text-sm font-black"><Upload className="h-4 w-4 text-teal-ink" /> رفع سيرة جديدة</h2>
        <input
          ref={fileRef}
          type="file"
          accept={CV_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 py-8 text-sm font-bold text-muted-foreground transition hover:border-teal/60 hover:text-teal-light-ink"
        >
          <FileText className="h-5 w-5" /> اختر ملف سيرتك — PDF أو Word حتى {CV_MAX_LABEL}
        </button>
        <Card as="label" tone="warn" className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-gold"
          />
          <span className="text-xs leading-6 text-foreground">
            <span className="font-black text-gold-ink">موافقة صريحة (إلزامية):</span> أوافق على أن يرى مستشاري المسند وإدارة العمليات سيرتي الذاتية لغرض الإرشاد المهني فقط، وأعلم أن كل مشاهدة تُسجل وأنني أستطيع حذفها في أي وقت.
          </span>
        </Card>
        {!consent && (
          <p className="mt-2 text-micro text-muted-foreground">لن يُقبل أي ملف قبل تفعيل الموافقة — كما يفرض الخادم.</p>
        )}
      </Panel>
      )}

      {/* سيري الفعالة */}
      <section className="mt-6 space-y-3">
        {cvs === null && <div className="grid place-items-center py-10"><Loader2 className="h-7 w-7 animate-spin text-teal-ink" aria-label="يُحمَّل" /></div>}
        {cvs?.length === 0 && (
          <Panel className="border-dashed py-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold text-muted-foreground">لا سير فعالة بعد</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-6 text-muted-foreground">
              سيرتك تساعد مستشارك على فهم خلفيتك المهنية قبل أول جلسة — وتُسجل كل مشاهدة لها في السجل.
            </p>
            {fileUploads && (
              <Button tone="confirm" onClick={() => fileRef.current?.click()} className="mt-4">
                ارفع أول سيرة
              </Button>
            )}
          </Panel>
        )}
        {cvs?.map((c) => (
          <Panel key={c.id} className="flex flex-wrap items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal/15 text-teal-light-ink">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-black">{c.originalName}</p>
              <p className="mt-0.5 text-micro text-muted-foreground">
                {cvKindLabel(c.mime)} · {Math.ceil(c.sizeBytes / 1024)} كيلوبايت · رُفعت {fmtWhen(c.createdAt)}
              </p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-teal/15 px-3 py-1 text-micro font-black text-teal-light-ink">
              <ShieldCheck className="h-3 w-3" /> فعالة
            </span>
            <span className="flex items-center gap-1.5 text-micro text-muted-foreground">
              <Eye className="h-3 w-3" /> مشاهداتها مسجلة في سجل المستشار
            </span>
            <Button tone="danger" size="sm" onClick={() => { setDelId(c.id); setDelReason(""); setErr(null); }}>
              <Trash2 className="h-3.5 w-3.5" /> حذف
            </Button>
          </Panel>
        ))}
      </section>

      {/* نافذة الحذف الموثق */}
      {delId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-paper/70 p-5 backdrop-blur-sm">
          <Inset className="w-full max-w-md bg-surface">
            <div className="flex items-center justify-between">
              <h3 className="font-black">حذف السيرة — حذف منطقي بسبب موثق</h3>
              <button onClick={() => setDelId(null)} className="cursor-pointer text-muted-foreground hover:text-foreground" aria-label="إغلاق"><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              وفق السياسة: الحذف منطقي لا فيزيائي، وسببك يُحفظ في السجل. بعدها لا يراها مستشارك ولا تظهر في ملفك.
            </p>
            <label className="mt-4 block text-xs font-bold text-muted-foreground">سبب الحذف *</label>
            <textarea
              rows={2}
              value={delReason}
              onChange={(e) => setDelReason(e.target.value)}
              placeholder="مثال: رفعت نسخة أحدث وأريد إزالة القديمة"
              className="mt-1.5 w-full resize-none rounded-xl border border-white/15 bg-paper px-3 py-2.5 text-sm text-foreground focus:border-red-400 focus:outline-none"
            />
            <Button tone="ghost" onClick={() => void confirmDelete()}
              disabled={busy || delReason.trim().length < 5} className="mt-4 w-full bg-red-400 disabled:cursor-not-allowed">
              تأكيد الحذف الموثق
            </Button>
          </Inset>
        </div>
      )}
    </PortalLayout>
  );
}
