/* ═══ دورةُ صاحب المنصّة الخاصّة — «اجعل الذكاء الاصطناعي يقدّم على الوظائف عنك» (١٩ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «ضع لي خانةً داخل موقع الأكاديميّة كشيءٍ منفصل فقط لأستفيد من السيرفر لشيءٍ شخصيٍّ لي».
   فهذه دورتُه هو لا دورةُ الأكاديميّة: لا تمرّ بالكتالوج ولا بالشعب ولا بالدفع ولا بالأثر، ولا يراها غيرُه في الإدارة.
   صفحتُها `/ai-jobs`، ولوحتُها `/private`، وجدولاها `PrivateCourse` و`PrivateRegistration`.

   وما هنا ثوابتُها: يقرؤها الخادمُ حين يتحقّق من الشعبة ويكتب البريد، وتقرؤها الصفحةُ حين تعرض الموعدَ والسعر — فلا
   يختلف ما يُعلَن عمّا يُقبَل. وما يتغيّر (رابطُ Zoom وملفُّ الدورة وفتحُ التسجيل) في القاعدة يضبطه هو من لوحته. */

/** صاحبُ المساحة الخاصّة — «فقط أنا suhaib@wajeez.co». يقرؤه الخادمُ حارسا (`owner.ts`) والواجهةُ لتُظهر له وحدَه رابطَها */
export const PRIVATE_OWNER_EMAIL = 'suhaib@wajeez.co'

export interface PrivateSection {
  key: 'morning' | 'evening'
  title: string
  /** الوقتُ كما في المنشور — بتوقيت عمّان */
  timeLabel: string
  /** البدايةُ والنهايةُ بالتوقيت العالميّ — عمّان +3 طوال السنة */
  startsAt: string
  endsAt: string
}

export const AI_JOBS_SLUG = 'ai-jobs'

export const AI_JOBS = {
  slug: AI_JOBS_SLUG,
  title: 'دورة التقديم على الوظائف بالذكاء الاصطناعي',
  headline: 'اجعل الذكاء الاصطناعي يقدّم على الوظائف عنك',
  trainer: 'صهيب أحمد الخوالدة',
  /** يوما الدورة في المنشور — السبت ٥ ديسمبر ٢٠٢٦ */
  dateLabel: 'السبت 5 ديسمبر 2026',
  hours: 4,
  priceUsd: 20,
  listPriceUsd: 100,
  priceJod: 14,
  /** شخصان معا (٢١ نوفمبر ٢٠٢٦): «شخصين يكون السعر ٢٠ لأن السعر الأصلي ١٤» — بالدينار، والدولارُ لقياس الإعلان وحدَه */
  pair: { priceJod: 20, priceUsd: 28 },
  /** الاسمُ المستعار في CliQ — يحوّل إليه المتعلّم */
  cliqAlias: 'suhaiblafi',
  /** واتساب صاحب الدورة كما في المنشور */
  whatsapp: '+962797708080',
  whatsappLabel: '+962 79 770 8080',
  sections: [
    { key: 'morning', title: 'الشعبة الصباحية', timeLabel: '11 صباحا – 3 عصرا', startsAt: '2026-12-05T08:00:00.000Z', endsAt: '2026-12-05T12:00:00.000Z' },
    { key: 'evening', title: 'الشعبة المسائية', timeLabel: '6 – 10 مساء', startsAt: '2026-12-05T15:00:00.000Z', endsAt: '2026-12-05T19:00:00.000Z' },
  ] as const satisfies readonly PrivateSection[],
  /* ═══ المقاعدُ المتبقّية — بدل عدّاد الوقت (١٩ نوفمبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة: «اجعله حتى نفاد المقاعد، واستبدلها بعدد المقاعد المتبقّية لكلّ شعبة، وتعتمد بأنّ كلَّ يومٍ
     تقلّ المقاعدُ مقعدين، وابدأ للصباحيّة من ٢٤ والمسائيّة ٢٦». فالعددُ جدولٌ معلَنٌ يبدأ يومَ القرار بتوقيت عمّان،
     لا عدُّ المسجَّلين. ويقف عند مقعدين ولا يبلغ الصفر: «لا مقاعد» والتسجيلُ مفتوحٌ تناقضٌ يراه الزائر. */
  seats: {
    from: '2026-11-19',
    perDay: 2,
    floor: 2,
    start: { morning: 24, evening: 26 },
  },
} as const

/** يومُ عمّان (+3 طوال السنة) لتاريخٍ ما — رقمُ اليوم منذ ١٩٧٠ */
function ammanDay(at: number): number {
  return Math.floor((at + 3 * 3_600_000) / 86_400_000)
}

