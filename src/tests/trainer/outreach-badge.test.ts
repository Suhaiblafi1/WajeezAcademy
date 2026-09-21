/* ما بعثناه إليه يُقرأ في صفّه، وطلبُ المعلومات يُفتح من الطابور.

   ═══ ما طُلب (٢١ سبتمبر ٢٠٢٦) ═══

   ① «أضفْ بجانب كلّ شخصٍ قمنا بتذكيره بأخذ موعدٍ أو تذكيرٍ بإكمال الطلب أو
      طلبِ معلوماتٍ إضافيّة… إلخ، موضَّحا في الخانة الرئيسيّة للمدرّبين بجانب
      حالته».
   ② «وكان هناك سابقا طلبُ معلوماتٍ إضافيّةٍ من المدرّب، لم أعد أراها هنا».

   ═══ وما يُحرَس ═══

   ① **معجمٌ واحدٌ للمراسَلات** — الخادمُ يستعلم به والشاشةُ تكتب لفظَه.
      ولو كُتب مرّتين لَاستُخرج فعلٌ لا تعرف الشاشةُ لفظَه، فيُعرض مفتاحٌ
      لاتينيٌّ في صفٍّ عربيّ.
   ② **ولا شارةَ لمن لم يُراسَل** — فراغٌ أصدقُ من «لم يُراسَل» في كلّ صفّ.
   ③ **والقِدَمُ يُقرأ لا يُحسب** — «منذ ٣ أيّام» بصيغة العدد العربيّة.
   ④ **والخادمُ يردّ آخرَ مراسَلةٍ لا أوّلَها.**
   ⑤ **وطلبُ المعلومات في قائمة الصفّ** — بحوارٍ يشترط نصَّ ما نريده. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  OUTREACH, OUTREACH_ACTIONS, outreachAgoAr, outreachAr, outreachLabelAr,
} from '@/application/trainer/outreach'
import { auditActionAr } from '@/application/audit/labels'
import { DECISIONS } from '@/application/trainer/decisions'
import { BOOKABLE_STATUSES, canRemindToBook } from '@/application/trainer/application-options'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const SCREEN = 'src/pages/admin/TrainerApplications.tsx'
const SERVICE = 'server/services/trainer-review.service.ts'

const NOW = new Date('2026-09-21T12:00:00Z')

describe('① معجمٌ واحدٌ للمراسَلات', () => {
  it('كلُّ فعلٍ فيه فعلُ أثرٍ معروفٌ — فلا يُستعلَم عمّا لا يُسجَّل', () => {
    for (const o of OUTREACH) {
      /* والمعجمُ يردّ الفعلَ نفسَه لما لا يعرفه — فالمِحَكُّ أن يختلف عنه */
      expect(auditActionAr(o.action), `«${o.action}» ليس في معجم أفعال الأثر`)
        .not.toBe(o.action)
    }
    expect(auditActionAr('لا.فعلَ.بهذا'), 'تعطّل الفحص: المعجمُ صار يعرف كلَّ شيء')
      .toBe('لا.فعلَ.بهذا')
  })

  it('ولكلّ فعلٍ لفظٌ عربيّ — ولا لفظَ لما ليس منها', () => {
    for (const a of OUTREACH_ACTIONS) expect(outreachLabelAr(a)).toBeTruthy()
    expect(outreachLabelAr('trainer.status.transition'), 'انتقالُ حالةٍ ليس مراسَلة').toBeNull()
    expect(outreachLabelAr('لا.شيء')).toBeNull()
  })

  it('والثلاثةُ هي المقصودة: موعدٌ وإكمالٌ ومعلومات', () => {
    expect([...OUTREACH_ACTIONS].sort()).toEqual([
      'trainer.application.draft_remind',
      'trainer.info_requested.notify',
      'trainer.interview.remind',
    ])
  })

  it('والخادمُ يستعلم بالمعجم نفسِه لا بقائمةٍ يكتبها', () => {
    const svc = code(SERVICE)
    expect(svc, 'الخادمُ لا يستورد المعجم').toContain("from '../../src/application/trainer/outreach'")
    expect(svc, 'الاستعلامُ بغير المعجم').toContain('action: { in: [...OUTREACH_ACTIONS] }')
    /* والملفُّ نفسُه **يسجّل** هذه الأفعالَ فيسمّيها — فالمحروسُ كتلةُ
       الاستعلام وحدَها: لو كُتبت فيها بيدها لَانحرفت عن المعجم أوّلَ ما
       يُضاف إليه رابع. */
    const q = /auditEvent\.findMany\(\{([\s\S]*?)\}\)/.exec(svc)?.[1] ?? ''
    expect(q, 'لم يُعثر على استعلام الأثر').toBeTruthy()
    for (const a of OUTREACH_ACTIONS) {
      expect(q, `«${a}» مكتوبٌ بيده في الاستعلام`).not.toContain(a)
    }
  })
})

