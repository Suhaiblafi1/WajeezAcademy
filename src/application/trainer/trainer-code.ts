/* كودُ المدرّب — نسبةٌ على دوراته، تُحسم من مستحقّاته بقدر ما مُنح فعلا.

   ═══ القرار ═══

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦)، نسخا لـ«مبلغٍ لا نسبة» في
   `issued-discount.ts`: «اصدار كود وليس خصم مباشر، والخصم يكون نسبة وليس
   رقما، ويعطي الخصم لمن يريد ليضعه في خانة الكودات». ثمّ: «السقفُ ٣٠٪،
   لدوراته وحدَها، إن اشترى أحدٌ دوراتٍ أخرى مع مدرّبين غيره».

   ═══ وعلّتا «المبلغ» القديمتان — ما حلّ محلَّهما ═══

   كان «المبلغُ لا النسبة» لعلّتين مكتوبتين في رأس `issued-discount.ts`:

   ① **النسبةُ على السلّة كلِّها** — فمن اشترى خمسا تحمّل المدرّبُ عن خمس.
      وقد زالت بالبناء: الكودُ يقع على شعبه هو وحدَها (`cohortIds` في
      `priceCart`)، ودوراتُ غيره في السلّة نفسِها لا يمسّها.
   ② **والنسبةُ دالّةٌ في سعرٍ نملكه نحن** — نرفع السعرَ فيرتفع ما يُحسم منه.
      وهذه باقيةٌ بطبع النسبة، وقد قبلها صاحبُ المنصّة بقراره. فتُقال له
      صريحةً في البند 4-10: ما يُحسم هو **ما مُنح فعلا** في شراءٍ بعينه،
      بسعر يومه — لا نسبةٌ من سعرٍ مستقبَل.

   ═══ والحسمُ بقدر ما مُنح، لا بقدر ما كُتب ═══

   الكودُ يقع بعد خصوم الأكاديميّة (الباقة ثمّ السقف)، فعشرون بالمئة على
   دورةٍ خُصم منها ثمانيةَ عشرَ بالباقة هي عشرون من الباقي لا من سعر القائمة.
   وما يُحسم منه هو هذا الرقمُ بعينه، محفوظا في صفّ الاستعمال لحظةَ الشراء —
   فلا يُعاد حسابُه بعد شهرٍ على سعرٍ تغيّر. */

import { settleAgainst } from './issued-discount'
import { priceCart } from '../commerce/cart-pricing'

/** أقصى نسبةٍ يصدرها — بقرار صاحب المنصّة، وقيدُها في القاعدة كذلك
    (`TrainerCode_percent_range`)، فلا يمرّ فوقها شيءٌ من بابٍ غيرِ الشاشة */
export const MAX_TRAINER_CODE_PERCENT = 30

/** أدناها — كودٌ بصفرٍ صفٌّ في القاعدة لا منفعةَ فيه لأحد */
export const MIN_TRAINER_CODE_PERCENT = 1

const round2 = (n: number) => Math.round(n * 100) / 100

/* ═══ والكودُ نسبةٌ **أو** مبلغ (١ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة جوابا على مدرّبٍ اشتكى أنّ خصمه قد يزيد على ما يقبضه عن
   المتعلّم نفسِه: «يحقّ للمدرّب أن يختار إمّا نسبةً أو أن يختار رقما لهذا
   الكود… فيحصل على ٢٠ دولارا أو ١٥ أو ٣٠ خصما». وعلّةُ المبلغ مكتوبةٌ من قبلُ
   في رأس `issued-discount.ts`: «والمبلغُ يبقى ما كتبه: عشرون دولارا تبقى
   عشرين» — رقمٌ يقابله المدرّبُ برقم أتعابه، والنسبةُ تتبدّل بسعر كلّ دورة.

   ── وسقفُ الثلاثين يسري على المبلغ كذلك ──

   السقفُ قرارُ صاحب المنصّة (٢٧ سبتمبر): «السقفُ ٣٠٪، لدوراته وحدَها». ومبلغٌ
   بلا سقفٍ بابٌ يتخطّاه: خمسون دولارا على دورةٍ بستّين خصمُ ٨٣٪. فلا يتجاوز
   خصمُ الكود — نسبةً كان أو مبلغا — ثلاثين بالمئة من سعر الشعبة بعد خصوم
   الأكاديميّة، ويُقال ذلك في البند 4-10 وتُريه «دعوتي» قبل الإصدار. */

