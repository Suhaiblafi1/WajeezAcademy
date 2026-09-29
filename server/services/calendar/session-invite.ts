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
     يحوّلها لصاحبه: الملفُّ بالتوقيت العالميّ (`ics.ts`). */

import { buildIcs, buildIcsBundle, type IcsEvent } from './ics'
import { renderMail, type MailBlock, type MailRich } from '../mail-template'
import { ACADEMY_EMAILS } from '../integrations.service'
import { whenAr } from '../../../src/application/learning/cohort-gate'
import { MIN_SESSION_MS } from '../../../src/application/trainer/session-length'
import { countAr } from '../../../src/application/text/count-ar'

/** دعوةٌ جديدة · موعدٌ تغيّر · لقاءٌ رُفع من التقويم */
export type InviteKind = 'new' | 'update' | 'cancel'

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
  now?: Date
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

/** اللقاءُ حدثا في التقويم — واحدا في الدعوة، وكثيرا في جدول الملتحق */
function sessionEvent(
  session: SessionInviteInput['session'], cohortTitle: string,
  join: SessionInviteInput['join'], pageUrl: string, now: Date,
): IcsEvent {
  const end = session.endsAt ?? new Date(session.startsAt.getTime() + MIN_SESSION_MS)
  return {
    uid: sessionInviteUid(session.id),
    title: `${session.title} — ${cohortTitle}`,
    startsAt: session.startsAt,
    durationMinutes: Math.max(15, Math.round((end.getTime() - session.startsAt.getTime()) / 60_000)),
    description: [
      `لقاءٌ مباشرٌ في «${cohortTitle}» — أكاديمية وجيز.`,
      join ? `رابطُ الدخول: ${join.url}` : `رابطُ الدخول في صفحة رحلتك: ${pageUrl}`,
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
  const when = whenAr(session.startsAt)

  const subject = input.kind === 'new'
    ? `دعوة: ${session.title} — ${when}`
    : input.kind === 'update'
      ? `تغيّر موعد: ${session.title} — ${when}`
      : `أُلغي من تقويمك: ${session.title}`

  const blocks: MailBlock[] = []
  if (input.kind === 'cancel') {
    blocks.push({ kind: 'p', text: `«${session.title}» في «${input.cohortTitle}» — كان ${when} بتوقيت عمّان.` })
    blocks.push({ kind: 'p', text: input.cancelWhyAr ?? 'رُفع هذا اللقاءُ من الجدول.' })
    blocks.push({ kind: 'note', text: 'أُرفق بهذه الرسالة ما يرفعه من تقويمك.' })
  } else {
    blocks.push({
      kind: 'facts',
      rows: [
        { label: 'اللقاء', value: session.title },
        { label: 'الشعبة', value: input.cohortTitle },
        { label: 'الموعد', value: `${when} — بتوقيت عمّان` },
      ],
    })
    if (input.kind === 'update') {
      blocks.push({ kind: 'p', text: 'تغيّر الموعدُ وبقي رابطُ الدخول نفسُه.' })
    }
    if (join) {
      blocks.push({ kind: 'cta', label: 'ادخل اللقاء', href: join.url })
      /* فقرةٌ لا تعليقٌ تحت الزرّ: التعليقُ لا يُكتب في النصّ الخالص (`mail-template`)،
         ومن قرأ الرسالةَ بلا HTML يجب أن يعرف ألّا يشارك رابطَه */
      if (join.personal) blocks.push({ kind: 'p', text: 'الرابطُ لك وحدَك — دخولُك به يُسجِّل حضورَك، فلا تشاركه.' })
    } else {
      blocks.push({ kind: 'p', text: ['رابطُ الدخول يظهر في ', { text: 'صفحة رحلتك', href: input.pageUrl }, ' قبل موعده.'] })
    }
    blocks.push({ kind: 'note', text: 'أُرفقت دعوةُ التقويم: افتحها يُضَف الموعدُ إلى تقويمك، ويتحدّث وحدَه إن تغيّر.' })
  }

  const { text, html } = renderMail({
    ...(input.to.name ? { greetingName: input.to.name } : {}),
    heading: input.kind === 'new'
      ? `لقاءٌ مباشرٌ في «${input.cohortTitle}»`
      : input.kind === 'update'
        ? `تغيّر موعدُ «${session.title}»`
        : `أُلغي «${session.title}» من تقويمك`,
    preheader: input.kind === 'cancel' ? (input.cancelWhyAr ?? 'رُفع هذا اللقاءُ من الجدول.') : `${when} بتوقيت عمّان`,
    blocks,
  })

  const ics = buildIcs({
    ...sessionEvent(session, input.cohortTitle, join, input.pageUrl, now),
    ...(input.kind === 'cancel' ? { description: input.cancelWhyAr ?? 'رُفع هذا اللقاءُ من الجدول.' } : {}),
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
   نفسِه، فيتحرّك ما أضافه ولا يتكرّر. */

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

const LIVE_FORMS = { one: 'لقاءٌ مباشر', two: 'لقاءان مباشران', few: 'لقاءاتٍ مباشرة', many: 'لقاءً مباشرا' } as const

export function sessionScheduleMail(input: SessionScheduleInput): SessionScheduleMail {
  const now = input.now ?? new Date()
  const sessions = [...input.sessions].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  const count = countAr(sessions.length, LIVE_FORMS)
  const first = sessions[0]

  const blocks: MailBlock[] = [
    { kind: 'p', text: `مواعيدُ ما بقي من لقاءات «${input.cohortTitle}» المباشرة — بتوقيت عمّان:` },
    {
      kind: 'list',
      items: sessions.map((s): MailRich => (s.join
        ? [`${whenAr(s.startsAt)} — ${s.title} · `, { text: 'ادخل اللقاء', href: s.join.url }]
        : [`${whenAr(s.startsAt)} — ${s.title} · رابطُه في `, { text: 'صفحة رحلتك', href: input.pageUrl }, ' قبل موعده'])),
    },
  ]
  if (sessions.some((s) => s.join?.personal)) {
    blocks.push({ kind: 'p', text: 'الروابطُ لك وحدَك — دخولُك بها يُسجِّل حضورَك، فلا تشاركها.' })
  }
  blocks.push({ kind: 'note', text: 'أُرفق ملفُّ تقويمٍ فيه اللقاءاتُ كلُّها: افتحه تُضَف إلى تقويمك. وما تغيّر منها بعدُ تصلك دعوتُه وحدَه.' })

  const { text, html } = renderMail({
    ...(input.to.name ? { greetingName: input.to.name } : {}),
    heading: `لقاءاتُك المباشرة في «${input.cohortTitle}»`,
    preheader: first ? `${count} — أوّلُها ${whenAr(first.startsAt)} بتوقيت عمّان` : count,
    blocks,
  })

  return {
    subject: `مواعيدُ لقاءاتك في «${input.cohortTitle}» — ${count}`,
    text, html,
    ics: buildIcsBundle(sessions.map((s) => sessionEvent(s, input.cohortTitle, s.join, input.pageUrl, now)), now),
    icsMethod: 'PUBLISH',
    icsFilename: `wajeez-cohort-${input.cohortId}.ics`,
  }
}