/** صاحبُ الطلب كما يُحكَم عليه — والمعلَّقُ افتراضا ليُفحَص الذهابُ وحدَه */
const unbooked = { status: 'under_review', interviewsCount: 0 }
const drafting = { status: 'draft', interviewsCount: 0 }
const asked = { status: 'information_requested', interviewsCount: 0 }

describe('② ولا شارةَ لمن لم يُراسَل', () => {
  it('الفراغُ لا شارةَ له', () => {
    expect(outreachAr(null, unbooked, NOW)).toBeNull()
    expect(outreachAr(undefined, unbooked, NOW)).toBeNull()
  })

  it('وفعلٌ ليس مراسَلةً لا شارةَ له — فلا مفتاحٌ لاتينيٌّ في صفّ', () => {
    expect(outreachAr({ action: 'trainer.status.transition', at: NOW.toISOString() }, unbooked, NOW))
      .toBeNull()
  })

  it('وتاريخٌ فاسدٌ لا يُسقط الصفَّ ولا يُعرض «Invalid Date»', () => {
    expect(outreachAgoAr('ليس تاريخا', NOW)).toBeNull()
    expect(outreachAr({ action: 'trainer.interview.remind', at: 'ليس تاريخا' }, unbooked, NOW))
      .toBe('ذُكّر بحجز الموعد')
  })
})

/* ═══ ⑥ والشارةُ تذهب حين يفعل ما ذُكّر به (٢١ سبتمبر ٢٠٢٦) ═══

   «في حالة ذكّرنا شخصا بأن يحجز موعدا وبعدها حجز — يجب أن تختفي ليبل ذُكّر
   بحجز موعد. لأنّنا لن نذكّره مرّةً أخرى، وهذا الليبل يحمينا فقط من تنبيه
   شخصٍ مرّتين… ونطبّق هذا على من ذُكّر بإكمال المسوّدة: إذا أكملها تختفي
   الملاحظةُ ويصبح مقدَّما… وكأنّه أوّلَ مرّة يقدّم».

   وكان الصفُّ يقول «مقابلة مجدولة» و«ذُكّر بحجز الموعد» معا — نقيضان في سطر. */
