/* «ما بقي من دوراتك» — ما يُعدّ عليه، وما تقوله الرسالة (٢٠ أكتوبر ٢٠٢٦).
   قرارُ صاحب المنصّة: لكلّ مدرّبٍ ما ينقصه وموعدٌ نهائيّ، والحملةُ التسويقيّةُ قريبة، وملفُّه يُغلق إن لم يكمل — بلطف. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  askedOf, defaultChoices, hasStarted, needsReminder, prepReminderMail, reminderHistory, reminderTasks, shortCohortTitles,
  type MailChoices, type ReminderFacts, type SentReminder,
} from '../../services/prep-reminder.service'
import { renderMail } from '../../services/mail-template'

/* ═══ وأعاد صاحبُ المنصّة كتابتَها (٢٠ أكتوبر ٢٠٢٦): ما لم يقبله ليس عالقا، والرسالةُ على حالين — لم يبدأ، أو له
   شعبة — وكلُّ ما هو عالقٌ رابطٌ إلى صفحته، والموعدُ وإغلاقُ الملفّ لمن لم يبدأ وحدَه ═══ */
const base: ReminderFacts = { openCohorts: [], moved: [], courses: [], pendingBio: false, pendingPitch: false, noPhoto: false }
const course = (state: string, extra: Partial<ReminderFacts['courses'][number]> = {}) =>
  ({ state, postponedTo: null, cohortId: null, cohortTitle: null, titleAr: 'دورة', ...extra }) as ReminderFacts['courses'][number]
