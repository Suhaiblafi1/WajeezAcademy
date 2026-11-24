/* ═══ البريدُ الجماعيّ — حملاتٌ وقوائمُ في مكانٍ واحد (٢٢ نوفمبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: «i need to send emails to all leads from my website or leads from excel sheet i upload..
   using resend»، ثمّ «then build in my website so i can send all plus i will upgrade the resend to be 50k per
   month»، ثمّ «ok i need to be easy like i choose which list and what email to them.. multi campaign same place».

   ═══ ما يقع ═══

   ١) **القوائم** — ملفٌّ يُرفع (`parse.ts`) فتُحفظ صفوفُه قائمةً تُعاد وتُسمّى وتُحذف، والملفُّ لا يُحفظ. ومعها قوائمُ
      الموقع جاهزةً: الليداتُ كلُّها، وبحملتها، وبمصدرها — ومن مُحيت بياناتُه لا يدخلها.
   ٢) **الحملة** — موضوعٌ ونصٌّ وزرٌّ اختياريّ وقائمة. تُحفظ مسودّةً وتُعدَّل وتُنسخ لقائمةٍ أخرى، وتُجرَّب على بريد
      من يكتبها وحدَه قبل أن تُرسل.
   ٣) **الإرسال** — يُعدّ من تصله بعد أن يسقط من ألغى اشتراكَه والمكرّرُ وغيرُ الصالح، ولا يُرسَل إلّا والعددُ الذي
      رآه المرسلُ هو العددُ نفسُه (`confirmCount`): قائمةٌ تغيّرت بين العرض والضغط تُقال ولا تُرسَل صامتة. ثمّ يُكتب
      في طابور البريد القائم دفعاتٍ من خمسمئة — لا معاملةٌ واحدةٌ بعشرين ألفا — بمرجعٍ واحد (`batchId`) وغرضٍ واحد
      (`bulk.message`)، ولكلّ رسالةٍ رابطا الإلغاء: سطرٌ في تذييلها ورأسٌ بنقرةٍ واحدة.
   ٤) **الإيقاف** — ما لم يخرج بعدُ يُحذف من الطابور ويُعدّ، وما خرج خرج.
   ٥) **والإرسالُ نفسُه في العامل** بمهلته (`drain.ts` و`mail-pacer.ts`): العاجلُ أوّلا، ولا أكثرَ من ثمانٍ في الثانية.

   وكلُّه بصلاحيّة الكوبونات (`commerce.manage`) كرسالة المنحة، وأثرٌ يسمّي من رفع وجرّب وأرسل وأوقف.
   والحارس: `server/tests/commerce/bulk-mail.test.ts`. */

import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { recordAudit } from '../audit'
import { AuthError } from '../auth.service'
import { enqueueMails, OUTBOX_MAX_ATTEMPTS, type OutboxEntry } from '../outbox.service'
import { renderMail, type MailBlock, type MailRich } from '../mail-template'
import { optedOut, unsubscribeLinks } from '../mail-optout.service'
import { liveChannels, sendDirectEmail, type DirectMailResult } from '../notification.service'
import { cleanEmail, parseMailFile } from './parse'
import { phoneTail } from '../../../src/application/advisor/phone-tail'
import { bulkSender, type BulkSender } from './sender'
import { messageParagraphs } from '../../../src/application/commerce/grant-registrants'
import { linkSegments } from '../../../src/application/text/linkify'
import {
  BULK_MAIL_PURPOSE, LEAD_SOURCE_AR, MAX_STAGES, etaMinutes, greetingAr, parseAudience, stagePlan,
  type CampaignStatus, type SendCheck, type SkipRecentDays,
} from '../../../src/application/marketing/bulk-mail'

type Db = PrismaClient | Prisma.TransactionClient

/** صفوفٌ تُكتب في الطابور بأمرٍ واحد — حملةُ عشرين ألفا أربعون أمرا لا معاملةٌ واحدة */
export const ENQUEUE_CHUNK = 500
/** وصفوفُ القائمة تُحفظ دفعاتٍ كذلك — وحدُّ المعاملات في PostgreSQL ٦٥ ألفَ قيمةٍ للأمر الواحد */
const SAVE_CHUNK = 5_000
const IN_CHUNK = 10_000
const DAY_MS = 24 * 3_600_000

/* ─────────── الرسالة ─────────── */

export interface CampaignContent {
  subject: string
  body: string
  buttonLabel?: string | null
  buttonUrl?: string | null
}

export interface Person { email: string; name: string | null }

/** الفقرةُ بروابطها تُضغط — «https://…» يكتبه صاحبُ المنصّة في نصّه فيصل رابطا لا حرفا ميّتا */
function richOf(paragraph: string): MailRich {
  const segs = linkSegments(paragraph)
  if (!segs.some((s) => s.kind === 'link')) return paragraph
  return segs.map((s) => (s.kind === 'link' ? { text: s.text, href: s.href } : s.text))
}

