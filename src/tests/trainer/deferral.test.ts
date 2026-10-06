/* التأجيلُ إلى الفصول القادمة — المسارُ السريع (٦ أكتوبر ٢٠٢٦).

   القرارُ وعلّتُه في `src/application/trainer/deferral.ts`، وما يحتاج قاعدةً حقيقيّةً
   في `server/tests/trainer/defer.test.ts`. وهنا:

   ① **موعدُ التواصل** — بعد شهرين تقويميّين، وآخرَ الشهر إن قصر، وبساعته.
   ② **ومتى يحلّ** — لمؤجَّلٍ ما زال مؤجَّلا وحده.
   ③ **والبريد** — السببُ بلفظه، وليس حكما، واليومُ مسمّى بتوقيت عمّان في متنه وجدوله،
      والملاحظةُ تصل إن كُتبت ولا إطارَ لها إن لم تُكتب.
   ④ **والقرار** — بجانب القبول والرفض، من كلّ حالةٍ حيّةٍ سوى التأجيل، وجماعيّ،
      ويُوصى به حين يحكم اللقاءُ بالتأجيل.
   ⑤ **والتقييم** — «مؤجَّل» نتيجةٌ في المعجم الذي تقرؤه خانةُ المقابلات ورابطُ التقييم،
      ورابطُ التقييم يكتب معنى الحكم المختار.
   ⑥ **والحالة** — لفظٌ عند الإدارة، وشرحٌ عند صاحب الطلب، ويُعدَّل ويُسحب كالمنتظِر.
   ⑦ **والشاشة** — البابُ في قائمة الصفّ وفي الملفّ، وحوارٌ ملاحظتُه لا تُشترط، وشارةُ الموعد.
   ⑧ **والمتابعةُ حين يحلّ الموعد** — جوابان بوجهتين، ويُسأل من حلّ موعدُه ولم يُسأل.
   ⑨ **وبريدُ السؤال** — الخياران بما يقع بكلٍّ، وزرٌّ يفتح الصفحةَ ولا يُجيب.
   ⑩ **وصفحةُ الجواب** — عامّةٌ بلا جلسة، وفتحُها لا يُجيب، و«لم أعد» تُسأل مرّتين.
   ⑪ **والعاملُ والفريق** — وظيفةٌ كلَّ ساعة، وإشعارٌ مصنَّفٌ له وجهة. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFERRED, DEFER_FOLLOW_UP_MONTHS, INTEREST_ANSWERS, INTEREST_CHOICES, INTEREST_PAGE_PATH,
  answerTarget, deferredFollowUpAt, dueForInterestAsk, followUpDue,
} from '@/application/trainer/deferral'
import ts from 'typescript'
import { NOTIFICATION_CATEGORIES } from '@/application/notifications/categories'
import { destinationFor } from '@/application/notifications/destinations'
import { BULK_ACTIONS, DECISIONS, recommendedFor } from '@/application/trainer/decisions'
import { REVIEW_OPEN_STATUSES } from '@/application/trainer/approval'
import { INTERVIEW_OUTCOMES, INTERVIEW_OUTCOME_KEYS } from '@/application/trainer/interview-outcome'
import { STATUS_LABELS } from '@/application/trainer/application-status'
import { APPLICANT_STATUS, EDITABLE_STATUSES, WITHDRAWABLE_STATUSES } from '@/application/trainer/application-options'
import { deferralFollowUpMail, deferralMail } from '../../../server/services/trainer-decision-mail'
import { renderMail } from '../../../server/services/mail-template'
import { TRAINER_STATUSES } from '../../../server/services/trainer-application.service'

const strip = (s: string) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const code = (p: string) => strip(readFileSync(join(process.cwd(), p), 'utf8'))

describe('① موعدُ التواصل — بعد شهرين', () => {
  it('شهران تقويميّان بساعتهما', () => {
    expect(DEFER_FOLLOW_UP_MONTHS).toBe(2)
    expect(deferredFollowUpAt(new Date('2026-10-06T10:30:00Z')).toISOString()).toBe('2026-12-06T10:30:00.000Z')
  })

  it('وعبرَ السنة', () => {
    expect(deferredFollowUpAt(new Date('2026-11-20T08:00:00Z')).toISOString()).toBe('2027-01-20T08:00:00.000Z')
  })

  it('وآخرَ الشهر إن قصر — لا يقفز إلى الشهر الذي بعده', () => {
    expect(deferredFollowUpAt(new Date('2026-12-31T12:00:00Z')).toISOString()).toBe('2027-02-28T12:00:00.000Z')
    expect(deferredFollowUpAt(new Date('2027-12-31T12:00:00Z')).toISOString()).toBe('2028-02-29T12:00:00.000Z')
  })
})

describe('② ومتى يحلّ', () => {
  const at = '2026-12-06T10:30:00.000Z'
  it('حلّ يومُه أو مضى — لمؤجَّل', () => {
    expect(followUpDue({ status: DEFERRED, deferredFollowUpAt: at }, new Date('2026-12-06T10:30:00Z'))).toBe(true)
    expect(followUpDue({ status: DEFERRED, deferredFollowUpAt: new Date(at) }, new Date('2027-01-01T00:00:00Z'))).toBe(true)
  })
  it('ولم يحلّ قبله', () => {
    expect(followUpDue({ status: DEFERRED, deferredFollowUpAt: at }, new Date('2026-12-05T23:59:00Z'))).toBe(false)
  })
  it('ولا يحلّ لمن خرج من التأجيل ولو بقي له يوم — ولا لمن لا يومَ له', () => {
    expect(followUpDue({ status: 'under_review', deferredFollowUpAt: at }, new Date('2027-01-01T00:00:00Z'))).toBe(false)
    expect(followUpDue({ status: DEFERRED, deferredFollowUpAt: null }, new Date('2027-01-01T00:00:00Z'))).toBe(false)
  })
})

describe('③ والبريد', () => {
  const followUpAt = new Date('2026-12-05T22:30:00Z') // ٦ ديسمبر بعمّان — ٥ ديسمبر بغرينتش
  const input = { fullName: 'ريم', reference: 'WJ-TR-2026-00042', followUpAt }
  const text = (noteAr?: string) => renderMail(deferralMail({ ...input, noteAr }).doc).text

  it('العنوانُ يقول التأجيلَ ويحمل رقمَ الطلب', () => {
    const m = deferralMail(input)
    expect(m.subject).toContain('الفصول القادمة')
    expect(m.subject).toContain(input.reference)
  })

  it('والسببُ بلفظه، وأنّه ليس حكما ولا ردّا، وأنّ الطلبَ محفوظ', () => {
    const t = text()
    expect(t).toContain('لا نتوقّع في الفصل القادم طلبا كافيا')
    expect(t).toContain('وليس هذا حكما عليك ولا ردّا لطلبك')
    expect(t).toContain('ولا يلزمك أن تتقدّم من جديد')
  })

  it('واليومُ مسمّى بتوقيت عمّان — في المتن وفي الجدول', () => {
    const t = text()
    expect(t).toMatch(/ونتواصل معك في 6 ديسمبر 2026 — بعد شهرين/)
    expect(t).toMatch(/موعدُ تواصلنا: 6 ديسمبر 2026/)
    expect(t, 'اليومُ بتوقيت غرينتش').not.toContain('5 ديسمبر')
  })

  it('والملاحظةُ تصل بنصّها إن كُتبت — ولا إطارَ بلا نصّ', () => {
    expect(text('نودّ أن تدرّسي «القيادة» في الربيع')).toContain('نودّ أن تدرّسي «القيادة» في الربيع')
    expect(text('نودّ')).toContain('وممّا دار في مراجعتنا')
    expect(text()).not.toContain('وممّا دار في مراجعتنا')
    expect(text('   ')).not.toContain('وممّا دار في مراجعتنا')
  })
})

describe('④ والقرار', () => {
  const defer = DECISIONS.find((d) => d.action === 'defer')

  it('بجانب القبول والرفض — من كلّ حالةٍ حيّةٍ سوى التأجيل نفسِه', () => {
    expect(defer, 'لا قرارَ تأجيل').toBeTruthy()
    expect([...defer!.from].sort()).toEqual(REVIEW_OPEN_STATUSES.filter((s) => s !== DEFERRED).sort())
    expect(defer!.noteAr, 'لا يُقال تحت الزرّ ما يصل صاحبَه').toMatch(/بريد/)
  })

  it('وقبلَ الرفض في العمود — البابُ الذي لا يُغلق يُقرأ قبل الذي يُغلق', () => {
    const at = (a: string) => DECISIONS.findIndex((d) => d.action === a)
    expect(at('defer')).toBeLessThan(at('reject'))
  })

  it('وجماعيّ', () => {
    expect(BULK_ACTIONS).toContain('defer')
  })

  it('ويُوصى به حين يحكم اللقاءُ بالتأجيل — ولا يُغيّر الموصى به في غيره', () => {
    for (const st of REVIEW_OPEN_STATUSES.filter((s) => s !== DEFERRED)) {
      expect(recommendedFor(st, DEFERRED), `في ${st}`).toBe('defer')
      expect(recommendedFor(st, 'passed')).toBe(recommendedFor(st))
      expect(recommendedFor(st, null)).toBe(recommendedFor(st))
    }
    expect(recommendedFor(DEFERRED, DEFERRED), 'يُوصى بتأجيل المؤجَّل').not.toBe('defer')
  })
})

describe('⑤ والتقييم — في خانة المقابلات ورابط التقييم', () => {
  it('«مؤجَّل» نتيجةٌ في المعجم المشترك بلفظٍ ومعنى', () => {
    const o = INTERVIEW_OUTCOMES.find((x) => x.key === DEFERRED)
    expect(o?.labelAr).toBe('مؤجَّل')
    expect(o?.whatAr).toMatch(/الفصل القادم/)
    expect(INTERVIEW_OUTCOME_KEYS).toContain(DEFERRED)
  })

  it('والشاشتان تعرضانه من المعجم نفسِه — لا قائمةٌ تُكتب في إحداهما', () => {
    expect(code('src/pages/admin/TrainerOps.tsx')).toContain('INTERVIEW_OUTCOMES.map(')
    expect(code('src/pages/SharedDossier.tsx')).toContain('INTERVIEW_OUTCOMES.map(')
  })

  it('ورابطُ التقييم يكتب معنى الحكم المختار — التلميحُ لا يظهر على الهاتف', () => {
    expect(code('src/pages/SharedDossier.tsx')).toContain('INTERVIEW_OUTCOMES.find((o) => o.key === verdict)?.whatAr')
  })
})

describe('⑥ والحالة', () => {
  it('حالةٌ في الخادم وحيّةٌ في الطابور', () => {
    expect(TRAINER_STATUSES).toContain(DEFERRED)
    expect(REVIEW_OPEN_STATUSES).toContain(DEFERRED)
  })
  it('بلفظٍ عند الإدارة وشرحٍ عند صاحبها — والشرحُ يقول السببَ والموعد', () => {
    expect(STATUS_LABELS[DEFERRED]).toMatch(/مؤجَّل/)
    expect(APPLICANT_STATUS[DEFERRED]?.explain).toMatch(/طلبا كافيا/)
    expect(APPLICANT_STATUS[DEFERRED]?.explain).toMatch(/شهرين/)
  })
  it('ويُعدَّل ويُسحب كالمنتظِر', () => {
    expect(EDITABLE_STATUSES).toContain(DEFERRED)
    expect(WITHDRAWABLE_STATUSES).toContain(DEFERRED)
  })
})

describe('⑦ والشاشة', () => {
  const screen = code('src/pages/admin/TrainerApplications.tsx')

  it('البابُ في قائمة الصفّ وفي الملفّ — بحوارٍ لا بنقرةٍ صمّاء', () => {
    expect(screen).toContain('allows("defer", a.status)')
    expect(screen.match(/setRowDecision\(\{ app: a, action: "defer" \}\)/g), 'البابُ في أحد الموضعَين وحدَه').toHaveLength(2)
  })

  it('والملاحظةُ في الحوار لا تُشترط — وتمضي فارغة', () => {
    expect(screen).toMatch(/defer: \{[\s\S]{0,300}?minLength: 0/)
    expect(screen).toContain('if (!reason && rowDecision.action !== "defer") return;')
  })

  it('والحوارُ يسمّي يومَ التواصل قبل الضغط — من الدالّة التي يكتب بها الخادم', () => {
    expect(screen).toMatch(/rowDecision\.action === "defer"[\s\S]{0,200}?deferredFollowUpAt\(new Date\(\)\)/)
  })

  it('وشارةُ الموعد في الصفّ وفي الملفّ', () => {
    expect(screen.match(/<FollowUpBadge status=\{a\.status\} at=\{a\.deferredFollowUpAt\}/g)).toHaveLength(2)
  })
})

describe('⑧ والمتابعةُ حين يحلّ الموعد', () => {
  it('جوابان لا ثالثَ لهما — ولكلٍّ لفظٌ وما يقع به', () => {
    expect([...INTEREST_ANSWERS]).toEqual(['interested', 'not_interested'])
    expect(INTEREST_CHOICES.map((c) => c.answer)).toEqual([...INTEREST_ANSWERS])
    for (const c of INTEREST_CHOICES) {
      expect(c.labelAr.length).toBeGreaterThan(3)
      expect(c.whatAr.length, `«${c.labelAr}» بلا ما يقع به`).toBeGreaterThan(20)
    }
  })
  it('«ما زلتُ مهتمّا» إلى المراجعة، و«لم أعد» سحبٌ — حالتان في الخادم', () => {
    expect(answerTarget('interested')).toBe('under_review')
    expect(answerTarget('not_interested')).toBe('withdrawn')
    for (const a of INTEREST_ANSWERS) expect(TRAINER_STATUSES).toContain(answerTarget(a))
  })
  it('يُسأل من حلّ موعدُه ولم يُسأل — لا من سُئل، ولا من لم يحلّ، ولا من خرج', () => {
    const now = new Date('2026-12-07T00:00:00Z')
    const at = '2026-12-06T10:30:00.000Z'
    expect(dueForInterestAsk({ status: DEFERRED, deferredFollowUpAt: at, deferredInterestAskedAt: null }, now)).toBe(true)
    expect(dueForInterestAsk({ status: DEFERRED, deferredFollowUpAt: at, deferredInterestAskedAt: at }, now)).toBe(false)
    expect(dueForInterestAsk({ status: DEFERRED, deferredFollowUpAt: at, deferredInterestAskedAt: null }, new Date('2026-12-01T00:00:00Z'))).toBe(false)
    expect(dueForInterestAsk({ status: 'under_review', deferredFollowUpAt: at, deferredInterestAskedAt: null }, now)).toBe(false)
  })
})

describe('⑨ وبريدُ السؤال', () => {
  const url = `https://www.wajeezacademy.com${INTEREST_PAGE_PATH}/abc`
  const mail = deferralFollowUpMail({ fullName: 'ريم', reference: 'WJ-TR-2026-00042', answerUrl: url })
  const text = renderMail(mail.doc).text

  it('العنوانُ سؤالٌ ويحمل رقمَ الطلب', () => {
    expect(mail.subject).toContain('مهتمّا')
    expect(mail.subject).toContain('WJ-TR-2026-00042')
  })
  it('والخياران بما يقع بكلٍّ — من القائمة التي تعرضها الصفحة', () => {
    for (const c of INTEREST_CHOICES) {
      expect(text).toContain(c.labelAr)
      expect(text).toContain(c.whatAr)
    }
  })
  it('وزرٌّ واحدٌ يفتح الصفحة — ويقول تحته إنّ الفتحَ لا يُحسب', () => {
    const ctas = mail.doc.blocks.filter((b) => b.kind === 'cta')
    expect(ctas).toHaveLength(1)
    expect(ctas[0]).toMatchObject({ href: url })
    expect((ctas[0] as { caption?: string }).caption).toMatch(/لا يُحسب شيءٌ حتّى تضغط/)
  })
})

describe('⑩ وصفحةُ الجواب', () => {
  const page = code('src/pages/DeferralInterest.tsx')
  const app = code('src/App.tsx')

  it('مسارُها في الكتلة العامّة — قبل حارس الأدوار، فلا يُطلب دخول', () => {
    const route = app.indexOf(`path="${INTEREST_PAGE_PATH}/:token"`)
    expect(route, 'لا مسارَ للصفحة').toBeGreaterThan(-1)
    expect(route, 'الصفحةُ خلف حارس الأدوار').toBeLessThan(app.indexOf('<Route element={<RequireRole'))
  })

  it('وفتحُها لا يُجيب — `apiPost` في دالّة الجواب وحدَها، لا في أثرٍ يجري عند الفتح', () => {
    const rel = 'src/pages/DeferralInterest.tsx'
    const sf = ts.createSourceFile(rel, readFileSync(join(process.cwd(), rel), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const posts: ts.Node[] = []
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'apiPost') posts.push(n)
      ts.forEachChild(n, visit)
    }
    visit(sf)
    expect(posts.length, 'لا جوابَ يُرسَل').toBeGreaterThan(0)
    for (const p of posts) {
      let up: ts.Node | undefined = p.parent
      let inAnswer = false
      let inEffect = false
      while (up) {
        if (ts.isVariableDeclaration(up) && ts.isIdentifier(up.name) && up.name.text === 'answer') inAnswer = true
        if (ts.isCallExpression(up) && ts.isIdentifier(up.expression) && up.expression.text === 'useEffect') inEffect = true
        up = up.parent
      }
      expect(inEffect, 'الجوابُ يُرسَل عند فتح الصفحة').toBe(false)
      expect(inAnswer, 'الجوابُ يُرسَل من غير دالّته').toBe(true)
    }
  })

  it('و«لم أعد مهتمّا» تُسأل مرّتين — والسحبُ في الثانية', () => {
    expect(page).toMatch(/!confirmingNo \?[\s\S]*?setConfirmingNo\(true\)[\s\S]*?answer\('not_interested'\)/)
  })

  it('ولا تُفهرَس — فيها اسمُ إنسان', () => {
    expect(page).toMatch(/<SeoHead[^>]*\bnoindex\b/)
  })
})

describe('⑪ والعاملُ والفريق', () => {
  it('وظيفةٌ كلَّ ساعةٍ في العامل', () => {
    const jobs = code('server/worker/jobs.ts')
    expect(jobs).toMatch(/\{ key: 'deferral_followups', everyMs: HOUR, run: runDeferralFollowups,/)
  })
  it('وإشعارُ الفريق مصنَّفٌ لا يُكتَم، وله وجهةٌ في الطابور', () => {
    const KEY = 'admin.trainer_deferral'
    expect(code('server/services/trainer-deferral.service.ts')).toContain(`export const DEFERRAL_STAFF_KEY = '${KEY}'`)
    const cat = NOTIFICATION_CATEGORIES.find((c) => c.templateKeys.includes(KEY))
    expect(cat, 'المفتاحُ بلا صنف').toBeTruthy()
    expect(cat!.silenceable, 'وعدٌ يُكتَم').toBe(false)
    expect(destinationFor(KEY, 'staff')?.path).toBe('/admin/trainers')
  })
})
