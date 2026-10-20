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
   نفتخر بك» تنتظران موافقتَه، وصورةٌ لم تُرفع. «سهلةَ القراءة وسهلةَ التنفيذ وإيجابيّة». */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { renderMail, type MailBlock, type MailDoc } from './mail-template'
import { publicSiteUrl, sendDirectEmail } from './notification.service'
import { TrainerPrepService, type PrepCourse } from './trainer-prep.service'
import { fmtDateWith } from '../../src/application/text/format-ar'
import { ACADEMY_ZONE } from '../../src/application/trainer/cohort-period'

/** ما هو عالقٌ عليه فعلا — ولكلٍّ صفحتُه */
export interface ReminderTask { textAr: string; path: string }

export interface ReminderFacts {
  /** شعبُه القائمة: مفتوحةٌ أو ممتلئةٌ أو جارية */
  openCohorts: string[]
  /** دوراتُه وحالُها — كما تقرؤها «دوراتي» */
  courses: Pick<PrepCourse, 'state' | 'postponedTo' | 'cohortId' | 'cohortTitle' | 'titleAr'>[]
  pendingBio: boolean
  pendingPitch: boolean
  noPhoto: boolean
}

/** لم تقم له شعبةٌ بعد: لا مفتوحة، ولا خطّةٌ أرسلها أو اعتُمدت */
export function hasStarted(f: ReminderFacts): boolean {
  return f.openCohorts.length > 0 || f.courses.some((c) => c.state === 'submitted' || c.state === 'approved')
}