/** رسالةُ الحملة لشخص: تحيّتُه باسمه الأوّل، ورابطا إلغائه */
export function renderCampaign(c: CampaignContent, person: Person): { text: string; html: string; oneClick: string } {
  const paragraphs = messageParagraphs(c.body)
  const links = unsubscribeLinks(person.email)
  const blocks: MailBlock[] = paragraphs.map((p) => ({ kind: 'p' as const, text: richOf(p) }))
  if (c.buttonLabel?.trim() && c.buttonUrl?.trim()) blocks.push({ kind: 'cta', label: c.buttonLabel.trim(), href: c.buttonUrl.trim() })
  const out = renderMail({
    greeting: greetingAr(person.name),
    preheader: (paragraphs[0] ?? c.subject).slice(0, 140),
    heading: c.subject.trim(),
    blocks,
    unsubscribeUrl: links.page,
  })
  return { ...out, oneClick: links.oneClick }
}

function checkContent(c: CampaignContent): void {
  if (!c.subject.trim()) throw new AuthError('bad_subject', 'اكتب عنوان الرسالة', 400)
  if (messageParagraphs(c.body).length === 0) throw new AuthError('bad_body', 'اكتب نص الرسالة', 400)
  const label = c.buttonLabel?.trim()
  const url = c.buttonUrl?.trim()
  if (!!label !== !!url) throw new AuthError('bad_button', 'للزر نص ورابط معا، أو اتركهما فارغين', 400)
  if (url && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(url)) throw new AuthError('bad_button', 'رابط الزر يبدأ بـ https://', 400)
}

/* ─────────── القوائم ─────────── */

async function optedOutChunked(db: Db, emails: readonly string[]): Promise<Set<string>> {
  const out = new Set<string>()
  for (let i = 0; i < emails.length; i += IN_CHUNK) {
    for (const e of await optedOut(db, emails.slice(i, i + IN_CHUNK))) out.add(e)
  }
  return out
}

/** ما في الملفّ قبل حفظه: الأعدادُ وأوّلُ عشرين صفّا، وكم منهم ألغى اشتراكَه */
export async function previewUpload(prisma: PrismaClient, buffer: Buffer) {
  const parsed = await parseMailFile(buffer)
  const off = await optedOutChunked(prisma, parsed.entries.map((e) => e.email))
  return {
    totalRows: parsed.totalRows,
    valid: parsed.entries.length,
    invalid: parsed.invalid,
    duplicates: parsed.duplicates,
    corrected: parsed.corrected,
    optedOut: off.size,
    emailColumn: parsed.emailColumn,
    nameColumn: parsed.nameColumn,
    sample: parsed.entries.slice(0, 20),
    invalidSamples: parsed.invalidSamples,
  }
}

/** يحفظ الملفَّ قائمة — صفوفُه لا هو */
export async function createList(prisma: PrismaClient, buffer: Buffer, input: { name: string; fileName?: string | null }, actorId: string, ip?: string) {
  const parsed = await parseMailFile(buffer)
  if (parsed.entries.length === 0) throw new AuthError('no_emails', 'لا بريد صالح في الملف', 400)
  const name = input.name.trim() || input.fileName?.trim() || 'قائمة بلا اسم'
  const list = await prisma.$transaction(async (tx) => {
    const created = await tx.mailList.create({
      data: {
        name, fileName: input.fileName?.trim() || null, createdBy: actorId,
        totalRows: parsed.totalRows, invalidRows: parsed.invalid, duplicateRows: parsed.duplicates,
      },
    })
    for (let i = 0; i < parsed.entries.length; i += SAVE_CHUNK) {
      await tx.mailListEntry.createMany({
        data: parsed.entries.slice(i, i + SAVE_CHUNK).map((e) => ({ listId: created.id, email: e.email, name: e.name })),
        skipDuplicates: true,
      })
    }
    await recordAudit(tx, {
      action: 'bulk_mail.list_upload', entityType: 'mail_list', entityId: created.id, actorId, ip,
      meta: { name, fileName: input.fileName ?? null, totalRows: parsed.totalRows, valid: parsed.entries.length, invalid: parsed.invalid, duplicates: parsed.duplicates },
    })
    return created
  }, { timeout: 120_000 })
  return { id: list.id, name: list.name, count: parsed.entries.length }
}

export async function renameList(prisma: PrismaClient, id: string, name: string, actorId: string, ip?: string) {
  const clean = name.trim()
  if (!clean) throw new AuthError('bad_name', 'اكتب اسم القائمة', 400)
  const had = await prisma.mailList.findUnique({ where: { id }, select: { name: true } })
  if (!had) throw new AuthError('not_found', 'لم نجد القائمة', 404)
  await prisma.mailList.update({ where: { id }, data: { name: clean } })
  await recordAudit(prisma, { action: 'bulk_mail.list_rename', entityType: 'mail_list', entityId: id, actorId, ip, before: { name: had.name }, after: { name: clean } })
  return { ok: true as const }
}

/** حذفُ قائمة: صفوفُها تُحذف معها، والحملاتُ التي أُرسلت إليها تبقى باسمها */
export async function deleteList(prisma: PrismaClient, id: string, actorId: string, ip?: string) {
  const had = await prisma.mailList.findUnique({ where: { id }, select: { name: true, _count: { select: { entries: true } } } })
  if (!had) throw new AuthError('not_found', 'لم نجد القائمة', 404)
  await prisma.$transaction(async (tx) => {
    await tx.mailList.delete({ where: { id } })
    /* ومسودّةٌ كانت على هذه القائمة تبقى بلا قائمةٍ يختار لها غيرَها — لا تُرسَل إلى ما حُذف */
    await tx.mailCampaign.updateMany({ where: { status: 'draft', audience: `list:${id}` }, data: { audience: null } })
    await recordAudit(tx, { action: 'bulk_mail.list_delete', entityType: 'mail_list', entityId: id, actorId, ip, meta: { name: had.name, count: had._count.entries } })
  })
  return { ok: true as const }
}

