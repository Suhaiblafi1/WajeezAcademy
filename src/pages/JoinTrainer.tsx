import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, CheckCircle2, Compass, Mic2, Send, Users, MessageCircle } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { saveApplication } from "@/data/trainerApplications";
import { TRAINING_SPECIALIZATIONS, TRAINER_PIPELINE_NOTE_AR } from "@/data/trainer-contracts";
import { CONTACT } from "@/data/stories";

const DOMAIN_YEARS = [
  { value: "1-3", label: "١–٣ سنوات" },
  { value: "4-7", label: "٤–٧ سنوات" },
  { value: "8-12", label: "٨–١٢ سنة" },
  { value: "12+", label: "أكثر من ١٢ سنة" },
];

const TRAINING_EXP = [
  { value: "none", label: "لم أدرّب بعد — لكني أتقن مجالي" },
  { value: "informal", label: "تدريب غير رسمي (زملاء / فريقي)" },
  { value: "workshops", label: "ورش ودورات قصيرة" },
  { value: "formal_teaching", label: "تدريب منهجي معتاد (دورات/شعب)" },
];

const TRAINING_EXP_LABEL: Record<string, string> = Object.fromEntries(TRAINING_EXP.map((t) => [t.value, t.label]));
const YEARS_LABEL: Record<string, string> = Object.fromEntries(DOMAIN_YEARS.map((y) => [y.value, y.label]));

const inputCls =
  "w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none";

/** صفحة انضمام المدربين — المرحلة الأولى (الطلب الأولي) من عقود trainer-contracts */
export default function JoinTrainer() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", specialization: "", domain_years: "", training_experience: "", role: "", links: "", topics: "", why: "",
  });
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const valid = form.name.trim() && /.+@.+\..+/.test(form.email) && form.specialization && form.domain_years && form.training_experience && form.why.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    saveApplication(form);
    setSent(true);
    window.scrollTo(0, 0);
  };

  /* القناة الحقيقية اليوم: رسالة واتساب جاهزة بملخص الطلب */
  const whatsappText = encodeURIComponent(
    `طلب انضمام مدرب — أكاديمي وجيز\nالاسم: ${form.name}\nالبريد: ${form.email}\nالتخصص: ${form.specialization}\nخبرة المجال: ${YEARS_LABEL[form.domain_years] ?? form.domain_years}\nخبرة التدريب: ${TRAINING_EXP_LABEL[form.training_experience] ?? form.training_experience}\nلماذا وجيز: ${form.why}`
  );

  if (sent) {
    return (
      <SiteShell>
        <SeoHead title="طلبك محفوظ" description="طلب انضمام مدرب في أكاديمية وجيز — النسخة التجريبية" path="/join-trainer" />
        <div className="mx-auto max-w-lg py-14 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#38A7B4]/15">
            <CheckCircle2 className="h-8 w-8 text-[#6EC7D1]" />
          </span>
          <h1 className="mt-6 text-2xl font-black">طلبك محفوظ — خطوة واحدة تبقى</h1>
          <p className="mt-3 text-sm leading-8 text-white/60">{TRAINER_PIPELINE_NOTE_AR}</p>
          <a
            href={`https://wa.me/${CONTACT.whatsapp}?text=${whatsappText}`}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#FABC05] px-7 py-3 font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90"
          >
            <MessageCircle className="h-4 w-4" />
            أرسل طلبك الآن عبر واتساب
          </a>
          <p className="mt-3 text-[11px] text-white/40">يفتح واتساب برسالة جاهزة بملخص طلبك — تراجعها قبل الإرسال.</p>
          <div>
            <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#6EC7D1] transition hover:text-[#38A7B4]">
              العودة للرئيسية <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <SeoHead
        title="انضم مدربا"
        description="درّب في أكاديمية وجيز — عبّئ طلب الانضمام الأولي وسيراجعه فريقنا لترتيب مقابلة."
        path="/join-trainer"
      />
      <div className="mx-auto max-w-2xl">
        <span className="kicker">انضم إلى نخبة المدربين</span>
        <h1 className="h-section mt-4">درّب ما تتقنه — وأثرّ في مسارات حقيقية</h1>
        <p className="mt-3 text-sm leading-8 text-white/60">
          مدربو وجيز لا يلقون دروسا مسجلة فحسب — يراجعون واجبات، ويرافقون طلابا، ويقيمون مشاريع تخرج.
          عبّئ الطلب الأولي، ثم أرسله عبر واتساب ليصل فريقنا اليوم مباشرة.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Compass, text: "مسارات مبنية بمنهجية موثقة لا بمزاج" },
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
              <label htmlFor="jt-spec" className="mb-1.5 block text-xs font-bold text-white/60">التخصص التدريبي *</label>
              <select id="jt-spec" name="specialization" required value={form.specialization} onChange={set("specialization")} className={`${inputCls} [&>option]:bg-[#121B1D]`}>
                <option value="" disabled>اختر التخصص</option>
                {TRAINING_SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="jt-years" className="mb-1.5 block text-xs font-bold text-white/60">سنوات الخبرة في المجال *</label>
              <select id="jt-years" name="domain_years" required value={form.domain_years} onChange={set("domain_years")} className={`${inputCls} [&>option]:bg-[#121B1D]`}>
                <option value="" disabled>اختر نطاق الخبرة</option>
                {DOMAIN_YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
              </select>
            </div>
          </div>

          {/* خبرة التدريب منفصلة عن خبرة المجال — الإتقان لا يعني القدرة على التدريب */}
          <div>
            <label htmlFor="jt-training" className="mb-1.5 block text-xs font-bold text-white/60">خبرتك في التدريب تحديدا *</label>
            <select id="jt-training" name="training_experience" required value={form.training_experience} onChange={set("training_experience")} className={`${inputCls} [&>option]:bg-[#121B1D]`}>
              <option value="" disabled>اختر الأقرب لواقعك</option>
              {TRAINING_EXP.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p className="mt-1.5 text-[11px] text-white/40">إتقان المجال شيء والقدرة على تدريبه شيء آخر — نقرؤهما منفصلين.</p>
          </div>

          <div>
            <label htmlFor="jt-links" className="mb-1.5 block text-xs font-bold text-white/60">رابط لينكدإن أو ملف أعمال</label>
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
            <Send className="h-4 w-4" /> احفظ طلبي وجهّز رسالة واتساب
          </button>
          <p className="text-center text-[11px] leading-5 text-white/40">
            بإرسالك توافق على أن يتواصل معك فريق وجيز بخصوص طلبك — بياناتك تُستخدم لإدارة التوظيف فقط.
          </p>
        </form>
      </div>
    </SiteShell>
  );
}
