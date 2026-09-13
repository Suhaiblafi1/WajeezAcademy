/* ترشيحُ الحسابات بنوعها (ع-٩).

   شكوى ١٣ سبتمبر ٢٠٢٦: «في الأدمن عندما أذهب للحسابات… أريد أن أرشّحها».
   وكانت الخاناتُ بالحالة وحدَها، فمن أراد المدرّبين قلّبها بعينه.

   وأخطرُ ما فيه أنّ الأدوارَ **متعدّدة**: الحسابُ الواحد يحمل أكثرَ من دور.
   فالحارسُ هنا على أن يبقى الترشيحُ ترشيحا — يظهر الحسابُ في كلّ نوعٍ
   يحمل دورَه — لا قسمةً تخفيه عمّن يبحث عنه بوجهه الآخر. */

import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_KINDS, STAFF_ROLES, filterByKind, isKind, type AccountKind,
} from '@/application/admin/account-kind'

const who = (...ids: string[]) => ({ roles: ids.map((id) => ({ id })) })

describe('نوعُ الحساب — ترشيحٌ لا قسمة', () => {
  it('كلُّ دورٍ في المنصّة يقع في نوعٍ واحدٍ على الأقلّ — فلا حسابٌ لا يُرشَّح', () => {
    const ALL = [
      'super_admin', 'academic_manager', 'academic_coordinator', 'diagnostic_manager',
      'operations_manager', 'advisor', 'trainer', 'finance', 'support', 'learner',
    ]
    for (const role of ALL) {
      const kinds = ACCOUNT_KINDS.filter((k) => isKind([role], k.value))
      expect(kinds.length, `الدورُ «${role}» لا نوعَ له — يسقط من كلّ ترشيح`).toBeGreaterThanOrEqual(1)
    }
  })

  it('⚠️ ومن حمل دورَين ظهر في النوعَين — لا يُخفيه ترتيبُ أسبقيّةٍ مخترَع', () => {
    /* مديرٌ أكاديميٌّ يدرّب: من بحث عن المدرّبين يريده، ومن بحث عن الفريق
       يريده — وأيُّ قسمةٍ تختار له وجها واحدا تُضيّعه على الآخر. */
    const both = who('academic_manager', 'trainer')
    expect(filterByKind([both], 'staff'), 'سقط من فريق العمل').toHaveLength(1)
    expect(filterByKind([both], 'trainer'), 'سقط من المدرّبين').toHaveLength(1)
  })

  it('⚠️ و«كلُّ الأنواع» تعيد الكلَّ — فلا يُجبَر الناظرُ على اختيارٍ ليرى ما كان يراه', () => {
    const rows = [who('learner'), who('trainer'), who('support')]
    expect(filterByKind(rows, null)).toHaveLength(3)
  })

  it('⚠️ والمستشارُ ليس من فريق العمل — له بوّابتُه وطلبُه وعمولتُه', () => {
    expect(STAFF_ROLES, 'أُلحق المستشارُ بالفريق فقيل عنه ما ليس فيه').not.toContain('advisor')
    expect(filterByKind([who('advisor')], 'staff')).toHaveLength(0)
    expect(filterByKind([who('advisor')], 'advisor')).toHaveLength(1)
  })

  it('والمدرّبُ ليس من فريق العمل كذلك، والمتعلّمُ لا يُرشَّح مدرّبا', () => {
    expect(filterByKind([who('trainer')], 'staff')).toHaveLength(0)
    expect(filterByKind([who('learner')], 'trainer')).toHaveLength(0)
  })

  it('ومديرُ النظام الأعلى من الفريق — وإلّا سقط أخطرُ الحسابات من الترشيح', () => {
    expect(filterByKind([who('super_admin')], 'staff')).toHaveLength(1)
  })

  it('وحسابٌ بلا دورٍ لا ينكسر — يسقط من كلّ نوعٍ ولا يُرمى استثناء', () => {
    for (const k of ACCOUNT_KINDS) expect(filterByKind([who()], k.value as AccountKind)).toHaveLength(0)
    expect(filterByKind([who()], null)).toHaveLength(1)
  })
})
