/* ═══ لا يُعلَن لقاءٌ حتّى تعتمده الإدارة ═══

   نصُّ صاحب المنصّة (١٥ سبتمبر ٢٠٢٦): «يُعطى خيارَ إنشاء جلساتٍ مباشرةٍ من
   خلال إنشاء اجتماعٍ جديدٍ مربوطٍ بحساب زووم الخاصّ بنا، ويحدّد أيَّ ساعةٍ
   وإلى أيّ ساعةٍ والتاريخَ واليوم، ويحدّد نبذةً عنه، ويرفق أيَّ ملفٍّ يريد
   اختياريّ. وبعدها الإدارةُ توافق، ويصبح هناك جلسةُ زووم لايف تُنشَر في
   منصّة الطلبة بتاريخها، ويُرسَل إيميلٌ للطلاب بالاجتماع وللإدارة».
   وموضعُ القرار: «الموافقةُ في طابور الإدارة الحالي».

   وكان اللقاءُ يُعلَن لحظةَ إنشائه: `addSessionWithMeeting` ينشئ الاجتماعَ
   ويُبلّغ المسجَّلين في النداء نفسِه. فخطأٌ في تاريخٍ يصل عشرين إنسانا قبل
   أن يُقرأ، ولا سبيلَ إلى سحبه.

   ── وأخطرُ ما هنا التسرّبُ الصامت ──

   اللقاءاتُ تُقرأ في أكثرَ من عشرة مواضع: رحلةُ المتعلّم، وتقويمُه،
   ومواعيدُه، وتقدّمُه، وصفحةُ الشعبة العامّة. ولو نُسي الشرطُ في واحدٍ
   منها عُرض للمتعلّم موعدٌ لم يُعتمَد ولن يُعقَد — **ولا يسقط شيء**، فلا
   يكتشفه إلّا من حضر في وقتٍ لم يأتِ فيه أحد.

   فالبوّابةُ واحدةٌ مشتركة (`session-visibility.ts`) لا شرطٌ يُنسَخ، وهذا
   الملفُّ يحرس أن تكون مستعمَلةً في كلّ موضعٍ يقرأ للمتعلّم. */
import { readFileSync as readRaw } from 'node:fs'
import { plainAr } from '@/application/text/plain-ar'
/* ما يُقرأ من الملفّات بلا تشكيلٍ إعرابيّ — بعضُها بعد «اللغة البيضاء» وبعضُها (العقود والخادم) قبلها */
function readFileSync(p: Parameters<typeof readRaw>[0]): Buffer
function readFileSync(p: Parameters<typeof readRaw>[0], e: BufferEncoding | { encoding: BufferEncoding }): string
function readFileSync(p: Parameters<typeof readRaw>[0], e?: BufferEncoding | { encoding: BufferEncoding }): string | Buffer {
  return e === undefined ? readRaw(p) : plainAr(String(readRaw(p, e)))
}
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LEARNER_SESSION_WHERE, TRAINER_OWN_SESSION_WHERE, sessionApproved } from '../../../server/services/session-visibility'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*(\/\/|--).*$/gm, '')

const COHORT_SVC = code('server/services/cohort.service.ts')

/** جسدُ دالّةٍ من الخدمة — من توقيعها إلى الدالّة التي تليها.

    ولا يُقَصُّ عند أوّل `\n  }`: توقيعُ هذه الدوالّ يحمل نوعا كائنيًّا
    ينتهي بـ`\n  }) {`، فالقصُّ عنده يقطع **قبل الجسد** — فيقرأ الحارسُ
    توقيعا ويحكم على جسدٍ لم يره. */
