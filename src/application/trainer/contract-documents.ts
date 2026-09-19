/* الوثائقُ التي تُطلَب مع توقيع العقد — قائمةٌ تُنتقى لكلّ مدرّبٍ على حدة.

   قال صاحبُ المنصّة: «ويضع الملفات التي يجب أن يرفعها **في حالة طلبنا**». وهي
   جملةٌ تُقرأ بسرعةٍ فيُفهَم منها «يرفع هويّته»، وليست ذلك: المطلوبُ يختلف
   باختلاف الشخص. فمقيمٌ يُطلَب منه إذنُ إقامة، ومن سيُدرّس اعتمادا مهنيّا
   تُطلَب شهادتُه، ومن عرفناه عن قرب لا يُطلَب منه شيءٌ زائدٌ عن هويّته.

   وقائمةٌ ثابتةٌ في الشيفرة تعني أنّ أوّلَ حالةٍ تخرج عنها تُعالَج في واتساب —
   فتُرفَع الوثيقةُ خارج المنصّة ولا يبقى منها أثرٌ عند العقد الذي طُلبت له.

   فالقائمةُ هنا **مفرداتٌ يُنتقى منها**، والمنتقى يُحفَظ في
   `TrainerContract.requiredDocuments`، ومنه يُبنى الملحقُ (ج) في متن العقد.
   ولا يُقبل توقيعٌ قبل استكمال ما وُسم `required` (المرحلة الثانية).

   ── والهويّةُ وحدَها إلزاميّةٌ بالبناء ──

   لأنّ العقدَ يقول «أقرّ أنّ هذا اسمي القانونيّ»، وإقرارٌ لا يُقابَل بوثيقةٍ
   إقرارٌ بلا مقابل. فـ`IDENTITY_KINDS` واحدةٌ منها على الأقلّ، وما عداها
   يُضاف بحسب الحاجة. */

export interface ContractDocumentKind {
  key: string
  labelAr: string
  /** شرحٌ يظهر للمدرّب تحت خانة الرفع — لا للموظّف */
  hintAr: string
  /** أهي وثيقةُ هويّةٍ تصلح لمطابقة الاسم القانونيّ؟ */
  identity: boolean
}

export const CONTRACT_DOCUMENT_KINDS: readonly ContractDocumentKind[] = [
  {
    key: 'national_id',
    labelAr: 'الهوية الوطنية',
    hintAr: 'صورة واضحة للوجهين، يظهر فيها الاسم الكامل ورقم الهوية وتاريخ الانتهاء.',
    identity: true,
  },
  {
    key: 'passport',
    labelAr: 'جواز السفر',
    hintAr: 'صفحة البيانات وحدها — الاسم بالعربية والإنجليزية ورقم الجواز وتاريخ الانتهاء.',
    identity: true,
  },
  {
    key: 'residence_permit',
    labelAr: 'إذن الإقامة',
    hintAr: 'لغير المقيمين في بلد جنسيتهم — الصفحة التي تحمل الاسم ورقم الإقامة وسريانها.',
    identity: true,
  },
  {
    key: 'teaching_certificate',
    labelAr: 'شهادة أو اعتماد تدريبي',
    hintAr: 'الاعتماد أو الترخيص الذي ذكرته في طلبك، إن كان التدريب في مجال يتطلبه.',
    identity: false,
  },
  {
    key: 'degree',
    labelAr: 'المؤهل العلمي',
    hintAr: 'الشهادة الجامعية أو ما يعادلها في مجال تدريبك.',
    identity: false,
  },
  {
    key: 'experience_letter',
    labelAr: 'شهادة خبرة',
    hintAr: 'من جهة دربت لديها سابقا، تبين المدة وطبيعة العمل.',
    identity: false,
  },
  {
    key: 'other',
    labelAr: 'وثيقة أخرى',
    hintAr: 'ما طلبته الأكاديمية منك تحديدا.',
    identity: false,
  },
] as const

export const IDENTITY_KINDS = CONTRACT_DOCUMENT_KINDS.filter((k) => k.identity).map((k) => k.key)

/** صفٌّ في `TrainerContract.requiredDocuments` — ما اختاره الموظّف فعلا */
export interface RequiredDocument {
  kind: string
  /** يُنسَخ من القائمة وقتَ الاختيار، أو يكتبه الموظّف حين يكون `other`.
      ونسخٌ لا مرجع: لو غُيّرت تسميةٌ هنا بعد سنةٍ لبقي العقدُ يقول ما طُلب. */
  labelAr: string
  required: boolean
}

export const DEFAULT_REQUIRED_DOCUMENTS: RequiredDocument[] = [
  { kind: 'national_id', labelAr: 'الهوية الوطنية', required: true },
]

export function documentKind(key: string): ContractDocumentKind | undefined {
  return CONTRACT_DOCUMENT_KINDS.find((k) => k.key === key)
}

/** يقرأ عمودَ `requiredDocuments` كما هو في القاعدة — وعمودُ JSON لا نوعَ له.

    ولمَ قارئٌ متساهلٌ لا تحويلٌ صريح: الصفُّ قد يكون من قبلِ هذا الحقل
    (فارغا)، أو كُتب بصيغةٍ أقدمَ، أو عُبث به في القاعدة. ومن قرأه بتحويلٍ
    أعمى (`as RequiredDocument[]`) يمرّ بالسقوط إلى حيث تُقرأ `labelAr` من
    `undefined` — في **صفحة توقيعٍ يراها مدرّب**. فما لا يُفهَم يسقط بصمت
    هنا، والحقلُ الفارغُ يُقرأ قائمةً فارغةً لا انهيارا. */
export function readRequiredDocuments(value: unknown): RequiredDocument[] {
  if (!Array.isArray(value)) return []
  const out: RequiredDocument[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (typeof r.kind !== 'string' || typeof r.labelAr !== 'string') continue
    if (!r.kind.trim() || !r.labelAr.trim()) continue
    out.push({ kind: r.kind, labelAr: r.labelAr, required: r.required !== false })
  }
  return out
}

/** أفي المنتقى وثيقةُ هويّةٍ واحدةٌ إلزاميّةٌ على الأقلّ؟

    فبلا واحدةٍ منها لا يُطابَق الاسمُ القانونيُّ بشيء، ويصير البندُ 15 من
    العقد وعدا لا يقابله فعل. */
export function hasRequiredIdentityDocument(docs: readonly RequiredDocument[]): boolean {
  return docs.some((d) => d.required && IDENTITY_KINDS.includes(d.kind))
}