export function reminderTasks(f: ReminderFacts): ReminderTask[] {
  const out: ReminderTask[] = []
  for (const c of f.courses) {
    const name = c.cohortTitle ?? c.titleAr
    if (c.state === 'preparing' && c.cohortId) out.push({ textAr: `أكمل خطة «${name}» وأرسلها`, path: `/trainer/cohort/${c.cohortId}` })
    if (c.state === 'returned' && !c.postponedTo && c.cohortId) out.push({ textAr: `راجع اقتراحاتنا على «${name}» واقبلها أو ارفضها`, path: `/trainer/cohort/${c.cohortId}` })
  }
  if (f.pendingBio) out.push({ textAr: 'وافق على نبذتك أو عدلها', path: '/trainer/account#suggestions-h' })
  if (f.pendingPitch) out.push({ textAr: 'وافق على «لماذا نفتخر بك» أو عدلها', path: '/trainer/account#suggestions-h' })
  if (f.noPhoto) out.push({ textAr: 'أضف صورتك', path: '/trainer/account' })
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

export function prepReminderMail(input: { name: string; facts: ReminderFacts; deadlineAr: string; siteUrl: string }): { subject: string; doc: MailDoc } {
  const { facts: f, siteUrl } = input
  const link = (text: string, path: string) => ({ text, href: `${siteUrl}${path}` })
  const started = hasStarted(f)
  const tasks = reminderTasks(f)
  const courses = link('«دوراتي»', '/trainer/qualifications')

  const opening: MailBlock[] = started
    ? [
        {
          kind: 'p',
          text: f.openCohorts.length === 0
            ? 'وصلتنا خطة شعبتك، وهي عندنا الآن. شكرا لك.'
            : f.openCohorts.length === 1
              ? `شعبتك «${f.openCohorts[0]}» مفتوحة للتسجيل الآن. شكرا لك.`
              : `شعبك ${f.openCohorts.map((t) => `«${t}»`).join(' و')} مفتوحة للتسجيل الآن. شكرا لك.`,
        },
        { kind: 'p', text: ['هل تريد إضافة دورة أخرى هذا الموسم؟ اقبلها من ', courses, '.'] },
        { kind: 'p', text: 'وما لن تقدمه أبدا اعتذر عنه، وما تريد تقديمه لاحقا انقله إلى موسم قادم.' },
      ]
    : [
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
      ]

  const blocks: MailBlock[] = [
    { kind: 'p', text: 'نستعد لإطلاق حملتنا التسويقية للموسم القادم، ونحب أن تكون معنا فيها من أول يوم.' },
    ...opening,
  ]
  if (tasks.length > 0) {
    blocks.push({ kind: 'h', text: 'وبقي منك' }, { kind: 'list', items: tasks.map((t) => [link(t.textAr, t.path)]) })
  }
  /* والموعدُ وإغلاقُ الملفّ لمن لم يبدأ وحدَه — ومن له شعبةٌ يُرجى منه ما بقي بلا إنذار */
  if (!started) {
    blocks.push({ kind: 'callout', text: `نرجو أن تبدأ قبل ${input.deadlineAr}. ومن لم يبدأ حتى هذا الموعد سنضطر آسفين إلى إغلاق ملفه على المنصة، ويسعدنا أن نعود للعمل معك متى كنت جاهزا.` })
  } else if (tasks.length > 0) {
    blocks.push({ kind: 'callout', text: `نرجو إكمالها قبل ${input.deadlineAr}.` })
  }
  blocks.push({ kind: 'note', text: 'وإن احتجت مساعدة أو وقتا أكثر فرد على هذه الرسالة.' })

  return {
    subject: started ? 'قبل إطلاق حملتنا — شعبتك جاهزة، وهل تضيف غيرها؟' : `قبل إطلاق حملتنا — ابدأ بدورة واحدة قبل ${input.deadlineAr}`,
    doc: {
      greetingName: input.name,
      preheader: started ? 'شعبتك جاهزة للموسم القادم — وبقيت خطوات صغيرة.' : `يكفي أن تبدأ بدورة واحدة قبل ${input.deadlineAr}.`,
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
    const [courses, open, pending] = await Promise.all([
      new TrainerPrepService(this.prisma).coursesOf(profileId),
      this.prisma.cohortTrainer.findMany({
        where: { profileId, role: 'lead', cohort: { status: { in: ['open', 'full', 'active'] } } },
        select: { cohort: { select: { title: true } } },
      }),
      this.prisma.trainerTextSuggestion.findMany({ where: { profileId, status: 'pending' }, select: { kind: true } }),
    ])
    return {
      openCohorts: open.map((o) => o.cohort.title),
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
    const out: { profileId: string; name: string; email: string; started: boolean; summaryAr: string; facts: ReminderFacts }[] = []
    for (const p of profiles) {
      const facts = await this.factsOf(p.id, p)
      if (!needsReminder(facts)) continue
      out.push({ profileId: p.id, name: p.application.fullName, email: p.application.email, started: hasStarted(facts), summaryAr: reminderSummaryAr(facts), facts })
    }
    /* من لم يبدأ أوّلا — هو الأهمّ */
    return out.sort((a, b) => Number(a.started) - Number(b.started))
  }

  /** المعاينة — ما يُرسَل بحرفه */
  async preview(profileId: string, deadline: string) {
    const row = (await this.list()).find((r) => r.profileId === profileId)
    if (!row) throw new AuthError('nothing_missing', 'لم يبق على هذا المدرب شيء', 404)
    const mail = prepReminderMail({ name: row.name, facts: row.facts, deadlineAr: deadlineAr(deadline), siteUrl: publicSiteUrl() })
    return { to: row.email, subject: mail.subject, text: renderMail(mail.doc).text, mail, row }
  }

  async send(actorId: string, profileId: string, deadline: string) {
    const p = await this.preview(profileId, deadline)
    const res = await sendDirectEmail(this.prisma, { to: p.to, subject: p.mail.subject, ...renderMail(p.mail.doc) })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.prep.reminder', entityType: 'trainer_profile', entityId: profileId,
      meta: { deadline, started: p.row.started, tasks: reminderTasks(p.row.facts).length, status: res.status },
    })
    return { sent: res.status, to: p.to }
  }
}
