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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LEARNER_SESSION_WHERE, sessionApproved } from '../../../server/services/session-visibility'

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
  const next = rest.indexOf('\n  async ')
  return next < 0 ? rest : rest.slice(0, next)
}
const SCHED = code('src/pages/trainer/TrainerSchedule.tsx')

describe('① البوّابةُ واحدةٌ — ولا تُنسَخ بيدٍ في كلّ موضع', () => {
  it('المعتمَدُ وحدَه يُقرأ للمتعلّم', () => {
    expect(LEARNER_SESSION_WHERE).toEqual({ approvalState: 'approved' })
  })

  it('⚠️ والفارغُ معتمَدٌ — فالترحيلُ لا يسحب لقاءً من تقويم أحد', () => {
    /* صفوفُ ما قبل العمود لقاءاتٌ معلَنةٌ يحضرها الناسُ فعلا. ولو عُدَّت
       منتظِرةً لاختفت كلُّها في لحظةِ ترحيلٍ واحدة. */
    expect(sessionApproved({}), 'صفٌّ قديمٌ عُدَّ غيرَ معتمَد').toBe(true)
    expect(sessionApproved({ approvalState: null })).toBe(true)
    expect(sessionApproved({ approvalState: 'approved' })).toBe(true)
    expect(sessionApproved({ approvalState: 'pending' })).toBe(false)
    expect(sessionApproved({ approvalState: 'rejected' })).toBe(false)
  })

  it('والافتراضُ في المخطّط `approved` لا `pending` — وهو ما يقرّر مصيرَ القائم', () => {
    const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8')
    const model = schema.slice(schema.indexOf('model CohortSession'))
    const body = model.slice(0, model.indexOf('\n}'))
    expect(body, 'لا عمودَ لموقف الإدارة').toMatch(/approvalState\s+String\s+@default\("approved"\)/)
    expect(body, 'نيّةُ الاجتماع ليست عمودا صريحا').toMatch(/wantsMeeting\s+Boolean\s+@default\(true\)/)
    /* والنبذةُ والمرفقُ — «يحدّد نبذةً عنه، ويرفق أيَّ ملفٍّ يريد» */
    expect(body).toMatch(/noteAr\s+String\?/)
    expect(body).toMatch(/attachmentKey\s+String\?/)
    /* والترحيلُ يحمل الافتراضَ نفسَه — ولو خالفه لسحب اللقاءات القائمة */
    const sql = readFileSync(join(root, 'prisma/migrations/20260915120000_session_approval/migration.sql'), 'utf8')
    expect(sql).toMatch(/"approvalState" TEXT NOT NULL DEFAULT 'approved'/)
  })

  it('⚠️ وكلُّ موضعٍ يقرأ اللقاءاتِ للمتعلّم يمرّ بالبوّابة', () => {
    /* الفحصُ على **الاستيراد والاستعمال** معا: شرطٌ منسوخٌ بيدٍ يمرّ اليومَ
       ويفترق غدا عن الموضع الواحد — وهي علّةُ `trainer-visibility` نفسُها. */
    for (const p of [
      'server/services/enrollment.service.ts',
      'server/services/deadlines.service.ts',
      'server/services/progress.service.ts',
      'server/services/public-catalog.service.ts',
    ]) {
      const src = code(p)
      expect(src, `${p}: البوّابةُ غيرُ مستوردة`).toMatch(/import \{ LEARNER_SESSION_WHERE \} from '\.\/session-visibility'/)
      expect(src, `${p}: البوّابةُ مستوردةٌ ولا تُستعمَل`).toMatch(/LEARNER_SESSION_WHERE[,\s}]/)
    }
  })
})

