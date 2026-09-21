/* طلبُ المعلومات متاحٌ في كلّ ما قبل القرار — ومنه يُرجَع.

   ═══ ما طُلب (٢١ سبتمبر ٢٠٢٦) ═══

   «اجعلها متاحةً في جميع الحالات قبل القرار النهائيّ». وكانت `under_review`
   وحدَها: من تبيّن له بعد المقابلة أو في المراجعة الأكاديميّة أنّ وثيقةً
   تنقص لم يجد بابا — إلّا أن يراسله من بريده هو، فيقع الطلبُ خارجَ المنصّة
   ولا يعلم به من يراجع بعده.

   ═══ وما يُحرَس ═══

   ① **القائمةُ مشتقّةٌ لا مكتوبة** — هي `EDITABLE_STATUSES` إلّا المسوّدة.
   ② **وما بعد القرار خارجُها** — والمسوّدةُ كذلك، ولكلٍّ سببُه.
   ③ **والخادمُ يقبل كلَّ ما تعرضه الشاشة** — وإلّا فزرٌّ يردّه ٤٠٩.
   ④ **ومنه يُرجَع إلى حيث كان** — وإلّا فالطلبُ فخٌّ يُفقد الموضع.
   ⑤ **والقائمتان في الطرفين واحدة** — وعليها يقوم الاشتقاقُ كلُّه. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DECISIONS, INFO_REQUESTABLE } from '@/application/trainer/decisions'
import { EDITABLE_STATUSES } from '@/application/trainer/application-options'
import { STATUS_LABELS } from '@/application/trainer/application-status'
import { ALLOWED_TRANSITIONS } from '../../../server/services/trainer-application.service'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const SERVER = 'server/services/trainer-application.service.ts'

const requestInfo = DECISIONS.find((d) => d.action === 'request_info')!

describe('① القائمةُ مشتقّةٌ لا مكتوبة', () => {
  it('هي `EDITABLE_STATUSES` إلّا المسوّدة — لا قائمةٌ ثانيةٌ تُكتب', () => {
    expect([...INFO_REQUESTABLE].sort())
      .toEqual([...EDITABLE_STATUSES].filter((s) => s !== 'draft').sort())
  })

  it('والقرارُ يقرؤها — فلا تفترق عمّا يُعرض', () => {
    expect([...requestInfo.from].sort()).toEqual([...INFO_REQUESTABLE].sort())
  })

  it('وكلُّ حالةٍ فيها حالةٌ معروفة', () => {
    for (const s of INFO_REQUESTABLE) {
      expect(STATUS_LABELS[s], `«${s}» ليست في معجم الحالات`).toBeTruthy()
    }
  })
})

describe('② وما بعد القرار خارجُها — والمسوّدةُ كذلك', () => {
  it('لا تُطلب معلوماتٌ ممّن وقع فيه القرار', () => {
    for (const s of ['conditionally_approved', 'contract_pending', 'onboarding', 'active',
      'rejected', 'withdrawn', 'suspended']) {
      expect(INFO_REQUESTABLE, `«${s}» بعد القرار ومع ذلك تُطلب منه`).not.toContain(s)
    }
  })

  it('ولا من مسوّدةٍ لم تُقدَّم بعد — وله بابُه: «ذكّره بإكمال طلبه»', () => {
    expect(INFO_REQUESTABLE, 'المسوّدةُ لم تُقدَّم، فلا «إضافةَ» على ما لم يصل')
      .not.toContain('draft')
    expect(EDITABLE_STATUSES, 'تعطّل الفحص: المسوّدةُ خرجت من التعديل أصلا')
      .toContain('draft')
  })

  it('ولا ممّن لم يوثّق بريدَه — الرسالةُ تذهب إلى بريدٍ لم يُثبَت', () => {
    expect(INFO_REQUESTABLE).not.toContain('email_verification_pending')
  })

  it('وثمانٍ لا واحدة — وهو ما تبدّل', () => {
    expect(INFO_REQUESTABLE.length, 'عادت القائمةُ إلى حالةٍ واحدة').toBeGreaterThan(1)
    expect(INFO_REQUESTABLE).toContain('under_review')
    expect(INFO_REQUESTABLE, 'المراجعةُ الأكاديميّةُ كانت أبعدَ ما لا بابَ له').toContain('academic_review')
  })
})

describe('③ والخادمُ يقبل كلَّ ما تعرضه الشاشة', () => {
  it('كلُّ حالةٍ تُعرض فيها تصل «بانتظار معلومات المرشّح»', () => {
    for (const s of INFO_REQUESTABLE) {
      /* والحالةُ نفسُها لا انتقالَ لها: `from === to` تمرّ بلا حركة، والرسالةُ
         تخرج — وهو المقصود: طلبٌ ثانٍ يُلحّ بغير ما طُلب أوّلا. */
      if (s === 'information_requested') continue
      expect(ALLOWED_TRANSITIONS[s as keyof typeof ALLOWED_TRANSITIONS],
        `«${s}» تُعرض في الشاشة ويردّها الخادمُ ٤٠٩`).toContain('information_requested')
    }
  })

  it('ولا تُفتح من حالةٍ لا تعرضها الشاشة — فلا بابٌ خلفيّ', () => {
    for (const [from, tos] of Object.entries(ALLOWED_TRANSITIONS)) {
      if (!tos.includes('information_requested')) continue
      expect(INFO_REQUESTABLE, `الخادمُ يقبلها من «${from}» ولا تُعرض`).toContain(from)
    }
  })
})

