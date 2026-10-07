/* سعرُ الدورة من صعوبتها وندرتها — قاعدةٌ مكتوبةٌ لا رقمٌ بخطّ اليد.

   ── ما كان ──

   كان السعرُ يُشتقّ من المستوى والطول: أساسٌ لكلّ مستوًى (١٠٠ · ١٢٥ · ١٥٠ ·
   ١٧٥) ودرجةٌ لمن بلغت ستَّ عشرةَ ساعة، في مدى ١٠٠–٢٠٠. فلمّا صارت الدوراتُ
   كلُّها ستَّ عشرةَ ساعة سقط الطولُ عاملا: لا يفرّق بين دورةٍ ودورة.

   ── القاعدة (قرارُ صاحب المنصّة، ٧ أكتوبر ٢٠٢٦) ──

   «كلُّ دورات الأكاديميّة ستَّ عشرةَ ساعة، وأسعارُها بين ١٢٠ و٢٢٥ بحسب ندرة
   الدورة أو صعوبة مهاراتها — إلّا CPIM فثلاثمئة».

   فالسعرُ مجموعُ درجتين، كلٌّ منهما تُقرأ من حقلٍ في الكتالوج لا من رأيٍ
   يُكتب بجانب الدورة:

     · **الصعوبةُ من المستوى (`level_ar`)**: تأسيسيّ صفر · تأسيسيّ–تطبيقيّ
       واحدة · تطبيقيّ وممارس اثنتان.
     · **الندرةُ من مجال الدورة (معرّفُها: `C-CYB-…`)**: مهاراتٌ عامّةٌ يكثر
       من يعلّمها صفر · مهنيّةٌ متخصّصةٌ واحدة · تقنيّةٌ أو هندسيّةٌ نادرةٌ
       اثنتان.

   ومجموعُهما من صفرٍ إلى أربع، ولكلّ درجةٍ سعر: ١٢٠ · ١٥٠ · ١٧٥ · ٢٠٠ · ٢٢٥.
   والاستثناءُ مسمّى بسببه في `PRICE_EXCEPTIONS` — لا رقمٌ يُكتب في الكتالوج
   وحدَه فيُسقطه الفحص.

   ويحرس `course-pricing.test.ts` أن كلَّ سعرٍ في الكتالوج يطيع القاعدة: فإن
   سقط فإمّا السعرُ خطأ، وإمّا القاعدةُ تغيّرت فاكتبها هنا. */

/** درجةُ الصعوبة بالمستوى */
export const LEVEL_DIFFICULTY: Readonly<Record<string, number>> = {
  'تأسيسي': 0,
  'تأسيسي–تطبيقي': 1,
  'تطبيقي': 2,
  'ممارس': 2,
}

/** درجةُ الندرة بمجال الدورة — المقطعُ الثاني من معرّفها */
export const DOMAIN_RARITY: Readonly<Record<string, number>> = {
  /* مهاراتٌ عامّة: المسارُ المهنيّ والتواصلُ والنفسُ والأسرةُ والمالُ الشخصيّ */
  CAR: 0, JOB: 0, COMX: 0, FAM: 0, PSY: 0, EDU: 0, WEL: 0, FIN: 0,
  /* مهنيّةٌ متخصّصة: الإدارةُ والمشاريعُ والبياناتُ والتسويقُ والمبيعات… */
  MGR: 1, SVC: 1, NEG: 1, LND: 1, DAT: 1, PM: 1, HR: 1, MKT: 1, SAL: 1,
  BIZ: 1, OPS: 1, PRD: 1, FINM: 1, GRPH: 1, AI: 1,
  /* تقنيّةٌ أو هندسيّةٌ نادرة: الأمنُ والأتمتةُ والإمدادُ والهندسةُ والتصميمُ الداخليّ والبرمجة */
  CYB: 2, AUT: 2, SCM: 2, ENGR: 2, INTR: 2, WEB: 2,
}

/** السعرُ لكلّ مجموعِ درجات — من صفرٍ إلى أربع */
export const PRICE_BY_SCORE: readonly number[] = [120, 150, 175, 200, 225]

/** حدُّ السعر المُعلَن لأيّ دورةٍ مفردةٍ تطيع القاعدة — بقرار صاحب المنصّة */
export const COURSE_PRICE_RANGE = { min: 120, max: 225 } as const

/** ما خرج عن القاعدة بقرارٍ مسمّى — السعرُ وسببُه */
export const PRICE_EXCEPTIONS: Readonly<Record<string, { price: number; reasonAr: string }>> = {
  'C-SCM-106': {
    price: 300,
    reasonAr: 'التحضيرُ لشهادة CPIM — بقرار صاحب المنصّة (٧ أكتوبر ٢٠٢٦)',
  },
}

/** مجالُ الدورة من معرّفها: `C-CYB-101` ← `CYB` */
export function courseDomainCode(courseId: string): string {
  return courseId.split('-')[1] ?? ''
}

/** سعرُ القائمة من صعوبة الدورة وندرتها — أو null حين لا يُعرف مستواها أو مجالُها.

    و`null` لا صفر: صفرٌ يُقرأ «مجّانا» في كلّ شاشةٍ يمرّ بها، و«لا سعرَ
    محسوبا» حالةٌ يجب أن تُقال لا أن تُسعَّر. */
export function coursePrice(courseId: string, levelAr: string): number | null {
  const exception = PRICE_EXCEPTIONS[courseId]
  if (exception) return exception.price
  const difficulty = LEVEL_DIFFICULTY[levelAr.trim()]
  const rarity = DOMAIN_RARITY[courseDomainCode(courseId)]
  if (difficulty === undefined || rarity === undefined) return null
  return PRICE_BY_SCORE[difficulty + rarity] ?? null
}

/** سعرٌ مقبولٌ في الكتالوج: داخل المدى، أو استثناءٌ مسمّى بسعره نفسِه */
export function isPriceAllowed(courseId: string, price: number): boolean {
  const exception = PRICE_EXCEPTIONS[courseId]
  if (exception) return price === exception.price
  return price >= COURSE_PRICE_RANGE.min && price <= COURSE_PRICE_RANGE.max
}
