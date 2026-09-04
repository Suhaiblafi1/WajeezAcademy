/* من يفوّض لمن، وماذا — ثلاث قواعد تجتمع ولا تكفي واحدةٌ منها.

   القرار: «يعطي صلاحيات للمدرب والطالب — أي أنّه يدير من هو أقلّ منه، وأيضا
   التحكّم بالمسارات والدورات وكلّ ما يتعلّق بمهامّه».

   وكلُّ قاعدةٍ وحدها تفتح بابا:
   • بلا قيد الرتبة: يمنح المديرُ الأكاديميّ نفسَه بيد زميله، أو ينزع عن مدير
     النظام صلاحيّاته.
   • وبلا قيد المهامّ: يفوّض «تسجيل دفعة» — وهو يملكها بحكم عمله — إلى مدرّب.
   • وبلا «لا يمنح ما لا يملك»: يرفع غيرَه فوق نفسه، ثم يُرفَع به.

   والوحدة نقيّة: تُختبر بمعزلٍ عن قاعدة بيانات ومسار. */

import { describe, expect, it } from 'vitest'
import {
  DELEGATABLE_FAMILIES, ROLE_PERMISSIONS, ROLE_RANK, rankOf, refuseDelegation,
} from '../../server/auth/permissions'

const actorOf = (role: string) => ({ roles: [role], permissions: ROLE_PERMISSIONS[role] ?? [] })
const targetOf = (role: string) => ({ roles: [role] })

describe('رتبةُ الدور', () => {
  it('مديرُ النظام أعلاها، والمتعلّم أدناها', () => {
    expect(ROLE_RANK.super_admin).toBeGreaterThan(ROLE_RANK.academic_manager)
    expect(ROLE_RANK.academic_manager).toBeGreaterThan(ROLE_RANK.trainer)
    expect(ROLE_RANK.trainer).toBeGreaterThan(ROLE_RANK.learner)
  })

  it('المديرُ الأكاديميّ فوق مديري النطاقات — فهو من يدير دونه', () => {
    /* القرار: «يدير من هو أقلّ منه». وترتيبُه فوقهم هو ما يجعل الجملة نافذة —
       ولولاه لصار زميلا لهم لا مديرا فوقهم. */
    for (const peer of ['operations_manager', 'diagnostic_manager', 'finance', 'support']) {
      expect(ROLE_RANK.academic_manager, `الأكاديميّ ليس فوق ${peer}`).toBeGreaterThan(ROLE_RANK[peer])
    }
    expect(ROLE_RANK.advisor).toBeGreaterThan(ROLE_RANK.trainer)
    expect(ROLE_RANK.trainer).toBeGreaterThan(ROLE_RANK.trainer_applicant)
  })

  it('من له أدوارٌ عدّة فرتبتُه أعلاها', () => {
    expect(rankOf(['learner', 'trainer'])).toBe(ROLE_RANK.trainer)
    expect(rankOf([])).toBe(0)
    expect(rankOf(['دورٌ لا وجود له'])).toBe(0)
  })
})

