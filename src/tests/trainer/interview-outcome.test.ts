/* نتيجةُ اللقاء — والغيابُ الذي لم يكن له اسم.

   ═══ ما يُحرَس ═══

   ① **الغيابُ ليس لقاءً جرى** — وهو العطبُ نفسُه: «موعدٌ مضى ولم يُلغَ»
      يشمله حرفا، فكان يُعَدّ لقاءً وقع في القمع.
   ② **ولا موعدا قائما** — فمن لم يحضر يُدعى إلى حجزٍ جديد كمن ألغى، وإلّا
      كان أحوجَ الناس إلى التذكير وأبعدَهم عنه.
   ③ **ونسيانُ التسجيل لا يمحو لقاءً وقع** — موعدٌ مضى ولم يُلغَ ولا نتيجةَ
      له لقاءٌ جرى، فالمُقابِلُ ينسى.
   ④ **وكلُّ قيمةٍ يقبلها الخادمُ لها عنوانٌ عربيّ** — وإلّا عُرض `passed`
      حرفا لاتينيّا في بطاقة المقابلة، وهو عطبٌ لا يُحمِّر شيئا.
   ⑤ **والشاشةُ تبني أزرارَها من المعجم** — لا من قائمةٍ مكتوبةٍ بيدها،
      فزرٌّ رابعٌ يُضاف في موضعٍ ولا يُضاف في الآخر. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  INTERVIEW_OUTCOMES, INTERVIEW_OUTCOME_KEYS, NO_SHOW,
  interviewHeld, isLiveInterview, outcomeLabelAr,
} from '@/application/trainer/interview-outcome'

const NOW = new Date('2026-09-19T12:00:00Z')
const PAST = new Date('2026-09-17T10:00:00Z')
const FUTURE = new Date('2026-09-25T10:00:00Z')

describe('① الغيابُ ليس لقاءً جرى', () => {
  it('موعدٌ مضى وسُجّل غيابا لا يُعَدّ لقاءً', () => {
    expect(interviewHeld({ scheduledAt: PAST, outcome: NO_SHOW, canceledAt: null }, NOW)).toBe(false)
  })

  it('③ وموعدٌ مضى بلا نتيجةٍ يُعَدّ لقاءً — فالمُقابِلُ ينسى التسجيل', () => {
    expect(interviewHeld({ scheduledAt: PAST, outcome: null, canceledAt: null }, NOW)).toBe(true)
  })

  it('ونتيجةٌ سُجّلت تكفي وإن لم يمضِ الموعدُ بعد', () => {
    expect(interviewHeld({ scheduledAt: FUTURE, outcome: 'passed', canceledAt: null }, NOW)).toBe(true)
  })

  it('وما لم يحن ولا نتيجةَ له لم يجرِ، وكذلك الملغى', () => {
    expect(interviewHeld({ scheduledAt: FUTURE, outcome: null, canceledAt: null }, NOW)).toBe(false)
    expect(interviewHeld({ scheduledAt: PAST, outcome: null, canceledAt: PAST }, NOW)).toBe(false)
    /* وملغًى سُجّلت له نتيجةٌ قبل إلغائه — الإلغاءُ آخرُ ما وقع */
    expect(interviewHeld({ scheduledAt: PAST, outcome: 'passed', canceledAt: PAST }, NOW)).toBe(false)
  })
})

describe('② ومن لم يحضر لا موعدَ له', () => {
  it('الغيابُ يُخرج الموعدَ من القائم، كالإلغاء', () => {
    expect(isLiveInterview({ outcome: NO_SHOW, canceledAt: null })).toBe(false)
    expect(isLiveInterview({ outcome: null, canceledAt: PAST })).toBe(false)
  })

  it('ومن جرى لقاؤه موعدُه قائمٌ — فلا يُدعى إلى حجزٍ ثانٍ', () => {
    expect(isLiveInterview({ outcome: 'passed', canceledAt: null })).toBe(true)
    expect(isLiveInterview({ outcome: 'hold', canceledAt: null })).toBe(true)
    expect(isLiveInterview({ outcome: 'failed', canceledAt: null })).toBe(true)
    expect(isLiveInterview({ outcome: null, canceledAt: null })).toBe(true)
  })
})

