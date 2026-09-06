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
import { Award, BadgeCheck, BookOpen, Clock, Globe, Languages, Link2, Mail, Phone, Sparkles, UserRound } from 'lucide-react'
import { courseById } from '@/data/courses'
import { contactChannelLabel, seasonLabel } from '@/application/trainer/application-options'

/** حقولٌ يُرسلها الخادم ولم تكن الشاشة تقرؤها */
export interface Dossier extends Record<string, unknown> {
  fullName: string
  email: string
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
const YEARS_AR: Record<string, string> = {
  '1-3': '١–٣ سنوات', '4-7': '٤–٧ سنوات', '8-12': '٨–١٢ سنة', '12+': 'أكثر من ١٢ سنة',
  none: 'لا خبرة تدريب', under_1: 'أقلّ من سنة', '1_3': '١–٣ سنوات', '3_5': '٣–٥ سنوات',
  '5_10': '٥–١٠ سنوات', '10_plus': 'أكثر من ١٠ سنوات',
}
const PERIOD_AR: Record<string, string> = { morning: 'صباحا', evening: 'مساء' }

const years = (v?: string | null) => (v ? YEARS_AR[v] ?? v : '—')

function Row({ icon: Icon, label, children }: { icon: typeof UserRound; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      <div className="min-w-0">
        <p className="text-micro font-bold text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-xs leading-6 text-foreground">{children}</div>
      </div>
    </div>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-paper/20 p-4">
      <h4 className="mb-3 text-[11px] font-black text-teal-light-ink">{title}</h4>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

const has = (a?: string[] | null) => Array.isArray(a) && a.length > 0

export default function ApplicationDossier({ a }: { a: Dossier }) {
  const av = a.availability ?? null
  const teachable = a.teachableCourseIds ?? []
  const phone = a.phone ? `${a.phoneCountryCode ?? ''}${a.phone}` : null

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Block title="من هو">
        <Row icon={Mail} label="البريد">
          <span dir="ltr" className="block text-right">{a.email}</span>
          {a.emailVerifiedAt ? (
            <span className="text-micro text-teal-light-ink">متحقَّق ✓</span>
          ) : (
            <span className="text-micro text-gold-ink">غير متحقَّق</span>
          )}
        </Row>
        <Row icon={Phone} label="الجوال (واتساب)">
          {phone ? <span dir="ltr" className="block text-right">{phone}</span> : '— لم يذكره'}
        </Row>
        {/* كيف طلب أن نتواصل معه — قبل أن يُتَّصل بمن لا يجيب المجهول */}
        <Row icon={Mail} label="يفضّل التواصل عبر">
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
        <Row icon={UserRound} label="حسابه على المنصّة">
          {a.userId ? <span className="text-teal-light-ink">له حساب — يتابع حالته بنفسه</span> : 'بلا حساب'}
        </Row>
        <Row icon={Globe} label="الإقامة والتوقيت">
          {a.country ?? '—'}{a.timezone ? ` · ${a.timezone}` : ''}
        </Row>
        <Row icon={UserRound} label="حالته المهنيّة">
          {a.employmentStatus ? EMPLOYMENT_AR[a.employmentStatus] ?? a.employmentStatus : '—'}
          {a.jobTitle ? ` · ${a.jobTitle}` : ''}
        </Row>
      </Block>

      <Block title="خبرته">
        <Row icon={Award} label="خبرة المجال">{years(a.domainYears)}</Row>
        <Row icon={Sparkles} label="خبرة التدريب تحديدا">{years(a.trainingYears)}</Row>
        <Row icon={BadgeCheck} label="اعتماد رسميّ">
          {a.hasAccreditation
            ? (a.accreditationDetails || 'قال إنّ لديه اعتمادا ولم يذكر الجهة')
            : 'لا اعتماد'}
        </Row>
        {has(a.specialties?.map((s) => s.specialty)) && (
          <Row icon={BookOpen} label="تخصّصاته">
            <span className="flex flex-wrap gap-1.5">
              {a.specialties!.map((s) => (
                <span key={s.specialty} className="rounded-full border border-white/12 px-2 py-0.5 text-micro">{s.specialty}</span>
              ))}
            </span>
          </Row>
        )}
      </Block>

      {/* أهمُّ ما في الطلب: على هذا يُسنَد إلى شعبة بعد الاعتماد */}
      <Block title="ما يستطيع تدريسه — وعليه يُسنَد بعد الاعتماد">
        {teachable.length === 0 && !a.teachableOther ? (
          <p className="text-xs text-muted-foreground">لم يختر شيئا من الكتالوج ولم يكتب بديلا.</p>
        ) : (
          <>
            {teachable.length > 0 && (
              <ul className="space-y-1.5">
                {teachable.map((id) => (
                  <li key={id} className="flex items-start gap-2 text-xs leading-6">
                    <BookOpen className="mt-1 h-3 w-3 shrink-0 text-teal-ink" />
                    <span className="min-w-0">{courseById(id)?.name ?? id}</span>
                  </li>
                ))}
              </ul>
            )}
            {a.teachableOther && (
              <Row icon={Sparkles} label="ودوراتٌ ليست في كتالوجنا">
                <span className="whitespace-pre-line">{a.teachableOther}</span>
              </Row>
            )}
          </>
        )}
      </Block>

      <Block title="متى وكيف يُدرّب">
        <Row icon={Languages} label="لغات التدريب">
          {has(a.trainingLanguages) ? a.trainingLanguages!.join(' · ') : '—'}
        </Row>
        <Row icon={Globe} label="نمط التدريب">
          {a.deliveryMode ? DELIVERY_AR[a.deliveryMode] ?? a.deliveryMode : '—'}
        </Row>
        <Row icon={Clock} label="توفّره">
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
                <span key={s} className="rounded-full border border-gold/30 bg-gold/[0.06] px-2 py-0.5 text-micro text-gold-ink">{seasonLabel(s)}</span>
              ))}
            </span>
          )}
        </Row>
        <Row icon={BadgeCheck} label="الدرس التجريبيّ والمقابلة">
          {a.demoConsent
            ? <span className="text-teal-light-ink">وافق عليهما</span>
            : <span className="text-gold-ink">لم يوافق — وهو شرطُ الاعتماد</span>}
        </Row>
      </Block>

      {(has(a.targetCountries) || has(a.targetAudiences)) && (
        <Block title="من يستهدف">
          {has(a.targetCountries) && <Row icon={Globe} label="الدول">{a.targetCountries!.join(' · ')}</Row>}
          {has(a.targetAudiences) && <Row icon={UserRound} label="الفئات">{a.targetAudiences!.join(' · ')}</Row>}
        </Block>
      )}

      {(a.linkedinUrl || a.youtubeUrl || a.instagramUrl) && (
        <Block title="أدلّته على الشبكة">
          {a.linkedinUrl && (
            <Row icon={Link2} label="لينكدإن أو ملفّ أعمال">
              <a href={a.linkedinUrl} target="_blank" rel="noreferrer nofollow" dir="ltr"
                className="block break-all text-right text-teal-light-ink underline decoration-dotted underline-offset-4">
                {a.linkedinUrl}
              </a>
            </Row>
          )}
          {a.youtubeUrl && (
            <Row icon={Link2} label="فيديو أو قناة">
              <a href={a.youtubeUrl} target="_blank" rel="noreferrer nofollow" dir="ltr"
                className="block break-all text-right text-teal-light-ink underline decoration-dotted underline-offset-4">
                {a.youtubeUrl}
              </a>
            </Row>
          )}
          {a.instagramUrl && (
            <Row icon={Link2} label="إنستغرام">
              <a href={a.instagramUrl} target="_blank" rel="noreferrer nofollow" dir="ltr"
                className="block break-all text-right text-teal-light-ink underline decoration-dotted underline-offset-4">
                {a.instagramUrl}
              </a>
            </Row>
          )}
        </Block>
      )}
    </div>
  )
}
