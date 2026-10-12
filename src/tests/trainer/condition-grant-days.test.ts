/* «امنحه أيّاما» — المهلةُ بيد الإدارة أيضا (١٢ أكتوبر ٢٠٢٦).

   سأل صاحبُ المنصّة: «إن لم يُسلِّم المدرّبُ موادَّه في وقتها وانتهى تمديدا اليومين،
   فماذا يقع؟ وكيف أمنح استثناء؟». وكانت شاشةُ العقود تقول «مدّد مهلته» ولا زرَّ
   وراءها، والرسالةُ والشريطُ لا يقولان إنّ الإرسالَ المتأخّرَ مقبول.

   ① الحسابُ: من اليوم إن انقضت، ومن أجلها إن كانت قائمة — وما يمنع يُقال بنصّه.
   ② الرسالةُ: الموعدُ الجديدُ وعددُ الأيّام — ولا يصله السبب.
   ③ والانقضاءُ يقول إنّ البابَ لم يُغلق: الإرسالُ متأخّرا يعمل.
   ④ والشاشةُ تحسب بالدالّة نفسِها وتنادي المسارَ الذي يحرسه إذنُ العقود.
   والسلوكُ على قاعدةٍ حقيقيّة في `server/tests/trainer/condition-grant-days.test.ts`. */

import { describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../../../server/tests/helpers/plain-expect'
/* نصوصُ الخادم بلا تشكيلٍ إعرابيّ بعد «اللغة البيضاء» — يُقارَن الطرفان بلا تشكيل */
const expect = plainExpect(vexpect)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MAX_GRANT_DAYS, conditionLineAr, grantDaysAr, grantDaysProblemAr, grantedDeadline, materialsGateProblemAr,
} from '@/application/trainer/conditional-offer'
import { conditionDaysGrantedMail, conditionLapsedMail } from '../../../server/services/trainer-decision-mail'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const DAY = 86_400_000
const NOW = new Date('2026-10-12T10:00:00Z')
const at = (d: number) => new Date(NOW.getTime() + d * DAY)
const REASON = 'طلب أيّاما لظرفٍ عائليّ'

describe('① الحساب', () => {
  it('⚠️ انقضت فمن اليوم، وقائمةٌ فمن أجلها — لا يُقصَّر أجلٌ بمنحة', () => {
    expect(grantedDeadline({ conditionDeadlineAt: at(-5), now: NOW }, 3)).toEqual(at(3))
    expect(grantedDeadline({ conditionDeadlineAt: at(1), now: NOW }, 2)).toEqual(at(3))
    expect(grantedDeadline({ conditionDeadlineAt: null, now: NOW }, 2)).toBeNull()
  })

  it('⚠️ يُمنح من انقضت مهلتُه أو تجري — ولا تُمنح المجمّدةُ ولا المعتمَدةُ ولا ما لا مهلةَ له', () => {
    expect(grantDaysProblemAr({ conditionDeadlineAt: at(-3), now: NOW }, 3, REASON)).toBeNull()
    expect(grantDaysProblemAr({ conditionDeadlineAt: at(2), now: NOW }, 1, REASON)).toBeNull()
    expect(grantDaysProblemAr({ conditionDeadlineAt: at(2), conditionPausedAt: NOW, now: NOW }, 2, REASON)).toMatch(/أعدها بملاحظات/)
    expect(grantDaysProblemAr({ conditionDeadlineAt: at(-1), conditionMetAt: NOW, now: NOW }, 2, REASON)).toMatch(/اعتمدت موادّه/)
    expect(grantDaysProblemAr({ conditionDeadlineAt: null, now: NOW }, 2, REASON)).toMatch(/لا مهلة/)
  })

  it('⚠️ من يومٍ إلى الحدّ، عددا صحيحا، وبسببٍ يُكتب', () => {
    const f = { conditionDeadlineAt: at(-1), now: NOW }
    expect(grantDaysProblemAr(f, 1, REASON)).toBeNull()
    expect(grantDaysProblemAr(f, MAX_GRANT_DAYS, REASON)).toBeNull()
    for (const d of [0, MAX_GRANT_DAYS + 1, 2.5]) expect(grantDaysProblemAr(f, d, REASON), `قُبل ${d}`).toMatch(/اختر/)
    expect(grantDaysProblemAr(f, 2, '   ')).toMatch(/سببا للسجلّ/)
  })

  it('والعددُ يُقرأ عربيّا: يوما واحدا، يومين، ثلاثة أيّام، أحد عشر يوما', () => {
    expect([1, 2, 3, 10, 11, 14].map(grantDaysAr))
      .toEqual(['يوما واحدا', 'يومين', '3 أيّام', '10 أيّام', '11 يوما', '14 يوما'])
  })
})

