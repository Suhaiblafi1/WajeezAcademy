/* ملفُّ المتقدّم — ما يقرؤه المُقابِل قبل أن يجلس معه.

   ═══ العطبُ الذي يعالجه ═══

   كان المتقدّم يحجز مقابلتَه بنفسه (Calendly)، فتصل المُقابِلَ دعوةُ تقويمٍ
   فيها اسمٌ وبريدٌ ورقمُ طلب — لا أكثر. فيفتح المنصّةَ ويبحث عن الطلب
   ويقرؤه على شاشةٍ قبل الاجتماع بدقائق، أو **لا يقرؤه**. وسيرتُه الذاتيّةُ
   خلفَ رابطٍ موقَّعٍ مؤقّت، فمن فتح الدعوةَ على هاتفه لا يصل إليها أصلا.

   وقرارُ صاحب المنصّة (١٢ سبتمبر ٢٠٢٦): يصل الملفُّ **إلى صندوق البريد**
   ساعةَ الحجز — ملفّا مُهيّأً يُقرأ كما هو، ومعه السيرةُ مرفقةً منفصلةً كي
   تُفتح بقارئ PDF لا بمتصفّح.

   ═══ ولماذا ملفّان لا ملفٌّ واحد ═══

   السيرةُ وثيقةُ المتقدّم بخطّه، ودمجُها في ملفّنا يفقدها هيئتَها ويطيل
   توليدَها (ودمجُ PDF في PDF يحتاج مكتبةً ثالثة). فتُرفَق كما رُفعت.

   ═══ وحدودُ ما يُرسَل ═══

   الملفُّ يحمل بياناتِ الطلب كما كتبها صاحبُه — لا تقييما ولا درجاتِ
   مراجعةٍ ولا ملاحظاتٍ داخليّة. ويذهب إلى **أصحاب الأدوار الثلاثة** الذين
   يُشعَرون بالطلب أصلا، لا إلى عنوانٍ عامّ. */

import type { PrismaClient } from '@prisma/client'
import { renderPdf } from './pdf'
import { readDocumentContent } from './storage.service'
import { sendDirectEmail, publicSiteUrl, type DirectMailStatus } from './notification.service'
import { recordAudit } from './audit'
import { fmtDateLong, fmtDateTime, fmtDateWith } from '../../src/application/text/format-ar'
import {
  APPLICANT_STATUS, contactChannelLabel, DELIVERY_MODES, DOMAIN_YEARS, EMPLOYMENT_STATUS,
  labelOf, PERIODS, seasonLabel, TRAINING_YEARS,
} from '../../src/application/trainer/application-options'

/** الأدوارُ التي تُشعَر بطلبات المدرّبين — وهي نفسُها التي يصلها الملفّ */
export const DOSSIER_ROLES = ['super_admin', 'academic_manager', 'operations_manager']

/** نصٌّ يدخل HTML — الاسمُ والنبذةُ يكتبهما المتقدّم، فلا يُصدَّق أنّهما نصّ */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** فقرةٌ تحفظ أسطرَ كاتبها — النبذةُ تُكتب بأسطر، وطيُّها يفقدها معناها */
function para(v: unknown): string {
  return esc(v).replace(/\n/g, '<br>')
}

interface Row { k: string; v: string }

function rows(list: Row[]): string {
  const shown = list.filter((r) => r.v.trim().length > 0)
  if (shown.length === 0) return ''
  return `<table class="rows">${shown.map((r) => `
    <tr><th>${esc(r.k)}</th><td>${r.v}</td></tr>`).join('')}</table>`
}

function section(title: string, body: string): string {
  return body.trim() ? `<section><h2>${esc(title)}</h2>${body}</section>` : ''
}

const join = (parts: (string | null | undefined | false)[], sep = ' · ') =>
  parts.filter((p): p is string => Boolean(p && String(p).trim())).join(sep)

interface Availability {
  days?: unknown
  periods?: unknown
  seasons?: unknown
  hoursPerWeek?: unknown
  startFrom?: unknown
}

