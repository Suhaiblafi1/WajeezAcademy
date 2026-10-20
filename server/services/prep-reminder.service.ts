/* ═══ «ما بقي عليك، وموعدُه» — تذكيرٌ يُرسَل مدرّبا مدرّبا (٢٠ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «أرسل لهؤلاء جميعا — ولكلّ مدرّبٍ ما ينقصه وموعدا نهائيّا. حضّرها أنت وأنا أرسلها
   واحدةً واحدة». ومن وصلهم بريدُ «لا يلزمك شيء الآن» القديمُ منهم (`waitingOnThemselves` في الشاشة).

   وقالها صاحبُ المنصّة بعدها: «قل لهم إنّنا على وشك إطلاق الحملة التسويقيّة، فعليهم أن يسرعوا وإلّا ألغينا
   ملفّاتهم — بلطف». فالرسالةُ تقول السببَ والموعدَ وما يقع بعده، بلا تهديد.

   فمن اعتُمد توقيعُه (وبابُه مفتوح) وفي دوراته ما لم يكتمل من جهته: دورةٌ لم يقبلها، أو شعبةٌ لم يرسل
   خطّتَها، أو خطّةٌ رُدّت إليه ببطاقات. وما أرسله وينتظرنا، وما أُجّل، وما اعتُمد — ليس عليه.
   والرسالةُ تُعاين قبل الإرسال، ولا تُرسَل إلّا بنقرة. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { renderMail, type MailDoc } from './mail-template'
import { publicSiteUrl, sendDirectEmail } from './notification.service'
import { TrainerPrepService, type PrepCourse } from './trainer-prep.service'
import { fmtDateWith } from '../../src/application/text/format-ar'
import { ACADEMY_ZONE } from '../../src/application/trainer/cohort-period'

/** ما بقي عليه في الدورة — وما ليس عليه `null` */
export function missingAr(c: Pick<PrepCourse, 'state' | 'postponedTo'>): string | null {
  if (c.state === 'to_decide') return 'لم تقبلها بعد — اقبلها في «دوراتي» أو اعتذر عنها'
  if (c.state === 'preparing') return 'لم ترسل خطة شعبتها — أكملها في «شعبي» وأرسلها'
  if (c.state === 'returned' && !c.postponedTo) return 'رددناها إليك ببطاقات — اقبل كل بطاقة أو ارفضها ثم أرسلها'
  return null
}

export interface ReminderItem { titleAr: string; missingAr: string }

export function prepReminderMail(input: { name: string; items: ReminderItem[]; deadlineAr: string; portalUrl: string }): { subject: string; doc: MailDoc } {
  return {
    subject: `قبل إطلاق الحملة — ما بقي من دوراتك حتى ${input.deadlineAr}`,
    doc: {
      greetingName: input.name,
      preheader: `بقي عليك ${input.items.length === 1 ? 'دورة واحدة' : `${input.items.length} دورات`} — نرجو إكمالها قبل ${input.deadlineAr}.`,
      heading: 'ما بقي من دوراتك',
      blocks: [
        { kind: 'p', text: 'نستعد لإطلاق حملتنا التسويقية للموسم القادم قريبا، ونريد أن تكون دوراتك فيها من أول يوم. وتظهر الدورة في الحملة حين تكتمل وتعتمد.' },
        { kind: 'p', text: 'وهذا ما بقي عليك:' },
        { kind: 'facts', rows: input.items.map((i) => ({ label: i.titleAr, value: i.missingAr })) },
        { kind: 'callout', text: `نرجو إكمالها قبل ${input.deadlineAr}. وما لم يكتمل حتى هذا الموعد سنضطر آسفين إلى إغلاق ملفك على المنصة، ويسعدنا أن نعود للعمل معك متى كنت جاهزا.` },
        { kind: 'note', text: 'وإن احتجت وقتا أكثر أو تعذرت عليك دورة فرد على هذه الرسالة، ونتفاهم.' },
        { kind: 'cta', label: 'افتح «دوراتي»', href: input.portalUrl },
      ],
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

  /** من بقي عليه شيء — باسمه وبريده وما بقي */
  async list() {
    const profiles = await this.prisma.trainerProfile.findMany({
      where: {
        suspendedAt: null,
        application: { status: { in: ['onboarding', 'active'] } },
        contracts: { some: { status: { in: ['signature_approved', 'countersigned'] } } },
      },
      select: { id: true, legalNameAr: true, application: { select: { fullName: true, email: true } } },
    })
    const prep = new TrainerPrepService(this.prisma)
    const out: { profileId: string; name: string; email: string; items: ReminderItem[] }[] = []
    for (const p of profiles) {
      const items = (await prep.coursesOf(p.id))
        .map((c) => ({ titleAr: c.titleAr, missingAr: missingAr(c) }))
        .filter((i): i is ReminderItem => i.missingAr !== null)
      if (items.length > 0) out.push({ profileId: p.id, name: p.application.fullName, email: p.application.email, items })
    }
    return out.sort((a, b) => b.items.length - a.items.length)
  }

  /** المعاينة — ما يُرسَل بحرفه */
  async preview(profileId: string, deadline: string) {
    const row = (await this.list()).find((r) => r.profileId === profileId)
    if (!row) throw new AuthError('nothing_missing', 'لم يبق على هذا المدرب شيء', 404)
    const mail = prepReminderMail({ name: row.name, items: row.items, deadlineAr: deadlineAr(deadline), portalUrl: `${publicSiteUrl()}/trainer/qualifications` })
    return { to: row.email, subject: mail.subject, text: renderMail(mail.doc).text, row }
  }

  async send(actorId: string, profileId: string, deadline: string) {
    const p = await this.preview(profileId, deadline)
    const mail = prepReminderMail({ name: p.row.name, items: p.row.items, deadlineAr: deadlineAr(deadline), portalUrl: `${publicSiteUrl()}/trainer/qualifications` })
    const res = await sendDirectEmail(this.prisma, { to: p.to, subject: mail.subject, ...renderMail(mail.doc) })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.prep.reminder', entityType: 'trainer_profile', entityId: profileId,
      meta: { deadline, items: p.row.items.length, status: res.status },
    })
    return { sent: res.status, to: p.to }
  }
}
