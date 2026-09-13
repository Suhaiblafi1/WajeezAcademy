/* ملفّ المتقدّم كاملا — كلُّ ما ملأه، لا نصفُه.

   كان المراجع يقرّر على جزءٍ من الطلب: الشاشةُ تعرض الاسمَ والمسمّى
   والدولةَ والنبذةَ والدافعَ ولينكدإن — وتُخفي الهاتفَ وحالتَه المهنيّة
   وخبرةَ التدريب و**الدورات التي يستطيع تدريسها** وتوفّرَه وموافقتَه على
   الدرس التجريبيّ ولغاتِ تدريبه ونمطَه. والخادمُ يُرسلها كلَّها؛ الشاشةُ
   وحدها كانت تُسقطها.

   وأخطرُها الدوراتُ التي يستطيع تدريسها: هي جوابُ سؤالٍ أعدنا تصميم
   النموذج كلَّه لأجله («ما الدورات التي تستطيع تقديمها؟»)، وعليها يُسنَد
   المدرّب إلى شعبةٍ بعد الاعتماد. فمن يقرّر بلا رؤيتها يقرّر بلا أهمّ
   ما في الطلب.

   والترتيب هنا ترتيبُ القراءة لا ترتيبُ التخزين: من هو، ثمّ ماذا يُتقن،
   ثمّ ما يُثبته، ثمّ متى يستطيع. */

import type { ReactNode } from 'react'
import { BookOpen } from 'lucide-react'
import { courseById } from '@/data/courses'
import { contactChannelLabel, seasonLabel, yearsLabel } from '@/application/trainer/application-options'
import { Card } from '@/components/ui/Surface'

/** حقولٌ يُرسلها الخادم ولم تكن الشاشة تقرؤها */
export interface Dossier extends Record<string, unknown> {
  fullName: string
  /** اختياريٌّ منذ صارت الصفحةُ المشتركةُ تعرض الملفَّ بلا بريدٍ ولا هاتف */
  email?: string
  phoneCountryCode?: string | null
  phone?: string | null
  country?: string | null
  timezone?: string | null
  employmentStatus?: string | null
  jobTitle?: string | null
  domainYears?: string | null
  trainingYears?: string | null
  bio?: string | null
  motivation?: string | null
  linkedinUrl?: string | null
  youtubeUrl?: string | null
  instagramUrl?: string | null
  facebookUrl?: string | null
  hasAccreditation?: boolean | null
  accreditationDetails?: string | null
  targetCountries?: string[]
  targetAudiences?: string[]
  trainingLanguages?: string[]
  deliveryMode?: string | null
  teachableCourseIds?: string[]
  teachableOther?: string | null
  availability?: { days?: string[]; hoursPerWeek?: number; startFrom?: string; periods?: string[]; seasons?: string[] } | null
  demoConsent?: boolean
  contactChannel?: string | null
  contactAltEmail?: string | null
  userId?: string | null
  specialties?: { specialty: string }[]
  emailVerifiedAt?: string | null
  privacyConsentAt?: string | null
}

const EMPLOYMENT_AR: Record<string, string> = {
  employed: 'موظّف',
  own_business: 'صاحب عمل',
  full_time_training: 'متفرّغ للتدريب',
}
const DELIVERY_AR: Record<string, string> = {
  remote: 'عن بُعد',
  in_person: 'حضوريّ',
  both: 'كلاهما',
}
const PERIOD_AR: Record<string, string> = { morning: 'صباحا', evening: 'مساء' }

const years = yearsLabel

/* ─────────── صفٌّ في قائمة تعريف ───────────

   ═══ لماذا ذهبت الأيقونات ═══

   كان كلُّ صفٍّ أيقونةً ٣.٥px ثمّ تسميةً فوق قيمةٍ في عمود. فاجتمع في الكتلة
   الواحدة ستُّ أيقوناتٍ لا تفرّق شيئا (البريدُ والتواصلُ المفضَّلُ أيقونتُهما
   واحدة)، وسطرانِ لكلّ حقلٍ يضاعفان طولَ الكتلة. والعينُ تمسح عمودَ تسمياتٍ
   مستقيما أسرعَ ممّا تمسح سلّما متعرّجا — وهو ما تفعله لوحاتُ التوظيف التي
   نُظر فيها (Pin وRemote وDeputy): تسميةٌ هادئةٌ يمينا، وقيمةٌ يسارَها، وخطٌّ
   شعريٌّ يفصل. فصارت `dl` حقّةً لا شبكةَ `div`ات: هي قائمةُ تعريفٍ معنًى، ومن
   يقرأ بأذنه يسمعها كذلك. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] items-baseline gap-x-3 border-b border-white/[0.06] pb-2 last:border-0 last:pb-0">
      <dt className="text-read font-bold leading-6 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-xs leading-6 text-foreground">{children}</dd>
    </div>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="section" className="bg-paper/20">
      <h4 className="mb-3 text-fine font-black text-teal-light-ink">{title}</h4>
      <dl className="space-y-2">{children}</dl>
    </Card>
  )
}

const has = (a?: string[] | null) => Array.isArray(a) && a.length > 0

/* ═══ ولماذا يُقال «محجوب» ولا تُطوى الصفوف ═══

   الصفحةُ المشتركةُ لا يصلها بريدٌ ولا هاتف. ولو حُذفت صفوفُها لقرأ القارئُ
   «الجوال: — لم يذكره» — وهي **كذبةٌ**: ذكره المتقدّمُ ونحن الذين حجبناه.
   ومن قرأها ظنّ الطلبَ ناقصا فحسبها عليه في تقييمه.

   فيُقال ما وقع: محجوبٌ عن الرابط المشترك، وموضعُه الأدمن. */
