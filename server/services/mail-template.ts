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
   • **ولا شيءَ يُبنى على صورة**: الصورُ محجوبةٌ افتراضيّا في Gmail وOutlook،
     فما بُني عليها يصل مكسورا. والعلامةُ صورةٌ **بجانب** اسمٍ مكتوب، فمن
     حجبها قرأ الاسمَ ولم تصله رسالةٌ بلا هويّة.
   • **أرضيّةٌ فاتحةٌ صريحة**: بلا `background` معلَنٍ يقلب الوضعُ الليليُّ
     في بعض العملاء النصَّ الداكنَ على أرضيّةٍ داكنة فيختفي.
   • **٦٠٠px**: عرضُ لوحةِ المعاينة في Outlook. وما زاد يُقصّ.

   ═══ ثلاثُ شكاوى في ١٧ سبتمبر ٢٠٢٦، وما تغيّر لها ═══

   صاحبُ المنصّة: «الإيميلات التي تصل المستخدمين بكافّة أنواعها أشعر أنّها
   تفقد هويّتنا كأكاديمية وجيز، والروابطُ فيها مفتوحةٌ بدل هايبرلينك في
   كلمة، وأيضا عدمُ وجود اللوقو الخاصّ فينا».

   ① **العلامةُ تُرى**: الترويسةُ كانت شريطا داكنا عليه الاسمُ نصّا. وصارت
      بيضاءَ تحمل `logo-mark.png` وإلى جانبه الاسمُ والشعار. وبياضُها ليس
      ذوقا: العلامةُ شكلٌ فيروزيٌّ على شفافيّة، فعلى الداكن تذوب حروفُها.
      واللونُ لا يضيع: شريطٌ من لون العلامة فوق البطاقة يُرى قبل أن تُحمَّل
      صورةٌ أصلا — فالهويّةُ تصل حتّى لمن حجب الصور.

   ② **ولا عنوانَ عاريا في وسط جملة**: كان يُكتب `https://…/auth` في متن
      القائمة فيراه القارئُ سطرا تقنيّا يقطع الجملة. فصار النصُّ يقبل
      **رابطا على كلمةٍ منه** (`MailRich`)، والعنوانُ يبقى في النصّ الخامّ
      بين قوسين — إذ لا ضغطَ فيه.

   ③ **والزرُّ لا يُتبَع بعنوانه مكتوبا**: كان تحت كلِّ زرٍّ سطرٌ يعرض
      الرابطَ كاملا «لمن لا يضغط». ورمزُ التوثيق أربعون محرفا فوق العنوان،
      فيلتفّ سطرَين مقطّعَين — وهو ما رآه صاحبُ المنصّة. وبديلُه سطرٌ خافتٌ
      على كلمات، والعنوانُ كاملا في النصّ الخامّ حيث لا زرَّ يُضغط.

   ═══ وما يُبعد الرسالةَ عن صندوق الإزعاج ═══

   قيلت الشكوى مع «لا يأخذنا على سبام»، وهذه أربعةٌ مقصودةٌ لأجلها:
   نصٌّ خامٌّ مع كلِّ رسالةٍ يطابق الـHTML (رسالةٌ بلا نصٍّ علامةٌ معروفة)،
   وسطرُ معاينةٍ يقول الخبرَ، وصورةٌ واحدةٌ صغيرةٌ لا رسالةٌ مبنيّةٌ على
   صورة، ولا عناوينَ خامّةً طويلةً في المتن. أمّا نطاقُ الإرسال وتوقيعُه
   (SPF وDKIM وDMARC) فليس من شأن هذا الملفّ — وهو في `deploy/`. */

import { publicSiteUrl } from './site-url'

