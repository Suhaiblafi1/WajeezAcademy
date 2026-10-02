/* ═══ لمن طلب تعديلا: سطرٌ وملخّصٌ عن تحديث القالب — لا النقاطُ كلُّها (١ أكتوبر ٢٠٢٦) ═══
 *
 * قولُ صاحب المنصّة: من أرسل ملاحظاتٍ نتعلّم من أسئلته فنوضّح العقدَ ونعدّله لمن
 * يأتي بعده، فيُقال له ذلك «في سطرٍ واحد… لا نريد أن نقول كلَّ شيءٍ عدّلناه…
 * وإعطاؤه ملخّصا عنها بطريقةٍ مختصرة». ومن وقّع ثمّ أُعيد إليه عقدُه يقرأ النقاطَ
 * كاملةً تحت أبوابها كما كان. وشروطُه هو (أجرُه ودوراتُه وبنودُه) بطاقةٌ في البابين.
 *
 * ويُقاس على الدالّة التي تقرؤها الرسالةُ والمعاينةُ معا (`reissueChangesView`)، ثمّ
 * على الرسالة كما تُبنى — لا على ورود جملةٍ في ملفّ.
 */

import { describe, expect, it } from 'vitest'
import {
  PERSONAL_CHANGES_TITLE_AR, amendmentTemplateNoteAr, reissueChangesView,
} from '@/application/trainer/contract-resign'
import { changeGroupsBetween } from '@/application/trainer/contract-changelog'
import { CONTRACT_BODY_VERSION } from '@/application/trainer/contract-body'
import { contractResignMail } from '../../../server/services/trainer-decision-mail'
import { renderMail } from '../../../server/services/mail-template'

/* من قرأ إصدارا قديما — فللقالب أبوابٌ ونقاطٌ كثيرة */
const template = changeGroupsBetween('v17-2026-09-30', CONTRACT_BODY_VERSION)
const points = template.flatMap((g) => g.itemsAr)
const FEE_LINE = 'رفعنا أجرَ المقعد الذي يأتيك عبر رابط دعوتك: من $25 إلى $28.'

describe('قبولُ طلب التعديل', () => {
  const view = reissueChangesView('amendment', [FEE_LINE], template)

  it('الشاهد: للقالب أبوابٌ ونقاطٌ تُقال — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(template.length).toBeGreaterThan(1)
    expect(points.length).toBeGreaterThan(template.length)
  })

  it('⚠️ شروطُه هو بطاقةٌ وحدَها — وأبوابُ القالب لا بطاقاتٍ لها', () => {
    expect(view.cards).toEqual([{ titleAr: PERSONAL_CHANGES_TITLE_AR, itemsAr: [FEE_LINE] }])
  })

  it('⚠️ والقالبُ سطرٌ يقول إنّا عدّلنا، ثمّ أبوابُه بأسمائها — لا نقاطُه', () => {
    expect(view.templateNoteAr, 'لا يُقال إنّا عدّلنا العقد').toContain('أجرينا على العقد توضيحاتٍ وتعديلاتٍ')
    for (const g of template) {
      expect(view.templateNoteAr, `لم يُسمَّ بابُ «${g.titleAr}»`).toContain(g.titleAr.split(' — ')[0])
    }
    for (const pt of points) expect(view.templateNoteAr, `قيلت النقطةُ كاملة: ${pt}`).not.toContain(pt)
  })

  it('⚠️ والرسالةُ كما تُبنى: السطرُ فيها وأجرُه، والنقاطُ لا', () => {
    const { text } = renderMail(contractResignMail({
      greetingName: 'منار', subjectAr: 'قبلنا ملاحظاتِك', bodyAr: 'شكرا لك على ملاحظاتك.',
      changeGroups: view.cards, templateNoteAr: view.templateNoteAr,
      signingUrl: 'https://x.test/c/T', expiresOnAr: '١٥ أكتوبر ٢٠٢٦', mode: 'amendment',
    }).doc)
    expect(text, 'سكتت الرسالةُ عن تحديث العقد').toContain(view.templateNoteAr!)
    expect(text, 'سكتت عن أجره').toContain(FEE_LINE)
    for (const pt of points) expect(text, `قيلت النقطةُ كاملةً لطالب التعديل: ${pt}`).not.toContain(pt)
    expect(text, 'قيل «لم يتغيّر» وقد تغيّر').not.toContain('لم يتغيّر شيءٌ')
    expect(text, 'لم يُقل إنّ الاتفاقيّةَ محدَّثة').toContain('افتح الاتفاقيّة المحدَّثة')
  })

  it('ولا جديدَ في القالب: لا سطر', () => {
    expect(amendmentTemplateNoteAr([])).toBeNull()
    expect(reissueChangesView('amendment', [], []).templateNoteAr).toBeNull()
  })
})

describe('ومن وقّع ثمّ أُعيد إليه عقدُه — النقاطُ كاملةً تحت أبوابها كما كانت', () => {
  it('شروطُه أوّلا ثمّ أبوابُ القالب بنقاطها — ولا سطرَ ملخّص', () => {
    const view = reissueChangesView('resign', [FEE_LINE], template)
    expect(view.templateNoteAr).toBeNull()
    expect(view.cards[0]).toEqual({ titleAr: PERSONAL_CHANGES_TITLE_AR, itemsAr: [FEE_LINE] })
    expect(view.cards.slice(1)).toEqual(template)
  })
})
