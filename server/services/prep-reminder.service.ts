/* ═══ «قبل إطلاق الحملة» — رسالةٌ لكلّ مدرّبٍ بما نحتاجه منه، تُرسَل واحدةً واحدة (٢٠ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «أرسل لهؤلاء جميعا — ولكلّ مدرّبٍ ما ينقصه وموعدا نهائيّا. حضّرها أنت وأنا أرسلها
   واحدةً واحدة»، و«قل لهم إنّنا على وشك إطلاق الحملة التسويقيّة، فعليهم أن يسرعوا وإلّا ألغينا ملفّاتهم — بلطف».

   ═══ ثمّ أعاد كتابتَها (٢٠ أكتوبر ٢٠٢٦) ═══
   رأى النسخةَ الأولى تعدّ كلَّ دورةٍ لم يقبلها المدرّبُ واجبا: «هناك من قرّر أن يقدّم دورةً واحدةً فقط، فلماذا نقول
   له عُد إلى دوراتك واختر منها؟… ما لم يقبله ليس عالقا أمام وجوده مدرّبا لهذا الفصل». فصارت على حالين:
   · **لم تقم له شعبةٌ بعد** — وهو الأهمّ: ابدأ بدورةٍ واحدة؛ اقبلها وجهّز خطّتها. وما لن تقدّمه اعتذر عنه، وما تريده
     لاحقا اقبله ثمّ انقله إلى موسمٍ قادم. ومعها موعدٌ، وإغلاقُ الملفّ بعده — بلطف.
   · **له شعبةٌ مفتوحة** — نخبره بها، ونسأله: أتضيف غيرها؟ وما لن تقدّمه اعتذر عنه، وما تريده لاحقا انقله.
   وتحت الحالين ما هو عالقٌ فعلا، كلُّه رابطٌ إلى صفحته: خطّةٌ لم تُرسَل، وبطاقاتٌ تنتظر قرارَه، و«نبذتك» و«لماذا
   نفتخر بك» تنتظران موافقتَه، وصورةٌ لم تُرفع. «سهلةَ القراءة وسهلةَ التنفيذ وإيجابيّة».

   ═══ ثمّ: يختار صاحبُ المنصّة ما تقوله لكلّ مدرّب (٢١ أكتوبر ٢٠٢٦) ═══
   «يجب أن يكون لديّ الخيارُ بأن أحدّد ما هي المحتوياتُ التي أوافق أن ترسلها» — فقد يكون اتّفقَ مع مدرّبٍ ألّا يكمل
   دوراته، فلا يُسأل أن يضيف؛ يُذكَّر بنقلها إلى موسمٍ قادم، أو لا تُذكر الدوراتُ أصلا ويُذكَّر بصورته أو نبذته وحدَهما.
   فصارت أجزاؤها خياراتٍ (`MailChoices`): الدوراتُ ثلاثة (أن يضيف · أن ينقل · لا ذكر)، والشعبةُ المفتوحة، وكلُّ أمرٍ
   عالقٍ وحدَه، والموعدُ ثلاثة (بإغلاق الملفّ · موعدٌ وحدَه · بلا موعد). والافتراضُ هو الرسالةُ كما كانت.

   ═══ والمنقولةُ إلى موسمٍ قادمٍ ليست «مفتوحةً للتسجيل الآن» (٢١ أكتوبر ٢٠٢٦) ═══
   «لماذا يظهر في الإيميلات الدوراتُ التي قام المدرّبُ بنقلها فعلا وكأنّها من دوراته المفتوحة؟». الشعبةُ المنقولةُ
   تبقى `open` وتُزاح مواعيدُها (`cohort-move.service.ts`)، فكانت تُعدّ مع المفتوحة. فصارت وحدَها (`moved`): ما له
   طلبُ نقلٍ معتمَدٌ أو ينتظر، تُسرد بموسمها، ولا تُعدّ مفتوحةً، ولا تُطلب خطّتُها الآن. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { renderMail, type MailBlock, type MailDoc } from './mail-template'
import { publicSiteUrl, sendDirectEmail } from './notification.service'
import { TrainerPrepService, type PrepCourse } from './trainer-prep.service'
import { fmtDateWith } from '../../src/application/text/format-ar'
import { ACADEMY_ZONE } from '../../src/application/trainer/cohort-period'
import { termLabelAr } from '../../src/application/trainer/cohort-move'
import { TRAINING_SEASON_VALUES, type TrainingSeason } from '../../src/application/trainer/application-options'

/** ما هو عالقٌ عليه فعلا — ولكلٍّ صفحتُه، ومفتاحٌ ثابتٌ يُختار به في الرسالة أو يُترك */
export interface ReminderTask { key: string; textAr: string; path: string }

