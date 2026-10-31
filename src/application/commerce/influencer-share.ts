/* ═══ «صمم منشورك» للمؤثّر — نصُّ المنحة لكلّ منصّة، ورابطُ مشاركتها (٢٦ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «امنح المؤثّرَ تصاميمَ يشاركها مع عملائه ليمثّل المنحةَ والتقديمَ عبر الرابط الذي يُرفقه بالنصّ،
   كما فعلنا للمدرّب». فالمنصّاتُ والأبوابُ نفسُها (`trainer/share-kit.ts`)، والمحتوى المنحة: نسبتُها، وعددُ دوراتها،
   وآخرُ يومٍ لها، والكودُ الخاصّ به — والرابطُ صفحةُ منحته (`/grant/i/<كوده>`) لا دورات مدرّب.

   والمنحةُ بنسبتها لا بما يبقى («تصل إلى ٤٥٪» لا «تدفع ٥٥٪») — قرارُه (٢٥ أكتوبر ٢٠٢٦) كسطر صفحتها. و«٪» العربيّةُ
   لا «%»: اللاتينيّةُ تنقلب في السطر العربيّ. والحارس: `src/tests/commerce/influencer-share.test.ts`.

   ═══ وافتتاحُه بكلام المؤثّر لجمهوره (٣١ أكتوبر ٢٠٢٦) ═══
   قال صاحبُ المنصّة: «تخيّل المؤثّرَ يريد أن يقول لجمهوره: إلى محبّي الدورات التدريبيّة وإلى عشّاق التدريب العمليّ
   والتدريب المباشر عبر منصّةٍ احترافيّة، أبشّركم اليوم أنّي سأقدّم منحةً لكلّ من يستخدم هذا الرابط من متابعيني»،
   و«منحتي لكم تصل إلى ٤٥… بل أمنحكم منحةً تصل قيمتُها ٤٥٪ على دورات وجيز بسبب انطلاقتها الأولى». فهذا أوّلُه. */

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

/** الافتتاح — كلامُه لجمهوره */
function opener(g: GrantShareInput, bold: (t: string) => string): string[] {
  return [
    'إلى محبي الدورات التدريبية وعشاق التدريب العملي والمباشر عبر منصة احترافية 👇',
    `أبشركم اليوم بمنحة خاصة لمتابعيني تصل إلى ${bold(`${g.percentOff}٪`)} على دورات أكاديمية وجيز، بمناسبة انطلاقتها الأولى 🎉`,
  ]
}

/** ما في المنحة — سطرٌ لكلّ ميزة */
function points(g: GrantShareInput): string[] {
  return [
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
    return [`أبشركم بمنحة خاصة لمتابعيني تصل إلى ${g.percentOff}٪ على دورات أكاديمية وجيز 🎁`, `🎟 بالكود ${g.code}`, 'احجز منحتك 👇', g.url].join('\n')
  }
  if (platform === 'email') {
    return [
      'مرحبا،', '',
      ...opener(g, b), '',
      ...points(g), '',
      `الكود الخاص بي: ${g.code}`, '',
      'احجز منحتك من هنا:', g.url, '',
      'أتمنى أن تفيدك،', g.nameAr,
    ].join('\n')
  }
  return [
    ...opener(g, b), '',
    ...points(g), '',
    codeLine, '',
    ...(social ? ['🔗 الرابط في البايو', '', HASH] : ['احجز منحتك 👇', g.url]),
    ...(platform === 'linkedin' ? ['', '#أكاديمية_وجيز #تطوير_مهني'] : []),
  ].join('\n')
}

/** عنوانُ البريد */
export function grantEmailSubject(g: GrantShareInput): string {
  return `منحة خاصة لمتابعيني — تصل إلى ${g.percentOff}٪ على دورات أكاديمية وجيز`
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
