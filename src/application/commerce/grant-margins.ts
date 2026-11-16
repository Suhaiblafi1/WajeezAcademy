/* الهامشُ في كلّ المنح — ما تشترك فيه لوحتُه والخادم (١٦ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة، وهو ينظر في «فحص الهامش» لبلاك فرايدي: «وامنحني معرفة الهامش لكل نوع من المنح». وكان الفحصُ في صفحة
   كلّ منحةٍ وحدَها، وبنسبتها وأعلى عمولةٍ لمؤثّرٍ نشط — فلا يُرى ما يقع بخصم مؤثّرٍ بعينه وعمولته. فصار في رأس كلّ صفحة منحةٍ
   لوحٌ واحدٌ لها كلِّها: لكلّ منحةٍ صفٌّ بنسبتها، ولكلّ مؤثّرٍ نشطٍ صفٌّ بخصمه وعمولته هو.

   والهامشُ هنا هامشُ المقعد الواحد: سعرُه بعد المنحة ناقصا أجرَ المدرّب عن المقعد وعمولةَ المؤثّر — كما يحسبه «فحص الهامش»
   (`GrantService.margins`)، لا حسابٌ ثانٍ. وهنا تلخيصُه وحدَه: كم شعبة، وكم تخسر، وكم لا يُحكم عليها، والمتوسّطُ والأدنى.
   والخادم: `server/services/grant-margins.service.ts`. والحارس: `server/tests/commerce/grant-margins-summary.test.ts`. */

/** ملخّصُ هامش المقعد في شعبٍ مفتوحة */
export interface MarginStats {
  /** الشعبُ المفتوحةُ بسعرٍ — ما يعدّه «فحص الهامش» */
  cohorts: number
  /** ما هامشُه دون الصفر */
  losing: number
  /** بلا أجرِ مقعدٍ يُحكم به: أجرٌ ثابتٌ للشعبة، أو بلا قاعدة أجر */
  noCost: number
  /** بعملةٍ غيرِ عملة الدفتر — تُعدّ في الخاسرة ولا تدخل المتوسّطَ والأدنى */
  otherCurrency: number
  /** متوسّطُ هامش المقعد وأدناه بعملة الدفتر — أو `null` إن لم تُحكم شعبة */
  avg: number | null
  min: number | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** من صفوف «فحص الهامش» إلى ملخّصها */
export function marginStats(rows: readonly { margin: number | null; currency: string }[], ledger: string): MarginStats {
  const judged = rows.filter((r): r is { margin: number; currency: string } => r.margin !== null)
  const inLedger = judged.filter((r) => r.currency === ledger).map((r) => r.margin)
  return {
    cohorts: rows.length,
    losing: judged.filter((r) => r.margin < 0).length,
    noCost: rows.length - judged.length,
    otherCurrency: judged.length - inLedger.length,
    avg: inLedger.length ? round2(inLedger.reduce((s, m) => s + m, 0) / inLedger.length) : null,
    min: inLedger.length ? Math.min(...inLedger) : null,
  }
}

export const GRANT_MARGINS_TITLE_AR = 'الهامش في كل المنح'
export const GRANT_MARGINS_LINE_AR = 'الهامش هنا: سعر المقعد بعد المنحة ناقصا أجر المدرب وعمولة المؤثر وحصة الشريك، في كل شعبة مفتوحة. وفحص الهامش في صفحة كل منحة يسمي الشعب.'
export const GRANT_MARGINS_TOP_AR = 'عمولة منحتي المؤثرين أعلى عمولة لمؤثر نشط، وتحت كل منهما كل مؤثر نشط بخصمه وعمولته.'