describe('② رسالةُ المنحة', () => {
  const mail = conditionDaysGrantedMail({
    fullName: 'سعادُ المدرّبة', reference: 'WJ-TR-2026-00041', days: 3,
    deadlineOnAr: '15 أكتوبر 2026', portalUrl: 'https://wajeezacademy.com/trainer/board',
  })
  const flat = JSON.stringify(mail.doc)

  it('⚠️ الموعدُ الجديدُ وعددُ الأيّام — والرابطُ إلى «شعبي»', () => {
    expect(mail.subject).toContain('3 أيّام')
    expect(mail.subject).toContain('WJ-TR-2026-00041')
    expect(mail.doc.heading).toContain('15 أكتوبر 2026')
    expect(flat).toContain('فتنتهي مهلتُك الآن 15 أكتوبر 2026')
    expect(mail.doc.blocks).toContainEqual({ kind: 'cta', label: 'افتح «شعبي» وأكمل شعبَك', href: 'https://wajeezacademy.com/trainer/board' })
  })

  it('وتقول إنّ إرسالَ آخر شعبةٍ يجمّد المهلة — فلا يظنّ الوقتَ يجري وهو ينتظرنا', () => {
    expect(flat).toMatch(/تتوقّف المهلةُ عن الجريان/)
  })
})

describe('③ والانقضاءُ لا يُغلق الباب', () => {
  it('⚠️ رسالةُ الانقضاء: الإرسالُ متأخّرا أوّلُ الأبواب، وطلبُ أيّامٍ بالردّ', () => {
    const doc = conditionLapsedMail({
      fullName: 'سعاد', reference: 'WJ-TR-2026-00041', deadlineOnAr: '8 أكتوبر 2026',
      portalUrl: 'https://wajeezacademy.com/trainer', noFaultClause: '2-11',
    }).doc
    const list = doc.blocks.find((b) => b.kind === 'list') as { items: string[] }
    expect(list.items).toHaveLength(3)
    expect(list.items[0]).toMatch(/وترسلها ولو بعد المهلة — فنقرؤها/)
    expect(list.items[0]).toMatch(/وإن احتجتَ أيّاما فاكتب لنا/)
  })

  it('⚠️ وشريطُ المدرّب يقول إنّ الإرسالَ ما زال يعمل — وشاشةُ الإدارة تدلّ على المنحة', () => {
    expect(conditionLineAr({ conditionDeadlineAt: at(-1), now: NOW })).toMatch(/ما زال إرسالها يعمل/)
    expect(materialsGateProblemAr({ conditionDeadlineAt: at(-1), now: NOW })).toMatch(/امنحه أيّاما/)
  })
})

describe('④ الشاشةُ والمسار', () => {
  it('⚠️ الشاشةُ تحسب الأجلَ وتمنع بالدالّتين نفسَيهما — وتنادي مسارَ المنحة', () => {
    const ui = code('src/pages/admin/TrainerContracts.tsx')
    expect(ui).toMatch(/const next = open \? grantedDeadline\(facts, open\.days\) : null;/)
    expect(ui).toMatch(/const problem = open \? grantDaysProblemAr\(facts, open\.days, open\.reasonAr\) : null;/)
    expect(ui).toMatch(/disabled=\{problem !== null\}/)
    expect(ui).toMatch(/apiPost\(`\/api\/admin\/trainer-contracts\/\$\{c\.id\}\/grant-days`,\s*\{ days: open\.days, reasonAr: open\.reasonAr\.trim\(\) \}\)/)
    /* ويُعرض لمن لم يُعلن بعد — جاريةً مهلتُه أو منقضية — لا للمجمّدة */
    expect(ui).toMatch(/زرُّ الإعادة بملاحظاتك\.\s*<\/p>\s*\{grantBlock\(c\)\}/)
  })

  it('⚠️ والمسارُ يحرسه إذنُ إدارة العقود — وينادي الخدمةَ بمعتمِده', () => {
    const routes = code('server/http/routes/admin-trainer.routes.ts')
    const m = /app\.post\('\/api\/admin\/trainer-contracts\/:contractId\/grant-days', \{\s*preHandler: requirePermission\('([^']+)'\)[\s\S]*?review\.grantConditionDays\(contractId, req\.auth!\.userId, body\)/.exec(routes)
    expect(m?.[1]).toBe('trainer.contract.manage')
  })
})