/* ─────────── الجمهور ─────────── */

export interface AudienceOption {
  key: string
  nameAr: string
  /** عناوينُ مختلفةٌ فيها — قبل أن يسقط من ألغى اشتراكَه */
  count: number
  kind: 'website' | 'list'
  fileName?: string | null
  createdAt?: string
  totalRows?: number
  invalidRows?: number
  duplicateRows?: number
}

const LEAD_BASE = Prisma.sql`"email" IS NOT NULL AND btrim("email") <> '' AND "erasedAt" IS NULL`

/** قوائمُ الموقع والقوائمُ المرفوعة — بأعدادها */
export async function audiences(prisma: PrismaClient): Promise<{ website: AudienceOption[]; lists: AudienceOption[] }> {
  const [all, byCampaign, bySource, names, lists] = await Promise.all([
    prisma.$queryRaw<{ n: number }[]>`SELECT count(DISTINCT lower(btrim("email")))::int AS n FROM "Lead" WHERE ${LEAD_BASE}`,
    prisma.$queryRaw<{ campaign: string; n: number }[]>`
      SELECT "campaign", count(DISTINCT lower(btrim("email")))::int AS n FROM "Lead"
      WHERE ${LEAD_BASE} AND "campaign" IS NOT NULL GROUP BY "campaign" ORDER BY n DESC`,
    prisma.$queryRaw<{ source: string; n: number }[]>`
      SELECT "source", count(DISTINCT lower(btrim("email")))::int AS n FROM "Lead"
      WHERE ${LEAD_BASE} AND "campaign" IS NULL GROUP BY "source" ORDER BY n DESC`,
    prisma.grantCampaign.findMany({ select: { slug: true, nameAr: true } }),
    prisma.mailList.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, fileName: true, createdAt: true, totalRows: true, invalidRows: true, duplicateRows: true, _count: { select: { entries: true } } },
    }),
  ])
  const campaignName = new Map(names.map((c) => [c.slug, c.nameAr]))
  const website: AudienceOption[] = [
    { key: 'leads:all', nameAr: 'كل الليدات من الموقع', count: all[0]?.n ?? 0, kind: 'website' },
    ...byCampaign.map((c) => ({ key: `leads:campaign:${c.campaign}`, nameAr: `ليدات ${campaignName.get(c.campaign) ?? c.campaign}`, count: c.n, kind: 'website' as const })),
    ...bySource.map((s) => ({ key: `leads:source:${s.source}`, nameAr: `ليدات ${LEAD_SOURCE_AR[s.source] ?? s.source}`, count: s.n, kind: 'website' as const })),
  ]
  return {
    website,
    lists: lists.map((l) => ({
      key: `list:${l.id}`, nameAr: l.name, count: l._count.entries, kind: 'list',
      fileName: l.fileName, createdAt: l.createdAt.toISOString(), totalRows: l.totalRows, invalidRows: l.invalidRows, duplicateRows: l.duplicateRows,
    })),
  }
}

interface Resolved { nameAr: string; people: Person[]; invalid: number; duplicate: number }

/** من في الجمهور: عناوينُ صالحةٌ مختلفة، وكم سقط لأنّه غيرُ صالحٍ أو مكرّر */
export async function resolveAudience(prisma: PrismaClient, key: string | null): Promise<Resolved> {
  const a = parseAudience(key)
  if (!a) throw new AuthError('no_audience', 'اختر القائمة أولا', 400)
  if (a.kind === 'list') {
    const list = await prisma.mailList.findUnique({ where: { id: a.id }, select: { name: true, invalidRows: true, duplicateRows: true } })
    if (!list) throw new AuthError('no_audience', 'القائمة حذفت. اختر قائمة أخرى', 400)
    const rows = await prisma.mailListEntry.findMany({ where: { listId: a.id }, select: { email: true, name: true }, orderBy: { id: 'asc' } })
    return { nameAr: list.name, people: rows, invalid: list.invalidRows, duplicate: list.duplicateRows }
  }
  const where: Prisma.LeadWhereInput = { email: { not: null }, erasedAt: null }
  let nameAr = 'كل الليدات من الموقع'
  if (a.scope === 'campaign') {
    where.campaign = a.value
    const c = await prisma.grantCampaign.findUnique({ where: { slug: a.value }, select: { nameAr: true } })
    nameAr = `ليدات ${c?.nameAr ?? a.value}`
  } else if (a.scope === 'source') {
    where.campaign = null
    where.source = a.value
    nameAr = `ليدات ${LEAD_SOURCE_AR[a.value] ?? a.value}`
  }
  const leads = await prisma.lead.findMany({ where, select: { email: true, fullName: true }, orderBy: { createdAt: 'asc' } })
  const seen = new Set<string>()
  const people: Person[] = []
  let invalid = 0
  let duplicate = 0
  for (const l of leads) {
    if (!l.email?.trim()) continue
    const email = cleanEmail(l.email)
    if (!email) { invalid += 1; continue }
    if (seen.has(email)) { duplicate += 1; continue }
    seen.add(email)
    people.push({ email, name: l.fullName })
  }
  return { nameAr, people, invalid, duplicate }
}

