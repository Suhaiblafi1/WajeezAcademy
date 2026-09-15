/* ما يمسّ إنسانا لا يُكتب في السجلّ وحدَه — ي-٣.

   ═══ السؤالُ الذي تركه ي-١ مفتوحا ═══

   `weight.ts` صنّف الأفعال، وقال في رأسه صراحةً إنّه **لا يعرف لمن يصل
   الخبر**: `actorId` هو الفاعلُ لا المعنيّ، و`entityType: 'user'` لا يقع
   إلّا في اثنَين وعشرين موضعا من نحو مئتَين وثلاثين، وفيها ما يكتب في
   `entityId` معرّفَ **دفعةٍ** لا معرّفَ إنسان.

   ═══ والجوابُ: لا يُضاف عمودٌ، ولا يُخمَّن مرسَلٌ إليه ═══

   المرسَلُ إليه **له مالكٌ قائمٌ بالفعل**: `NotificationService.notify`
   يشترط `userId`، ويسمّيه المُنادي الذي يعرف من المعنيّ. فإضافةُ
   `subjectUserId` إلى الأثر تصنع مالكا ثانيا لقاعدةٍ واحدة — ووزنٌ صادقٌ
   ومرسَلٌ إليه مخمَّنٌ يوصل خبرَ إيقافِ حسابٍ إلى الشخص الخطأ.

   فعملُ هذا الحارس أضيقُ وأصدق: **أن يثبت أنّ أحدا يُخبَر**، لا أن يقرّر
   من هو. فما كان وزنُه `high` — «تغيّر وصولُه أو مكانتُه أو مالُه أو
   سجلُّه» — لا يُكتب في معالِجٍ لا يُرسل فيه شيءٌ إلى أحد.

   ═══ ولمَ حدُّ المعالِج ═══

   جُرّب الملفُّ كلُّه فكذب: `admin-users.routes.ts` يرسل دعوةَ حسابٍ جديدٍ
   في معالِجٍ أوّل، فمرّ **إيقافُ الحساب** في معالِجٍ آخرَ أخضرَ وهو صامتٌ
   تماما — وهو أخطرُ فعلٍ في المعجم كلِّه. وجُرّب الجِوارُ بالحروف فحمّر ما
   ليس بعطب. والحدُّ في `helpers/audit-sites.ts` بنيويّ: المعالِجُ نفسُه.

   ═══ وخطُّ الأساس دَينٌ لا عذر ═══

   القياسُ يوم كُتب هذا: **اثنان وأربعون** فعلا عاليا في معالِجٍ صامت.
   وما دون القائمة يُحمّر البوّابة. وهي على عرف المستودَع: «تسقط على
   الدَّين الجديد ولا تجمّد الإصلاح» — ولا تُزاد لتمرّ.

   ولا تُقرأ القائمةُ على أنّها «صمتٌ مبرَّر»: فيها ما يصل صاحبَه من مُنادي
   الطريقة لا من الطريقة نفسِها، وفيها ما لا يصل أحدا البتّة. وتمييزُ
   هذا من ذاك يقع حين يُزال السطر — فلا يُزال إلّا بعد أن يخضرّ الفحصُ
   عليه، وذلك ما يجعل القائمةَ تنقص بالعمل لا بالقلم. */

import { describe, expect, it } from 'vitest'
import { auditSites, handlerAround, sourceOf } from './helpers/audit-sites'
import { auditWeightOf } from '@/application/audit/weight'

/* ═══ ما يُعَدّ بلوغا لإنسان ═══

   مجموعةٌ مغلقةٌ مسمّاة، وكلُّ اسمٍ فيها **يُحرَس بوجوده**: لو أُعيدت
   تسميةُ مُرسِلٍ ولم تُحدَّث القائمةُ لصارت المنصّةُ كلُّها «صامتة» دفعةً
   واحدة، وهو حمرةٌ كاذبةٌ تُعلَّم بالكسل: تُحدَّث القائمة. فيُحرَس الوجودُ
   أوّلا فيحمرّ الاسمُ وحدَه ويقول ما جرى. */
const REACHING: readonly { call: string; from: string }[] = [
  { call: 'safeNotify', from: 'server/services/notification.service.ts' },
  { call: 'notifyRole', from: 'server/services/notification.service.ts' },
  { call: 'sendDirectEmail', from: 'server/services/notification.service.ts' },
  { call: 'sendVerifyEmail', from: 'server/services/account-mail.ts' },
  { call: 'sendPasswordResetEmail', from: 'server/services/account-mail.ts' },
  { call: 'sendStaffInviteEmail', from: 'server/services/account-mail.ts' },
]

