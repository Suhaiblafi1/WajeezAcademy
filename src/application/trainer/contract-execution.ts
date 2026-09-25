/* سجلُّ تنفيذ العقد — ما يجيب سؤالَ «أين نضع توقيعنا؟».

   ═══ العطبُ الذي وُلد منه ═══

   المدرّبُ يوقّع في الصفحة، فيُكتب في صفّه اثنا عشرَ عمودا هي دليلُ توقيعه:
   اسمُه القانونيُّ بخطّه، وعنوانُه وهاتفُه، ونصُّ الإقرار الذي ضغطه، والجملُ
   الستُّ التي أقرّ بها واحدةً واحدةً، وبصمةُ ما عُرض عليه، ثمّ اسمُ من اعتمده
   عنّا وصفتُه وتاريخُه. **ولا واحدٌ منها كان يُعرَض له.**

   فتصله نسختُه «نصّا طويلا غير موقَّع» — سطورُ العقد كما خرجت من القالب، بلا
   أثرٍ لأنّه وقّعها. فيسأل: أين نضع توقيعنا؟ وهو سؤالٌ صحيحٌ عن **عرضٍ** ناقص
   لا عن **حفظٍ** ناقص: الدليلُ محفوظٌ كلُّه، وما نقص أن يُرى.

   ═══ وقيدٌ بنيويٌّ يحكم هذا الملفَّ كلَّه ═══

   **سجلُّ التنفيذ لا يدخل `bodyAr` أبدا.** فالمتنُ مهشَّشٌ (`bodyHash`) ويُقابَل
   هاشُه لحظةَ التوقيع، وما وُقّع عليه لا يُزاد عليه حرفٌ بعد التوقيع — ومن
   ألحق سجلَّ التوقيع بالمتن نقض بصمتَه ومنع كلَّ توقيعٍ لاحق. فهو يُصيَّر
   **بجانب** الوثيقة مكوّنا مستقلّا، موسوما بأنّه سجلُّ تنفيذٍ لا نصُّ عقد.

   والحسابُ هنا لا في المكوّن: تقرؤه الشاشةُ والخادمُ والاختبار، فلا ثلاثُ
   نسخٍ تفترق. */

/** جملةٌ أقرّ بها الموقِّعُ واحدةً واحدةً، كما عُرضت عليه لحظتَها */
export interface ConsentAck {
  key: string
  textAr: string
}

/** ما حُفظ عن التوقيع والاعتماد — أعمدةُ العقد كما تُقرأ، لا أكثر.

    والتواريخُ `string | Date`: من الخادم تصل نصّا بعد JSON، ومن القاعدة
    مباشرةً كائنا. فالنوعُ يحمل الاثنين ولا تُحوَّل القراءةُ عند كلّ موضع. */
export interface ContractSeal {
  signedAt?: string | Date | null
  signerLegalName?: string | null
  signerAddressAr?: string | null
  signerPhone?: string | null
  consentTextAr?: string | null
  consentAcksAr?: unknown
  /** بصمةُ ما عُرض عليه فعلا لحظةَ التوقيع */
  signedBodyHash?: string | null
  /** بصمةُ المتن المحفوظ — تُقابَل بالتي قبلها */
  bodyHash?: string | null
  countersignedAt?: string | Date | null
  academySignatoryName?: string | null
  academySignatoryTitle?: string | null
}

/** أعمدةُ الخَتم التي يقرؤها السجلُّ — قائمةٌ واحدةٌ يقيس عليها الخادمُ والشاشة.

    وبها يُحرَس العطبُ الذي وُلد منه هذا الملفُّ كلُّه — **محفوظٌ ولا يُعرَض**.
    فمن قلّم `select` في المسار بعد شهرٍ ولم ينظر في الشاشة تركها تعرض فراغا
    بلا أن يحمرَّ شيء. فيُقابِل اختبارُ الخادم ما يُعاد بهذه القائمة.

    و`src/tests/trainer/contract-execution.test.ts` يقابلها بحقول `ContractSeal`
    نفسِها: من زاد حقلا في الواجهة ولم يزده هنا يسقط — فالقائمةُ لا تتخلّف عن
    الواجهة بصمت. */
export const SEAL_FIELDS = [
  'signedAt', 'signerLegalName', 'signerAddressAr', 'signerPhone',
  'consentTextAr', 'consentAcksAr', 'signedBodyHash', 'bodyHash',
  'countersignedAt', 'academySignatoryName', 'academySignatoryTitle',
] as const satisfies readonly (keyof ContractSeal)[]

