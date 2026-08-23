import { useMemo, useRef, useState } from "react";
import {
  Eye, FileText, ShieldCheck, Trash2, Upload, X,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import SimulationNote from "@/components/SimulationNote";
import { toast } from "@/components/Toast";
import { fmtWhen } from "@/utils/format";
import {
  listMyCvs, uploadCv, deleteCv, cvKindLabel, CV_ACCEPT, CV_MAX_LABEL,
} from "@/data/cv";

/** سيرتي الذاتية — رفع بموافقة صريحة إلزامية، تحقق نوع وحجم، حذف منطقي بسبب موثق */
export default function MyCv() {
  const [tick, setTick] = useState(0);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [delReason, setDelReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const cvs = useMemo(() => listMyCvs(), [tick]);

  const onFile = (f: File) => {
    setErr(null);
    const res = uploadCv({
      originalName: f.name,
      mime: f.type,
      sizeKb: Math.ceil(f.size / 1024),
      consent,
    });
    if (!res.ok) { setErr(res.error); return; }
    toast(`رُفعت «${res.cv.originalName}» برابط رفع موقع — يراها مستشارك المسند فقط، وتُسجل كل مشاهدة.`);
    setConsent(false);
    setTick((t) => t + 1);
  };

  const confirmDelete = () => {
    if (!delId) return;
    const res = deleteCv(delId, delReason);
    if (!res.ok) { setErr(res.error); return; }
    setErr(null);
    toast("حُذفت السيرة حذفا منطقيا بسبب موثق — لم تعد تظهر لمستشارك ولا في ملفك.");
    setDelId(null); setDelReason("");
    setTick((t) => t + 1);
  };

  return (
    <PortalLayout title="سيرتي الذاتية">
      <SimulationNote what="السير الذاتية" />
      <p className="mb-5 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-6 text-white/55">
        تُرفع السيرة بموافقة صريحة منك فقط، وبصيغة PDF أو Word حتى {CV_MAX_LABEL}.
        مستشارك المسند يفتحها برابط قراءة موقع وتُسجل كل مشاهدة — والحذف بسبب موثق لا يمحو الأثر.
      </p>

      {err && (
        <p role="alert" className="mb-4 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-300">{err}</p>
      )}

      {/* رفع جديد */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="flex items-center gap-2 text-sm font-black"><Upload className="h-4 w-4 text-teal-ink" /> رفع سيرة جديدة</h2>
        <input
          ref={fileRef}
          type="file"
          accept={CV_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 py-8 text-sm font-bold text-white/60 transition hover:border-teal/60 hover:text-teal-light-ink"
        >
          <FileText className="h-5 w-5" /> اختر ملف سيرتك — PDF أو Word حتى {CV_MAX_LABEL}
        </button>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-4">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-gold"
          />
          <span className="text-xs leading-6 text-white/70">
            <span className="font-black text-gold-ink">موافقة صريحة (إلزامية):</span> أوافق على أن يرى مستشاري المسند وإدارة العمليات سيرتي الذاتية لغرض الإرشاد المهني فقط، وأعلم أن كل مشاهدة تُسجل وأنني أستطيع حذفها في أي وقت.
          </span>
        </label>
        {!consent && (
          <p className="mt-2 text-[10px] text-white/50">لن يُقبل أي ملف قبل تفعيل الموافقة — كما يفرض الخادم.</p>
        )}
      </section>

      {/* سيري الفعالة */}
      <section className="mt-6 space-y-3">
        {cvs.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/15 py-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-white/50" />
            <p className="mt-3 text-sm font-bold text-white/60">لا سير فعالة بعد</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-6 text-white/50">
              سيرتك تساعد مستشارك على فهم خلفيتك المهنية قبل أول جلسة — وتُسجل كل مشاهدة لها في السجل.
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-4 cursor-pointer rounded-full bg-teal px-6 py-2.5 text-sm font-black text-on-teal transition hover:bg-teal-light"
            >
              ارفع أول سيرة
            </button>
          </div>
        )}
        {cvs.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal/15 text-teal-light-ink">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-black">{c.originalName}</p>
              <p className="mt-0.5 text-[11px] text-white/50">
                {cvKindLabel(c.mime)} · {c.sizeKb} كيلوبايت · رُفعت {fmtWhen(c.uploadedAt)}
              </p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-teal/15 px-3 py-1 text-[10px] font-black text-teal-light-ink">
              <ShieldCheck className="h-3 w-3" /> فعالة
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-white/50">
              <Eye className="h-3 w-3" /> مشاهداتها مسجلة في سجل المستشار
            </span>
            <button
              onClick={() => { setDelId(c.id); setDelReason(""); setErr(null); }}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-red-400/40 px-4 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-400/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> حذف
            </button>
          </div>
        ))}
      </section>

      {/* نافذة الحذف الموثق */}
      {delId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-black">حذف السيرة — حذف منطقي بسبب موثق</h3>
              <button onClick={() => setDelId(null)} className="cursor-pointer text-white/50 hover:text-white" aria-label="إغلاق"><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-2 text-xs leading-6 text-white/55">
              وفق السياسة: الحذف منطقي لا فيزيائي، وسببك يُحفظ في السجل. بعدها لا يراها مستشارك ولا تظهر في ملفك.
            </p>
            <label className="mt-4 block text-xs font-bold text-white/60">سبب الحذف *</label>
            <textarea
              rows={2}
              value={delReason}
              onChange={(e) => setDelReason(e.target.value)}
              placeholder="مثال: رفعت نسخة أحدث وأريد إزالة القديمة"
              className="mt-1.5 w-full resize-none rounded-xl border border-white/15 bg-paper px-3 py-2.5 text-sm text-white focus:border-red-400 focus:outline-none"
            />
            <button
              onClick={confirmDelete}
              disabled={delReason.trim().length < 5}
              className="mt-4 w-full cursor-pointer rounded-full bg-red-400 py-3 font-black text-on-gold transition hover:bg-red-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              تأكيد الحذف الموثق
            </button>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