describe('المدير الأكاديميّ يدير من هو أقلّ منه', () => {
  const academic = actorOf('academic_manager')

  it('يفوّض للمدرب والمتعلّم في مهامّه', () => {
    expect(refuseDelegation(academic, targetOf('trainer'), 'catalog.course.edit')).toBeNull()
    expect(refuseDelegation(academic, targetOf('trainer'), 'cohort.manage')).toBeNull()
    expect(refuseDelegation(academic, targetOf('trainer'), 'certificate.issue')).toBeNull()
    expect(refuseDelegation(academic, targetOf('learner'), 'enrollment.manage')).toBeNull()
  })

  it('ولا يفوّض صلاحيةَ بوابةٍ لا يملكها هو — والدورُ بابُها لا الاستثناء', () => {
    /* `learner.submit` صلاحيةُ المتعلّم بحكم دوره، والمديرُ لا يملكها. ومن
       أراد أن يجعل حسابا متعلّما فبابُه تعيينُ الدور لا استثناءُ صلاحية. */
    expect(ROLE_PERMISSIONS.academic_manager).not.toContain('learner.submit')
    expect(refuseDelegation(academic, targetOf('learner'), 'learner.submit'))
      .toMatchObject({ code: 'not_held' })
  })

  it('ولا يمسّ من هو في رتبته أو فوقها', () => {
    expect(refuseDelegation(academic, targetOf('academic_manager'), 'catalog.course.edit'))
      .toMatchObject({ code: 'rank_too_low' })
    expect(refuseDelegation(academic, targetOf('super_admin'), 'catalog.course.edit'))
      .toMatchObject({ code: 'rank_too_low' })
  })

  it('ولا يفوّض خارج مهامّه — ولو كان يملكها', () => {
    /* يملك «عرضَ الفواتير» بحكم عمله — يحتاج أن يعرف أدفع المتعلّمُ أم لا —
       ولا يفوّضها: عائلةُ الصلاحية تقول لمن تخصّ */
    expect(ROLE_PERMISSIONS.academic_manager).toContain('finance.view')
    expect(refuseDelegation(academic, targetOf('trainer'), 'finance.view'))
      .toMatchObject({ code: 'out_of_scope' })
    expect(refuseDelegation(academic, targetOf('trainer'), 'settings.manage'))
      .toMatchObject({ code: 'out_of_scope' })
  })

  /* ═══ فصلُ المال عن الأكاديميّ ═══

     كانت حزمتُه تجمع تسجيلَ التسجيل وتسجيلَ دفعته واعتمادَ استردادها
     وتبديلَ مفاتيح مزوّد الدفع — أربعةَ أعمالٍ في يد. والفحصُ يحرس الفصلَ
     كي لا يعود بحبّةٍ تُضاف سهوا. */
  it('ولا يحرّك مالا: لا دفعةً يسجّلها ولا استردادا يعتمده ولا مزوّدَ دفعٍ يبدّله', () => {
    for (const key of ['finance.payment.record', 'finance.refund.process', 'commerce.manage', 'settings.manage'] as const) {
      expect(ROLE_PERMISSIONS.academic_manager, `${key} عادت إلى المدير الأكاديميّ`).not.toContain(key)
    }
    /* والطلباتُ والكوبوناتُ عند المالية — وكانت مقلوبة: تملك المالية تسجيلَ
       الدفعة ولا تملك الطلبَ الذي دُفع عنه. */
    expect(ROLE_PERMISSIONS.finance).toContain('commerce.manage')
    /* ومفاتيحُ التكاملات لمديرِ النظام وحدَه */
    expect(ROLE_PERMISSIONS.finance).not.toContain('settings.manage')
    expect(ROLE_PERMISSIONS.super_admin).toContain('settings.manage')
  })

  it('ولا يفوّض ما لا يملكه هو', () => {
    /* التشخيص في عائلةٍ ليست له أصلا — والفحص هنا على صلاحيةٍ في عائلته
       يملكها غيرُه ولا يملكها هو */
    const narrowed = { roles: ['academic_manager'], permissions: ['catalog.view'] }
    expect(refuseDelegation(narrowed, targetOf('trainer'), 'catalog.course.publish'))
      .toMatchObject({ code: 'not_held' })
  })
})

describe('مديرُ النظام', () => {
  const superAdmin = actorOf('super_admin')

  it('يفوّض كلّ شيء لمن دونه', () => {
    for (const key of ['catalog.course.publish', 'finance.refund.process', 'settings.manage', 'admin.users.manage']) {
      expect(refuseDelegation(superAdmin, targetOf('academic_manager'), key), key).toBeNull()
    }
  })

  it('ولا يمسّ مدير نظامٍ مثله — فلا تنازعَ في القمّة', () => {
    expect(refuseDelegation(superAdmin, targetOf('super_admin'), 'catalog.view'))
      .toMatchObject({ code: 'rank_too_low' })
  })
})

describe('من لا يفوّض', () => {
  it('المالية والدعم والعمليات والتنسيق لا يفوّضون شيئا', () => {
    for (const role of ['finance', 'support', 'operations_manager', 'diagnostic_manager', 'academic_coordinator', 'trainer', 'learner']) {
      expect(DELEGATABLE_FAMILIES[role], `${role} صار مفوِّضا بلا قرار`).toBeUndefined()
      expect(refuseDelegation(actorOf(role), targetOf('learner'), 'learner.submit'), role)
        .toMatchObject({ code: 'not_delegator' })
    }
  })
})
