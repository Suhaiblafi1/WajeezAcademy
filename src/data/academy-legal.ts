/* هويّةُ الأكاديميّة القانونيّة — الطرفُ الأوّلُ في كلّ عقدٍ نوقّعه.

   ── لماذا ملفٌّ مستقلٌّ لا سطرٌ في `siteContent.ts` ──

   كانت هذه القيمُ في موضعين اثنين فقط، وكلاهما نصٌّ معروضٌ لا بيانٌ يُقرأ:
   صفحةُ الشروط وصفحةُ الخصوصيّة. وفيهما **حرفيّا** «السجل التجاري: [يُعبأ من
   السجل الرسمي]» — أي أنّ المنصّة لا تعرف اسمَ الكيان الذي تتعاقد باسمه.

   وما دام النصُّ يُقرأ بالعين فالقوسُ المعقوفُ عيبٌ يُرى ويُصلَح. أمّا حين
   يدخل الاسمُ **وثيقةً يوقّعها إنسانٌ ويلتزم بها**، فالقوسُ المعقوف ليس عيبا
   في العرض: هو عقدٌ بلا طرفٍ أوّل. ومن وقّع يحتجّ بأنّه لم يتعاقد مع أحد،
   أو يقاضي أيَّ كيانٍ من الثلاثة المذكورة في الموقع فيختار أوسعَها ذمّة.
   **وما أُرسل لا يُستردّ.**

   ── ولذلك دالّةُ الاكتمال، لا قيمةٌ افتراضيّة ──

   لا يُخترع رقمٌ ولا يُستنتج عنوان. وما لم يصل من السجلّ الرسميّ يبقى فارغا،
   و`missingAcademyLegalFields()` تسمّيه، ويردُّ الإرسالُ قبل أن يُركَّب متن.
   فالخطأُ يظهر في شاشة المسؤول لا في وثيقةٍ وصلت مدرّبا.

   ── والمصدرُ واحد ──

   على نمط `academy-email.ts`: يحرس `src/tests/academy-legal.test.ts` ألّا تُكتب
   هذه القيمُ حرفا في ملفٍّ آخر، وألّا تُعلَن «مكتملةً» وفيها حقلٌ فارغ. */

/** ما وصل من السجلّ الرسميّ — دائرةُ مراقبة الشركات، الأردنّ، ٠٦/٠٥/٢٠٢٥ */
export const ACADEMY_LEGAL = {
  /** الاسمُ المسجَّل — هو الطرفُ الأوّل، لا الاسمُ التجاريّ */
  legalNameAr: 'شركة البادجي لتصميم المواقع الالكترونية',

  /** الاسمُ الذي تُعرف به بين الناس — يُذكر بعد المسجَّل لا بدلا عنه */
  tradingNameAr: 'أكاديمية وجيز',

  entityFormAr: 'ذات مسؤولية محدودة',

  /** رقمُ التسجيل في السجلّ التجاريّ */
  registrationNo: '47368',

  /** الرقمُ الوطنيُّ للمنشأة — غيرُ الرقم الضريبيّ، ولا يُستعمل بدلا عنه */
  nationalNo: '200160976',

  /** ⚠️ لم يصل بعد — ليس في صفحة السجلّ التي وردت */
  taxNo: '',

  /** ⚠️ لم يصل بعد — السجلُّ يقول «مركز الشركة: عمّان» ولا عنوانَ تفصيليّا */
  registeredAddressAr: '',

  cityAr: 'عمّان',
  countryAr: 'المملكة الأردنية الهاشمية',

  /** المفوَّضُ بالتوقيع — «محمد أمين» اسمٌ مركَّبٌ لا اسمان */
  signatoryNameAr: 'محمد أمين خليل جميل زعتره',
  signatoryTitleAr: 'مدير عام الشركة',

  /** تاريخُ التفويض في السجلّ — يُطبَع في الديباجة إثباتا للصفة */
  signatoryAuthorisedOn: '2025-05-05',

  /** ═══ القانونُ الحاكم — يتبع مركزَ الكيان لا عنوانَ المكتب ═══

      الكيانُ أردنيٌّ مركزُه عمّان، فقانونُ الأردن. وهذا **يوافق** صفحةَ
      الشروط المنشورة ولا يناقضها، وعنوانُ الرياض المنشورُ مكتبٌ لا مركز.

      ولا يُحرَم المدرّبُ بهذا من حمايةٍ آمرةٍ في بلد إقامته أو بلد أداء
      الخدمة — وبندُ العقد يقولها صراحةً، لأنّ إنكارَها لا ينفُذ ويُقرأ
      علينا لا لنا. */
  governingLawAr: 'المملكة الأردنية الهاشمية',
  disputeVenueAr: 'محاكم عمّان',
} as const