/** ما تقوله الرسالة — يختاره صاحبُ المنصّة لكلّ مدرّب (٢١ أكتوبر ٢٠٢٦) */
export interface MailChoices {
  /** more: أن يبدأ أو يضيف · postpone: أن ينقل ما بقي إلى موسمٍ قادم · none: لا ذكرَ للدورات */
  courses: 'more' | 'postpone' | 'none'
  /** سطرُ شعبته المفتوحة أو خطّتِه التي وصلت — لمن بدأ */
  cohorts: boolean
  /** مفاتيحُ ما يُترك من العالق */
  skip: string[]
  /** close: موعدٌ وإغلاقُ الملفّ (لمن لم يبدأ ويُطلب منه أن يبدأ) · date: موعدٌ وحدَه · none: بلا موعد */
  due: 'close' | 'date' | 'none'
}

/** الرسالةُ كما كانت قبل الخيارات */
export function defaultChoices(f: ReminderFacts): MailChoices {
  return { courses: 'more', cohorts: true, skip: [], due: hasStarted(f) ? 'date' : 'close' }
}

export interface ReminderFacts {
  /** شعبُه القائمة: مفتوحةٌ أو ممتلئةٌ أو جارية — بلا المنقولة */
  openCohorts: string[]
  /** شعبُه المنقولةُ إلى موسمٍ قادم (نقلٌ معتمَدٌ أو ينتظر) — وموسمُها */
  moved: { cohortId: string; title: string; termAr: string; pending: boolean }[]
  /** دوراتُه وحالُها — كما تقرؤها «دوراتي» */
  courses: Pick<PrepCourse, 'state' | 'postponedTo' | 'cohortId' | 'cohortTitle' | 'titleAr'>[]
  pendingBio: boolean
  pendingPitch: boolean
  noPhoto: boolean
}

/** لم تقم له شعبةٌ بعد: لا مفتوحة، ولا خطّةٌ أرسلها أو اعتُمدت */
export function hasStarted(f: ReminderFacts): boolean {
  return f.openCohorts.length > 0 || f.moved.length > 0 || f.courses.some((c) => c.state === 'submitted' || c.state === 'approved')
}

export function reminderTasks(f: ReminderFacts): ReminderTask[] {
  const out: ReminderTask[] = []
  const moved = new Set(f.moved.map((m) => m.cohortId))
  for (const c of f.courses) {
    /* والمنقولةُ إلى موسمٍ قادمٍ لا تُطلب خطّتُها قبل الحملة */
    if (c.cohortId && moved.has(c.cohortId)) continue
    const name = c.cohortTitle ?? c.titleAr
    if (c.state === 'preparing' && c.cohortId) out.push({ key: `plan:${c.cohortId}`, textAr: `أكمل خطة «${name}» وأرسلها`, path: `/trainer/cohort/${c.cohortId}` })
    if (c.state === 'returned' && !c.postponedTo && c.cohortId) out.push({ key: `cards:${c.cohortId}`, textAr: `راجع اقتراحاتنا على «${name}» واقبلها أو ارفضها`, path: `/trainer/cohort/${c.cohortId}` })
  }
  if (f.pendingBio) out.push({ key: 'bio', textAr: 'وافق على نبذتك أو عدلها', path: '/trainer/account#suggestions-h' })
  if (f.pendingPitch) out.push({ key: 'pitch', textAr: 'وافق على «لماذا نفتخر بك» أو عدلها', path: '/trainer/account#suggestions-h' })
  if (f.noPhoto) out.push({ key: 'photo', textAr: 'أضف صورتك', path: '/trainer/account' })
  return out
}

/** يستحقّ الرسالة: من لم يبدأ، أو من له ما هو عالق، أو من بدأ وفي دوراته ما لم يقرّر فيه */
export function needsReminder(f: ReminderFacts): boolean {
  return !hasStarted(f) || reminderTasks(f).length > 0 || f.courses.some((c) => c.state === 'to_decide')
}

