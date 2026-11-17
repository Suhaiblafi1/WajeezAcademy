/* ═══ عُدّةُ بلاك فرايدي للمدرّب — رابطُه ونصوصُه (١٧ نوفمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة وهو يكتب للمدرّبين: «قدّمنا منحةً تصل إلى ٨٠٪ للجميع، والمطلوب منكم نشرُها عبر صفحاتكم
   بالرابط المخصّص… والتصميم المرفق للبوست والستوري أو حتى إيميل، وأرفقنا لكم نصَّ مسوّدةٍ لاستخدامه متى ما شئتم،
   وتجدون التصميمَ والنصوصَ أيضا في صفحة التسويق الخاصّة بكم».

   ═══ ما يقع ═══

   · **رابطُه** صفحةُ المنحة برمز رابطه الواسع (`?ref=`) — فمن عبّأ النموذجَ منه يُرى في قائمة المنحة بمدرّبه
     (`grant-registrants.service.ts` يقرأ `refCode`). والرمزُ رمزُ «شارك دوراتك» نفسُه، لا رمزٌ جديد.
   · **ونصوصُه بلسانه** — منشورٌ وبريدٌ وواتساب، برابطه ونسبةِ المنحة وحدِّ دوراتها وآخرِ يومها **كما هي اليوم**
     (`/api/public/grant/bf`)، لا أرقامٌ مكتوبةٌ باليد تفترق عن المنحة إن تغيّرت.
   · **والتصميمُ** ملفّان في `public/campaigns/bf2026/` — المنشورُ والقصّة.

   والعرضُ في `src/components/trainer/BlackFridayKit.tsx`، والحارس: `src/tests/trainer/bf-kit.test.ts`. */

import { fmtDateWith } from '../text/format-ar'

/** التصميمُ المرفق — كما أُرسل لصاحب المنصّة ووافق عليه */
export const BF_KIT_DESIGNS = [
  { key: 'post', labelAr: 'منشور', size: '1080×1350', src: '/campaigns/bf2026/wajeez-bf80-post.jpg' },
  { key: 'story', labelAr: 'قصة', size: '1080×1920', src: '/campaigns/bf2026/wajeez-bf80-story.jpg' },
] as const

/** رابطُ المدرّب إلى المنحة — برمز رابطه الواسع */
export function bfKitLink(origin: string, refCode: string): string {
  return `${origin.replace(/\/+$/, '')}/grant/bf?ref=${encodeURIComponent(refCode)}`
}

/** آخرُ يومٍ كما يُقال: «السبت 21 نوفمبر» — نهايةُ المنحة أوّلُ اليوم التالي بتوقيت عمّان */
export function bfLastDayAr(closesAt: string | Date): string {
  const last = new Date(new Date(closesAt).getTime() - 1)
  return fmtDateWith(last, { weekday: 'long', day: 'numeric', month: 'long' }).replace('،', '')
}

export interface BfKitInput {
  link: string
  percentOff: number
  maxCourses: number
  /** «السبت 21 نوفمبر» — أو `null` إن لم يكن للمنحة آخرُ يوم */
  lastDayAr: string | null
  /** اسمُه في توقيع البريد — وبلا اسمٍ لا توقيع */
  name?: string | null
}

export interface BfKitTexts { social: string; emailSubject: string; email: string; whatsapp: string }

/** نصوصُه الثلاثة بلسانه — يُنسخ كلٌّ كما هو */
export function bfKitTexts(k: BfKitInput): BfKitTexts {
  const until = k.lastDayAr ? `، حتى ${k.lastDayAr}` : ''
  const social = [
    `منحة بلاك فرايدي من أكاديمية وجيز: ${k.percentOff}% على كل دورة${until}.`,
    'أدرّب في أكاديمية وجيز مع مدربين ومدربات من أهل الميدان، في دورات مباشرة تبني مسارك المهني.',
    `خذ كودك من رابطي:\n${k.link}`,
  ].join('\n\n')
  const email = [
    'مرحبا،',
    `أدرّب في أكاديمية وجيز، وأحببت أن أشاركك منحة بلاك فرايدي: ${k.percentOff}% على كل دورة، حتى ${k.maxCourses} دورات${until}.`,
    'دورات مباشرة يقودها مدربون ومدربات من أهل الميدان: لقاءات حية، ومهام من واقع العمل، وشهادة عند الإتمام.',
    `خذ كودك من رابطي، يصلك فور تعبئة نموذج قصير:\n${k.link}`,
    k.name ? `مع التقدير،\n${k.name}` : 'مع التقدير،',
  ].join('\n\n')
  const whatsapp = `منحة بلاك فرايدي من أكاديمية وجيز: ${k.percentOff}% على كل دورة${until}.\nخذ كودك من رابطي:\n${k.link}`
  return { social, emailSubject: `منحة ${k.percentOff}% على دورات أكاديمية وجيز`, email, whatsapp }
}