describe('④ ومنه يُرجَع إلى حيث كان', () => {
  const back = ALLOWED_TRANSITIONS.information_requested

  it('كلُّ ما دخل منه يُرجَع إليه — إلّا «مُقدَّم»، وهي لا يُرجَع إليها بقصد', () => {
    for (const s of INFO_REQUESTABLE) {
      if (s === 'information_requested') continue
      if (s === 'submitted') continue
      expect(back, `من دخل من «${s}» لا يعود إليها — فيخسر موضعَه`).toContain(s)
    }
  })

  it('و«مُقدَّم» مخرجُها «قيد المراجعة» — فالطلبُ قُرئ ولا يُقال لم يُقرأ', () => {
    expect(back, 'من دخل من «مُقدَّم» لا مخرجَ له').toContain('under_review')
    expect(back, '«مُقدَّم» تعني لم يُقرأ بعد — وقد قُرئ').not.toContain('submitted')
  })

  it('ولا حالةَ تدخل ولا تخرج — لا فخَّ في الخريطة', () => {
    const stranded = INFO_REQUESTABLE.filter(
      (s) => s !== 'information_requested' && s !== 'submitted' && !back.includes(s as never),
    )
    expect(stranded, `حالاتٌ تدخل ولا تخرج: ${stranded.join(' · ')}`).toEqual([])
  })
})

describe('⑤ والقائمتان في الطرفين واحدة', () => {
  /* ═══ وعليها يقوم الاشتقاقُ كلُّه (٢١ سبتمبر ٢٠٢٦) ═══

     `EDITABLE_STATUSES` في الشاشة تقول عن نفسها: «وهي مطابقةٌ لـ
     `PHASE2_OPEN_STATUSES` في الخادم — ولو افترقتا لَأظهرت الشاشةُ زرّا
     يردّه الخادمُ ٤٠٩». وكان ذلك قولا في تعليقٍ لا حارسا.

     وقد صار حِملا: `INFO_REQUESTABLE` مشتقّةٌ منها، فلو زِيدت حالةٌ في أحد
     الطرفين وحدَه لَانحرف بابُ طلب المعلومات معها. */
  it('`EDITABLE_STATUSES` هي `PHASE2_OPEN_STATUSES` نفسُها', () => {
    const src = readFileSync(join(root, SERVER), 'utf8')
    const block = /const PHASE2_OPEN_STATUSES: TrainerStatus\[\] = \[([\s\S]*?)\]/.exec(src)?.[1]
    expect(block, 'لم يُعثر على قائمة الخادم').toBeTruthy()
    const server = [...block!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    expect(server.length, 'القائمةُ فارغة — تعطّل الفحص').toBeGreaterThan(0)
    expect([...server].sort(), 'افترقت قائمتا التعديل — والبابُ يُشتقّ منهما')
      .toEqual([...EDITABLE_STATUSES].sort())
  })
})
