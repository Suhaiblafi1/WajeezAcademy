/* ما يصل المدرّبَ عن عقده — يُقاس نصّا كما يقرؤه هو.
 *
 * ── الأعطابُ الثلاثةُ التي يحرسها ──
 *
 * ① **الإلغاءُ لم يكن يرسل شيئا.** فمن ينتظر عقدا يفتح رابطَه فلا يعمل، ولا
 *   خبرَ عنده أنّه أُلغي ولا لماذا.
 * ② **وجوابُ طلبِ التعديل لم يكن يصل.** كان يُحفَظ في الصفّ ويخرج بدلَه بريدُ
 *   «رابطٌ جديدٌ للتوقيع» ونصُّه «وما فيها لم يتغيّر» — فيُطلَب ممّن اعترض أن
 *   يوقّع ثانيةً ولا يُقرأ له جواب. وهو بلاغُ صاحب المنصّة بحرفه (٢٦ سبتمبر).
 * ③ **وبريدُ النسخة الموقَّعة كان يَعِد بطباعةٍ قبل ختمنا** ويسمّي ما تحتها
 *   «سجلَّ التوقيعَين» وليس ثمّ إلّا توقيعٌ واحد.
 *
 * ── ولمَ يُقاس هنا لا بمسحٍ على الخدمة ──
 *
 * النصُّ الذي يصل إنسانا يُقرأ كما يقرؤه هو. وحارسٌ يمسح شيفرةَ الخدمة يخضرّ
 * على تعليقٍ فيها أو على سطرٍ جارٍ، وقد وقع ذلك في هذه المنصّة ثلاثَ مرّات.
 * فالرسائلُ دوالُّ خالصةٌ في `trainer-decision-mail.ts`، وهذا يستدعيها ويقرأ
 * ما ردّت.
 */

import { describe, expect, it } from 'vitest'
import {
  contractRevokedMail, amendmentAnsweredMail, signedCopyMail,
} from '../../../server/services/trainer-decision-mail'
import type { MailBlock } from '../../../server/services/mail-template'

/** كلُّ نصٍّ في الرسالة — العنوانُ والموضوعُ والكتلُ، بما فيها القوائمُ والحقائق */
function allText(doc: { subject: string; doc: { heading: string; preheader?: string; blocks: MailBlock[] } }): string {
  const parts: string[] = [doc.subject, doc.doc.heading, doc.doc.preheader ?? '']
  const rich = (v: unknown): string => (typeof v === 'string'
    ? v
    : Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : String((x as { text: string }).text))).join('') : '')
  for (const b of doc.doc.blocks) {
    if (b.kind === 'p' || b.kind === 'callout' || b.kind === 'note') parts.push(rich(b.text))
    else if (b.kind === 'h') parts.push(b.text)
    else if (b.kind === 'list') parts.push(b.items.map(rich).join(' '))
    else if (b.kind === 'facts') parts.push(b.rows.map((r) => `${r.label}: ${r.value}`).join(' '))
    else if (b.kind === 'cta') parts.push(`${b.label} ${b.href}`)
  }
  return parts.join('\n')
}

const REASON = 'أُلغي لأنّ أساسَ الأتعاب كُتب بالخطأ ٢٥ بدل ٣٠ دولارا للمقعد'

