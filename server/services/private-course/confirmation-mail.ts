/* ═══ بريدُ تأكيد التسجيل في الدورة الخاصّة (١٩ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «بعد أن أؤكّد له التسجيلَ يجب أن يصل له إيميل يقول له نزّل Claude Code وأعطه الرابط إن لم
   يكن مشتركا فيه، وأرفق له الملفَّ الخاصَّ بالدورة، واجعل الإيميل مصمّما بطريقةٍ جميلة، ولا تضع لوقو وجيز».
   و«يرسل لهم رابطَ Zoom تلقائيّا لشعبته، وتكون الدعوةُ موجّهةً للمتعلّم ولا تُدرج أحدا ثانيا فيها من أكاديميّة وجيز».

   فالرسالةُ واحدةٌ تجمع ذلك كلَّه: التأكيدُ والشعبةُ ووقتُها، وزرُّ Zoom (أو سطرٌ يقول إنّه يصل قبل الدورة إن لم
   يُضبط بعد)، وثلاثُ خطواتٍ قبل الدورة، والملفُّ مرفقا، ودعوةُ تقويمٍ **مدعوُّها المتعلّمُ وحدَه** ومنظِّمُها بريدُ
   صاحب الدورة. ولا اسمَ للأكاديميّة في شيءٍ منها: لا شعارٌ ولا نصٌّ ولا مُنتِجُ ملفّ التقويم — ويحرسه
   `server/tests/private-course/private-course.test.ts`.

   والتصميمُ جداولُ وأنماطٌ مضمَّنة: عملاءُ البريد لا يقرؤون ورقةَ أنماط، وGmail يُسقط `<style>` في بعض عرضه.
   وألوانُه ألوانُ منشور الدورة نفسِه. */

import { AI_JOBS, CLAUDE_LINKS, type PrivateSection } from '../../../src/application/private-course/ai-jobs'
import { whatsappLink } from '../../../src/application/private-course/phone'
import { buildIcs } from '../calendar/ics'
import { PRIVATE_SENDER_NAME } from './mailer'

/** ألوانُ منشور الدورة — يقرؤها بريدُ التذكير أيضا (`reminder-mail.ts`) فلا يفترق شكلاهما */
export const C = {
  ink: '#142240',
  ink2: '#3c4a66',
  yellow: '#ffd23f',
  green: '#13a37b',
  blue: '#2d6cdf',
  ice: '#eef5fb',
  butter: '#fff6dc',
  line: '#d9e2ef',
}

export const FONT = "'Segoe UI', Tahoma, Arial, sans-serif"

export interface ConfirmationInput {
  registrationId: string
  fullName: string
  email: string
  section: PrivateSection
  zoom: { url: string; passcode?: string } | null
  /** اسمُ الملفّ المرفق — يُذكر في الرسالة إن وُجد */
  fileName: string | null
  /** للتقويم: يرتفع مع كلّ إرسالٍ فيعرف التقويمُ أنّه تحديثٌ لا موعدٌ ثانٍ */
  sentAt: Date
  organizerEmail: string
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full.trim()
}

export function button(href: string, label: string, bg: string, color = '#ffffff'): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 4px"><tr><td style="background:${bg};border-radius:12px;border:2px solid ${C.ink}">` +
    `<a href="${esc(href)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:16px;font-weight:700;color:${color};text-decoration:none">${esc(label)}</a>` +
    `</td></tr></table>`
}

function step(n: number, title: string, body: string, extra = ''): string {
  return `<tr><td style="padding:0 0 18px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td width="44" valign="top" style="padding-left:12px"><div style="width:38px;height:38px;line-height:38px;border-radius:50%;background:${C.yellow};border:2px solid ${C.ink};text-align:center;font-family:${FONT};font-weight:800;font-size:17px;color:${C.ink}">${n}</div></td>` +
    `<td valign="top" style="font-family:${FONT};color:${C.ink}"><div style="font-size:17px;font-weight:700;line-height:1.5">${title}</div>` +
    `<div style="font-size:15px;line-height:1.8;color:${C.ink2};margin-top:2px">${body}</div>${extra}</td>` +
    `</tr></table></td></tr>`
}

/** تسجيلٌ لمن لا يستطيع الحضور — اقتراحُ «٨» بقرار صاحب المنصّة (٢١ نوفمبر ٢٠٢٦) */
export const RECORDING_LINE = 'لا تستطيع الحضور مباشرة؟ يصلك تسجيل الدورة على بريدك بعدها.'

export function confirmationSubject(): string {
  return `تم تأكيد تسجيلك — ${AI_JOBS.title}`
}

