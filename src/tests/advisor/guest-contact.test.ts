/* «اترك رقمك ويتواصل معك مستشار» — ما تقوله الشاشاتُ وأين يظهر (١٨ أكتوبر ٢٠٢٦).

   الحفظُ والحدودُ في الخادم (`server/tests/advisors/guest-contact.test.ts`). وهنا ما لو
   انكسر لم يحمرّ خادم: أنّ السطرَ يظهر **حيث ينتهي التشخيصُ** — صفحةُ المسار وصفحةُ الدورة
   حين هبط عليهما التشخيصُ نفسُه، وشاشتا «لا مسار» — لا في كلّ زيارة، ولا لمن له حساب؛
   وأنّه يُرسل إلى بابه؛ وأنّ الرقمَ يُقبل كما يكتبه الناس. والفحصُ على البنية لا على ورود
   كلمة: التعليقاتُ تُنزع قبل المطابقة. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { contactErrors, GUEST_CONTACT_CONSENT_AR, normalizePhone } from '@/application/advisor/guest-contact'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const FORM = code('src/components/AdvisorCallbackForm.tsx')
const PATHWAY = code('src/pages/Pathway.tsx')
const COURSE = code('src/pages/CoursePath.tsx')
const DIAG = code('src/pages/Diagnostic.tsx')
const QUEUE = code('src/pages/admin/Exceptions.tsx')
const ROUTES = code('server/http/routes/public.routes.ts')

describe('الرقمُ كما يكتبه الناس', () => {
  it('⚠️ أرقامٌ عربيّةٌ ومسافاتٌ وشرطات و`00` — رقمٌ واحدٌ بصيغةٍ واحدة', () => {
    expect(normalizePhone('٠٧٩ ١٢٣-٤٥٦٧')).toBe('0791234567')
    expect(normalizePhone('00962 (79) 123 4567')).toBe('+962791234567')
    expect(normalizePhone('+۹۶۶ ۵۵ ۱۲۳ ۴۵۶۷')).toBe('+966551234567')
  })

  it('⚠️ وما ليس رقما لا يُقبل — ولا يُخمَّن له مفتاحُ بلد', () => {
    expect(normalizePhone('اتصل بي')).toBeNull()
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('+1234567890123456')).toBeNull()
    expect(normalizePhone('0791234567')).toBe('0791234567')
  })

  it('والنموذجُ يقول أيّ حقلٍ رُفض — ويكفي الرقمُ أو البريد', () => {
    expect(contactErrors({ name: 'سامي', phone: '0791234567', email: '' }))
      .toEqual({ name: null, phone: null, email: null, contact: null })
    expect(contactErrors({ name: 'سامي', phone: '', email: 'sami@example.com' }).contact).toBeNull()
    expect(contactErrors({ name: 'سامي', phone: '', email: '' }).contact).not.toBeNull()
    expect(contactErrors({ name: 'سامي', phone: 'abc', email: '' }).phone).not.toBeNull()
    expect(contactErrors({ name: 'س', phone: '0791234567', email: '' }).name).not.toBeNull()
  })
})

describe('حيث ينتهي التشخيص — لا في كلّ زيارة', () => {
  it('⚠️ صفحةُ المسار: حين هبط عليها تشخيصُه وحدَه', () => {
    expect(PATHWAY).toMatch(/\{diagTopId === pathway\.id && \(\s*<AdvisorCallbackForm snapshot=\{\(\) => loadLastResult<DiagResult>\(\)\}/)
  })

  it('⚠️ صفحةُ الدورة: حين كانت هي نتيجتَه الواحدة', () => {
    expect(COURSE).toMatch(/singleCourseOf\(last\.resultJson\) === courseId/)
    expect(COURSE).toMatch(/\{fromDiagnostic && \(\s*<AdvisorCallbackForm /)
  })

  it('⚠️ وشاشتا «لا مسار» — الإنجليزيّةُ بخياريها والاتّجاهُ الاستكشافيّ', () => {
    expect(DIAG).toMatch(/<EnglishPlanCard[\s\S]{0,300}?\/>\s*<AdvisorCallbackForm snapshot=\{\(\) => result\}/)
    expect(DIAG).toMatch(/label="تحدّث مع مستشار مهني"[\s\S]{0,600}?<\/p>\s*<AdvisorCallbackForm snapshot=\{\(\) => result\}/)
  })

  it('⚠️ ولا يظهر لمن له حساب — حالتُه تُفتح بلا أن يُسأل', () => {
    expect(FORM).toMatch(/if \(readSession\(\)\) return null;/)
  })
})

describe('ويُرسل إلى بابه، ويُقرأ في الطابور', () => {
  it('⚠️ البابُ الذي ينادي هو الذي يُفتح في الخادم', () => {
    expect(FORM).toMatch(/apiPost\("\/api\/public\/advisor-contact", \{/)
    expect(ROUTES).toMatch(/app\.post\('\/api\/public\/advisor-contact'/)
  })

  it('⚠️ وطابورُ «حالات بلا مستشار» يقرأ اسمَه ورقمَه — لا حقلا لا وجودَ له', () => {
    expect(QUEUE).not.toMatch(/lead\?\.name\b/)
    expect(QUEUE).toMatch(/c\.lead\?\.fullName/)
    expect(QUEUE).toMatch(/c\.lead\?\.phone/)
  })
})

describe('ونصوصُه قصيرةٌ بلا تشكيلٍ إعرابيّ — «اللغة البيضاء»', () => {
  it('ما يراه الزائر', () => {
    const shown = [
      'اترك رقمك ويتواصل معك مستشار',
      'اترك رقم واتساب أو بريدك، ويتواصل معك مستشار بخصوص نتيجتك.',
      'وصل طلبك — سيتواصل معك مستشار قريبا.',
      'يكفي الرقم أو البريد',
    ]
    for (const t of shown) {
      expect(FORM).toContain(t)
      expect(t).toBe(plainAr(t))
    }
    expect(GUEST_CONTACT_CONSENT_AR).toBe(plainAr(GUEST_CONTACT_CONSENT_AR))
  })
})