/** المقاعدُ المتبقّية لشعبةٍ في لحظة — تنقص مقعدين كلَّ يومٍ من يوم البدء، ولا تنزل عن الحدّ */
export function seatsLeft(key: AiJobsSectionKey, at: number = Date.now()): number {
  const { from, perDay, floor, start } = AI_JOBS.seats
  const days = Math.max(0, ammanDay(at) - ammanDay(Date.parse(`${from}T00:00:00+03:00`)))
  return Math.max(floor, start[key] - perDay * days)
}

/** «متوفر 24 مقعد» — والعددُ بصيغته: «3 مقاعد» و«مقعدان» */
export function seatsLabel(n: number): string {
  if (n <= 2) return 'آخر مقعدين'
  if (n <= 10) return `متوفر ${n} مقاعد`
  return `متوفر ${n} مقعد`
}

/** عنوانُ الصفحة ووصفُها — في لسان المتصفّح وفي معاينة الرابط (`landing-seo.ts`) */
export const AI_JOBS_SEO = {
  title: `${AI_JOBS.headline} — دورة عملية مباشرة`,
  description:
    `دورة عملية مباشرة على Zoom لأربع ساعات مع ${AI_JOBS.trainer}: تبني فيها مساعدا بـClaude يبحث عن الوظائف ويفصّل سيرتك ويعبّي طلباتك. ${AI_JOBS.dateLabel} — ${AI_JOBS.priceUsd}$ بدل ${AI_JOBS.listPriceUsd}$.`,
} as const

export type AiJobsSectionKey = (typeof AI_JOBS.sections)[number]['key']

export const AI_JOBS_SECTION_KEYS = AI_JOBS.sections.map((s) => s.key) as readonly AiJobsSectionKey[]

export function aiJobsSection(key: string): PrivateSection | null {
  return AI_JOBS.sections.find((s) => s.key === key) ?? null
}

/* ═══ من خارج الأردن — واتساب يرتّب الدفع (٢١ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة (اقتراحُ «١»): CliQ داخل الأردن وحدَه، والبطاقةُ أُخفيت كلّيّا. فمن رقمُه خارجَ الأردن لا يجد طريقا
   يدفع به فيترك. فيُقال له في النموذج وخطوة الدفع وبريد التذكير: راسلنا على واتساب ونرتّب الدفع — برسالةٍ جاهزة. */
export const ABROAD_PAY_LINE = 'من خارج الأردن؟ راسلنا على واتساب ونرتب طريقة الدفع'

export function abroadPayMessage(opts: { country?: string; reference?: string } = {}): string {
  const from = opts.country ? `من ${opts.country}` : 'من خارج الأردن'
  const ref = opts.reference ? ` رقم المرجع ${opts.reference}.` : ''
  return `مرحبا، أنا ${from} وأريد التسجيل في دورة التقديم على الوظائف بالذكاء الاصطناعي.${ref} كيف أدفع؟`
}

/* ═══ «سجّل معي» — بعد الحجز (٢١ نوفمبر ٢٠٢٦) ═══
   قرارُه (اقتراحُ «٢»): من يبحث عن عمل يعرف غيرَه يبحث. فرسالةٌ جاهزةٌ على واتساب برابط الصفحة، و`?src=share` يقول
   في اللوحة من جاء منها (`source.ts`). */
export const SHARE_SOURCE = 'share'

export function shareInviteText(origin: string): string {
  return `سجلت في دورة «${AI_JOBS.headline}» — ${AI_JOBS.hours} ساعات مباشرة على Zoom يوم ${AI_JOBS.dateLabel}، بـ${AI_JOBS.priceUsd}$ بدل ${AI_JOBS.listPriceUsd}$. إذا تبحث عن عمل سجّل معي: ${origin}/ai-jobs?src=${SHARE_SOURCE}`
}

/** بكسلُ Meta لصفحة الدورة — تقرؤه الصفحةُ (`meta-pixel.ts`) والخادمُ حين يُبلغ بالشراء (`meta-capi.ts`) */
export const META_PIXEL_ID = '1150707094391273'

/** ما يُحوَّل عن الحجز — للاثنين سعرُهما، وللواحد سعرُه */
export function priceJodFor(pair: boolean): number {
  return pair ? AI_JOBS.pair.priceJod : AI_JOBS.priceJod
}

/* ═══ روابطُ ما قبل الدورة — في بريد التأكيد ═══
   قرارُه: «يقول له نزّل Claude Code وأعطه الرابط إن لم يكن مشتركا فيه». فرابطان: التنزيلُ، والاشتراك. */
export const CLAUDE_LINKS = {
  download: 'https://claude.com/download',
  pricing: 'https://claude.com/pricing',
} as const

/** الملفُّ وحدَه: PDF أو صورة، حتى ٨MB — صورةُ الحوالة من الهاتف تكبر */
export const PROOF_MAX_BYTES = 8 * 1024 * 1024
export const PROOF_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

/** ملفُّ الدورة المرفقُ بالبريد — حتى ١٥MB، وحدُّ Gmail ٢٥ */
export const COURSE_FILE_MAX_BYTES = 15 * 1024 * 1024
