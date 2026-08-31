/* المخاطبة والتأجيل — الوعد المكتوب على الشاشة يطابق ما يفعله الخادم.

   القراران المتّفق عليهما: رسائل **تُسجَّل**، وموعدٌ **يُقترح** لا يُغيَّر.
   والخادم يفيهما (له اختباره على قاعدة حقيقية). وما يُحرس هنا الطرف الآخر:
   ألّا تَعِد الشاشةُ بغير ما يقع.

   • «تقترح ولا تغيّر» مكتوبةٌ قبل الضغط لا بعده — فلا يظنّ المدرب أنّ الموعد
     تبدّل عند متعلّميه، ويكتب لهم على أساسه.
   • والسجلّ يُعرض فعلا: بلا عرضه تصير الرسالة إشعارا يُمسح، وهو ما رُفض.
   • وقرار الإدارة يقع في موضعه: شاشتُها هي التي تعتمد، لا شاشة المدرب. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const BOARD = 'src/pages/trainer/CohortBoard.tsx'
const ADMIN = 'src/pages/admin/AdminCohorts.tsx'
const ROUTES = 'server/http/routes/learning-portal.routes.ts'

describe('مخاطبة الشعبة', () => {
  it('الشاشة تُرسل وتعرض السجلّ — لا إرسالٌ بلا أثرٍ يُقرأ', () => {
    const src = read(BOARD)
    expect(src, 'لا إرسال').toContain('/api/trainer/cohorts/${cohortId}/messages')
    expect(src, 'السجلّ لا يُقرأ من الخادم').toContain('/api/trainer/cohorts/${cohortId}/messages`)')
    expect(src, 'السجلّ لا يُعرض').toMatch(/msgLog\[c\.id\]\.map/)
    /* والإرسال يُتبعه تحديثُ السجلّ — وإلّا رأى المرسِل شاشةً لا تتغيّر */
    expect(src).toMatch(/await loadMessages\(cohortId\);/)
  })

  it('المدرب يخاطب شعبته وحدها — والحارس على الخادم لا على الشاشة', () => {
    const routes = read(ROUTES)
    const block = /app\.post\('\/api\/trainer\/cohorts\/:id\/messages'[\s\S]*?\n {2}\}\)/.exec(routes)?.[0] ?? ''
    expect(block, 'مسار الرسائل مفقود').toBeTruthy()
    expect(block, 'بلا حارس ملكيّة الشعبة: يخاطب شعبة غيره').toContain('assertCohortTrainer')
    expect(block, 'الصلاحية مفقودة').toContain("requirePermission('trainer.cohort.operate')")
  })
})

describe('اقتراح تأجيل جلسة', () => {
  it('الشاشة تقول «تقترح ولا تغيّر» قبل الضغط', () => {
    const src = read(BOARD)
    const form = /rescheduleFor === s\.id && \([\s\S]*?\n {38}\)\}/.exec(src)?.[0] ?? src
    expect(form, 'الوعد غير مكتوب في النموذج').toMatch(/تقترح ولا تغيّر/)
    expect(form, 'لا يُقال إنّ الموعد يبقى حتى الاعتماد').toMatch(/حتى تعتمد الإدارة/)
    /* والسبب إلزاميّ في الشاشة كما هو إلزاميّ في الخادم — لا زرٌّ يُضغط ثم يُردّ */
    expect(src).toMatch(/rescheduleForm\.reason\.trim\(\)\.length < 10/)
  })

  it('القرار في شاشة الإدارة لا في شاشة المدرب', () => {
    const board = read(BOARD)
    expect(board, 'المدرب يعتمد اقتراحه بنفسه').not.toContain('session-reschedules')
    const admin = read(ADMIN)
    expect(admin, 'الإدارة لا ترى الاقتراحات').toContain('/api/admin/session-reschedules')
    expect(admin, 'لا اعتماد').toContain('"approve"')
    expect(admin, 'لا ردّ').toContain('"reject"')
    /* والفارق يُقال للإداريّ: الاعتماد يحرّك الموعد، والردّ لا يحرّكه */
    expect(admin).toMatch(/الاعتماد يحرّك الموعد/)
  })

  it('صلاحية القرار للإدارة وحدها', () => {
    const routes = read(ROUTES)
    const block = /app\.post\('\/api\/admin\/session-reschedules\/:id\/review'[\s\S]*?\n {2}\}\)/.exec(routes)?.[0] ?? ''
    expect(block, 'مسار القرار مفقود').toBeTruthy()
    expect(block, 'القرار بلا صلاحية إدارة الشعب').toContain("requirePermission('cohort.manage')")
    /* ومسارُ الاقتراح بصلاحية المدرب — لا بصلاحية الإدارة */
    const propose = /app\.post\('\/api\/trainer\/sessions\/:sessionId\/reschedule'[\s\S]*?\n {2}\}\)/.exec(routes)?.[0] ?? ''
    expect(propose, 'مسار الاقتراح مفقود').toBeTruthy()
    expect(propose).toContain("requirePermission('trainer.cohort.operate')")
    expect(propose, 'بلا حارس ملكيّة الشعبة: يقترح لجلسة ليست له').toContain('assertCohortTrainer')
  })
})
