/* «ما تعنيه الكلمات» — المصطلحُ يُبرَز، والتعريفُ يبقى جملةً تامّة.
 *
 * ── الطلبُ الذي وُلد منه ──
 *
 * صاحبُ المنصّة (٢٦ سبتمبر ٢٠٢٦): «ما تعنيه الكلمات مرتّبه كما في الملخّص
 * أعلاه لتوضيح الكلمة الرئيسيّة بدلا من أنّها ضمن النصّ».
 *
 * وكان المصطلحُ يُقرأ **داخل** الجملة: «· الشعبة: مجموعة من المتعلمين…» سطرا
 * واحدا لا يُميَّز فيه المعرَّفُ من تعريفه. ومن يبحث عن معنى «الإسناد» يمسح
 * ثماني فقراتٍ متشابهةٍ بعينه.
 *
 * ── وأدقُّ ما يُقاس: أنّ التعريفَ لم يُقطَع ──
 *
 * `summaryItem` قريبةٌ منه وتقطع القيمةَ عند « — » وتنتزع «(البند ن)» من
 * آخرها. وذلك صوابٌ في الخلاصة وخطأٌ هنا: تعريفُ المعجم جملةٌ تامّةٌ قد تحمل
 * شرطةً في وسطها وإحالةً في وسطها — فقطعُها يمزّق الجملةَ ويُقدّم آخرَها على
 * أوّلها. فيُقاس على تعريفٍ حقيقيٍّ يحمل الاثنَين.
 *
 * ── ولا يتغيّر حرفٌ من المتن ──
 *
 * الشكلُ قراءةٌ ثانيةٌ للسطر، لا تحريرٌ له. وحارسُ التمام
 * (`contract-document.test.ts`) يقابل المُصيَّرَ بالمتن حرفا بحرف، وهذا
 * يقيس أنّ الفواصلَ بقيت في النصّ كما تبقى في الخلاصة.
 */

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  parseContractDoc, glossaryItem, GLOSSARY_HEAD, blockLineAr,
} from '@/application/trainer/contract-sections'
import { renderContractBodyAr } from '@/application/trainer/contract-body'
import ContractDocument from '@/components/ContractDocument'
import { ACADEMY_LEGAL, academyPartyLineAr } from '@/data/academy-legal'

/** المتنُ الحيُّ بحروفه — لا نصٌّ مختلَقٌ يجامل المحلّل */
const BODY = renderContractBodyAr({
  academyPartyLineAr: academyPartyLineAr(),
  academyLegalNameAr: ACADEMY_LEGAL.legalNameAr ?? '',
  academyTradingNameAr: ACADEMY_LEGAL.tradingNameAr ?? 'أكاديمية وجيز',
  governingLawAr: ACADEMY_LEGAL.governingLawAr ?? '',
  disputeVenueAr: ACADEMY_LEGAL.disputeVenueAr ?? '',
  trainerFullName: 'سُهيب عبد الله الخوالدة',
  trainerEmail: 'trainer@test.local',
  applicationReference: 'WJ-TR-2026-00042',
  issuedOnAr: '٢٦ سبتمبر ٢٠٢٦',
  courses: [{ courseId: 'C1', titleAr: 'أساسيّاتُ المحاسبة' }],
  compensation: { type: 'per_seat', rate: '25', currency: 'USD', minSeats: 0, referralRate: '30' },
  rateWaivedReasonAr: null,
  hoursNoteAr: null,
  requiredDocuments: [],
  conditional: null,
})

const doc = parseContractDoc(BODY)
const glossary = doc.sections.find((s) => s.titleAr === GLOSSARY_HEAD)
const html = renderToStaticMarkup(createElement(ContractDocument, { doc }))

