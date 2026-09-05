/* عنوانُ الأكاديميّة — مصدرٌ واحد، ونسخةُ خادمٍ تطابقه.

   كان مكتوبا حرفا في عشرة مواضع: عنوانُ المُرسِل، ومنظِّمُ دعوات التقويم في
   موضعين، وصفحاتُ الخصوصيّة والشروط والاسترداد والتواصل، وبطاقةُ التواصل،
   ورابطُ «أشعرني» في شاشة التشخيص.

   وثمنُ ذلك يُدفع مرّتين: تغييرُ العنوان يمرّ بعشرة ملفّات فيُنسى أحدُها،
   والمنسيُّ لا يظهر إلّا حين يقرؤه زائرٌ في صفحةٍ قانونيّة — أو حين يردّ Resend
   رسالةً لأنّ نطاقَ المُرسِل لم يُوثَّق. وهو ما وقع فعلا: الموقعُ انتقل إلى
   نطاقه الجديد وبقي العنوانُ على القديم.

   فحارسان: أنّ نسخةَ الخادم تطابق الأصل (الخادمُ لا يستورد من `src/`، فالتكرار
   لازم)، وأنّ **لا ملفَّ ثالثا يكتب عنوانَ أكاديميّةٍ حرفا**. والمقيسُ الخاصّيّةُ
   لا القيمة: أيُّ عنوانٍ أردتَه، يكفي أن يكون واحدا وأن يُكتب في موضعه. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACADEMY_EMAIL } from '../data/academy-email'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

/** الملفّان اللذان يُسمح لهما بحمل العنوان حرفا — وهما مصدراه */
const SOURCES = ['src/data/academy-email.ts', 'server/services/integrations.service.ts']

/** الملفّات التي كانت تكتبه بالأيدي — تُفحص بأعيانها فلا يعود إليها */
const FORMERLY_HARDCODED = [
  'src/data/stories.ts',
  'src/data/siteContent.ts',
  'src/pages/Diagnostic.tsx',
  'server/services/calendar/calendar.service.ts',
  'server/services/trainer-review.service.ts',
]

describe('عنوانُ الأكاديميّة الرسميّ', () => {
  it('معلَنٌ مرّةً واحدةً بصيغةٍ صالحة', () => {
    expect(ACADEMY_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  })

  it('ونسخةُ الخادم تطابقه — فلا يفترقان', () => {
    const server = read('server/services/integrations.service.ts')
    const m = server.match(/export const ACADEMY_EMAIL = '([^']+)'/)
    expect(m, 'الخادمُ يعلن ACADEMY_EMAIL').not.toBeNull()
    expect(m![1]).toBe(ACADEMY_EMAIL)
  })

  it('ولا يُكتب حرفا في ملفٍّ غيرِ مصدرَيه', () => {
    for (const f of FORMERLY_HARDCODED) {
      const src = read(f)
      expect(src, `${f} يكتب العنوانَ حرفا — استورده من مصدره`).not.toContain(ACADEMY_EMAIL)
      expect(src).toContain('ACADEMY_EMAIL')
    }
    /* والمصدران وحدهما يحملانه */
    for (const f of SOURCES) expect(read(f)).toContain(ACADEMY_EMAIL)
  })
})
