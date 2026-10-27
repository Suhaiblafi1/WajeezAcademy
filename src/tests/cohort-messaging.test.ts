/* المخاطبة والتأجيل — الوعد المكتوب على الشاشة يطابق ما يفعله الخادم.

   القراران المتّفق عليهما: رسائل **تُسجَّل**، وموعدٌ **يَنقله مدرّبُه** فيعود
   لانتظار الإدارة (١٧ سبتمبر ٢٠٢٦ — نسخا لـ«يُقترح ولا يُغيَّر» التي قبله).
   والخادم يفيهما (له اختباره على قاعدة حقيقية). وما يُحرس هنا الطرف الآخر:
   ألّا تَعِد الشاشةُ بغير ما يقع.

   • وأثرُ النقل مكتوبٌ قبل الضغط لا بعده — يعود للانتظار، ويغيب عن شاشات
     متعلّميه حتّى يُعتمَد، ويصلهم خبرُه.
   • والسجلّ يُعرض فعلا: بلا عرضه تصير الرسالة إشعارا يُمسح، وهو ما رُفض.
   • واقتراحُ التأجيل خرج كلُّه (٢٧ أكتوبر ٢٠٢٦، المرحلة السادسة — ج): لا يُقترح شيءٌ منذ صار النقلُ
     بيد المدرّب، واختار صاحبُ المنصّة («a») أن يخرج طابورُه وحدَه وتبقى أدواتُ التأجيل الأربع الأخرى. */

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
/* الشيفرةُ بلا تعليقاتها — فلا يُطابَق مسارٌ في شرحٍ يقول إنّه ذهب */
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
/** ملفّاتُ الخادم عدا اختباراتِه */
const serverFiles = (dir = 'server'): string[] => readdirSync(join(root, dir)).flatMap((f) => {
  const p = `${dir}/${f}`
  if (statSync(join(root, p)).isDirectory()) return f === 'tests' || f === 'node_modules' ? [] : serverFiles(p)
  return p.endsWith('.ts') ? [relative(root, join(root, p))] : []
})

/* التشغيلُ انتقل من «شعبي» إلى مرحلة «التشغيل» في صفحة الشعبة الواحدة
   (٨ سبتمبر ٢٠٢٦) — والحارسُ يتبع الشيفرةَ إلى موضعها الجديد بحمولته نفسِها. */
const BOARD = 'src/pages/trainer/CohortOps.tsx'
/* واقتراحُ التأجيل تبع لقاءَه إلى «لقاءات مباشرة» (د-٤ · ١٤ سبتمبر ٢٠٢٦):
   يُقترح من بطاقة اللقاء التي يجدولها ويسجّل حضورَها. والمخاطبةُ تبقى في
   التشغيل — هي ما سيصير «مركزَ التواصل» (ع-١). */
const SESSIONS = 'src/pages/trainer/SessionsAndAttendance.tsx'
const ADMIN = 'src/pages/admin/AdminCohorts.tsx'
const SCHEDULE = 'src/pages/trainer/Schedule.tsx'
const ROUTES = 'server/http/routes/learning-portal.routes.ts'

describe('مخاطبة الشعبة', () => {
  it('الشاشة ترسل وتعرض السجلّ — لا إرسال بلا أثر يقرأ', () => {
    const src = read(BOARD)
    expect(src, 'لا إرسال').toContain('/api/trainer/cohorts/${cohortId}/messages')
    expect(src, 'السجلّ لا يقرأ من الخادم').toContain('/api/trainer/cohorts/${cohortId}/messages`)')
    expect(src, 'السجلّ لا يعرض').toMatch(/msgLog\[c\.id\]\.map/)
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

describe('نقل موعد لقاء', () => {
  it('⚠️ الشاشة تنقل ولا تقترح — والأثر مكتوب قبل الضغط', () => {
    /* ═══ انعكاسُ قرارٍ، لا تحسينُ نصّ ═══

       كان هنا «تقترح ولا تغيّر»: المدرّبُ يرفع طلبا وينتظر. وسأل صاحبُ
       المنصّة (١٧ سبتمبر ٢٠٢٦): «لماذا يقترح موعدا وهو من يحدّده
       بالبداية؟» فصار القرارُ: **«يغيّرُه فيرجع لانتظار الإدارة»**.

       والمسلكُ الصحيحُ كان مكتوبا في الخادم منذ ١٣ سبتمبر ولا تناديه شاشةٌ
       واحدة — فبقيت اللوحةُ تنادي بابَ الاستثناء وتترك بابَ الروتين. */
    const src = read(SESSIONS)
    expect(src, 'الشاشة ما زالت تنادي باب الاقتراح').not.toMatch(/\/reschedule/)
    expect(src, 'لا تنادي مسلك النقل الصحيح').toMatch(/apiPatch\(`\/api\/trainer\/sessions\/\$\{sessionId\}`/)

    const form = /moveFor === s\.id && \([\s\S]*?\n {14}\)\}/.exec(src)?.[0] ?? ''
    expect(form, 'لم يعثر على لوحة النقل').not.toBe('')
    /* والأثرُ يُقال قبل الضغط لا بعده: الرجوعُ للانتظار، والغيابُ عن
       شاشات المتعلّمين، وأنّهم يُبلَّغون. ثلاثتُها ممّا يفاجئ لو كُتم. */
    expect(form, 'لا يقال إنّ اللقاء يعود لانتظار الإدارة').toMatch(/يعود لانتظار الإدارة/)
    expect(form, 'لا يقال إنّه يغيب عن المتعلّمين').toMatch(/يغيب عن شاشات متعلّميك/)
  })

  it('⚠️ واقتراحُ التأجيل خرج كلُّه — لا شاشةَ تناديه ولا بابَ يقبله ولا خدمةَ تكتبه', () => {
    for (const screen of [BOARD, SESSIONS, ADMIN, SCHEDULE]) {
      expect(code(screen), `${screen} ما زالت تنادي اقتراحَ التأجيل`).not.toMatch(/session-reschedules|\/reschedules?\b/)
    }
    expect(code(ROUTES), 'بقي بابٌ من أبواب الاقتراح').not.toMatch(
      /app\.(get|post)\('\/api\/(admin\/session-reschedules|trainer\/reschedules|trainer\/sessions\/:sessionId\/reschedule)/,
    )
    /* والجدولُ باقٍ أثرا: يقرؤه المحوُ ويمحوه (`account-purge`)، ولا يُنشئ صفّا فيه أحدٌ ولا يقرّره */
    const writers = serverFiles().filter((f) => /sessionRescheduleRequest\.(create|update|updateMany|upsert)\(/.test(code(f)))
    expect(writers).toEqual([])
    expect(code('server/services/staff-inbox.service.ts'), 'بقي بندُه في الوارد').not.toContain("key: 'reschedules'")
  })
})
