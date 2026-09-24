/* حذفُ العقود، وجوابُ طلب التعديل — طلبان لصاحب المنصّة (٢٤ سبتمبر ٢٠٢٦).
 *
 * ── ما كان ──
 *
 * ① طلبُ التعديل يصل ويُحفَظ ويُشعِر، **ولا شيءَ يردّه**: لا شاشةَ تقرؤه ولا
 *    فعلَ يُنهيه. فيقف العقدُ في `amendment_requested` أبدا — وهو ما رآه
 *    صاحبُ المنصّة في قائمته.
 * ② ولا حذفَ أصلا: القائمةُ تمتلئ بمسوّداتٍ وملغَياتٍ لا تُفيد.
 *
 * ── والحدُّ الذي لا يُتجاوز ──
 *
 * **ما مسّه توقيعٌ لا يُحذَف.** وثيقةٌ وقّعها إنسانٌ دليلٌ يُحتَجّ به له
 * وعليه، ومحوُها يمحو ما التزم به الطرفان. والحارسُ هنا يُثبت أنّ المنعَ
 * في **الخادم** لا في إخفاء زرٍّ: من اكتفى بإخفائه حذف بـ`curl`.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isUntouchableContract } from '@/application/trainer/contract-untouchable'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const service = read('server/services/trainer-review.service.ts')
const routes = read('server/http/routes/admin-trainer.routes.ts')
const screen = read('src/pages/admin/TrainerContracts.tsx')

/* ═══ متنُ الدالّة وحدَها — لا إلى آخر الملفّ ═══

   كان الاقتطاعُ يمتدّ من اسم الدالّة إلى نهاية الملفّ، فتلتقط المطابقةُ
   دوالَّ بعدها: نُقض القيدُ في `replyToAmendment` فمرّ الحارسُ، لأنّ
   `CONTRACT_AMENDMENT_REQUESTED` مكتوبٌ في `revokeContract` أسفلَه.
   وهي خضرةٌ كاذبةٌ بعينها — تُمسك اسما لا موضعا. */
function fnBody(src: string, name: string): string {
  const at = src.indexOf(`async ${name}(`)
  if (at < 0) return ''
  const next = src.indexOf('\n  async ', at + 1)
  return src.slice(at, next < 0 ? src.length : next)
}