const SITE = 'https://x.test'
const text = (f: ReminderFacts, choices?: Partial<MailChoices>) => {
  const m = prepReminderMail({ name: 'حفصة', facts: f, deadlineAr: 'الثلاثاء 27 أكتوبر 2026', siteUrl: SITE, choices: choices && { ...defaultChoices(f), ...choices } })
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
  it('سطر في بطاقة كل مدرب بقي عليه شيء أو أرسلنا له، وموعد واحد أعلى الصفحة — والإرسال يعيد قراءة ما أرسلناه', () => {
    expect(page).toMatch(/<TrainerCourses trainer=\{t\} \/>\s*\{reminders\.has\(t\.profileId\) && <PrepReminderRow row=\{reminders\.get\(t\.profileId\)!\} deadline=\{deadline\} onSent=\{\(\) => void load\(\)\} \/>\}/)
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

describe('موعد خاص لكل مدرب', () => {
  it('اختياري: فارغا يتبع موعد الصفحة، والمعاينة والإرسال بموعده', () => {
    const box = readFileSync(join(process.cwd(), 'src/components/admin/PrepReminders.tsx'), 'utf8')
    expect(box).toMatch(/const due = own \|\| deadline;/)
    expect(box).toMatch(/\/preview`, \{ deadline: due, choices \}\)/)
    expect(box).toMatch(/\/send`, \{ deadline: due, choices \}\)/)
    expect(box).toMatch(/const key = JSON\.stringify\(\[due, choices\]\);/)
    expect(box, 'معاينة قديمة تعرض بعد تغير الموعد أو الخيارات').toMatch(/\{open && shown && shown\.key === key && \(/)
  })
})

/* ═══ يختار صاحبُ المنصّة ما تقوله الرسالة (٢١ أكتوبر ٢٠٢٦): «قد أريد ألّا أذكر الدورات نهائيّا، وأذكّره بصورته
   أو نبذته» — أو أذكّره بنقلها إلى موسمٍ قادم لأنّا اتّفقنا ألّا يكملها ═══ */
describe('ما تقوله الرسالة يختار', () => {
  const many: ReminderFacts = {
    ...base, openCohorts: ['أ — شعبة ١'], noPhoto: true, pendingBio: true,
    courses: [course('to_decide'), course('preparing', { cohortId: 'c1', cohortTitle: 'شعبة أ' })],
  }
  it('بلا خيارات: الرسالة كما كانت', () => {
    expect(text(many).t).toBe(text(many, {}).t)
  })
  it('لا تذكر الدورات: لا إضافة ولا اعتذار ولا نقل — ويبقى ما اختير من العالق', () => {
    const { t, m } = text(many, { courses: 'none', skip: ['plan:c1'] })
    expect(t).not.toMatch(/إضافة دورة|اعتذر|انقل|خطة «شعبة أ»/)
    expect(t).toMatch(/أضف صورتك/)
    expect(t).toMatch(/نبذتك/)
    expect(m.subject).not.toMatch(/تضيف/)
  })
  it('نقلها لموسم قادم: يذكر بالنقل ولا يسأل أن يضيف', () => {
    const { t } = text(many, { courses: 'postpone' })
    expect(t).toMatch(/لا تنس أن تنقل دوراتك التي ستقدمها لاحقا إلى موسم قادم/)
    expect(t).not.toMatch(/إضافة دورة أخرى/)
  })
  it('وما يترك من العالق لا يذكر، وسطر الشعبة يترك', () => {
    const { t } = text(many, { skip: ['photo'], cohorts: false })
    expect(t).not.toMatch(/أضف صورتك/)
    expect(t).toMatch(/نبذتك/)
    expect(t).not.toMatch(/مفتوحة للتسجيل/)
  })
  it('الموعد: بلا موعد لا تاريخ، وإغلاق الملف لا يقال لمن طلب منه غير أن يبدأ', () => {
    expect(text(many, { due: 'none' }).t).not.toMatch(/27 أكتوبر/)
    const noStart = text(base, { courses: 'postpone', due: 'close' })
    expect(noStart.t).not.toMatch(/إغلاق ملفه/)
    expect(noStart.t).toMatch(/نرجو إكمال ذلك قبل الثلاثاء 27 أكتوبر 2026/)
    expect(text(base, { courses: 'none', due: 'none' }).m.subject).not.toMatch(/27 أكتوبر/)
  })
  it('والصفحة ترسل ما اختير، والباب يقبله', () => {
    const routes = readFileSync(join(process.cwd(), 'server/http/routes/admin-trainer.routes.ts'), 'utf8')
    expect(routes).toMatch(/reminders\.preview\(profileId, body\.deadline, body\.choices\)/)
    expect(routes).toMatch(/reminders\.send\(req\.auth!\.userId, profileId, body\.deadline, body\.choices\)/)
  })
})

/* ═══ والشعبُ مرقّمةٌ لا جملةٌ متزاحمة (٢١ أكتوبر ٢٠٢٦): «الإيميلُ مكتظّ… لا أحدَ يقرأ هذه المعلومات المتراكمة» ═══ */
describe('الشعب مرتبة', () => {
  const titles = [
    'دورة المشاريع الممولة: من مقترح يقنع المانح إلى تقرير يرضيه — شعبة ١',
    'دورة الإنجليزية العامة، المستوى الأول: من الجملة المحفوظة إلى حديث يومي — شعبة ١',
  ]
  it('كل شعبة سطر مرقم باسمها القصير', () => {
    const { t, html } = text({ ...base, openCohorts: titles })
    expect(t).toContain('1. دورة المشاريع الممولة — شعبة ١\n2. دورة الإنجليزية العامة، المستوى الأول — شعبة ١')
    expect(html).toMatch(/>2\.<\/td>/)
    expect(t, 'العنوان الفرعي بقي').not.toMatch(/يقنع المانح/)
  })
  it('وإن التبست شعبتان بالقصير بقيت الأسماء كاملة', () => {
    expect(shortCohortTitles(['أ: س — شعبة ١', 'أ: ص — شعبة ١'])).toEqual(['أ: س — شعبة ١', 'أ: ص — شعبة ١'])
    expect(shortCohortTitles(['بلا فرعي'])).toEqual(['بلا فرعي'])
  })
})

/* ═══ والمنقولةُ إلى موسمٍ قادمٍ ليست مفتوحةً للتسجيل الآن (٢١ أكتوبر ٢٠٢٦): «لماذا يظهر في الإيميلات الدوراتُ التي
   قام المدرّبُ بنقلها فعلا وكأنّها من دوراته المفتوحة؟» ═══ */
describe('الشعب المنقولة', () => {
  const moved: ReminderFacts['moved'] = [
    { cohortId: 'm1', title: 'دورة استراتيجية التسعير: من التكلفة إلى القيمة — شعبة ٤', termAr: 'موسم الربيع 2027', pending: false },
    { cohortId: 'm2', title: 'دورة خطة العمل — شعبة ١', termAr: 'موسم الربيع 2027', pending: true },
  ]
  it('تسرد وحدها بموسمها لا مع المفتوحة — والطلب المنتظر يقال طلبا', () => {
    const { t } = text({ ...base, openCohorts: ['دورة أ — شعبة ١'], moved })
    expect(t).toContain('شعبتك «دورة أ — شعبة ١» مفتوحة للتسجيل الآن')
    expect(t).toContain('وهذه الشعب نقلتها إلى موسم قادم:\n\n1. دورة استراتيجية التسعير — شعبة ٤ (موسم الربيع 2027)\n2. دورة خطة العمل — شعبة ١ (طلبت نقلها إلى موسم الربيع 2027)')
  })
  it('من نقل شعبه كلها بدأ — لا يطلب منه أن يبدأ ولا ينذر بإغلاق ملفه', () => {
    const f = { ...base, moved }
    expect(hasStarted(f)).toBe(true)
    const { t } = text(f)
    expect(t).not.toMatch(/مفتوحة للتسجيل|إغلاق ملفه|وصلتنا خطة شعبتك/)
    expect(t).toMatch(/شكرا لك. هذه الشعب نقلتها إلى موسم قادم/)
  })
  it('ولا تطلب خطة المنقولة قبل الحملة', () => {
    const tasks = reminderTasks({ ...base, moved, courses: [course('preparing', { cohortId: 'm1', cohortTitle: 'شعبة أ' }), course('preparing', { cohortId: 'c9', cohortTitle: 'شعبة ب' })] })
    expect(tasks.map((x) => x.key)).toEqual(['plan:c9'])
  })
  /* وأنّ الخدمةَ تخرجها بطلب النقل المعتمَد أو المنتظر — بقاعدةٍ حقيقيّة في `prep-reminder-moved.test.ts` */
})

/* ═══ «ضع تاريخَ المراسلات إن أرسلنا للمدرّب سابقا، وهل قام بتنفيذ المطلوب» (صاحب المنصّة، ٢٤ أكتوبر ٢٠٢٦) ═══
   كلُّ إرسالٍ يحفظ ما طلبه بعينه، ويُقرأ بحال المدرّب الآن. والسؤالُ لا يُحكم عليه، والقديمُ لا يُدّعى عليه. */
describe('ما أرسلناه له من قبل، وهل نفذه', () => {
  const at = (d: string) => new Date(`${d}T09:00:00.000Z`)
  const then: ReminderFacts = {
    ...base, noPhoto: true, pendingBio: true,
    courses: [course('preparing', { cohortId: 'c1', cohortTitle: 'شعبة أ' })],
  }
  const sentWith = (facts: ReminderFacts, choices: MailChoices, day = '2026-10-21'): SentReminder => ({
    at: at(day), status: 'sent', deadline: '2026-10-31', started: hasStarted(facts), choices, asked: askedOf(facts, choices), tasks: reminderTasks(facts).length,
  })

  it('⚠️ ما طلبناه يحفظ بعينه — وما تركه صاحب المنصة لا يحفظ', () => {
    const asked = askedOf(then, { ...defaultChoices(then), skip: ['bio'] })
    expect(asked.map((a) => a.key)).toEqual(['start', 'plan:c1', 'photo'])
    expect(askedOf({ ...base, openCohorts: ['أ'] }, defaultChoices({ ...base, openCohorts: ['أ'] })).map((a) => a.key)).toEqual(['add'])
  })

  it('⚠️ ولكل ما طلبناه حاله الآن: نفذه إن لم يعد عالقا، وابدأ تمت إن بدأ', () => {
    const send = sentWith(then, defaultChoices(then))
    /* رفع صورته وأرسل خطته — فبدأ. والنبذة ما تزال تنتظره */
    const now: ReminderFacts = { ...then, noPhoto: false, courses: [course('submitted', { cohortId: 'c1', cohortTitle: 'شعبة أ' })] }
    const [h] = reminderHistory([send], now)
    expect(h.sent).toBe(true)
    expect(h.deadline).toBe('2026-10-31')
    expect(h.items.map((i) => [i.textAr, i.done])).toEqual([
      ['أن يبدأ بدورة', true],
      ['أكمل خطة «شعبة أ» وأرسلها', true],
      ['وافق على نبذتك أو عدلها', false],
      ['أضف صورتك', true],
    ])
    /* ولم يفعل شيئا: كلها لم تتم */
    expect(reminderHistory([send], then)[0].items.every((i) => i.done === false)).toBe(true)
  })

  it('والسؤال «هل تضيف دورة» لا يحكم عليه، و«انقل دوراتك» تمت إن لم يبق ما لم يقرر فيه', () => {
    const started: ReminderFacts = { ...base, openCohorts: ['أ'], courses: [course('to_decide')] }
    expect(reminderHistory([sentWith(started, defaultChoices(started))], started)[0].items).toEqual([{ textAr: 'سألناه هل يضيف دورة', done: null }])
    const post = sentWith(started, { ...defaultChoices(started), courses: 'postpone' })
    expect(reminderHistory([post], started)[0].items[0].done).toBe(false)
    expect(reminderHistory([post], { ...started, courses: [course('declined')] })[0].items[0].done).toBe(true)
  })

  it('⚠️ والإرسال القديم بلا أعيان يقال عدده — ولا يدعى أنه تم', () => {
    const old: SentReminder = { at: at('2026-10-20'), status: 'sent', deadline: '2026-10-27', started: false, choices: null, asked: null, tasks: 3 }
    const [h] = reminderHistory([old], then)
    expect(h.items).toEqual([{ textAr: 'أن يبدأ بدورة', done: false }])
    expect(h.unknownAr).toBe('و3 أمور عالقة — أرسلت قبل حفظ تفاصيلها')
  })

  it('الأحدث أولا، والذي لم يرسل يقال', () => {
    const a = sentWith(then, defaultChoices(then), '2026-10-20')
    const b = { ...sentWith(then, defaultChoices(then), '2026-10-23'), status: 'skipped' }
    const hs = reminderHistory([a, b], then)
    expect(hs.map((h) => h.at.slice(0, 10))).toEqual(['2026-10-23', '2026-10-20'])
    expect(hs.map((h) => h.sent)).toEqual([false, true])
  })
})