function methodBody(src: string, signature: string): string {
  const at = src.indexOf(signature)
  if (at < 0) return ''
  const rest = src.slice(at + signature.length)
  /* ═══ يُقطَع عند أوّلِ عضوٍ تالٍ في الصنف — عامًّا كان أو خاصًّا ═══

     كان يقطع عند `\n  async ` وحدَها. فلمّا جُمع نداءُ الطابور في دالّةٍ
     **خاصّة** (١٧ سبتمبر ٢٠٢٦) صار متنُ الدالّة السابقة يبتلعها، فيمرّ
     فحصٌ عليها وهو يظنّ نفسَه يفحص متنَ غيرِها — وذاك حارسٌ أخضرُ لسببٍ
     خاطئ، وقد مرّ منه ثلاثةٌ في هذه المنصّة.

     وأعضاءُ الصنف وحدَها على مسافة مسافتَين؛ وما في المتون على أربعٍ فأكثر. */
  const next = rest.search(/\n {2}(?:private |protected |static )*(?:async )?[A-Za-z_$][\w$]*\s*\(/)
  return next < 0 ? rest : rest.slice(0, next)
}
const SCHED = code('src/pages/trainer/TrainerSchedule.tsx')
const DEADLINES = code('server/services/deadlines.service.ts')
const SCHEDULE_PAGE = code('src/pages/trainer/Schedule.tsx')

describe('① البوّابة واحدة — ولا تنسخ بيد في كلّ موضع', () => {
  it('المعتمد وحده يقرأ للمتعلّم', () => {
    expect(LEARNER_SESSION_WHERE).toEqual({ approvalState: 'approved' })
  })

  it('⚠️ والفارغ معتمد — فالترحيل لا يسحب لقاء من تقويم أحد', () => {
    /* صفوفُ ما قبل العمود لقاءاتٌ معلَنةٌ يحضرها الناسُ فعلا. ولو عُدَّت
       منتظِرةً لاختفت كلُّها في لحظةِ ترحيلٍ واحدة. */
    expect(sessionApproved({}), 'صفّ قديم عدّ غير معتمد').toBe(true)
    expect(sessionApproved({ approvalState: null })).toBe(true)
    expect(sessionApproved({ approvalState: 'approved' })).toBe(true)
    expect(sessionApproved({ approvalState: 'pending' })).toBe(false)
    expect(sessionApproved({ approvalState: 'rejected' })).toBe(false)
  })

  it('والافتراض في المخطّط `approved` لا `pending` — وهو ما يقرّر مصير القائم', () => {
    const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8')
    const model = schema.slice(schema.indexOf('model CohortSession'))
    const body = model.slice(0, model.indexOf('\n}'))
    expect(body, 'لا عمود لموقف الإدارة').toMatch(/approvalState\s+String\s+@default\("approved"\)/)
    expect(body, 'نيّة الاجتماع ليست عمودا صريحا').toMatch(/wantsMeeting\s+Boolean\s+@default\(true\)/)
    /* والنبذةُ والمرفقُ — «يحدّد نبذةً عنه، ويرفق أيَّ ملفٍّ يريد» */
    expect(body).toMatch(/noteAr\s+String\?/)
    expect(body).toMatch(/attachmentKey\s+String\?/)
    /* والترحيلُ يحمل الافتراضَ نفسَه — ولو خالفه لسحب اللقاءات القائمة */
    const sql = readFileSync(join(root, 'prisma/migrations/20260915120000_session_approval/migration.sql'), 'utf8')
    expect(sql).toMatch(/"approvalState" TEXT NOT NULL DEFAULT 'approved'/)
  })

  it('⚠️ وكلّ موضع يقرأ اللقاءات للمتعلّم يمرّ بالبوّابة', () => {
    /* الفحصُ على **الاستيراد والاستعمال** معا: شرطٌ منسوخٌ بيدٍ يمرّ اليومَ
       ويفترق غدا عن الموضع الواحد — وهي علّةُ `trainer-visibility` نفسُها. */
    for (const p of [
      'server/services/enrollment.service.ts',
      'server/services/progress.service.ts',
      'server/services/public-catalog.service.ts',
    ]) {
      const src = code(p)
      expect(src, `${p}: البوّابة غير مستوردة`).toMatch(/import \{ LEARNER_SESSION_WHERE \} from '\.\/session-visibility'/)
      expect(src, `${p}: البوّابة مستوردة ولا تستعمل`).toMatch(/LEARNER_SESSION_WHERE[,\s}]/)
    }
  })
})

