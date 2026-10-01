/* من وقّع الإصدارَ الحاضرَ يُقال له إنّ عقده لم يتغيّر — ولا يُوعَد بقائمة.

   بلاغُ صاحب المنصّة (١ أكتوبر ٢٠٢٦) على رسالة «أعِدْه للتوقيع»: النصُّ يقول
   «وما تغيّر فيها مبيَّنٌ أدناه» «ولا يوجد أيُّ شيءٍ أدناه». وقولُه: «لمن وقّع
   الأحدث: لم يتغيّر شيءٌ في عقدك الأخير».

   ويُقاس على الرسالة كما تُبنى (`contractResignMail`) لا على سطرٍ في ملفّ. */

import { describe, expect, it } from 'vitest'
import { contractResignMail } from '../../../server/services/trainer-decision-mail'
import type { MailBlock } from '../../../server/services/mail-template'
import {
  AMENDMENT_NO_CHANGES_AR, RESIGN_NO_CHANGES_AR, defaultResignBodyAr, resignChangeGroups,
} from '@/application/trainer/contract-resign'
import { changeGroupsBetween } from '@/application/trainer/contract-changelog'
import { CONTRACT_BODY_VERSION } from '@/application/trainer/contract-body'

const text = (blocks: MailBlock[]): string => blocks.map((b) => JSON.stringify(b)).join('\n')
const mailFor = (from: string) => {
  const groups = resignChangeGroups([], changeGroupsBetween(from, CONTRACT_BODY_VERSION))
  return contractResignMail({
    greetingName: 'منار', subjectAr: 'عقدُك عاد إليك',
    bodyAr: defaultResignBodyAr('اتفاقية', groups.length > 0), changeGroups: groups,
    templateNoteAr: null, signingUrl: 'https://example.com/c/T', expiresOnAr: '١٥ أكتوبر ٢٠٢٦', mode: 'resign',
  })
}

describe('من وقّع الإصدارَ الحاضر', () => {
  const mail = mailFor(CONTRACT_BODY_VERSION)
  const all = text(mail.doc.blocks)

  it('⚠️ يُقال له إنّ عقده لم يتغيّر', () => {
    expect(all, 'لم يُقَل له إنّ عقده لم يتغيّر').toContain(RESIGN_NO_CHANGES_AR)
  })

  it('⚠️ ولا يُوعَد بقائمةٍ لا تأتي', () => {
    expect(all, 'وُعد بما «أدناه» ولا شيءَ أدناه').not.toContain('مبيَّنٌ أدناه')
    expect(mail.doc.blocks.some((b) => b.kind === 'changes'), 'رُسمت بطاقاتُ تغييرٍ فارغة').toBe(false)
  })

  it('وزرُّ التوقيع في الرسالة نفسِها', () => {
    expect(mail.doc.blocks.find((b) => b.kind === 'cta')).toMatchObject({ href: 'https://example.com/c/T' })
  })
})

describe('ومن وقّع إصدارا أقدم — الشاهدُ المضادّ', () => {
  const mail = mailFor([...changeGroupsBetween(null, CONTRACT_BODY_VERSION)].length ? 'v17-2026-09-30' : '')
  const all = text(mail.doc.blocks)

  it('يقرأ البطاقاتِ والوعدَ بها، ولا يُقال له «لم يتغيّر شيء»', () => {
    expect(mail.doc.blocks.some((b) => b.kind === 'changes'), 'غابت البطاقات').toBe(true)
    expect(all).toContain('مبيَّنٌ أدناه')
    expect(all, 'قيل لمن تغيّر عقدُه إنّه لم يتغيّر').not.toContain(RESIGN_NO_CHANGES_AR)
  })
})

/* ═══ ومن طلب تعديلا لم يوقّع شيئا (١ أكتوبر ٢٠٢٦) ═══

   قبولُ طلب التعديل يمرّ من رسالة الإعادة نفسِها (#400)، فورث جملتَها حين لا
   تغيير: «منذ آخر توقيعٍ لك». رآها صاحبُ المنصّة في معاينة النافذة. وما تغيّر
   يُقاس في هذا البابِ ممّا قرأه قبل طلبه — فجملتُه تقول ذلك. */
describe('ومن قُبل طلبُ تعديله ولم يتغيّر شيء', () => {
  const mail = contractResignMail({
    greetingName: 'منار', subjectAr: 'قبلنا ملاحظاتِك', bodyAr: 'شكرا لك على ملاحظاتك.\n\nوهذا جوابُنا.',
    changeGroups: [], templateNoteAr: null, signingUrl: 'https://example.com/c/T', expiresOnAr: '١٥ أكتوبر ٢٠٢٦', mode: 'amendment',
  })
  const callouts = mail.doc.blocks.flatMap((b) => (b.kind === 'callout' && typeof b.text === 'string' ? [b.text] : []))

  it('⚠️ يُقال له إنّ البنودَ هي التي قرأها قبل طلبه — لا «منذ آخر توقيعٍ لك»', () => {
    expect(callouts[0], 'أوّلُ تنبيهٍ في الرسالة ليس جملةَ «لا تغيير» لبابه').toBe(AMENDMENT_NO_CHANGES_AR)
    expect(text(mail.doc.blocks), 'قيل لمن لم يوقّع إنّه وقّع').not.toMatch(/توقيعٍ لك|آخر توقيع/)
  })
})
