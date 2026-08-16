import { useState } from 'react'
import { Link } from 'react-router'
import { Building2, CheckCircle2, Compass, Landmark, Mail, MapPin, Send } from 'lucide-react'
import { CONTACT } from '@/data/stories'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'
import { track } from '@/services/analytics'

const TOPICS = [
  'استفسار عن مسار أو تشخيص',
  'عرض مؤسسي — شركات',
  'عرض مؤسسي — جهة حكومية',
  'طلب استرداد',
  'الانضمام كمدرب',
  'أخرى',
]

const FIELD =
  'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[#38A7B4]'
const LABEL = 'mb-1.5 block text-xs font-bold text-white/60'

/* ───────────────── صفحة التواصل — بيانات موثقة من موقع وجيز الأم ───────────────── */
export default function Contact() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState(TOPICS[0])
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ref, setRef] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
  const valid = name.trim().length >= 2 && emailValid && message.trim().length >= 10 && consent

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!valid) {
      setErr(
        name.trim().length < 2
          ? 'أدخل اسمك الكريم'
          : !emailValid
            ? 'صيغة البريد غير صحيحة — مثال: name@mail.com'
            : message.trim().length < 10
              ? 'اكتب رسالتك بتفصيل أكبر قليلا (10 أحرف على الأقل) لنخدمك أدق'
              : 'نحتاج موافقتك على معالجة بياناتك للرد عليك'
      )
      return
    }
    setBusy(true)
    setErr('')
    /* محاكاة إرسال — عند الربط: POST /api/contact ثم بريد تأكيد للمُرسل */
    window.setTimeout(() => {
      const reference = `WJ-C-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      setRef(reference)
      setBusy(false)
      if (topic === 'طلب استرداد') track('refund_requested')
      else track('contact_submitted', { topic })
    }, 700)
  }

  return (
    <SiteShell>
      <SeoHead
        title="تواصل معنا"
        description="سؤال عن مسار؟ عرض مؤسسي لشركتك أو جهتك الحكومية؟ فريق أكاديمي وجيز يقرأ كل رسالة بنفسه ويرد خلال يوم عمل."
        path="/contact"
      />

      <div className="grid gap-10 lg:grid-cols-5">
        {/* بيانات التواصل */}
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-black md:text-4xl">تفضّل بالكلام</h1>
          <p className="mt-4 leading-8 text-white/60">
            سؤال عن مسار؟ استفسار مؤسسي؟ شراكة تدريبية؟ فريقنا يقرأ كل رسالة بنفسه ويرد خلال يوم عمل واحد.
          </p>
          <div className="mt-6 space-y-2">
            <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
              <Mail className="h-4 w-4 shrink-0 text-[#6EC7D1]" />
              <a href={`mailto:${CONTACT.email}`} dir="ltr" className="text-xs font-bold text-[#6EC7D1] underline-offset-4 hover:underline">
                {CONTACT.email}
              </a>
              <span className="mr-auto text-[10px] text-white/40">نرد خلال يوم عمل</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-[#6EC7D1]" />
              <p className="text-xs text-white/70">{CONTACT.address}</p>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
              <Building2 className="h-4 w-4 shrink-0 text-[#FABC05]" />
              <p className="text-[11px] leading-5 text-white/55">
                <span className="font-bold text-white/75">للشركات والجهات الحكومية: </span>
                اختر «عرض مؤسسي» في النموذج — أو تصفح{' '}
                <Link to="/for-business" className="font-semibold text-[#6EC7D1] underline-offset-4 hover:underline">حلول الشركات</Link>
                {' '}و{' '}
                <Link to="/for-government" className="font-semibold text-[#6EC7D1] underline-offset-4 hover:underline">حلول الجهات الحكومية</Link>.
              </p>
            </div>
          </div>
          <p className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5 text-[11px] leading-5 text-white/45">
            إن كان سؤالك «أي مسار يناسبني؟» — فأصدق إجابة يعطيها لك{' '}
            <Link to="/diagnostic" className="font-semibold text-[#6EC7D1] underline-offset-4 hover:underline">التشخيص الذكي</Link>
            {' '}في دقائق، مجانا ودون التزام.
          </p>
        </div>

        {/* النموذج */}
        <div className="lg:col-span-3">
          {ref ? (
            <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-[#38A7B4]/30 bg-[#38A7B4]/5 p-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#38A7B4]/15">
                <CheckCircle2 className="h-7 w-7 text-[#6EC7D1]" />
              </span>
              <h2 className="mt-5 text-2xl font-black">وصلت رسالتك</h2>
              <p className="mt-3 max-w-sm text-sm leading-7 text-white/60">
                رقمك المرجعي <span dir="ltr" className="font-bold text-[#6EC7D1]">{ref}</span> — احتفظ به لأي متابعة.
                سيرد عليك فريقنا خلال يوم عمل واحد.
              </p>
              <Link to="/" className="mt-6 text-sm font-semibold text-[#6EC7D1] underline-offset-4 hover:underline">
                عودة للرئيسية
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ct-name" className={LABEL}>الاسم الكريم</label>
                  <input id="ct-name" name="name" type="text" required autoComplete="name" value={name}
                    onChange={(e) => setName(e.target.value)} placeholder="مثال: سارة العتيبي" className={FIELD} />
                </div>
                <div>
                  <label htmlFor="ct-email" className={LABEL}>البريد الإلكتروني</label>
                  <input id="ct-email" name="email" type="email" required autoComplete="email" dir="ltr" value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="name@mail.com" className={`${FIELD} text-left`} />
                </div>
              </div>
              <div className="mt-4">
                <label htmlFor="ct-topic" className={LABEL}>نوع الطلب</label>
                <select id="ct-topic" name="topic" value={topic} onChange={(e) => setTopic(e.target.value)}
                  className={`${FIELD} cursor-pointer [&>option]:bg-[#121B1D]`}>
                  {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="mt-4">
                <label htmlFor="ct-message" className={LABEL}>رسالتك</label>
                <textarea id="ct-message" name="message" required rows={5} value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={topic.includes('مؤسسي') ? 'اذكر جهتك، وعدد المتدربين المتوقع، والمجال الذي يهمك…' : 'اكتب سؤالك أو طلبك بتفصيل يساعدنا نخدمك من أول رد…'}
                  className={`${FIELD} resize-none`} />
              </div>
              <label htmlFor="ct-consent" className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <input id="ct-consent" name="consent" type="checkbox" required checked={consent}
                  onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#38A7B4]" />
                <span className="text-[11px] leading-relaxed text-white/55">
                  أوافق على معالجة بياناتي للرد على طلبي وفق{' '}
                  <Link to="/p/privacy" className="font-bold text-white/75 underline underline-offset-4 hover:text-[#6EC7D1]">سياسة الخصوصية</Link>
                </span>
              </label>
              {err && (
                <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-center text-xs font-semibold text-red-300">
                  {err}
                </p>
              )}
              <button type="submit" disabled={busy || !valid}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FABC05] text-sm font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:cursor-not-allowed disabled:opacity-40">
                <Send className="h-4 w-4" />
                {busy ? 'جارٍ الإرسال…' : 'أرسل رسالتك'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* إشارة للجهات الحكومية */}
      <div className="mt-10 flex items-center justify-center gap-2 text-xs text-white/40">
        <Landmark className="h-3.5 w-3.5" />
        جهة حكومية؟ برامج الترشيح الحكومي لها مسارها الخاص — اختر «عرض مؤسسي — جهة حكومية»
        <Compass className="h-3.5 w-3.5 opacity-0" aria-hidden="true" />
      </div>
    </SiteShell>
  )
}