export function confirmationHtml(i: ConfirmationInput): string {
  const name = esc(firstName(i.fullName))
  const wa = whatsappLink(AI_JOBS.whatsapp)
  const zoomBlock = i.zoom
    ? `<div style="font-family:${FONT};font-size:15px;color:${C.ink2};line-height:1.8">ادخل من هذا الرابط قبل الموعد بعشر دقائق:</div>` +
      button(i.zoom.url, 'ادخل إلى Zoom', C.blue) +
      `<div dir="ltr" style="font-family:${FONT};font-size:13px;color:${C.ink2};word-break:break-all;text-align:right">${esc(i.zoom.url)}</div>` +
      (i.zoom.passcode ? `<div style="font-family:${FONT};font-size:14px;color:${C.ink};margin-top:6px">رمز الدخول: <b dir="ltr">${esc(i.zoom.passcode)}</b></div>` : '') +
      `<div style="font-family:${FONT};font-size:13px;color:${C.ink2};margin-top:10px">دعوة التقويم مع الرسالة — اضغط «نعم» ليضاف الموعد إلى تقويمك.</div>`
    : `<div style="font-family:${FONT};font-size:15px;line-height:1.8;color:${C.ink};background:${C.butter};border:2px dashed ${C.ink};border-radius:12px;padding:12px 14px">رابط Zoom يصلك في رسالة قبل الدورة.</div>`

  const detailRow = (label: string, value: string) =>
    `<tr><td style="padding:7px 0;font-family:${FONT};font-size:14px;color:${C.ink2};width:92px">${label}</td>` +
    `<td style="padding:7px 0;font-family:${FONT};font-size:16px;font-weight:700;color:${C.ink}">${value}</td></tr>`

  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(confirmationSubject())}</title></head>
<body style="margin:0;padding:0;background:${C.ice}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">مقعدك مؤكد — موعدك ورابط Zoom وخطوات التحضير في الداخل</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.ice}" dir="rtl">
<tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">

<tr><td style="background:${C.ink};border-radius:20px 20px 0 0;padding:30px 28px 26px;text-align:right">
  <div style="display:inline-block;background:${C.yellow};color:${C.ink};font-family:${FONT};font-size:13px;font-weight:700;padding:6px 14px;border-radius:999px">دورة عملية مباشرة · ${AI_JOBS.hours} ساعات</div>
  <div style="font-family:${FONT};font-size:30px;line-height:1.35;font-weight:800;color:#ffffff;margin-top:16px">تم تأكيد تسجيلك ✓</div>
  <div style="font-family:${FONT};font-size:17px;line-height:1.7;color:#dfe7f5;margin-top:6px">${esc(AI_JOBS.headline)}</div>
</td></tr>

<tr><td style="background:#ffffff;border-left:2px solid ${C.ink};border-right:2px solid ${C.ink};padding:28px 28px 8px;text-align:right">
  <div style="font-family:${FONT};font-size:18px;font-weight:700;color:${C.ink}">أهلا ${name}،</div>
  <div style="font-family:${FONT};font-size:16px;line-height:1.9;color:${C.ink2};margin-top:8px">وصل تحويلك وتأكد مقعدك. نلتقي <b style="color:${C.ink}">${esc(AI_JOBS.dateLabel)}</b> مباشرة على Zoom.</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background:${C.ice};border:2px solid ${C.ink};border-radius:16px">
  <tr><td style="padding:14px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${detailRow('الشعبة', esc(i.section.title))}
      ${detailRow('الوقت', `${esc(i.section.timeLabel)} <span style="font-weight:400;font-size:13px;color:${C.ink2}">بتوقيت عمّان</span>`)}
      ${detailRow('التاريخ', esc(AI_JOBS.dateLabel))}
      ${detailRow('المدة', `${AI_JOBS.hours} ساعات تطبيق عملي`)}
    </table>
  </td></tr></table>

  <div style="margin-top:22px">${zoomBlock}</div>
  <div style="font-family:${FONT};font-size:14px;line-height:1.8;color:${C.ink2};margin-top:12px">${esc(RECORDING_LINE)}</div>
</td></tr>

<tr><td style="background:#ffffff;border-left:2px solid ${C.ink};border-right:2px solid ${C.ink};padding:18px 28px 6px;text-align:right">
  <div style="font-family:${FONT};font-size:20px;font-weight:800;color:${C.ink};margin-bottom:16px"><span style="background:${C.yellow};padding:0 6px">قبل الدورة</span> ثلاث خطوات</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${step(1, 'نزّل Claude Code', 'حمّله على اللابتوب من الرابط الرسمي وسجّل دخولك. عليه نبني نظامك في الدورة.', button(CLAUDE_LINKS.download, 'نزّل Claude Code', C.ink))}
    ${step(2, 'اشترك في Claude إن لم تكن مشتركا', 'Claude Code يعمل مع الاشتراك المدفوع، وخطة Pro تكفي للبداية.', button(CLAUDE_LINKS.pricing, 'اختر خطتك', C.yellow, C.ink))}
    ${step(3, 'جهّز سيرتك الذاتية', 'ملف سيرتك وبريدك الإلكتروني ولابتوب مشحون. لا تحتاج أي خبرة، نبدأ معك من الصفر.')}
  </table>
</td></tr>

