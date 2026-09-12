/* مرسل البريد — غلاف Resend API فوق إعدادات التكامل.
   يُستدعى فقط عند قناة email المفعّلة؛ أي فشل من Resend يُعاد كخطأ عربي مفهوم
   ليُسجل في سجل الإشعار ويُعاد المحاولة — لا يُبتلع ولا يُكسر المسار التشغيلي. */

import { Resend } from 'resend'
import { ACADEMY_EMAILS, type EmailConfig } from './integrations.service'

export interface MailInput {
  to: string
  subject: string
  text: string
  /** الصيغةُ المهيّأة. والنصُّ يبقى معها دائما: بعضُ العملاء يعرضه، وقارئُ
      الشاشة يفضّله، وفلاترُ البريد تعدّ رسالةً بلا نصٍّ علامةً على الإزعاج. */
  html?: string
  /* دعوةُ تقويم تُرفَق بالرسالة — يفتحها قوقل وآبل وأوتلوك بلا حساب.
     والاسمُ `.ics` والنوعُ `text/calendar` كلاهما لازم: بعضُ العملاء
     يقرأ النوعَ وبعضُهم اللاحقة. */
  icsContent?: string
  icsFilename?: string
  /* مرفقاتٌ أخرى — ملفُّ المتقدّم وسيرتُه حين تُحجز مقابلتُه.

     ولماذا حقلٌ عامٌّ بجانب `icsContent` لا بدلا عنه: الدعوةُ مرفقٌ بشروط
     (اسمُها ونوعُها ومَعلمةُ `method` كلُّها لازمة، ومكتوبٌ فوقُ لماذا)،
     وتوحيدُهما يجعل كلَّ مُنادٍ يتذكّر تلك الشروط. فيبقى الخاصُّ خاصًّا،
     ويُضاف العامُّ لما سواه — ويجتمعان في رسالةٍ واحدةٍ إن اجتمعا. */
  attachments?: MailAttachment[]
}

export interface MailAttachment {
  filename: string
  content: Buffer
  contentType?: string
}

/* المرفقاتُ كلُّها في قائمةٍ واحدةٍ تُسلَّم لـResend — أو `undefined` إن
   لم يكن ثمّ مرفق: قائمةٌ فارغةٌ تُقبل، لكنّ الغيابَ أصدقُ من فراغٍ يُرسَل. */
function attachmentsOf(input: MailInput) {
  const list = [
    ...(input.icsContent
      ? [{
          filename: input.icsFilename ?? 'wajeez-event.ics',
          content: Buffer.from(input.icsContent, 'utf-8'),
          contentType: 'text/calendar; charset=utf-8; method=REQUEST',
        }]
      : []),
    ...(input.attachments ?? []),
  ]
  return list.length > 0 ? list : undefined
}

export async function sendEmail(config: EmailConfig, input: MailInput): Promise<{ ok: boolean; error?: string }> {
  if (!config.enabled) return { ok: false, error: 'قناة البريد غير مفعّلة — فعّلها من شاشة التكاملات' }
  if (!config.apiKey || !config.fromEmail) return { ok: false, error: 'إعدادات البريد ناقصة: مفتاح Resend وعنوان المرسل إلزاميان' }
  try {
    const resend = new Resend(config.apiKey)
    const { error } = await resend.emails.send({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: input.to,
      /* المُرسِلُ `no-reply@` صادقٌ في اسمه — لا يُقرأ ما يصله. لكنّ من يضغط
         «ردّ» على رسالةِ توثيقٍ إنسانٌ ينتظر جوابا، فيُوجَّه ردُّه إلى الدعم
         بدل أن يذهب إلى صندوقٍ لا يفتحه أحد. */
      replyTo: config.replyTo || ACADEMY_EMAILS.support,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
      attachments: attachmentsOf(input),
    })
    if (error) {
      /* أخطاء Resend الشائعة بصياغة مفهومة لمن يراجع السجل */
      const name = error.name ?? ''
      if (/validation|missing_api_key|invalid_api_key/i.test(name)) return { ok: false, error: 'رفض Resend بيانات الدخول — راجع مفتاح API' }
      if (/rate_limit/i.test(name)) return { ok: false, error: 'تجاوز حد الإرسال لدى Resend — أعد المحاولة لاحقا' }
      return { ok: false, error: `فشل الإرسال: ${error.message}` }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `فشل الإرسال: ${msg}` }
  }
}