/** من خرجت إليه رسالةُ حملةٍ أو تنتظر مرحلتَها منذ `since` — بالطابور نفسِه، دفعاتٍ دفعات (`SKIP_RECENT_DAYS`) */
async function recentlyMailed(prisma: PrismaClient, emails: string[], since: Date): Promise<Set<string>> {
  const out = new Set<string>()
  for (let i = 0; i < emails.length; i += 5_000) {
    const rows = await prisma.outboxMail.findMany({
      where: { purpose: BULK_MAIL_PURPOSE, status: { in: ['queued', 'sent'] }, createdAt: { gte: since }, to: { in: emails.slice(i, i + 5_000) } },
      select: { to: true }, distinct: ['to'],
    })
    for (const r of rows) out.add(r.to.toLowerCase())
  }
  return out
}

/* ═══ ومن قال إنّه غيرُ مهتمّ لا تصله حملة — دائما (٢٣ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «أريد أن نستثني أيَّ شخصٍ قال على الواتساب إنّه غيرُ مهتمّ أو شيءٌ يدلّ أنّه غيرُ مهتمّ، مثلا اعترض
   على السعر أو ردّ بأيّ ردٍّ يوحي أنّه يريد أن نتوقّف». وردودُ واتساب تصل هاتفَ المستشار لا المنصّة، فالمنصّةُ تعرف ما سُجّل:
   · حالةُ مستشارٍ أُغلقت «غير مهتم» (`AdvisorCase.status = not_interested`) — بريدُ نموذجها وبريدُ حسابها.
   · و«توقّف» على واتساب (`WhatsAppOptOut`، بذيل الرقم) — بريدُ كلّ نموذجٍ برقمٍ ذيلُه منها.
   ويُطابَق ببريد القائمة المرفوعة أيضا: من في قائمة Excel وقال «غير مهتم» في نموذجه لا تصله. */
export async function notInterestedEmails(prisma: PrismaClient): Promise<Set<string>> {
  const out = new Set<string>()
  const add = (e: string | null | undefined) => { const c = e ? cleanEmail(e) : null; if (c) out.add(c) }
  const cases = await prisma.advisorCase.findMany({
    where: { status: 'not_interested' },
    select: { lead: { select: { email: true } }, client: { select: { email: true } } },
  })
  for (const c of cases) { add(c.lead?.email); add(c.client?.email) }
  const tails = new Set((await prisma.whatsAppOptOut.findMany({ select: { tail: true } })).map((r) => r.tail))
  if (tails.size > 0) {
    const leads = await prisma.lead.findMany({ where: { phone: { not: null }, email: { not: null } }, select: { phone: true, email: true } })
    for (const l of leads) { const t = phoneTail(l.phone); if (t && tails.has(t)) add(l.email) }
  }
  return out
}

/* ═══ ولا يتكرّر الشخصُ نفسُه: من هو في المنصّة، أو في قائمةٍ أخرى (٢٣ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «تخطَّ من هو موجودٌ بالمنصّة أو موجودٌ بقائمةٍ أخرى لكي لا يتكرّر الشخصُ نفسُه». فلقائمةٍ مرفوعةٍ
   خياران في التأكيد، مفتوحان افتراضا:
   · **في المنصّة**: من له حسابٌ ببريده، أو عبّأ أيَّ نموذجٍ (ليدٌ من أيّ مصدرٍ لم تُمحَ بياناتُه) — فهو يصله بريدُ المنصّة وحملاتُ
     ليداتها، ولا يُعامَل غريبا.
   · **في قائمةٍ أخرى**: من هو في قائمةٍ مرفوعةٍ غيرِ هذه — فرسالةُ كلّ قائمةٍ تصل من فيها وحدَه، مرّةً.
   ولليدات الموقع لا معنى للأوّل (كلُّهم في المنصّة) فلا يُعرض لها. والمطابقةُ بالبريد بحروفٍ صغيرة. */
async function onPlatform(prisma: PrismaClient, emails: string[]): Promise<Set<string>> {
  const out = new Set<string>()
  for (let i = 0; i < emails.length; i += 5_000) {
    const chunk = emails.slice(i, i + 5_000)
    const rows = await prisma.$queryRaw<{ e: string }[]>`
      SELECT lower(email) AS e FROM "User" WHERE lower(email) = ANY(${chunk})
      UNION SELECT lower(email) AS e FROM "Lead" WHERE email IS NOT NULL AND "erasedAt" IS NULL AND lower(email) = ANY(${chunk})`
    for (const r of rows) out.add(r.e)
  }
  return out
}

async function inOtherLists(prisma: PrismaClient, listId: string, emails: string[]): Promise<Set<string>> {
  const out = new Set<string>()
  for (let i = 0; i < emails.length; i += 5_000) {
    const rows = await prisma.mailListEntry.findMany({
      where: { listId: { not: listId }, email: { in: emails.slice(i, i + 5_000) } }, select: { email: true }, distinct: ['email'],
    })
    for (const r of rows) out.add(r.email)
  }
  return out
}

