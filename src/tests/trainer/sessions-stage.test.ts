/* «لقاءات مباشرة» تجمع اللقاءَ وحضورَه — ولا يبقى منهما شيءٌ في التشغيل (د-٤).

   ═══ العطب ═══

   المدرّبُ يجدول لقاءَه في مرحلة «لقاءات مباشرة» من التجهيز، ثمّ يسجّل
   حضورَه في شاشةٍ أخرى («التشغيل»). والشيءُ واحد. فمن فتح المرحلةَ ليرى
   لقاءاته وجد نموذجَ جدولةٍ وحدَه — لا ما جدوله، ولا من حضره، ولا بابا
   يقترح منه تأجيلا.

   ونصُّ د-٤: «واللقاءاتُ والحضورُ تنتقل هنا من التشغيل». وهو كذلك شرطُ ع-١:
   التشغيلُ يصير «مركزَ التواصل» ولا يبقى فيه إلّا المخاطبة.

   ═══ ولماذا نقلٌ لا نسخ ═══

   شبكةُ الحضور تُعيد حسابَ تقدّم المتعلّم عند كلّ ضغطة، والتقدّمُ هو ما
   يُبنى عليه استحقاقُ شهادته. فنسختان منها في شاشتَين بابان لرقمٍ واحدٍ
   يراه إنسان.

   ═══ والفحصُ بنيويٌّ لا نصّيّ ═══

   لا يكفي أن تغيب كلمةٌ من ملفّ: يُفحَص أنّ **نداءَ التسجيل** غادر التشغيلَ
   فعلا، وأنّه في موضعه الجديد، وأنّ الموضعَ الجديدَ **مصيَّرٌ في المرحلة** —
   فملفٌّ لا تناديه شاشةٌ ليس نقلا بل حذفا. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const WS = 'src/pages/trainer/CohortWorkspace.tsx'
const OPS = 'src/pages/trainer/CohortOps.tsx'
const SESSIONS = 'src/pages/trainer/SessionsAndAttendance.tsx'

/** نصُّ مرحلة «لقاءات مباشرة» — من شرطِ تصييرها إلى شرطِ التي تليها */
function sessionsStage(src: string): string {
  const from = src.indexOf('stage === "sessions" &&')
  const to = src.indexOf('stage === "assignments" &&')
  expect(from, 'لا مرحلةَ لقاءات').toBeGreaterThan(-1)
  expect(to, 'لا مرحلةَ تكاليف بعدها').toBeGreaterThan(from)
  return src.slice(from, to)
}

describe('اللقاءُ وحضورُه في مرحلةٍ واحدة', () => {
  it('نداءُ تسجيل الحضور غادر التشغيلَ ولم يبقَ له أثرٌ عامل', () => {
    const ops = code(OPS)
    expect(ops, 'تسجيلُ الحضور ما زال في التشغيل').not.toContain('/attendance')
    expect(ops, 'شبكةُ الحضور ما زالت في التشغيل').not.toContain('ATTENDANCE_OPTIONS')
    /* واقتراحُ التأجيل تبع لقاءَه */
    expect(ops, 'اقتراحُ التأجيل ما زال في التشغيل').not.toContain('/reschedule')
  })

  it('وهو في ملفّه الجديد كاملا — حضورا ونقلا واجتماعا', () => {
    /* كان البندُ الثالثُ «تأجيلا» ويفحص `/reschedule`. وانعكس القرارُ
       (١٧ سبتمبر ٢٠٢٦): «يغيّرُه فيرجع لانتظار الإدارة» — فالمدرّبُ ينقل
       بنفسه ولا يقترح، والبابُ القديمُ ذهب. والفحصُ على الفعل الجديد. */
    const s = code(SESSIONS)
    expect(s).toContain('/attendance')
    expect(s).toContain('ATTENDANCE_OPTIONS.map')
    expect(s, 'نقلُ الموعد ليس في بطاقة اللقاء').toMatch(/apiPatch\(`\/api\/trainer\/sessions\//)
    expect(s, 'وحذفُه كذلك — والشاشةُ كانت تأمر به بلا باب').toMatch(/apiDelete\(`\/api\/trainer\/sessions\//)
    expect(s, 'رابطُ الاجتماع لا يُفتح من بطاقة اللقاء').toContain('s.zoom')
  })

  it('والمرحلةُ تُصيّره فعلا — لا ملفٌّ بلا شاشة', () => {
    const stage = sessionsStage(code(WS))
    expect(stage, 'المرحلةُ لا تُصيّر اللقاءاتِ والحضور').toContain('<SessionsAndAttendance')
    expect(stage, 'ولا نموذجَ الجدولة').toContain('<TrainerSchedule')
    expect(code(WS), 'الاستيرادُ مفقود').toContain('from "./SessionsAndAttendance"')
  })

  /* ═══ قائمةٌ واحدةٌ للقاءات في المرحلة ═══

     كانت في المرحلة لوحةٌ ثانيةٌ («الجلسات المسجّلة — من رابط») تُعيد سردَ
     `ws.sessions` لتُلصق رابطَ تسجيل. فبعد النقل صار في الشاشة الواحدة
     سردان للقاءاتِ الشعبة نفسِها — وهو عينُ الكثافة التي شكا منها صاحبُ
     المنصّة. فنزل حقلُ الرابط إلى بطاقة اللقاء، وسقطت اللوحة. */
  it('ولا سردان للقاءات في شاشةٍ واحدة', () => {
    const stage = sessionsStage(code(WS))
    expect(stage, 'المرحلةُ تسرد اللقاءاتِ بنفسها فوقَ سردِ المكوّن').not.toContain('ws.sessions.map')
    /* ═══ وحقلُ رابط التسجيل أُغلق بالكلّيّة (١٧ سبتمبر ٢٠٢٦) ═══

       كان الحارسُ يطلب نزولَه إلى بطاقة اللقاء. وسأل صاحبُ المنصّة: «ما
       الرابطُ الذي تتوقّعه منه وأنت تعلم أنّ التدريبَ من خلال زووم خاصٍّ
       فينا؟» — وضرَرُه أكبرُ من سؤالٍ زائد: هو الخانةُ الوحيدةُ في الشاشة
       التي تقبل رابطا، فيلصق فيها من يملك زووم خاصًّا رابطَ اجتماعه هو
       فيصل المتعلّمين. فذهب من الشاشتَين معا. */
    expect(stage, 'لوحةُ التسجيلات ما زالت تُسرد على حدة').not.toContain('recording-link')
    expect(code(SESSIONS), 'خانةُ رابط التسجيل عادت إلى بطاقة اللقاء').not.toContain('/recording-link')
  })

  /* نقلٌ لا نسخ: نداءٌ واحدٌ لتسجيل الحضور في بوّابة المدرّب كلِّها. */
  it('ولا نسختان من شبكة الحضور في بوّابة المدرّب', () => {
    const screens = ['CohortOps', 'CohortWorkspace', 'SessionsAndAttendance', 'CohortBoard', 'TrainerSchedule', 'Schedule']
      .map((n) => `src/pages/trainer/${n}.tsx`)
      .filter((p) => {
        try { readFileSync(join(root, p)); return true } catch { return false }
      })
    const holders = screens.filter((p) => /sessions\/\$\{[^}]+\}\/attendance/.test(code(p)))
    expect(holders, `شبكةُ الحضور في أكثرَ من شاشة:\n${holders.join('\n')}`).toHaveLength(1)
  })
})