describe('① الإلغاءُ يصل صاحبَه بسببه', () => {
  const plain = contractRevokedMail({
    fullName: 'سُهيب', reference: 'WJ-TR-2026-00042',
    title: 'اتفاقية تقديم خدمات تدريبية', reasonAr: REASON, reissue: false,
  })

  it('يحمل السببَ بحرفه لا ملخَّصا له', () => {
    expect(allText(plain), 'أُلغي عقدُه ولم يُقَل له لماذا').toContain(REASON)
  })

  it('ويقول إنّ الرابطَ بطل — فلا يُجرَّب بابٌ ميّت', () => {
    expect(allText(plain)).toMatch(/الرابط|رابط/)
    expect(allText(plain), 'لم يُقَل إنّ الرابطَ لم يعد يعمل').toContain('بطل')
  })

  it('ولا يَعِد بعقدٍ بديلٍ حين لا بديلَ موعودا', () => {
    /* ═══ وهذا أدقُّ ما في هذا اللوح ═══

       رفضُ التوقيع كان يَعِد بعقدٍ جديدٍ ولا عقدَ يُنشأ — وهو العطبُ الأوّلُ
       في بلاغ صاحب المنصّة. فوعدٌ في رسالةٍ لا يقابله فعلٌ في الشيفرة عطبٌ
       بعينه، ويُحرَس أن يُعاد من بابٍ آخر. */
    expect(allText(plain), 'وُعِد بعقدٍ مصحَّحٍ في إلغاءٍ لا تصحيحَ بعده')
      .not.toContain('مصحَّح')
  })
})

describe('وقبولُ التعديل ليس إلغاءً بصياغةٍ أخرى', () => {
  const reissue = contractRevokedMail({
    fullName: 'سُهيب', reference: 'WJ-TR-2026-00042',
    title: 'عرض مشروط لتقديم خدمات تدريبية',
    reasonAr: 'قبلنا تعديلَ البند 4-1 ليصير أساسُ الأتعاب ٣٠ دولارا للمقعد',
    reissue: true,
  })

  it('يقول إنّ طلبَه قُبل وإنّ عقدا مصحَّحا يصله', () => {
    const t = allText(reissue)
    expect(t, 'قُبل طلبُه ولم يُقَل له').toMatch(/قَبِلنا|قبلنا/)
    expect(t, 'لم يُوعَد بالعقد المصحَّح').toContain('مصحَّح')
  })

  it('ولا يُقرأ عنوانُه «أُلغينا عقدك» — فذاك عكسُ ما وقع', () => {
    expect(reissue.doc.heading, 'من قُبل طلبُه قُرئ عليه أنّ بابَه أُغلق')
      .not.toContain('أُلغينا')
  })

  it('ولا يَعِد بأنّ كلَّ ما طلبه قُبل — المقبولُ وحدَه', () => {
    /* وعدٌ مطلقٌ يُقرأ نقضا حين يصله المتنُ الجديدُ وفيه بعضُ ما طلب */
    expect(allText(reissue)).toContain('التعديلاتِ التي قبلناها')
  })
})

describe('② جوابُ طلبِ التعديل يصل في الرسالة', () => {
  const REPLY = 'البندُ 7-2 يبقى كما هو: بدلُ التحضير مقصورٌ على ما ألغته الأكاديميّة'
  const mail = amendmentAnsweredMail({
    fullName: 'سُهيب', reference: 'WJ-TR-2026-00042',
    title: 'عرض مشروط لتقديم خدمات تدريبية',
    replyAr: REPLY, url: 'https://www.wajeezacademy.com/c/TOKEN', expiresOnAr: '٣ أكتوبر ٢٠٢٦',
  })

  it('يحمل جوابَ الموظّف بحرفه', () => {
    expect(allText(mail), 'كُتب الجوابُ ولم يصل صاحبَه').toContain(REPLY)
  })

  it('والجوابُ قبل زرّ التوقيع لا بعده', () => {
    /* ═══ والترتيبُ ليس ذوقا ═══

       رسالةٌ تفتتح بـ«وقّعْ» يقرؤها من طلب تعديلا مطالبةً بالتوقيع على ما
       اعترض عليه — ولو كان جوابُنا أسفلَها. وهو ما كان يقع حين كان يخرج
       بريدُ «رابطٌ جديدٌ للتوقيع» بدلَ الجواب. */
    const blocks = mail.doc.blocks
    const at = blocks.findIndex((b) => (b.kind === 'callout' || b.kind === 'p')
      && typeof b.text === 'string' && b.text.includes(REPLY))
    const cta = blocks.findIndex((b) => b.kind === 'cta')
    expect(at, 'لم يُوجَد الجوابُ في كتلةٍ تُقرأ').toBeGreaterThanOrEqual(0)
    expect(cta, 'لا رابطَ في الرسالة').toBeGreaterThanOrEqual(0)
    expect(at, 'سبق زرُّ التوقيع الجوابَ').toBeLessThan(cta)
  })

  it('ويقول إنّ المتنَ لم يتغيّر وإنّ الرابطَ القديم بطل', () => {
    const t = allText(mail)
    expect(t, 'لم يُقَل إنّ الوثيقةَ كما هي').toMatch(/لم يتغيّر/)
    expect(t, 'لم يُقَل إنّ الرابطَ القديم بطل').toContain('القديمُ بطل')
  })
})

