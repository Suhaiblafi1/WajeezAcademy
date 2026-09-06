/* عناوينُ الأكاديميّة — واحدٌ لكلّ غاية، ونسخةُ خادمٍ تطابقها.

   كان عنوانٌ واحدٌ مكتوبا حرفا في عشرة مواضع: المُرسِلُ الآليّ، ومنظِّمُ دعوات
   التقويم في موضعين، وصفحاتُ الخصوصيّة والشروط والاسترداد والتواصل، وبطاقةُ
   التواصل، ورابطُ «أشعرني» في شاشة التشخيص.

   وثمنُ ذلك يُدفع مرّتين: تغييرُ العنوان يمرّ بعشرة ملفّات فيُنسى أحدُها،
   والمنسيُّ لا يظهر إلّا حين يقرؤه زائرٌ في صفحةٍ قانونيّة — أو حين يردّ
   المزوّدُ رسالةً لأنّ نطاقَ المُرسِل لم يُوثَّق. وهو ما وقع: الموقعُ انتقل إلى
   نطاقه الجديد وبقي العنوانُ على القديم.

   فثلاثةُ حرّاس: أنّ نسخةَ الخادم تطابق الأصل (الخادمُ لا يستورد من `src/`،
   فالتكرارُ لازم) · وأنّ **لا ملفَّ ثالثا يكتب عنوانا حرفا** · وأنّ العناوينَ
   كلَّها على نطاقٍ واحد — فتوثيقٌ واحدٌ عند المزوّد يغطّيها.

   والمقيسُ الخاصّيّةُ لا القيمة: أيَّ نطاقٍ أُريد وأيَّ أسماءَ أُريدت، يكفي أن
   تكون في موضعها وأن تتّفق. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACADEMY_EMAILS, ACADEMY_EMAIL_DOMAIN, ACADEMY_EMAIL } from '../data/academy-email'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

/** الملفّان اللذان يُسمح لهما بحمل النطاق حرفا — وهما مصدراه */
const SOURCES = ['src/data/academy-email.ts', 'server/services/integrations.service.ts']

/** الملفّات التي كانت تكتب العنوانَ بالأيدي — تُفحص بأعيانها فلا يعود إليها */
const FORMERLY_HARDCODED = [
  'src/data/stories.ts',
  'src/data/siteContent.ts',
  'src/pages/Diagnostic.tsx',
  'server/services/calendar/calendar.service.ts',
  'server/services/trainer-review.service.ts',
]

describe('عناوينُ الأكاديميّة', () => {
  it('كلُّها صالحةٌ وعلى نطاقٍ واحد — فتوثيقٌ واحدٌ يغطّيها', () => {
    const all = Object.values(ACADEMY_EMAILS)
    expect(all.length).toBeGreaterThan(1)
    for (const e of all) {
      expect(e, `${e} صيغةٌ صالحة`).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      expect(e.split('@')[1], `${e} على نطاق الأكاديميّة`).toBe(ACADEMY_EMAIL_DOMAIN)
    }
  })

  it('ولا عنوانان لغايتين مختلفتين يتطابقان — وإلّا فالتقسيمُ زينة', () => {
    const all = Object.values(ACADEMY_EMAILS)
    expect(new Set(all).size).toBe(all.length)
  })

  it('والمُرسِلُ الآليُّ ليس عنوانَ الدعم — لأنّه لا يُقرأ', () => {
    expect(ACADEMY_EMAILS.noReply).not.toBe(ACADEMY_EMAILS.support)
    expect(ACADEMY_EMAIL).toBe(ACADEMY_EMAILS.support)
  })

  it('ونسخةُ الخادم تطابق الأصل — فلا تفترقان', () => {
    const server = read('server/services/integrations.service.ts')
    const m = server.match(/export const ACADEMY_EMAIL_DOMAIN = '([^']+)'/)
    expect(m, 'الخادمُ يعلن ACADEMY_EMAIL_DOMAIN').not.toBeNull()
    expect(m![1]).toBe(ACADEMY_EMAIL_DOMAIN)
    /* والمُرسِلُ الافتراضيُّ في الخادم هو `no-reply` لا الدعم */
    expect(server).toContain('ACADEMY_EMAIL = ACADEMY_EMAILS.noReply')
  })

  it('و«ردّ» على الرسائل الآليّة يُوجَّه إلى الدعم', () => {
    const mail = read('server/services/mail.ts')
    expect(mail, 'mail.ts يضبط replyTo').toContain('replyTo')
    expect(mail).toContain('ACADEMY_EMAILS.support')
  })

  it('ولا يُكتب عنوانٌ حرفا في ملفٍّ غيرِ مصدرَيه', () => {
    for (const f of FORMERLY_HARDCODED) {
      const src = read(f)
      expect(src, `${f} يكتب نطاقَ البريد حرفا — استورده من مصدره`).not.toContain('@' + ACADEMY_EMAIL_DOMAIN)
      expect(src).toContain('ACADEMY_EMAILS')
    }
    for (const f of SOURCES) expect(read(f)).toContain(ACADEMY_EMAIL_DOMAIN)
  })
})
