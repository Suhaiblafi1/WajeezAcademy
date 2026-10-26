/* مراجعةُ الخطّة في مساحةٍ واحدة — المرحلة الخامسة (خطّة لوحة الإدارة، ٣د؛ ٢٦ أكتوبر ٢٠٢٦).

   «الجولةُ ووقتُ الانتظار في الأعلى، فتظهر المراجعةُ البطيئةُ في «اليوم»… وأزرارُ القرار في الأسفل». فيُحرس هنا:
   ① كم تنتظر بالأيّام — المفردُ والمثنّى بلا رقمهما، والمستقبلُ «اليوم»؛
   ② وفي الطابور على كلّ خطّةٍ لم يُقضَ فيها، والبطيئةُ تُعلَّم (وفي «اليوم» يحرسه `server/tests/staff/inbox.test.ts`)؛
   ③ والقرارُ تحت الألسنة لا في لسانٍ منها — وسطرُ ما وقع واحدٌ له؛
   ④ وفوق الألسنة ثلاثةُ أسطر: المعاييرُ بعدّها، وما فعله المدرّبُ ببطاقاتك، والخطّةُ بحجمها؛
   ⑤ وثلاثةُ ألسنةٍ بترتيب العمل: ما اقترحه Claude، وما اعتمدته للمدرّب، والمنهاج؛
   ⑥ و«أدوات Claude» قائمةٌ واحدة — التنزيلُ ورفعُ ما يرجع والتقرير — لا في الألسنة.

   والفحصُ على الشيفرة بلا تعليقاتها: حارسٌ طابق جملةً في تعليقٍ مرّ أخضرَ لسببٍ خاطئ. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SLOW_REVIEW_DAYS, waitingAr, waitingDays } from '@/application/trainer/plan-timeline'
import { WORKSPACE_TABS, cardTally, cardsLineAr, draftsLineAr, draftsWaitingAr, planSizeAr, scoreLineAr, workspaceTabAr } from '@/application/trainer/plan-workspace'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① كم تنتظر', () => {
  const now = new Date('2026-10-26T12:00:00Z')
  const ago = (days: number, hours = 0) => new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000)

  it('بالأيّام — اليوم وأمس، والمثنّى بلا رقمه، والعدد بصيغته', () => {
    expect(waitingAr(ago(0, 5), now)).toBe('أرسلت اليوم')
    expect(waitingAr(ago(1, 2), now)).toBe('أرسلت أمس')
    expect(waitingAr(ago(2), now)).toBe('تنتظر منذ يومين')
    expect(waitingAr(ago(4), now)).toBe('تنتظر منذ 4 أيام')
    expect(waitingAr(ago(11), now)).toBe('تنتظر منذ 11 يوما')
  })

  it('⚠️ والمستقبل «اليوم» لا «منذ -1» — ساعة متقدّمة فرق لا خبر', () => {
    expect(waitingDays(new Date(now.getTime() + 600_000), now)).toBe(0)
    expect(waitingAr(new Date(now.getTime() + 600_000), now)).toBe('أرسلت اليوم')
  })

  it('والبطيئة ثلاثة أيّام فأكثر', () => {
    expect(SLOW_REVIEW_DAYS).toBe(3)
  })

  it('بلا تشكيل إعرابيّ', () => {
    expect([0, 1, 2, 5, 12].map((d) => waitingAr(ago(d), now)).join(' ')).not.toMatch(/[ً-ِْ]/)
  })
})

describe('② وفي الطابور', () => {
  const page = code('src/pages/admin/PendingPlans.tsx')

  it('⚠️ على كلّ خطّة لم يُقضَ فيها — والبطيئة تُعلَّم', () => {
    expect(page).toMatch(/\{r\.submittedAt && !done && \(\s*<Chip tone=\{waitingDays\(r\.submittedAt\) >= SLOW_REVIEW_DAYS \? "warn" : "neutral"\}[^>]*>\s*\{waitingAr\(r\.submittedAt\)\}/)
  })
})

const card = code('src/components/admin/TrainerPlanReview.tsx')
const MAIN = card.slice(card.indexOf('export default function TrainerPlanReview'), card.indexOf('export function PlanCurriculum'))
const CLAUDE_AT = MAIN.indexOf('{tab === "claude" && (')
const TRAINER_AT = MAIN.indexOf('{tab === "trainer" && (')
const PLAN_AT = MAIN.indexOf('{tab === "plan" && (')
/* الألسنةُ الثلاثة: من رأس أوّلها إلى إغلاق شرط الخطّة في أوّل السطر — وما بعده القرار */
const PANELS_END = MAIN.indexOf('\n      )}\n', PLAN_AT)
const CLAUDE_TAB = MAIN.slice(CLAUDE_AT, TRAINER_AT)
const TRAINER_TAB = MAIN.slice(TRAINER_AT, PLAN_AT)
const PLAN_TAB = MAIN.slice(PLAN_AT, PANELS_END)
const AFTER = MAIN.slice(PANELS_END)
const TOOLS = MAIN.slice(MAIN.indexOf('aria-label="أدوات Claude"'), MAIN.indexOf('</Inset>', MAIN.indexOf('aria-label="أدوات Claude"')))
const TILES = MAIN.slice(MAIN.indexOf('aria-label="الخطة في ثلاثة أسطر"'), MAIN.indexOf('<TabBar'))

