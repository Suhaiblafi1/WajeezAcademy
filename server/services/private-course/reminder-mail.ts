/* ═══ بريدُ تذكير من حجز ولم يدفع — «تذكير» في اليوم التالي، و«آخر فرصة» بعد ثلاثة أيام (٢١ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «if they haven't paid, remind them next day as reminder, after three days last chance».
   فرسالتان بقالبٍ واحد: الأولى تقول إنّ مقعده محجوزٌ وباقي خطوةٌ واحدة، والثانيةُ إنّها آخرُ رسالةٍ وإنّ المقاعد
   تنفد — بعددها في شعبته كما تعرضه الصفحة (`seatsLeft`). وكلتاهما تحمل رابطَ الدفع باسمه، وطريقةَ CliQ، والبطاقةَ
   إن ضُبط رابطُها. ولا تقول ما لا نفعله: لا «سنلغي حجزك» ولا موعدَ إلغاء.

   ومن ضغط «ادفع بالبطاقة» يُقال له إنّه لا يحتاج إلى فعل شيءٍ إن دفع: البطاقةُ لا إيصالَ لها، ونحن نطابق دفعَه.

   وكبريد التأكيد: من Gmail صاحب الدورة، بلا شعار وجيز ولا اسمِها. والأسلوبُ ألوانُ منشور الدورة (`confirmation-mail.ts`). */

import { ABROAD_PAY_LINE, AI_JOBS, abroadPayMessage, seatsLabel, type PrivateSection } from '../../../src/application/private-course/ai-jobs'
import { whatsappLink } from '../../../src/application/private-course/phone'
import { button, C, esc, firstName, FONT } from './confirmation-mail'
import { PRIVATE_SENDER_NAME } from './mailer'

export type ReminderKind = 'reminder' | 'last_chance'

export interface ReminderInput {
  kind: ReminderKind
  fullName: string
  section: PrivateSection
  /** رابطُ الدفع باسمه — `/ai-jobs/pay/<payToken>` */
  payUrl: string
  /** رابطُ البطاقة مضبوط — فيُذكر أنّها في الرابط نفسِه */
  card: boolean
  /** ضغط «ادفع بالبطاقة» ولم يصلنا ما يؤكده بعد */
  cardChosen: boolean
  /** ما بقي من مقاعد شعبته — كما تعرضه الصفحة */
  seats: number
  /** رقمُه خارجَ الأردن — وCliQ داخلَه وحدَه، فيُدعى إلى واتساب لترتيب الدفع (٢١ نوفمبر ٢٠٢٦) */
  abroad: boolean
  /** رقمُ مرجعه — في رسالة واتساب الجاهزة */
  reference: string
  /** ما يُحوَّل — ٢٠ دينارا عنه وعن صديقه إن سجّلا معا (٢١ نوفمبر ٢٠٢٦) */
  amountJod: number
  /** اسمُ صديقه الأوّل إن سجّلا معا */
  friendName: string | null
}

function amountHtml(i: ReminderInput): string {
  return `<b style="color:${C.ink}">${i.amountJod} دينار</b>${i.friendName ? ` عنك وعن ${esc(i.friendName)}` : ''}`
}

/** من خارج الأردن والبطاقةُ غيرُ معروضة — فلا طريقَ له إلّا واتساب */
function abroadLink(i: ReminderInput): string | null {
  if (!i.abroad || i.card) return null
  return whatsappLink(AI_JOBS.whatsapp, abroadPayMessage({ reference: i.reference }))
}

export function reminderSubject(kind: ReminderKind): string {
  return kind === 'last_chance' ? 'آخر فرصة لتأكيد مقعدك' : 'مقعدك محجوز — أكمل الدفع لتأكيده'
}

function intro(i: ReminderInput): string {
  return i.kind === 'last_chance'
    ? `هذه آخر رسالة تذكير. مقعدك في ${i.section.title} يوم ${AI_JOBS.dateLabel} ما زال بانتظار الدفع، والمقاعد تنفد.`
    : `حجزت مقعدا في ${i.section.title} يوم ${AI_JOBS.dateLabel}، ولم يصلنا الدفع بعد. مقعدك محجوز لك، وباقي خطوة واحدة لتأكيده.`
}

const CARD_DONE = 'دفعت بالبطاقة؟ لا تحتاج لفعل شيء — نؤكد مقعدك ونرسل لك رابط Zoom.'

export function reminderHtml(i: ReminderInput): string {
  const last = i.kind === 'last_chance'
  const wa = whatsappLink(AI_JOBS.whatsapp)
  const preheader = last ? `${seatsLabel(i.seats)} في ${i.section.title}` : `${i.section.title} يوم ${AI_JOBS.dateLabel} — خطوة واحدة باقية`
  const p = (html: string, extra = '') =>
    `<div style="font-family:${FONT};font-size:15px;line-height:1.9;color:${C.ink2}${extra}">${html}</div>`

  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(reminderSubject(i.kind))}</title></head>
