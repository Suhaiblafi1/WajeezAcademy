/* قالبُ الرسائل — هيئةٌ واحدةٌ ترثها كلُّ رسالةٍ تخرج من المنصّة.

   ═══ ما كان ═══

   كلُّ رسائلِ المنصّة كانت **نصّا خاما** (`text` وحدَه في `sendEmail`)، لا
   HTML فيها أصلا. فما يصل المستخدمَ هو ما يقرّره عميلُ بريده: خطٌّ أحاديُّ
   العرض أحيانا، وأسطرٌ تنكسر في غير مواضعها، وروابطُ تُقطع نصفين فلا تُفتح،
   ولا فرقَ بين عنوانٍ وفقرةٍ وقائمة. ووُصفت بأنّها «غير مرتّبة» — والوصفُ
   دقيق: لا ترتيبَ فيها لأنّه لا هيئةَ لها.

   ═══ والعلاج ليس تجميلَ رسالةٍ واحدة ═══

   لو كُتب HTML في كلّ قالبٍ على حدة لتفرّقت الهيئاتُ بعد شهر، ولوقع الخطأُ
   نفسُه في القالب الثامن. فالهيئةُ هنا **مرّةً واحدة**، والقوالبُ تصف
   *مضمونَها* لا شكلَها: فقرةٌ، وقائمةٌ، وجدولُ حقائق، وزرُّ دعوة. ثمّ يولّد
   هذا الملفّ منها النصَّ والـHTML معا من مصدرٍ واحد — فلا ينحرف أحدُهما عن
   الآخر، ومن يقرأ بنصٍّ خامّ (أو بقارئ شاشة) يقرأ الرسالةَ نفسَها.

   ═══ وقيودُ البريد ليست قيودَ المتصفّح ═══

   • **جداولُ لا شبكات**: Outlook يصيّر بمحرّك Word — لا `flex` ولا `grid`.
   • **أنماطٌ في السطر**: أكثرُ العملاء يحذف `<style>` من الرأس.
   • **لا صور في البنية**: الصورُ محجوبةٌ افتراضيّا في Gmail وOutlook، فما
     بُني عليها يصل مكسورا. والعلامةُ هنا نصٌّ لا صورة.
   • **أرضيّةٌ فاتحةٌ صريحة**: بلا `background` معلَنٍ يقلب الوضعُ الليليُّ
     في بعض العملاء النصَّ الداكنَ على أرضيّةٍ داكنة فيختفي.
   • **٦٠٠px**: عرضُ لوحةِ المعاينة في Outlook. وما زاد يُقصّ. */

/** لونُ العلامة — مكتوبٌ هنا حرفيّا لأنّ البريد لا يقرأ متغيّرات CSS */
const BRAND = {
  ink: '#162220',
  muted: '#4A5A57',
  hairline: '#E4E7E4',
  paper: '#F6F4EF',
  surface: '#FFFFFF',
  deep: '#12343B',
  teal: '#1F6E77',
  gold: '#6B5200',
  goldFill: '#FDF6E3',
} as const

const FONT = "'Segoe UI', Tahoma, Arial, 'Helvetica Neue', sans-serif"

/* ─────────── ما تصفه الرسالة ─────────── */

export type MailBlock =
  /** فقرةٌ عادية */
  | { kind: 'p'; text: string }
  /** عنوانٌ داخليٌّ يفصل قسما عمّا قبله */
  | { kind: 'h'; text: string }
  /** قائمةٌ منقّطة */
  | { kind: 'list'; items: string[] }
  /** جدولُ حقائق: تسميةٌ وقيمة — لتفاصيل الطلب ونحوها */
  | { kind: 'facts'; rows: { label: string; value: string }[] }
  /** زرُّ الدعوة — واحدٌ في الرسالة، وتحته الرابطُ نصّا لمن لا يضغط */
  | { kind: 'cta'; label: string; href: string; caption?: string }
  /** تنبيهٌ مؤطَّرٌ بلونٍ ذهبيّ — لما يُفوَّت إن قُرئ فقرةً */
  | { kind: 'callout'; text: string }
  /** سطرٌ خافتٌ في آخر المتن: «إن لم تكن أنت…» */
  | { kind: 'note'; text: string }

export interface MailDoc {
  /** «مرحبا فلان،» — يُبنى وحدَه فلا يُكتب في كلّ قالب */
  greetingName?: string
  /** عنوانٌ يُقرأ أوّلَ المتن — غالبا هو موضوعُ الرسالة بصيغةٍ أطول */
  heading: string
  blocks: MailBlock[]
}

/* ─────────── النصُّ الخام ─────────── */

