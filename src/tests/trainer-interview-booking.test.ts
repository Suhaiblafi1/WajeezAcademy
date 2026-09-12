/* حجزُ مقابلة المدرّب — حارسُ ما يسهل كسرُه بلا أن يفشل شيء.

   المقابلةُ تجري خارج المنصّة، فالرابطُ هو كلُّ ما بين المتقدّم وبين موعده.
   ولو تعطّل — رابطٌ خطأ، أو بطاقةٌ تُعرض بعد الرفض، أو حالةٌ نُسيت — لم يسقط
   اختبارٌ ولم تظهر شاشةُ خطأ: يقف المتقدّمُ ينتظر مكالمةً لن تأتي، وهو بالضبط
   العطبُ الذي وُضع هذا الرابطُ ليزيله. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  APPLICANT_STATUS, BOOKABLE_STATUSES, TRAINER_INTERVIEW, trainerInterviewUrl,
} from '@/application/trainer/application-options'
import { verifyCalendlyWebhookSignature } from '../../server/services/calendly-webhook.service'
import { createHmac } from 'node:crypto'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

/* الشيفرةُ بلا تعليقاتها.

   وهذا لازمٌ لا تجميل: حارسٌ يقول «لا `assets.calendly.com` في الملفّ» يسقط
   على **تعليقٍ يشرح لماذا لا يُحمَّل** — فيُقاس ورودُ حرفٍ لا بنيةُ الشيفرة،
   وهو العطبُ الذي مرّ في هذا المستودَع ثلاث مرّات. */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('رابطُ الحجز', () => {
  it('https وإلى Calendly — ولا يُترك فارغا', () => {
    expect(TRAINER_INTERVIEW.url).toMatch(/^https:\/\/calendly\.com\/.+/)
  })

  it('ومدّتُه ومنصّتُه معلنتان، فتُقرآن في الشاشة لا تُخمَّنان', () => {
    expect(TRAINER_INTERVIEW.minutes).toBe(45)
    expect(TRAINER_INTERVIEW.platformAr).toBe('اجتماع مرئي')
  })

  it('ويُعبَّأ بالاسم والبريد ورقم الطلب — فلا يكتبها ثالثةً', () => {
    const url = trainerInterviewUrl({ name: 'سلمى العمري', email: 's@x.com', reference: 'WJ-TR-2026-00041' })
    const q = new URL(url).searchParams
    expect(q.get('name')).toBe('سلمى العمري')
    expect(q.get('email')).toBe('s@x.com')
    expect(q.get('a1')).toBe('WJ-TR-2026-00041')
    expect(q.get('utm_source')).toBe('wajeezacademy')
    expect(q.get('utm_medium')).toBe('trainer_application')
    expect(q.get('utm_content')).toBe('WJ-TR-2026-00041')
  })

  it('ويبقى صالحا بلا تعبئة — فلا يُنتَج رابطٌ بعلامة استفهامٍ عارية', () => {
    expect(trainerInterviewUrl({})).toBe(TRAINER_INTERVIEW.url)
    expect(trainerInterviewUrl({ name: '   ' })).toBe(TRAINER_INTERVIEW.url)
  })
})

describe('أين يُعرض الحجزُ وأين لا', () => {
  it('كلُّ حالةٍ قابلةٍ للحجز معروفةٌ في قائمة الحالات', () => {
    for (const s of BOOKABLE_STATUSES) {
      expect(APPLICANT_STATUS[s], `حالةٌ لا وجود لها: ${s}`).toBeDefined()
    }
  })

  it.each([
    ['draft', 'طلبٌ لم يصل بعد — يُكمله أوّلا'],
    ['email_verification_pending', 'بريدٌ لم يُوثَّق — الطلبُ ليس مُقدَّما رسميّا'],
    ['interview_scheduled', 'موعدُه محجوزٌ فعلا — والزرُّ يدعوه إلى حجزٍ ثانٍ'],
    ['active', 'صار مدرّبا'],
    ['rejected', 'انتهى الطلب'],
    ['withdrawn', 'سحب طلبَه'],
  ])('ولا يُعرض في «%s» — %s', (status) => {
    expect(BOOKABLE_STATUSES).not.toContain(status)
  })

  it('وشرحُ الحالة لا يَعِد بمكالمةٍ بينما الزرُّ تحته يقول احجز', () => {
    /* التناقضُ هنا ليس تجميلا: من يقرأ «سنتواصل معك لتحديد موعد» فوق زرِّ
       «احجز موعدك» لا يعرف أيَّهما الصحيح، فينتظر — وهو ما نزيله. */
    for (const s of BOOKABLE_STATUSES) {
      expect(APPLICANT_STATUS[s].explain, `«${s}» ما زال يَعِد بمكالمة`)
        .not.toMatch(/نتواصل معك|سنرتّب موعدها|نرتّب موعدها/)
    }
  })
})