export interface RecipientOptions {
  /** تخطّي من وصلته حملةٌ في آخر كذا يوما (`SKIP_RECENT_DAYS`) */
  skipRecentDays?: SkipRecentDays
  /** تخطّي من هو في المنصّة — لقائمةٍ مرفوعةٍ وحدَها */
  skipPlatform?: boolean
  /** تخطّي من هو في قائمةٍ مرفوعةٍ أخرى — لقائمةٍ مرفوعةٍ وحدَها */
  skipOtherLists?: boolean
  now?: Date
}

/** من تصله الحملةُ لو أُرسلت الآن، ومن لا تصله ولماذا */
async function recipientsOf(prisma: PrismaClient, key: string | null, o: RecipientOptions = {}) {
  const r = await resolveAudience(prisma, key)
  const now = o.now ?? new Date()
  const off = await optedOutChunked(prisma, r.people.map((p) => p.email))
  const notInterested = await notInterestedEmails(prisma)
  const subscribed = r.people.filter((p) => !off.has(p.email) && !notInterested.has(p.email))
  const list = parseAudience(key)
  const listId = list?.kind === 'list' ? list.id : null
  const emails = subscribed.map((p) => p.email)
  const platform = listId && o.skipPlatform ? await onPlatform(prisma, emails) : new Set<string>()
  const afterPlatform = subscribed.filter((p) => !platform.has(p.email))
  const others = listId && o.skipOtherLists ? await inOtherLists(prisma, listId, afterPlatform.map((p) => p.email)) : new Set<string>()
  const afterOthers = afterPlatform.filter((p) => !others.has(p.email))
  const days = o.skipRecentDays ?? 0
  const recent = days > 0
    ? await recentlyMailed(prisma, afterOthers.map((p) => p.email), new Date(now.getTime() - days * DAY_MS))
    : new Set<string>()
  const to = afterOthers.filter((p) => !recent.has(p.email))
  const check: SendCheck = {
    recipients: to.length, audienceAr: r.nameAr, invalid: r.invalid, duplicate: r.duplicate,
    optedOut: r.people.filter((p) => off.has(p.email)).length,
    notInterested: r.people.filter((p) => !off.has(p.email) && notInterested.has(p.email)).length,
    onPlatform: subscribed.length - afterPlatform.length,
    inOtherLists: afterPlatform.length - afterOthers.length,
    recent: afterOthers.length - to.length,
    uploadedList: !!listId,
  }
  return { to, check }
}

/* ─────────── الحملات ─────────── */

const campaignSelect = {
  id: true, status: true, subject: true, body: true, buttonLabel: true, buttonUrl: true, audience: true, audienceAr: true,
  fromName: true, fromEmail: true, stages: true,
  createdBy: true, createdAt: true, updatedAt: true, batchId: true, sentBy: true, sentAt: true, queuedCount: true,
  skippedOptOut: true, skippedInvalid: true, skippedDuplicate: true, stoppedBy: true, stoppedAt: true, cancelledCount: true,
  sentCount: true, failedCount: true, finishedAt: true,
} satisfies Prisma.MailCampaignSelect

type CampaignRow = Prisma.MailCampaignGetPayload<{ select: typeof campaignSelect }>

async function campaignOr404(prisma: PrismaClient, id: string): Promise<CampaignRow> {
  const c = await prisma.mailCampaign.findUnique({ where: { id }, select: campaignSelect })
  if (!c) throw new AuthError('not_found', 'لم نجد الحملة', 404)
  return c
}

export interface DraftInput {
  subject?: string
  body?: string
  buttonLabel?: string | null
  buttonUrl?: string | null
  audience?: string | null
}

const draftData = (d: DraftInput) => ({
  ...(d.subject !== undefined ? { subject: d.subject.trim() } : {}),
  ...(d.body !== undefined ? { body: d.body } : {}),
  ...(d.buttonLabel !== undefined ? { buttonLabel: d.buttonLabel?.trim() || null } : {}),
  ...(d.buttonUrl !== undefined ? { buttonUrl: d.buttonUrl?.trim() || null } : {}),
  ...(d.audience !== undefined ? { audience: d.audience && parseAudience(d.audience) ? d.audience : null } : {}),
})

export async function createCampaign(prisma: PrismaClient, input: DraftInput, actorId: string) {
  const c = await prisma.mailCampaign.create({ data: { ...draftData(input), createdBy: actorId }, select: { id: true } })
  return { id: c.id }
}

export async function updateCampaign(prisma: PrismaClient, id: string, input: DraftInput) {
  const { count } = await prisma.mailCampaign.updateMany({ where: { id, status: 'draft' }, data: draftData(input) })
  if (count === 0) {
    await campaignOr404(prisma, id)
    throw new AuthError('not_draft', 'أرسلت هذه الحملة. انسخها لتعدل عليها', 409)
  }
  return { ok: true as const }
}

/** نسخةٌ مسودّةٌ من حملة — لتُرسل الرسالةُ نفسُها إلى قائمةٍ أخرى */
export async function duplicateCampaign(prisma: PrismaClient, id: string, actorId: string) {
  const c = await campaignOr404(prisma, id)
  const copy = await prisma.mailCampaign.create({
    data: { subject: c.subject, body: c.body, buttonLabel: c.buttonLabel, buttonUrl: c.buttonUrl, audience: null, createdBy: actorId },
    select: { id: true },
  })
  return { id: copy.id }
}