/** أقصى مبلغٍ يُكتب — حدٌّ لغلطةِ صفرٍ زائدٍ لا لقرار: السقفُ الحقيقيُّ ثلاثون بالمئة */
export const MAX_TRAINER_CODE_AMOUNT = 1000

/** وجهُ الكود: نسبةٌ أو مبلغ، أحدُهما لا كلاهما (`TrainerCode_one_face`) */
export interface CodeFace {
  percentOff: number | null
  amountOff: number | null
}

/** ما يمنحه الكودُ على شعبةٍ بسعرها إن اشتُريت وحدَها، وما يدفعه المتعلّمُ بعده.

    **من `priceCart` نفسِها لا من معادلةٍ بجانبها.** كانت هنا معادلةٌ ثانيةٌ
    (السعرُ × النسبة، مسقوفا بالثلاثين) — فقابلها فحصٌ بالسلّة فافترقتا: دورةٌ
    بألفٍ ومئتين تُعرض بخصمِ اثني عشر وتقتطع السلّةُ ستّة، لأنّ السلّةَ تُطبّق
    سقفَ سعر المسار (`MAX_BUNDLE_TOTAL`) قبل الكود. ونسخُ تلك القاعدة هنا يُبقي
    البابَ مفتوحا لقاعدةٍ ثالثةٍ تُضاف هناك ولا تُضاف هنا. فيُنادى الحسابُ نفسُه:
    الرقمُ الذي يراه المدرّبُ هو الذي يُقتطع، بالبناء لا بالاتّفاق. */
export function codeQuoteFor(face: CodeFace, price: number, currency?: string): { value: number; pays: number } {
  const q = priceCart(
    [{ cohortId: 'quote', courseId: 'quote', titleAr: '', listPrice: Math.max(0, price) }],
    null,
    { ...face, cohortIds: ['quote'], maxPercentOfBase: MAX_TRAINER_CODE_PERCENT },
    currency,
  )
  return { value: q.couponDiscount, pays: q.total }
}

/** ما يمنحه الكودُ على شعبةٍ بسعرها إن اشتُريت وحدَها — وهو ما تقتطعه السلّةُ بعينه */
export function codeValueFor(face: CodeFace, price: number, currency?: string): number {
  return codeQuoteFor(face, price, currency).value
}

/** دورةٌ من دوراته المفتوحة بسعرها، وأتعابُ مقعده فيها — يقرؤها «دعوتي» قبل الإصدار */
export interface CodePricingCourse {
  cohortId: string
  titleAr: string
  price: number
  currency: string
  /** أتعابُ المقعد العامّ بقاعدته في هذه الشعبة — `null` حين لا تُحتسب بالمقعد */
  seatFee: number | null
  /** وعن المقعد الذي يأتي عبر رابط دعوته */
  referralSeatFee: number | null
}

/** صفُّ جدول «ما يمنحه كودُك» — القيمةُ بالدولار، وأيُسقَف، وأيزيد على أجر المقعد */
export interface CodeValueRow extends CodePricingCourse {
  /** ما يمنحه الكودُ على هذه الدورة إن اشتُريت وحدَها — وهو ما يُحسم منه */
  value: number
  /** ما يدفعه المتعلّمُ بعده */
  pays: number
  /** أسقَفَ الثلاثون مبلغَه؟ — فيُقال له إنّ ما يُمنح أقلُّ ممّا كتب */
  capped: boolean
  /** أيزيد الخصمُ على أجر المقعد العامّ؟ — شكوى المدرّب نفسُها: «يأخذ ١٥ عن هذا
      الشخص ويعطيه خصما بعشرين، فيخسر فيه خمسة». والعامُّ هو المقيس: من استعمل
      الكودَ ولم يدخل من رابط دعوته يُحتسب مقعدُه عامّا. */
  exceedsSeatFee: boolean
}

