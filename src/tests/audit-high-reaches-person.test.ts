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

   ═══ وخطُّ الأساس كان دَينا فصار قرارا ═══

   القياسُ يوم كُتب هذا: **اثنان وأربعون** فعلا عاليا في معالِجٍ صامت. وهو
   اليومَ **واحد**، وبقاؤه مكتوبٌ معه ومقصود.

   وما دون القائمة يُحمّر البوّابة. وهي على عرف المستودَع: «تسقط على الدَّين
   الجديد ولا تجمّد الإصلاح» — ولا تُزاد لتمرّ. ولم تُزَد مرّةً واحدةً في
   الطريق: كلُّ سطرٍ خرج منها خرج بعد أن خضِر الفحصُ عليه.

   ═══ وحدُّ هذا الحارس يُقال صراحةً ═══

   يثبت أنّ **أحدا** يُخبَر، لا أنّ **صاحبَه** يُخبَر — لأنّه لا يعرف
   المرسَلَ إليه ولا يُخمّنه، وذلك أصلُ ي-٣ كلِّه. وقد أُمسك ذلك مرّةً بيد:
   `enrollment.drop` كان يخضرّ لأنّه ينادي `fillSeatFromWaitlist` فيُبشّر
   **من دخل المقعدَ الشاغر** — وصاحبُ المقعد المُسقَط لا يعلم. فلا يُقرأ
   خضورُ سطرٍ هنا إقرارا بأنّ الصحيحَ أُخبِر، بل بأنّ الصمتَ المطبق زال. */

import { describe, expect, it } from 'vitest'
import { auditSites, handlerAround, localCallees, sourceOf } from './helpers/audit-sites'
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
  /* ي-٤: ورسالةُ آخرِ العهد — حسابٌ يُمحى أو يُعمّى. وهي بريدٌ بالضرورة لا
     اختيارا: صفُّ الإشعار يُحذف مع صاحبه، والمؤرشَفُ لا يُقرأ له جرس. */
  { call: 'sendAccountErasedEmail', from: 'server/services/account-mail.ts' },
  /* ي-٦: والكتابةُ في طابور البريد إبلاغٌ كالإرسال — بل أوثقُ منه.
     فالمُرسَلُ مباشرةً يسقط مرّةً فيسقط للأبد، والمكتوبُ في الطابور يُعاد
     حتّى يصل أو تُستنفَد محاولاتُه ويُقال ذلك في خبر الدورة. والدفعاتُ
     تكتب فيه بدل أن تُرسل: مئتا نداءٍ متتابعٍ يتجاوز حدَّ المزوّد. */
  { call: 'enqueueMail', from: 'server/services/outbox.service.ts' },
]

/* و`notify(` طريقةَ صفٍّ، و`notifyX(` أغلفةٌ محلّيّةٌ تنتهي إليها */
const REACHING_RE = new RegExp(
  [...REACHING.map((r) => `\\b${r.call}\\(`), '\\.notify\\(', '\\bnotify[A-Z]\\w*\\('].join('|'),
)

/** ما بقي: فعلٌ واحد — وبقاؤه قرارٌ لا دَين

    كان اثنَين وأربعين يوم كُتب. وسقط منه أربعون بإشعاراتٍ وبرائدَ كُتبت
    فعلا، وواحدٌ بإصلاح الحارس حين كان يقرأ أسماءَ المُرسِلين فلا يرى غلافا
    محلّيّا يُرسل.

    ولم يبقَ فيه ما يمسّ مالا ولا وصولا ولا سجلّا ولا مقعدا. */
const SILENT_DEBT: readonly string[] = [
  /* ═══ `trainer.status.transition` — ولا يُبلَّغ عنده بقصد ═══

     هو مَخنقُ **ستّةَ عشرَ حالة** في طلب الانضمام، يُنادى من ثمانية مواضع.
     وبعضُ تنقّلاته فعلُ صاحبه قبل ثانية (`draft → submitted`، والسحبُ،
     وحجزُ الموعد من تقويمه)، وبعضُها مسكُ دفترٍ داخليٌّ لا يعنيه
     (`shortlisted` · `under_review` · `academic_review`). فإبلاغٌ عنده
     يوقظ الناسَ على ما لا يخصّهم — وهو الطريقُ الأقصرُ إلى أن يتعلّموا
     تجاهلَ ما يصلهم منّا.

     **والثغرةُ التي كان يخفيها أُغلقت في موضعها**: كان `decide` يفرّق ثلاثةَ
     قراراتٍ في الإبلاغ — الاعتمادُ يُرسَل، وطلبُ المعلومات يُرسَل، والردُّ
     والانتظارُ لا رسالةَ لهما أصلا. فمن رُدّ طلبُه يبقى يتفقّد صفحةَ حالته
     شهرا. وصارا يُرسلان من `decide` حيث يقع القرارُ ويُعرف سببُه.

     فبقاءُ هذا السطر ليس دَينا يُسدَّد، بل حدُّ هذا الحارس مكتوبا: يقرأ
     **الموضعَ** الذي كُتب فيه الأثر، وهذا أثرٌ يُكتب في مخنقٍ والخبرُ يخرج
     من فروعه. ومن أراد إسقاطَه فليُسقطه بنقلِ الأثر إلى فروعه لا بإبلاغٍ
     عند المخنق. */
  'trainer.status.transition',
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
    const reached = sites.some((s) => {
      const src = sourceOf(s.file)
      const seg = handlerAround(src, s.at)
      if (REACHING_RE.test(seg)) return true
      /* والغلافُ المحلّيُّ يُتبَع درجةً واحدة — ومكتوبٌ في `audit-sites.ts`
         لمَ لا يُحكَم عليه باسمه: `tellTrainer` تُرسل جرسا وبريدا. */
      return localCallees(src, seg).some((body) => REACHING_RE.test(body))
    })
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