/** حذفُ حملة — أيِّ حملة (٢٤ نوفمبر ٢٠٢٦، `campaignDeleteNoteAr`): ما لم يخرج منها يُحذف من الطابور فلا تخرج مرحلةٌ باقية،
    وما وصل يبقى صفُّه في الطابور حتّى يُقلَّم — فتخطّي من وصلته حملةٌ قريبا يبقى يعمل. والأثرُ يقول كم وصل وكم أُلغي */
export async function deleteCampaign(prisma: PrismaClient, id: string, actorId?: string, ip?: string) {
  const c = await campaignOr404(prisma, id)
  if (c.status === 'draft') {
    const { count } = await prisma.mailCampaign.deleteMany({ where: { id, status: 'draft' } })
    if (count === 0) throw new AuthError('not_draft', 'أرسلت هذه الحملة الآن. حدّث الصفحة', 409)
    return { ok: true as const, removed: 0 }
  }
  const batchId = c.batchId
  return prisma.$transaction(async (tx) => {
    const removed = batchId ? (await tx.outboxMail.deleteMany({ where: { batchId, status: { not: 'sent' } } })).count : 0
    const sent = batchId ? await tx.outboxMail.count({ where: { batchId, status: 'sent' } }) : 0
    await tx.mailCampaign.delete({ where: { id } })
    await recordAudit(tx, {
      action: 'bulk_mail.delete', entityType: 'mail_campaign', entityId: id, actorId: actorId ?? null, ip,
      meta: { batchId, subject: c.subject, status: c.status, sent: Math.max(sent, c.sentCount ?? 0), removed },
    })
    return { ok: true as const, removed }
  })
}

/** ما يُقال قبل الإرسال: من تصله ومن لا تصله ولماذا، وكم دقيقة */
export async function campaignCheck(prisma: PrismaClient, id: string, o: RecipientOptions = {}) {
  const c = await campaignOr404(prisma, id)
  const { check } = await recipientsOf(prisma, c.audience, o)
  const mailOn = (await liveChannels(prisma)).includes('email')
  const { name, email } = await bulkSender(prisma)
  return { ...check, etaMinutes: etaMinutes(check.recipients), mailOn, from: { name, email } }
}

/** حالُ كلّ حملة: أرقامُها المحفوظة، وما في الطابور الآن لما يُرسل */
export async function listCampaigns(prisma: PrismaClient) {
  await finalizeCampaigns(prisma)
  const rows = await prisma.mailCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 200, select: campaignSelect })
  const live = rows.filter((r) => r.status === 'sending' && r.batchId).map((r) => r.batchId!)
  const counts = live.length === 0 ? [] : await prisma.outboxMail.groupBy({
    by: ['batchId', 'status', 'notBefore'], where: { batchId: { in: live } }, _count: { _all: true },
  })
  const people = [...new Set(rows.flatMap((r) => [r.createdBy, r.sentBy, r.stoppedBy]).filter((x): x is string => !!x))]
  const users = people.length === 0 ? [] : await prisma.user.findMany({ where: { id: { in: people } }, select: { id: true, displayName: true } })
  const nameOf = new Map(users.map((u) => [u.id, u.displayName]))
  return {
    mailOn: (await liveChannels(prisma)).includes('email'),
    campaigns: rows.map((r) => {
      const mine = counts.filter((c) => c.batchId === r.batchId)
      const of = (status: string, at?: string | null) => mine
        .filter((c) => c.status === status && (at === undefined || (c.notBefore?.toISOString() ?? null) === at))
        .reduce((n, c) => n + c._count._all, 0)
      const sending = r.status === 'sending'
      /* والمراحلُ بأرقام كلٍّ منها ما دامت تُرسل — اليومُ الأوّلُ بلا موعد، وما بعده بموعده */
      const planned = Array.isArray(r.stages) ? (r.stages as { at: string; count: number }[]) : []
      const stages = planned.map((st, i) => {
        const at = i === 0 ? null : st.at
        return { at: st.at, count: st.count, sent: sending ? of('sent', at) : null, failed: sending ? of('failed', at) : null, waiting: sending ? of('queued', at) : null }
      })
      return {
        ...r,
        status: r.status as CampaignStatus,
        createdByName: r.createdBy ? nameOf.get(r.createdBy) ?? null : null,
        sentByName: r.sentBy ? nameOf.get(r.sentBy) ?? null : null,
        stoppedByName: r.stoppedBy ? nameOf.get(r.stoppedBy) ?? null : null,
        progress: {
          queued: r.queuedCount,
          sent: sending ? of('sent') : r.sentCount ?? 0,
          failed: sending ? of('failed') : r.failedCount ?? 0,
          waiting: sending ? of('queued') : 0,
          cancelled: r.cancelledCount,
          skipped: r.skippedOptOut + r.skippedInvalid + r.skippedDuplicate,
        },
        stages,
      }
    }),
  }
}

/* ─────────── التجربة ─────────── */

export type TestSender = (to: string, subject: string, text: string, html: string, unsubscribeUrl: string, from: BulkSender) => Promise<DirectMailResult>

