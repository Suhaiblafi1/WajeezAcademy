import { Award, Copy, CheckCircle2, QrCode } from "lucide-react";
import { useState } from "react";
import PortalLayout from "./PortalLayout";
import { loadCertificates } from "@/data/student";

export default function Certificates() {
  const certs = loadCertificates();
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <PortalLayout title="شهاداتي">
      {certs.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <Award className="h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black">لا شهادات بعد — لكنها أقرب مما تظن</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">
            شهادة الدورة تصدر بعد إكمال دروسها واجتياز اختبارها وتسليم واجبها،
            وشهادة المسار ترتبط باعتماد مشروع التخرج — لا شهادات مشاهدة عندنا.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {certs.map((c) => (
            <div key={c.number} className="relative overflow-hidden rounded-3xl border border-[#FABC05]/30 bg-gradient-to-b from-[#2A2108]/40 to-transparent p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-[#FABC05]">{c.kind === "pathway" ? "شهادة إتمام مسار" : "شهادة إتمام دورة"}</p>
                  <h3 className="mt-1.5 text-lg font-black leading-snug">{c.courseOrPath}</h3>
                  <p className="mt-1 text-xs text-white/50">{c.holder} · صدرت {c.issuedAt}</p>
                </div>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FABC05]/15 text-[#FABC05]">
                  <Award className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <QrCode className="h-4 w-4 text-[#6EC7D1]" />
                  <span className="font-mono font-black tracking-wider text-[#6EC7D1]">{c.number}</span>
                </div>
                <button
                  onClick={() => { navigator.clipboard?.writeText(`${location.origin}/verify/${c.number}`); setCopied(c.number); setTimeout(() => setCopied(null), 1500); }}
                  className="flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-white/55 transition hover:text-white"
                >
                  {copied === c.number ? <CheckCircle2 className="h-3.5 w-3.5 text-[#38A7B4]" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === c.number ? "نُسخ رابط التحقق" : "انسخ رابط التحقق"}
                </button>
              </div>
              <p className="mt-3 text-[11px] text-white/35">
                أي جهة تستطيع التحقق من صحة الشهادة عبر الرقم في صفحة التحقق العامة — دون كشف بياناتك الشخصية.
              </p>
            </div>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
