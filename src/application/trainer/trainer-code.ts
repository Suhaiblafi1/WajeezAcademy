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

/** أقصى نسبةٍ يصدرها — بقرار صاحب المنصّة، وقيدُها في القاعدة كذلك
    (`TrainerCode_percent_range`)، فلا يمرّ فوقها شيءٌ من بابٍ غيرِ الشاشة */
export const MAX_TRAINER_CODE_PERCENT = 30

/** أدناها — كودٌ بصفرٍ صفٌّ في القاعدة لا منفعةَ فيه لأحد */
export const MIN_TRAINER_CODE_PERCENT = 1

const round2 = (n: number) => Math.round(n * 100) / 100

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
  input: { percentOff: number; labelAr: string; maxUses?: number | null; expiresAt?: Date | null },
  now = new Date(),
): string | null {
  const p = input.percentOff
  if (!Number.isInteger(p)) return 'النسبةُ عددٌ صحيحٌ بلا كسور.'
  if (p < MIN_TRAINER_CODE_PERCENT || p > MAX_TRAINER_CODE_PERCENT) {
    return `النسبةُ بين ${MIN_TRAINER_CODE_PERCENT} و${MAX_TRAINER_CODE_PERCENT} بالمئة — والسقفُ في البند 4-10 من عقدك.`
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
export const CODE_TERMS_VERSION = 'code-4-10-v1-2026-09-27'
export const CODE_TERMS_FIRST_BODY = 13

/** أيحمل هذا المتنُ الموقَّعُ البندَ بصيغته الجديدة؟ — من رقم جيله */
export function contractCarriesCodeTerms(bodyVersion: string | null | undefined): boolean {
  const m = /^v(\d+)-/.exec(bodyVersion ?? '')
  return m !== null && Number(m[1]) >= CODE_TERMS_FIRST_BODY
}
