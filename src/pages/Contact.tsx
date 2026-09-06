import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  Building2, CheckCircle2, Compass, Mail, MapPin, Send, ScanSearch, Route,
  FileCheck, BarChart3,
} from 'lucide-react'
import { CONTACT } from '@/data/stories'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'
import { track } from '@/services/analytics'
import { Panel, Card, Inset } from '@/components/ui/Surface'

/* ───────────── التواصل الموحد — بلا صفحات منفصلة للجهات ─────────────
   قرار المالك 2026-08-20: صفحة تواصل واحدة تكفي — الزائر يحدد «من هو»
   من النموذج نفسه، وترى الجهات المؤسسية مخطط الأثر المتوقع ولماذا نحن
   داخل الصفحة نفسها بدل صفحات تسويقية شبه فارغة. */

const ENTITIES = [
  { id: 'individual', label: 'فرد' },
  { id: 'company', label: 'شركة أو قطاع خاص' },
  { id: 'gov', label: 'جهة حكومية' },
  { id: 'edu', label: 'جهة تعليمية أو تدريبية' },
  { id: 'nonprofit', label: 'منظمة غير ربحية' },
] as const
type EntityId = (typeof ENTITIES)[number]['id']

const TOPICS = [
  'استفسار عن مسار أو تشخيص',
  'عرض تدريبي لجهة',
  'شراكة أو تكامل',
  'طلب استرداد',
  'الانضمام كمدرب',
  'أخرى',
]

/* مخطط الأثر — رحلة الجهة معنا في أربع خطوات (حقائق عن المنهج لا وعود) */
const IMPACT_STEPS = [
  { icon: ScanSearch, t: 'نشخّص أولا', d: 'فجوات فريقك تُقاس قبل أي التحاق — لا تخمين' },
  { icon: Route, t: 'مسار واحد مفسّر', d: 'شُعب ومسارات تُخصَّص لهوية جهتك وأهدافها' },
  { icon: FileCheck, t: 'مخرج عملي موثق', d: 'كل متدرب ينتهي بمخرج يُراجَع ويُقيَّم بشريا' },
  { icon: BarChart3, t: 'تقرير إنجاز للجهة', d: 'من أكمل، وماذا أنجز، وأين تبقى الفجوات' },
]

/* نقطة سياقية واحدة صادقة لكل نوع جهة — من واقع الصفحات المؤسسية السابقة */
const ENTITY_NOTE: Partial<Record<EntityId, string>> = {
  company: 'شُعب خاصة بشركتك بمدربين متخصصين، ومخرجات تراها في عمل الموظف لا في شهادة فقط.',
  gov: 'مسارات مصممة لواقع العمل الحكومي — خدمة الجمهور، المراسلات، المشتريات — مع تقارير إنجاز رسمية للجهة الراعية.',
  edu: 'برامج تُكمل مقرراتك بمهارات سوق العمل — بشهادات موثقة بمخرجات لا بالحضور.',
  nonprofit: 'نفس منهجية المخرج الموثق — تُخصَّص الشُعب والمجالات لطبيعة عملكم المجتمعي.',
}

const FIELD =
  'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/75 outline-none transition focus:border-teal'
const LABEL = 'mb-1.5 block text-xs font-bold text-muted-foreground'