/** جدولُ «ما يمنحه كودُك» — من `codeValueFor` نفسِها، فلا يُرى رقمٌ يُحسم غيرُه */
export function codeValueRows(face: CodeFace, courses: readonly CodePricingCourse[]): CodeValueRow[] {
  return courses.map((c) => {
    /* وما يدفعه المتعلّمُ من السلّة كذلك — لا «السعرُ ناقصا الخصم»: سقفُ المسار
       يسبق الكود، فدورةٌ فوقه يدفع صاحبُها أقلَّ من سعرها قبل أيّ كود */
    const { value, pays } = codeQuoteFor(face, c.price, c.currency)
    return {
      ...c,
      value,
      pays,
      capped: face.amountOff != null && value < round2(face.amountOff),
      exceedsSeatFee: c.seatFee !== null && value > c.seatFee,
    }
  })
}

/** «٢٠٪» أو «$20» — كما يُطبع في الكشف والقائمة */
export function codeFaceAr(face: CodeFace, formatAmount: (amount: number) => string): string {
  return face.percentOff != null ? `${face.percentOff}٪` : formatAmount(face.amountOff ?? 0)
}

/** حصّةُ ما رُدّ من الثمن — بين الصفر والواحد.

    والردُّ لا يعرف بنودَه: `Refund` مبلغٌ على دفعةٍ لا على دورة. فالحصّةُ
    بالمال هي المعلومةُ الوحيدةُ المتاحة، وهي عادلةٌ في الاتّجاهين: لا يُحسم
    من المدرّب كاملُ خصمٍ عن شراءٍ رُدّ نصفُه، ولا يُعفى منه كلُّه. */
export function refundedShare(refunded: number, paid: number): number {
  if (!(paid > 0) || !(refunded > 0)) return 0
  return Math.min(1, refunded / paid)
}

/** ما يبقى عليه من خصمٍ مُنح، بعد أن رُدّ من الثمن حصّةٌ منه */
export function owedAfterRefund(amount: number, share: number): number {
  return Math.max(0, round2(amount * (1 - Math.min(1, Math.max(0, share)))))
}

/** بندٌ ينتظر الكشف — حسمٌ موجب، أو إعادةٌ حين يكون ما حُسم أكثرَ ممّا عليه */
export interface LedgerEntry {
  /** مرجعُ البند في الكشف (`sourceRef`) — به يُعاد عند إلغاء الكشف */
  ref: string
  amount: number
  at: Date
}

/** ما يأخذه كشفٌ واحد: الإعاداتُ كلُّها، والحسومُ كاملةً ما وسعها.

    والإعادةُ تُؤخذ دائما: هي مالٌ له لا عليه، فلا سببَ يؤجّلها. وتُضاف إلى
    ما يسعه الكشفُ من الحسوم — فإعادةٌ عن شراءٍ رُدّ ثمنُه تفتح مكانا لحسمٍ
    تأجّل. والحسومُ **كاملةً** بالأقدم أوّلا (`settleAgainst`): بندٌ نصفُه هنا
    ونصفُه هناك يجعل المدرّبَ يقابل كشفَين ليعرف ما حُسم عن شراءٍ واحد، ولا
    ينزل الكشفُ تحت الصفر فيصير دَينا يمنعه البند 4-10. */
export function planLedger(gross: number, deductions: readonly LedgerEntry[], credits: readonly LedgerEntry[]) {
  const credited = round2(credits.reduce((s, c) => s + c.amount, 0))
  const ordered = [...deductions].sort((a, b) => a.at.getTime() - b.at.getTime())
  const { taken, deferred } = settleAgainst(round2(gross + credited), ordered.map((d) => ({ ...d, id: d.ref })))
  return { taken, deferred, credits: [...credits], credited }
}

/* ═══════════ الإصدار (٤ب) ═══════════ */

/** أقصى عددِ استعمالاتٍ يُكتب — حدٌّ لغلطةِ صفرٍ زائدٍ لا لقرار: كودٌ بلا حدٍّ
    يُترك الحقلُ فارغا له */
export const MAX_TRAINER_CODE_USES = 10_000

/** لمَ لا يُصدَر — جملةٌ تُقال له، أو `null` إن جاز.

    من هنا لا من الخادم ولا من الشاشة: الشاشةُ تعطّل الزرَّ بها والخادمُ يردّ
    بها، فيقرأ الاثنين نصّا واحدا — كما كان حاجزُ الخصم بالمبلغ قبلها. */