describe('⑴ب وجدول المدرّب ليس شاشة متعلّم — بوّابة ثانية لا الأولى', () => {
  /* كان `deadlines.service.ts` في قائمة الحارس أعلاه، ويمرّ بها — **بالسطر
     الذي هو العطبُ نفسُه**: استعمالُه الوحيدُ لبوّابة المتعلّم كان في
     `forTrainer`، أي في جدول المدرّب لا في مواعيد المتعلّم. فكان حارسا
     أخضرَ لسببٍ خاطئ، وهو صنفُ ما وقع في هذه المنصّة غيرَ مرّة.

     فخرج الملفُّ من تلك القائمة (مواعيدُ المتعلّم فيه لا تقرأ لقاءً أصلا،
     وهذا محروسٌ أدناه)، وصار له حارسُه على **متن الدالّة** لا على الملفّ. */

  it('بوّابة المدرّب: كلّ ما جدوله ولم يردّ', () => {
    expect(TRAINER_OWN_SESSION_WHERE).toEqual({ approvalState: { not: 'rejected' } })
  })

  it('⚠️ ومتن `forTrainer` لا يحمل شرط المتعلّم — وكان يحمله', () => {
    const body = methodBody(DEADLINES, 'async forTrainer(userId: string, now = new Date(), days = 30) {')
    expect(body, 'لم يعثر على متن الدالّة — فالحارس يحكم على فراغ').not.toBe('')
    expect(body, 'جدول المدرّب ما زال يقرأ بشرط المتعلّم').not.toContain('LEARNER_SESSION_WHERE')
    expect(body, 'يقرأ الجلسات بلا بوّابة مسمّاة').toContain('TRAINER_OWN_SESSION_WHERE')
    expect(DEADLINES, 'البوّابة غير مستوردة').toMatch(/import \{ TRAINER_OWN_SESSION_WHERE \} from '\.\/session-visibility'/)
  })

  it('⚠️ والموقف يرجع مع الصفّ — فالشاشة تقول «منتظرة» ولا تخمّن', () => {
    const body = methodBody(DEADLINES, 'async forTrainer(userId: string, now = new Date(), days = 30) {')
    expect(body, 'العمود غير مقروء من قاعدة البيانات').toContain('approvalState: true')
    expect(body, 'مقروء ولا يرجع في الصفّ').toContain('approvalState: s.approvalState')
    /* والشاشةُ تعلنه في نوعها وتعرضه — لا يكفي أن يصل */
    expect(SCHEDULE_PAGE, 'الشاشة لا تعلن الحقل في نوعها').toMatch(/approvalState:\s*string/)
    const at = SCHEDULE_PAGE.indexOf('s.approvalState === "pending"')
    expect(at, 'لا شارة للمنتظرة في جدوله').toBeGreaterThan(-1)
    expect(SCHEDULE_PAGE.slice(at, at + 400)).toContain('بانتظار اعتماد الإدارة')
  })

  it('ومواعيد المتعلّم في الملفّ نفسه لا تقرأ لقاء — ولو قرأت لعادت بوّابته', () => {
    const body = methodBody(DEADLINES, 'async forLearner(userId: string, now = new Date()) {')
    expect(body, 'لم يعثر على متن الدالّة').not.toBe('')
    expect(body, 'صارت تقرأ الجلسات — فلتمرّ ببوّابة المتعلّم ولتعد إلى قائمة الحارس')
      .not.toMatch(/sessions\s*:\s*\{/)
  })
})

describe('② المدرّب يجدول منتظرا — ولا ينشأ اجتماع ولا يبلّغ أحد', () => {
  const fn = COHORT_SVC.slice(COHORT_SVC.indexOf('async trainerAddSessionWithMeeting'))
  const body = fn.slice(0, fn.indexOf('\n  async decideSession'))

  it('⚠️ يكتب `pending` صراحة — وكان ينشر لحظته', () => {
    expect(body, 'اللقاء يجدول معتمدا').toContain("approvalState: 'pending'")
  })

  it('⚠️ ولا ينادى `addSessionWithMeeting` — فذاك ينشئ الاجتماع ويبلّغ معا', () => {
    expect(body, 'ما زال ينشئ الاجتماع ويبلّغ لحظته').not.toContain('addSessionWithMeeting(')
    expect(body, 'ما زال يبلّغ المسجّلين قبل الاعتماد').not.toContain('notifyCohortOfSession')
  })

  it('⚠️ وباب المدرّب الآخر ينتظر كذلك — لا بابان بحكمين', () => {
    /* `trainerAddSession` لا مسلكَ ينادي اليوم، لكنّها **بابُ مدرّبٍ** بحكم
       اسمها وفحصِها. ولو تركت تكتب `approved` لصار في الخدمة بابان لمدرّبٍ
       واحد: أحدُهما ينتظر قرارا والآخرُ يُعلن لحظتَه — ومن وصل الثاني
       بمسلكٍ يوما لم يكن ليعلم أنّه تخطّى بوّابة.

       والحارسُ هنا لأنّ العطبَ **لا يظهر في شاشةٍ ولا في اختبارٍ قائم**:
       اختبارُ النافذة يقيس المدى والسقفَ ولا يسأل عن الاعتماد. */
    const body = methodBody(COHORT_SVC, 'async trainerAddSession(userId')
    expect(body, 'لم يعثر على باب المدرّب الآخر').not.toBe('')
    expect(body, 'باب المدرّب الآخر يعلن لحظته').toContain("approvalState: 'pending'")
  })

  it('وباب الإدارة يبقى معتمدا بحكم من جدوله', () => {
    /* والافتراضُ في `addSession` نفسِها `approved`: ما جدولته الإدارةُ
       معتمَدٌ، فالنداءاتُ الإداريّةُ لا تُبدّل ولا تنتظر نفسَها. */
    const body = methodBody(COHORT_SVC, 'async addSession(actorId')
    expect(body, 'لم يعثر على باب الإدارة').not.toBe('')
    expect(body).toMatch(/approvalState: input\.approvalState \?\? 'approved'/)
  })

  it('⚠️ والإدارة تبلّغ بأنّ لقاء ينتظرها — من كلّ باب يدخله الطابور', () => {
    /* كان الفحصُ على نصِّ `notifyRole` مكتوبا في هذا المتن. ثمّ صار للطابور
       **بابان** بقرار صاحب المنصّة (١٧ سبتمبر ٢٠٢٦): جدولةٌ جديدة، ولقاءٌ
       معتمَدٌ نُقل فسقط إلى الانتظار. فجُمع النداءُ في موضعٍ واحدٍ يقرؤه
       البابان.

       والحارسُ يتبع القاعدةَ لا موضعَها: **البابان كلاهما** ينادِيان
       النداءَ الواحد، والنداءُ يبلّغ الدورَين بالمفتاح المعلوم. ولو نُسي
       أحدُ البابَين سقط — وهو أقوى ممّا كان يحرسه أوّلا، إذ كان بابٌ واحد. */
    expect(body, 'باب الجدولة لا يدخل الطابور أحدا')
      .toMatch(/notifyAdminsOfPendingSession\(/)

    const moved = methodBody(COHORT_SVC, 'async trainerMoveSession(userId')
    expect(moved, 'لم يعثر على باب النقل').not.toBe('')
    expect(moved, 'المنقول يسقط إلى الانتظار ولا يعلم به أحد في الإدارة')
      .toMatch(/notifyAdminsOfPendingSession\(/)

    const tell = methodBody(COHORT_SVC, 'private async notifyAdminsOfPendingSession(')
    expect(tell, 'لم يعثر على النداء الواحد').not.toBe('')
    expect(tell).toMatch(/notifyRole\([\s\S]{0,120}'academic_manager', 'super_admin'/)
    expect(tell).toContain("templateKey: 'cohort.session.pending'")
  })

  it('⚠️ والمنقول المعتمد يقال لمتعلّميه — لا يختفي من تقويمهم صامتا', () => {
    /* أخطرُ ما يُحدثه قرارُ ١٧ سبتمبر: لقاءٌ كان معتمَدا يسقط إلى الانتظار
       فيغيب عن شاشات المسجَّلين. ولو مرّ صامتا لَحضر متعلّمٌ في وقتٍ لا
       أحدَ فيه — وهو العطبُ الصامتُ الذي بُنيت له `session-visibility.ts`. */
    const moved = methodBody(COHORT_SVC, 'async trainerMoveSession(userId')
    expect(moved, 'المنقول يختفي من تقويم متعلّميه بلا كلمة')
      .toMatch(/tellCohortScheduleChanged\(/)

    const tell = methodBody(COHORT_SVC, 'private async tellCohortScheduleChanged(')
    expect(tell, 'لم يعثر على نداء المتعلّمين').not.toBe('')
    /* والمفتاحُ قائمٌ مسجَّلٌ في الوجهات والأصناف — لا مُخترَعٌ هنا */
    expect(tell).toContain("templateKey: 'cohort.schedule_changed'")
    expect(tell, 'يصل المنسحب خبر موعد لم يعد له').toMatch(/status: \{ not: 'dropped' \}/)
  })

  it('ولا يقال «بلّغ ٠ متعلّما» — رقم صادق يقرأ عطبا', () => {
    expect(body).toMatch(/notified: 0/)
    expect(SCHED, 'الشاشة تعد بتبليغ لم يقع').toContain('أرسل اللقاء للاعتماد')
  })
})

describe('③ وبالاعتماد يقع كلّ شيء — بترتيب لا يترك موعدا بلا باب', () => {
  const fn = COHORT_SVC.slice(COHORT_SVC.indexOf('async decideSession'))
  const body = fn.slice(0, fn.indexOf('\n  /** اللقاءات المنتظرة'))

  it('⚠️ الاجتماع ينشأ **قبل** ختم الاعتماد', () => {
    /* إنشاءُ الاجتماع قد يسقط (مفاتيحُ ناقصةٌ أو Zoom لا يستجيب). فلو خُتم
       الاعتمادُ أوّلا لبقي لقاءٌ «معتمَدٌ» بلا اجتماع — موعدٌ بلا باب يقف
       عنده المسجَّلون. */
    const attach = body.indexOf('attachApiZoom')
    const stamp = body.indexOf("approvalState: 'approved'")
    expect(attach, 'لا ينشأ اجتماع عند الاعتماد').toBeGreaterThan(-1)
    expect(stamp, 'لا يختم الاعتماد').toBeGreaterThan(-1)
    expect(attach, 'الختم يسبق إنشاء الاجتماع').toBeLessThan(stamp)
  })

  it('ثمّ يبلّغ المسجّلون — بعد الختم لا قبله', () => {
    const stamp = body.indexOf("approvalState: 'approved'")
    const notify = body.indexOf('notifyCohortOfSession')
    expect(notify, 'لا يبلّغ المسجّلون بالاعتماد').toBeGreaterThan(-1)
    expect(stamp, 'يبلّغون قبل أن يختم الاعتماد').toBeLessThan(notify)
  })

  it('و«الحضوريّ» لا ينشأ له اجتماع — النيّة محفوظة منذ الجدولة', () => {
    expect(body).toMatch(/if \(!zoom && session\.wantsMeeting\)/)
  })

  it('والمردود يلغى ويصل مدرّبه بعلّته — لا يردّ بلا سبب', () => {
    expect(body).toContain("approvalState: 'rejected'")
    expect(body, 'المردود يبقى في الجدول حيّا').toContain("status: 'cancelled'")
    expect(body).toContain("templateKey: 'cohort.session.rejected'")
  })

  it('ولا يقرّر في لقاء قرّر فيه — فلا يبلّغ المسجّلون مرّتين', () => {
    expect(body).toMatch(/if \(session\.approvalState !== 'pending'\)/)
  })
})

describe('④ الشاشتان: نموذج بساعتين ونبذة ومرفق، وطابور الإدارة القائم', () => {
  it('⚠️ ساعة البدء وساعة الانتهاء كلتاهما — لا مدّة تفترض', () => {
    expect(SCHED).toContain('من الساعة')
    expect(SCHED).toContain('إلى الساعة')
    expect(SCHED, 'ما زالت المدّة مفترضة في حالة النموذج').not.toMatch(/hours: "2"/)
    /* والخادمُ يُلزِم بها — فلا تُرسَل بلا نهايةٍ من عميلٍ قديم */
    const routes = code('server/http/routes/learning-portal.routes.ts')
    const r = routes.slice(routes.indexOf("'/api/trainer/cohorts/:id/sessions'"))
    expect(r.slice(0, 1400), 'النهاية ما زالت اختياريّة').toMatch(/endsAt: z\.coerce\.date\(\),/)
    expect(r.slice(0, 1400), 'لا يردّ لقاء ينتهي قبل أن يبدأ').toContain('نهاية اللقاء قبل بدايته')
  })

  it('والنبذة والمرفق يرسلان معه', () => {
    /* ═══ والفحصُ على متن النداء لا على سطرٍ بعينه ═══

       كان يطابق `attachmentKey: attachment.bodyFileKey` حرفا، فسقط حين
       جُمع النداءُ في دالّةٍ واحدةٍ تخدم اللقاءَ المفرد والسلسلةَ معا —
       والمرفقُ ما زال يُرسَل. فالفحصُ على **متن النداء**: أتحمل الحقولُ
       الأربعةُ مصادرَها؟ */
    const at = SCHED.indexOf('/api/trainer/cohorts/${cohortId}/sessions')
    expect(at, 'لا نداء إنشاء في الشاشة').toBeGreaterThan(0)
    const body = SCHED.slice(at, SCHED.indexOf('});', at))
    expect(body, 'النبذة لا ترسل').toContain('noteAr:')
    expect(body, 'مفتاح الملفّ لا يرسل').toMatch(/attachmentKey:[^\n]*attachment\.bodyFileKey/)
    expect(body, 'اسم الملفّ لا يرسل').toMatch(/attachmentName:[^\n]*attachment\.bodyFileName/)
    expect(body, 'نوع الملفّ لا يرسل').toMatch(/attachmentMime:[^\n]*attachment\.bodyFileMime/)
    expect(SCHED, 'لا حقل رفع في الشاشة').toContain('ملفّ يرفق باللقاء (اختياريّ)')

    /* ═══ والمرفقُ للمتفرّق وحدَه (١٨ سبتمبر ٢٠٢٦) ═══
       ملفٌّ واحدٌ يُنسخ على اثني عشرَ لقاءً يصير اثنتَي عشرةَ شريحةً
       متطابقةً في تقويم المتعلّم. وموضعُ ملفِّ كلِّ لقاءٍ صفحتُه بعد
       إنشائه، حيث يُقرأ مع سياقه. */
    const single = SCHED.indexOf('mode === "single" && (')
    expect(single, 'لا حارس وضع على حقل الرفع').toBeGreaterThan(-1)
    expect(SCHED.slice(single, single + 400), 'حقل الرفع ليس خلف حارس «متفرّق»')
      .toContain('ملفّ يرفق باللقاء')
  })

  /* ولا يومَ مضى (٢٠ أكتوبر ٢٠٢٦، «Block it»): أوّلُه اليومُ أو أوّلُ الفصل، أيُّهما بعد */
  it('والمدى من الفصل — لا يجدول خارج أشهره ولا في يوم مضى', () => {
    expect(SCHED).toMatch(/const firstDay = day\(win\.start\) > today \? day\(win\.start\) : today;/)
    expect(SCHED).toMatch(/min=\{firstDay\} max=\{day\(win\.end\)\}/)
  })

  it('والحدّ الأدنى يقال قبل ردّ الاعتماد — لقاء لكلّ محور', () => {
    expect(SCHED).toMatch(/const short = Math\.max\(0, minSessions - haveSessions\)/)
    expect(code('src/pages/trainer/CohortWorkspace.tsx'))
      .toMatch(/minSessions=\{Math\.max\(1, content\.modules\.length\)\}/)
  })

  it('والقرار في طابور الإدارة القائم — لا شاشة ثانية ينسى فتحها', () => {
    /* والطابورُ في مراجعة الخطّة — مكوّنٌ تعرضه بطاقةُ الشعبة و«خططٌ تنتظر اعتمادك» معا */
    const admin = code('src/components/admin/TrainerPlanReview.tsx')
    expect(admin, 'لا طابور للقاءات في شاشة الشعبة').toContain('/api/admin/cohort-sessions/pending')
    expect(admin).toMatch(/cohort-sessions\/\$\{ps\.id\}\/decide/)
    /* ويُقال على الزرّ ما يُطلقه — من يعتمد يعرف أنّه يُعلن ويُرسل بريدا */
    expect(admin).toContain('باعتمادك ينشأ اجتماع Zoom')
    /* وبصلاحيّة اعتماد الخطّة نفسِها: صلاحيّتان لعملٍ واحدٍ تُمنح لأحدهما وتُنسى للآخر */
    const routes = code('server/http/routes/admin-learning.routes.ts')
    const at = routes.indexOf("'/api/admin/cohort-sessions/:id/decide'")
    expect(at, 'لا مسلك للقرار').toBeGreaterThan(0)
    expect(routes.slice(at, at + 300)).toContain("requirePermission('cohort.plan.approve')")
  })
})