describe('البطاقةُ في الشاشتين — لا في واحدةٍ تُنسى الأخرى', () => {
  it('شاشةُ «وصل طلبك» تعرضها', () => {
    const src = read('src/pages/JoinTrainer.tsx')
    expect(src).toMatch(/import BookInterview/)
    expect(src, 'المكوّنُ مستوردٌ ولا يُستعمل').toMatch(/<BookInterview\b/)
  })

  it('وصفحةُ الحالة تعرضها — وإلّا رُئي الرابطُ مرّةً ثمّ اختفى', () => {
    const src = read('src/pages/ApplicantStatus.tsx')
    expect(src).toMatch(/<BookInterview\b/)
    expect(src, 'تُعرض بلا شرطِ حالةٍ — فتظهر للمرفوض').toMatch(/BOOKABLE_STATUSES\.includes/)
  })

  it('والرابطُ خارجيٌّ يُفتح بأمان', () => {
    const card = read('src/components/BookInterview.tsx')
    expect(card).toMatch(/target="_blank"/)
    expect(card, 'رابطٌ بلا noopener يمنح الصفحةَ الخارجيّةَ تحكّما في لساننا')
      .toMatch(/rel="noopener noreferrer"/)
  })

  /* ═══ انقلب هذا الحارس، ولم يُحذف ═══

     كان يمنع التضمينَ لأنّ `default-src 'self'` يحجب إطارَ Calendly فيُنتج
     مستطيلا أبيضَ بلا خطأٍ ظاهر. وقرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦) أن
     يُحجَز الموعدُ داخلَ الموقع، فوُسّعت السياسةُ سطرا واحدا.

     فصار الحارسُ يحرس ما بقي خطرا: أنّ الإطارَ **مسموحٌ في السياسة فعلا**
     (وإلّا عاد المستطيلُ الأبيض)، وأنّه **عارٍ بلا سكربتِهم** — فما يُنفَّذ
     في نطاقنا شيفرتُنا وحدَها. وهذا أضيقُ من الأوّل لا أوسع. */
  it('يُضمَّن كإطار، والسياسةُ تسمح به فعلا', () => {
    const card = code('src/components/BookInterview.tsx')
    expect(card, 'لا إطارَ — والقرارُ أن يُحجَز داخل الموقع').toMatch(/<iframe/)
    expect(card, 'الإطارُ بلا `embed_domain` لا يبثّ أحداثَه').toContain('embed_domain=')
    const caddy = read('deploy/Caddyfile')
    const csp = /Content-Security-Policy "([^"]*)"/.exec(caddy)?.[1] ?? ''
    expect(csp, 'كتلةُ السياسة مفقودة').toBeTruthy()
    expect(csp, "الإطارُ مضمَّنٌ والسياسةُ تحجبه — مستطيلٌ أبيضُ بلا خطأ")
      .toMatch(/frame-src[^;]*https:\/\/calendly\.com/)
    const apache = read('public/.htaccess')
    const apacheCsp = /Content-Security-Policy "([^"]*)"/.exec(apache)?.[1] ?? ''
    expect(apacheCsp, 'المضيفُ الذي يقرأ .htaccess يحجب إطار Calendly')
      .toMatch(/frame-src[^;]*https:\/\/calendly\.com/)
  })

  it('ولا سكربتَ لهم يُحمَّل عندنا — إطارٌ عارٍ لا وحدةٌ تُنفَّذ', () => {
    const card = code('src/components/BookInterview.tsx')
    expect(card, 'سكربتُ Calendly يُنفَّذ في نطاقنا — والإطارُ يُغني عنه')
      .not.toMatch(/assets\.calendly\.com|<script/)
    const caddy = read('deploy/Caddyfile')
    const csp = /Content-Security-Policy "([^"]*)"/.exec(caddy)?.[1] ?? ''
    const scriptSrc = /script-src ([^;]*)/.exec(csp)?.[1] ?? ''
    expect(scriptSrc, 'فُتح `script-src` لطرفٍ ثالث — والتضمينُ لا يحتاجه')
      .not.toMatch(/calendly/)
  })

  it('وحجزُ الموعد يُلتقَط ولا يبقى في تقويمهم وحدَه', () => {
    const card = code('src/components/BookInterview.tsx')
    expect(card, 'لا يُلتقَط حدثُ الحجز — فلا تعلم المنصّةُ أنّ موعدا حُجز')
      .toContain('calendly.event_scheduled')
    expect(card, 'رسالةٌ تُصدَّق بلا فحص مصدرها — أيُّ نافذةٍ تستطيع بثَّها')
      .toMatch(/e\.origin !== CALENDLY_ORIGIN|origin !== CALENDLY_ORIGIN/)
  })

  it('ولا يكتب المتصفّحُ موعدا بلا توقيع — الكتابةُ من webhook وحدَه', () => {
    expect(code('src/pages/JoinTrainer.tsx')).not.toContain('self-booked-interview')
    expect(code('src/pages/ApplicantStatus.tsx')).not.toContain('self-booked-interview')
    expect(code('server/http/routes/trainer-applications.routes.ts')).not.toContain('self-booked-interview')
    const webhook = code('server/http/routes/calendly-webhook.routes.ts')
    expect(webhook).toContain('calendly-webhook-signature')
    expect(webhook).toContain('rawBody')
  })
})

