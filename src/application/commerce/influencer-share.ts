/* ═══ «صمم منشورك» للمؤثّر — نصُّ المنحة لكلّ منصّة، ورابطُ مشاركتها (٢٦ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «امنح المؤثّرَ تصاميمَ يشاركها مع عملائه ليمثّل المنحةَ والتقديمَ عبر الرابط الذي يُرفقه بالنصّ،
   كما فعلنا للمدرّب». فالمنصّاتُ والأبوابُ نفسُها (`trainer/share-kit.ts`)، والمحتوى المنحة: نسبتُها، وعددُ دوراتها،
   وآخرُ يومٍ لها، والكودُ الخاصّ به — والرابطُ صفحةُ منحته (`/grant/i/<كوده>`) لا دورات مدرّب.

   والمنحةُ بنسبتها لا بما يبقى («تصل إلى ٤٥٪» لا «تدفع ٥٥٪») — قرارُه (٢٥ أكتوبر ٢٠٢٦) كسطر صفحتها. و«٪» العربيّةُ
   لا «%»: اللاتينيّةُ تنقلب في السطر العربيّ. والحارس: `src/tests/commerce/influencer-share.test.ts`. */

import { waShare } from '../site/whatsapp'
import type { SharePlatform } from '../trainer/share-kit'

export interface GrantShareInput {
  /** اسمُ المؤثّر — توقيعُ البريد */
  nameAr: string
  code: string
  percentOff: number
  maxCourses: number
  /** «30 أكتوبر» — آخرُ يومٍ للمنحة، أو لا شيء إن لم يكن لها آخر */
  lastDayAr: string | null
  /** صفحةُ منحته — `/grant/i/<كوده>` */
  url: string
}

const HASH = '#أكاديمية_وجيز #منحة #تعلم'

/** ما في المنحة — سطرٌ لكلّ ميزة */
function points(g: GrantShareInput, bold: (t: string) => string): string[] {
  return [
    `✅ تصل إلى ${bold(`${g.percentOff}٪`)} من سعر الدورات`,
    `📚 اختر حتى ${g.maxCourses} دورات`,
    '💻 لقاءات مباشرة على Zoom، وشهادة موثقة لكل دورة',
    ...(g.lastDayAr ? [`🗓 آخر يوم: ${g.lastDayAr}`] : []),
  ]
}

/** النصُّ لكلّ منصّة */
export function grantShareText(platform: SharePlatform, g: GrantShareInput): string {
  const wa = platform === 'whatsapp'
  const b = (t: string) => (wa ? `*${t}*` : t)
  const social = platform === 'instagram' || platform === 'tiktok'
  const codeLine = `🎟 الكود الخاص بي: ${b(g.code)}`

  if (platform === 'x') {
    return [`منحة من أكاديمية وجيز تصل إلى ${g.percentOff}٪ من سعر الدورات 🎁`, `🎟 بالكود ${g.code}`, 'احجز منحتك 👇', g.url].join('\n')
  }
  if (platform === 'email') {
    return [
      'مرحبا،', '',
      'يسعدني أن أهديك منحة من أكاديمية وجيز:', '',
      ...points(g, b), '',
      `الكود الخاص بي: ${g.code}`, '',
      'احجز منحتك من هنا:', g.url, '',
      'أتمنى أن تفيدك،', g.nameAr,
    ].join('\n')
  }
  const opener = wa ? ['مرحبا 👋', 'عندي لكم منحة من أكاديمية وجيز 🎁'] : ['يسعدني أن أشارككم منحة من أكاديمية وجيز 🎁']
  return [
    ...opener, '',
    ...points(g, b), '',
    codeLine, '',
    ...(social ? ['🔗 الرابط في البايو', '', HASH] : ['احجز منحتك 👇', g.url]),
    ...(platform === 'linkedin' ? ['', '#أكاديمية_وجيز #تطوير_مهني'] : []),
  ].join('\n')
}

/** عنوانُ البريد */
export function grantEmailSubject(g: GrantShareInput): string {
  return `منحة من أكاديمية وجيز — تصل إلى ${g.percentOff}٪ من سعر الدورات`
}

/** بابُ المنصّة — أو `null` لما لا بابَ له من موقع (إنستغرام وتيك توك) */
export function grantShareUrl(platform: SharePlatform, g: GrantShareInput): string | null {
  const e = encodeURIComponent
  if (platform === 'whatsapp') return waShare(grantShareText('whatsapp', g))
  if (platform === 'linkedin') return `https://www.linkedin.com/feed/?shareActive=true&text=${e(grantShareText('linkedin', g))}`
  if (platform === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${e(g.url)}`
  if (platform === 'x') return `https://x.com/intent/post?text=${e(grantShareText('x', g))}`
  if (platform === 'email') return `mailto:?subject=${e(grantEmailSubject(g))}&body=${e(grantShareText('email', g))}`
  return null
}
