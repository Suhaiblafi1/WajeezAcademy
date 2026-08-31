/* مرسل البريد — غلاف nodemailer فوق إعدادات التكامل.
   يُستدعى فقط عند قناة email المفعّلة؛ أي فشل SMTP يُعاد كخطأ عربي مفهوم
   ليُسجل في سجل الإشعار ويُعاد المحاولة — لا يُبتلع ولا يُكسر المسار التشغيلي. */

import nodemailer from 'nodemailer'
import type { EmailConfig } from './integrations.service'

export interface MailInput {
  to: string
  subject: string
  text: string
  /* دعوةُ تقويم تُرفَق بالرسالة — يفتحها قوقل وآبل وأوتلوك بلا حساب.
     والاسمُ `.ics` والنوعُ `text/calendar` كلاهما لازم: بعضُ العملاء
     يقرأ النوعَ وبعضُهم اللاحقة. */
  icsContent?: string
  icsFilename?: string
}

export async function sendEmail(config: EmailConfig, input: MailInput): Promise<{ ok: boolean; error?: string }> {
  if (!config.enabled) return { ok: false, error: 'قناة البريد غير مفعّلة — فعّلها من شاشة التكاملات' }
  if (!config.host || !config.fromEmail) return { ok: false, error: 'إعدادات البريد ناقصة: المضيف وعنوان المرسل إلزاميان' }
  try {
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass ?? '' } : undefined,
      connectionTimeout: 10_000,
    })
    await transport.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      attachments: input.icsContent
        ? [{
            filename: input.icsFilename ?? 'wajeez-event.ics',
            content: input.icsContent,
            contentType: 'text/calendar; charset=utf-8; method=REQUEST',
          }]
        : undefined,
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    /* أخطاء SMTP الشائعة بصياغة مفهومة لمن يراجع السجل */
    if (/EAUTH|auth/i.test(msg)) return { ok: false, error: 'رفض خادم البريد بيانات الدخول — راجع المستخدم وكلمة المرور' }
    if (/ECONN|ETIMEDOUT|timeout/i.test(msg)) return { ok: false, error: 'تعذر الوصول لخادم البريد — راجع المضيف والمنفذ' }
    return { ok: false, error: `فشل الإرسال: ${msg}` }
  }
}
