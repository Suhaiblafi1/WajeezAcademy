/* المخاطبة والتأجيل — الوعد المكتوب على الشاشة يطابق ما يفعله الخادم.

   القراران المتّفق عليهما: رسائل **تُسجَّل**، وموعدٌ **يَنقله مدرّبُه** فيعود
   لانتظار الإدارة (١٧ سبتمبر ٢٠٢٦ — نسخا لـ«يُقترح ولا يُغيَّر» التي قبله).
   والخادم يفيهما (له اختباره على قاعدة حقيقية). وما يُحرس هنا الطرف الآخر:
   ألّا تَعِد الشاشةُ بغير ما يقع.

   • وأثرُ النقل مكتوبٌ قبل الضغط لا بعده — يعود للانتظار، ويغيب عن شاشات
     متعلّميه حتّى يُعتمَد، ويصلهم خبرُه.
   • والسجلّ يُعرض فعلا: بلا عرضه تصير الرسالة إشعارا يُمسح، وهو ما رُفض.
   • وقرار الإدارة يقع في موضعه: شاشتُها هي التي تعتمد، لا شاشة المدرب. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

/* التشغيلُ انتقل من «شعبي» إلى مرحلة «التشغيل» في صفحة الشعبة الواحدة
   (٨ سبتمبر ٢٠٢٦) — والحارسُ يتبع الشيفرةَ إلى موضعها الجديد بحمولته نفسِها. */
const BOARD = 'src/pages/trainer/CohortOps.tsx'
/* واقتراحُ التأجيل تبع لقاءَه إلى «لقاءات مباشرة» (د-٤ · ١٤ سبتمبر ٢٠٢٦):
   يُقترح من بطاقة اللقاء التي يجدولها ويسجّل حضورَها. والمخاطبةُ تبقى في
   التشغيل — هي ما سيصير «مركزَ التواصل» (ع-١). */
const SESSIONS = 'src/pages/trainer/SessionsAndAttendance.tsx'
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

describe('نقلُ موعدِ لقاء', () => {
  it('⚠️ الشاشةُ تنقل ولا تقترح — والأثرُ مكتوبٌ قبل الضغط', () => {
    /* ═══ انعكاسُ قرارٍ، لا تحسينُ نصّ ═══

       كان هنا «تقترح ولا تغيّر»: المدرّبُ يرفع طلبا وينتظر. وسأل صاحبُ
       المنصّة (١٧ سبتمبر ٢٠٢٦): «لماذا يقترح موعدا وهو من يحدّده
       بالبداية؟» فصار القرارُ: **«يغيّرُه فيرجع لانتظار الإدارة»**.

       والمسلكُ الصحيحُ كان مكتوبا في الخادم منذ ١٣ سبتمبر ولا تناديه شاشةٌ
       واحدة — فبقيت اللوحةُ تنادي بابَ الاستثناء وتترك بابَ الروتين. */
    const src = read(SESSIONS)
    expect(src, 'الشاشةُ ما زالت تنادي بابَ الاقتراح').not.toMatch(/\/reschedule/)
    expect(src, 'لا تنادي مسلكَ النقل الصحيح').toMatch(/apiPatch\(`\/api\/trainer\/sessions\/\$\{sessionId\}`/)

    const form = /moveFor === s\.id && \([\s\S]*?\n {14}\)\}/.exec(src)?.[0] ?? ''
    expect(form, 'لم يُعثَر على لوحة النقل').not.toBe('')
    /* والأثرُ يُقال قبل الضغط لا بعده: الرجوعُ للانتظار، والغيابُ عن
       شاشات المتعلّمين، وأنّهم يُبلَّغون. ثلاثتُها ممّا يفاجئ لو كُتم. */
    expect(form, 'لا يُقال إنّ اللقاء يعود لانتظار الإدارة').toMatch(/يعود لانتظار الإدارة/)
    expect(form, 'لا يُقال إنّه يغيب عن المتعلّمين').toMatch(/يغيب عن شاشات متعلّميك/)
  })

  it('القرار في شاشة الإدارة لا في شاشة المدرب', () => {
    /* ولا يعتمد المدرّبُ اقتراحَه في أيٍّ من الشاشتين */
    for (const screen of [BOARD, SESSIONS]) {
      expect(read(screen), 'المدرب يعتمد اقتراحه بنفسه').not.toContain('session-reschedules')
    }
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