/** يقرأ عمودَ `consentAcksAr` كما هو في القاعدة — وعمودُ JSON لا نوعَ له.

    على نمط `readRequiredDocuments`: الصفُّ قد يكون من قبلِ هذا العمود (وقد
    أُضيف في ٢٢ سبتمبر ٢٠٢٦، فكلُّ عقدٍ وُقّع قبله يقرؤه `null`)، أو كُتب
    بصيغةٍ أقدم. ومن قرأه بتحويلٍ أعمى يسقط عند `textAr` من `undefined` —
    **في صفحةٍ يقرؤها مدرّبٌ عن عقده**. فما لا يُفهَم يسقط بصمت، والفراغُ
    يُقرأ قائمةً فارغةً لا انهيارا. */
export function readConsentAcks(value: unknown): ConsentAck[] {
  if (!Array.isArray(value)) return []
  const out: ConsentAck[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (typeof r.key !== 'string' || typeof r.textAr !== 'string') continue
    if (!r.key.trim() || !r.textAr.trim()) continue
    out.push({ key: r.key, textAr: r.textAr })
  }
  return out
}

/** طورُ التنفيذ — والعقدُ لا ينفُذ بتوقيعٍ واحد.

    `signed`: أقرّ المدرّبُ وحدَه، وهو إقرارُ طرفٍ واحدٍ ينتظر قبولَ الآخر.
    `countersigned`: اعتمدت الأكاديميّةُ توقيعَه فصار نافذا بين الطرفين.
    و`unsigned` لعقدٍ لم يوقّعه بعد — ولا سجلَّ تنفيذٍ له فلا يُعرَض. */
export function executionStage(seal: ContractSeal): 'unsigned' | 'signed' | 'countersigned' {
  if (seal.countersignedAt != null) return 'countersigned'
  if (seal.signedAt != null) return 'signed'
  return 'unsigned'
}

/** أهذه النسخةُ هي التي وُقّعت؟ — بصمةُ المعروضِ ببصمةِ الموقَّع عليه.

    ولمَ يُعرَض هذا للمدرّب ولا يُكتفى بحفظه: قوّةُ التوقيع الإلكترونيِّ كلُّها
    في أنّ النصَّ لم يتبدّل بعده، ومن وقّع يملك أن يتحقّق بنفسِه لا أن يُصدّقنا.

    والفراغُ **لا يُقرأ تطابقا**: عقدٌ بلا بصمةٍ محفوظةٍ لا يُقال عنه إنّه سليم،
    فـ`null === null` صحيحٌ في JavaScript وخطأٌ هنا. */
export function bodyIntact(seal: ContractSeal): boolean {
  const shown = seal.bodyHash?.trim()
  const signed = seal.signedBodyHash?.trim()
  if (!shown || !signed) return false
  return shown === signed
}

/* ═══ ملحقُ الدورات المعتمدة — وعدٌ في المتن الموقَّع ═══

   البندُ 2-11 يقول بحرفه: «وتوقع الأكاديمية هذا العرض من جهتها يوم يتحقق
   الشرط، فيصير عقدا نهائيا غير مشروط موقعا من الطرفين، **ويعاد إلى المدرب مع
   ملحق يبين الدورات المعتمدة له**».

   فهذا الملحقُ التزامٌ وقّعه الطرفان لا زينةَ عرض — ولم يكن يُبنى. والعقدُ
   يُختَم، وتُحسب أسماءُ الدورات للبريد وحدَه ثمّ تُنسى: الصفُّ يحفظ عددَها في
   الأثر ولا يحفظ أسماءَها.

   وهو **ملحقٌ ثانٍ بجانب سجلّ التوقيع** لا فصلٌ فيه: ذاك يقول من وقّع وبم
   يُثبَت، وهذا يقول ما اعتمدناه فتحقّق الشرط. وكلاهما لا يدخل `bodyAr`. */

/** دورةٌ في ملحق الاعتماد — ولا رمزَ لاتينيٌّ يُقرأ، فالاسمُ هو المعروض */
export interface ApprovedCourse {
  courseId: string
  titleAr: string
}

/** يقرأ عمودَ `approvedCoursesSnapshot` — عمودُ JSON لا نوعَ له.

    على نمط `readConsentAcks` و`readRequiredDocuments`: عقودٌ خُتمت قبل هذا
    العمود تقرؤه `null`، وعقدٌ غيرُ مشروطٍ لا اعتمادَ موادَّ فيه أصلا. فما لا
    يُفهَم يسقط بصمت، والفراغُ قائمةٌ فارغةٌ لا انهيار.

    ولا يُقبَل عنوانٌ فارغ: صفٌّ بلا `titleAr` يُعرَض سطرا خاويا في ملحقٍ
    قانونيّ — وسطرٌ خاوٍ في ملحقٍ يُقرأ نقصا في الاعتماد لا عطبا في شاشة. */
export function readApprovedCourses(value: unknown): ApprovedCourse[] {
  if (!Array.isArray(value)) return []
  const out: ApprovedCourse[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (typeof r.courseId !== 'string' || typeof r.titleAr !== 'string') continue
    if (!r.courseId.trim() || !r.titleAr.trim()) continue
    out.push({ courseId: r.courseId, titleAr: r.titleAr })
  }
  return out
}
