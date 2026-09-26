/* «لم يُطلب منه تحديدُ موعد» — من ينتظرنا نحن، لا من ننتظره نحن.
 *
 * ── الطلبُ الذي وُلد منه ──
 *
 * صاحبُ المنصّة (٢٦ سبتمبر ٢٠٢٦): «أضفْ لي فلترا بجانب "لم يحجز موعدا" وهو:
 * لم يُطلب منه تحديد موعد مقابلة».
 *
 * و«لم يحجز موعدا بعد» تجمع الاثنين معا — من دُعي فلم يحجز، ومن لم تخرج
 * إليه دعوةٌ أصلا. فيقرأ الموظّفُ أربعين اسما ولا يعرف أيُّهم ينتظره هو.
 *
 * ── وأدقُّ ما يُقاس: أنّهما لا يتساويان ولا يتباعدان ──
 *
 * المرشِّحُ الجديد **جزءٌ** من القديم لا نقيضُه: من لم يُدعَ لم يحجز قطعا.
 * فيُقاس الطرفان — أنّ كلَّ من ينتظرنا داخلٌ في «لم يحجز»، وأنّ فيمن لم
 * يحجز من لا ينتظرنا (دُعي وتأخّر). ولو تساويا لَصار الزرُّ الجديدُ نسخةً
 * من القديم، ولو تباعدا لَأخفى أحدُهما إنسانا.
 *
 * ── ولا دعوةَ تُستنتَج من حالة (٢٦ سبتمبر ٢٠٢٦) ──
 *
 * كان `shortlisted` يُحسَب دعوةً بلا بريد (`INTEREST_SHOWN_STATUSES`): صاحبُه
 * يرى دعوةَ الحجز في صفحته ولو لم يخرج إليه شيء. فحُذفت الحالةُ بأمر صاحب
 * المنصّة، ولم يُبحَث لها عن خليفةٍ **بقصد**.
 *
 * فالحدُّ الآن واحدٌ لا اثنان: **ما أرسلناه**. وهذا الملفُّ يقيسه من طرفَيه —
 * أنّ الدعوةَ المرسلةَ تُخرج صاحبَها من المنتظِرين، وأنّ **لا حالةَ** تفعل
 * ذلك بلا بريد. والثانيةُ هي الحارسُ الذي حلّ محلَّ حارس `shortlisted`: لو
 * عاد أحدٌ يستنتج الدعوةَ من الحالة لَسقط هنا.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  awaitsBookingInvite, isInvitedToBook,
} from '@/application/trainer/interview-invitation'
import { BOOKABLE_STATUSES, canRemindToBook } from '@/application/trainer/application-options'

const subject = (over: Partial<Parameters<typeof awaitsBookingInvite>[0]> = {}) => ({
  status: 'under_review', liveInterviews: 0, invitedAt: null, ...over,
})

describe('من ينتظرنا نحن', () => {
  it('حالتُه تقبل الحجزَ ولم تخرج إليه دعوةٌ: ينتظرنا', () => {
    expect(awaitsBookingInvite(subject())).toBe(true)
  })

  it('وخرجت إليه دعوةٌ: لا ينتظرنا — ينتظره هو', () => {
    expect(awaitsBookingInvite(subject({ invitedAt: new Date('2026-09-20') }))).toBe(false)
  })

  it('وحجز موعدا: لا ينتظر أحدٌ أحدا', () => {
    expect(awaitsBookingInvite(subject({ liveInterviews: 1 }))).toBe(false)
  })

  /* ═══ ولا حالةَ تنوب عن بريدٍ خرج ═══

     هذا هو حارسُ `shortlisted` بعد حذفها، مقلوبا: كان يُثبّت أنّ حالةً بعينها
     تُحسَب دعوةً، وصار يُثبّت أنّ **لا حالةَ** تُحسَب دعوةً. ولو أُعيد
     الاستنتاجُ من الحالة — بحالةٍ جديدةٍ أو بإحياء القديمة — سقط هنا.

     والمقيسُ كلُّ حالةٍ يُحجَز فيها: من لم تخرج إليه دعوةٌ ينتظرنا فيها
     كلِّها بلا استثناء. */
  it('ولا حالةَ تُحسَب دعوةً بلا بريدٍ خرج — الحدُّ ما أرسلناه', () => {
    for (const st of BOOKABLE_STATUSES) {
      expect(awaitsBookingInvite(subject({ status: st, invitedAt: null })),
        `«${st}» عُدَّت دعوةً بلا بريد — والحدُّ ما أرسلناه`).toBe(true)
      expect(isInvitedToBook({ status: st, liveInterviews: 0, invitedAt: null }),
        `«${st}» تُرى دعوةً في صفحة صاحبها بلا بريدٍ خرج`).toBe(false)
    }
  })

  it('وحالةٌ لا يُحجَز فيها: خارجُ السؤال كلِّه', () => {
    for (const st of ['draft', 'interview_scheduled', 'active', 'rejected', 'withdrawn']) {
      expect(awaitsBookingInvite(subject({ status: st })), `عُدَّ ${st} منتظِرا لدعوة`).toBe(false)
    }
  })
})

