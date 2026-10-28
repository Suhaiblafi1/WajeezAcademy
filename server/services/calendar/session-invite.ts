/* دعوةُ لقاءٍ مباشر — رسالةٌ ومعها موعدٌ في التقويم (٢٩ سبتمبر ٢٠٢٦).

   قال صاحبُ المنصّة: «invite suhaib@wajeez.co and suhaib@wajeez.co to each
   meeting he sit once it approved and also this invitiation goes to each student
   in the class or jon later directly». وسُئل عن العنوان الثاني فاختار
   Academy@wajeez.co، وعن صفة المدعوَّين «Invited to attend»، وعن المتعلّمين
   «Our email + calendar».

   ═══ ما يقرّره هذا الملفّ ═══

   كيف يصير لقاءٌ رسالةً وموعدا في تقويم إنسان — بلا قاعدةٍ ولا شبكة. ومن
   يُدعى ومتى يقرّره `session-invite.service.ts`.

   · **المعرّفُ معرّفُ اللقاء** (`sessionInviteUid`) — وهو نفسُه في ملفّ «أضِفها
     لتقويمك» (`calendar.service.ts`). فمن أضافها بيده ثمّ وصلته الدعوةُ رأى
     موعدا واحدا لا اثنين، وكلُّ تحديثٍ بعدها يُحدّثه.
   · **والتسلسلُ من الساعة** (`inviteSequence`): التقويمُ يقبل التحديثَ إن علا
     رقمُه على ما عنده، ويتجاهله إن ساواه. فالرقمُ ثواني من أوّل ٢٠٢٦ لحظةَ
     الإرسال — يعلو مع كلّ إرسالٍ بلا عمودٍ يُحفظ فيه ويُنسى تحديثُه.
   · **ولا ردَّ يُطلب** (`rsvp: false`): المنظِّمُ عنوانُ الأكاديميّة الظاهر،
     ودعوةٌ تطلب ردّا من عشرين متعلّما تملأ صندوقَه بـ«قبل: …» عن كلّ لقاء.
   · **والساعةُ في الرسالة بتوقيت عمّان** — ساعةُ الشعبة (`whenAr`). والتقويمُ
     يحوّلها لصاحبه: الملفُّ بالتوقيت العالميّ (`ics.ts`).
   · **والمدرّبُ لا رابطَ له** (`audience: 'trainer'`، ٢٧ أكتوبر ٢٠٢٦): رابطُ المشارك يُدخله
     مشاركا لا مضيفا، ورابطُ المضيف يُطلب لحظةَ الضغط ولا يُرسَل (`trainerHostStart`). فيُقال له
     أين يبدؤه: صفحةُ شعبته — لا «صفحة رحلتك» ولا «بقي رابطُ الدخول نفسُه».
   · **والمنقولُ يقول «كان … وصار …» وسببَه** (`moved`، ٢٨ أكتوبر ٢٠٢٦): «We have changed the session time from X
     to Y, and we should write the reason». والسببُ بقلم من طلب النقل، ولكلٍّ بلغته (`session-move.ts`). وتحديثٌ
     بلا نقلٍ — صار له رابط — لا يقول «تغيّر موعد»: كان يقولها لموعدٍ لم يتغيّر. */

import { buildIcs, buildIcsBundle, type IcsEvent } from './ics'
import { renderMail, type MailBlock, type MailRich } from '../mail-template'
import { ACADEMY_EMAILS } from '../integrations.service'
import { whenAr } from '../../../src/application/learning/cohort-gate'
import { MIN_SESSION_MS } from '../../../src/application/trainer/session-length'
import { countAr } from '../../../src/application/text/count-ar'

/** دعوةٌ جديدة · موعدٌ تغيّر · لقاءٌ رُفع من التقويم */
export type InviteKind = 'new' | 'update' | 'cancel'

/** لمن تُكتب: المتعلّمُ (ومعه المدعوّان) يدخل برابطه، والمدرّبُ يبدأ اللقاءَ مضيفا من صفحة شعبته */
export type InviteAudience = 'learner' | 'trainer'

