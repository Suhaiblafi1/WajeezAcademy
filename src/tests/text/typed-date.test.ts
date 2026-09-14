/* التاريخُ يُكتب أرقاما — ما يُقبل وما يُردّ (أ-٢).

   القوائمُ الثلاثُ حلّت القفزَ إلى ١٩٨٥، وبقيت الشكوى الثانية بنصّها:
   «كتابةُ التاريخ أرقاما ما زالت صعبة… أريد نمطا عالميّا معتادا».

   والقسمةُ هنا وحدَها، بلا شاشة: ما يُقبل شكلا، وما يُردّ معنى، وما يُترك
   ساكتا لأنّ صاحبَه ما زال يكتب. */

import { describe, expect, it } from 'vitest'
import { formatTypedDate, parseTypedDate, westernDigits } from '../../application/text/date-parts'

describe('ما كتبه إنسانٌ في حقل تاريخ', () => {
  it('يومٌ فشهرٌ فسنة — كما يُكتب في المنطقة', () => {
    expect(parseTypedDate('13/09/2026').iso).toBe('2026-09-13')
    expect(parseTypedDate('9/7/1985').iso).toBe('1985-07-09')
  })

  it('والفاصلُ أيُّها كان — فمن نسخ تاريخا لا يُعاقَب على فاصلٍ لم يخترْه', () => {
    for (const text of ['13-09-2026', '13.09.2026', '13 09 2026', '13 / 09 / 2026']) {
      expect(parseTypedDate(text).iso, text).toBe('2026-09-13')
    }
  })

  it('والأرقامُ العربيّةُ الهنديّة تُقرأ كالغربيّة', () => {
    expect(parseTypedDate('١٣/٠٩/٢٠٢٦').iso).toBe('2026-09-13')
    expect(parseTypedDate('۱۳/۰۹/۲۰۲۶').iso).toBe('2026-09-13')
    expect(westernDigits('٢٠٢٦')).toBe('2026')
  })

  /* ═══ والناقصُ ليس خطأً ═══
     رسالةُ خطأٍ عند كلّ محرفٍ تُقاطع من يكتب وهو في منتصف الرقم. */
  it('وما زال يُكتب: لا تاريخَ ولا رسالةَ خطأ', () => {
    for (const half of ['', '1', '13', '13/', '13/0', '13/09', '13/09/', '13/09/20', '13/09/202']) {
      const out = parseTypedDate(half)
      expect(out.iso, half).toBe('')
      expect(out.errorAr, `قوطع وهو يكتب: ${half}`).toBeNull()
    }
  })

  it('ولا تُمدّ سنةٌ من رقمَين — «٢٦» أهي ١٩٢٦ أم ٢٠٢٦؟', () => {
    expect(parseTypedDate('13/09/26').iso).toBe('')
    expect(parseTypedDate('13/09/26').errorAr).toBeNull()
  })

  /* ═══ والخطأُ ما اكتمل شكلا وبطَل معنى ═══ */
  it('يومٌ لا وجودَ له في شهره يُردّ بسببٍ يقول كم فيه', () => {
    const out = parseTypedDate('31/02/2026')
    expect(out.iso).toBe('')
    expect(out.errorAr).toContain('٢٨'.replace('٢٨', '28'))
  })

  it('وفبراير في سنةٍ كبيسةٍ تسعةٌ وعشرون — لا ثمانيةٌ وعشرون دائما', () => {
    expect(parseTypedDate('29/02/2024').iso).toBe('2024-02-29')
    expect(parseTypedDate('29/02/2026').iso).toBe('')
  })

  it('وشهرٌ خارج الاثني عشر يُردّ', () => {
    expect(parseTypedDate('13/13/2026').errorAr).toBe('الشهرُ بين ١ و١٢')
    expect(parseTypedDate('13/00/2026').errorAr).toBe('الشهرُ بين ١ و١٢')
  })

  it('ويومُ صفرٍ يُردّ', () => {
    expect(parseTypedDate('00/09/2026').errorAr).toBe('اليومُ يبدأ من ١')
  })

  /* ═══ والعرضُ عكسُ القراءة ═══ */
  it('والمحفوظُ يُعرض كما يُكتب — بصفرٍ بادئ', () => {
    expect(formatTypedDate('1985-07-09')).toBe('09/07/1985')
    expect(formatTypedDate('2026-12-31')).toBe('31/12/2026')
  })

  it('والفارغُ يبقى فارغا — لا «اليوم» ولا شرطة', () => {
    expect(formatTypedDate('')).toBe('')
    expect(formatTypedDate(null)).toBe('')
    expect(formatTypedDate('ليس تاريخا')).toBe('')
  })

  /* ودورةٌ كاملة: ما عُرض يُقرأ فيعود كما كان */
  it('وما عُرض ثمّ قُرئ يعود كما كان', () => {
    for (const iso of ['1985-07-09', '2026-01-01', '2024-02-29', '2026-12-31']) {
      expect(parseTypedDate(formatTypedDate(iso)).iso, iso).toBe(iso)
    }
  })
})
