import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowRight, BadgeCheck, Search, ShieldX } from "lucide-react";
import { verifyCertificate } from "@/data/student";

/** صفحة تحقق عامة من الشهادات — تعرض الحد الأدنى من البيانات (القسم 12.5) */
export default function Verify() {
  const { number } = useParams();
  const [input, setInput] = useState(number ?? "");
  const [checked, setChecked] = useState(number ?? "");
  const cert = checked ? verifyCertificate(checked) : null;

  return (
    <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-[#0D0D0D] px-5 py-16 text-white">
      <Link to="/" className="flex items-center gap-2 text-white/60 transition hover:text-white">
        <ArrowRight className="h-4 w-4" /> أكاديمي وجيز
      </Link>
      <div className="mt-8 w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <h1 className="text-center text-2xl font-black">التحقق من شهادة</h1>
        <p className="mt-2 text-center text-xs leading-6 text-white/50">
          أدخل رقم الشهادة (مثال: WJ-2026-10000) للتأكد من صحتها — دون كشف بيانات شخصية زائدة.
        </p>
        <div className="mt-6 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="WJ-2026-…"
            dir="ltr"
            className="flex-1 rounded-xl border border-white/15 bg-black/30 px-4 py-3 font-mono text-sm text-white placeholder:text-white/25 focus:border-[#38A7B4] focus:outline-none"
          />
          <button
            onClick={() => setChecked(input)}
            className="cursor-pointer rounded-xl bg-[#38A7B4] px-5 text-[#08272B] transition hover:bg-[#6EC7D1]"
            aria-label="تحقق"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        {checked && (
          cert ? (
            <div className="mt-6 rounded-2xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 p-5 text-center">
              <BadgeCheck className="mx-auto h-10 w-10 text-[#38A7B4]" />
              <p className="mt-3 font-black text-[#6EC7D1]">شهادة صحيحة ومعتمدة</p>
              <div className="mt-3 space-y-1 text-sm text-white/75">
                <p>{cert.courseOrPath}</p>
                <p className="text-xs text-white/50">{cert.kind === "pathway" ? "شهادة إتمام مسار — مشروع تخرج معتمد" : "شهادة إتمام دورة"}</p>
                <p className="text-xs text-white/50">تاريخ الإصدار: {cert.issuedAt}</p>
                <p className="font-mono text-xs text-white/40">{cert.number}</p>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-center">
              <ShieldX className="mx-auto h-10 w-10 text-red-400" />
              <p className="mt-3 font-black text-red-300">لا توجد شهادة بهذا الرقم</p>
              <p className="mt-1.5 text-xs text-white/50">تأكد من الرقم، أو راسلنا إن ظننت أن هناك خطأ.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