describe('④ المعجمُ نفسُه', () => {
  it('الغيابُ فيه، وله عنوانٌ عربيٌّ وشرحٌ لما يقع للطلب', () => {
    const noShow = INTERVIEW_OUTCOMES.find((o) => o.key === NO_SHOW)
    expect(noShow, 'لا مدخلَ للغياب في المعجم').toBeDefined()
    expect(noShow!.labelAr).toBe('لم يحضر')
    expect(noShow!.whatAr, 'لا يقول ماذا يقع للطلب').toContain('ما قبل الحجز')
  })

  it('وكلُّ قيمةٍ يقبلها الخادمُ لها عنوانٌ عربيٌّ لا مفتاحٌ لاتينيّ', () => {
    for (const key of INTERVIEW_OUTCOME_KEYS) {
      const label = outcomeLabelAr(key)
      expect(label, key).not.toBe(key)
      expect(label, `${key} يُعرض بحروفٍ لاتينيّة`).toMatch(/[؀-ۿ]/)
    }
    expect(outcomeLabelAr(null)).toBe('بلا نتيجة')
  })

  it('والمفاتيحُ هي المعجمُ نفسُه — فلا قائمتان تفترقان', () => {
    expect(INTERVIEW_OUTCOME_KEYS).toEqual(INTERVIEW_OUTCOMES.map((o) => o.key))
    expect(INTERVIEW_OUTCOME_KEYS).toContain(NO_SHOW)
  })
})

describe('⑤ والشاشةُ والخادمُ يقرآن المعجمَ لا قائمةً بأيديهما', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('أزرارُ النتيجة تُبنى من `INTERVIEW_OUTCOMES`', () => {
    const ops = read('src/pages/admin/TrainerOps.tsx')
    expect(ops, 'الشاشةُ لا تستورد المعجم').toContain('INTERVIEW_OUTCOMES')
    expect(ops, 'أزرارٌ مكتوبةٌ بيدها — يُنسى الرابعُ فيها').toMatch(/INTERVIEW_OUTCOMES\.map\(/)
    /* ولا تُعرض القيمةُ خاما: `outcomeLabelAr` لا `iv.outcome` */
    expect(ops).toContain('outcomeLabelAr(iv.outcome)')
  })

  it('وحارسُ الطلب في الخادم من المفاتيح نفسِها', () => {
    const route = read('server/http/routes/admin-trainer.routes.ts')
    expect(route, 'قائمةٌ مكتوبةٌ في الحارس تفترق عن الشاشة').toContain('z.enum(INTERVIEW_OUTCOME_KEYS)')
  })

  it('وقيمُ العمود في المخطَّط تحمل الغياب — وهو عقدُ قيد القاعدة', () => {
    const schema = read('prisma/schema.prisma')
    const line = schema.split('\n').find((l) => /^\s*outcome\s+String\?/.test(l) && l.includes('passed'))
    expect(line, 'لم يُعثر على سطر `outcome` في `TrainerInterview`').toBeDefined()
    expect(line, 'التعليقُ عقدُ القيد المولَّد — وبلا الغياب فيه ترفضه القاعدة').toContain(NO_SHOW)
  })

  it('ومعجمُ قرارِ القارئ لا يحمل الغياب — القارئُ لا يغيب عن ملفّ', () => {
    const screen = read('src/pages/admin/TrainerApplications.tsx')
    const verdicts = /const VERDICT_AR[^}]+\}/.exec(screen)?.[0] ?? ''
    expect(verdicts, 'لم يُعثر على معجم القرار').toContain('passed')
    expect(verdicts, 'غيابٌ في معجم قرارِ المراجع').not.toContain(NO_SHOW)
  })
})
