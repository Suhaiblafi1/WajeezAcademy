/* حرّاسُ أبواب بوّابة المدرّب — وأهمُّها المزلقُ: من وقّع عرضَه لا يُطرد.
   وهي على البنية لا على حرفٍ في ملفّ: تُسأل الدالّةُ نفسُها التي يسألها
   الخادمُ في أربع خدمات. */
import { describe, it, expect } from 'vitest'
import {
  ACTIVE_ONLY_STATUSES, MATERIALS_STATUSES,
  canWorkOnMaterials, doorStatuses, portalDoorProblemAr,
} from '@/application/trainer/portal-access'

describe('بابُ الموادّ يُفتح في الطور المشروط', () => {
  it('يُفتح لمن وقّع عرضَه — وهو التغييرُ الجوهريّ', () => {
    expect(portalDoorProblemAr('materials', { status: 'onboarding' })).toBeNull()
    expect(canWorkOnMaterials({ status: 'onboarding' })).toBe(true)
    expect(MATERIALS_STATUSES, 'الطورُ المشروطُ خارجَ باب الموادّ').toContain('onboarding')
  })

  it('ويبقى مفتوحا للنشط — فمن اعتُمد يضيف ويعدّل كما كان', () => {
    expect(portalDoorProblemAr('materials', { status: 'active' })).toBeNull()
  })

  /* ومن لم يوقّع لم يقبل شرطا ولا مهلة: فتحُ بابه يجعله يرفع موادَّه على
     وعدٍ لم يلتزم به أحد، ثمّ يعتذر فيبقى عندنا عملُه ولا عقدَ بيننا. */
  it('ويبقى مغلقا قبل التوقيع', () => {
    expect(portalDoorProblemAr('materials', { status: 'contract_pending' })).not.toBeNull()
    expect(canWorkOnMaterials({ status: 'contract_pending' })).toBe(false)
    expect(MATERIALS_STATUSES, 'بابٌ فُتح لمن لم يوقّع').not.toContain('contract_pending')
  })

  /* ولا يُقال «حسابك موقوف» لمن حسابُه سليمٌ وإنّما بابُه يُفتح بتوقيعه —
     رسالةٌ كهذه تجعله يظنّ أنّ شيئا أُخذ منه فيكتب إلى الإدارة. */
  it('ورسالتُه لمن لم يوقّع تدلّه على التوقيع لا على الإيقاف', () => {
    const msg = portalDoorProblemAr('materials', { status: 'contract_pending' })!
    expect(msg).toMatch(/وقّعْه|بتوقيع/)
    expect(msg, 'قيل لمن حسابُه سليمٌ إنّه موقوف').not.toMatch(/موقوف/)
  })

  it('ويبقى مغلقا لمن لم يبلغ الطورَ أصلا ولمن رُدَّ طلبُه', () => {
    for (const status of ['submitted', 'shortlisted', 'conditionally_approved', 'rejected', 'waitlisted']) {
      expect(portalDoorProblemAr('materials', { status }), `بابٌ فُتح في ${status}`).not.toBeNull()
    }
  })
})

describe('وما يلمس مالا أو شعبةً يبقى للنشط', () => {
  it('مغلقٌ في الطور المشروط — البندُ 2-11 من عرضه', () => {
    expect(portalDoorProblemAr('active_only', { status: 'onboarding' })).not.toBeNull()
    expect(ACTIVE_ONLY_STATUSES, 'بابُ المال فُتح قبل تحقّق الشرط').not.toContain('onboarding')
  })

  it('ومفتوحٌ للنشط', () => {
    expect(portalDoorProblemAr('active_only', { status: 'active' })).toBeNull()
  })

  it('ورسالتُه تقول لمَ أُغلق — لا «موقوف» وحدَها', () => {
    const msg = portalDoorProblemAr('active_only', { status: 'onboarding' })!
    expect(msg).toMatch(/اعتماد موادّك/)
  })
})

describe('والإيقافُ الإداريُّ يغلق كلَّ باب', () => {
  it('ولو كان نشطا', () => {
    const suspended = { status: 'active', suspendedAt: new Date('2026-09-01T00:00:00Z') }
    expect(portalDoorProblemAr('materials', suspended)).toMatch(/موقوف/)
    expect(portalDoorProblemAr('active_only', suspended)).toMatch(/موقوف/)
    expect(canWorkOnMaterials(suspended)).toBe(false)
  })

  it('ويغلقه في الطور المشروط كذلك — فالإيقافُ قرارٌ فوق الطور', () => {
    expect(portalDoorProblemAr('materials', {
      status: 'onboarding', suspendedAt: '2026-09-01T00:00:00Z',
    })).toMatch(/موقوف/)
  })
})

describe('والبابان مسمَّيان في موضعٍ واحد', () => {
  it('فما يقرؤه الخادمُ هو ما تقرؤه الشاشة', () => {
    expect(doorStatuses('materials')).toBe(MATERIALS_STATUSES)
    expect(doorStatuses('active_only')).toBe(ACTIVE_ONLY_STATUSES)
  })

  /* وبابُ الموادّ أوسعُ من بابِ المال لا العكس — نقضُه يقلب الطورَ كلَّه:
     يُفتح المالُ قبل الاعتماد ويُغلق الرفعُ بعد التوقيع. */
  it('وبابُ الموادّ يحوي بابَ المال ويزيد', () => {
    for (const s of ACTIVE_ONLY_STATUSES) expect(MATERIALS_STATUSES).toContain(s)
    expect(MATERIALS_STATUSES.length).toBeGreaterThan(ACTIVE_ONLY_STATUSES.length)
  })
})
