/* بطاقةُ المدرّب في «المدربون» — حالُ الشعب، والعدّاد، وأثرُ الملفّ العامّ (١٩ أكتوبر ٢٠٢٦).

   ① المؤجَّلةُ مؤجَّلةٌ لا «مردودة»، والمنشورةُ معتمَدة، وما لا خطّةَ له يُقال.
   ② سطرُ الشعبة: حالُها وأوّلُ لقاءٍ وعددُ اللقاءات والنقل — والعدّادُ لا يذكر صفرا.
   ③ الأثرُ: الأحدثُ يغلب، وحفظُ الإدارة لا يُحسب على حقلٍ لم يتغيّر، والردُّ يُذكر بعد المعروض.
   ④ وكلُّ ما يخرج نصٌّ أبيضُ بلا تشكيل (قرارُ ١١ أكتوبر). */

import { describe, expect, it } from 'vitest'
import {
  cohortLineAr, cohortsTallyAr, photoTrailAr, planMarkAr, planMarkOf, profileTrailOf, textTrailAr,
  type CardCohort, type TrailEvent,
} from '@/application/trainer/trainer-card'

const day = (d: string | Date) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10))
const base: CardCohort = {
  id: 'c1', courseId: 'k1', courseTitle: 'دورة', title: 'شعبة', status: 'draft',
  firstAt: '2026-11-03T16:00:00.000Z', sessions: 8, plan: 'approved', postponedTo: null, moved: null,
}
const TASHKEEL = /[ً-ِْ]/

describe('① حال خطة المدرب', () => {
  it('المؤجلة مؤجلة بتاريخها لا مردودة', () => {
    const c = { plan: 'changes_requested', postponedTo: '2027-02-01' }
    expect(planMarkOf(c)).toBe('postponed')
    expect(planMarkAr(c, day)).toBe('مؤجلة إلى 2027-02-01')
    expect(planMarkOf({ plan: 'changes_requested', postponedTo: null })).toBe('returned')
  })

  it('والمنشورة معتمدة، والمرسلة تنتظرك، وما لا خطة له يقال', () => {
    expect(planMarkOf({ plan: 'published', postponedTo: null })).toBe('approved')
    expect(planMarkOf({ plan: 'submitted', postponedTo: null })).toBe('submitted')
    expect(planMarkAr({ plan: null, postponedTo: null }, day)).toBe('لم يكتب الخطة بعد')
  })
})

describe('② سطر الشعبة والعداد', () => {
  it('حالها وأول لقاء وعدد اللقاءات', () => {
    expect(cohortLineAr(base, day)).toBe('مسودة · أول لقاء 2026-11-03 · 8 لقاءات')
    expect(cohortLineAr({ ...base, status: 'open', firstAt: null, sessions: 0 }, day)).toBe('مفتوحة للتسجيل · لا موعد بعد')
    expect(cohortLineAr({ ...base, sessions: 2 }, day)).toContain('· لقاءان')
  })

  it('والمنقولة تقول إلى أين', () => {
    expect(cohortLineAr({ ...base, moved: { toYear: 2027, toSeason: 'feb_apr' } }, day)).toMatch(/نقلت إلى .*2027/)
  })

  it('العداد يجمع بالحال ولا يذكر صفرا', () => {
    const cs = [
      { plan: 'approved', postponedTo: null }, { plan: 'published', postponedTo: null },
      { plan: 'changes_requested', postponedTo: '2027-02-01' }, { plan: 'submitted', postponedTo: null }, { plan: null, postponedTo: null },
    ]
    expect(cohortsTallyAr(cs)).toBe('5 شعب: 2 اعتمدت خطتها · 1 تنتظرك · 1 مؤجلة · 1 لم ترسل بعد')
    expect(cohortsTallyAr([])).toBe('لا شعبة له بعد')
    expect(cohortsTallyAr(cs.slice(0, 2))).toBe('شعبتان: 2 اعتمدت خطتها')
  })
})

