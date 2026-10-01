/* ═══ زرُّ رسالةِ التحديث يقصد بابَ الاستعادة لا العرضَ نفسَه ═══
 *
 * سأل صاحبُ المنصّة عن رسالة التحديث: «link for what؟». والجوابُ أنّ
 * الرسالةَ كانت تقول «حُدّث نصُّ عرضك، اقرأه قبل أن توقّعه» ثمّ لا تعطيه
 * ما يفتحه به — فيبحث في بريده عن رسالةٍ قديمةٍ يجد فيها رابطَه.
 *
 * ولا سبيلَ إلى وضع رابطه فيها: `tokenHash` وحدَه في الجدول لا الرمزُ، فلا
 * يُعاد بناؤه. ولو سُكّ رمزٌ جديدٌ ليُوضَع فيها لَمات الذي بيده — وهو بعينه
 * ما شكاه أوّلا («ضغط على فتح العقد فلم يُفتح») وأُصلح في #351 و#353.
 *
 * فصار الزرُّ بابا يطلب فيه رابطَه بنفسه. وهذه الجولةُ تقرأ ما ردّته
 * الدالّةُ كما يقرؤه صاحبُ الرسالة — لا مسحا على الشيفرة، فالمسحُ يخضرّ
 * على تعليقٍ فيها، وقد وقع ذلك في هذه المنصّة ثلاثَ مرّات.
 */

import { describe, expect, it } from 'vitest'
import { contractUpdatedMail } from '../../../server/services/trainer-decision-mail'

const MAIL = (over: Partial<Parameters<typeof contractUpdatedMail>[0]> = {}) =>
  contractUpdatedMail({
    fullName: 'سارة عبد الله',
    reference: 'WJ-TR-2026-00007',
    title: 'اتفاقيّةُ تدريب',
    changeGroups: [{ titleAr: 'الكشف والصرف — البند 4', itemsAr: ['صار لك حقُّ الاعتراض على كشف مستحقّاتك.'] }],
    awaitingReply: false,
    contractUrl: 'https://wajeezacademy.com/contract-link',
    ...over,
  })

/** كلُّ نصوص الرسالة في سلسلةٍ واحدةٍ — كما تُقرأ لا كما تُبنى */
function flat(mail: ReturnType<typeof contractUpdatedMail>): string {
  const parts: string[] = [mail.subject, mail.doc.heading ?? '', mail.doc.preheader ?? '']
  for (const b of mail.doc.blocks as readonly Record<string, unknown>[]) {
    if (typeof b.text === 'string') parts.push(b.text)
    if (typeof b.label === 'string') parts.push(b.label)
    if (typeof b.href === 'string') parts.push(b.href)
    if (Array.isArray(b.items)) parts.push(...(b.items as string[]))
    if (Array.isArray(b.groups)) {
      for (const g of b.groups as { titleAr: string; itemsAr: string[] }[]) parts.push(g.titleAr, ...g.itemsAr)
    }
  }
  return parts.join('\n')
}
const ctaOf = (mail: ReturnType<typeof contractUpdatedMail>) =>
  (mail.doc.blocks as readonly Record<string, unknown>[]).find((b) => b.kind === 'cta')

describe('الرسالةُ تعطي صاحبَها ما يفتح به عرضَه', () => {
  it('⚠️ فيها زرٌّ — وكانت تقول «اقرأه» ولا تعطيه ما يقرأ به', () => {
    expect(ctaOf(MAIL()), 'رسالةٌ تأمر بالقراءة بلا زرٍّ يقصد شيئا').toBeTruthy()
  })

  /* ═══ ووجهةُ الزرِّ لا تُقاس هنا — ولمَ ═══

     الدالّةُ تأخذ `contractUrl` كما يُسلَّم إليها وتضعه. فلو قيس هنا لَقيس
     ما كتبته السقالةُ نفسُها في `MAIL()`: تقريرٌ يخضرّ وإن سلّمها المسلكُ
     رمزَ توقيعٍ في الإنتاج. وقد جُرّب: بُدّلت وجهةُ المسلك إلى `/c/<رمز>`
     فلم يسقط شيءٌ — فحُذف التقريرُ ولم يُبقَ زينة.

     وما كان يُراد به محروسٌ في موضعه وأقوى: `contract-body-refresh` يُثبت
     أنّ التحديثَ **لا يسكّ رمزا** (وكسرُ ذلك يُسقط الجولةَ كلَّها)، والرمزُ
     القديمُ لا يُحفَظ نصّا فلا يُستخرَج. فلا رمزَ في الدنيا يُوضَع في هذه
     الرسالة أصلا — والخطرُ ممتنعٌ بالبنية لا بتقريرٍ يُكتب. */

  it('وعنوانُ الزرِّ يقول إنّه استعادةٌ — فلا يُظَنّ العرضَ فيُفاجأ بسؤال البريد', () => {
    const label = String(ctaOf(MAIL())!.label)
    expect(label, 'العنوانُ يَعِد بالعرض والزرُّ يسأل البريد').not.toContain('اقرأ عرضَك')
    expect(label, 'لا يُفهَم من العنوان أنّه لمن فقد رابطَه').toMatch(/رابط/)
  })

  it('والمتنُ يدلّ على الرسالة السابقة أوّلا — فمن معه رابطُه لا يطلب غيرَه', () => {
    const body = flat(MAIL())
    expect(body, 'لا يُقال له افتحْه من رسالتنا السابقة').toContain('من رسالتنا السابقة')
    expect(body, 'لا يُقال متى يُستعمَل الزرّ').toContain('وإن لم تجد الرسالة')
  })

  it('ويبقى ما كان: رابطُه هو هو، ولا يُستعجَل توقيعُه', () => {
    const body = flat(MAIL())
    expect(body, 'ذهب أنّ الرابطَ لم يتغيّر — فيُظَنّ الزرُّ رابطا جديدا لازما')
      .toContain('في رابطك نفسِه')
    expect(body, 'استُعجل توقيعُه بحجّة التحديث')
      .toContain('ولا يلزمك أن توقّع لأجل هذا التحديث')
  })

  it('ونقاطُ التغيير تُسرَد كما سُلّمت', () => {
    const body = flat(MAIL({ changeGroups: [{ titleAr: 'بابٌ', itemsAr: ['نقطةٌ أولى.', 'نقطةٌ ثانية.'] }] }))
    expect(body).toContain('نقطةٌ أولى.')
    expect(body).toContain('نقطةٌ ثانية.')
  })

  /* والشاهدُ المضادّ: بلا رابطٍ لا يُخترَع زرٌّ يقصد لا شيء */
  it('⚠️ وبلا رابطٍ لا زرَّ — فلا يُبنى زرٌّ إلى فراغ', () => {
    expect(ctaOf(MAIL({ contractUrl: null })), 'بُني زرٌّ بلا وجهة').toBeUndefined()
  })

  it('ومن طلب تعديلا يُقال له إنّ طلبَه ما زال يُنظَر فيه', () => {
    const body = flat(MAIL({ awaitingReply: true }))
    expect(body, 'يُظَنّ التحديثُ جوابا على طلب تعديله').toContain('وهذا التحديثُ غيرُ جوابنا عليه')
  })
})