describe('توقيعُ Calendly', () => {
  const secret = 'سرّ-اختبار-لا-يخرج'
  const raw = '{"event":"invitee.created"}'
  const now = 1_800_000_000
  const signature = createHmac('sha256', secret).update(`${now}.${raw}`).digest('hex')

  it('يقبل الجسمَ الأصليَّ في نافذة الثلاث دقائق', () => {
    expect(verifyCalendlyWebhookSignature(raw, `t=${now},v1=${signature}`, secret, now + 120)).toBe(true)
  })

  it('ويرفض الجسمَ المعدّل والتوقيعَ القديم والمفتاحَ الغائب', () => {
    expect(verifyCalendlyWebhookSignature(`${raw} `, `t=${now},v1=${signature}`, secret, now)).toBe(false)
    expect(verifyCalendlyWebhookSignature(raw, `t=${now},v1=${signature}`, secret, now + 181)).toBe(false)
    expect(verifyCalendlyWebhookSignature(raw, `t=${now},v1=${signature}`, undefined, now)).toBe(false)
  })
})

/* ═══ ملفُّ المتقدّم يلحق بالحجز ═══

   قرارُ صاحب المنصّة (١٢ سبتمبر ٢٠٢٦): حين يحجز المتقدّمُ مقابلتَه يصل
   لجنةَ المراجعة ملفُّه PDF ومعه سيرتُه ملفًّا منفصلا. وكان يصلها اسمٌ
   وبريدٌ في دعوة تقويمٍ لا أكثر، فتُقرأ الأوراقُ قبل الاجتماع بدقائق أو لا
   تُقرأ. وأربعةُ أشياءَ هنا تنكسر صامتةً — لا شاشةَ خطأٍ لواحدٍ منها. */