/** لونُ العلامة — مكتوبٌ هنا حرفيّا لأنّ البريد لا يقرأ متغيّرات CSS */
const BRAND = {
  ink: '#162220',
  muted: '#4A5A57',
  hairline: '#E4E7E4',
  paper: '#F6F4EF',
  surface: '#FFFFFF',
  /** أرضيّةُ التذييل — أفتحُ من الورق وأخفتُ من البطاقة، ففاصلٌ بلا خطٍّ ثقيل */
  footer: '#FBFAF8',
  deep: '#12343B',
  teal: '#1F6E77',
  gold: '#6B5200',
  goldFill: '#FDF6E3',
} as const

const FONT = "'Segoe UI', Tahoma, Arial, 'Helvetica Neue', sans-serif"

/** موقعُ المجموعة — يُكتب كلمةً تُضغَط لا نطاقا عاريا في التذييل */
const GROUP_URL = 'https://wajeez.com'

/* ─────────── ما تصفه الرسالة ─────────── */

/** رابطٌ يُحمَل على كلماتٍ من الجملة */
export interface MailLink {
  text: string
  href: string
}

/** نصٌّ قد يحمل في وسطه رابطا على كلمة.
 *
 *  سلسلةٌ مجرّدةٌ تبقى مقبولةً كما هي — فما لا رابطَ فيه يُكتب كما كان. */
export type MailRich = string | (string | MailLink)[]

export type MailBlock =
  /** فقرةٌ عادية */
  | { kind: 'p'; text: MailRich }
  /** عنوانٌ داخليٌّ يفصل قسما عمّا قبله */
  | { kind: 'h'; text: string }
  /** قائمةٌ منقّطة */
  | { kind: 'list'; items: MailRich[] }
  /** جدولُ حقائق: تسميةٌ وقيمة — لتفاصيل الطلب ونحوها */
  | { kind: 'facts'; rows: { label: string; value: string }[] }
  /** زرُّ الدعوة — واحدٌ في الرسالة.
   *
   *  و`caption` سطرٌ خافتٌ تحته يقول شيئا عن الوجهة («يُفتح بلا كلمة مرور»
   *  مثلا). ولا يُستعمل لتقديم عنوانٍ مكتوب: العنوانُ لا يُكتب في الـHTML
   *  أصلا، ومكتوبٌ فوقُ لماذا. */
  | { kind: 'cta'; label: string; href: string; caption?: string }
  /** تنبيهٌ مؤطَّرٌ بلونٍ ذهبيّ — لما يُفوَّت إن قُرئ فقرةً */
  | { kind: 'callout'; text: MailRich }
  /** سطرٌ خافتٌ في آخر المتن: «إن لم تكن أنت…».
   *
   *  و`link` اختياريٌّ لأنّ عنوانا في سطرٍ خافتٍ كان يخرج **نصّا لا يُضغط**:
   *  رابطُ التفضيلات ظهر `https://…/student/notifications` مكتوبا، فعلى
   *  قارئه أن يحدّده وينسخه ويلصقه. وما لا يُضغط في بريدٍ لا يُزار. */
  | { kind: 'note'; text: MailRich; link?: { label: string; href: string } }

export interface MailDoc {
  /** «مرحبا فلان،» — يُبنى وحدَه فلا يُكتب في كلّ قالب */
  greetingName?: string
  /** سطرُ المعاينة في صندوق الوارد — يُعرض بجانب الموضوع ولا يُرى في الرسالة.
   *
   *  وبلا هذا السطر يأخذ عميلُ البريد أوّلَ نصٍّ يجده، وهو «مرحبا فلان،» —
   *  فيُهدَر أنفعُ سطرٍ في الصندوق على تحيّةٍ لا خبرَ فيها. ومن لم يُعطِه
   *  أخذ الأوّلَ من متنه، وهو خيرٌ من التحيّة. */
  preheader?: string
  /** عنوانٌ يُقرأ أوّلَ المتن — غالبا هو موضوعُ الرسالة بصيغةٍ أطول */
  heading: string
  blocks: MailBlock[]
}

/* ─────────── النصُّ الخام ─────────── */