describe('ما مسّه توقيعٌ لا يُحذَف', () => {
  const open = { status: 'sent', signedAt: null, countersignedAt: null }

  it('المفتوحُ يُحذف — مسوّدةً كان أو مرسَلا أو ملغًى', () => {
    for (const status of ['draft', 'sent', 'revoked', 'declined', 'expired', 'amendment_requested']) {
      expect(isUntouchableContract({ ...open, status }), `مُنع حذفُ ${status}`).toBe(false)
    }
  })

  it('والموقَّعُ لا يُحذف — بالحالة أو بالتاريخ، وكلٌّ يمسك ما يفلت من الآخر', () => {
    for (const status of ['signed', 'countersigned', 'terminated', 'superseded']) {
      expect(isUntouchableContract({ ...open, status }), `أُبيح حذفُ ${status}`).toBe(true)
    }
    /* وصفٌّ حالتُه مفتوحةٌ وتاريخُ توقيعه مكتوب — عطبُ هجرةٍ قديمة، والحكمُ
       أن يُصان لا أن يُمحى لأنّ عمودا اختلف. */
    expect(isUntouchableContract({ ...open, signedAt: new Date() })).toBe(true)
    expect(isUntouchableContract({ ...open, countersignedAt: new Date() })).toBe(true)
  })

  it('والمنعُ في الخادم لا في إخفاء زرّ — ومن أخفى الزرَّ وحدَه حُذف بـ`curl`', () => {
    expect(service).toMatch(/isUntouchableContract\(c\)/)
    expect(service, 'الحذفُ بلا حارسِ توقيع').toMatch(/async deleteContract/)
    /* والقيدُ يُعاد في المحو نفسِه: بين القراءة والمحو قد يُوقَّع */
    const fn = fnBody(service, 'deleteContract')
    expect(fn, 'المحوُ بلا قيدٍ على التوقيع — سباقٌ يمحو موقَّعا')
      .toMatch(/deleteMany\(\{[\s\S]*signedAt: null, countersignedAt: null/)
  })

  it('وشرطُ الزرّ صورةُ شرطِ الخادم — فلا يُعرَض زرٌّ يُردّ', () => {
    expect(screen).toMatch(/!c\.signedAt && !c\.countersignedAt/)
    for (const s of ['signed', 'countersigned', 'terminated', 'superseded']) {
      expect(screen, `الشاشةُ لا تمنع ${s}`).toMatch(new RegExp(`"${s}"`))
    }
  })

  /* والحذفُ يُكتب في الأثر **قبل** المحو: بعده لا يبقى صفٌّ يُقرأ منه عنوان */
  it('والأثرُ يُكتب قبل المحو لا بعده', () => {
    const fn = fnBody(service, 'deleteContract')
    const audit = fn.indexOf("action: 'trainer.contract.delete'")
    const del = fn.indexOf('deleteMany')
    expect(audit).toBeGreaterThan(-1)
    expect(audit, 'الأثرُ بعد المحو — فلا عنوانَ يُقرأ ولا حالة').toBeLessThan(del)
  })
})

describe('طلبُ التعديل يُقرأ ويُجاب', () => {
  it('المسارُ قائمٌ، وصلاحيّتُه صلاحيّةُ إدارة العقد', () => {
    expect(routes).toMatch(/'\/api\/admin\/trainer-contracts\/:contractId\/amendment-reply'/)
    const at = routes.indexOf('amendment-reply')
    const block = routes.slice(at - 400, at + 400)
    expect(block).toMatch(/requirePermission\('trainer\.contract\.manage'\)/)
  })

  it('والجوابُ يعيد العقدَ إلى التوقيع ويُحفَظ معه', () => {
    const fn = fnBody(service, 'replyToAmendment')
    expect(fn).toMatch(/status: 'sent'/)
    expect(fn).toMatch(/amendmentReplyAr/)
    /* ولا يُجاب إلّا عن طلبٍ قائم — وإلّا أُعيد عقدٌ ملغًى إلى التوقيع */
    expect(fn, 'الجوابُ بلا قيدٍ على الحالة').toMatch(/status: CONTRACT_AMENDMENT_REQUESTED/)
  })

  /* والرمزُ يُجدَّد: المحفوظُ هاشُه، فلا سبيلَ إلى إرسال القديم — وجوابٌ لا
     يصل صاحبَه ليس جوابا. */
  it('ويصل صاحبَه برابطٍ يعمل', () => {
    const fn = fnBody(service, 'replyToAmendment')
    expect(fn).toMatch(/mintContractToken\(\)/)
    expect(fn).toMatch(/mailContract\(/)
  })

  it('والإلغاءُ صار يقبل الموقوفَ على طلبِ تعديل — وهو «أُلغي وأُرسل مصحَّحا»', () => {
    expect(service).toMatch(/status: \{ in: \['draft', 'sent', CONTRACT_AMENDMENT_REQUESTED\] \}/)
  })

  it('والشاشةُ تعرض نصَّ الطلب لا حالتَه وحدَها', () => {
    expect(screen).toMatch(/c\.amendmentRequestAr/)
    expect(screen).toMatch(/amendment-reply/)
  })

  it('ويخرج الحقلان من الخادم إلى القائمة — وبلا ذلك لا تعرض الشاشةُ شيئا', () => {
    expect(service).toMatch(/amendmentRequestAr: true/)
    expect(service).toMatch(/amendmentReplyAr: true/)
  })
})

describe('قائمةُ العقود تُقرأ', () => {
  /* كان الصفُّ يسكب عناوينَ الملحق (أ) كلَّها — أربعا وثلاثين عنوانا في
     عقدٍ واحد — فتصير القائمةُ جدارا لا تُميَّز فيه عقدةٌ من عقدة. */
  it('الملحقُ (أ) يُطوى ويُعرَض عددُه', () => {
    expect(screen).toMatch(/<details/)
    expect(screen).toMatch(/c\.qualifiedSnapshot\.length\} دورةً مؤهّلا لها/)
  })
})
