/* القِمعُ يقول ثلاثةً في نظرة — والحسابُ الذي وراءه يُختبر بمعزل.

   كانت شاشةُ المستشار قائمةً واحدة فوقها ثمانيةُ أزرارِ تصفية. فمن أراد
   أن يعرف «أين قِمعي؟» ضغط ثمانيةَ أزرارٍ وعدّ بعينه — وذلك جدولٌ
   بمرشِّح لا CRM.

   وأخطرُ ما فيه أنّ المتأخّر لا يُرى: الصفقة تُفقَد بالنسيان أكثر ممّا
   تُفقَد بالرفض. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLOSED_STAGES, isOverdue, sinceAr, STAGES } from '@/application/advisor/pipeline'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const NOW = Date.parse('2026-09-01T12:00:00Z')
const kase = (over: Partial<{ nextFollowUpAt: string | null }> = {}) => ({
  id: 'x', status: 'follow_up', nextAction: null, updatedAt: '2026-09-01T00:00:00Z',
  nextFollowUpAt: null, ...over,
})

describe('قِمع المستشار', () => {
  it('١) مراحلُ القِمع ستّ، وقيمُها قيمُ القاعدة نفسُها', () => {
    expect(STAGES).toHaveLength(6)
    const service = read('server/services/advisor.service.ts')
    for (const s of [...STAGES, ...CLOSED_STAGES]) {
      expect(service, `المرحلة ${s.key} ليست في حالات الخادم`).toContain(`'${s.key}'`)
    }
  })

  it('٢) ولا حالةَ في الخادم بلا عمودٍ أو مطوًى', () => {
    const service = read('server/services/advisor.service.ts')
    const block = /export const CASE_STATUSES = \[([\s\S]*?)\] as const/.exec(service)?.[1] ?? ''
    const serverStatuses = [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    expect(serverStatuses.length).toBeGreaterThan(0)
    const shown = [...STAGES, ...CLOSED_STAGES].map((s) => s.key) as string[]
    for (const st of serverStatuses) {
      expect(shown, `الحالة ${st} لا تظهر في أيّ عمود — فتختفي حالاتٌ عن المستشار`).toContain(st)
    }
  })

  it('٣) فاتَ موعدُه = موعدٌ في الماضي', () => {
    expect(isOverdue(kase({ nextFollowUpAt: '2026-08-30T12:00:00Z' }), NOW)).toBe(true)
    expect(isOverdue(kase({ nextFollowUpAt: '2026-09-05T12:00:00Z' }), NOW)).toBe(false)
    /* ومن لا موعدَ له ليس متأخّرا — لا يُنذَر بلا سبب */
    expect(isOverdue(kase(), NOW)).toBe(false)
  })

  it('٤) «منذ» و«بعد» — الماضي والمستقبل لا يلتبسان', () => {
    expect(sinceAr('2026-09-01T08:00:00Z', NOW)).toBe('اليوم')
    expect(sinceAr('2026-08-31T08:00:00Z', NOW)).toBe('أمس')
    expect(sinceAr('2026-08-28T12:00:00Z', NOW)).toBe('منذ 4 أيام')
    expect(sinceAr('2026-09-05T12:00:00Z', NOW)).toBe('بعد 4 أيام')
    expect(sinceAr('2026-08-01T12:00:00Z', NOW)).toContain('منذ')
  })

  it('٥) المتأخّرون يُعرضون قبل الأعمدة — لا بداخلها وحدها', () => {
    const src = read('src/pages/advisor/Pipeline.tsx')
    const overdueIdx = src.indexOf('فات موعد متابعة')
    const columnsIdx = src.indexOf('STAGES.map')
    expect(overdueIdx, 'لا صندوقَ للمتأخّرين').toBeGreaterThan(0)
    expect(overdueIdx, 'المتأخّرون بعد الأعمدة — فلا يُرَون').toBeLessThan(columnsIdx)
  })

  it('٦) التاريخ ميلاديٌّ في بوّابة المستشار كغيرها', () => {
    const src = read('src/pages/advisor/Cases.tsx')
    expect(src, 'عاد التقويم الهجريّ — فيُقارن موعدان بتقويمين').not.toContain('"ar-SA"')
    expect(src).toContain('ar-u-ca-gregory')
  })

  it('٧) والمستشار يرى الوجه الأكاديميّ ويرفع طلباته من الشاشة نفسها', () => {
    const src = read('src/pages/advisor/Cases.tsx')
    expect(src, 'لا لوحةَ لتقدّم المتعلّم').toContain('<LearnerPanel')
    expect(src, 'لا لوحةَ لطلبات الخصم وتعديل الخطّة').toContain('<RequestsPanel')
  })

  it('٨) وصلاحيّاتُ المستشار تكفي وجهيه — لا وجهَ البيع وحده', () => {
    const perms = read('server/auth/permissions.ts')
    for (const key of ['advisor.learner.view', 'advisor.request.submit', 'advisor.request.review']) {
      expect(perms, `الصلاحية ${key} غير معلَنة`).toContain(`key: '${key}'`)
    }
    const role = /^ {2}advisor: \[(.+)\],$/m.exec(perms)?.[1] ?? ''
    expect(role, 'المستشار لا يرى تقدّم من يتابعه').toContain('advisor.learner.view')
    expect(role, 'المستشار لا يستطيع رفع طلب').toContain('advisor.request.submit')
    expect(role, 'المستشار يبتّ في طلبه بنفسه — فصلُ الطلب عن القرار ضاع').not.toContain('advisor.request.review')
  })
})

/* العطب الذي أوقعتُه: `cases.filter(isOverdue)` يمرّر الفهرس مكان الوقت
   (٠، ١، ٢…) فيصير «الآن» صفرا، فلا يتأخّر أحدٌ أبدا. والبطاقةُ تظهر
   ذهبيّة داخل عمودها بينما بانرُ المتأخّرين لا يظهر — تناقضٌ في الشاشة
   نفسِها رأيتُه بعينِ المتصفّح لا بالاختبار. */
describe('تمريرُ الوقت لا الفهرس', () => {
  const read2 = (p: string) =>
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', p), 'utf8')

  it('٩) لا يُمرَّر `isOverdue` مباشرةً إلى `filter`/`map`', () => {
    const src = read2('src/pages/advisor/Pipeline.tsx')
    expect(src, 'عاد تمريرُ الدالّة مباشرةً — فالفهرسُ يصير وقتا').not.toMatch(/\.(filter|map|some|every)\(\s*isOverdue\s*\)/)
    expect(src).toContain('(c) => isOverdue(c)')
  })

  it('١٠) والفهرسُ لو مُرِّر لأسقط الحساب — هذا ما يجعل القاعدة لازمة', () => {
    const late = kase({ nextFollowUpAt: '2026-08-30T12:00:00Z' })
    expect(isOverdue(late, NOW), 'متأخّرٌ بوقتٍ صحيح').toBe(true)
    expect(isOverdue(late, 0), 'الفهرسُ مكان الوقت يقلب النتيجة').toBe(false)
  })
})
