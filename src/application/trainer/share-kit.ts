/* ═══ «شارك دوراتك» — نصٌّ جاهزٌ لكلّ منصّة، ورابطُ مشاركتها (٢٦ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «عندما أضغط على شير أختار ما بين إنستغرام وواتساب وفيسبوك وتيك توك ولينكدإن… يفتح لي صفحة
   اللينكدإن مع بوستٍ جاهز… وفي حالة أن وضع المدرّب كود خصم يظهر هذا الكود». فلكلّ منصّةٍ نصُّها بعادتها:

   · **واتساب** — قصيرٌ يُقرأ في المحادثة، والرابطُ آخرَه.
   · **لينكدإن وفيسبوك** — أطولُ قليلا بنبرة المهنة، والرابطُ يُعاينه كلٌّ منهما.
   · **إنستغرام وتيك توك** — لا رابطَ يُنقر في المنشور: «الرابط في البايو»، والكودُ هو ما يُحمل.

   وأبوابُ المنصّات كما تقبلها اليوم: واتساب ولينكدإن يقبلان النصَّ كاملا في الرابط، وفيسبوك يقبل الرابطَ وحدَه
   (فالنصُّ يُنسخ قبله)، وإنستغرام وتيك توك لا بابَ لهما من موقع — الصورةُ تُشارَك من الهاتف أو تُنزَّل.

   والكودُ الظاهرُ أعلى الخصمين: خصمُنا (`SHARE_CODE_PERCENT`) أو كودٌ أصدره هو بنسبةٍ أعلى — وسقفُ كوده ثلاثون
   كخصمنا (البند 4-10)، فلا يعلو عليه، ويظهر كودُه إن ساواه وهو اختاره. ومحضةٌ هنا لتُختبر وتقرأها الشاشة. */

import { waShare } from '../site/whatsapp'

export type SharePlatform = 'whatsapp' | 'linkedin' | 'facebook' | 'x' | 'instagram' | 'tiktok'

export const SHARE_PLATFORMS: { id: SharePlatform; ar: string; opens: boolean }[] = [
  { id: 'whatsapp', ar: 'واتساب', opens: true },
  { id: 'linkedin', ar: 'لينكدإن', opens: true },
  { id: 'facebook', ar: 'فيسبوك', opens: true },
  { id: 'x', ar: 'إكس', opens: true },
  { id: 'instagram', ar: 'إنستغرام', opens: false },
  { id: 'tiktok', ar: 'تيك توك', opens: false },
]

export interface ShareCourse { courseTitle: string; startsAt: string | null; url: string }

export interface ShareInput {
  /** دورةٌ واحدةٌ برابط شعبتها، أو دوراتُه كلُّها برابطه العامّ */
  courses: ShareCourse[]
  /** رابطُ ما يُشارَك — رابطُ الشعبة أو الرابطُ العامّ */
  url: string
  code: { code: string; percentOff: number } | null
  /** «31 أكتوبر» — يمرّره من يملك المنطقةَ الزمنيّة */
  dayAr: (iso: string) => string
}

/** أعلى الخصمين — خصمُنا أو كودُه — ويغلب كودُه إن ساواه: هو اختاره لجمهوره */
export function bestCode(
  ours: { code: string; percentOff: number } | null,
  his: { code: string; percentOff: number | null }[],
): { code: string; percentOff: number } | null {
  let best = ours
  for (const c of his) {
    if (c.percentOff == null) continue
    if (!best || c.percentOff >= best.percentOff) best = { code: c.code, percentOff: c.percentOff }
  }
  return best
}

const startsAr = (c: ShareCourse, dayAr: ShareInput['dayAr']) => (c.startsAt ? `، تبدأ ${dayAr(c.startsAt)}` : '')

/** النصُّ لكلّ منصّة */
export function shareText(platform: SharePlatform, x: ShareInput): string {
  const one = x.courses.length === 1 ? x.courses[0] : null
  const code = x.code ? `خصم ${x.code.percentOff}% بالكود ${x.code.code}` : null
  const list = x.courses.map((c) => `· ${c.courseTitle}${startsAr(c, x.dayAr)}`)
  const social = platform === 'instagram' || platform === 'tiktok'

  if (platform === 'whatsapp' || platform === 'x') {
    return [
      one ? `أقدم دورة «${one.courseTitle}» في أكاديمية وجيز${startsAr(one, x.dayAr)}.` : 'دوراتي في أكاديمية وجيز هذا الموسم:',
      ...(one ? [] : list),
      ...(code ? [code] : []),
      `سجل من هنا: ${x.url}`,
    ].join('\n')
  }
  if (social) {
    return [
      one ? `أقدم دورة «${one.courseTitle}» في أكاديمية وجيز${startsAr(one, x.dayAr)}.` : 'دوراتي في أكاديمية وجيز هذا الموسم:',
      ...(one ? [] : list),
      'لقاءات مباشرة على Zoom.',
      ...(code ? [`${code} 🎁`] : []),
      'الرابط في البايو.',
      '',
      '#أكاديمية_وجيز #تعلم #تطوير_الذات',
    ].join('\n')
  }
  /* لينكدإن وفيسبوك */
  return [
    one ? `يسعدني أن أقدم دورة «${one.courseTitle}» مع أكاديمية وجيز${startsAr(one, x.dayAr)}.` : 'يسعدني أن أقدم هذه الدورات مع أكاديمية وجيز هذا الموسم:',
    ...(one ? [] : list),
    'لقاءات مباشرة على Zoom، ومقاعد محدودة.',
    ...(code ? [`ولمن يتابعني ${code}.`] : []),
    '',
    `التفاصيل والتسجيل: ${x.url}`,
  ].join('\n')
}

/** بابُ المنصّة — أو `null` لما لا بابَ له من موقع (إنستغرام وتيك توك) */
export function shareUrl(platform: SharePlatform, x: ShareInput): string | null {
  const e = encodeURIComponent
  if (platform === 'whatsapp') return waShare(shareText('whatsapp', x))
  if (platform === 'linkedin') return `https://www.linkedin.com/feed/?shareActive=true&text=${e(shareText('linkedin', x))}`
  if (platform === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${e(x.url)}`
  if (platform === 'x') return `https://x.com/intent/post?text=${e(shareText('x', x))}`
  return null
}
