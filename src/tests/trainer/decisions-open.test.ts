/* كلُّ بابٍ مفتوحٌ ما دام صاحبُه متقدّما — ولا زرَّ يردّه الخادم.

   ─────────── ما وُضع له هذا الحارس ───────────

   قال صاحبُ المنصّة (٢٢ سبتمبر ٢٠٢٦): «أضِف خانةَ طلب المعلومات الإضافية من
   المدرّب حتى لو تمّ اعتمادُه داخليّا… وأبقِ كلَّ الخيارات مفتوحةً مهما كانت
   الحالةُ الحاليّة».

   وكانت الأبوابُ تُفتح واحدا واحدا فيُنسى أخوه: فُتح طلبُ المعلومات من كلّ
   ما **قبلَ** القرار في ٢١ سبتمبر، وبقي مقفلا بعده — فمن تبيّن له وهو يجهّز
   مدرّبَه أنّ وثيقةً تنقص لم يجد بابا. وهذا يحرس أن تبقى مفتوحةً كلُّها.

   ─────────── والحدُّ الذي اختاره صاحبُ المنصّة ───────────

   «حتى التهيئة — والمدرّبُ النشطُ لا يُعاد للطابور». فالمقيسُ طرفان: أنّ كلَّ
   حالةٍ حيّةٍ تفتح كلَّ قرار، وأنّ من خرج منها لا يُجَرّ إليها.

   ─────────── والقياسُ على الخادم لا على الشاشة وحدَها ───────────

   أخطرُ ما في بابٍ يُفتح أن يُفتح في نصفه: زرٌّ يظهر ويردّه الخادمُ ٤٠٩.
   فكلُّ قرارٍ يُقابَل هنا بخريطة الانتقالات نفسِها التي يحتكم إليها الخادم. */

import { describe, expect, it } from 'vitest'
import { DECISIONS, INFO_REQUESTABLE } from '@/application/trainer/decisions'
import { ONE_CLICK_APPROVABLE_STATUSES, REVIEW_OPEN_STATUSES } from '@/application/trainer/approval'
import { ALLOWED_TRANSITIONS, transitionProblemAr } from '../../../server/services/trainer-application.service'

/** وجهةُ كلّ قرار — كما في `targets` داخل `decide` */
const TARGET: Record<string, string> = {
  approve: 'active', move_to_review: 'under_review', request_info: 'information_requested',
  shortlist: 'shortlisted', request_demo: 'demo_requested', academic_review: 'academic_review',
  conditionally_approve: 'conditionally_approved', waitlist: 'waitlisted', reject: 'rejected',
  undo_reject: 'under_review', start_onboarding: 'onboarding', activate: 'active', reinstate: 'active',
}

/** من خرج من الطابور — لا يُجَرّ إليه */
const OUT = ['draft', 'email_verification_pending', 'active', 'withdrawn'] as const

describe('طلبُ المعلومات الإضافيّة مفتوحٌ في كلّ حالةٍ حيّة', () => {
  it('ومنها ما بعد القبول الداخليّ — وهو نصُّ ما طُلب', () => {
    for (const st of ['conditionally_approved', 'contract_pending', 'onboarding']) {
      expect(INFO_REQUESTABLE, `«اطلب معلومات» مقفلٌ في ${st}`).toContain(st)
      expect(
        transitionProblemAr(st as never, 'information_requested' as never),
        `الشاشةُ تعرضه في ${st} والخادمُ يردّه`,
      ).toBeNull()
    }
  })

  it('وفي كلّ حالةٍ حيّةٍ سوى التي هو فيها', () => {
    for (const st of REVIEW_OPEN_STATUSES) {
      if (st === 'information_requested') continue
      expect(INFO_REQUESTABLE, `مقفلٌ في ${st}`).toContain(st)
    }
    expect(INFO_REQUESTABLE, 'يُعرض على من هو فيه أصلا').not.toContain('information_requested')
  })

  /* وبابُ الرجوع يلزم مع بابِ الطلب: من أُرسل إليه سؤالٌ فأجاب لا يُترك
     معلَّقا ولا يُهبَط به إلى أوّل الطابور. */
  it('ومن أجاب يستطيع الرجوعَ إلى كلّ حالةٍ حيّةٍ كان فيها', () => {
    for (const st of REVIEW_OPEN_STATUSES) {
      /* و«مُقدَّم» مستثناةٌ بقصد: معناها «لم يُقرأ بعد» وقد قُرئ، فالرجوعُ
         إليها يجعل الحالةَ تكذب. ومخرجُها «قيد المراجعة» كما كان. */
      if (st === 'information_requested' || st === 'submitted') continue
      expect(
        transitionProblemAr('information_requested' as never, st as never),
        `طُلبت منه معلوماتٌ وهو في ${st} — ولا سبيلَ إلى إعادته إليه`,
      ).toBeNull()
    }
  })
})