describe('② المدرّبُ يجدول منتظِرا — ولا يُنشأ اجتماعٌ ولا يُبلَّغ أحد', () => {
  const fn = COHORT_SVC.slice(COHORT_SVC.indexOf('async trainerAddSessionWithMeeting'))
  const body = fn.slice(0, fn.indexOf('\n  async decideSession'))

  it('⚠️ يُكتب `pending` صراحةً — وكان يُنشَر لحظتَه', () => {
    expect(body, 'اللقاءُ يُجدوَل معتمَدا').toContain("approvalState: 'pending'")
  })

  it('⚠️ ولا يُنادى `addSessionWithMeeting` — فذاك يُنشئ الاجتماعَ ويُبلّغ معا', () => {
    expect(body, 'ما زال يُنشئ الاجتماعَ ويُبلّغ لحظتَه').not.toContain('addSessionWithMeeting(')
    expect(body, 'ما زال يُبلّغ المسجَّلين قبل الاعتماد').not.toContain('notifyCohortOfSession')
  })

  it('⚠️ وبابُ المدرّب الآخرُ ينتظر كذلك — لا بابان بحكمَين', () => {
    /* `trainerAddSession` لا مسلكَ ينادي اليوم، لكنّها **بابُ مدرّبٍ** بحكم
       اسمها وفحصِها. ولو تركت تكتب `approved` لصار في الخدمة بابان لمدرّبٍ
       واحد: أحدُهما ينتظر قرارا والآخرُ يُعلن لحظتَه — ومن وصل الثاني
       بمسلكٍ يوما لم يكن ليعلم أنّه تخطّى بوّابة.

       والحارسُ هنا لأنّ العطبَ **لا يظهر في شاشةٍ ولا في اختبارٍ قائم**:
       اختبارُ النافذة يقيس المدى والسقفَ ولا يسأل عن الاعتماد. */
    const body = methodBody(COHORT_SVC, 'async trainerAddSession(userId')
    expect(body, 'لم يُعثَر على بابِ المدرّب الآخر').not.toBe('')
    expect(body, 'بابُ المدرّب الآخرُ يُعلن لحظتَه').toContain("approvalState: 'pending'")
  })

  it('وبابُ الإدارة يبقى معتمَدا بحكم من جدوله', () => {
    /* والافتراضُ في `addSession` نفسِها `approved`: ما جدولته الإدارةُ
       معتمَدٌ، فالنداءاتُ الإداريّةُ لا تُبدّل ولا تنتظر نفسَها. */
    const body = methodBody(COHORT_SVC, 'async addSession(actorId')
    expect(body, 'لم يُعثَر على بابِ الإدارة').not.toBe('')
    expect(body).toMatch(/approvalState: input\.approvalState \?\? 'approved'/)
  })

  it('والإدارةُ تُبلَّغ بأنّ لقاءً ينتظرها', () => {
    expect(body).toMatch(/notifyRole\([\s\S]{0,120}'academic_manager', 'super_admin'/)
    expect(body).toContain("templateKey: 'cohort.session.pending'")
  })

  it('ولا يُقال «بُلِّغ ٠ متعلّما» — رقمٌ صادقٌ يُقرأ عطبا', () => {
    expect(body).toMatch(/notified: 0/)
    expect(SCHED, 'الشاشةُ تَعِد بتبليغٍ لم يقع').toContain('أُرسل اللقاءُ للاعتماد')
  })
})

describe('③ وبالاعتماد يقع كلُّ شيء — بترتيبٍ لا يترك موعدا بلا باب', () => {
  const fn = COHORT_SVC.slice(COHORT_SVC.indexOf('async decideSession'))
  const body = fn.slice(0, fn.indexOf('\n  /** اللقاءاتُ المنتظِرةُ'))

  it('⚠️ الاجتماعُ يُنشأ **قبل** ختم الاعتماد', () => {
    /* إنشاءُ الاجتماع قد يسقط (مفاتيحُ ناقصةٌ أو Zoom لا يستجيب). فلو خُتم
       الاعتمادُ أوّلا لبقي لقاءٌ «معتمَدٌ» بلا اجتماع — موعدٌ بلا باب يقف
       عنده المسجَّلون. */
    const attach = body.indexOf('attachApiZoom')
    const stamp = body.indexOf("approvalState: 'approved'")
    expect(attach, 'لا يُنشأ اجتماعٌ عند الاعتماد').toBeGreaterThan(-1)
    expect(stamp, 'لا يُختم الاعتماد').toBeGreaterThan(-1)
    expect(attach, 'الختمُ يسبق إنشاءَ الاجتماع').toBeLessThan(stamp)
  })

  it('ثمّ يُبلَّغ المسجَّلون — بعد الختم لا قبله', () => {
    const stamp = body.indexOf("approvalState: 'approved'")
    const notify = body.indexOf('notifyCohortOfSession')
    expect(notify, 'لا يُبلَّغ المسجَّلون بالاعتماد').toBeGreaterThan(-1)
    expect(stamp, 'يُبلَّغون قبل أن يُختم الاعتماد').toBeLessThan(notify)
  })

  it('و«الحضوريُّ» لا يُنشأ له اجتماع — النيّةُ محفوظةٌ منذ الجدولة', () => {
    expect(body).toMatch(/if \(!zoom && session\.wantsMeeting\)/)
  })

  it('والمردودُ يُلغى ويصل مدرّبَه بعلّته — لا يُردّ بلا سبب', () => {
    expect(body).toContain("approvalState: 'rejected'")
    expect(body, 'المردودُ يبقى في الجدول حيًّا').toContain("status: 'cancelled'")
    expect(body).toContain("templateKey: 'cohort.session.rejected'")
  })

  it('ولا يُقرَّر في لقاءٍ قُرِّر فيه — فلا يُبلَّغ المسجَّلون مرّتين', () => {
    expect(body).toMatch(/if \(session\.approvalState !== 'pending'\)/)
  })
})

describe('④ الشاشتان: نموذجٌ بساعتَين ونبذةٍ ومرفق، وطابورُ الإدارة القائم', () => {
  it('⚠️ ساعةُ البدء وساعةُ الانتهاء كلتاهما — لا مدّةٌ تُفترض', () => {
    expect(SCHED).toContain('من الساعة')
    expect(SCHED).toContain('إلى الساعة')
    expect(SCHED, 'ما زالت المدّةُ مفترضةً في حالة النموذج').not.toMatch(/hours: "2"/)
    /* والخادمُ يُلزِم بها — فلا تُرسَل بلا نهايةٍ من عميلٍ قديم */
    const routes = code('server/http/routes/learning-portal.routes.ts')
    const r = routes.slice(routes.indexOf("'/api/trainer/cohorts/:id/sessions'"))
    expect(r.slice(0, 1400), 'النهايةُ ما زالت اختياريّة').toMatch(/endsAt: z\.coerce\.date\(\),/)
    expect(r.slice(0, 1400), 'لا يُردّ لقاءٌ ينتهي قبل أن يبدأ').toContain('نهايةُ اللقاء قبل بدايته')
  })

  it('والنبذةُ والمرفقُ يُرسلان معه', () => {
    expect(SCHED).toMatch(/attachmentKey: attachment\.bodyFileKey/)
    expect(SCHED).toContain('ملفٌّ يُرفق باللقاء (اختياريّ)')
  })

  it('والمدى من الفصل — لا يُجدوَل خارجَ أشهره', () => {
    expect(SCHED).toMatch(/min=\{day\(win\.start\)\} max=\{day\(win\.end\)\}/)
  })

  it('والحدُّ الأدنى يُقال قبل ردِّ الاعتماد — لقاءٌ لكلّ محور', () => {
    expect(SCHED).toMatch(/const short = Math\.max\(0, minSessions - haveSessions\)/)
    expect(code('src/pages/trainer/CohortWorkspace.tsx'))
      .toMatch(/minSessions=\{Math\.max\(1, content\.modules\.length\)\}/)
  })

  it('والقرارُ في طابور الإدارة القائم — لا شاشةٌ ثانيةٌ يُنسى فتحُها', () => {
    const admin = code('src/pages/admin/CohortOps.tsx')
    expect(admin, 'لا طابورَ للقاءات في شاشة الشعبة').toContain('/api/admin/cohort-sessions/pending')
    expect(admin).toMatch(/cohort-sessions\/\$\{ps\.id\}\/decide/)
    /* ويُقال على الزرّ ما يُطلقه — من يعتمد يعرف أنّه يُعلن ويُرسل بريدا */
    expect(admin).toContain('باعتمادك يُنشأ اجتماعُ Zoom')
    /* وبصلاحيّة اعتماد الخطّة نفسِها: صلاحيّتان لعملٍ واحدٍ تُمنح لأحدهما وتُنسى للآخر */
    const routes = code('server/http/routes/admin-learning.routes.ts')
    const at = routes.indexOf("'/api/admin/cohort-sessions/:id/decide'")
    expect(at, 'لا مسلكَ للقرار').toBeGreaterThan(0)
    expect(routes.slice(at, at + 300)).toContain("requirePermission('cohort.plan.approve')")
  })
})
