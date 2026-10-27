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
import { plainAr } from '../text/plain-ar'

export type SharePlatform = 'whatsapp' | 'linkedin' | 'facebook' | 'x' | 'instagram' | 'tiktok' | 'email'

export const SHARE_PLATFORMS: { id: SharePlatform; ar: string; opens: boolean }[] = [
  { id: 'whatsapp', ar: 'واتساب', opens: true },
  { id: 'linkedin', ar: 'لينكدإن', opens: true },
  { id: 'facebook', ar: 'فيسبوك', opens: true },
  { id: 'x', ar: 'إكس', opens: true },
  { id: 'instagram', ar: 'إنستغرام', opens: false },
  { id: 'tiktok', ar: 'تيك توك', opens: false },
  /* والبريدُ (٢٦ أكتوبر ٢٠٢٦): «أضف إيميلا كدعاية يستخدمها المدرّب إن أراد أن يرسل الدعاية عبر الإيميل» —
     يُفتح بريدُه برسالةٍ جاهزةٍ بعنوانها، ويختار هو لمن يرسلها */
  { id: 'email', ar: 'البريد', opens: true },
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
  /** توقيعُ البريد — اسمُه */
  signature?: string
  /** إعلانُ انضمامه أو دعوةٌ لدوراته — وبلا ذكرٍ دعوة */
  mode?: ShareMode
  /** صفتُه كما كتبها في ملفّه العامّ — «مدربة ومستشارة استدامة» */
  headline?: string | null
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

/* ═══ ونصٌّ يُقرأ ويُغري — لا سطرٌ مكتظّ (٢٦ أكتوبر ٢٠٢٦) ═══

   رأى صاحبُ المنصّة الرسالةَ في واتساب: عناوينُ طويلةٌ بعناوينها الفرعيّة ملصوقةٌ بالتاريخ، ونقاطٌ صغيرة، والكودُ
   والرابطُ في ذيلها — فقال: «لا تبدو احترافيّة.. يجب أن تكون سهلةَ القراءة وممتعةً ومحفّزةً للشراء». فصار:
   · **اسمُ الدورة قصيرا** — ما قبل النقطتين — وما بعدهما سطرُ وعدٍ تحته في الدورة الواحدة («من … إلى …»).
   · **كلُّ دورةٍ في سطرين**: اسمُها، وموعدُها تحته — بترتيب ما يبدأ أوّلا، ورقمٌ لكلٍّ إن كثرت.
   · **والكودُ سطرٌ وحدَه** بهديّته، **والدعوةُ قبل الرابط** — والرابطُ قصيرٌ يُقرأ (`short` في «شارك دوراتك»).
   · **ولكلّ منصّةٍ نبرتُها**: واتساب قريبٌ ويُغلظ الاسمَ والكود (`*…*`)، ولينكدإن وفيسبوك مهنيّان بلا تغليظٍ لا يقرآنه،
     وإنستغرام وتيك توك «الرابط في البايو» ووسومٌ، وإكس قصيرٌ يسعه سطرُه.
   و«٪» العربيّةُ لا «%»: اللاتينيّةُ تنقلب في السطر العربيّ. */

const KEYCAPS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']

/** «تمويل المشاريع: من … إلى …» ← الاسمُ ووعدُه */
export function splitTitle(title: string): { name: string; promise: string | null } {
  const at = title.indexOf(':')
  if (at < 0) return { name: title.trim(), promise: null }
  const promise = title.slice(at + 1).trim()
  return { name: title.slice(0, at).trim(), promise: promise || null }
}

/** ما يبدأ أوّلا أوّلا، وما لا موعدَ له آخرا */
const byStart = (cs: ShareCourse[]) =>
  [...cs].sort((a, b) => (a.startsAt ?? '￿').localeCompare(b.startsAt ?? '￿'))

/* ═══ «أعلن انضمامي» — نصٌّ أقوى لمن ينضمّ أوّلَ مرّة (٢٧ أكتوبر ٢٠٢٦) ═══

   نقل صاحبُ المنصّة عن المدرّبين: النصُّ أضعفُ ممّا يريدون، وأكثرُهم ينضمّ أوّلَ مرّةٍ ويريد أن يعلن انضمامَه —
   «سعيد بانضمامي لأكاديمية وجيز كمدرّبة في مجال كذا»، ثمّ دوراتُه، وكلمةٌ عن الأكاديمية ومزاياها، والكودُ في النصّ،
   ووسومٌ — «بما يقلّ ويدلّ». فلكلّ منشورٍ نوعان يختار المدرّبُ أحدَهما (`SHARE_MODES`):
   · **إعلانُ انضمام** — يفتتح بانضمامه وصفتِه كما كتبها هو (`headline`: «مدربة ومستشارة استدامة»)، فلا نخمّن
     جنسَه؛ وبلا صفةٍ «فريق مدربي أكاديمية وجيز» ولا جنسَ فيها. ثمّ دوراتُه، ثمّ «لماذا أكاديمية وجيز؟» بمزاياها
     (`WAJEEZ_PERKS`)، ثمّ الكودُ هديّةً، ثمّ الدعوةُ والرابط، ثمّ الوسوم.
   · **دعوةٌ لدوراته** — لمن انضمّ قبلُ: دوراتُه، والمزايا في سطر، والكودُ والرابط.
   والوسومُ (`hashtags`): وسمُ الأكاديمية دائما، ووسمُ كلّ دورةٍ قصيرٍ اسمُها، ثمّ وسومُ كلّ منصّةٍ بعادتها — والبريدُ
   بلا وسوم. والنصُّ يُعدَّل في اللوحة قبل نشره: هو صوتُه، وما نكتبه أوّلُه لا آخرُه. */

export type ShareMode = 'join' | 'invite'

export const SHARE_MODES: { id: ShareMode; ar: string }[] = [
  { id: 'join', ar: 'إعلان انضمامي' },
  { id: 'invite', ar: 'دعوة لدوراتي' },
]

/** مزايا وجيز كما هي في المنصّة فعلا — لا وعدَ لا تفي به */
export const WAJEEZ_PERKS = ['لقاءات مباشرة على Zoom', 'تطبيق عملي في كل محور', 'تسجيل كل لقاء تعود إليه', 'شهادة موثقة عند الإنجاز']

/** صفتُه كما كتبها — عربيّةٌ قصيرةٌ في سطرٍ واحد، وإلّا فلا صفة */
export function roleOf(headline: string | null | undefined): string | null {
  const raw = (headline ?? '').trim()
  if (!raw || /[\n|•·]/.test(raw) || raw.length > 50 || !/[ء-ي]/.test(raw)) return null
  return plainAr(raw.replace(/\s+/g, ' '))
}

/** «#تمويل_المشاريع» — حروفٌ وأرقامٌ وشرطةٌ سفليّة، بلا تشكيل */
const tag = (s: string) => `#${s.replace(/[^\p{L}\p{N}\s_]/gu, '').trim().replace(/\s+/g, '_')}`

const PLATFORM_TAGS: Record<SharePlatform, string[]> = {
  whatsapp: [],
  x: [],
  email: [],
  linkedin: ['#تطوير_مهني', '#تعلم_مستمر'],
  facebook: ['#تعلم_عن_بعد', '#تطوير_الذات'],
  instagram: ['#تعلم', '#تطوير_الذات', '#دورات_اونلاين', '#تعلم_عن_بعد'],
  tiktok: ['#تعلم', '#تطوير_الذات', '#دورات_اونلاين'],
}

/** وسومُ المنشور: الأكاديميةُ، ثمّ دورتان قصيرٌ اسمُهما (ثلاثُ كلماتٍ فأقلّ — الأطولُ لا يُبحث به)، ثمّ المنصّة.
    وواتسابُ محادثةٌ لا بحثَ فيها: وسمُ الأكاديمية وحدَه */
export function hashtags(platform: SharePlatform, courses: ShareCourse[]): string[] {
  if (platform === 'email') return []
  if (platform === 'whatsapp') return ['#أكاديمية_وجيز']
  const ofCourses = courses
    .map((c) => splitTitle(c.courseTitle).name)
    .filter((n) => n.split(/\s+/).length <= 3)
    .map(tag)
    .filter((t) => t.length > 2)
    .slice(0, 2)
  return [...new Set(['#أكاديمية_وجيز', ...ofCourses, ...PLATFORM_TAGS[platform]])]
}

/** النصُّ لكلّ منصّة */
export function shareText(platform: SharePlatform, x: ShareInput): string {
  const courses = byStart(x.courses)
  const one = courses.length === 1 ? courses[0] : null
  const join = x.mode === 'join'
  const role = roleOf(x.headline)
  const wa = platform === 'whatsapp'
  const b = (t: string) => (wa ? `*${t}*` : t)
  const when = (c: ShareCourse) => (c.startsAt ? `🗓 تبدأ ${x.dayAr(c.startsAt)}` : '🗓 موعدها قريبا')
  const social = platform === 'instagram' || platform === 'tiktok'
  const gift = x.code ? `🎁 خصم ${x.code.percentOff}٪ ${wa ? 'لك' : 'لمن يتابعني'} بالكود: ${b(x.code.code)}` : null
  const tags = hashtags(platform, courses)
  /* «انضمامي إلى أكاديمية وجيز بصفتي مدربة…» — وبلا صفةٍ «فريق مدربي…» */
  const joined = (brand: string) => (role ? `${brand} بصفتي ${role}` : `فريق مدربي ${brand}`)

  /* إكس: سطورٌ يسعها منشورُه — الخبرُ والموعدُ والخصمُ والرابط */
  if (platform === 'x') {
    const head = join
      ? [`انضممت إلى فريق مدربي #أكاديمية_وجيز ✨`,
        one ? `دورتي «${splitTitle(one.courseTitle).name}»${one.startsAt ? ` تبدأ ${x.dayAr(one.startsAt)}` : ' قريبا'}` : 'ودوراتي هذا الموسم في الرابط']
      : [one
        ? `دورتي «${splitTitle(one.courseTitle).name}» مع أكاديمية وجيز${one.startsAt ? `، تبدأ ${x.dayAr(one.startsAt)}` : ''} 🎓`
        : `دوراتي مع أكاديمية وجيز هذا الموسم 🎓`]
    return [...head, ...(x.code ? [`🎁 خصم ${x.code.percentOff}٪ بالكود ${x.code.code}`] : []), `سجل 👇`, x.url].join('\n')
  }

  const body: string[] = []
  if (one) {
    const { name, promise } = splitTitle(one.courseTitle)
    body.push(`📘 ${b(name)}`)
    if (promise) body.push(promise)
    body.push(when(one))
  } else {
    courses.slice(0, KEYCAPS.length).forEach((c, i) => {
      if (i > 0) body.push('')
      body.push(`${KEYCAPS[i]} ${b(splitTitle(c.courseTitle).name)}`, when(c))
    })
  }

  /* البريد: رسالةٌ بتحيّةٍ وتوقيعٍ باسمه — لا وسومَ ولا تغليظ */
  if (platform === 'email') {
    const invite = one ? 'دورتي القادمة' : 'دوراتي هذا الموسم'
    return [
      'مرحبا،',
      '',
      join
        ? `يسعدني أن أخبرك بانضمامي إلى ${joined('أكاديمية وجيز')}، وأن أدعوك إلى ${invite} معهم:`
        : `يسعدني أن أدعوك إلى ${invite} مع أكاديمية وجيز:`,
      '',
      ...body,
      '',
      ...(join
        ? ['ما يميز التعلم في وجيز:', ...WAJEEZ_PERKS.map((p) => `✅ ${p}`)]
        : ['💻 لقاءات مباشرة على Zoom، وتسجيل كل لقاء، وشهادة موثقة — والمقاعد محدودة.']),
      ...(x.code ? ['', `🎁 ولك خصم ${x.code.percentOff}٪ بالكود: ${x.code.code}`] : []),
      '',
      one ? 'التفاصيل والتسجيل:' : 'اختر دورتك وسجل:',
      x.url,
      '',
      'يسعدني أن أراك معنا،',
      ...(x.signature ? [x.signature] : []),
    ].join('\n')
  }

  const opener = join
    ? [`يسعدني أن أعلن انضمامي إلى ${joined(b('أكاديمية وجيز'))} ✨`, '', one ? 'وهذه دورتي القادمة:' : 'وهذه دوراتي هذا الموسم:']
    : wa
      ? ['مرحبا 👋', one ? 'أقدم دورة جديدة مع أكاديمية وجيز:' : 'هذه دوراتي مع أكاديمية وجيز هذا الموسم:']
      : [one ? 'يسعدني أن أعلن عن دورتي القادمة مع أكاديمية وجيز 🎓' : 'يسعدني أن أشارككم دوراتي هذا الموسم مع أكاديمية وجيز 🎓']
  const perks = join
    ? [b('لماذا أكاديمية وجيز؟'), ...WAJEEZ_PERKS.map((p) => `✅ ${p}`)]
    : ['💻 لقاءات مباشرة على Zoom · تطبيق عملي · شهادة موثقة']
  const cta = social
    ? ['المقاعد محدودة 🔗 الرابط في البايو']
    : [one ? 'المقاعد محدودة، سجل الآن 👇' : 'المقاعد محدودة، اختر دورتك وسجل 👇', x.url]

  return [
    ...opener,
    '',
    ...body,
    '',
    ...perks,
    ...(gift ? ['', gift] : []),
    '',
    ...cta,
    ...(tags.length ? ['', tags.join(' ')] : []),
  ].join('\n')
}

/* ═══ وما يفعله بيده يُقال قبل الضغط لا بعده (٢٦ أكتوبر ٢٠٢٦) ═══

   «للوسائل التي لا تسمح بالنشر المباشر يجب إبلاغ المدرّب أنّه يقوم بها يدويّا»، ثمّ: «هل يمكن أن تُرفق الصورةُ
   تلقائيّا عند النشر؟». والجوابُ على الجهاز لا على المنصّة:
   · **الهاتف** يقبل مشاركةَ الصور (`navigator.canShare({ files })`): تُفتح قائمةُ المشاركة فيختار المنصّة، وتصلها
     الصورةُ والنصُّ معا — واتساب ولينكدإن وفيسبوك وإنستغرام وتيك توك والبريد سواء.
   · **الحاسوب** لا: لا تقبل منصّةٌ صورةً من موقعٍ آخر في رابط مشاركتها. فيُفتح المنشورُ بنصّه، وتُنزَّل الصورةُ
     ليرفقها. وإنستغرام وتيك توك لا رابطَ لهما أصلا — يدويّان. */
export function manualNoteAr(platform: SharePlatform, canAttach = false): string | null {
  const app = SHARE_PLATFORMS.find((p) => p.id === platform)!.ar
  if (canAttach) return `تفتح قائمة المشاركة في هاتفك: اختر ${app}، فتصله الصورة والنص معا.`
  if (platform === 'instagram' || platform === 'tiktok') {
    return `${app} لا يسمح بالنشر المباشر من موقع آخر، فالنشر عليه يدوي: ننزل لك الصور وننسخ النص، ثم تفتح ${app} وتنشرها وتلصق النص. ومن الهاتف ترفق الصورة تلقائيا.`
  }
  if (platform === 'facebook') return 'فيسبوك يأخذ الرابط وحده من الحاسوب: ننسخ النص فالصقه، وننزل الصورة فأرفقها. ومن الهاتف ترفق تلقائيا.'
  if (platform === 'email') return 'نفتح بريدك برسالة جاهزة، وننزل الصورة فأرفقها. ومن الهاتف ترفق تلقائيا.'
  return `${app} لا يقبل صورة من موقع آخر على الحاسوب: نفتح المنشور بالنص، وننزل الصورة فأرفقها. ومن الهاتف ترفق تلقائيا.`
}

/** عنوانُ البريد */
export function emailSubject(x: ShareInput): string {
  const one = x.courses.length === 1 ? x.courses[0] : null
  const head = x.mode === 'join'
    ? `انضممت إلى أكاديمية وجيز — ${one ? `ودعوة إلى دورتي «${splitTitle(one.courseTitle).name}»` : 'ودعوة إلى دوراتي'}`
    : one ? `دعوة إلى دورة «${splitTitle(one.courseTitle).name}»` : 'دعوة إلى دوراتي هذا الموسم'
  return x.code ? `${head}${x.mode === 'join' ? '،' : ' —'} وخصم ${x.code.percentOff}٪ لك` : head
}

/** بابُ المنصّة — أو `null` لما لا بابَ له من موقع (إنستغرام وتيك توك). و`text` نصُّه إن عدّله في اللوحة */
export function shareUrl(platform: SharePlatform, x: ShareInput, text = shareText(platform, x)): string | null {
  const e = encodeURIComponent
  if (platform === 'whatsapp') return waShare(text)
  if (platform === 'linkedin') return `https://www.linkedin.com/feed/?shareActive=true&text=${e(text)}`
  if (platform === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${e(x.url)}`
  if (platform === 'x') return `https://x.com/intent/post?text=${e(text)}`
  if (platform === 'email') return `mailto:?subject=${e(emailSubject(x))}&body=${e(text)}`
  return null
}
