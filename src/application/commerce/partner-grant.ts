/* منحُ الشركاء — جامعاتٌ وشركاتٌ بمنحةٍ لكلٍّ منها (١٥ نوفمبر ٢٠٢٦). ما تشترك فيه الشاشةُ والخادم.

   ═══ قراراتُ صاحب المنصّة ═══

   ١) **منحةٌ لكلّ شريكٍ وحدَها** — لا داخلَ منحة المؤثّرين: صفحتُها `/grant/p/<رابطه>`، ونسبتُها وحدُّ دوراتها ونهايتُها
      (اختياريّة) بيده، **ولا عمولة**. وأوّلُها «الجامعة الهاشمية» برابط `hu`، بخصمٍ ٧٥٪ على ٤ دوراتٍ بلا نهاية.
      وتُبنى لشركاءَ كثيرين: يُضاف الشريكُ من شاشة «الشركاء» في المنح.
   ٢) **والتحقّقُ ببريد الجامعة وحدَه** — «only university email is enough»: لا رقمَ جامعيّ. يكتب بريدَه فيصله رابطٌ يُستعمل
      مرّةً، فإذا فتحه أخذ كودَه. والبريدُ على نطاقات الشريك: النطاقُ نفسُه وكلُّ ما تحته، بحدود المقاطع لا بحروفها —
      فـ`std.hu.edu.jo` منه، و`evilhu.edu.jo` و`hu.edu.jo.evil.com` ليسا منه (`emailMatchesDomains`).
   ٣) **ولكلّ شريكٍ شعارُه** يرفعه المدير، وحتّى يُرفع يُكتب اسمُه مكانَه. ولا يُجلب شعارٌ من خارج المنصّة.
   ٤) **والشريكُ صفٌّ في `GrantCampaign` بنوع `partner`** — فالكودُ وحدُّ دوراته (`coursesLeft`) و«منحةٌ واحدةٌ لكلّ متعلّم»
      واختيارُ الدورات والتذكيرُ تعمل كما هي، والحملاتُ الأربعُ لا يتغيّر فيها شيء. ومعرّفُ صفّه `partner-<رابطه>`.

   والخادم: `server/services/partner-grant.service.ts`. والحارس: `server/tests/commerce/partner-grant.test.ts`
   و`src/tests/commerce/partner-grant.test.ts`. */

/** بادئةُ معرّف صفّ الشريك في `GrantCampaign.slug` — فلا يلتبس بمعرّفات الحملات الأربع (`wajeez-…`) */
export const PARTNER_SLUG_PREFIX = 'partner-'
/** صفحاتُ الشركاء — `/grant/p/hu` */
export const PARTNER_PATH = '/grant/p'

/** معرّفُ صفّ شريكٍ في `GrantCampaign` */
export type PartnerCampaignSlug = `${typeof PARTNER_SLUG_PREFIX}${string}`

/** رابطُ الشريك: حروفٌ لاتينيّةٌ صغيرةٌ وأرقامٌ وشَرطة، من حرفين إلى ثلاثين، لا تبدأ بشرطة ولا تنتهي بها */
export const PARTNER_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])$/

export const partnerCampaignSlug = (slug: string): PartnerCampaignSlug => `${PARTNER_SLUG_PREFIX}${slug}`
export const isPartnerCampaign = (slug: string | null | undefined): slug is PartnerCampaignSlug =>
  typeof slug === 'string' && slug.startsWith(PARTNER_SLUG_PREFIX)
/** رابطُ الشريك من معرّف صفّه — `partner-hu` ← `hu` */
export const partnerSlugOf = (campaignSlug: string): string =>
  isPartnerCampaign(campaignSlug) ? campaignSlug.slice(PARTNER_SLUG_PREFIX.length) : campaignSlug
export const partnerPagePath = (slug: string): string => `${PARTNER_PATH}/${slug}`