describe('وكلُّ قرارٍ متاحٌ من كلّ حالةٍ حيّة', () => {
  it('لا قرارَ يقفل حالةً حيّةً إلّا التي هو فيها', () => {
    const SELF: Record<string, string> = {
      move_to_review: 'under_review', request_info: 'information_requested',
      shortlist: 'shortlisted', request_demo: 'demo_requested', academic_review: 'academic_review',
      conditionally_approve: 'conditionally_approved', start_onboarding: 'onboarding',
      waitlist: 'waitlisted',
    }
    /* والعكسان بابُهما حالتُهما: لا يُتراجَع عن ردٍّ لم يقع، ولا يُرفع إيقافٌ
       عمّن ليس موقوفا. وهما خارجُ هذا الفحص بقصد. */
    const REVERSALS = ['undo_reject', 'reinstate']
    for (const d of DECISIONS) {
      if (REVERSALS.includes(d.action)) continue
      for (const st of REVIEW_OPEN_STATUSES) {
        if (SELF[d.action] === st) {
          expect(d.from, `«${d.action}» يُعرض على من هو في ${st} أصلا`).not.toContain(st)
          continue
        }
        expect(d.from, `«${d.action}» مقفلٌ في ${st}`).toContain(st)
      }
    }
  })

  it('ولا زرَّ تعرضه الشاشةُ ويردّه الخادمُ ٤٠٩', () => {
    for (const d of DECISIONS) {
      for (const st of d.from) {
        expect(
          transitionProblemAr(st as never, TARGET[d.action] as never),
          `«${d.action}» معروضٌ من ${st} — والخادمُ: ${transitionProblemAr(st as never, TARGET[d.action] as never)}`,
        ).toBeNull()
      }
    }
  })
})

/* ═══ وكلُّ من يُحجَز منه يُعاد إليه ═══

   أوّلُ صياغةٍ لهذا الفتح أقصت «مُقدَّم» من الوجهات كلِّها — لأنّ حارسا آخرَ
   يمنع الرجوعَ إليها من «بانتظار معلوماته». فكسرت ردَّ الغياب: من حُجز له
   موعدٌ وهو `submitted` ثمّ لم يحضر لا يُعاد إلى موضعه، فيقف بلا مآل.

   وأمسكه `server/tests/trainer/no-show.test.ts` — **في CI وحدَها**، لأنّ
   حزمةَ الخادم لا تقوم بلا قاعدة. فدورةٌ كاملةٌ ضاعت على ما تمسكه هذه
   الأسطرُ في ثانية. فالقياسُ مكرَّرٌ هنا بقصد: ما يُمسك محلّيّا لا يُنتظَر
   من CI. */
describe('ولا يُحجَز من حالةٍ ثمّ يُعجَز عن ردّه إليها', () => {
  it('كلُّ حالةٍ يُحجَز منها موعدٌ يُعاد إليها إن لم يحضر', () => {
    const map: Record<string, string[]> = ALLOWED_TRANSITIONS
    const canBook = (REVIEW_OPEN_STATUSES as readonly string[]).filter(
      (s) => map[s]?.includes('interview_scheduled'),
    )
    expect(canBook.length, 'لا حالةَ تبلغ الحجزَ — تعطّلت قراءةُ الخريطة').toBeGreaterThan(1)
    for (const from of canBook) {
      expect(
        map.interview_scheduled,
        `يُحجَز من «${from}» ولا يُعاد إليها — فمن غاب يقف بلا مآل`,
      ).toContain(from)
    }
  })
})

describe('ومن خرج من الطابور لا يُجَرّ إليه', () => {
  it('المدرّبُ النشطُ والمسوّدةُ والمنسحبُ: لا قرارَ مراجعةٍ يُعرض عليهم', () => {
    for (const st of OUT) {
      const shown = DECISIONS.filter((d) => d.from.includes(st)).map((d) => d.action)
      expect(shown, `${st}: عُرضت عليه قراراتُ الطابور (${shown.join('، ')})`).toEqual([])
      expect(REVIEW_OPEN_STATUSES as readonly string[], `${st} عُدّ حالةً حيّة`).not.toContain(st)
    }
  })

  it('والموقوفُ بابُه رفعُ الإيقاف، والمردودُ بابُه التراجعُ — واحدٌ لكلٍّ', () => {
    expect(DECISIONS.filter((d) => d.from.includes('suspended')).map((d) => d.action)).toEqual(['reinstate'])
    expect(DECISIONS.filter((d) => d.from.includes('rejected')).map((d) => d.action)).toEqual(['undo_reject'])
  })

  it('ولا يُعتمَد المردودُ بنقرةٍ — خطوتان مقصودتان', () => {
    expect(ONE_CLICK_APPROVABLE_STATUSES as readonly string[]).not.toContain('rejected')
    expect(ALLOWED_TRANSITIONS.rejected, 'للمردود مخرجٌ ثانٍ').toEqual(['under_review'])
  })
})