${i.fileName ? `<tr><td style="background:#ffffff;border-left:2px solid ${C.ink};border-right:2px solid ${C.ink};padding:4px 28px 10px;text-align:right">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.butter};border:2px solid ${C.ink};border-radius:14px"><tr>
  <td style="padding:14px 16px;font-family:${FONT};font-size:15px;line-height:1.8;color:${C.ink}">📎 <b>ملف الدورة مرفق مع الرسالة</b><br><span style="color:${C.ink2}">${esc(i.fileName)} — راجعه قبل اللقاء.</span></td>
  </tr></table>
</td></tr>` : ''}

<tr><td style="background:${C.green};border:2px solid ${C.ink};border-top:0;padding:18px 28px;text-align:right">
  <div style="font-family:${FONT};font-size:14px;color:#eafff6">بعد الدورة</div>
  <div style="font-family:${FONT};font-size:19px;font-weight:800;color:#ffffff;margin-top:2px">أسبوع متابعة مجانية على واتساب</div>
</td></tr>

<tr><td style="background:#ffffff;border:2px solid ${C.ink};border-top:0;border-radius:0 0 20px 20px;padding:22px 28px 26px;text-align:right">
  <div style="font-family:${FONT};font-size:15px;line-height:1.9;color:${C.ink2}">عندك سؤال؟ رد على هذه الرسالة، أو راسلني على واتساب <a href="${esc(wa)}" style="color:${C.blue};font-weight:700;text-decoration:none" dir="ltr">&#x2066;${esc(AI_JOBS.whatsappLabel)}&#x2069;</a></div>
  <div style="font-family:${FONT};font-size:16px;line-height:1.8;color:${C.ink};margin-top:14px">إلى اللقاء،<br><b>${esc(PRIVATE_SENDER_NAME)}</b></div>
</td></tr>

<tr><td style="padding:16px 10px 0;text-align:center;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.ink2}">دورة تدريبية مستقلة، غير تابعة لشركة Anthropic المطورة لـ Claude.</td></tr>

</table>
</td></tr></table>
</body></html>`
}

export function confirmationText(i: ConfirmationInput): string {
  const lines = [
    `أهلا ${firstName(i.fullName)}،`,
    '',
    `تم تأكيد تسجيلك في ${AI_JOBS.title}.`,
    `نلتقي ${AI_JOBS.dateLabel} مباشرة على Zoom.`,
    '',
    `الشعبة: ${i.section.title}`,
    `الوقت: ${i.section.timeLabel} بتوقيت عمّان`,
    `المدة: ${AI_JOBS.hours} ساعات تطبيق عملي`,
    '',
    ...(i.zoom
      ? [`رابط Zoom: ${i.zoom.url}`, ...(i.zoom.passcode ? [`رمز الدخول: ${i.zoom.passcode}`] : []), 'ادخل قبل الموعد بعشر دقائق.']
      : ['رابط Zoom يصلك في رسالة قبل الدورة.']),
    RECORDING_LINE,
    '',
    'قبل الدورة ثلاث خطوات:',
    `1. نزّل Claude Code: ${CLAUDE_LINKS.download}`,
    `2. اشترك في Claude إن لم تكن مشتركا (خطة Pro تكفي): ${CLAUDE_LINKS.pricing}`,
    '3. جهّز سيرتك الذاتية وبريدك ولابتوب مشحون.',
    '',
    ...(i.fileName ? [`ملف الدورة مرفق: ${i.fileName}`, ''] : []),
    'بعد الدورة: أسبوع متابعة مجانية على واتساب.',
    `عندك سؤال؟ رد على هذه الرسالة أو راسلني على واتساب ${AI_JOBS.whatsappLabel}`,
    '',
    'إلى اللقاء،',
    PRIVATE_SENDER_NAME,
    '',
    'دورة تدريبية مستقلة، غير تابعة لشركة Anthropic المطورة لـ Claude.',
  ]
  return lines.join('\n')
}

/** دعوةُ التقويم — المدعوُّ المتعلّمُ وحدَه، والمنظِّمُ بريدُ صاحب الدورة. والمعرّفُ للتسجيل لا للشعبة: نقلُه بين
    الشعبتين يحرّك موعدَه في تقويمه ولا يضيف موعدا ثانيا */
export function confirmationIcs(i: ConfirmationInput): string {
  const start = new Date(i.section.startsAt)
  const end = new Date(i.section.endsAt)
  return buildIcs({
    uid: `ai-jobs-${i.registrationId}@private-course`,
    title: AI_JOBS.title,
    startsAt: start,
    durationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000),
    description: [
      `${i.section.title} — ${i.section.timeLabel} بتوقيت عمّان`,
      ...(i.zoom ? [`رابط Zoom: ${i.zoom.url}`, ...(i.zoom.passcode ? [`رمز الدخول: ${i.zoom.passcode}`] : [])] : ['رابط Zoom يصلك قبل الدورة.']),
    ].join('\n'),
    location: i.zoom?.url ?? 'Zoom',
    ...(i.zoom ? { url: i.zoom.url } : {}),
    organizer: { name: PRIVATE_SENDER_NAME, email: i.organizerEmail },
    attendee: { name: i.fullName, email: i.email },
    sequence: Math.floor(i.sentAt.getTime() / 1000),
    now: i.sentAt,
  }, '-//Private Course//AR//')
}
