/* عنوانُ الدعم في تذييل كلّ رسالة (١٢ أكتوبر ٢٠٢٦).

   سأل صاحبُ المنصّة: «الإيميلاتُ المرسَلةُ للمدرّبين — أين يصل الردُّ إن ردّ المدرّب؟ ألا يوجد في التذييل
   طريقةُ الوصول إلينا كدعم؟». الردُّ يصل العنوانَ الواحد (`Reply-To`)، لكنّ التذييلَ لم يكن يُظهره. واختار
   «البريد وحدَه»: «للدعم: Academy@wajeez.co» يُضغَط، في الصيغتين. */

import { describe, expect, it } from 'vitest'
import { renderMail } from '../../../server/services/mail-template'
import { ACADEMY_EMAILS } from '../../../server/services/integrations.service'
import { ACADEMY_CONTACT_EMAIL } from '@/data/academy-email'

const mail = renderMail({ heading: 'خطّتك عادت إليك', blocks: [{ kind: 'p', text: 'راجع «المراجعة».' }] })

describe('تذييلُ كلّ رسالة يقول أين الدعم', () => {
  it('⚠️ في الـHTML: «للدعم:» ثمّ العنوانُ رابطا يُضغَط', () => {
    expect(ACADEMY_EMAILS.support).toBe(ACADEMY_CONTACT_EMAIL)
    expect(mail.html).toContain(`للدعم: <span dir="ltr"><a href="mailto:${ACADEMY_EMAILS.support}"`)
    expect(mail.html).toContain(`>${ACADEMY_EMAILS.support}</a></span>`)
  })

  it('⚠️ وفي النصّ الخالص آخرَ سطر — لمن لا يرى الـHTML', () => {
    expect(mail.text.split('\n').at(-1)).toBe(`للدعم: ${ACADEMY_EMAILS.support}`)
  })
})