export interface SessionInviteInput {
  kind: InviteKind
  session: { id: string; title: string; startsAt: Date; endsAt: Date | null }
  cohortTitle: string
  to: { email: string; name?: string | null }
  /** رابطُ دخوله — ومعه أهو له وحدَه (مسجَّلٌ في Zoom باسمه) أم مشترك */
  join: { url: string; personal: boolean } | null
  /** أين يجد اللقاءَ في المنصّة إن لم يكن رابط */
  pageUrl: string
  /** سببُ الرفع من التقويم — يُقال في الرسالة */
  cancelWhyAr?: string
  /** نُقل اللقاء: موعدُه قبل النقل، ومن طلبه ولماذا بلغة من يقرأ — للتحديث وحدَه */
  moved?: SessionMove
  audience?: InviteAudience
  now?: Date
}

export interface SessionMove {
  fromStartsAt: Date
  whyAr: string
}

export interface SessionInviteMail {
  subject: string
  text: string
  html: string
  ics: string
  icsMethod: 'REQUEST' | 'CANCEL'
  icsFilename: string
}

const SEQUENCE_EPOCH = Date.UTC(2026, 0, 1)

/** رقمُ التحديث — يعلو مع كلّ إرسال */
export function inviteSequence(now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - SEQUENCE_EPOCH) / 1000))
}

/** معرّفُ اللقاء في كلّ تقويم — ثابتٌ عبر تحديثاته */
export function sessionInviteUid(sessionId: string): string {
  return `session-${sessionId}@wajeez-academy`
}

const ORGANIZER = { name: 'أكاديمية وجيز', email: ACADEMY_EMAILS.calendar }

/** أين يبدأ المدرّبُ لقاءه — بدل رابط الدخول */
const TRAINER_START_AR = 'تبدأ اللقاء مضيفا من صفحة شعبتك'

/** اللقاءُ حدثا في التقويم — واحدا في الدعوة، وكثيرا في جدول الملتحق */
function sessionEvent(
  session: SessionInviteInput['session'], cohortTitle: string,
  join: SessionInviteInput['join'], pageUrl: string, now: Date, audience: InviteAudience = 'learner',
  movedAr?: string,
): IcsEvent {
  const end = session.endsAt ?? new Date(session.startsAt.getTime() + MIN_SESSION_MS)
  return {
    uid: sessionInviteUid(session.id),
    title: `${session.title} — ${cohortTitle}`,
    startsAt: session.startsAt,
    durationMinutes: Math.max(15, Math.round((end.getTime() - session.startsAt.getTime()) / 60_000)),
    description: [
      `لقاء مباشر في «${cohortTitle}» — أكاديمية وجيز.`,
      ...(movedAr ? [movedAr] : []),
      join
        ? `رابط الدخول: ${join.url}`
        : audience === 'trainer' ? `${TRAINER_START_AR}: ${pageUrl}` : `رابط الدخول في صفحة رحلتك: ${pageUrl}`,
    ].join('\n'),
    ...(join ? { location: join.url } : {}),
    url: join?.url ?? pageUrl,
    organizer: ORGANIZER,
    sequence: inviteSequence(now),
    now,
  }
}

