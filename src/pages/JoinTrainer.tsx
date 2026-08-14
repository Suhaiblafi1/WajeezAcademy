import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, CheckCircle2, Compass, Mic2, Send, Users } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { courseCategories } from "@/data/courses";
import { saveApplication } from "@/data/trainerApplications";

const YEARS = ["١–٣ سنوات", "٤–٧ سنوات", "٨–١٢ سنة", "أكثر من ١٢ سنة"];

const inputCls =
  "w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none";

/** صفحة انضمام المدربين — نموذج يغذي بوابة الإدارة مباشرة */
export default function JoinTrainer() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", domain: "", years: "", role: "", links: "", topics: "", why: "",
  });
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const valid = form.name.trim() && /.+@.+\..+/.test(form.email) && form.domain && form.years && form.why.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    saveApplication(form);
    setSent(true);
    window.scrollTo(0, 0);
  };

  if (sent) {
    return (
      <SiteShell>
        <SeoHead title="وصلنا طلبك" description="استلمنا طلب انضمامك مدربا في أكاديمية وجيز" path="/join-trainer" />
        <div className="mx-auto max-w-lg py-14 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#38A7B4]/15">
            <CheckCircle2 className="h-8 w-8 text-[#6EC7D1]" />
          </span>
          <h1 className="mt-6 text-2xl font-black">وصلنا طلبك — وأهلا بك في رحلة الاختيار</h1>
          <p className="mt-3 text-sm leading-8 text-white/60">
            يظهر طلبك الآن في لوحة الإدارة والعمليات مباشرة. الخطوات التالية:
            مراجعة ملفك، ثم دعوتك لمقابلة تعارف قصيرة، ثم القرار — وسنوافيك بالبريد في كل خطوة.
          </p>
          <Link to="/" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#38A7B4] px-7 py-3 font-black text-[#08272B] transition hover:bg-[#6EC7D1]">
            العودة للرئيسية <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <SeoHead
        title="انضم مدربا"
        description="درّب في أكاديمية وجيز — عبّئ النموذج ويصل طلبك مباشرة إلى لوحة الإدارة لتحديد مقابلة."
        path="/join-trainer"
      />
      <div className="mx-auto max-w-2xl">
        <span className="kicker">انضم إلى نخبة المدربين</span>
        <h1 className="h-section mt-4">درّب ما تتقنه — وأثرّ في مسارات حقيقية</h1>
        <p className="mt-3 text-sm leading-8 text-white/60">
          مدربو وجيز لا يلقون دروسا مسجلة فحسب — يراجعون واجبات، ويرافقون طلابا، ويقيمون مشاريع تخرج.
          عبّئ النموذج وسيصل طلبك مباشرة إلى لوحة الإدارة لترتيب مقابلة.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Compass, text: "مسارات مبنية على علم لا على مزاج" },
            { icon: Users, text: "طلاب جادون وصلوا عبر تشخيص" },
            { icon: Mic2, text: "مقابلة واحدة تكفي للبدء" },
          ].map((f) => (
            <div key={f.text} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <f.icon className="h-5 w-5 text-[#6EC7D1]" />
              <p className="mt-2 text-xs font-bold leading-6 text-white/85">{f.text}</p>
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="jt-name" className="mb-1.5 block text-xs font-bold text-white/60">الاسم الكامل *</label>
              <input id="jt-name" name="name" autoComplete="name" required value={form.name} onChange={set("name")} className={inputCls} />
            </div>
            <div>
              <label htmlFor="jt-email" className="mb-1.5 block text-xs font-bold text-white/60">البريد الإلكتروني *</label>
              <input id="jt-email" name="email" type="email" autoComplete="email" required dir="ltr" value={form.email} onChange={set("email")} className={`${inputCls} text-left`} />
            </div>
            <div>
              <label htmlFor="jt-phone" className="mb-1.5 block text-xs font-bold text-white/60">رقم الجوال (واتساب)</label>
              <input id="jt-phone" name="tel" type="tel" autoComplete="tel" dir="ltr" value={form.phone} onChange={set("phone")} className={`${inputCls} text-left`} />
            </div>
            <div>
              <label htmlFor="jt-role" className="mb-1.5 block text-xs font-bold text-white/60">دورك الحالي</label>
              <input id="jt-role" name="role" placeholder="مثال: مدير تحليل بيانات" value={form.role} onChange={set("role")} className={inputCls} />
            </div>
            <div>
              <label htmlFor="jt-domain" className="mb-1.5 block text-xs font-bold text-white/60">المجال الرئيسي *</label>
              <select id="jt-domain" name="domain" required value={form.domain} onChange={set("domain")} className={`${inputCls} [&>option]:bg-[#121B1D]`}>
                <option value="" disabled>اختر المجال</option>
                {courseCategories.filter((c) => c !== "الكل").map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="jt-years" className="mb-1.5 block text-xs font-bold text-white/60">سنوات الخبرة *</label>
              <select id="jt-years" name="years" required value={form.years} onChange={set("years")} className={`${inputCls} [&>option]:bg-[#121B1D]`}>
                <option value="" disabled>اختر نطاق الخبرة</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="jt-links" className="mb-1.5 block text-xs font-bold text-white/60">روابطك — لينكدإن أو أعمال سابقة</label>
            <input id="jt-links" name="links" dir="ltr" placeholder="https://linkedin.com/in/..." value={form.links} onChange={set("links")} className={`${inputCls} text-left`} />
          </div>
          <div>
            <label htmlFor="jt-topics" className="mb-1.5 block text-xs font-bold text-white/60">ما المواضيع التي تحب أن تدربها عندنا؟</label>
            <textarea id="jt-topics" name="topics" rows={2} value={form.topics} onChange={set("topics")} className={inputCls} />
          </div>
          <div>
            <label htmlFor="jt-why" className="mb-1.5 block text-xs font-bold text-white/60">لماذا تريد الانضمام إلى وجيز تحديدا؟ *</label>
            <textarea id="jt-why" name="why" rows={3} required value={form.why} onChange={set("why")} className={inputCls} />
          </div>
          <button
            type="submit"
            disabled={!valid}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#FABC05] py-3.5 font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" /> أرسل طلب الانضمام
          </button>
          <p className="text-center text-[11px] leading-5 text-white/40">
            بإرسالك توافق على أن يتواصل معك فريق وجيز بخصوص طلبك — بياناتك تُستخدم لإدارة التوظيف فقط.
          </p>
        </form>
      </div>
    </SiteShell>
  );
}