describe('③ والقرار تحت الألسنة', () => {
  it('⚠️ لا قرار في لسان — والألسنة بترتيبها', () => {
    expect(CLAUDE_AT, 'لم يعثر على الألسنة — تعطّل الفحص نفسه').toBeGreaterThan(-1)
    expect(CLAUDE_AT).toBeLessThan(TRAINER_AT)
    expect(TRAINER_AT).toBeLessThan(PLAN_AT)
    for (const [name, tab] of [['اقتراحات Claude', CLAUDE_TAB], ['بطاقات للمدرب', TRAINER_TAB], ['المنهاج', PLAN_TAB]] as const) {
      expect(tab, `القرار في لسان «${name}»`).not.toMatch(/\/decide`|اعتمد وافتح للتسجيل|اطلب تعديلات \(|\/postpone`/)
    }
  })

  it('⚠️ والقرار بعدها — بأزراره كلّها', () => {
    for (const x of ['/decide`', 'اعتمد وافتح للتسجيل', 'اطلب تعديلات', '/postpone`', 'ذكّر المدرّب بإكمال التجهيز']) {
      expect(AFTER, `لا «${x}» تحت الألسنة`).toContain(x)
    }
  })

  it('⚠️ وسطر ما وقع: واحد للأدوات والبطاقات تحت الألسنة، وواحد للقرار عند أزراره', () => {
    expect(MAIN.match(/\{edits\.msg && <p[^>]*role="status">\{edits\.msg\}<\/p>\}/g)?.length).toBe(1)
    expect(MAIN.indexOf('{edits.msg &&')).toBeLessThan(CLAUDE_AT)
    expect(AFTER).toMatch(/\{msg && <p className="mt-3 text-read font-bold text-teal-light-ink" role="status">\{msg\}<\/p>\}/)
    expect(MAIN.match(/\{msg && </g)?.length, 'سطر ثان للقرار').toBe(1)
    /* والتنزيلُ صار في الأدوات — فرسالتُه في سطرها لا في سطر القرار */
    const dl = MAIN.slice(MAIN.indexOf('const downloadBundle'), MAIN.indexOf('const act ='))
    expect(dl).toMatch(/edits\.say\(`نزّلت/)
    expect(dl).not.toMatch(/setMsg\(/)
  })

  it('⚠️ ولا يقول نصّ «في «الإدارة»» — لا لسان بهذا الاسم', () => {
    expect(MAIN).not.toContain('«الإدارة»')
  })
})

describe('④ ثلاثة أسطر فوق الألسنة', () => {
  it('⚠️ المعايير بعدّها، وبطاقاتك، والخطّة بحجمها — وكلّها قبل الألسنة', () => {
    expect(TILES.length, 'الأسطر الثلاثة ليست قبل الألسنة').toBeGreaterThan(200)
    expect(TILES).toMatch(/scoreLineAr\(\{ ok: [^}]*required: blocked\.length \}\)/)
    expect(TILES).toMatch(/\{cardsLineAr\(cardTally\(edits\.items\)\) \?\? draftsLineAr\(editsDrafts\)\}/)
    expect(TILES).toMatch(/\{planSizeAr\(planSize\)\}/)
    expect(TILES, 'سطر الخطّة لا يفتح لسانها').toMatch(/onClick=\{\(\) => setTab\("plan"\)\}>\s*افتح المنهاج/)
  })

  it('⚠️ وحجم الخطّة من المنهاج نفسه — لا عدّ ثان يخالفه', () => {
    expect(MAIN).toMatch(/const v = curriculumView\(\{[\s\S]{0,300}meetings: v\.counts\.meetings,\s*tasks: v\.counts\.tasks,/)
  })

  it('بطاقاتك بأعدادها وصيغها — والملاحظات ليست بطاقات', () => {
    const t = cardTally([
      { status: 'accepted', kind: 'module', noteAr: null },
      { status: 'accepted', kind: 'task', noteAr: null },
      { status: 'rejected', kind: 'task', noteAr: 'الموعد يتعارض مع عملي' },
      { status: 'pending', kind: 'resource', noteAr: null },
      { status: 'proposed', kind: 'module', noteAr: null },
      { status: 'accepted', kind: 'note', noteAr: null },
    ])
    expect(t).toEqual({ sent: 4, accepted: 2, rejected: 1, withReason: 1, waiting: 1 })
    expect(cardsLineAr(t)).toBe('قبل 2 من 4 · رفض بطاقة واحدة وكتب سببه · لم يقرر في بطاقة واحدة')
    expect(cardsLineAr({ sent: 6, accepted: 5, rejected: 1, withReason: 0, waiting: 0 })).toBe('قبل 5 من 6 · رفض بطاقة واحدة')
    expect(cardsLineAr({ sent: 0, accepted: 0, rejected: 0, withReason: 0, waiting: 0 }), 'لم يصله شيء').toBeNull()
    expect(draftsLineAr(0)).toBe('لم ترفع ملف التعديلات بعد')
    expect(draftsLineAr(2)).toBe('بطاقتان من Claude تنتظرانك')
    expect(draftsLineAr(5)).toBe('5 بطاقات من Claude تنتظرك')
  })

  it('والمعايير بعدّها — والنصيحة تجمع', () => {
    expect(scoreLineAr({ ok: 14, advice: 3, required: 1 })).toBe('14 تحقق · 3 نصائح · 1 مطلوب')
    expect(scoreLineAr({ ok: 5, advice: 1, required: 0 })).toBe('5 تحقق · نصيحة واحدة · 0 مطلوب')
    expect(scoreLineAr({ ok: 2, advice: 2, required: 4 })).toBe('2 تحقق · نصيحتان · 4 مطلوب')
  })

  it('ورأس «اقتراحات Claude» بصيغ العدد', () => {
    expect(draftsWaitingAr(1)).toBe('بند واحد ينتظر مراجعتك')
    expect(draftsWaitingAr(2)).toBe('بندان ينتظران مراجعتك')
    expect(draftsWaitingAr(7)).toBe('7 بنود تنتظر مراجعتك')
    expect(draftsWaitingAr(12)).toBe('12 بندا تنتظر مراجعتك')
  })

  it('والخطّة بحجمها — المفرد والمثنّى بلا رقمهما', () => {
    expect(planSizeAr({ meetings: 8, tasks: 12, workbooks: 1 })).toBe('8 لقاءات · 12 مهمة · كراسة')
    expect(planSizeAr({ meetings: 1, tasks: 2, workbooks: 3 })).toBe('لقاء واحد · مهمتان · 3 كراسات')
    expect(planSizeAr({ meetings: 0, tasks: 0, workbooks: 0 })).toBe('بلا لقاءات · بلا مهام · بلا كراسة')
  })

  it('بلا تشكيل إعرابيّ', () => {
    const all = [
      planSizeAr({ meetings: 11, tasks: 1, workbooks: 2 }),
      cardsLineAr({ sent: 3, accepted: 0, rejected: 2, withReason: 2, waiting: 1 }) ?? '',
      draftsLineAr(1), draftsWaitingAr(2), scoreLineAr({ ok: 3, advice: 7, required: 1 }), ...WORKSPACE_TABS.map((t) => workspaceTabAr(t, 3)),
    ].join(' ')
    expect(all).not.toMatch(/[ً-ِْ]/)
  })
})

describe('⑤ ثلاثة ألسنة بترتيب العمل', () => {
  it('⚠️ ما اقترحه Claude ثمّ ما اعتمدته للمدرّب ثمّ المنهاج — بعدّ ما ينتظر في كلّ', () => {
    expect(WORKSPACE_TABS).toEqual(['claude', 'trainer', 'plan'])
    expect(workspaceTabAr('claude', 5)).toBe('اقتراحات Claude (5)')
    expect(workspaceTabAr('trainer', 3)).toBe('بطاقات للمدرب (3)')
    expect(workspaceTabAr('trainer', 0)).toBe('بطاقات للمدرب')
    expect(workspaceTabAr('plan', 9), 'المنهاج لا عدد له').toBe('المنهاج')
    expect(MAIN).toMatch(/workspaceTabAr\(id, id === "claude" \? editsDrafts : id === "trainer" \? editsPending : 0\)/)
  })

  it('⚠️ والمسوّدات في «اقتراحات Claude»، وما وصله وتقرير المراجعة في «بطاقات للمدرب»، والمنهج في «المنهاج»', () => {
    expect(CLAUDE_TAB).toMatch(/<PlanEditsDrafts edits=\{edits\}/)
    expect(TRAINER_TAB).toMatch(/<PlanEditsSent edits=\{edits\} \/>/)
    expect(TRAINER_TAB).toMatch(/<ReviewReportFiles /)
    expect(PLAN_TAB).toMatch(/<PlanCurriculum /)
    expect(CLAUDE_TAB + TRAINER_TAB).not.toMatch(/<PlanCurriculum|<PlanDiffList|<SinceReturnList/)
  })

  it('⚠️ ويفتح على «اقتراحات Claude» — والمعتمدة على «بطاقات للمدرب»', () => {
    expect(MAIN).toMatch(/const tab: WorkspaceTab = tabPick \?\? \(planApproved \? "trainer" : "claude"\);/)
  })
})

describe('⑥ «أدوات Claude» قائمة واحدة', () => {
  it('⚠️ زرّ يفتحها ويقول حالها — وفيها التنزيل ورفع التعديلات والتقرير والجدول والسحب', () => {
    expect(MAIN).toMatch(/aria-expanded=\{toolsOpen\} aria-controls=\{`claude-tools-\$\{cohortId\}`\} onClick=\{\(\) => setToolsOpen\(\(v\) => !v\)\}>\s*أدوات Claude/)
    for (const [what, re] of [
      ['التنزيل', /void downloadBundle\(\)/],
      ['رفع التعديلات', /void edits\.upload\(f\)/],
      ['رفع التقرير', /void reports\.upload\(f\)/],
      ['الجدول الثابت', /void edits\.schedule\(\)/],
      ['السحب', /void edits\.withdraw\(\)/],
    ] as const) expect(TOOLS, `${what} ليس في «أدوات Claude»`).toMatch(re)
  })

  it('⚠️ ولا تنزيل ولا رفع في الألسنة — موضع واحد', () => {
    expect(CLAUDE_TAB + TRAINER_TAB + PLAN_TAB).not.toMatch(/downloadBundle|type="file"|\.upload\(/)
    expect(MAIN.match(/type="file"/g)?.length, 'رفع خارج الأدوات').toBe(2)
  })
})