/** تجربةٌ على بريد من يكتبها وحدَه — بالنصّ الذي في الشاشة ولو لم يُحفظ، وتخرج الآن لا في الطابور */
export async function sendTest(
  prisma: PrismaClient, content: CampaignContent, actorId: string, ip?: string,
  send: TestSender = (to, subject, text, html, unsubscribeUrl, from) => sendDirectEmail(prisma, { to, subject, text, html, unsubscribeUrl, from }),
) {
  checkContent(content)
  const me = await prisma.user.findUnique({ where: { id: actorId }, select: { email: true, displayName: true } })
  if (!me?.email) throw new AuthError('no_email', 'لا بريد في حسابك', 400)
  const mail = renderCampaign(content, { email: me.email, name: me.displayName })
  const subject = `[تجربة] ${content.subject.trim()}`
  /* ومن مُرسِل الحملات نفسِه — فالتجربةُ تكشف نطاقا لم يُوثَّق قبل أن تُكتب الحملة */
  const { name, email } = await bulkSender(prisma)
  const out = await send(me.email, subject, mail.text, mail.html, mail.oneClick, { name, email })
  await recordAudit(prisma, {
    action: 'bulk_mail.test', entityType: 'user', entityId: actorId, actorId, ip,
    meta: { subject: content.subject.trim(), from: email, status: out.status, error: out.status === 'failed' ? out.error ?? null : null },
  })
  return { to: me.email, from: email, status: out.status, error: out.status === 'failed' ? out.error ?? null : null }
}

/** ما تعرضه المعاينة: الرسالةُ كما تصل من يكتبها */
export async function previewHtml(prisma: PrismaClient, content: CampaignContent, actorId: string) {
  const me = await prisma.user.findUnique({ where: { id: actorId }, select: { email: true, displayName: true } })
  const mail = renderCampaign({ ...content, subject: content.subject || 'عنوان الرسالة', body: content.body || 'نص الرسالة' }, { email: me?.email ?? 'you@example.com', name: me?.displayName ?? null })
  return { html: mail.html }
}

/* ─────────── الإرسال ─────────── */

export async function sendCampaign(
  prisma: PrismaClient, id: string, confirmCount: number, actorId: string, ip?: string,
  opts: {
    chunk?: number
    /** الكاتبُ في الطابور — يُحقَن في الاختبار ليُعدّ كم أمرا كُتب، وافتراضُه `enqueueMails` */
    enqueue?: (entries: OutboxEntry[]) => Promise<number>
    /** حدودُ الأيّام الأولى إن أُرسلت على مراحل — والباقي في اليوم الذي بعدها (`stagePlan`). وبلاها دفعةً واحدة */
    stages?: readonly number[] | null
    /** تخطّي من وصلته حملةٌ في آخر كذا يوما — والعددُ الذي رآه في التأكيد محسوبٌ به (`campaignCheck`) */
    skipRecentDays?: SkipRecentDays
    skipPlatform?: boolean
    skipOtherLists?: boolean
    now?: Date
  } = {},
) {
  if (opts.stages && (opts.stages.length > MAX_STAGES - 1 || opts.stages.some((n) => !Number.isInteger(n) || n < 1))) {
    throw new AuthError('bad_stages', 'أعداد المراحل أرقام صحيحة أكبر من صفر', 400)
  }
  const c = await campaignOr404(prisma, id)
  if (c.status !== 'draft') throw new AuthError('not_draft', 'أرسلت هذه الحملة من قبل', 409)
  const content: CampaignContent = { subject: c.subject, body: c.body, buttonLabel: c.buttonLabel, buttonUrl: c.buttonUrl }
  checkContent(content)
  const { to, check } = await recipientsOf(prisma, c.audience, {
    skipRecentDays: opts.skipRecentDays, skipPlatform: opts.skipPlatform, skipOtherLists: opts.skipOtherLists, now: opts.now,
  })
  if (check.recipients === 0) throw new AuthError('no_recipients', 'لا أحد في القائمة تصله الرسالة', 400)
  /* العددُ الذي رآه هو ما يُرسَل — قائمةٌ تغيّرت بين العرض والضغط تُقال، ولا تُرسَل صامتة */
  if (confirmCount !== check.recipients) {
    throw new AuthError('count_changed', `تغير العدد: تصل الآن ${check.recipients} لا ${confirmCount}. راجع وأرسل من جديد`, 409)
  }

  const batchId = randomUUID()
  const now = opts.now ?? new Date()
  /* المراحلُ: اليومُ الأوّلُ الآن، وكلُّ يومٍ بعده بأربعٍ وعشرين ساعة — والعاملُ لا يأخذ صفّا قبل موعده (`drain.ts`) */
  const plan = stagePlan(to.length, opts.stages ?? null)
  const stages = plan.map((n, i) => ({ at: new Date(now.getTime() + i * DAY_MS).toISOString(), count: n }))
  const notBeforeOf: (Date | null)[] = []
  plan.forEach((n, i) => { for (let k = 0; k < n; k += 1) notBeforeOf.push(i === 0 ? null : new Date(stages[i].at)) })
  /* والمُرسِلُ يُكتب في الحملة ساعتَها — تغييرُه بعدها لا يمسّ حملةً في طريقها (`sender.ts`) */
  const from = await bulkSender(prisma)
  /* مرّةً واحدة: ضغطتان على «أرسل» لا تكتبان الحملةَ مرّتين */
  const { count } = await prisma.mailCampaign.updateMany({
    where: { id, status: 'draft' },
    data: {
      status: 'sending', batchId, sentBy: actorId, sentAt: now, audienceAr: check.audienceAr,
      skippedOptOut: check.optedOut, skippedInvalid: check.invalid, skippedDuplicate: check.duplicate,
      fromName: from.name, fromEmail: from.email, stages: plan.length > 1 ? stages : Prisma.DbNull,
    },
  })
  if (count === 0) throw new AuthError('not_draft', 'أرسلت هذه الحملة من قبل', 409)

  const chunk = opts.chunk ?? ENQUEUE_CHUNK
  let queued = 0
  try {
    for (let i = 0; i < to.length; i += chunk) {
      const entries: OutboxEntry[] = to.slice(i, i + chunk).map((p, k) => {
        const mail = renderCampaign(content, p)
        return {
          to: p.email, subject: content.subject.trim(), text: mail.text, html: mail.html,
          purpose: BULK_MAIL_PURPOSE, batchId, unsubscribeUrl: mail.oneClick, notBefore: notBeforeOf[i + k],
        }
      })
      queued += await (opts.enqueue ? opts.enqueue(entries) : enqueueMails(prisma, entries))
    }
  } finally {
    await prisma.mailCampaign.update({ where: { id }, data: { queuedCount: queued } })
    await recordAudit(prisma, {
      action: 'bulk_mail.send', entityType: 'mail_campaign', entityId: id, actorId, ip,
      meta: {
        batchId, subject: content.subject.trim(), audience: c.audience, audienceAr: check.audienceAr, queued, asked: check.recipients,
        optedOut: check.optedOut, invalid: check.invalid, duplicate: check.duplicate, recent: check.recent ?? 0,
        notInterested: check.notInterested ?? 0, onPlatform: check.onPlatform ?? 0, inOtherLists: check.inOtherLists ?? 0,
        skipPlatform: !!opts.skipPlatform, skipOtherLists: !!opts.skipOtherLists,
        skipRecentDays: opts.skipRecentDays ?? 0, from: from.email, stages: plan,
      },
    })
  }
  const mailOn = (await liveChannels(prisma)).includes('email')
  return { queued, batchId, etaMinutes: etaMinutes(plan[0] ?? 0), stages: plan, mailOn }
}