export function reminderSummaryAr(f: ReminderFacts): string {
  const n = reminderTasks(f).length
  const left = n === 0 ? '' : ` — ${n === 1 ? 'أمر واحد عالق' : `${n} أمور عالقة`}`
  return hasStarted(f) ? `له شعبة${left}` : `لم يبدأ أي شعبة${left}`
}

/** اسمُ الشعبة بلا عنوانها الفرعيّ: «دورة المشاريع الممولة: من مقترح… — شعبة ١» ← «دورة المشاريع الممولة — شعبة ١».
 *  فإن التبست شعبتان بالقصير بقيت الأسماءُ كاملة — فالقِصَرُ لا يُشتري بالخلط */
export function shortCohortTitles(titles: string[]): string[] {
  const short = titles.map((t) => {
    const colon = t.indexOf(':')
    if (colon < 0) return t
    const dash = t.lastIndexOf(' — ')
    return `${t.slice(0, colon).trim()}${dash > colon ? t.slice(dash) : ''}`
  })
  return new Set(short).size === short.length ? short : titles
}

export function prepReminderMail(input: { name: string; facts: ReminderFacts; deadlineAr: string; siteUrl: string; choices?: MailChoices }): { subject: string; doc: MailDoc } {
  const { facts: f, siteUrl } = input
  const ch = input.choices ?? defaultChoices(f)
  const link = (text: string, path: string) => ({ text, href: `${siteUrl}${path}` })
  const started = hasStarted(f)
  const tasks = reminderTasks(f).filter((t) => !ch.skip.includes(t.key))
  const courses = link('«دوراتي»', '/trainer/qualifications')
  /* وإغلاقُ الملفّ إنذارٌ بألّا يبدأ — فلا يُقال إلّا لمن لم يبدأ ويُطلب منه أن يبدأ */
  const due = ch.due === 'close' && (started || ch.courses !== 'more') ? 'date' : ch.due

  const opening: MailBlock[] = []
  if (started && ch.cohorts) {
    /* والشعبُ قائمةٌ مرقّمة لا جملةٌ واحدة (٢١ أكتوبر ٢٠٢٦): «الإيميلُ مكتظّ… لا أحدَ يقرأ هذه المعلومات المتزاحمة» */
    if (f.openCohorts.length === 0 && f.moved.length === 0) opening.push({ kind: 'p', text: 'وصلتنا خطة شعبتك، وهي عندنا الآن. شكرا لك.' })
    else if (f.openCohorts.length === 1) opening.push({ kind: 'p', text: `شعبتك «${shortCohortTitles(f.openCohorts)[0]}» مفتوحة للتسجيل الآن. شكرا لك.` })
    else if (f.openCohorts.length > 1) opening.push(
      { kind: 'p', text: 'شكرا لك. شعبك هذه مفتوحة للتسجيل الآن:' },
      { kind: 'list', numbered: true, items: shortCohortTitles(f.openCohorts) },
    )
    if (f.moved.length > 0) {
      const names = shortCohortTitles(f.moved.map((m) => m.title))
      opening.push(
        { kind: 'p', text: `${f.openCohorts.length === 0 ? 'شكرا لك. ' : 'و'}${f.moved.length === 1 ? 'هذه الشعبة نقلتها' : 'هذه الشعب نقلتها'} إلى موسم قادم:` },
        /* والطلبُ الذي ينتظر قرارَنا يقال طلبا — لا نقلا تمّ */
        { kind: 'list', numbered: true, items: f.moved.map((m, i) => `${names[i]} (${m.pending ? `طلبت نقلها إلى ${m.termAr}` : m.termAr})`) },
      )
    }
  }
  if (ch.courses === 'more' && started) {
    opening.push(
      { kind: 'p', text: ['هل تريد إضافة دورة أخرى هذا الموسم؟ اقبلها من ', courses, '.'] },
      { kind: 'p', text: 'وما لن تقدمه أبدا اعتذر عنه، وما تريد تقديمه لاحقا انقله إلى موسم قادم.' },
    )
  } else if (ch.courses === 'more') {
    opening.push(
      { kind: 'p', text: 'لم تفتح لك شعبة بعد، ويكفي أن تبدأ بدورة واحدة:' },
      {
        kind: 'steps',
        items: [
          { textAr: 'افتح «دوراتي» واقبل الدورة التي ستقدمها هذا الموسم.', state: 'now' },
          { textAr: 'جهز خطة شعبتها وأرسلها — نراجعها ونفتحها للتسجيل.' },
          { textAr: 'وما لن تقدمه أبدا اعتذر عنه، وما تريد تقديمه لاحقا اقبله ثم انقله إلى موسم قادم.' },
        ],
      },
      { kind: 'cta', label: 'افتح «دوراتي»', href: `${siteUrl}/trainer/qualifications` },
    )
  } else if (ch.courses === 'postpone') {
    /* اتّفقنا معه ألّا يقدّم دوراته الآن — فلا يُسأل أن يضيف، ولا تبقى معلّقةً بلا موسم */
    opening.push({ kind: 'p', text: ['لا تنس أن تنقل دوراتك التي ستقدمها لاحقا إلى موسم قادم من ', courses, '، فتبقى لك ونعود إليها معا.'] })
  }

  const blocks: MailBlock[] = [
    { kind: 'p', text: 'نستعد لإطلاق حملتنا التسويقية للموسم القادم، ونحب أن تكون معنا فيها من أول يوم.' },
    ...opening,
  ]
  if (tasks.length > 0) {
    blocks.push({ kind: 'h', text: 'وبقي منك' }, { kind: 'list', items: tasks.map((t) => [link(t.textAr, t.path)]) })
  }
  /* والموعدُ لما يُطلب منه فعلا — والسؤالُ «أتضيف؟» لا موعدَ له */
  const asked = tasks.length > 0 || ch.courses === 'postpone' || (ch.courses === 'more' && !started)
  if (due === 'close') {
    blocks.push({ kind: 'callout', text: `نرجو أن تبدأ قبل ${input.deadlineAr}. ومن لم يبدأ حتى هذا الموعد سنضطر آسفين إلى إغلاق ملفه على المنصة، ويسعدنا أن نعود للعمل معك متى كنت جاهزا.` })
  } else if (due === 'date' && asked) {
    blocks.push({ kind: 'callout', text: ch.courses === 'more' && !started ? `نرجو أن تبدأ قبل ${input.deadlineAr}.` : `نرجو إكمال ذلك قبل ${input.deadlineAr}.` })
  }
  blocks.push({ kind: 'note', text: 'وإن احتجت مساعدة أو وقتا أكثر فرد على هذه الرسالة.' })

  const dated = due !== 'none' && asked
  const subject = ch.courses === 'more' && started
    ? (ch.cohorts ? 'قبل إطلاق حملتنا — شعبتك جاهزة، وهل تضيف غيرها؟' : 'قبل إطلاق حملتنا — هل تضيف دورة أخرى؟')
    : ch.courses === 'more' && !started
      ? `قبل إطلاق حملتنا — ابدأ بدورة واحدة${dated ? ` قبل ${input.deadlineAr}` : ''}`
      : `قبل إطلاق حملتنا — بقيت خطوات صغيرة${dated ? ` قبل ${input.deadlineAr}` : ''}`
  return {
    subject,
    doc: {
      greetingName: input.name,
      preheader: ch.courses === 'more' && !started
        ? `يكفي أن تبدأ بدورة واحدة${dated ? ` قبل ${input.deadlineAr}` : ''}.`
        : started && ch.cohorts ? 'شعبتك جاهزة للموسم القادم — وبقيت خطوات صغيرة.' : 'بقيت خطوات صغيرة قبل إطلاق حملتنا.',
      heading: 'نستعد لإطلاق حملتنا',
      blocks,
    },
  }
}