export function sessionInviteMail(input: SessionInviteInput): SessionInviteMail {
  const now = input.now ?? new Date()
  const { session, join } = input
  const trainer = input.audience === 'trainer'
  const when = whenAr(session.startsAt)
  /* والنقلُ يُقال في التحديث وحدَه — ودعوةٌ جديدةٌ أو رفعٌ لا «كان» لهما */
  const moved = input.kind === 'update' ? input.moved : undefined
  const was = moved ? whenAr(moved.fromStartsAt) : null

  const subject = input.kind === 'new'
    ? `دعوة: ${session.title} — ${when}`
    : input.kind === 'update'
      ? moved ? `تغيّر موعد: ${session.title} — ${when}` : `تحديث: ${session.title} — ${when}`
      : `ألغي من تقويمك: ${session.title}`

  const blocks: MailBlock[] = []
  if (input.kind === 'cancel') {
    blocks.push({ kind: 'p', text: `«${session.title}» في «${input.cohortTitle}» — كان ${when} بتوقيت عمّان.` })
    blocks.push({ kind: 'p', text: input.cancelWhyAr ?? 'رفع هذا اللقاء من الجدول.' })
    blocks.push({ kind: 'note', text: 'أرفق بهذه الرسالة ما يرفعه من تقويمك.' })
  } else {
    blocks.push({
      kind: 'facts',
      rows: [
        { label: 'اللقاء', value: session.title },
        { label: 'الشعبة', value: input.cohortTitle },
        ...(was
          ? [{ label: 'كان', value: was }, { label: 'صار', value: `${when} — بتوقيت عمّان` }]
          : [{ label: 'الموعد', value: `${when} — بتوقيت عمّان` }]),
      ],
    })
    if (moved) blocks.push({ kind: 'p', text: moved.whyAr })
    if (moved && !trainer) {
      blocks.push({ kind: 'p', text: 'تغيّر الموعد وبقي رابط الدخول نفسه.' })
    }
    if (join) {
      blocks.push({ kind: 'cta', label: 'ادخل اللقاء', href: join.url })
      /* فقرةٌ لا تعليقٌ تحت الزرّ: التعليقُ لا يُكتب في النصّ الخالص (`mail-template`)،
         ومن قرأ الرسالةَ بلا HTML يجب أن يعرف ألّا يشارك رابطَه */
      if (join.personal) blocks.push({ kind: 'p', text: 'الرابط لك وحدك — دخولك به يسجّل حضورك، فلا تشاركه.' })
    } else if (trainer) {
      blocks.push({ kind: 'p', text: ['تبدأ اللقاء مضيفا من ', { text: 'صفحة شعبتك', href: input.pageUrl }, ' في موعده.'] })
    } else {
      blocks.push({ kind: 'p', text: ['رابط الدخول يظهر في ', { text: 'صفحة رحلتك', href: input.pageUrl }, ' قبل موعده.'] })
    }
    blocks.push({ kind: 'note', text: 'أرفقت دعوة التقويم: افتحها يضف الموعد إلى تقويمك، ويتحدّث وحده إن تغيّر.' })
  }

  const { text, html } = renderMail({
    ...(input.to.name ? { greetingName: input.to.name } : {}),
    heading: input.kind === 'new'
      ? `لقاء مباشر في «${input.cohortTitle}»`
      : input.kind === 'update'
        ? moved ? `تغيّر موعد «${session.title}»` : `تحديث «${session.title}»`
        : `ألغي «${session.title}» من تقويمك`,
    preheader: input.kind === 'cancel'
      ? (input.cancelWhyAr ?? 'رفع هذا اللقاء من الجدول.')
      : was ? `من ${was} إلى ${when} بتوقيت عمّان` : `${when} بتوقيت عمّان`,
    blocks,
  })

  const ics = buildIcs({
    ...sessionEvent(session, input.cohortTitle, join, input.pageUrl, now, input.audience,
      moved ? `كان ${was} بتوقيت عمّان. ${moved.whyAr}` : undefined),
    ...(input.kind === 'cancel' ? { description: input.cancelWhyAr ?? 'رفع هذا اللقاء من الجدول.' } : {}),
    attendee: { name: input.to.name ?? undefined, email: input.to.email, rsvp: false },
    cancelled: input.kind === 'cancel',
  })

  return {
    subject, text, html, ics,
    icsMethod: input.kind === 'cancel' ? 'CANCEL' : 'REQUEST',
    icsFilename: `wajeez-session-${session.id}.ics`,
  }
}

