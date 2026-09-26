/* ردُّ طلب التعديل — الرابطُ الجديدُ لا يُهدَر، والجوابانِ يُقالان.
 *
 * ── العطبُ الأوّل: رابطٌ يُهدَر ──
 *
 * `replyToAmendment` يسكّ رمزا جديدا، و`tokenHash` عمودٌ **فريدٌ** يُكتب فوقَ
 * القديم — فرابطُ المدرّب القديمُ يموت في تلك اللحظة. والخادمُ يُعيد الجديدَ
 * للموظّف لعلّةٍ مكتوبةٍ في رأسه: «فقناةُ البريد قد تتعثّر، ومن يملك
 * الصلاحيّةَ يحتاج نسخةً يسلّمها بيده».
 *
 * وكانت الشاشةُ **تُهمله** — خلافا لـ«أرسِلْه للتوقيع» و«جدِّدِ الرابط»
 * وكلاهما يعرضه من المسار نفسِه. فإن تعثّر البريدُ عند الردّ مات رابطُ
 * المدرّب ولا نسخةَ عند أحد، ولا شيءَ يقول للموظّف إنّ الرابطَ تبدّل أصلا.
 *
 * ── والعطبُ الثاني: جوابٌ من اثنين ──
 *
 * الجوابُ الثاني («يُلغى ويُرسَل مصحَّحا») مبنيٌّ وزرُّه قائم، وتعليقُ الشيفرة
 * يشير إليه «أعلاه» — **والموظّفُ لا يقرأ التعليقات**. فمن قرأ الطلبَ في لوحه
 * رأى جوابا واحدا. وهي مصيدةُ «أعِدِ الموادَّ بملاحظات» نفسُها: قرارٌ مبنيٌّ
 * لا يُرى عند موضع القرار.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const bare = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const SCREEN = 'src/pages/admin/TrainerContracts.tsx'
const SVC = 'server/services/trainer-review.service.ts'

/** كتلةُ زرٍّ بعينها — من نداء المسار إلى آخر الرسالة التي تليه.

    ولا نافذةٌ بعددٍ من الأحرف: صفُّ الأفعال يحمل أزرارا متجاورةً تنادي مساراتٍ
    متشابهة، فنافذةٌ واسعةٌ تقرأ جارا وتخضرّ عليه. */
function callBlock(src: string, route: string): string {
  const at = src.indexOf(route)
  if (at < 0) return ''
  const open = src.lastIndexOf('onClick', at)
  const close = src.indexOf('}>', at)
  return open < 0 || close < 0 ? '' : src.slice(open, close)
}

describe('الرابطُ الجديدُ يُعرَض على الموظّف — ولا يُهدَر', () => {
  const src = bare(SCREEN)

  it('الكتلةُ المقروءةُ هي كتلةُ الردّ — وإلّا فالفحصُ على جارها', () => {
    const b = callBlock(src, '/amendment-reply')
    expect(b, 'لم تُقرأ كتلةُ الردّ').not.toBe('')
    expect(b, 'الكتلةُ المقروءةُ لا تُرسل الردّ').toContain('replyAr')
    /* ولا تبلغ كتلةَ الإلغاء ولا التجديد */
    expect(b, 'النافذةُ بلغت زرّا آخر').not.toContain('/revoke')
    expect(b, 'النافذةُ بلغت زرَّ التجديد').not.toContain('/resend')
  })

  it('وتقرأ `signingUrl` وتعرضه كما يفعل الإرسالُ والتجديد', () => {
    const b = callBlock(src, '/amendment-reply')
    expect(b, 'الرابطُ الجديدُ يُهدَر — والقديمُ مات في هذه اللحظة')
      .toContain('signingUrl')
    expect(b, 'الرابطُ يُقرأ ولا يُعرَض').toContain('setLink(')
  })

  /* ولا يكفي أن يُعرَض: من لم يُقَل له إنّ القديمَ بطل يظنّ الرابطَ الذي
     سلّمه أمسِ ما زال يعمل. */
  it('ويُقال إنّ القديمَ بطل — فلا يُسلَّم رابطٌ ميّت', () => {
    const b = callBlock(src, '/amendment-reply')
    expect(b).toContain('والقديمُ بطل')
  })

  /* والعلّةُ من الخادم نفسِه: الرابطُ يُعاد لأنّ البريدَ قد يتعثّر */
  it('والخادمُ يُعيد الرابطَ فعلا — فالشاشةُ تقرأ موجودا لا متوقَّعا', () => {
    const svc = bare(SVC)
    const at = svc.indexOf('async replyToAmendment(')
    expect(at, 'لا دالّةَ ردٍّ').toBeGreaterThan(0)
    const body = svc.slice(at, svc.indexOf('\n  async ', at + 1))
    expect(body, 'الردُّ لا يسكّ رمزا — فلا رابطَ يتبدّل').toContain('mintContractToken()')
    expect(body, 'الردُّ لا يُعيد رابطا').toContain('signingUrl: this.signingUrl(token)')
  })

  /* وأخواتُه تعرضه — فالفحصُ يقيس اتّساقا قائما لا رأيا */
  it('وأخواه يعرضانه كذلك — فالثلاثةُ على نهجٍ واحد', () => {
    for (const route of ['/send', '/resend']) {
      expect(callBlock(src, route), `${route}: لا يعرض الرابط`).toContain('setLink(')
    }
  })
})

describe('والجوابانِ يُقالان للموظّف في اللوح الذي يقرأ فيه الطلب', () => {
  const src = bare(SCREEN)

  it('اللوحُ يسمّي الجوابَ الثاني — لا تعليقٌ يشير «أعلاه»', () => {
    expect(src, 'لا يُذكَر الجوابُ الثاني في اللوح').toContain('تُلغيه وتركّب عرضا مصحَّحا')
  })

  it('ويقول لمَ لا يُعدَّل متنُ عرضٍ أُرسل', () => {
    /* المتنُ مجمَّدٌ مهشَّش، فالتصحيحُ عرضٌ جديدٌ لا كتابةٌ فوق القائم — وهذا
       ما يجعل «ألغِ ثمّ ركّبْ» جوابا لا حيلةً إداريّة. */
    expect(src).toContain('ولا يُعدَّل متنُ عرضٍ أُرسل')
  })

  /* ولا يُكرَّر فعلٌ لا رجعةَ فيه في موضعَين من شاشةٍ واحدة */
  it('ولا يُكرَّر زرُّ الإلغاء في اللوح — يُسمّى ويُدَلُّ عليه', () => {
    const revokeCalls = [...src.matchAll(/\/revoke`/g)].length
    expect(revokeCalls, 'زرُّ الإلغاء مكرَّرٌ — فعلٌ لا رجعةَ فيه لا يُنسَخ').toBe(1)
  })

  /* وزرُّ الإلغاء يبلغه الموقوفُ على طلب تعديل — وإلّا فالدلالةُ على باب مغلق */
  it('وزرُّ الإلغاء يظهر فعلا في هذه الحالة — فالدلالةُ ليست على باب مغلق', () => {
    expect(src).toMatch(/c\.status === "draft" \|\| c\.status === "sent" \|\| c\.status === "amendment_requested"/)
  })
})