describe('المعجمُ يُقرأ مصطلحا وتعريفا', () => {
  it('والقسمُ موجودٌ في المتن الحيّ — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(glossary, 'لم يُعثر على قسم المعجم في المتن').toBeTruthy()
    expect(glossary!.blocks.length, 'المعجمُ فارغٌ من البنود').toBeGreaterThan(5)
  })

  it('كلُّ بندٍ منقَّطٍ فيه يُقرأ مصطلحا وتعريفا', () => {
    const bullets = glossary!.blocks.filter((b) => b.kind === 'bullet')
    expect(bullets.length, 'لا بندَ منقَّطٌ في المعجم').toBeGreaterThan(5)
    for (const b of bullets) {
      const it = glossaryItem(b)
      expect(it, `لم يُقرأ بندٌ من المعجم: ${blockLineAr(b)}`).not.toBeNull()
      expect(it!.termAr.length, 'مصطلحٌ فارغ').toBeGreaterThan(1)
      expect(it!.defAr.length, 'تعريفٌ فارغ').toBeGreaterThan(10)
    }
  })

  it('والتعريفُ يبقى جملةً تامّةً — لا يُقطَع عند شرطةٍ ولا عند إحالة', () => {
    /* ═══ وهذا مِحَكُّ الفرق عن `summaryItem` ═══

       «الخصم الذي يصدره المدرب» تعريفُه يحمل «(البند 4-10)» في وسطه ثمّ
       يكمل: «وهو غير خصوم الأكاديمية…». فقارئةٌ تنتزع الإحالةَ من الآخر
       تقطع الجملةَ في وسطها وتُسقط ما بعدها. */
    const b = glossary!.blocks.find((x) => x.kind === 'bullet' && x.textAr.startsWith('الخصم الذي يصدره المدرب'))
    expect(b, 'لم يُعثر على بند الخصم — وهو مِحَكُّ هذا الفحص').toBeTruthy()
    const it = glossaryItem(b!)!
    expect(it.termAr).toBe('الخصم الذي يصدره المدرب')
    expect(it.defAr, 'قُطع التعريفُ عند الإحالة').toContain('(البند 4-10)')
    expect(it.defAr, 'سقط ما بعد الإحالة من التعريف').toContain('وهو غير خصوم الأكاديمية')
    /* والتعريفُ كلُّه هو السطرُ بعد النقطتَين — لا شيءَ نقص */
    expect(`${it.termAr}: ${it.defAr}`).toBe((b as { textAr: string }).textAr)
  })

  it('ويُقطَع عند أوّل نقطتَين لا آخرِها — فتعريفٌ فيه نقطتان لا يبتلع مصطلحَه', () => {
    /* ═══ ولمَ يُقاس على بندٍ مصنوع ═══

       لا تعريفَ في معجم اليومِ يحمل نقطتَين في وسطه، فالقاعدةُ صحيحةٌ ولا
       شيءَ يُثبتها: `lastIndexOf` تمرّ خضراءَ على المتن الحاليّ كلِّه (وقد
       مرّت فعلا حين نُقضت هذه القارئةُ). وأوّلُ تعريفٍ يُكتب فيه «مثال: …»
       يجعل المصطلحَ جملةً كاملةً والتعريفَ كلمةً — في وثيقةٍ تُوقَّع.

       فالقاعدةُ تُثبَت بمُدخلها لا بانتظار أن يقع. */
    const it = glossaryItem({
      kind: 'bullet',
      textAr: 'الإسناد: عرض شعبة بعينها على المدرب. مثال: شعبةُ المحاسبة في يناير.',
    })
    expect(it, 'لم يُقرأ بندٌ فيه نقطتان').not.toBeNull()
    expect(it!.termAr, 'ابتلع المصطلحُ تعريفَه — قُطع عند آخر نقطتَين').toBe('الإسناد')
    expect(it!.defAr).toBe('عرض شعبة بعينها على المدرب. مثال: شعبةُ المحاسبة في يناير.')
  })

  it('ولا يُقرأ مصطلحا ما لا نقطتَين فيه — فيرتدّ فقرةً كما هو', () => {
    expect(glossaryItem({ kind: 'bullet', textAr: 'جملةٌ بلا تعريف' })).toBeNull()
    expect(glossaryItem({ kind: 'bullet', textAr: ': تعريفٌ بلا مصطلح' })).toBeNull()
    expect(glossaryItem({ kind: 'text', textAr: 'الشعبة: ليست منقَّطة' })).toBeNull()
  })
})

describe('وشكلُه نَسَقُ الخلاصة', () => {
  it('المصطلحُ في خانته والتعريفُ في خانته', () => {
    expect(html, 'لا صفوفَ للمعجم — بقي فقراتٍ متّصلة').toContain('cd-glist')
    expect(html, 'لا خانةَ للمصطلح').toContain('cd-term')
    expect(html, 'لا خانةَ للتعريف').toContain('cd-def')
  })

  it('وكلُّ مصطلحٍ يُصيَّر في خانته هو', () => {
    for (const b of glossary!.blocks) {
      const it = glossaryItem(b)
      if (!it) continue
      expect(html, `لم يُصيَّر «${it.termAr}» مصطلحا`)
        .toContain(`class="cd-term"`)
      /* والمصطلحُ نصّا في المُصيَّر — فلا يُقاس على اسم الخانة وحدَه */
      expect(html, `ضاع نصُّ المصطلح «${it.termAr}»`).toContain(it.termAr)
    }
  })

  it('والفواصلُ تبقى في النصّ — فالمنسوخُ هو الموقَّعُ عليه', () => {
    /* النقطةُ والنقطتان تُرسمان بالنَّسق وتبقيان مقروءتَين (`sr-only`)،
       كما في الخلاصة. وحارسُ التمام يقابل المُصيَّرَ بالمتن حرفا بحرف. */
    expect(html, 'حُذفت النقطتان من نصّ المعجم').toContain('>: </span>')
    expect(html, 'حُذفت النقطةُ من نصّ المعجم').toContain('>· </span>')
  })
})