export default function ApplicationDossier({ a, showContact = true }: { a: Dossier; showContact?: boolean }) {
  const av = a.availability ?? null
  const teachable = a.teachableCourseIds ?? []
  const phone = a.phone ? `${a.phoneCountryCode ?? ''}${a.phone}` : null

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Block title="من هو">
        {showContact ? (
          <>
            <Row label="البريد">
              <span dir="ltr" className="block text-right">{a.email}</span>
              {a.emailVerifiedAt ? (
                <span className="text-fine text-teal-light-ink">متحقَّق ✓</span>
              ) : (
                <span className="text-fine text-gold-ink">غير متحقَّق</span>
              )}
            </Row>
            <Row label="الجوال (واتساب)">
              {phone ? <span dir="ltr" className="block text-right">{phone}</span> : '— لم يذكره'}
            </Row>
            {/* كيف طلب أن نتواصل معه — قبل أن يُتَّصل بمن لا يجيب المجهول */}
            <Row label="يفضّل التواصل عبر">
              {a.contactChannel ? (
                <>
                  <span className="font-bold text-teal-light-ink">{contactChannelLabel(a.contactChannel)}</span>
                  {a.contactChannel === 'other_email' && a.contactAltEmail && (
                    <span dir="ltr" className="block text-right text-muted-foreground">{a.contactAltEmail}</span>
                  )}
                  {(a.contactChannel === 'phone' || a.contactChannel === 'whatsapp') && phone && (
                    <span dir="ltr" className="block text-right text-muted-foreground">{phone}</span>
                  )}
                </>
              ) : '— لم يختر (طلبٌ قديم)'}
            </Row>
            <Row label="حسابه على المنصّة">
              {a.userId ? <span className="text-teal-light-ink">له حساب — يتابع حالته بنفسه</span> : 'بلا حساب'}
            </Row>
          </>
        ) : (
          <Row label="التواصل معه">
            <span className="text-muted-foreground">
              محجوبٌ عن الرابط المشترك — بريدُه وهاتفُه في ملفّه داخل الإدارة.
            </span>
            {a.emailVerifiedAt && (
              <span className="block text-fine text-teal-light-ink">بريدُه متحقَّق ✓</span>
            )}
          </Row>
        )}
        <Row label="الإقامة والتوقيت">
          {a.country ?? '—'}{a.timezone ? ` · ${a.timezone}` : ''}
        </Row>
        <Row label="حالته المهنيّة">
          {a.employmentStatus ? EMPLOYMENT_AR[a.employmentStatus] ?? a.employmentStatus : '—'}
          {a.jobTitle ? ` · ${a.jobTitle}` : ''}
        </Row>
      </Block>

      <Block title="خبرته">
        <Row label="خبرة المجال">{years(a.domainYears)}</Row>
        <Row label="خبرة التدريب تحديدا">{years(a.trainingYears)}</Row>
        <Row label="اعتماد رسميّ">
          {a.hasAccreditation
            ? (a.accreditationDetails || 'قال إنّ لديه اعتمادا ولم يذكر الجهة')
            : 'لا اعتماد'}
        </Row>
        {has(a.specialties?.map((s) => s.specialty)) && (
          <Row label="تخصّصاته">
            <span className="flex flex-wrap gap-1.5">
              {a.specialties!.map((s) => (
                <span key={s.specialty} className="rounded-full border border-white/12 px-2 py-0.5 text-fine">{s.specialty}</span>
              ))}
            </span>
          </Row>
        )}
      </Block>

      {/* أهمُّ ما في الطلب: على هذا يُسنَد إلى شعبة بعد الاعتماد */}
      <Block title="ما يستطيع تدريسه — وعليه يُسنَد بعد الاعتماد">
        {teachable.length === 0 && !a.teachableOther ? (
          <p className="text-read text-muted-foreground">لم يختر شيئا من الكتالوج ولم يكتب بديلا.</p>
        ) : (
          <>
            {teachable.length > 0 && (
              <ul className="space-y-1.5">
                {teachable.map((id) => (
                  <li key={id} className="flex items-start gap-2 text-read leading-6">
                    <BookOpen className="mt-1 h-3 w-3 shrink-0 text-teal-ink" />
                    <span className="min-w-0">{courseById(id)?.name ?? id}</span>
                  </li>
                ))}
              </ul>
            )}
            {a.teachableOther && (
              <Row label="ودوراتٌ ليست في كتالوجنا">
                <span className="whitespace-pre-line">{a.teachableOther}</span>
              </Row>
            )}
          </>
        )}
      </Block>

      <Block title="متى وكيف يُدرّب">
        <Row label="لغات التدريب">
          {has(a.trainingLanguages) ? a.trainingLanguages!.join(' · ') : '—'}
        </Row>
        <Row label="نمط التدريب">
          {a.deliveryMode ? DELIVERY_AR[a.deliveryMode] ?? a.deliveryMode : '—'}
        </Row>
        <Row label="توفّره">
          {av?.hoursPerWeek ? `${av.hoursPerWeek} ساعة أسبوعيا` : '— لم يحدّد ساعاته'}
          {av?.startFrom ? ` · يبدأ من ${av.startFrom}` : ''}
          {has(av?.days) && <span className="mt-1 block text-muted-foreground">{av!.days!.join(' · ')}</span>}
          {has(av?.periods) && (
            <span className="mt-0.5 block text-muted-foreground">
              {av!.periods!.map((p) => PERIOD_AR[p] ?? p).join(' و')}
            </span>
          )}
          {has(av?.seasons) && (
            <span className="mt-1 flex flex-wrap gap-1.5">
              {av!.seasons!.map((s) => (
                <span key={s} className="rounded-full border border-gold/30 bg-gold/[0.06] px-2 py-0.5 text-fine text-gold-ink">{seasonLabel(s)}</span>
              ))}
            </span>
          )}
        </Row>
        <Row label="الدرس التجريبيّ والمقابلة">
          {a.demoConsent
            ? <span className="text-teal-light-ink">وافق عليهما</span>
            : <span className="text-gold-ink">لم يوافق — وهو شرطُ الاعتماد</span>}
        </Row>
      </Block>

      {(has(a.targetCountries) || has(a.targetAudiences)) && (
        <Block title="من يستهدف">
          {has(a.targetCountries) && <Row label="الدول">{a.targetCountries!.join(' · ')}</Row>}
          {has(a.targetAudiences) && <Row label="الفئات">{a.targetAudiences!.join(' · ')}</Row>}
        </Block>
      )}

      {(a.linkedinUrl || a.youtubeUrl || a.instagramUrl || a.facebookUrl) && (
        <Block title="أدلّته على الشبكة">
          {a.linkedinUrl && (
            <Row label="لينكدإن أو ملفّ أعمال">
              <a href={a.linkedinUrl} target="_blank" rel="noreferrer nofollow" dir="ltr"
                className="block break-all text-right text-teal-light-ink underline decoration-dotted underline-offset-4">
                {a.linkedinUrl}
              </a>
            </Row>
          )}
          {a.youtubeUrl && (
            <Row label="فيديو أو قناة">
              <a href={a.youtubeUrl} target="_blank" rel="noreferrer nofollow" dir="ltr"
                className="block break-all text-right text-teal-light-ink underline decoration-dotted underline-offset-4">
                {a.youtubeUrl}
              </a>
            </Row>
          )}
          {a.instagramUrl && (
            <Row label="إنستغرام">
              <a href={a.instagramUrl} target="_blank" rel="noreferrer nofollow" dir="ltr"
                className="block break-all text-right text-teal-light-ink underline decoration-dotted underline-offset-4">
                {a.instagramUrl}
              </a>
            </Row>
          )}
          {a.facebookUrl && (
            <Row label="فيسبوك">
              <a href={a.facebookUrl} target="_blank" rel="noreferrer nofollow" dir="ltr"
                className="block break-all text-right text-teal-light-ink underline decoration-dotted underline-offset-4">
                {a.facebookUrl}
              </a>
            </Row>
          )}
        </Block>
      )}
    </div>
  )
}