describe('⑥ والشارةُ تذهب حين يفعل ما ذُكّر به', () => {
  const booking = { action: 'trainer.interview.remind', at: NOW.toISOString() }
  const draft = { action: 'trainer.application.draft_remind', at: NOW.toISOString() }
  const info = { action: 'trainer.info_requested.notify', at: NOW.toISOString() }

  it('ذُكّر بالحجز ولم يحجز — فالشارةُ قائمة', () => {
    expect(outreachAr(booking, unbooked, NOW)).toBe('ذُكّر بحجز الموعد · اليوم')
  })

  it('ثمّ حجز — فتذهب، ولا يُقرأ «مقابلة مجدولة» و«ذُكّر بحجز الموعد» معا', () => {
    expect(outreachAr(booking, { status: 'under_review', interviewsCount: 1 }, NOW),
      'بقيت الشارةُ وقد حجز').toBeNull()
    expect(outreachAr(booking, { status: 'interview_scheduled', interviewsCount: 1 }, NOW))
      .toBeNull()
  })

  it('وإن ألغى موعدَه عادت — وهو أحوجُ الناس إليها', () => {
    expect(outreachAr(booking, { status: 'under_review', interviewsCount: 0 }, NOW))
      .toBe('ذُكّر بحجز الموعد · اليوم')
  })

  it('وذُكّر بالإكمال ولم يُكمل — فالشارةُ قائمة', () => {
    expect(outreachAr(draft, drafting, NOW)).toBe('ذُكّر بإكمال الطلب · اليوم')
  })

  it('ثمّ أكمل — فتذهب، ويصير مقدَّما كأنّه أوّلَ مرّةٍ يقدّم', () => {
    expect(outreachAr(draft, { status: 'submitted', interviewsCount: 0 }, NOW),
      'بقيت الشارةُ وقد أكمل').toBeNull()
  })

  it('وطُلبت منه معلوماتٌ ولم يُجب — فالشارةُ قائمة، فإن نُقل عنها ذهبت', () => {
    expect(outreachAr(info, asked, NOW)).toBe('طُلبت منه معلومات · اليوم')
    expect(outreachAr(info, { status: 'shortlisted', interviewsCount: 0 }, NOW)).toBeNull()
  })

  it('ومِحَكُّ الشارة هو مِحَكُّ الإرسال نفسُه — فلا تحمي من تنبيهٍ لا يقع', () => {
    /* التذكيرُ بالحجز: ما تعرضه الشارةُ هو ما يقبله `canRemindToBook` */
    const kind = OUTREACH.find((o) => o.action === 'trainer.interview.remind')!
    for (const st of [...BOOKABLE_STATUSES, 'interview_scheduled', 'active', 'rejected']) {
      for (const n of [0, 1]) {
        expect(kind.pending({ status: st, interviewsCount: n }),
          `«${st}» بـ${n} موعدا: الشارةُ تخالف مِحَكَّ الإرسال`)
          .toBe(canRemindToBook({ status: st, liveInterviews: n }))
      }
    }
  })

  it('ولكلّ مراسَلةٍ مِحَكُّ تعليقها — فلا شارةَ بلا حدّ', () => {
    for (const o of OUTREACH) {
      expect(typeof o.pending, `«${o.action}» بلا مِحَكّ`).toBe('function')
      /* ولا يُقال «معلَّقٌ دائما»: حالةٌ بعد القرار تُسقطها كلَّها */
      expect(o.pending({ status: 'active', interviewsCount: 0 }),
        `«${o.action}» تبقى بعد أن صار مدرّبا نشطا`).toBe(false)
    }
  })
})

describe('③ والقِدَمُ يُقرأ لا يُحسب', () => {
  const at = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

  it('اليومُ وأمسِ لفظان لا رقمان', () => {
    expect(outreachAgoAr(at(0), NOW)).toBe('اليوم')
    expect(outreachAgoAr(at(1), NOW)).toBe('أمس')
  })

  it('وصيغةُ العدد عربيّةٌ — لا «3 يوم» ولا «11 أيّام»', () => {
    expect(outreachAgoAr(at(2), NOW)).toBe('منذ 2 يومين')
    expect(outreachAgoAr(at(3), NOW)).toBe('منذ 3 أيّام')
    expect(outreachAgoAr(at(11), NOW)).toBe('منذ 11 يوما')
  })

  it('ومراسَلةٌ في المستقبل تُقرأ «اليوم» — ساعةُ خادمٍ تتقدّم لا خبر', () => {
    const ahead = new Date(NOW.getTime() + 3 * 86_400_000).toISOString()
    expect(outreachAgoAr(ahead, NOW), 'قُرئ «منذ -٣»').toBe('اليوم')
  })

  it('والسطرُ يجمع اللفظَ والقِدَم', () => {
    expect(outreachAr({ action: 'trainer.application.draft_remind', at: at(3) }, drafting, NOW))
      .toBe('ذُكّر بإكمال الطلب · منذ 3 أيّام')
  })
})