interface PreviousCourse {
  title?: unknown
  org?: unknown
  year?: unknown
  learnersCount?: unknown
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

export interface DossierApplication {
  reference: string
  status: string
  fullName: string
  email: string
  phoneCountryCode: string | null
  phone: string | null
  country: string | null
  timezone: string | null
  jobTitle: string | null
  employmentStatus: string | null
  domainYears: string | null
  trainingYears: string | null
  bio: string | null
  linkedinUrl: string | null
  youtubeUrl: string | null
  instagramUrl: string | null
  facebookUrl: string | null
  hasAccreditation: boolean | null
  accreditationDetails: string | null
  targetCountries: string[]
  targetAudiences: string[]
  trainingLanguages: string[]
  deliveryMode: string | null
  motivation: string | null
  previousCourses: unknown
  totalLearners: number | null
  previousOrgs: string | null
  evidenceNotes: string | null
  availability: unknown
  demoConsent: boolean
  contactChannel: string | null
  contactAltEmail: string | null
  teachableOther: string | null
  createdAt: Date
  specialties: { specialty: string }[]
  documents: { kind: string; originalName: string; sizeBytes: number }[]
}

/** أسماءُ أنواع الوثائق كما يراها المتقدّم عند الرفع */
const DOC_LABELS: Record<string, string> = {
  cv: 'السيرة الذاتية',
  evidence: 'ملف أعمال أو نماذج تدريب سابقة',
  certificate: 'شهادات واعتمادات',
  training_video: 'فيديو تدريبي',
  reference_letter: 'خطاب تزكية',
  other: 'مستند آخر',
}

/** يبني صفحةَ الملفّ. مكشوفةٌ للاختبار: تُفحص بلا متصفّحٍ ولا بريد. */
export function buildDossierHtml(
  app: DossierApplication,
  ctx: { scheduledAt: Date; courseTitles: string[] },
): string {
  const availability = (app.availability ?? {}) as Availability
  const previous = (Array.isArray(app.previousCourses) ? app.previousCourses : []) as PreviousCourse[]
  const phone = app.phone ? `${app.phoneCountryCode ?? ''}${app.phone}` : ''

  /* ═══ الموعدُ بتوقيت من؟ ═══

     الخادمُ يعمل بـUTC، فوقتٌ معروضٌ بلا نسبةٍ إلى منطقةٍ يُقرأ خطأً بثلاث
     ساعاتٍ أو أكثر — والمقابلةُ موعدٌ يُحضَر لا رقمٌ يُؤرشف. فيُعرض بتوقيت
     المتقدّم حين تُعرف منطقتُه (وهي تُشتقّ من دولته)، والمنطقةُ تُقال معه
     صراحةً؛ وإن جُهلت قيل إنّه UTC ولم يُترك للظنّ. */
  const when = app.timezone
    ? `${fmtDateWith(ctx.scheduledAt, { dateStyle: 'long', timeStyle: 'short', timeZone: app.timezone })} (بتوقيت ${app.timezone})`
    : `${fmtDateTime(ctx.scheduledAt)} (UTC)`

  const identity = rows([
    { k: 'الاسم الكامل', v: esc(app.fullName) },
    { k: 'البريد', v: `<span dir="ltr">${esc(app.email)}</span>` },
    { k: 'الجوال (واتساب)', v: phone ? `<span dir="ltr">${esc(phone)}</span>` : '' },
    { k: 'دولة الإقامة', v: join([esc(app.country), app.timezone ? `<span dir="ltr">${esc(app.timezone)}</span>` : '']) },
    {
      k: 'وسيلته المفضّلة',
      v: join([
        app.contactChannel ? esc(contactChannelLabel(app.contactChannel)) : '',
        app.contactAltEmail ? `<span dir="ltr">${esc(app.contactAltEmail)}</span>` : '',
      ]),
    },
    { k: 'قدّم طلبه في', v: esc(fmtDateLong(app.createdAt)) },
  ])

  const experience = rows([
    { k: 'عمله اليوم', v: join([esc(app.jobTitle), esc(labelOf(EMPLOYMENT_STATUS, app.employmentStatus))]) },
    {
      k: 'خبرته',
      v: join([
        app.domainYears ? `${esc(labelOf(DOMAIN_YEARS, app.domainYears))} في المجال` : '',
        esc(labelOf(TRAINING_YEARS, app.trainingYears)),
      ]),
    },
    { k: 'تخصصاته', v: esc(app.specialties.map((s) => s.specialty).join(' · ')) },
    {
      k: 'اعتماده',
      v: app.hasAccreditation
        ? esc(app.accreditationDetails || 'أشار إلى اعتماد بلا تفصيل')
        : 'لا اعتماد رسمي — وهو ليس شرطا',
    },
    {
      k: 'حضوره الرقمي',
      v: join([app.linkedinUrl, app.youtubeUrl, app.instagramUrl, app.facebookUrl]
        .filter(Boolean)
        .map((u) => `<span dir="ltr">${esc(u)}</span>`), '<br>'),
    },
  ])

  const teaching = rows([
    {
      k: 'من كتالوجنا',
      v: ctx.courseTitles.length
        ? esc(ctx.courseTitles.join(' · '))
        : (app.teachableOther ? '' : 'لم يختر دورةً من الكتالوج'),
    },
    { k: 'ودوراتٌ بقلمه', v: para(app.teachableOther) },
    { k: 'جمهوره', v: esc(app.targetAudiences.join(' · ')) },
    { k: 'دوله المستهدفة', v: esc(app.targetCountries.join(' · ')) },
    { k: 'لغات تدريبه', v: esc(app.trainingLanguages.join(' · ')) },
    { k: 'نمط التدريب', v: esc(labelOf(DELIVERY_MODES, app.deliveryMode)) },
  ])

  const availabilityRows = rows([
    { k: 'أيامه', v: esc(strings(availability.days).join(' · ')) },
    { k: 'وقته من اليوم', v: esc(strings(availability.periods).map((p) => labelOf(PERIODS, p)).join(' و')) },
    {
      k: 'ساعات أسبوعيا',
      v: typeof availability.hoursPerWeek === 'number' ? `<span dir="ltr">${availability.hoursPerWeek}</span>` : '',
    },
    { k: 'يبدأ من', v: typeof availability.startFrom === 'string' ? esc(fmtDateLong(availability.startFrom)) : '' },
    { k: 'مواسمه', v: esc(strings(availability.seasons).map(seasonLabel).join(' · ')) },
    { k: 'الدرس التجريبي', v: app.demoConsent ? 'وافق على تقديم درس تجريبي قصير' : 'لم يوافق على درس تجريبي' },
  ])

  const evidence = rows([
    { k: 'دورات سابقة', v: previous.map((c) => esc(join([String(c.title ?? ''), String(c.org ?? ''), c.year ? String(c.year) : '', c.learnersCount ? `${c.learnersCount} متدربا` : ''], ' — '))).filter(Boolean).join('<br>') },
    { k: 'إجمالي من درّبهم', v: typeof app.totalLearners === 'number' ? `<span dir="ltr">${app.totalLearners}</span>` : '' },
    { k: 'جهاتٌ درّب لديها', v: para(app.previousOrgs) },
    { k: 'ملاحظاته على أدلّته', v: para(app.evidenceNotes) },
    {
      k: 'ما رفعه',
      v: app.documents.length
        ? app.documents.map((d) => `${esc(DOC_LABELS[d.kind] ?? d.kind)} — <span dir="ltr">${esc(d.originalName)}</span>`).join('<br>')
        : 'لم يرفع مستندا',
    },
  ])

  /* الخطُّ من النظام لا من الشبكة: الصفحةُ تُطبع في حاويةٍ بلا إنترنت، وخطٌّ
     يُنتظر من CDN يعني ملفّا يخرج بخطٍّ احتياطيٍّ بعد مهلة. وحزمةُ
     `font-noto-arabic` في الصورة هي ما يصيّر العربيّة. */
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>ملف المتقدّم ${esc(app.reference)}</title>
<style>
  @page { size: A4; }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: #162220; background: #fff;
    font-family: "Noto Naskh Arabic", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif;
    font-size: 11.5pt; line-height: 1.85;
  }
  header { border-bottom: 3px solid #1F6E77; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { color: #1F6E77; font-weight: 800; font-size: 13pt; letter-spacing: .2px; }
  h1 { font-size: 18pt; margin: 6px 0 2px; }
  .lede { color: #4A5A57; font-size: 10.5pt; margin: 0; }
  .meta { margin-top: 10px; background: #F1F6F6; border-right: 4px solid #1F6E77; padding: 9px 12px; font-size: 10.5pt; }
  .meta b { color: #12343B; }
  section { margin-top: 15px; break-inside: avoid; }
  h2 {
    font-size: 12pt; color: #12343B; margin: 0 0 6px;
    border-bottom: 1px solid #E4E7E4; padding-bottom: 4px;
  }
  table.rows { width: 100%; border-collapse: collapse; }
  table.rows th {
    width: 27%; text-align: right; vertical-align: top; color: #4A5A57;
    font-weight: 700; padding: 3.5px 0 3.5px 10px; white-space: nowrap;
  }
  table.rows td { vertical-align: top; padding: 3.5px 0; }
  .prose { white-space: normal; margin: 0; }
  .quote { background: #FAFAF8; border: 1px solid #E4E7E4; border-radius: 6px; padding: 8px 11px; }
  footer {
    margin-top: 22px; border-top: 1px solid #E4E7E4; padding-top: 8px;
    color: #4A5A57; font-size: 9.5pt;
  }
</style></head><body>
<header>
  <div class="brand">أكاديمية وجيز</div>
  <h1>ملفُّ متقدّمٍ للتدريب — ${esc(app.fullName)}</h1>
  <p class="lede">أعدّته المنصّة تلقائيّا حين حجز المتقدّمُ مقابلته. سرّيّ — للجنة المراجعة.</p>
  <div class="meta">
    المقابلة: <b>${esc(when)}</b>
    · رقم الطلب: <b dir="ltr">${esc(app.reference)}</b>
    · حالته: <b>${esc(APPLICANT_STATUS[app.status]?.label ?? app.status)}</b>
  </div>
</header>
${section('من هو، وكيف نصل إليه', identity)}
${section('خبرته واعتماده', experience)}
${app.bio ? section('نبذته بقلمه', `<p class="prose quote">${para(app.bio)}</p>`) : ''}
${section('ما يستطيع تدريسه', teaching)}
${section('توفّره', availabilityRows)}
${section('أدلّته وما سبق له', evidence)}
${app.motivation ? section('لماذا وجيز — بقلمه', `<p class="prose quote">${para(app.motivation)}</p>`) : ''}
<footer>
  السيرةُ الذاتيّةُ مرفقةٌ بهذه الرسالة ملفًّا منفصلا إن رفعها.
  ولتفاصيل الطلب كلِّها وسجلِّ حالاته: ${esc(publicSiteUrl())}/admin/trainer-applications
</footer>
</body></html>`
}

/** ما يُنتجه البناء: الملفّان وسببُ غياب ما غاب */
export interface DossierResult {
  status: DirectMailStatus | 'no_recipients' | 'not_found'
  pdfError?: string
  recipients?: number
}

/* ═══ الإرسالُ لا يُعيق ═══

   يُنادى من webhook الـCalendly بعد أن تُسجَّل المقابلة. وفشلُه — متصفّحٌ
   غائب، بريدٌ غيرُ مفعّل، مستلمٌ بلا عنوان — **لا يُسقط الحجز**: المقابلةُ
   مكتوبةٌ في القاعدة، والملفُّ رفاهيةٌ تُسجَّل في الأثر إن تعذّرت.
   والمنادي يبتلع الرمي؛ وهنا لا يُرمى أصلا. */
export async function sendInterviewDossier(
  prisma: PrismaClient,
  applicationId: string,
  scheduledAt: Date,
): Promise<DossierResult> {
  const app = await prisma.trainerApplication.findUnique({
    where: { id: applicationId },
    include: {
      specialties: { select: { specialty: true } },
      documents: { select: { kind: true, originalName: true, sizeBytes: true, storageKey: true, mime: true } },
    },
  })
  if (!app) return { status: 'not_found' }

  const staff = await prisma.user.findMany({
    where: { status: 'active', roles: { some: { roleId: { in: DOSSIER_ROLES } } } },
    select: { email: true },
  })
  const recipients = [...new Set(staff.map((u) => u.email).filter((e): e is string => Boolean(e)))]
  if (recipients.length === 0) return { status: 'no_recipients' }

  /* عنوانُ الدورة في آخر نسخةٍ منها لا في الدورة نفسِها: `Course` معرِّفٌ
     وحالةٌ وسعر، والعنوانُ العربيُّ في `CourseVersion`. ومعرِّفٌ بلا نسخةٍ
     يُعرض كما هو — أفضلُ من سطرٍ يختفي. */
  const courses = app.teachableCourseIds.length
    ? await prisma.course.findMany({
      where: { id: { in: app.teachableCourseIds } },
      select: { id: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } },
    })
    : []

  const html = buildDossierHtml(app as unknown as DossierApplication, {
    scheduledAt,
    courseTitles: courses.map((c) => c.versions[0]?.titleAr || c.id),
  })
  const { pdf, error: pdfError } = await renderPdf(html)

  /* السيرةُ مرفقةٌ منفصلةً — وهي الوثيقةُ التي يطلبها المُقابِل أوّلا */
  const cv = app.documents.find((d) => d.kind === 'cv')
  const cvBytes = cv ? await readDocumentContent(prisma, cv.storageKey) : null

  const when = app.timezone
    ? `${fmtDateWith(scheduledAt, { dateStyle: 'long', timeStyle: 'short', timeZone: app.timezone })} (بتوقيت ${app.timezone})`
    : `${fmtDateTime(scheduledAt)} (UTC)`
  const text = [
    `حجز ${app.fullName} مقابلتَه عبر Calendly.`,
    ``,
    `الموعد: ${when}`,
    `رقم الطلب: ${app.reference}`,
    `البريد: ${app.email}`,
    app.phone ? `الجوال: ${app.phoneCountryCode ?? ''}${app.phone}` : '',
    ``,
    pdf ? 'ملفُّ الطلب مرفقٌ بهذه الرسالة (PDF).' : `تعذّر إرفاق ملفّ الطلب — ${pdfError ?? 'سببٌ غيرُ معروف'}. وتفاصيلُه في شاشة «طلبات المدربين».`,
    cvBytes ? `وسيرتُه الذاتيّةُ مرفقةٌ ملفًّا منفصلا: ${cv?.originalName}` : 'ولم يرفع سيرةً ذاتيّة.',
    ``,
    `${publicSiteUrl()}/admin/trainer-applications`,
  ].filter((l) => l !== undefined).join('\n')

  const attachments = [
    ...(pdf ? [{ filename: `${app.reference}-ملف-المتقدم.pdf`, content: pdf, contentType: 'application/pdf' }] : []),
    ...(cvBytes && cv
      ? [{ filename: `${app.reference}-${cv.originalName}`, content: cvBytes, contentType: cv.mime || 'application/octet-stream' }]
      : []),
  ]

  const sent = await sendDirectEmail(prisma, {
    to: recipients.join(', '),
    subject: `مقابلةٌ محجوزة: ${app.fullName} — ${app.reference}`,
    text,
    attachments,
  })

  await recordAudit(prisma, {
    actorId: null,
    action: 'trainer.interview.dossier_sent',
    entityType: 'trainer_application',
    entityId: app.id,
    meta: {
      delivery: sent.status,
      recipients: recipients.length,
      withPdf: Boolean(pdf),
      withCv: Boolean(cvBytes),
      ...(pdfError ? { pdfError } : {}),
      ...(sent.error ? { mailError: sent.error } : {}),
    },
  })

  return { status: sent.status, recipients: recipients.length, ...(pdfError ? { pdfError } : {}) }
}