/* و`notify(` طريقةَ صفٍّ، و`notifyX(` أغلفةٌ محلّيّةٌ تنتهي إليها */
const REACHING_RE = new RegExp(
  [...REACHING.map((r) => `\\b${r.call}\\(`), '\\.notify\\(', '\\bnotify[A-Z]\\w*\\('].join('|'),
)

/** الدَّينُ المقيس — فعلٌ عالٍ في معالِجٍ لا يُخبِر أحدا */
const SILENT_DEBT: readonly string[] = [
  /* الحسابُ ووصولُه — `admin-users.routes.ts` و`account-reset.service.ts` */
  'admin.user.purge', 'admin.user.purge_with_history', 'admin.users.purge_bulk',
  'accounts.reset_purge', 'accounts.reset_archive',
  'admin.permission.grant', 'admin.permission.deny', 'admin.permission.clear',
  'auth.founder.promoted',
  /* المدرّبُ ومكانتُه */
  'trainer.suspend', 'trainer.publish_approve', 'trainer.status.transition',
  'trainer.contract.sign', 'trainer.account.activate',
  'trainer.scope.grant', 'trainer.scope.revoke',
  /* الشعبةُ ومن أُسند إليها */
  'cohort.trainer.assign', 'cohort.trainer_update',
  'cohort.plan.approve', 'cohort.plan.changes_requested',
  'zoom.create_api', 'zoom.attach_manual',
  /* التسجيلُ والمال */
  'enrollment.create', 'enrollment.drop', 'enrollment.switch_cohort',
  'payment.charge', 'payment.record_manual',
  'refund.process', 'refund.reject',
  'order.checkout', 'order.cancel',
  'certificate.revoke',
  /* رحيلُ المدرّب */
  'trainer.departure.learner_choice', 'trainer.departure.substitute',
  'trainer.departure.move', 'trainer.departure.credit',
  'trainer.departure.refund_requested',
]

/** الأفعالُ العاليةُ التي لا يُخبِر معالِجُها أحدا اليوم */
function silentHighActions(): string[] {
  const byAction = new Map<string, { file: string; at: number }[]>()
  for (const s of auditSites()) {
    if (auditWeightOf(s.action) !== 'high') continue
    const list = byAction.get(s.action) ?? []
    list.push({ file: s.file, at: s.at })
    byAction.set(s.action, list)
  }
  const silent: string[] = []
  for (const [action, sites] of byAction) {
    const reached = sites.some((s) => REACHING_RE.test(handlerAround(sourceOf(s.file), s.at)))
    if (!reached) silent.push(action)
  }
  return silent.sort()
}

describe('ما يمسّ إنسانا يُخبَر به إنسان', () => {
  it('المسحُ يقرأ أفعالا عاليةً فعلا — وإلّا خضِر الحارسُ على فراغ', () => {
    const high = new Set(auditSites().map((s) => s.action).filter((a) => auditWeightOf(a) === 'high'))
    expect(high.size, 'لم يُقرأ فعلٌ عالٍ واحدٌ من الشيفرة — تعطّل المسحُ نفسُه').toBeGreaterThan(50)
  })

  it('وكلُّ مُرسِلٍ مسمّى ما زال قائما', () => {
    for (const { call, from } of REACHING) {
      expect(
        sourceOf(from),
        `\`${call}\` لم يعد مصدَّرا من ${from} — حدِّث \`REACHING\` قبل أن يُعَدّ كلُّ شيءٍ صامتا`,
      ).toMatch(new RegExp(`export (?:async )?function ${call}\\(`))
    }
    /* وطريقةُ الصفّ التي يُنادى عليها بـ`.notify(` */
    expect(sourceOf('server/services/notification.service.ts')).toMatch(/\n {2}async notify\(/)
  })

  it('لا فعلَ عالٍ جديدٍ يمرّ صامتا', () => {
    const fresh = silentHighActions().filter((a) => !SILENT_DEBT.includes(a))
    expect(
      fresh,
      `أفعالٌ عاليةٌ تُكتب في معالِجٍ لا يُخبِر أحدا: ${fresh.join('، ')}\n`
      + 'ما غيّر وصولَ إنسانٍ أو مكانتَه أو مالَه أو سجلَّه يصله — نادِ `safeNotify` '
      + 'في المعالِج نفسِه بمن يعنيه الأمر. ولا يُزاد السطرُ إلى `SILENT_DEBT`.',
    ).toEqual([])
  })

  it('ولا سطرَ ميّتٍ في خطّ الأساس — ينقص بالعمل لا بالقلم', () => {
    const silent = new Set(silentHighActions())
    const stale = SILENT_DEBT.filter((a) => !silent.has(a))
    expect(
      stale,
      `أفعالٌ في \`SILENT_DEBT\` لم تعد صامتة: ${stale.join('، ')} — احذفها من القائمة`,
    ).toEqual([])
  })
})