/* ═══ ومن التحق بعد أن اعتُمدت لقاءاتُ شعبته — رسالةٌ واحدةٌ بما بقي ═══

   «or jon later directly». ووصفُ ما اختاره صاحبُ المنصّة («Our email +
   calendar»): من التحق لاحقا تصله رسالةٌ **واحدة** بكلّ ما بقي من لقاءاته —
   لا دعوةٌ لكلّ لقاءٍ تملأ صندوقَه ساعةَ يدفع.

   والملفُّ المرفقُ نشرٌ لا دعوة (`buildIcsBundle`: الدعوةُ عن موعدٍ واحد)،
   بمعرّفات اللقاءات نفسِها — فما تغيّر منها بعدُ تصله دعوةُ تحديثه بالمعرّف
   نفسِه، فيتحرّك ما أضافه ولا يتكرّر.

   والمدرّبُ يدخل شعبةً اعتُمدت لقاءاتُها — يُسنَد إليها أو يحلّ محلّ من رحل — فتصله الرسالةُ نفسُها
   بلا روابط، وسطرٌ واحدٌ يقول أين يبدأ كلَّ لقاء (`SessionInviteService.trainerJoined`). */

export interface ScheduleSession {
  id: string
  title: string
  startsAt: Date
  endsAt: Date | null
  join: { url: string; personal: boolean } | null
}

export interface SessionScheduleInput {
  cohortId: string
  cohortTitle: string
  to: { email: string; name?: string | null }
  /** ما بقي من لقاءاته — يُرتَّب هنا بموعده */
  sessions: readonly ScheduleSession[]
  pageUrl: string
  audience?: InviteAudience
  now?: Date
}

export interface SessionScheduleMail {
  subject: string
  text: string
  html: string
  ics: string
  icsMethod: 'PUBLISH'
  icsFilename: string
}

const LIVE_FORMS = { one: 'لقاء مباشر', two: 'لقاءان مباشران', few: 'لقاءات مباشرة', many: 'لقاء مباشرا' } as const

export function sessionScheduleMail(input: SessionScheduleInput): SessionScheduleMail {
  const now = input.now ?? new Date()
  const sessions = [...input.sessions].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  const count = countAr(sessions.length, LIVE_FORMS)
  const first = sessions[0]
  const trainer = input.audience === 'trainer'

  const blocks: MailBlock[] = [
    { kind: 'p', text: `مواعيد ما بقي من لقاءات «${input.cohortTitle}» المباشرة — بتوقيت عمّان:` },
    {
      kind: 'list',
      items: sessions.map((s): MailRich => (s.join
        ? [`${whenAr(s.startsAt)} — ${s.title} · `, { text: 'ادخل اللقاء', href: s.join.url }]
        : trainer
          ? `${whenAr(s.startsAt)} — ${s.title}`
          : [`${whenAr(s.startsAt)} — ${s.title} · رابطه في `, { text: 'صفحة رحلتك', href: input.pageUrl }, ' قبل موعده'])),
    },
  ]
  if (trainer) {
    blocks.push({ kind: 'p', text: ['تبدأ كل لقاء مضيفا من ', { text: 'صفحة شعبتك', href: input.pageUrl }, ' في موعده.'] })
  }
  if (sessions.some((s) => s.join?.personal)) {
    blocks.push({ kind: 'p', text: 'الروابط لك وحدك — دخولك بها يسجّل حضورك، فلا تشاركها.' })
  }
  blocks.push({ kind: 'note', text: 'أرفق ملفّ تقويم فيه اللقاءات كلّها: افتحه تضف إلى تقويمك. وما تغيّر منها بعد تصلك دعوته وحده.' })

  const { text, html } = renderMail({
    ...(input.to.name ? { greetingName: input.to.name } : {}),
    heading: `لقاءاتك المباشرة في «${input.cohortTitle}»`,
    preheader: first ? `${count} — أوّلها ${whenAr(first.startsAt)} بتوقيت عمّان` : count,
    blocks,
  })

  return {
    subject: `مواعيد لقاءاتك في «${input.cohortTitle}» — ${count}`,
    text, html,
    ics: buildIcsBundle(sessions.map((s) => sessionEvent(s, input.cohortTitle, s.join, input.pageUrl, now, input.audience)), now),
    icsMethod: 'PUBLISH',
    icsFilename: `wajeez-cohort-${input.cohortId}.ics`,
  }
}