/** إيقافُ حملةٍ تُرسل: ما لم يخرج يُحذف من الطابور ويُعدّ، وما خرج خرج */
export async function stopCampaign(prisma: PrismaClient, id: string, actorId: string, ip?: string) {
  const c = await campaignOr404(prisma, id)
  if (c.status !== 'sending' || !c.batchId) throw new AuthError('not_sending', 'هذه الحملة لا ترسل الآن', 409)
  const batchId = c.batchId
  const out = await prisma.$transaction(async (tx) => {
    const { count: cancelled } = await tx.outboxMail.deleteMany({ where: { batchId, status: 'queued' } })
    const [sent, failed] = await Promise.all([
      tx.outboxMail.count({ where: { batchId, status: 'sent' } }),
      tx.outboxMail.count({ where: { batchId, status: 'failed' } }),
    ])
    await tx.mailCampaign.update({
      where: { id },
      data: { status: 'stopped', stoppedBy: actorId, stoppedAt: new Date(), cancelledCount: cancelled, sentCount: sent, failedCount: failed, finishedAt: new Date() },
    })
    await recordAudit(tx, {
      action: 'bulk_mail.stop', entityType: 'mail_campaign', entityId: id, actorId, ip,
      meta: { batchId, subject: c.subject, cancelled, sent, failed },
    })
    return { cancelled, sent, failed }
  })
  return out
}

/** حملةٌ لم يبق لها في الطابور ما يُحاوَل — تُكتب أرقامُها وتُعلَّم «أرسلت». يناديها العاملُ بعد كلّ دورة، والشاشةُ قبل العرض:
    صفوفُ الطابور المرسلةُ تُقلَّم بعد أسبوعين (`RETENTION_DAYS.outboxSent`)، والأرقامُ تبقى في الحملة */
export async function finalizeCampaigns(prisma: PrismaClient): Promise<string[]> {
  const sending = await prisma.mailCampaign.findMany({ where: { status: 'sending', batchId: { not: null } }, select: { id: true, batchId: true, subject: true } })
  const done: string[] = []
  for (const c of sending) {
    const batchId = c.batchId!
    const waiting = await prisma.outboxMail.count({ where: { batchId, status: 'queued', attempts: { lt: OUTBOX_MAX_ATTEMPTS } } })
    if (waiting > 0) continue
    const [sent, failed] = await Promise.all([
      prisma.outboxMail.count({ where: { batchId, status: 'sent' } }),
      prisma.outboxMail.count({ where: { batchId, status: { not: 'sent' } } }),
    ])
    const { count } = await prisma.mailCampaign.updateMany({
      where: { id: c.id, status: 'sending' },
      data: { status: 'sent', sentCount: sent, failedCount: failed, finishedAt: new Date() },
    })
    if (count === 0) continue
    await recordAudit(prisma, { action: 'bulk_mail.finished', entityType: 'mail_campaign', entityId: c.id, actorId: null, meta: { batchId, subject: c.subject, sent, failed } })
    done.push(c.id)
  }
  return done
}