<body style="margin:0;padding:0;background:${C.ice}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.ice}" dir="rtl">
<tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">

<tr><td style="background:${C.ink};border-radius:20px 20px 0 0;padding:30px 28px 26px;text-align:right">
  <div style="display:inline-block;background:${last ? '#ff6b5a' : C.yellow};color:${last ? '#ffffff' : C.ink};font-family:${FONT};font-size:13px;font-weight:700;padding:6px 14px;border-radius:999px">${last ? esc(seatsLabel(i.seats)) : `دورة عملية مباشرة · ${AI_JOBS.hours} ساعات`}</div>
  <div style="font-family:${FONT};font-size:30px;line-height:1.35;font-weight:800;color:#ffffff;margin-top:16px">${last ? 'آخر فرصة لتأكيد مقعدك' : 'مقعدك بانتظارك'}</div>
  <div style="font-family:${FONT};font-size:17px;line-height:1.7;color:#dfe7f5;margin-top:6px">${esc(AI_JOBS.headline)}</div>
</td></tr>

<tr><td style="background:#ffffff;border-left:2px solid ${C.ink};border-right:2px solid ${C.ink};padding:28px 28px 10px;text-align:right">
  <div style="font-family:${FONT};font-size:18px;font-weight:700;color:${C.ink}">أهلا ${esc(firstName(i.fullName))}،</div>
  ${p(esc(intro(i)), ';font-size:16px;margin-top:8px')}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background:${C.ice};border:2px solid ${C.ink};border-radius:16px">
  <tr><td style="padding:16px 18px">
    <div style="font-family:${FONT};font-size:17px;font-weight:800;color:${C.ink}">أكّد مقعدك بخطوة واحدة</div>
    ${p(`حوّل ${amountHtml(i)} عبر CliQ إلى الاسم المستعار <b dir="ltr" style="color:${C.ink}">${esc(AI_JOBS.cliqAlias)}</b>، ثم ارفع صورة الحوالة من رابطك.`, ';margin-top:4px')}
    ${i.card ? p(`من خارج الأردن؟ ادفع <b dir="ltr" style="color:${C.ink}">${AI_JOBS.priceUsd}$</b> بالبطاقة من الرابط نفسه.`) : ''}
    ${abroadLink(i) ? p(`<a href="${esc(abroadLink(i)!)}" style="color:${C.green};font-weight:700;text-decoration:none">${esc(ABROAD_PAY_LINE)}</a>`) : ''}
    ${button(i.payUrl, last ? 'أكّد مقعدي الآن' : 'أكمل حجزي', C.yellow, C.ink)}
    <div dir="ltr" style="font-family:${FONT};font-size:12px;color:${C.ink2};word-break:break-all;text-align:right">${esc(i.payUrl)}</div>
  </td></tr></table>

  ${p(`${AI_JOBS.hours} ساعات تطبيق عملي، وأسبوع متابعة على واتساب بعدها.`, ';margin-top:16px')}
  ${i.cardChosen ? `<div style="font-family:${FONT};font-size:15px;line-height:1.8;color:${C.ink};background:${C.butter};border:2px dashed ${C.ink};border-radius:12px;padding:12px 14px;margin-top:14px">${esc(CARD_DONE)}</div>` : ''}
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

export function reminderText(i: ReminderInput): string {
  return [
    `أهلا ${firstName(i.fullName)}،`,
    '',
    intro(i),
    ...(i.kind === 'last_chance' ? [`${seatsLabel(i.seats)} في ${i.section.title}.`] : []),
    '',
    `أكّد مقعدك: حوّل ${i.amountJod} دينار${i.friendName ? ` عنك وعن ${i.friendName}` : ''} عبر CliQ إلى ${AI_JOBS.cliqAlias}، ثم ارفع صورة الحوالة من رابطك:`,
    i.payUrl,
    ...(i.card ? [`من خارج الأردن؟ ادفع ${AI_JOBS.priceUsd}$ بالبطاقة من الرابط نفسه.`] : []),
    ...(abroadLink(i) ? [`${ABROAD_PAY_LINE}: ${abroadLink(i)}`] : []),
    ...(i.cardChosen ? ['', CARD_DONE] : []),
    '',
    `عندك سؤال؟ رد على هذه الرسالة أو راسلني على واتساب ${AI_JOBS.whatsappLabel}`,
    '',
    'إلى اللقاء،',
    PRIVATE_SENDER_NAME,
    '',
    'دورة تدريبية مستقلة، غير تابعة لشركة Anthropic المطورة لـ Claude.',
  ].join('\n')
}
