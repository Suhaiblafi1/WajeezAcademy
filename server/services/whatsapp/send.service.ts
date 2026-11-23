/* ═══ الإرسالُ على واتساب — من تصله ومن لا، والطابورُ والوارد (٢٤ نوفمبر ٢٠٢٦) ═══

   ١) **الموافقةُ بغرضها.** من عبّأ نموذجَ المنحة وافق على التواصل «بخصوصها»، ومن ترك رقمَه آخرَ التشخيص «بخصوص نتيجتك
      فقط» — فهما لرسائل الخدمة وحدَها. والتسويقُ لمن سُجّلت موافقتُه عليه: كتب «اشترك» في واتساب، أو سجّله مديرٌ بنصّ
      موافقته. ودورةُ صاحب المنصّة الخاصّة ليست من جهات الأكاديميّة (رأسُ `PrivateCourse`) فلا تُقرأ هنا.
   ٢) **والإيقافُ يُسأل عنه مرّتين**: عند كتابة الطابور، وعند خروج كلّ رسالة — من كتب «توقف» بينهما لا تصله.
   ٣) **والعددُ الذي رآه المرسلُ هو ما يُرسَل** (`confirmCount`) كالبريد الجماعيّ.
   ٤) **والرسالةُ تُؤخذ قبل أن تخرج** (`SKIP LOCKED`)، وما انقطع في أثنائها لا يُعاد. وحدُّ اليوم بالأشخاص في أربعٍ وعشرين ساعة.
   ٥) **وكلُّ رسالةٍ تُمحى بعد ستة أشهر** — كبيانات من لم يسجّل (`guest-erasure.service.ts`). */

import type { PrismaClient } from '@prisma/client'
import { recordAudit } from '../audit'
import { AuthError } from '../auth.service'
import { GUEST_IDLE_DAYS } from '../guest-erasure.service'
import { whatsappStopped } from '../whatsapp-optout.service'
import { CloudError, cloudConfig, cloudReady, cloudTemplates, postTemplate, postText, type CloudConfig, type CloudTemplate } from './cloud'
import { GUEST_CONTACT_CONSENT_AR, normalizeIntlPhone } from '../../../src/application/advisor/guest-contact'
import { phoneTail } from '../../../src/application/advisor/phone-tail'
import { GRANT_CONSENT_AR } from '../../../src/application/commerce/grant-landing'
import {
  WA_NAME_PARAM, consentCovers, fillTemplate, isJoinWord, isStopWord, joinConsentAr, paramsFor, windowOpen,
  type WaCategory, type WaCheck, type WaConsentKind,
} from '../../../src/application/marketing/whatsapp-send'

const CHUNK = 500
const DAY_MS = 86_400_000

/* ─────────── الجمهور ─────────── */

export const AUDIENCES = {
  all: 'كل من تشمله الموافقة',
  opted: 'من وافق على رسائل واتساب',
  grant: 'من عبأ نموذج المنحة — بخصوصها فقط',
  result: 'من ترك رقمه بعد التشخيص — بخصوص نتيجته فقط',
} as const
export type AudienceKey = keyof typeof AUDIENCES

interface Row { phone: string | null; name: string | null; kinds: Set<WaConsentKind> }
export interface Person { phone: string; tail: string; name: string | null }

async function rowsOf(prisma: PrismaClient, key: AudienceKey): Promise<Row[]> {
  const out: Row[] = []
  if (key === 'all' || key === 'opted') {
    for (const c of await prisma.whatsAppConsent.findMany({ orderBy: { createdAt: 'asc' } })) {
      out.push({ phone: c.phone, name: c.name, kinds: new Set([c.kind as WaConsentKind]) })
    }
  }
  if (key !== 'opted') {
    const texts = key === 'grant' ? [GRANT_CONSENT_AR] : key === 'result' ? [GUEST_CONTACT_CONSENT_AR] : [GRANT_CONSENT_AR, GUEST_CONTACT_CONSENT_AR]
    const leads = await prisma.lead.findMany({
      where: { erasedAt: null, phone: { not: null }, ...(key === 'all' ? {} : { consentAr: { in: texts } }) },
      select: { phone: true, fullName: true, consentAr: true }, orderBy: { createdAt: 'asc' },
    })
    for (const l of leads) {
      out.push({ phone: l.phone, name: l.fullName, kinds: new Set(l.consentAr && texts.includes(l.consentAr) ? ['utility' as const] : []) })
    }
  }
  return out
}

