/* أعطابُ جانب المتعلّم — درسها صاحبُ المنصّة واختار «All, in order» (١٩ أكتوبر ٢٠٢٦).

   ① الإشعارُ يفتح خبرَه: الجرسُ و«إشعاراتي» و«الرسائل والتنبيهات» — ووجهاتٌ تقول ما يقوله نصُّها.
   ② «فواتيري» تقرأ الحقولَ كما يكتبها الخادم، وتقول الحالاتِ بالعربيّة.
   ③ حالاتُ التذكرة كما يكتبها الخادم — في بوّابة المتعلّم وفي شاشة الفريق.
   ④ لا أسماءَ قديمةٌ لصفحاته، ولا أصنافُ إشعارٍ لا تصله.
   ⑤ رسالةُ المدرّب كاملة، والدفعُ اليدويُّ يُقال، والاستردادُ تذكرةٌ حقيقيّة، والنسبةُ تقول ما تحسبه.
   ⑥ والشعبةُ التي اختارها تصل الدفع.

   والفحصُ على الشيفرة بلا تعليقاتها، وعلى السلوك حيث تُنادى الدالّة. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildInbox } from '@/application/student/inbox'
import { destinationFor } from '@/application/notifications/destinations'
import { LEARNER_CATEGORY_KEYS } from '@/application/notifications/learner-categories'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① الإشعارُ يفتح خبرَه', () => {
  /* وكان ما لا وجهةَ له يقود إلى «إشعاراتي» — صفحةٌ تعرض البنودَ نفسَها، فيدور في حلقة. وصار الصندوقُ
     البابَ الوحيد (٢٠ أكتوبر ٢٠٢٦، `src/tests/student/one-inbox.test.ts`) */
  it('⚠️ في «الرسائل والتنبيهات»: بنده إلى وجهة بريده بفعلها — وما لا وجهةَ له لا يقود إلى صفحةٍ تكرّره', () => {
    const items = buildInbox([
      { id: 'a', title: 'صدرت شهادتك', body: 'شهادتك جاهزة', status: 'sent', sentAt: '2026-10-19T10:00:00Z', templateKey: 'certificate.issued' },
      { id: 'b', title: 'خبر', body: 'خبر بلا باب', status: 'sent', sentAt: '2026-10-19T09:00:00Z', templateKey: null },
    ], [], [], 'u1')
    expect(items.find((i) => i.id === 'n:a')).toMatchObject({ href: '/student/certificates', ctaAr: 'افتح شهادتك' })
    expect(items.find((i) => i.id === 'n:b')).toMatchObject({ href: null, ctaAr: null })
  })

  it('⚠️ وفي الجرس: البندُ ينتقل إلى وجهته', () => {
    const bell = code('src/pages/student/PortalLayout.tsx')
    expect(bell).toMatch(/onClick=\{\(\) => openNotif\(n\)\}/)
    expect(bell).toMatch(/const href = notificationHref\(n\.templateKey, "learner", n\.data\);\s*if \(href\) \{ setBellOpen\(false\); navigate\(href\); \}/)
  })

  it('والوجهةُ تقول ما يقوله الخبر', () => {
    expect(destinationFor('payment.refund_rejected', 'learner')?.path, '«راسل الدعم» يفتح الدعم').toBe('/student/support')
    expect(destinationFor('plan.requested', 'learner'), '«فواتيري» قبل أن تكون فاتورة').toBeNull()
    expect(code('server/services/commerce.service.ts'), 'غير المدفوع يفتح «رحلتي» ونصّه يقول «الفواتير»')
      .toMatch(/templateKey: autoPaid \? 'enrollment\.approved' : 'order\.seats_held'/)
    expect(destinationFor('order.seats_held', 'learner')?.path).toBe('/student/billing')
  })
})

describe('② «فواتيري» بحقول الخادم', () => {
  const b = code('src/pages/student/Billing.tsx')
  it('⚠️ مبلغُ الفاتورة ورقمُها وطريقةُ الدفع — كما في المخطّط', () => {
    expect(b).toMatch(/\{o\.invoice\.amount\} \{o\.invoice\.currency\}/)
    expect(b).toMatch(/o\.invoice\?\.number/)
    expect(b).not.toMatch(/invoice\.total|p\.method\b/)
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    const invoice = schema.slice(schema.indexOf('model Invoice {'), schema.indexOf('}', schema.indexOf('model Invoice {')))
    expect(invoice).toMatch(/\n\s+amount\s/)
    expect(invoice).toMatch(/\n\s+number\s/)
  })

  it('⚠️ ولا حالةٌ تُطبع بالإنجليزيّة — الدفعةُ والردّ', () => {
    expect(b).not.toMatch(/: p\.status\}|— \{r\.status\}/)
    for (const k of ['succeeded', 'pending', 'failed', 'partially_refunded', 'refunded']) {
      expect(b, k).toMatch(new RegExp(`PAYMENT_STATUS[\\s\\S]*?${k}: "`))
    }
    for (const k of ['pending', 'processed', 'rejected']) expect(b, k).toMatch(new RegExp(`REFUND_STATUS[\\s\\S]*?${k}: "`))
  })
})