/** الرابطُ كما يُكتب في الشاشة — بحروفٍ صغيرة، أو `null` إن لم يصلح */
export function normalizePartnerSlug(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? ''
  return PARTNER_SLUG_RE.test(v) ? v : null
}

/* ═══ النطاقات ═══ */

/** مقطعُ نطاقٍ: حروفٌ وأرقامٌ وشَرطةٌ لا في طرفيه */
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/** النطاقُ كما يُحفظ: بحروفٍ صغيرة، بلا «@» ولا نقطةٍ في طرفيه، ومقطعان على الأقلّ — أو `null` إن لم يصلح.
    فـ`@HU.edu.jo` ← `hu.edu.jo`، و`edu` وحدَه لا يصلح: كان يفتح المنحةَ لكلّ بريدٍ جامعيٍّ في الدنيا */
export function normalizeDomain(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().toLowerCase().replace(/^@+/, '').replace(/^\.+/, '')
  const labels = v.split('.')
  if (labels.length < 2 || labels.some((l) => !LABEL_RE.test(l))) return null
  return v
}

/** نطاقُ البريد بحروفٍ صغيرة — أو `null` إن لم يكن بريدا بشكله */
export function emailDomain(email: string | null | undefined): string | null {
  const v = (email ?? '').trim().toLowerCase()
  const at = v.lastIndexOf('@')
  if (at <= 0 || v.indexOf('@') !== at) return null
  const domain = v.slice(at + 1)
  const labels = domain.split('.')
  if (labels.length < 2 || labels.some((l) => !LABEL_RE.test(l))) return null
  return domain
}

/** أيقع البريدُ على نطاقات الشريك؟ النطاقُ نفسُه أو ما تحته بحدّ مقطع — `x@std.hu.edu.jo` على `hu.edu.jo`،
    و`x@evilhu.edu.jo` و`x@hu.edu.jo.evil.com` لا. وبلا حسابٍ لحالة الحروف */
export function emailMatchesDomains(email: string | null | undefined, domains: readonly string[]): boolean {
  const domain = emailDomain(email)
  if (!domain) return false
  return domains.some((raw) => {
    const d = normalizeDomain(raw)
    return d !== null && (domain === d || domain.endsWith(`.${d}`))
  })
}

/* ═══ نوعُ الشريك ونصوصُه ═══ */

export const PARTNER_TYPES = ['university', 'company'] as const
export type PartnerType = (typeof PARTNER_TYPES)[number]
export const partnerTypeOf = (raw: string | null | undefined): PartnerType => (raw === 'company' ? 'company' : 'university')

/** ما يتغيّر بنوع الشريك — «لطلاب الجامعة» أو «لموظفي الشركة» */
export const PARTNER_TYPE_AR: Record<PartnerType, { label: string; audience: string; people: string; email: string; emailHint: string }> = {
  university: { label: 'جامعة', audience: 'لطلاب الجامعة', people: 'طلاب', email: 'بريدك الجامعي', emailHint: 'البريد الذي أعطتك إياه الجامعة' },
  company: { label: 'شركة', audience: 'لموظفي الشركة', people: 'موظفي', email: 'بريد العمل', emailHint: 'البريد الذي أعطتك إياه الشركة' },
}

/** القيمُ الأولى لشريكٍ جديد — والمديرُ يغيّرها. والخصمُ ٥٠٪ وحصّةُ الشريك ٥٠٪ ممّا يُدفع (١٦ نوفمبر ٢٠٢٦، «ok»): ٧٥٪ خصما
    مع ٥٠٪ حصّةً يُبقيان لنا ثُمنَ السعر قبل أجر المدرّب، فيخسر المقعد. والجامعةُ الهاشميّةُ بقيت بخصمها حتى يُغيَّر */
export const PARTNER_DEFAULTS = { percentOff: 50, maxCourses: 4, sharePercent: 50 } as const