export function codeBlockerAr(
  input: {
    percentOff?: number | null; amountOff?: number | null
    labelAr: string; maxUses?: number | null; expiresAt?: Date | null
  },
  now = new Date(),
): string | null {
  const hasP = input.percentOff != null
  const hasA = input.amountOff != null
  if (hasP === hasA) return 'اختر للكود نسبةً أو مبلغا — أحدَهما.'
  if (hasP) {
    const p = input.percentOff!
    if (!Number.isInteger(p)) return 'النسبةُ عددٌ صحيحٌ بلا كسور.'
    if (p < MIN_TRAINER_CODE_PERCENT || p > MAX_TRAINER_CODE_PERCENT) {
      return `النسبةُ بين ${MIN_TRAINER_CODE_PERCENT} و${MAX_TRAINER_CODE_PERCENT} بالمئة — والسقفُ في البند 4-10 من عقدك.`
    }
  } else {
    const a = input.amountOff!
    if (!Number.isFinite(a) || a < 1 || a > MAX_TRAINER_CODE_AMOUNT) {
      return `المبلغُ بين ١ و${MAX_TRAINER_CODE_AMOUNT} دولار.`
    }
    /* وبسماحةٍ لا بمساواة: `19.99 × 100` في الحساب العائم ١٩٩٨٫٩٩٩٩٩٩٩٩٩٩٩٩٩٨،
       فكانت المساواةُ تردّ مبلغا صحيحا — وجده فحصٌ لا مستعمِل. */
    if (Math.abs(a * 100 - Math.round(a * 100)) > 1e-6) return 'المبلغُ بمنزلتين عشريّتين على الأكثر.'
  }
  if (input.labelAr.trim().length < 2) return 'اكتب لمن تنشره أو أين — يُطبع في كشفك لتعرف بعد شهرين عمّ حُسم.'
  const u = input.maxUses
  if (u != null && (!Number.isInteger(u) || u < 1 || u > MAX_TRAINER_CODE_USES)) {
    return `عددُ الاستعمالات بين ١ و${MAX_TRAINER_CODE_USES} — أو اتركه فارغا بلا حدّ.`
  }
  if (input.expiresAt && input.expiresAt.getTime() <= now.getTime()) return 'تاريخُ الانتهاء في الماضي.'
  return null
}

/** حالُ الكود كما تُقال له — الحالةُ المخزَّنةُ وما يُشتقّ منها (انتهى · استُنفد) */
export function codeStateAr(
  c: { status: string; expiresAt: Date | string | null; maxUses: number | null; usedCount: number },
  now = new Date(),
): { key: 'live' | 'paused' | 'revoked' | 'expired' | 'exhausted'; labelAr: string } {
  if (c.status === 'revoked') return { key: 'revoked', labelAr: 'ألغيتَه — لا يُستعمل بعد' }
  if (c.expiresAt && new Date(c.expiresAt).getTime() <= now.getTime()) return { key: 'expired', labelAr: 'انتهت مدّتُه' }
  if (c.maxUses != null && c.usedCount >= c.maxUses) return { key: 'exhausted', labelAr: 'استُنفدت استعمالاتُه' }
  if (c.status === 'paused') return { key: 'paused', labelAr: 'موقوفٌ — تستأنفه متى شئت' }
  return { key: 'live', labelAr: 'يعمل' }
}

/* ═══ والقبولُ مرّةً واحدة — لمن وقّع على «المبلغ» ═══

   البند 4-10 بصيغته الجديدة دخل المتنَ في الجيل الثالث عشر (`v13`). فمن وقّع
   عقدا من ذلك الجيل فما بعده فقد أقرّ به في توقيعه، ولا يُسأل ثانيةً. ومن وقّع
   قبله وقّع على «مبلغٍ معلومٍ لا نسبة» — فالحسمُ بالنسبة من مستحقّاته لا سندَ
   له في عقده حتّى يقبل الصيغةَ الجديدة، مرّةً واحدة، بنصّها كما في العقد.

   و`CODE_TERMS_VERSION` يتحرّك مع نصّ البند وحدَه — لا مع كلّ رفعٍ لإصدار
   المتن. فإن عُدّل البندُ يوما رُفع هذا، ورُفع معه `CODE_TERMS_FIRST_BODY` إلى
   الجيل الذي حمل التعديل، فيُسأل من قبل القديمَ عن الجديد. والحارسُ بصمةُ
   النصّ في `src/tests/trainer/trainer-code-terms.test.ts`. */