describe('③ حالاتُ التذكرة كما يكتبها الخادم', () => {
  const server = code('server/services/support.service.ts').match(/TICKET_STATUSES = \[([^\]]+)\]/)![1]
  const statuses = [...server.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()
  it.each(['src/pages/student/Support.tsx', 'src/pages/admin/Support.tsx'])('⚠️ %s', (p) => {
    const map = code(p).match(/const STATUS_AR: Record<string, string> = \{([\s\S]*?)\};/)![1]
    expect([...map.matchAll(/(\w+): "/g)].map((m) => m[1]).sort()).toEqual(statuses)
  })
})

describe('④ أسماءٌ حاضرةٌ وأصنافٌ تصله', () => {
  it('⚠️ لا «مراجعتي» — الصفحةُ «تثبيت ما تعلّمت»', () => {
    for (const p of ['src/components/MyDeadlines.tsx', 'server/services/deadlines.service.ts']) expect(code(p), p).not.toMatch(/مراجعتي/)
    expect(code('src/pages/student/Account.tsx')).not.toMatch(/مساراتي وتقدمي|دوراتي وجلساتي/)
  })

  it('⚠️ «إشعاراتي» لا تعرض أصنافَ الفريق والمدرّب', () => {
    expect(LEARNER_CATEGORY_KEYS.has('work')).toBe(false)
    expect(LEARNER_CATEGORY_KEYS.has('cohort_plan')).toBe(false)
    for (const k of ['sessions', 'money', 'certificates', 'enrollment_change', 'account']) expect(LEARNER_CATEGORY_KEYS.has(k), k).toBe(true)
    expect(code('src/components/NotificationPreferences.tsx')).toMatch(/prefs\.categories\.filter\(\(c\) => LEARNER_CATEGORY_KEYS\.has\(c\.key\)\)\.map/)
  })
})

describe('⑤ ما يصله كاملٌ وصادق', () => {
  it('⚠️ رسالةُ المدرّب إلى المتعلّمين لا تُقصّ', () => {
    /* ونسخةُ المستشار (جمهورُ الفريق) خارجَ هذا — يقرأ الرسالةَ من بابه */
    const svc = code('server/services/cohort-message.service.ts')
    const at = svc.indexOf("userId: r.userId, channel: 'in_app', audience: 'learner'")
    expect(at, 'لا إشعارَ للمتعلّمين').toBeGreaterThan(-1)
    expect(svc.slice(at, at + 300)).toMatch(/body: `\$\{author\?\.displayName \?\? 'مدرّبك'\}: \$\{body\}`/)
  })

  it('⚠️ الدفعُ اليدويُّ يُقال قبل المزوّد — لا ٥٠٠', () => {
    const svc = code('server/services/commerce.service.ts')
    const at = svc.indexOf("if (provider.name === 'manual')")
    expect(at, 'لا فحصَ للمزوّد اليدويّ').toBeGreaterThan(-1)
    expect(svc.slice(at, at + 300)).toMatch(/throw new AuthError\('manual_payment'/)
    expect(at).toBeLessThan(svc.indexOf('const charge = await provider.createCharge({\n      invoiceNumber: order.invoice.number, amount: chargeAmount'))
  })

  it('⚠️ الاستردادُ تذكرةُ دعمٍ حقيقيّة — لا نموذجُ تواصلٍ يحاكي الإرسال', () => {
    const acc = code('src/pages/student/Account.tsx')
    expect(acc).toMatch(/to="\/student\/support\?topic=refund"/)
    expect(acc).not.toMatch(/to="\/contact"/)
    expect(code('src/pages/student/Support.tsx')).toMatch(/\{ subject: "طلب استرداد", category: "billing", body: "" \}/)
  })

  it('والنسبةُ تقول ما تحسبه', () => {
    expect(code('src/components/journey/StageWork.tsx')).not.toMatch(/من دروسها مكتملة/)
  })
})

describe('⑥ الشعبةُ المختارةُ تصل الدفع', () => {
  it('⚠️ صفحةُ المسار تمرّر اختيارها إلى نافذة الدفع', () => {
    const p = code('src/pages/Pathway.tsx')
    expect(p).toMatch(/cohortId: pickedCohorts\[cid\]/)
    expect(p).toMatch(/picked=\{pickedCohorts\}/)
    expect(code('src/components/CourseJourney.tsx')).toMatch(/onSelect=\{\(cid\) => pick\(c\.id, cid\)\}/)
  })

  it('⚠️ و«سجّل في هذه الشعبة» يحمل شعبتَه — وصفحةُ الدورة تختارها', () => {
    expect(code('src/pages/TrainerPublic.tsx')).toMatch(/to=\{`\/build\/\$\{c\.courseId\}\?cohort=\$\{c\.id\}`\}/)
    expect(code('src/pages/Calendar.tsx')).toMatch(/to=\{`\/build\/\$\{e\.courseId\}\?cohort=\$\{e\.cohortId\}`\}/)
    expect(code('src/pages/CoursePath.tsx')).toMatch(/get\("cohort"\);\s*return asked && courseId \? \{ \[courseId\]: asked \} : \{\};/)
  })
})