export default function Contact() {
  const [params] = useSearchParams()
  const initialEntity = ENTITIES.some((e) => e.id === params.get('type'))
    ? (params.get('type') as EntityId)
    : 'individual'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [entity, setEntity] = useState<EntityId>(initialEntity)
  const [org, setOrg] = useState('')
  const [topic, setTopic] = useState(TOPICS[0])
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ref, setRef] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const institutional = entity !== 'individual'

  /* اختيار الجهة يضبط موضوع الطلب تلقائيا — ويعيده للافتراضي عند العودة لفرد */
  useEffect(() => {
    if (institutional && topic === TOPICS[0]) setTopic('عرض تدريبي لجهة')
    if (!institutional && topic === 'عرض تدريبي لجهة') setTopic(TOPICS[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity])

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
  const orgValid = !institutional || org.trim().length >= 2
  const valid = name.trim().length >= 2 && emailValid && orgValid && message.trim().length >= 10 && consent

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!valid) {
      setErr(
        name.trim().length < 2
          ? 'أدخل اسمك الكريم'
          : !emailValid
            ? 'صيغة البريد غير صحيحة — مثال: name@mail.com'
            : !orgValid
              ? 'اذكر اسم جهتك ليصل طلبك للفريق المختص'
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
      else track('contact_submitted', { topic, entity })
    }, 700)
  }

  return (
    <SiteShell>
      <SeoHead
        title="تواصل معنا"
        description="سؤال عن مسار؟ عرض تدريبي لشركتك أو جهتك؟ حدد من تكون في النموذج — فريق أكاديمية وجيز يقرأ كل رسالة بنفسه ويرد خلال يوم عمل."
        path="/contact"
      />

      <div className="grid gap-10 lg:grid-cols-5">
        {/* بيانات التواصل */}
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-black md:text-4xl">تفضّل بالكلام</h1>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            سؤال عن مسار؟ عرض تدريبي لجهتك؟ شراكة؟ فريقنا يقرأ كل رسالة بنفسه ويرد خلال يوم عمل واحد.
          </p>
          <div className="mt-7 space-y-3">
            <Inset className="flex items-center gap-3 px-4 py-3">
              <Mail className="h-4 w-4 shrink-0 text-teal-light-ink" />
              {/* ٢٤ نقطةً ارتفاعا: رابطٌ في سطرٍ وحدَه لا داخلَ جملة (WCAG 2.5.8) */}
              <a href={`mailto:${CONTACT.email}`} dir="ltr" className="inline-flex min-h-6 items-center text-sm font-bold text-teal-light-ink underline-offset-4 hover:underline">
                {CONTACT.email}
              </a>
              <span className="mr-auto text-xs text-muted-foreground">نرد خلال يوم عمل</span>
            </Inset>
            <Inset className="flex items-center gap-3 px-4 py-3">
              <MapPin className="h-4 w-4 shrink-0 text-teal-light-ink" />
              <p className="text-sm text-muted-foreground">{CONTACT.address}</p>
            </Inset>
            <Inset className="flex items-start gap-3 px-4 py-3">
              <Building2 className="mt-1 h-4 w-4 shrink-0 text-gold-ink" />
              <p className="text-xs leading-6 text-muted-foreground">
                <span className="font-bold text-muted-foreground">تتواصل باسم جهة؟ </span>
                حدد نوعها في النموذج — يظهر لك ما يهم جهتك فورا، ويصل طلبك لفريق الحلول المؤسسية مباشرة.
              </p>
            </Inset>
          </div>
          <p className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs leading-6 text-muted-foreground">
            إن كان سؤالك «أي مسار يناسبني؟» — فأصدق إجابة يعطيها لك{' '}
            <Link to="/diagnostic" className="font-semibold text-teal-light-ink underline-offset-4 hover:underline">التشخيص الذكي</Link>
            {' '}في دقائق، مجانا ودون التزام.
          </p>
        </div>

        {/* النموذج */}
        <div className="lg:col-span-3">
          {ref ? (
            <Panel tone="accent" className="flex h-full flex-col items-center justify-center p-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal/15">
                <CheckCircle2 className="h-7 w-7 text-teal-light-ink" />
              </span>
              <h2 className="mt-5 text-2xl font-black">وصلت رسالتك</h2>
              <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
                رقمك المرجعي <span dir="ltr" className="font-bold text-teal-light-ink">{ref}</span> — احتفظ به لأي متابعة.
                سيرد عليك فريقنا خلال يوم عمل واحد.
              </p>
              <Link to="/" className="mt-6 text-sm font-semibold text-teal-light-ink underline-offset-4 hover:underline">
                عودة للرئيسية
              </Link>
            </Panel>
          ) : (
            <form onSubmit={submit} noValidate className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <div>
                <span className={LABEL}>تتواصل بصفتك</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="نوع الجهة">
                  {ENTITIES.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      role="radio"
                      aria-checked={entity === e.id}
                      onClick={() => setEntity(e.id)}
                      className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-bold transition ${
                        entity === e.id
                          ? 'border-teal bg-teal/15 text-teal-light-ink'
                          : 'border-white/10 text-muted-foreground hover:border-white/25'
                      }`}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* مخطط الأثر للجهات — يظهر فقط عندما تكون الجهة مؤسسية */}
              {institutional && (
                <Card tone="accent" className="mt-5">
                  <p className="text-xs font-black text-teal-light-ink">كيف يظهر الأثر عند جهتك؟</p>
                  <ol className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {IMPACT_STEPS.map((s, i) => (
                      <Inset as="li" key={s.t} className="relative">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal/15">
                          <s.icon className="h-4 w-4 text-teal-light-ink" />
                        </span>
                        <p className="mt-2 text-fine font-black leading-snug">
                          <span className="text-gold-ink">{i + 1}. </span>{s.t}
                        </p>
                        <p className="mt-1 text-fine leading-4 text-muted-foreground">{s.d}</p>
                      </Inset>
                    ))}
                  </ol>
                  {ENTITY_NOTE[entity] && (
                    <p className="mt-3 border-t border-white/5 pt-3 text-fine leading-5 text-muted-foreground">
                      {ENTITY_NOTE[entity]}
                    </p>
                  )}
                </Card>
              )}

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
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

              {institutional && (
                <div className="mt-4">
                  <label htmlFor="ct-org" className={LABEL}>اسم الجهة</label>
                  <input id="ct-org" name="organization" type="text" required autoComplete="organization" value={org}
                    onChange={(e) => setOrg(e.target.value)} placeholder="مثال: وزارة … / شركة …" className={FIELD} />
                </div>
              )}

              <div className="mt-4">
                <label htmlFor="ct-topic" className={LABEL}>نوع الطلب</label>
                <select id="ct-topic" name="topic" value={topic} onChange={(e) => setTopic(e.target.value)}
                  className={`${FIELD} cursor-pointer [&>option]:bg-surface`}>
                  {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="mt-4">
                <label htmlFor="ct-message" className={LABEL}>رسالتك</label>
                <textarea id="ct-message" name="message" required rows={5} value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={institutional ? 'اذكر عدد المتدربين المتوقع، والمجالات التي تهم جهتك…' : 'اكتب سؤالك أو طلبك بتفصيل يساعدنا نخدمك من أول رد…'}
                  className={`${FIELD} resize-none`} />
              </div>
              <label htmlFor="ct-consent" className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <input id="ct-consent" name="consent" type="checkbox" required checked={consent}
                  onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-teal" />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  أوافق على معالجة بياناتي للرد على طلبي وفق{' '}
                  <Link to="/p/privacy" className="font-bold text-muted-foreground underline underline-offset-4 hover:text-teal-light-ink">سياسة الخصوصية</Link>
                </span>
              </label>
              {err && (
                <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-center text-xs font-semibold text-red-300">
                  {err}
                </p>
              )}
              <button type="submit" disabled={busy || !valid}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold text-sm font-black text-on-gold transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40">
                <Send className="h-4 w-4" />
                {busy ? 'جارٍ الإرسال…' : 'أرسل رسالتك'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* تهدئة للمتردد — التشخيص يجيب عن سؤال المسار دون رسالة */}
      <div className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Compass className="h-3.5 w-3.5" />
        سؤالك «أي مسار يناسبني؟» — التشخيص الذكي يجيب عنه في دقائق دون أن ترسل شيئا
      </div>
    </SiteShell>
  )
}