function textOf(doc: MailDoc): string {
  const out: string[] = []
  if (doc.greetingName) out.push(`مرحبا ${doc.greetingName.trim() || 'بك'}،`, '')
  out.push(doc.heading, '')
  for (const b of doc.blocks) {
    switch (b.kind) {
      case 'p': out.push(b.text, ''); break
      case 'h': out.push(`── ${b.text} ──`, ''); break
      case 'list': out.push(...b.items.map((i) => `· ${i}`), ''); break
      case 'facts': out.push(...b.rows.map((r) => `${r.label}: ${r.value}`), ''); break
      /* و`caption` لا يُكتب في النصّ: هو «أو انسخ الرابط» — جملةٌ تُقال في
         الـHTML لمن يرى زرّا، ولا معنى لها حيث الرابطُ نفسُه معروضٌ أصلا. */
      case 'cta':
        out.push(`${b.label}:`, b.href, '')
        break
      case 'callout': out.push(`! ${b.text}`, ''); break
      case 'note': out.push(b.text, ''); break
    }
  }
  out.push('— أكاديمية وجيز')
  /* لا يزيد الفراغُ عن سطرين مهما تجاور الكتل */
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/* ─────────── الـHTML ─────────── */

/** ما يدخل الرسالةَ من بياناتِ مستخدمٍ يُهرَّب — الاسمُ والملاحظةُ يكتبهما بشر */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const P = `margin:0 0 14px;font-size:15px;line-height:1.9;color:${BRAND.ink};`

function htmlOf(doc: MailDoc): string {
  const parts: string[] = []

  if (doc.greetingName) {
    parts.push(`<p style="${P}font-weight:700;">مرحبا ${esc(doc.greetingName.trim() || 'بك')}،</p>`)
  }
  parts.push(
    `<h1 style="margin:0 0 18px;font-size:19px;line-height:1.6;font-weight:700;color:${BRAND.deep};">${esc(doc.heading)}</h1>`,
  )

  for (const b of doc.blocks) {
    switch (b.kind) {
      case 'p':
        parts.push(`<p style="${P}">${esc(b.text)}</p>`)
        break
      case 'h':
        parts.push(
          `<p style="margin:24px 0 10px;font-size:13px;font-weight:700;letter-spacing:.02em;color:${BRAND.teal};">${esc(b.text)}</p>`,
        )
        break
      case 'list':
        parts.push(
          `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px;">`
          + b.items.map((i) =>
            `<tr>`
            + `<td width="14" valign="top" style="padding:3px 0 3px 8px;font-size:15px;line-height:1.9;color:${BRAND.teal};">•</td>`
            + `<td style="padding:3px 0;font-size:15px;line-height:1.9;color:${BRAND.ink};">${esc(i)}</td>`
            + `</tr>`).join('')
          + `</table>`,
        )
        break
      case 'facts':
        parts.push(
          `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;border:1px solid ${BRAND.hairline};border-radius:10px;">`
          + b.rows.map((r, i) =>
            `<tr>`
            + `<td style="padding:10px 14px;font-size:13px;color:${BRAND.muted};white-space:nowrap;`
            + `${i ? `border-top:1px solid ${BRAND.hairline};` : ''}">${esc(r.label)}</td>`
            + `<td style="padding:10px 14px;font-size:14px;font-weight:700;color:${BRAND.ink};`
            + `${i ? `border-top:1px solid ${BRAND.hairline};` : ''}">${esc(r.value)}</td>`
            + `</tr>`).join('')
          + `</table>`,
        )
        break
      case 'cta':
        /* الزرُّ جدولٌ لا `<a>` بحشو: Outlook يتجاهل حشوَ الروابط فيصير الزرُّ سطرا */
        parts.push(
          `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 14px;">`
          + `<tr><td align="center" bgcolor="${BRAND.deep}" style="border-radius:999px;">`
          + `<a href="${esc(b.href)}" style="display:inline-block;padding:13px 30px;font-family:${FONT};`
          + `font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;">${esc(b.label)}</a>`
          + `</td></tr></table>`,
          /* والرابطُ نصّا تحته: من عطّل الروابطَ أو طبع الرسالةَ يحتاجه */
          `<p style="margin:0 0 14px;font-size:12px;line-height:1.7;color:${BRAND.muted};word-break:break-all;">`
          + `${esc(b.caption ? b.caption + ' ' : '')}<a href="${esc(b.href)}" style="color:${BRAND.teal};">${esc(b.href)}</a></p>`,
        )
        break
      case 'callout':
        parts.push(
          `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;">`
          + `<tr><td bgcolor="${BRAND.goldFill}" style="padding:12px 16px;border-radius:10px;border:1px solid #EADFBF;`
          + `font-size:14px;line-height:1.8;color:${BRAND.gold};font-weight:700;">${esc(b.text)}</td></tr></table>`,
        )
        break
      case 'note':
        parts.push(`<p style="margin:0 0 10px;font-size:13px;line-height:1.8;color:${BRAND.muted};">${esc(b.text)}</p>`)
        break
    }
  }

  return `<!doctype html>
<html dir="rtl" lang="ar"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(doc.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.paper};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.paper};">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:${BRAND.surface};border-radius:16px;overflow:hidden;border:1px solid ${BRAND.hairline};font-family:${FONT};" dir="rtl">

<tr><td bgcolor="${BRAND.deep}" style="padding:18px 28px;">
<span style="font-family:${FONT};font-size:17px;font-weight:700;color:#FFFFFF;">أكاديمية وجيز</span>
<span style="font-family:${FONT};font-size:13px;color:#8FC9D1;padding-right:10px;">الفهم قبل البيع</span>
</td></tr>

<tr><td style="padding:26px 28px 8px;" dir="rtl" align="right">
${parts.join('\n')}
</td></tr>

<tr><td style="padding:0 28px 24px;">
<div style="border-top:1px solid ${BRAND.hairline};padding-top:14px;font-size:12px;line-height:1.8;color:${BRAND.muted};">
أكاديمية وجيز — من مجموعة وجيز wajeez.com<br>
هذه رسالةٌ آليّة؛ وردُّك عليها يصل فريقَ الدعم.
</div>
</td></tr>

</table>
</td></tr></table>
</body></html>`
}

/** يولّد الصيغتين من وصفٍ واحد — فلا تنحرف إحداهما عن الأخرى */
export function renderMail(doc: MailDoc): { text: string; html: string } {
  return { text: textOf(doc), html: htmlOf(doc) }
}