/** الرابطُ في النصّ الخامّ: الكلماتُ ثمّ عنوانُها بين قوسين.
 *
 *  ولا يُحذف العنوان: النصُّ الخامُّ هو ما يراه من عطّل الـHTML أو طبع
 *  الرسالة، ولا زرَّ فيه ولا كلمةَ تُضغط — فالعنوانُ هناك هو الطريق. */
function richText(v: MailRich): string {
  if (typeof v === 'string') return v
  return v.map((part) => (typeof part === 'string' ? part : `${part.text} (${part.href})`)).join('')
}

function textOf(doc: MailDoc): string {
  const out: string[] = []
  if (doc.greetingName) out.push(`مرحبا ${doc.greetingName.trim() || 'بك'}،`, '')
  out.push(doc.heading, '')
  for (const b of doc.blocks) {
    switch (b.kind) {
      case 'p': out.push(richText(b.text), ''); break
      case 'h': out.push(`── ${b.text} ──`, ''); break
      case 'list': out.push(...b.items.map((i) => `· ${richText(i)}`), ''); break
      case 'facts': out.push(...b.rows.map((r) => `${r.label}: ${r.value}`), ''); break
      /* و`caption` لا يُكتب في النصّ: هو وصفٌ للزرّ، ولا زرَّ هنا — والوجهةُ
         نفسُها معروضةٌ في السطر التالي عنوانا كاملا. */
      case 'cta':
        out.push(`${b.label}:`, b.href, '')
        break
      case 'callout': out.push(`! ${richText(b.text)}`, ''); break
      case 'note': out.push(b.link ? `${richText(b.text)} ${b.link.href}` : richText(b.text), ''); break
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
/** هيئةُ الرابط في المتن — يُرى أنّه رابطٌ بلونه وخطّه لا بطوله */
const LINK = `color:${BRAND.teal};font-weight:700;text-decoration:underline;`

function anchor(href: string, label: string, style = LINK): string {
  return `<a href="${esc(href)}" style="${style}">${esc(label)}</a>`
}

/** النصُّ مرمَّزا — وكلُّ ما جاء من بشرٍ يُهرَّب، رابطا كان أو بين رابطَين */
function richHtml(v: MailRich): string {
  if (typeof v === 'string') return esc(v)
  return v.map((part) => (typeof part === 'string' ? esc(part) : anchor(part.href, part.text))).join('')
}

function htmlOf(doc: MailDoc): string {
  const parts: string[] = []

  /* أوّلُ فقرةٍ إن لم يُكتب سطرُ معاينةٍ صراحةً — ومقصوصةٌ عند حدٍّ معقول:
     ما زاد على نحوِ مئةِ محرفٍ يقطعه الصندوقُ نفسُه. */
  const firstP = doc.blocks.find((b) => b.kind === 'p')
  const preheader = (doc.preheader ?? (firstP && 'text' in firstP ? richText(firstP.text as MailRich) : doc.heading))
    .replace(/\s+/g, ' ').trim().slice(0, 140)

  if (doc.greetingName) {
    parts.push(`<p style="${P}font-weight:700;">مرحبا ${esc(doc.greetingName.trim() || 'بك')}،</p>`)
  }
  parts.push(
    `<h1 style="margin:0 0 18px;font-size:19px;line-height:1.6;font-weight:700;color:${BRAND.deep};">${esc(doc.heading)}</h1>`,
  )

  for (const b of doc.blocks) {
    switch (b.kind) {
      case 'p':
        parts.push(`<p style="${P}">${richHtml(b.text)}</p>`)
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
            + `<td style="padding:3px 0;font-size:15px;line-height:1.9;color:${BRAND.ink};">${richHtml(i)}</td>`
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
          `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 12px;">`
          + `<tr><td align="center" bgcolor="${BRAND.deep}" style="border-radius:999px;">`
          + `<a href="${esc(b.href)}" style="display:inline-block;padding:13px 30px;font-family:${FONT};`
          + `font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;">${esc(b.label)}</a>`
          + `</td></tr></table>`,
          /* ومخرجٌ لمن لم يعمل عنده الزرُّ — على كلماتٍ لا على عنوانٍ مكتوب.
             والعنوانُ كاملا في النصّ الخامّ، وهو موضعُه. */
          `<p style="margin:0 0 14px;font-size:12px;line-height:1.8;color:${BRAND.muted};">`
          + `${b.caption ? esc(b.caption) + ' ' : ''}`
          + `لم يعمل الزرّ؟ ${anchor(b.href, 'افتح الرابط مباشرةً', `color:${BRAND.teal};text-decoration:underline;`)}.`
          + `</p>`,
        )
        break
      case 'callout':
        parts.push(
          `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;">`
          + `<tr><td bgcolor="${BRAND.goldFill}" style="padding:12px 16px;border-radius:10px;border:1px solid #EADFBF;`
          + `font-size:14px;line-height:1.8;color:${BRAND.gold};font-weight:700;">${richHtml(b.text)}</td></tr></table>`,
        )
        break
      case 'note':
        parts.push(
          `<p style="margin:0 0 10px;font-size:13px;line-height:1.8;color:${BRAND.muted};">${richHtml(b.text)}`
          + (b.link ? ` ${anchor(b.link.href, b.link.label)}` : '')
          + `</p>`,
        )
        break
    }
  }

  const site = publicSiteUrl()

  return `<!doctype html>
<html dir="rtl" lang="ar"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(doc.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.paper};">
<!-- سطرُ المعاينة: يقرؤه صندوقُ الوارد ولا يظهر في الرسالة. والمسافاتُ
     الصفريّةُ بعده تمنع العميلَ من ضمّ ما بعده إلى المعاينة. -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.paper};opacity:0;">${esc(preheader)}${'&#8203;&nbsp;'.repeat(30)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.paper};">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:${BRAND.surface};border-radius:16px;overflow:hidden;border:1px solid ${BRAND.hairline};font-family:${FONT};" dir="rtl">

<!-- شريطُ العلامة: لونٌ يُرى قبل أن تُحمَّل صورةٌ أصلا. وحجمُ الخطّ صفرا
     مع ارتفاعِ سطرٍ معلَن لازمان، وإلّا فرض Outlook ارتفاعَ سطرٍ كاملا. -->
<tr><td bgcolor="${BRAND.deep}" style="height:4px;line-height:4px;font-size:0;">&#8203;</td></tr>

<!-- الترويسة: العلامةُ صورةً، والاسمُ نصّا بجانبها.
     وبياضُها لأنّ العلامةَ شكلٌ فيروزيٌّ على شفافيّة — على الداكن تذوب.
     ونصُّ alt يحمل الاسمَ: من حجب الصورَ يقرؤه مكانَها. -->
<tr><td style="padding:22px 28px 18px;border-bottom:1px solid ${BRAND.hairline};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="44" valign="middle" style="width:44px;">
<img src="${esc(site)}/logo-mark.png" width="44" height="44" alt="أكاديمية وجيز" style="display:block;width:44px;height:44px;border:0;outline:none;text-decoration:none;">
</td>
<td valign="middle" style="padding-right:12px;">
<div style="font-family:${FONT};font-size:17px;font-weight:700;line-height:1.4;color:${BRAND.ink};">أكاديمية وجيز</div>
<div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${BRAND.teal};">الفهم قبل البيع</div>
</td>
</tr>
</table>
</td></tr>

<tr><td style="padding:26px 28px 10px;" dir="rtl" align="right">
${parts.join('\n')}
</td></tr>

<tr><td bgcolor="${BRAND.footer}" style="padding:16px 28px 20px;border-top:1px solid ${BRAND.hairline};">
<div style="font-size:12px;line-height:1.9;color:${BRAND.muted};">
${anchor(site, 'أكاديمية وجيز', `color:${BRAND.teal};font-weight:700;text-decoration:none;`)} — من ${anchor(GROUP_URL, 'مجموعة وجيز', `color:${BRAND.teal};text-decoration:none;`)}<br>
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