/* و`v2` (١ أكتوبر ٢٠٢٦): الكودُ نسبةٌ أو مبلغ، وسقفُ الثلاثين على الوجهين،
   والمنصّةُ تُريه قيمتَه قبل إصداره — وحمله الجيلُ الحادي والعشرون. فمن وقّع
   ما قبله يقبل البندَ بصيغته هذه مرّةً واحدةً قبل أوّل كودٍ بعدها. */
export const CODE_TERMS_VERSION = 'code-4-10-v2-2026-10-01'
export const CODE_TERMS_FIRST_BODY = 21

/** أيحمل هذا المتنُ الموقَّعُ البندَ بصيغته الجديدة؟ — من رقم جيله */
export function contractCarriesCodeTerms(bodyVersion: string | null | undefined): boolean {
  const m = /^v(\d+)-/.exec(bodyVersion ?? '')
  return m !== null && Number(m[1]) >= CODE_TERMS_FIRST_BODY
}

/* ═══════════ الرصيد — لا يمنح كودُه ما ليس له عندنا (٢٨ سبتمبر ٢٠٢٦) ═══════════

   قرارُ صاحب المنصّة بنصّه: «capped with the amount he has». فالكودُ لا يقع على
   شراءٍ يزيد خصمُه على ما للمدرّب عندنا ناقصا ما التزم به ولم يُحسم — وإلّا
   حُسم منه ما لا يجد كشفا يسعه، فتأجّل حتّى يرحل المدرّبُ فتتحمّله الأكاديميّة.
   وهو عكسُ البند 4-10 نفسِه: «ويتحمل المدرب وحده ما يمنحه من خصم».

   ─────────── وما «له عندنا» ───────────

   مستحقّاتٌ لم تُصرف (منتظرةٌ ومعتمَدة)، وما يُعاد إليه عن شراءٍ رُدّ ثمنُه، وما
   يُتوقَّع له من شعبه المفتوحة التي تُحتسب له — **والشراءُ الذي يُسعَّر الآن منها**:
   مقعدُه يزيد أجرَ المدرّب، فشراءٌ يغطّي أجرُه خصمَه يمرّ ولو كان الرصيدُ قبله
   صفرا. وإلّا لم يعمل كودٌ لمدرّبٍ جديدٍ قطّ — وهو أحوجُ من ينشره.

   ─────────── وما «التزم به» ───────────

   خصومُه القديمةُ بالمبلغ ما لم تُحسم (صالحةً قد تُستعمل، ومستعمَلةً تنتظر)، وما
   مُنح بأكواده ولم يُحسم بعد، وما حُجز منها في طلباتٍ لم تُدفع بعد.

   والرصيدُ لا يُفحص عند الإصدار: الكودُ لا يكلّف شيئا حتّى يُستعمل. يُفحص عند كلّ
   شراء — في التسعير ليُقال للمشتري في موضعه، وفي معاملة الطلب بقفلٍ لكلّ مدرّب
   فلا يمرّ شراءان على آخر ما في الرصيد. */

export interface CodeBudget {
  /** ما له عندنا — مستحقّاتٌ لم تُصرف، وما يُعاد إليه، وما يُتوقَّع من شعبه المفتوحة */
  allowance: number
  /** ما التزم به ولم يُحسم — خصومٌ قديمةٌ، وما منحته أكوادُه، وما حُجز منها */
  committed: number
  /** الفرق، ولا ينزل تحت الصفر */
  remaining: number
  currency: string
}

export function codeBudget(input: {
  owed: number
  credits: number
  projected: number
  committed: number
  currency: string
}): CodeBudget {
  const allowance = round2(input.owed + input.credits + input.projected)
  const committed = round2(input.committed)
  return { allowance, committed, remaining: round2(Math.max(0, allowance - committed)), currency: input.currency }
}

/** أيسع الرصيدُ هذا الخصم؟ — بالقرش، فلا يُردّ خصمٌ يساوي الرصيدَ تماما */
export function budgetCovers(budget: CodeBudget, discount: number): boolean {
  return round2(discount) <= budget.remaining
}

/** ما يُقال للمشتري حين لا يسع الرصيدُ خصمَه — ولا تُكشف له مستحقّاتُ أحد */
export const CODE_UNAVAILABLE_AR = 'بلغ هذا الكودُ حدَّه الآن — أكمل الشراءَ بدونه أو جرّبه لاحقا'