describe('④ والخادمُ يردّ آخرَ مراسَلةٍ لا أوّلَها', () => {
  const svc = code(SERVICE)

  it('يُرتَّب نازلا ويُؤخَذ أوّلُ ما لكلّ طلب', () => {
    expect(svc, 'الترتيبُ ليس نازلا — فيُقرأ أقدمُ ما بُعث').toMatch(/orderBy: \{ createdAt: 'desc' \}[\s\S]{0,400}?outreach\.set/)
    expect(svc, 'يُكتب الأحدثُ فوق الأقدم أو العكس بلا شرط')
      .toContain('if (!outreach.has(e.entityId))')
  })

  it('واستعلامٌ واحدٌ لا واحدٌ لكلّ صفّ', () => {
    expect(svc, 'الاستعلامُ لا يُقيَّد بمعرّفات الصفوف')
      .toContain('entityId: { in: rows.map((a) => a.id) }')
    expect((svc.match(/auditEvent\.findMany/g) ?? []).length, 'أكثرُ من استعلامِ أثرٍ في سرد الطابور')
      .toBe(1)
  })

  it('ويصل الصفَّ `null` لمن لم يُراسَل', () => {
    expect(svc, 'لا يصل الصفَّ خبرُ المراسَلة').toContain('lastOutreach: outreach.get(a.id) ?? null')
  })
})

describe('⑤ وطلبُ المعلومات يُفتح من الطابور', () => {
  const screen = code(SCREEN)

  it('في قائمة الصفّ — وكان في بطاقة الملفّ وحدَها', () => {
    expect(screen, 'طلبُ المعلومات ليس في قائمة الصفّ').toContain('key: "request-info"')
    expect(screen, 'يُعرض بلا سؤالٍ عن الحالة').toContain('allows("request_info", a.status)')
  })

  it('ويُفتح بحوارٍ يشترط نصَّ ما نريده — لا نقرةٌ صمّاء', () => {
    expect(screen, 'يُرسَل بلا نصّ').toContain('setRowDecision({ app: a, action: "request_info" })')
    const lex = /request_info: \{([\s\S]*?)\n {2}\},/.exec(screen)?.[1] ?? ''
    expect(lex, 'لا لفظَ للحوار').toBeTruthy()
    expect(lex, 'الحوارُ لا يشترط نصّا').toMatch(/minLength: 10/)
  })

  it('والشاشةُ تحكم بحالِ صاحب الصفّ — لا بحالٍ مكتوبةٍ بيدها', () => {
    /* والوحدةُ محروسةٌ أعلاه بسلوكها، وهذا ما لا يُفحَص إلّا هنا: أنّ الذي
       يُمرَّر إليها هو **هذا الصفُّ** لا قيمةٌ ثابتة. ولو مُرّرت ثابتةٌ
       لَقرأت الصفوفُ كلُّها حالا واحدة، ولخضرّت حرّاسُ الوحدة كلُّها. */
    expect(screen, 'الشارةُ تُحكَم بحالٍ غير حال صاحبها')
      .toContain('outreachAr(app.lastOutreach, app, now)')
    expect(screen, 'شارةٌ تُصيَّر بلا صفّها')
      .toContain('<OutreachBadge app={a} now={renderedAt} />')
  })

  it('ولكلّ قرارِ صفٍّ ألفاظُه — لا ثلاثيّاتٌ متداخلةٌ في التصيير', () => {
    const keys = /const ROW_DECISION_AR: Record<([^>]*)>/.exec(screen)?.[1] ?? ''
    for (const k of ['reject', 'undo_reject', 'request_info']) {
      expect(keys, `«${k}» ليس في معجم ألفاظ الحوار`).toContain(k)
    }
  })

  it('وبابُه من `DECISIONS` لا من حالةٍ تُكتب هنا — فلا زرٌّ يردّه ٤٠٩', () => {
    const d = DECISIONS.find((x) => x.action === 'request_info')
    expect(d, 'طلبُ المعلومات ذهب من القرارات').toBeTruthy()
    expect(d!.from.length, 'صار يُعرض في كلّ حالة').toBeGreaterThan(0)
    expect(screen, 'الحالاتُ مكتوبةٌ بيد الشاشة')
      .not.toMatch(/request_info[\s\S]{0,80}?status === "under_review"/)
  })
})