describe('③ بريدُ التوقيع لا يَعِد بطباعةٍ قبل ختمنا', () => {
  const base = {
    legalName: 'سُهيب عبد الله الخوالدة',
    title: 'عرض مشروط لتقديم خدمات تدريبية',
    signedOnAr: '٢٦ سبتمبر ٢٠٢٦',
    bodyHash: 'a'.repeat(64),
    portalUrl: 'https://www.wajeezacademy.com/trainer',
  }
  const conditional = signedCopyMail({ ...base, conditional: true, hasPortal: true })

  it('لا يدعوه إلى الطباعة ولا يسمّي توقيعا واحدا «سجلَّ التوقيعَين»', () => {
    const t = allText(conditional)
    expect(t, 'دُعي إلى طباعة عقدٍ لم يُختَم بعد').not.toContain('اطبع')
    expect(t, 'وُعِد بزرّ طباعةٍ قبل الختم').not.toContain('زرُّ طباعة')
    expect(t, 'سُمّي توقيعٌ واحدٌ سجلَّ توقيعَين').not.toContain('سجلُّ التوقيعَين')
  })

  it('ويقول صريحا إنّ العقدَ لا ينفذ بتوقيعه وحدَه', () => {
    expect(allText(conditional), 'تُرك نفاذُ العقد يُفهَم ولم يُقَل')
      .toContain('لا يصير العقدُ نافذا بين الطرفين حتّى نعتمده')
  })

  it('ويحفظ ما يُثبت توقيعَه: اسمُه وتاريخُه وبصمةُ متنه', () => {
    const t = allText(conditional)
    expect(t).toContain(base.legalName)
    expect(t).toContain(base.signedOnAr)
    expect(t, 'ضاعت بصمةُ النصّ الموقَّع عليه').toContain(base.bodyHash)
  })

  it('والعرضُ المشروطُ تُقال خطوتُه التالية — وهي عندَه لا عندنا', () => {
    /* وبابُ الموادّ يُفتح بالتوقيع نفسِه منذ ٢٦ سبتمبر. فمن لم يُقَل له ذلك
       انتظر جوابا لا يأتي حتّى يرفع. */
    const t = allText(conditional)
    expect(t, 'وقّع عرضا مشروطا ولم يُقَل له أن يرفع موادَّه').toContain('ارفعْ موادَّ')
    expect(conditional.doc.blocks.some((b) => b.kind === 'cta'), 'لا بابَ إلى بوّابته').toBe(true)
  })

  it('ولا يُعطى زرَّ بوّابةٍ من لا حسابَ له — فيردُّه إلى شاشة دخول', () => {
    const noPortal = signedCopyMail({ ...base, conditional: true, hasPortal: false })
    expect(noPortal.doc.blocks.some((b) => b.kind === 'cta'), 'وُعِد ببوّابةٍ لا حسابَ له فيها').toBe(false)
  })

  it('ولا تُقال خطوةُ الموادّ لبندٍ يُوثَّق على نشطٍ — لا شرطَ فيه ولا موادّ', () => {
    const documented = signedCopyMail({ ...base, conditional: false, hasPortal: true })
    expect(allText(documented), 'طُلبت موادُّ من عقدٍ لا شرطَ فيه').not.toContain('ارفعْ موادَّ')
  })
})
