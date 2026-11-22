/* ═══ بريدُ تسجيل الدورة — لمن حضر ولمن لم يستطع (٢١ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة (اقتراحُ «٨»): «تسجيلٌ لمن لا يستطيع الحضور مباشرة» — يرفع عذرَ «لستُ متفرّغا يومَ السبت». فبعد
   الدورة يلصق صاحبُها رابطَ تسجيل كلّ شعبةٍ في لوحته، ويخرج هذا البريدُ لمؤكَّديها: زرٌّ إلى التسجيل، والرابطُ مكتوبا،
   ورجاءُ ألّا يُشارَك. ومن Gmail صاحب الدورة، بلا شعار وجيز، بألوان بريد التأكيد (`confirmation-mail.ts`). */

import { AI_JOBS, type PrivateSection } from '../../../src/application/private-course/ai-jobs'
import { whatsappLink } from '../../../src/application/private-course/phone'
import { button, C, esc, firstName, FONT } from './confirmation-mail'
import { PRIVATE_SENDER_NAME } from './mailer'

export interface RecordingInput {
  fullName: string
  section: PrivateSection
  url: string
}

export function recordingSubject(): string {
  return `تسجيل الدورة — ${AI_JOBS.title}`
}

export function recordingHtml(i: RecordingInput): string {
  const wa = whatsappLink(AI_JOBS.whatsapp)
  const p = (html: string, extra = '') => `<div style="font-family:${FONT};font-size:15px;line-height:1.9;color:${C.ink2}${extra}">${html}</div>`
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(recordingSubject())}</title></head>
<body style="margin:0;padding:0;background:${C.ice}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">تسجيل ${esc(i.section.title)} كاملا — شاهده متى شئت</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.ice}" dir="rtl">
<tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">

<tr><td style="background:${C.ink};border-radius:20px 20px 0 0;padding:30px 28px 26px;text-align:right">
  <div style="display:inline-block;background:${C.yellow};color:${C.ink};font-family:${FONT};font-size:13px;font-weight:700;padding:6px 14px;border-radius:999px">${esc(i.section.title)}</div>
  <div style="font-family:${FONT};font-size:30px;line-height:1.35;font-weight:800;color:#ffffff;margin-top:16px">تسجيل الدورة جاهز</div>
  <div style="font-family:${FONT};font-size:17px;line-height:1.7;color:#dfe7f5;margin-top:6px">${esc(AI_JOBS.headline)}</div>
</td></tr>

<tr><td style="background:#ffffff;border-left:2px solid ${C.ink};border-right:2px solid ${C.ink};padding:28px 28px 10px;text-align:right">
  <div style="font-family:${FONT};font-size:18px;font-weight:700;color:${C.ink}">أهلا ${esc(firstName(i.fullName))}،</div>
  ${p(`هذا تسجيل ${esc(i.section.title)} كاملا. شاهده متى شئت، وطبّق الخطوات معه على جهازك.`, ';font-size:16px;margin-top:8px')}
  ${button(i.url, 'شاهد التسجيل', C.blue)}
  <div dir="ltr" style="font-family:${FONT};font-size:12px;color:${C.ink2};word-break:break-all;text-align:right">${esc(i.url)}</div>
  ${p('الرابط خاص بالمسجلين — نرجو ألا تشاركه.', ';font-size:14px;margin-top:14px')}
</td></tr>

<tr><td style="background:#ffffff;border:2px solid ${C.ink};border-top:0;border-radius:0 0 20px 20px;padding:18px 28px 26px;text-align:right">
  ${p(`عندك سؤال؟ رد على هذه الرسالة، أو راسلني على واتساب <a href="${esc(wa)}" style="color:${C.blue};font-weight:700;text-decoration:none" dir="ltr">&#x2066;${esc(AI_JOBS.whatsappLabel)}&#x2069;</a>`)}
  <div style="font-family:${FONT};font-size:16px;line-height:1.8;color:${C.ink};margin-top:14px">إلى اللقاء،<br><b>${esc(PRIVATE_SENDER_NAME)}</b></div>
</td></tr>

<tr><td style="padding:16px 10px 0;text-align:center;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.ink2}">دورة تدريبية مستقلة، غير تابعة لشركة Anthropic المطورة لـ Claude.</td></tr>

</table>
</td></tr></table>
</body></html>`
}

export function recordingText(i: RecordingInput): string {
  return [
    `أهلا ${firstName(i.fullName)}،`,
    '',
    `هذا تسجيل ${i.section.title} كاملا. شاهده متى شئت، وطبّق الخطوات معه على جهازك:`,
    i.url,
    '',
    'الرابط خاص بالمسجلين — نرجو ألا تشاركه.',
    '',
    `عندك سؤال؟ رد على هذه الرسالة أو راسلني على واتساب ${AI_JOBS.whatsappLabel}`,
    '',
    'إلى اللقاء،',
    PRIVATE_SENDER_NAME,
    '',
    'دورة تدريبية مستقلة، غير تابعة لشركة Anthropic المطورة لـ Claude.',
  ].join('\n')
}