describe('ملفُّ المتقدّم عند الحجز', () => {
  const HOOK = 'server/services/calendly-webhook.service.ts'
  const DOSSIER = 'server/services/trainer-dossier.service.ts'

  it('يُرسَل عند الحجز وحدَه — لا عند إعادة التسليم', () => {
    const src = code(HOOK)
    expect(src, 'الحجزُ لا يُرسل ملفّا أصلا').toContain('sendInterviewDossier')
    /* Calendly يعيد التسليمَ حتّى يرى ٢٠٠: بلا هذا الشرط تصل اللجنةَ
       الرسالةُ بمرفقَيها مرّةً بعد مرّة. */
    expect(src, 'الإرسالُ بلا شرطِ «سُجّل الآن» — فيتكرّر مع كلّ إعادة تسليم')
      .toMatch(/if \(result\.recorded\)[\s\S]{0,200}sendInterviewDossier/)
    /* وبعد المعاملة لا داخلَها: التوليدُ يفتح متصفّحا والإرسالُ ينادي شبكةً،
       وإمساكُ معاملةِ قاعدةٍ طولَ ذلك يُرجِع المقابلةَ المكتوبةَ عند أيّ فشل. */
    const tx = /\$transaction\(async \(tx\) => \{[\s\S]*?\n {6}\}\)/.exec(src)?.[0] ?? ''
    expect(tx, 'كتلةُ المعاملة مفقودة').toBeTruthy()
    expect(tx, 'الإرسالُ داخلَ المعاملة — يُمسكها ثوانيَ ويُرجِعها عند فشله')
      .not.toContain('sendInterviewDossier')
    /* وفشلُه لا يردّ ٥٠٠ على Calendly: الحجزُ مكتوبٌ والملفُّ رفاهية */
    expect(src, 'فشلُ الملفّ يُسقط الحجزَ المكتوب').toMatch(/try \{\s*await sendInterviewDossier[\s\S]{0,80}\} catch/)
  })

  it('ويحمل ما يكتبه المتقدّم نصّا لا وسما', () => {
    const src = code(DOSSIER)
    /* الاسمُ والنبذةُ والدافعُ يكتبها إنسانٌ من خارج المنصّة، وتدخل HTML */
    expect(src, 'لا تهريبَ لما يكتبه المتقدّم').toMatch(/replace\(\/&\/g, '&amp;'\)/)
    expect(src, 'لا تهريبَ للأقواس').toMatch(/replace\(\/</)
  })

  it('والسيرةُ ملفٌّ منفصلٌ بجانب الملفّ — لا رابطٌ موقَّتٌ في متنِ رسالة', () => {
    const src = code(DOSSIER)
    expect(src, 'السيرةُ لا تُقرأ من مخزنها').toContain('readDocumentContent')
    expect(src, 'المرفقان لا يُسلَّمان للبريد').toMatch(/attachments/)
    /* والبريدُ يمرّرها فعلا إلى Resend — قائمةٌ تُبنى ولا تُرسَل عطبٌ صامت */
    expect(code('server/services/mail.ts'), 'Resend لا يتلقّى المرفقات')
      .toMatch(/attachments: attachmentsOf\(input\)/)
    expect(code('server/services/notification.service.ts'), 'البريدُ المباشر لا يقبل مرفقات')
      .toContain('attachments?: MailAttachment[]')
  })

  it('والصورةُ تحمل متصفّحا وخطًّا عربيّا — وإلّا خرج الملفُّ مربّعاتٍ فارغة', () => {
    const dockerfile = read('Dockerfile')
    /* متصفّحٌ من apk لا من Playwright: متصفّحاتُه مبنيّةٌ على glibc والصورةُ musl */
    expect(dockerfile, 'لا متصفّحَ في الصورة — فلا ملفَّ يُطبع').toMatch(/apk add[^\n]*\bchromium\b/)
    /* والخطُّ لازمٌ بقدره: صورةُ node بلا خطوطٍ البتّة */
    expect(dockerfile, 'لا خطَّ عربيّا في الصورة').toMatch(/font-noto-arabic/)
    expect(dockerfile, 'تُنزَّل متصفّحاتُ Playwright بلا أن تُستعمل').toContain('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1')
    /* والمولّدُ يبحث عن متصفّحِ النظام — لا يفترض متصفّحَ Playwright */
    expect(code('server/services/pdf.ts'), 'المولّدُ لا يعرف أين متصفّحُ النظام').toContain('/usr/bin/chromium')
  })

  it('وغيابُ المتصفّح لا يُسقط الحجز — يُعاد السببُ ولا يُرمى', () => {
    const src = code('server/services/pdf.ts')
    const render = /export async function renderPdf[\s\S]*$/.exec(src)?.[0] ?? ''
    expect(render, 'دالّةُ التوليد مفقودة').toBeTruthy()
    expect(render, 'التوليدُ يرمي فيُسقط ما ناداه').toMatch(/catch \(e\)[\s\S]*?return \{ pdf: null/)
  })
})