export async function recipientsOf(prisma: PrismaClient, key: AudienceKey, category: WaCategory): Promise<{ to: Person[]; check: WaCheck }> {
  const merged = new Map<string, Person & { kinds: Set<WaConsentKind> }>()
  const rows = await rowsOf(prisma, key)
  let invalid = 0
  let duplicate = 0
  for (const r of rows) {
    const phone = normalizeIntlPhone(r.phone)
    const tail = phoneTail(phone)
    if (!phone || !tail) { invalid += 1; continue }
    const had = merged.get(tail)
    if (had) {
      duplicate += 1
      for (const k of r.kinds) had.kinds.add(k)
      had.name ??= r.name
    } else merged.set(tail, { phone, tail, name: r.name, kinds: new Set(r.kinds) })
  }
  const people = [...merged.values()]
  /* وموافقةٌ سُجّلت لرقمه في مكانٍ آخر تشمله هنا أيضا */
  const tails = people.map((p) => p.tail)
  for (let i = 0; i < tails.length; i += 5_000) {
    for (const c of await prisma.whatsAppConsent.findMany({ where: { tail: { in: tails.slice(i, i + 5_000) } }, select: { tail: true, kind: true } })) {
      merged.get(c.tail)?.kinds.add(c.kind as WaConsentKind)
    }
  }
  const allowed = people.filter((p) => consentCovers(category, p.kinds))
  const off = await whatsappStopped(prisma, allowed.map((p) => p.phone))
  const to = allowed.filter((p) => !off.has(p.tail)).map(({ phone, tail, name }) => ({ phone, tail, name }))
  return {
    to,
    check: { recipients: to.length, audienceAr: AUDIENCES[key], noConsent: people.length - allowed.length, optedOut: allowed.length - to.length, invalid, duplicate },
  }
}

/* ─────────── الموافقات ─────────── */

/** يسجّلها مديرٌ لأرقامٍ وافق أصحابُها — بنصّ ما وافقوا عليه، ومن أوقف لا يُعاد من هنا */
export async function importConsents(
  prisma: PrismaClient, input: { phones: string[]; kind: WaConsentKind; textAr: string }, actorId: string, ip?: string,
) {
  const textAr = input.textAr.trim()
  if (textAr.length < 10) throw new AuthError('no_text', 'اكتب كيف وافقوا وعلى ماذا', 422)
  let invalid = 0
  const people = new Map<string, string>()
  for (const raw of input.phones) {
    const phone = normalizeIntlPhone(raw)
    const tail = phoneTail(phone)
    if (!phone || !tail) invalid += 1
    else people.set(tail, phone)
  }
  const off = await whatsappStopped(prisma, [...people.values()])
  const data = [...people].filter(([tail]) => !off.has(tail))
    .map(([tail, phone]) => ({ tail, phone, kind: input.kind, source: 'import', textAr, createdBy: actorId }))
  const { count } = await prisma.whatsAppConsent.createMany({ data, skipDuplicates: true })
  await recordAudit(prisma, {
    action: 'whatsapp.consent_import', entityType: 'whatsapp', entityId: 'consent', actorId, ip,
    meta: { kind: input.kind, added: count, invalid, optedOut: off.size, textAr },
  })
  return { added: count, invalid, optedOut: off.size, existing: data.length - count }
}

/* ─────────── الإرسال ─────────── */

export interface SendInput { template: string; language: string; params: string[]; audience: AudienceKey }