describe('③ أثر الملف العام', () => {
  const ev = (action: string, at: string, meta?: unknown): TrailEvent => ({ action, at, meta })

  it('لا أثر: لا صورة، والنبذة الأصلية', () => {
    const t = profileTrailOf([])
    expect(photoTrailAr({ hasPhoto: false, pending: false, trail: t }, day)).toBe('الصورة: لم يرفع المدرب صورة بعد')
    expect(textTrailAr({ hasText: true, pending: false, trail: t }, day)).toBe('النبذة: الأصلية، لم يعدلها المدرب')
    expect(textTrailAr({ hasText: false, pending: false, trail: t }, day)).toBe('النبذة: لا نبذة بعد')
  })

  it('صورته المعتمدة ونبذته — ولو جاء الأثر بغير ترتيب', () => {
    const t = profileTrailOf([
      ev('trainer.public_text.approve', '2026-10-05T10:00:00Z', { edited: true }),
      ev('trainer.photo.approve', '2026-10-03T10:00:00Z'),
    ])
    expect(photoTrailAr({ hasPhoto: true, pending: false, trail: t }, day)).toBe('الصورة: رفعها المدرب واعتمدت في 2026-10-03')
    expect(textTrailAr({ hasText: true, pending: false, trail: t }, day)).toBe('النبذة: كتبها المدرب واعتمدت بعد تعديلك في 2026-10-05')
  })

  it('حفظ الإدارة يحسب على ما تغير فيه وحده', () => {
    const t = profileTrailOf([
      ev('trainer.public_text.approve', '2026-10-05T10:00:00Z', { edited: false }),
      ev('trainer.public_profile.save', '2026-10-06T10:00:00Z', { fields: ['photoUrl'] }),
    ])
    expect(t.text?.by, 'حفظ الصورة محا أن المدرب كتب نبذته').toBe('trainer')
    expect(t.photo?.by).toBe('admin_link')
    const t2 = profileTrailOf([
      ev('trainer.public_text.approve', '2026-10-05T10:00:00Z'),
      ev('trainer.public_profile.save', '2026-10-07T10:00:00Z', { fields: ['bioPublic'] }),
    ])
    expect(textTrailAr({ hasText: true, pending: false, trail: t2 }, day)).toBe('النبذة: عدلتها الإدارة في 2026-10-07')
  })

  it('والمردود بعد المعروض يذكر — والانتظار يغلب', () => {
    const t = profileTrailOf([
      ev('trainer.photo.upload', '2026-10-01T10:00:00Z'),
      ev('trainer.photo.reject', '2026-10-09T10:00:00Z'),
    ])
    expect(photoTrailAr({ hasPhoto: true, pending: false, trail: t }, day)).toBe('الصورة: رفعتها الإدارة في 2026-10-01. ورددت صورة أحدث في 2026-10-09')
    expect(photoTrailAr({ hasPhoto: false, pending: false, trail: t }, day)).toBe('الصورة: لا صورة. رفع المدرب صورة ورددتها في 2026-10-09')
    expect(photoTrailAr({ hasPhoto: true, pending: true, trail: t }, day)).toBe('الصورة: رفع المدرب صورة تنتظر اعتمادك')
  })
})

describe('④ نص أبيض بلا تشكيل', () => {
  it('كل ما يخرج للشاشة', () => {
    const t = profileTrailOf([ev2('trainer.public_text.reject'), ev2('trainer.photo.approve')])
    const out = [
      cohortLineAr({ ...base, moved: { toYear: 2027, toSeason: 'feb_apr' } }, day),
      cohortsTallyAr([{ plan: 'changes_requested', postponedTo: null }, { plan: 'draft', postponedTo: null }]),
      ...(['approved', 'submitted', 'draft', null] as const).map((plan) => planMarkAr({ plan, postponedTo: null }, day)),
      photoTrailAr({ hasPhoto: true, pending: false, trail: t }, day),
      photoTrailAr({ hasPhoto: false, pending: false, trail: t }, day),
      textTrailAr({ hasText: true, pending: false, trail: t }, day),
      textTrailAr({ hasText: true, pending: true, trail: t }, day),
    ]
    for (const s of out) expect(s, s).not.toMatch(TASHKEEL)
  })
})

function ev2(action: string): TrailEvent { return { action, at: '2026-10-01T00:00:00Z' } }