describe('وعلاقتُه بالمرشِّح القديم: جزءٌ منه لا نقيضُه', () => {
  /* كلُّ تركيبةٍ ممكنةٍ من الحالة × الدعوة × الحجز */
  const all = [...BOOKABLE_STATUSES, 'draft', 'interview_scheduled', 'active'].flatMap((status) =>
    [null, new Date('2026-09-20')].flatMap((invitedAt) =>
      [0, 1].map((liveInterviews) => ({ status, liveInterviews, invitedAt }))))

  it('من ينتظرنا داخلٌ في «لم يحجز موعدا بعد» — بلا استثناء', () => {
    for (const a of all) {
      if (!awaitsBookingInvite(a)) continue
      expect(canRemindToBook(a), `«ينتظرنا» خارجَ «لم يحجز»: ${JSON.stringify(a)}`).toBe(true)
    }
  })

  it('وفيمن لم يحجز من لا ينتظرنا — وإلّا فالزرّان واحد', () => {
    const booked = all.filter((a) => canRemindToBook(a))
    const waiting = booked.filter((a) => awaitsBookingInvite(a))
    expect(booked.length, 'لا حالةَ تُقرأ أصلا').toBeGreaterThan(0)
    expect(waiting.length, 'لا أحدَ ينتظرنا في كلّ التراكيب').toBeGreaterThan(0)
    expect(waiting.length, 'المرشِّحان متساويان — فالزرُّ الجديدُ نسخةٌ من القديم')
      .toBeLessThan(booked.length)
  })

  it('والقسمةُ تامّة: كلُّ من لم يحجز إمّا ينتظرنا وإمّا دُعي', () => {
    for (const a of all.filter(canRemindToBook)) {
      expect(awaitsBookingInvite(a) !== isInvitedToBook(a),
        `سقط من القسمة: ${JSON.stringify(a)}`).toBe(true)
    }
  })
})

/* ═══ والشاشةُ تستدعي الحكمَ، والخادمُ يُرسل ما يُقاس عليه ═══ */
describe('والزرّان في الطابور', () => {
  const root = new URL('../../..', import.meta.url).pathname
  const bare = (p: string) => readFileSync(join(root, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const SCREEN = bare('src/pages/admin/TrainerApplications.tsx')
  const SERVICE = bare('server/services/trainer-review.service.ts')

  it('الشاشةُ تنادي الحكمَ ولا تكتب شرطا ثانيا', () => {
    expect(SCREEN, 'لا استدعاءَ للحكم').toMatch(/awaitsBookingInvite\(\{/)
    expect(SCREEN, 'كُتب الشرطُ يدويّا في الشاشة')
      .not.toMatch(/interviewInvitedAt == null && a\.interviewsCount === 0/)
  })

  it('وله زرُّه ومرشِّحُه — لا وسمٌ يُعرض بلا فرز', () => {
    expect(SCREEN, 'لا مرشِّحَ للزرّ الجديد').toMatch(/!onlyUninvited \|\| awaitsInvite\(a\)/)
    expect(SCREEN, 'لا زرَّ بالنصّ المطلوب').toMatch(/لم يُطلب منه تحديدُ موعد/)
    expect(SCREEN, 'والزرُّ القديمُ باقٍ كما هو').toMatch(/لم يحجز موعدا بعد/)
  })

  it('وعدُّه لا يُعلَّق على ثقة المزامنة — فهو ممّا أرسلناه لا ممّا وصلنا', () => {
    /* أخوه يُقاس بما وصلنا من حجوز فيكذب حين تسقط المزامنة، وهذا يُقاس
       بالأثر عندنا. فلو عُلّق على `syncTrust` لَعُرض «؟» بلا سبب. */
    const at = SCREEN.indexOf('awaitsInvite).length')
    expect(at, 'لم يُقرأ عدُّ الزرّ الجديد').toBeGreaterThan(0)
    expect(SCREEN.slice(at - 200, at), 'عُلّق عدُّ ما أرسلناه على ثقة مزامنةٍ خارجيّة')
      .not.toMatch(/syncTrust/)
  })

  it('والخادمُ يُرسل تاريخَ الدعوة — وإلّا فالشاشةُ تقرأ فراغا فتعدّ الجميعَ منتظِرين', () => {
    const at = SERVICE.indexOf('async listApplications')
    const body = SERVICE.slice(at, SERVICE.indexOf('\n  async ', at + 1))
    expect(body, '`listApplications` لا تُعيد تاريخَ الدعوة').toMatch(/interviewInvitedAt:/)
    /* ومن الحلقة نفسِها لا باستعلامٍ ثانٍ لكلّ صفّ */
    expect(body, 'يُسأل الأثرُ عن كلّ صفٍّ على حدة').toMatch(/e\.action === INVITATION_ACTION/)
    expect(body, 'أُضيف استعلامُ أثرٍ ثانٍ — والفعلُ مجلوبٌ أصلا')
      .toMatch(/auditEvent\.findMany/)
    expect((body.match(/auditEvent\./g) ?? []).length, 'أكثرُ من استعلام أثرٍ في القائمة').toBe(1)
  })
})