/* ═══ حصّةُ الشريك من الإيراد (١٦ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: الجامعةُ تنشر رابطَ منحتها لطلابها وموظّفيها، ونتقاسم ما يدفعونه — «% of what the student paid»:
   **نسبةٌ ممّا دفعه المستفيدُ فعلا بعد المنحة، قبل أجور المدرّبين** (لا من سعر القائمة كعمولة المؤثّر). وتُكتب في كود
   المنحة يومَ يُعطى، فتغييرُها يقع على ما بعده. وما رُدّ من الثمن ينقص منها بنسبته، والمردودُ كلُّه لا حصّةَ له. ولها لوحةٌ
   يرى فيها ممثّلُها من سجّل ومن دفع وحصّتَه عن كلٍّ وما صُرف له (`server/services/partner-revenue.service.ts`). */

/** حصّةُ الشريك عن طلب: نسبتُها ممّا دُفع، ناقصا ما رُدّ بنسبته (`refunded` من ٠ إلى ١) */
export function partnerShare(paid: number, sharePercent: number, refunded = 0): number {
  const kept = Math.max(0, paid * (1 - Math.min(1, Math.max(0, refunded))))
  return Math.round(kept * Math.max(0, sharePercent)) / 100
}

/** حالُ الطلب في كشف الشريك */
export function partnerShareStateAr(status: string): string {
  if (status === 'refunded') return 'رد كاملا — بلا حصة'
  if (status === 'partially_refunded') return 'رد بعضه — الحصة مما بقي'
  return 'مدفوع'
}

/** ما يقوله سطرُ الحصّة للمدير وللشريك */
export const partnerShareLineAr = (pct: number | null): string =>
  pct === null || pct <= 0 ? 'بلا حصة من الإيراد بعد' : `${pct}% مما يدفعه المستفيد، قبل أجور المدربين`

/** «شراكة بين الجامعة الهاشمية وأكاديمية وجيز» */
export const partnerHeadlineAr = (nameAr: string): string => `شراكة بين ${nameAr} وأكاديمية وجيز`
/** «منح تصل إلى 75٪ لطلاب الجامعة» — من نسبة الشريك */
export const partnerOfferAr = (percentOff: number, type: PartnerType): string =>
  `منح تصل إلى ${percentOff}٪ ${PARTNER_TYPE_AR[type].audience}`

/** «دورة واحدة» و«دورتان» و«4 دورات» */
const coursesAr = (n: number): string => (n === 1 ? 'دورة واحدة' : n === 2 ? 'دورتان' : `${n} دورات`)

/** خطواتُ المنحة الثلاث — بريدٌ ثمّ تأكيدٌ ثمّ دورات */
export function partnerStepsAr(type: PartnerType): readonly { title: string; body: string }[] {
  const t = PARTNER_TYPE_AR[type]
  return [
    { title: `اكتب ${t.email}`, body: `نرسل إليه رابطا خاصا بك.` },
    { title: 'افتح الرابط', body: 'يؤكد بريدك ويظهر لك كود منحتك.' },
    { title: 'اختر دوراتك', body: 'ادفع السعر بعد المنحة وابدأ مع مدربك.' },
  ]
}