export type AcademyLegalField = keyof typeof ACADEMY_LEGAL

/** الحقولُ التي لا يُركَّب متنُ عقدٍ بدونها — وما عداها تحسينُ عرض.

    و`nationalNo` ليس منها بقصد: السجلُّ التجاريُّ يعرّف الكيانَ، والرقمُ
    الوطنيُّ إضافةٌ. أمّا `taxNo` فمنها، لأنّ عقدَ خدماتٍ بمقابلٍ يُسأل عن
    وضعه الضريبيّ. */
export const REQUIRED_LEGAL_FIELDS: readonly AcademyLegalField[] = [
  'legalNameAr', 'entityFormAr', 'registrationNo', 'taxNo',
  'registeredAddressAr', 'cityAr', 'countryAr',
  'signatoryNameAr', 'signatoryTitleAr',
  'governingLawAr', 'disputeVenueAr',
] as const

/** أسماءٌ عربيّةٌ تُعرض للمسؤول — «taxNo فارغ» ليست رسالةً لإنسان */
export const LEGAL_FIELD_LABELS_AR: Record<AcademyLegalField, string> = {
  legalNameAr: 'الاسمُ القانونيُّ المسجَّل',
  tradingNameAr: 'الاسمُ التجاريّ',
  entityFormAr: 'شكلُ الكيان',
  registrationNo: 'رقمُ السجلّ التجاريّ',
  nationalNo: 'الرقمُ الوطنيُّ للمنشأة',
  taxNo: 'الرقمُ الضريبيّ',
  registeredAddressAr: 'العنوانُ المسجَّل',
  cityAr: 'المدينة',
  countryAr: 'الدولة',
  signatoryNameAr: 'اسمُ المفوَّض بالتوقيع',
  signatoryTitleAr: 'صفةُ المفوَّض بالتوقيع',
  signatoryAuthorisedOn: 'تاريخُ التفويض',
  governingLawAr: 'القانونُ الحاكم',
  disputeVenueAr: 'جهةُ تسوية النزاع',
}

/** ما ينقص من هويّة الطرف الأوّل — فارغةٌ تعني أنّ العقدَ يجوز إرسالُه */
export function missingAcademyLegalFields(
  source: Record<string, string> = ACADEMY_LEGAL,
): AcademyLegalField[] {
  return REQUIRED_LEGAL_FIELDS.filter((f) => !String(source[f] ?? '').trim())
}

/** رسالةٌ تسمّي الناقصَ بعينه — لا «الهويّة ناقصة» وحدَها، فلا تدلّ على عمل */
export function academyLegalGapMessageAr(missing: readonly AcademyLegalField[]): string {
  return `هويّةُ الأكاديميّة القانونيّة غيرُ مكتملة — لا يُرسَل عقدٌ بطرفٍ أوّلَ ناقص. الناقص: ${
    missing.map((f) => LEGAL_FIELD_LABELS_AR[f]).join(' · ')
  }`
}

/** سطرُ الطرف الأوّل كما يُطبَع في ديباجة العقد.

    ولا يُستدعى إلّا بعد `missingAcademyLegalFields()` خاليةً — ومن استدعاه
    قبلها طبع فراغاتٍ في وثيقة. */
export function academyPartyLineAr(source = ACADEMY_LEGAL): string {
  return `${source.legalNameAr}، ${source.entityFormAr}، المسجَّلة في ${
    source.countryAr} بالسجلّ التجاريّ رقم ${source.registrationNo} والرقم الضريبيّ ${
    source.taxNo}، وعنوانها ${source.registeredAddressAr}، ${source.cityAr}` +
    `، وتعمل باسم «${source.tradingNameAr}»` +
    `، ويمثّلها في توقيع هذا العقد ${source.signatoryNameAr} بصفته ${source.signatoryTitleAr}`
}