const deadlineAr = (day: string) =>
  fmtDateWith(new Date(`${day}T12:00:00.000Z`), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: ACADEMY_ZONE })

export class PrepReminderService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  private async factsOf(profileId: string, photo: { photoUrl: string | null; photoPendingKey: string | null }): Promise<ReminderFacts> {
    const [courses, open, pending, moves] = await Promise.all([
      new TrainerPrepService(this.prisma).coursesOf(profileId),
      this.prisma.cohortTrainer.findMany({
        where: { profileId, role: 'lead', cohort: { status: { in: ['open', 'full', 'active'] } } },
        select: { cohort: { select: { id: true, title: true } } },
      }),
      this.prisma.trainerTextSuggestion.findMany({ where: { profileId, status: 'pending' }, select: { kind: true } }),
      /* آخرُ طلب نقلٍ قائمٍ لكلّ شعبةٍ يقودها — معتمَدا أو ينتظر، والملغاةُ لا تُعدّ */
      this.prisma.cohortMoveRequest.findMany({
        where: { status: { in: ['approved', 'pending'] }, cohort: { status: { not: 'cancelled' }, trainers: { some: { profileId, role: 'lead' } } } },
        orderBy: { createdAt: 'desc' },
        select: { cohortId: true, toYear: true, toSeason: true, status: true, cohort: { select: { title: true } } },
      }),
    ])
    const moved: ReminderFacts['moved'] = []
    for (const m of moves) {
      if (moved.some((x) => x.cohortId === m.cohortId)) continue
      const season = (TRAINING_SEASON_VALUES as readonly string[]).includes(m.toSeason) ? (m.toSeason as TrainingSeason) : null
      moved.push({
        cohortId: m.cohortId, title: m.cohort.title, pending: m.status === 'pending',
        termAr: season ? termLabelAr({ year: m.toYear, season }) : `${m.toSeason} ${m.toYear}`,
      })
    }
    const movedIds = new Set(moved.map((m) => m.cohortId))
    return {
      openCohorts: open.filter((o) => !movedIds.has(o.cohort.id)).map((o) => o.cohort.title),
      moved,
      courses,
      pendingBio: pending.some((p) => p.kind === 'bio'),
      pendingPitch: pending.some((p) => p.kind === 'pitch'),
      noPhoto: !photo.photoUrl && !photo.photoPendingKey,
    }
  }

  /** من يستحقّ الرسالة — وخلاصةُ حاله لسطره في الصفحة */
  async list() {
    const profiles = await this.prisma.trainerProfile.findMany({
      where: {
        suspendedAt: null,
        application: { status: { in: ['onboarding', 'active'] } },
        contracts: { some: { status: { in: ['signature_approved', 'countersigned'] } } },
      },
      select: { id: true, photoUrl: true, photoPendingKey: true, application: { select: { fullName: true, email: true } } },
    })
    const out: { profileId: string; name: string; email: string; started: boolean; summaryAr: string; facts: ReminderFacts; tasks: ReminderTask[]; choices: MailChoices }[] = []
    for (const p of profiles) {
      const facts = await this.factsOf(p.id, p)
      if (!needsReminder(facts)) continue
      out.push({
        profileId: p.id, name: p.application.fullName, email: p.application.email, started: hasStarted(facts), summaryAr: reminderSummaryAr(facts), facts,
        /* وما يُختار في الرسالة: كلُّ عالقٍ بمفتاحه، والافتراضُ هو الرسالةُ كما كانت */
        tasks: reminderTasks(facts), choices: defaultChoices(facts),
      })
    }
    /* من لم يبدأ أوّلا — هو الأهمّ */
    return out.sort((a, b) => Number(a.started) - Number(b.started))
  }

  /** المعاينة — ما يُرسَل بحرفه */
  async preview(profileId: string, deadline: string, choices?: MailChoices) {
    const row = (await this.list()).find((r) => r.profileId === profileId)
    if (!row) throw new AuthError('nothing_missing', 'لم يبق على هذا المدرب شيء', 404)
    const mail = prepReminderMail({ name: row.name, facts: row.facts, deadlineAr: deadlineAr(deadline), siteUrl: publicSiteUrl(), choices })
    return { to: row.email, subject: mail.subject, text: renderMail(mail.doc).text, mail, row }
  }

  async send(actorId: string, profileId: string, deadline: string, choices?: MailChoices) {
    const p = await this.preview(profileId, deadline, choices)
    const res = await sendDirectEmail(this.prisma, { to: p.to, subject: p.mail.subject, ...renderMail(p.mail.doc) })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.prep.reminder', entityType: 'trainer_profile', entityId: profileId,
      meta: { deadline, started: p.row.started, tasks: reminderTasks(p.row.facts).length, choices: choices ?? defaultChoices(p.row.facts), status: res.status },
    })
    return { sent: res.status, to: p.to }
  }
}