/** أسئلةُ صفحة الشريك — من يستحقّ، وكم دورة، وكيف يُتحقّق، ومن لا بريدَ جامعيّا له */
export function partnerFaqAr(p: {
  nameAr: string; type: PartnerType; percentOff: number; maxCourses: number; domains: readonly string[]; lastDayAr?: string | null
}): readonly { q: string; a: string }[] {
  const t = PARTNER_TYPE_AR[p.type]
  const domains = p.domains.join(' أو ')
  return [
    { q: 'من يستحق المنحة؟', a: `${t.people} ${p.nameAr} ممن لهم ${t.email} على ${domains}.` },
    { q: 'كم دورة تشمل؟', a: `حتى ${coursesAr(p.maxCourses)} بخصم ${p.percentOff}٪، في طلب واحد أو أكثر${p.lastDayAr ? ` حتى ${p.lastDayAr}` : ''}.` },
    { q: 'كيف نتحقق منك؟', a: `بـ${t.email} وحده. نرسل إليه رابطا صالحا يوما واحدا، فإذا فتحته ظهر لك كودك.` },
    { q: `ليس لدي ${t.email}، ماذا أفعل؟`, a: 'تواصل معنا على واتساب، ونساعدك.' },
    { q: 'هل الدورات مسجلة؟', a: 'لا، هي لقاءات مباشرة على Zoom مع مدرب معتمد، ولكل دورة مواعيد ثابتة تراها قبل الدفع.' },
  ]
}

/* ═══ ما يُقال للزائر ═══ */

export const partnerBadEmailAr = (type: PartnerType, domains: readonly string[]): string =>
  `اكتب ${PARTNER_TYPE_AR[type].email} الذي ينتهي بـ${domains.join(' أو ')}.`
/** بعد طلب الرابط — والجملةُ واحدةٌ لكلّ بريد: لا تقول أأخذ صاحبُه المنحةَ من قبل أم لا */
export const partnerLinkSentAr = (masked: string): string =>
  `أرسلنا رابطا إلى ${masked}. افتحه من بريدك لتأخذ كود منحتك.`
export const PARTNER_LINK_BAD_AR = 'الرابط غير صالح. اطلب رابطا جديدا من صفحة المنحة.'
export const PARTNER_LINK_USED_AR = 'استعملت هذا الرابط من قبل. اطلب رابطا جديدا من صفحة المنحة.'
export const PARTNER_LINK_EXPIRED_AR = 'انتهت مدة الرابط. اطلب رابطا جديدا من صفحة المنحة.'
export const PARTNER_NOT_FOUND_AR = 'هذه المنحة غير متاحة الآن'
export const PARTNER_CONSENT_AR =
  'بالإرسال توافق أن نحفظ اسمك وبريدك لنعطيك كود المنحة، وأن نتواصل معك بخصوصها. ومن لا يشتري تحذف بياناته بعد ستة أشهر بلا نشاط.'

/* ═══ الدوراتُ المقترحةُ لطلاب الجامعة (١٥ نوفمبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: «اقترح دوراتٍ تناسب طلاب الجامعة» ليبدأ بها الشريكُ الأوّلُ فلا تكون صفحتُه فارغة، ويختار هو
   بعدُ من الشاشة نفسِها (`GrantCourseChoice`). فهي ما يحتاجه الطالبُ قبل التخرّج وبعده: سيرتُه ومقابلتُه ومسارُه،
   والإنجليزيّةُ للعمل وللاختبار، والبياناتُ والذكاءُ الاصطناعيّ، والعرضُ أمام الناس، وإدارةُ المشاريع والوقت، وكتابةُ
   المحتوى. ومعرّفاتُها من الكتالوج (`core-catalog.v2.json`)؛ وما لا يوجد منها في قاعدةٍ يُترك عند البذر. */
export const STUDENT_SUGGESTED_COURSES: readonly string[] = [
  'C-JOB-101', 'C-JOB-104', 'C-CAR-101', 'C-JOB-106',
  'C-COMX-103', 'C-COMX-106', 'C-COMX-113',
  'C-DAT-101', 'C-AI-101', 'C-AI-104',
  'C-PM-106', 'C-WEL-101', 'C-MKT-106',
]

/* ═══ الشريكُ الأوّل: الجامعة الهاشمية ═══ */
export const HU_PARTNER = {
  slug: 'hu',
  nameAr: 'الجامعة الهاشمية',
  nameEn: 'The Hashemite University',
  type: 'university' as PartnerType,
  domains: ['hu.edu.jo'],
  percentOff: 75,
  maxCourses: 4,
} as const
