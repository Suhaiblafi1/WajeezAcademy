/* «ما بقي من دوراتك» — ما يُعدّ عليه، وما تقوله الرسالة (٢٠ أكتوبر ٢٠٢٦).
   قرارُ صاحب المنصّة: لكلّ مدرّبٍ ما ينقصه وموعدٌ نهائيّ، والحملةُ التسويقيّةُ قريبة، وملفُّه يُغلق إن لم يكمل — بلطف. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hasStarted, needsReminder, prepReminderMail, reminderTasks, type ReminderFacts } from '../../services/prep-reminder.service'
import { renderMail } from '../../services/mail-template'

/* ═══ وأعاد صاحبُ المنصّة كتابتَها (٢٠ أكتوبر ٢٠٢٦): ما لم يقبله ليس عالقا، والرسالةُ على حالين — لم يبدأ، أو له
   شعبة — وكلُّ ما هو عالقٌ رابطٌ إلى صفحته، والموعدُ وإغلاقُ الملفّ لمن لم يبدأ وحدَه ═══ */
const base: ReminderFacts = { openCohorts: [], courses: [], pendingBio: false, pendingPitch: false, noPhoto: false }
const course = (state: string, extra: Partial<ReminderFacts['courses'][number]> = {}) =>
  ({ state, postponedTo: null, cohortId: null, cohortTitle: null, titleAr: 'دورة', ...extra }) as ReminderFacts['courses'][number]
const SITE = 'https://x.test'
const text = (f: ReminderFacts) => {
  const m = prepReminderMail({ name: 'حفصة', facts: f, deadlineAr: 'الثلاثاء 27 أكتوبر 2026', siteUrl: SITE })
  return { m, t: renderMail(m.doc).text, html: renderMail(m.doc).html ?? '' }
}

describe('من بدأ ومن لم يبدأ', () => {
  it('لم يبدأ: لا شعبة مفتوحة ولا خطة أرسلها — وما لم يقبله لا يجعله بادئا', () => {
    expect(hasStarted({ ...base, courses: [course('to_decide'), course('preparing')] })).toBe(false)
    expect(hasStarted({ ...base, openCohorts: ['أ'] })).toBe(true)
    expect(hasStarted({ ...base, courses: [course('submitted')] })).toBe(true)
  })
  it('من له شعبة ولا عالق ولا ما يقرر فيه لا تصله رسالة', () => {
    expect(needsReminder({ ...base, openCohorts: ['أ'] })).toBe(false)
    expect(needsReminder({ ...base, openCohorts: ['أ'], courses: [course('to_decide')] })).toBe(true)
    expect(needsReminder(base), 'من لم يبدأ يستحقها دائما').toBe(true)
  })
})

describe('ما هو عالق — وكل منه رابط إلى صفحته', () => {
  it('خطة لم ترسل، وبطاقات تنتظر، ونبذة ولماذا نفتخر بك، وصورة — لا دورة لم يقبلها', () => {
    const tasks = reminderTasks({
      ...base, pendingBio: true, pendingPitch: true, noPhoto: true,
      courses: [
        course('to_decide'),
        course('preparing', { cohortId: 'c1', cohortTitle: 'شعبة أ' }),
        course('returned', { cohortId: 'c2', cohortTitle: 'شعبة ب' }),
        course('returned', { cohortId: 'c3', cohortTitle: 'مؤجلة', postponedTo: '2027-02-01' }),
      ],
    })
    expect(tasks.map((x) => x.path)).toEqual(['/trainer/cohort/c1', '/trainer/cohort/c2', '/trainer/account#suggestions-h', '/trainer/account#suggestions-h', '/trainer/account'])
    expect(tasks.some((x) => x.textAr.includes('مؤجلة')), 'المؤجلة عدت عالقة').toBe(false)
  })
})

describe('الرسالة', () => {
  it('لم يبدأ: ابدأ بدورة واحدة، ومن لم يبدأ يغلق ملفه بلطف', () => {
    const { m, t } = text(base)
    expect(t).toMatch(/يكفي أن تبدأ بدورة واحدة/)
    expect(t).toMatch(/اعتذر عنه، وما تريد تقديمه لاحقا اقبله ثم انقله إلى موسم قادم/)
    expect(t).toMatch(/سنضطر آسفين إلى إغلاق ملفه/)
    expect(m.subject).toContain('الثلاثاء 27 أكتوبر 2026')
    expect(t).toMatch(/حملتنا التسويقية/)
  })
  it('له شعبة: نخبره بها ونسأله أيضيف — بلا إنذار بإغلاق', () => {
    const { t } = text({ ...base, openCohorts: ['أساسيات الأمن'], courses: [course('to_decide')] })
    expect(t).toContain('شعبتك «أساسيات الأمن» مفتوحة للتسجيل الآن')
    expect(t).toMatch(/هل تريد إضافة دورة أخرى/)
    expect(t, 'أنذر من له شعبة').not.toMatch(/إغلاق ملفه/)
  })
  it('والعالق روابط تفتح صفحته', () => {
    const { html } = text({ ...base, openCohorts: ['أ'], courses: [course('preparing', { cohortId: 'c1', cohortTitle: 'شعبة أ' })], noPhoto: true })
    expect(html).toContain(`${SITE}/trainer/cohort/c1`)
    expect(html).toContain(`${SITE}/trainer/account`)
  })
  it('ولا «عرضك»', () => {
    const { m, t } = text(base)
    expect([m.subject, t].join('\n')).not.toMatch(/عرض[َُِ]?ك/)
  })
})

describe('في صفحة المدربين لا في العقود', () => {
  const page = readFileSync(join(process.cwd(), 'src/pages/admin/TrainerRunOps.tsx'), 'utf8')
  it('سطر في بطاقة كل مدرب بقي عليه شيء، وموعد واحد أعلى الصفحة', () => {
    expect(page).toMatch(/<TrainerCourses trainer=\{t\} \/>\s*\{reminders\.has\(t\.profileId\) && <PrepReminderRow row=\{reminders\.get\(t\.profileId\)!\} deadline=\{deadline\} \/>\}/)
    expect(page).toMatch(/<ReminderDeadline value=\{deadline\} onChange=\{setDeadline\}/)
  })
})

describe('المعاينة كما يصل البريد', () => {
  it('الباب يعيد HTML الرسالة، والصفحة تعرضه في إطار معزول — فترى الروابط تنقر', () => {
    const routes = readFileSync(join(process.cwd(), 'server/http/routes/admin-trainer.routes.ts'), 'utf8')
    expect(routes).toMatch(/html: renderMail\(p\.mail\.doc\)\.html/)
    const box = readFileSync(join(process.cwd(), 'src/components/admin/PrepReminders.tsx'), 'utf8')
    expect(box).toMatch(/<iframe title="معاينة الرسالة" srcDoc=\{shown\.html\} sandbox=/)
  })
})