export async function templateFor(prisma: PrismaClient, input: Pick<SendInput, 'template' | 'language' | 'params'>): Promise<CloudTemplate> {
  const t = (await cloudTemplates(prisma)).find((x) => x.name === input.template && x.language === input.language)
  if (!t) throw new AuthError('no_template', 'القالب غير معتمد عند Meta', 422)
  if (t.unsupportedAr) throw new AuthError('unsupported', `لا يرسل هذا القالب من هنا: ${t.unsupportedAr}`, 422)
  if (input.params.length !== t.slots || input.params.some((p) => !p.trim())) throw new AuthError('bad_params', 'املأ خانات القالب كلها', 422)
  return t
}

export async function checkSend(prisma: PrismaClient, input: SendInput) {
  const t = await templateFor(prisma, input)
  const { check } = await recipientsOf(prisma, input.audience, t.category)
  return { ...check, category: t.category, preview: fillTemplate(t.body, paramsFor(input.params, input.params.includes(WA_NAME_PARAM) ? 'أحمد' : null)) }
}

export async function sendCampaign(prisma: PrismaClient, input: SendInput, confirmCount: number, actorId: string, ip?: string) {
  if (!cloudReady(await cloudConfig(prisma))) throw new AuthError('off', 'الإرسال مغلق. افتحه من «الربط»', 409)
  const t = await templateFor(prisma, input)
  const { to, check } = await recipientsOf(prisma, input.audience, t.category)
  if (to.length === 0) throw new AuthError('empty', 'لا أحد تصله هذه الرسالة', 422)
  if (to.length !== confirmCount) throw new AuthError('count_changed', `تغير العدد إلى ${to.length}. راجعه ثم أرسل`, 409)
  return prisma.$transaction(async (tx) => {
    /* ضغطتان معا لا ترسلان مرّتين: حملةٌ بالقالب نفسِه والجمهور نفسِه ما زالت ترسل تُردّ */
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('whatsapp.send'))`
    const same = await tx.whatsAppCampaign.count({ where: { status: 'sending', template: t.name, language: t.language, audience: input.audience } })
    if (same > 0) throw new AuthError('already', 'هذا الإرسال جار الآن', 409)
    const c = await tx.whatsAppCampaign.create({
      data: {
        template: t.name, language: t.language, category: t.category, params: input.params, audience: input.audience,
        audienceAr: check.audienceAr, queuedCount: to.length, skippedConsent: check.noConsent, skippedOptOut: check.optedOut,
        skippedInvalid: check.invalid, skippedDuplicate: check.duplicate, sentBy: actorId,
      },
    })
    for (let i = 0; i < to.length; i += CHUNK) {
      await tx.whatsAppMessage.createMany({
        data: to.slice(i, i + CHUNK).map((p) => {
          const params = paramsFor(input.params, p.name)
          return {
            direction: 'out', tail: p.tail, phone: p.phone, name: p.name, body: fillTemplate(t.body, params), campaignId: c.id,
            template: t.name, language: t.language, category: t.category, params, createdBy: actorId,
          }
        }),
      })
    }
    await recordAudit(tx, {
      action: 'whatsapp.send', entityType: 'whatsapp', entityId: c.id, actorId, ip,
      meta: { template: t.name, category: t.category, audience: check.audienceAr, queued: to.length },
    })
    return { id: c.id, queued: to.length }
  }, { timeout: 60_000 })
}

export async function stopCampaign(prisma: PrismaClient, id: string, actorId: string, ip?: string) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.whatsAppCampaign.updateMany({
      where: { id, status: 'sending' }, data: { status: 'stopped', stoppedBy: actorId, finishedAt: new Date() },
    })
    if (count === 0) throw new AuthError('not_sending', 'هذا الإرسال ليس جاريا', 409)
    const cancelled = await tx.whatsAppMessage.updateMany({ where: { campaignId: id, status: 'queued' }, data: { status: 'cancelled' } })
    await tx.whatsAppCampaign.update({ where: { id }, data: { cancelledCount: cancelled.count } })
    await recordAudit(tx, { action: 'whatsapp.stop', entityType: 'whatsapp', entityId: id, actorId, ip, meta: { cancelled: cancelled.count } })
    return { cancelled: cancelled.count }
  })
}

export async function listCampaigns(prisma: PrismaClient) {
  const rows = await prisma.whatsAppCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
  const counts = await prisma.whatsAppMessage.groupBy({ by: ['campaignId', 'status'], where: { campaignId: { in: rows.map((r) => r.id) } }, _count: true })
  return rows.map((r) => ({
    ...r, counts: Object.fromEntries(counts.filter((c) => c.campaignId === r.id).map((c) => [c.status, c._count])) as Record<string, number>,
  }))
}

/* ─────────── المحادثات ─────────── */

export async function listThreads(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<{ tail: string; phone: string; name: string | null; body: string; direction: string; createdAt: Date; lastInbound: Date; unread: number }[]>`
    SELECT DISTINCT ON (m.tail) m.tail, m.phone, i.name, m.body, m.direction, m."createdAt", i.last AS "lastInbound", i.unread::int AS unread
    FROM "WhatsAppMessage" m
    JOIN (SELECT tail, max("createdAt") AS last, max(name) AS name, count(*) FILTER (WHERE "readAt" IS NULL) AS unread
          FROM "WhatsAppMessage" WHERE direction = 'in' GROUP BY tail) i ON i.tail = m.tail
    ORDER BY m.tail, m."createdAt" DESC`
  const off = await whatsappStopped(prisma, rows.map((r) => r.phone))
  return rows.sort((a, b) => +b.createdAt - +a.createdAt).slice(0, 200)
    .map((r) => ({ ...r, stopped: off.has(r.tail), open: windowOpen(r.lastInbound) }))
}

export async function readThread(prisma: PrismaClient, tail: string) {
  const messages = await prisma.whatsAppMessage.findMany({
    where: { tail, status: { notIn: ['cancelled'] } }, orderBy: { createdAt: 'desc' }, take: 100,
    select: { id: true, direction: true, status: true, body: true, error: true, createdAt: true },
  })
  await prisma.whatsAppMessage.updateMany({ where: { tail, direction: 'in', readAt: null }, data: { readAt: new Date() } })
  return messages.reverse()
}

export async function reply(prisma: PrismaClient, tail: string, body: string, actorId: string, ip?: string) {
  const c = await cloudConfig(prisma)
  if (!cloudReady(c)) throw new AuthError('off', 'الإرسال مغلق. افتحه من «الربط»', 409)
  const last = await prisma.whatsAppMessage.findFirst({ where: { tail, direction: 'in' }, orderBy: { createdAt: 'desc' } })
  if (!last || !windowOpen(last.createdAt)) throw new AuthError('closed', 'مضت 24 ساعة على آخر رسالة منه. أرسل له قالبا معتمدا', 409)
  if ((await whatsappStopped(prisma, [last.phone])).size) throw new AuthError('stopped', 'طلب ألا نراسله على واتساب', 409)
  const m = await prisma.whatsAppMessage.create({
    data: { direction: 'out', status: 'sending', tail, phone: last.phone, name: last.name, body, createdBy: actorId, startedAt: new Date() },
  })
  await recordAudit(prisma, { action: 'whatsapp.reply', entityType: 'whatsapp', entityId: m.id, actorId, ip })
  try {
    const metaId = await postText(c, last.phone, body)
    await prisma.whatsAppMessage.update({ where: { id: m.id }, data: { status: 'sent', metaId } })
  } catch (e) {
    const error = e instanceof Error ? e.message : 'خطأ'
    await prisma.whatsAppMessage.update({ where: { id: m.id }, data: { status: 'failed', error } })
    throw new AuthError('meta_error', `لم تصل: ${error}`, 502)
  }
  return { ok: true as const }
}

/* ─────────── العامل ─────────── */

/** أشخاصٌ بدأنا مراسلتَهم بقالبٍ في آخر أربعٍ وعشرين ساعة */
async function startedToday(prisma: PrismaClient): Promise<Set<string>> {
  const rows = await prisma.whatsAppMessage.findMany({
    where: { direction: 'out', template: { not: null }, startedAt: { gte: new Date(Date.now() - DAY_MS) }, status: { notIn: ['queued', 'cancelled'] } },
    select: { tail: true }, distinct: ['tail'],
  })
  return new Set(rows.map((r) => r.tail))
}

type Poster = (c: CloudConfig, phone: string, t: { name: string; language: string; params: string[] }) => Promise<string>

/** يُخرج ما في الطابور حتى `limit` — واحدةً بعد واحدة */
export async function drainWhatsApp(
  prisma: PrismaClient, opts: { limit: number; pace?: () => Promise<void>; send?: Poster } = { limit: 20 },
): Promise<{ sent: number; failed: number; waitMs: number }> {
  const c = await cloudConfig(prisma)
  /* ما انقطع العاملُ في أثنائه لا يُعاد — لا نعرف هل خرج */
  await prisma.whatsAppMessage.updateMany({
    where: { status: 'sending', startedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    data: { status: 'failed', error: 'انقطع الإرسال، ولا نعرف هل وصلت' },
  })
  let sent = 0
  let failed = 0
  if (!cloudReady(c)) return { sent, failed, waitMs: 30_000 }
  const today = await startedToday(prisma)
  for (let i = 0; i < opts.limit; i += 1) {
    if (today.size >= c.dailyCap) return { sent, failed, waitMs: 60_000 }
    const [row] = await prisma.$queryRaw<{ id: string }[]>`
      UPDATE "WhatsAppMessage" SET status = 'sending', "startedAt" = now() AT TIME ZONE 'UTC'
      WHERE id = (SELECT id FROM "WhatsAppMessage" WHERE status = 'queued'
        AND ("notBefore" IS NULL OR "notBefore" <= now() AT TIME ZONE 'UTC')
        ORDER BY "createdAt", id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id`
    if (!row) break
    const m = await prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: row.id } })
    if ((await whatsappStopped(prisma, [m.phone])).size) {
      await prisma.whatsAppMessage.update({ where: { id: m.id }, data: { status: 'cancelled', error: 'طلب ألا نراسله' } })
      continue
    }
    await opts.pace?.()
    try {
      const metaId = await (opts.send ?? postTemplate)(c, m.phone, { name: m.template ?? '', language: m.language ?? '', params: (m.params as string[] | null) ?? [] })
      await prisma.whatsAppMessage.update({ where: { id: m.id }, data: { status: 'sent', metaId } })
      today.add(m.tail)
      sent += 1
    } catch (e) {
      if (e instanceof CloudError && e.retry) {
        await prisma.whatsAppMessage.update({
          where: { id: m.id }, data: { status: 'queued', startedAt: null, notBefore: new Date(Date.now() + 15 * 60_000), error: e.message },
        })
        return { sent, failed, waitMs: 60_000 }
      }
      await prisma.whatsAppMessage.update({ where: { id: m.id }, data: { status: 'failed', error: e instanceof Error ? e.message.slice(0, 300) : 'خطأ' } })
      failed += 1
    }
  }
  return { sent, failed, waitMs: sent + failed >= opts.limit ? 0 : 5_000 }
}

/** حملةٌ لم يبق منها شيءٌ في الطابور انتهت */
export async function finishCampaigns(prisma: PrismaClient): Promise<number> {
  const { count } = await prisma.whatsAppCampaign.updateMany({
    where: { status: 'sending', messages: { none: { status: { in: ['queued', 'sending'] } } } }, data: { status: 'sent', finishedAt: new Date() },
  })
  return count
}

export async function pruneMessages(prisma: PrismaClient, now = new Date()): Promise<number> {
  const { count } = await prisma.whatsAppMessage.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - GUEST_IDLE_DAYS * DAY_MS) }, status: { notIn: ['queued', 'sending'] } },
  })
  return count
}

/* ─────────── ما تُخبر به Meta ─────────── */

interface HookMessage { id?: string; from?: string; type?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string } } }
interface HookValue {
  metadata?: { phone_number_id?: string }
  contacts?: { wa_id?: string; profile?: { name?: string } }[]
  messages?: HookMessage[]
  statuses?: { id?: string; status?: string; errors?: { title?: string; message?: string }[] }[]
}
export interface HookBody { entry?: { changes?: { field?: string; value?: HookValue }[] }[] }

/** لا يرجع خبرٌ متأخّرٌ بالحال إلى الوراء */
const BEFORE: Record<string, string[]> = {
  sent: ['sending'], delivered: ['sending', 'sent'], read: ['sending', 'sent', 'delivered'], failed: ['sending', 'sent'],
}

async function inbound(prisma: PrismaClient, v: HookValue, m: HookMessage): Promise<void> {
  const phone = normalizeIntlPhone(m.from ? `+${m.from.replace(/\D/g, '')}` : null)
  const tail = phoneTail(phone)
  if (!phone || !tail || !m.id) return
  const metaId = m.id
  const name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name?.slice(0, 100) ?? null
  const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title
  const body = (text ?? `[${m.type ?? 'رسالة'}]`).slice(0, 4_096)
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.whatsAppMessage.createMany({
      data: [{ direction: 'in', status: 'received', tail, phone, name, body, metaId }], skipDuplicates: true,
    })
    if (count === 0) return
    if (text && isStopWord(text)) {
      await tx.whatsAppOptOut.upsert({ where: { tail }, create: { tail, phone }, update: {} })
      await tx.whatsAppConsent.deleteMany({ where: { tail } })
      await tx.whatsAppMessage.updateMany({ where: { tail, status: 'queued' }, data: { status: 'cancelled', error: 'طلب ألا نراسله' } })
      await recordAudit(tx, { action: 'contact.whatsapp_stop', entityType: 'whatsapp', entityId: tail, actorId: null, meta: { tail } })
    } else if (text && isJoinWord(text)) {
      await tx.whatsAppOptOut.deleteMany({ where: { tail } })
      await tx.whatsAppConsent.upsert({
        where: { tail_kind: { tail, kind: 'marketing' } }, update: {},
        create: { tail, phone, name, kind: 'marketing', source: 'inbound', textAr: joinConsentAr(text) },
      })
      await recordAudit(tx, { action: 'whatsapp.consent_inbound', entityType: 'whatsapp', entityId: tail, actorId: null, meta: { tail } })
    }
  })
}

export async function handleHook(prisma: PrismaClient, body: HookBody): Promise<void> {
  const { phoneNumberId } = await cloudConfig(prisma)
  for (const change of (body.entry ?? []).flatMap((e) => e.changes ?? [])) {
    const v = change.value
    /* رقمٌ آخرُ في الحساب نفسِه ليس لنا */
    if (change.field !== 'messages' || !v || v.metadata?.phone_number_id !== phoneNumberId) continue
    for (const m of v.messages ?? []) await inbound(prisma, v, m)
    for (const s of v.statuses ?? []) {
      const from = s.status ? BEFORE[s.status] : undefined
      if (!s.id || !s.status || !from) continue
      await prisma.whatsAppMessage.updateMany({
        where: { metaId: s.id, status: { in: from } },
        data: { status: s.status, ...(s.status === 'failed' ? { error: (s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? 'لم تصل').slice(0, 300) } : {}) },
      })
    }
  }
}

export type AudienceCounts = { key: AudienceKey; nameAr: string; utility: number; marketing: number }[]

export async function audienceCounts(prisma: PrismaClient): Promise<AudienceCounts> {
  const out: AudienceCounts = []
  for (const key of Object.keys(AUDIENCES) as AudienceKey[]) {
    const [u, m] = [await recipientsOf(prisma, key, 'UTILITY'), await recipientsOf(prisma, key, 'MARKETING')]
    out.push({ key, nameAr: AUDIENCES[key], utility: u.to.length, marketing: m.to.length })
  }
  return out
}
