/* ═══ التسجيلُ في دورة صاحب المنصّة الخاصّة — من الصفحة إلى التأكيد (١٩ نوفمبر ٢٠٢٦) ═══

   الطريقُ كما طلبه: يحوّل المتعلّمُ بـCliQ إلى الاسم المستعار، ثمّ يسجّل من الصفحة ويرفع صورةَ الحوالة ويختار شعبته.
   فيصل التسجيلُ «قيد المراجعة». ويفتح صاحبُ الدورة لوحتَه فيرى الحوالة، فيؤكّد — فيصل المتعلّمَ بريدُ التأكيد ومعه
   رابطُ Zoom شعبته وملفُّ الدورة — أو يرفض.

   ── ولا شيءَ يمرّ بالأكاديميّة ──
   لا حسابَ يُنشأ للمتعلّم، ولا طلبَ ولا دفعةَ ولا أثر، ولا بريدَ من Resend. فلا يظهر هذا في شاشةٍ من شاشات الإدارة،
   ولا في تقريرٍ ولا تصديرٍ لها. وحدَها اللوحةُ الخاصّة تقرؤه (`owner.ts`).

   ── وتسجيلٌ ثانٍ بالبريد نفسِه ──
   يحدّث الأوّلَ ما دام لم يُؤكَّد: من أخطأ في الشعبة أو رفع صورةً غيرَ واضحةٍ يعيد التعبئةَ ولا يُترك صفّان لإنسانٍ
   واحد. والمؤكَّدُ لا يُمسّ من الصفحة — يُقال له إنّ مقعده مؤكَّد. */

import type { Prisma, PrismaClient, PrivateCourse, PrivateRegistration } from '@prisma/client'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { AuthError } from '../auth.service'
import { deleteObject, getObject, putObject } from '../object-store'
import { newStorageKey, sniffDocumentMime } from '../storage.service'
import {
  AI_JOBS, AI_JOBS_SLUG, COURSE_FILE_MAX_BYTES, PROOF_MAX_BYTES, aiJobsSection, type PrivateSection,
} from '../../../src/application/private-course/ai-jobs'
import { normalizePhone } from '../../../src/application/private-course/phone'
import { fmtDateTime } from '../../../src/application/text/format-ar'
import { gmailView, getGmailConfig, sendPrivateMail } from './mailer'
import { confirmationHtml, confirmationIcs, confirmationSubject, confirmationText } from './confirmation-mail'
import { stripeAutoReady, stripeView } from './stripe-config'
import { recordingHtml, recordingSubject, recordingText } from './recording-mail'
import { metaView, reportPurchase } from './meta-capi'

export type RegistrationStatus = 'pending' | 'confirmed' | 'rejected'

export interface ZoomLink {
  url: string
  passcode?: string
}

/** الملفُّ المضمَّن — المنشورُ نفسُه الذي أرسله صاحبُ الدورة. ويغلبه ما يرفعه من لوحته */
const DEFAULT_FILE = {
  path: join(process.cwd(), 'server', 'assets', 'private', 'ai-jobs-course.pdf'),
  name: 'AI_Job_Applications_Course.pdf',
  mime: 'application/pdf',
}

/* ── الدورة ── */

/** الدوراتُ المعروفةُ في الثوابت — واحدةٌ اليوم. وما سواها لا وجودَ له */
function assertKnownCourse(slug: string): void {
  if (slug !== AI_JOBS_SLUG) throw new AuthError('not_found', 'الدورة غير موجودة', 404)
}

export async function ensureCourse(prisma: PrismaClient, slug: string): Promise<PrivateCourse> {
  assertKnownCourse(slug)
  return prisma.privateCourse.upsert({ where: { slug }, create: { slug }, update: {} })
}

function zoomMap(course: PrivateCourse): Record<string, ZoomLink> {
  const raw = (course.zoom ?? {}) as Record<string, unknown>
  const out: Record<string, ZoomLink> = {}
  for (const [k, v] of Object.entries(raw)) {
    const link = v as Partial<ZoomLink> | null
    if (link && typeof link.url === 'string' && link.url) {
      out[k] = { url: link.url, ...(link.passcode ? { passcode: String(link.passcode) } : {}) }
    }
  }
  return out
}

export function zoomOf(course: PrivateCourse, sectionKey: string): ZoomLink | null {
  return zoomMap(course)[sectionKey] ?? null
}

/** رابطُ Zoom يُقبل من `zoom.us` وما تحته وحدَه — رابطٌ ملصوقٌ خطأً يصل كلَّ متعلّمٍ في الشعبة */
/* ═══ تسجيلُ الدورة (٢١ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة (اقتراحُ «٨»): تسجيلٌ لمن لا يستطيع الحضور. فبعد الدورة يلصق رابطَ تسجيل كلّ شعبة، ويُرسل لمؤكَّديها
   (`sendRecording`). والرابطُ https من أيّ مكانٍ يرفعه إليه (Zoom أو YouTube أو Drive…) — لا نحصره بمزوّد. */
function recordingMap(course: PrivateCourse): Record<string, string> {
  const raw = course.recordings
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'string' && v) out[k] = v
  return out
}

export function cleanRecordingUrl(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  let u: URL
  try { u = new URL(v) } catch { throw new AuthError('bad_recording', 'رابط التسجيل غير صحيح — انسخه كاملا', 400) }
  if (u.protocol !== 'https:') throw new AuthError('bad_recording', 'رابط التسجيل يبدأ بـ https://', 400)
  return u.toString()
}

export function cleanZoomUrl(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  let u: URL
  try { u = new URL(v) } catch { throw new AuthError('bad_zoom', 'رابط Zoom غير صحيح — انسخه كاملا من Zoom', 400) }
  const host = u.hostname.toLowerCase()
  if (u.protocol !== 'https:' || !(host === 'zoom.us' || host.endsWith('.zoom.us') || host === 'zoom.com' || host.endsWith('.zoom.com'))) {
    throw new AuthError('bad_zoom', 'الرابط ليس من Zoom — يبدأ بـ https://…zoom.us', 400)
  }
  return u.toString()
}

export async function publicCourseState(prisma: PrismaClient, slug: string) {
  const course = await ensureCourse(prisma, slug)
  return { open: course.open, card: cardOn(course) }
}

/* ═══ الدفعُ بالبطاقة مخفيٌّ كلّيّا (٢١ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «أخفِ الدفعَ بالكارد كلّيّا الآن». فلا يظهر في الصفحة ولا النموذج ولا خطوة الدفع ولا بريد التذكير —
   ولو بقي رابطُه محفوظا في اللوحة — ولا تُعرض إعداداتُه في اللوحة. والشيفرةُ باقيةٌ خلفَ هذا المفتاح: إعادتُه سطرٌ واحد.
   ومعالجُ Stripe باقٍ يعمل: من دفع قبل الإخفاء يتأكّد. */
const CARD_PAYMENTS = false
let cardPayments = CARD_PAYMENTS

/** للاختبار وحدَه: يُظهر البطاقةَ ليُحرس طريقُها كما كان — و`null` يعيد ما في الإنتاج لا «مغلقا» يكتبه الاختبار */
export function setCardPaymentsForTests(on: boolean | null): void {
  cardPayments = on ?? CARD_PAYMENTS
}

/** البطاقةُ معروضةٌ للحاجز؟ — المفتاحُ ورابطُها معا */
export function cardOn(course: Pick<PrivateCourse, 'cardUrl'>): boolean {
  return cardPayments && Boolean(course.cardUrl)
}

/* ═══ الدفعُ بالبطاقة لمن هو خارج الأردن (٢١ نوفمبر ٢٠٢٦) ═══
   CliQ لا يعمل إلّا داخل الأردن. فصاحبُ الدورة ينشئ صفحةَ دفعٍ عند مزوّده (Stripe أو PayPal أو غيرهما) ويلصق رابطَها
   في لوحته، فيظهر للحاجز خيارُ «بطاقة». ولا مفتاحَ ولا سرَّ هنا: الدفعُ في صفحة المزوّد، والإيصالُ يُرفع بعده كالحوالة،
   ويؤكّد صاحبُ الدورة بيده كما يؤكّد CliQ. */

/** رابطُ الدفع يُقبل https وحدَه — رابطٌ ملصوقٌ خطأً يصل كلَّ من يدفع */
export function cleanCardUrl(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  let u: URL
  try { u = new URL(v) } catch { throw new AuthError('bad_card_url', 'رابط الدفع غير صحيح — انسخه كاملا من صفحة المزوّد', 400) }
  if (u.protocol !== 'https:') throw new AuthError('bad_card_url', 'رابط الدفع يبدأ بـ https://', 400)
  return u.toString()
}

/** رابطُ الدفع لحجزٍ بعينه — وروابطُ Stripe تحمل رقمَ مرجعه (`client_reference_id`) فيُطابَق الدفعُ بصاحبه في لوحة Stripe.
    ولا يُضاف البريد: الرابطُ يُعرض في صفحةٍ يفتحها من معه رابطُ الدفع وحدَه */
export function cardLinkFor(course: Pick<PrivateCourse, 'cardUrl'>, ref: string): string | null {
  if (!cardOn(course) || !course.cardUrl) return null
  const u = new URL(course.cardUrl)
  if (u.hostname === 'buy.stripe.com') u.searchParams.set('client_reference_id', ref)
  return u.toString()
}

/* ── التسجيلُ من الصفحة ── */

export interface ProofInput {
  name: string
  base64: string
}

export interface PublicRegistrationInput {
  fullName: string
  email: string
  phoneCountry: string
  phone: string
  sectionKey: string
  note?: string
  /** اختياريّةٌ منذ «احجز أوّلا وادفع بعد» (٢٠ نوفمبر ٢٠٢٦) — تُرفع هنا أو من رابط الدفع */
  proof?: ProofInput
  /** من أين جاء — تكتبه الصفحةُ من `?src=` و`utm_*` أو الموقعِ الذي أحاله (`source.ts`) */
  source?: string
  /** صديقٌ يسجّل معه بسعر الاثنين (٢١ نوفمبر ٢٠٢٦) — في الشعبة نفسِها، والحاجزُ يدفع عنهما */
  friend?: FriendInput
  /** كعكتا بكسل Meta من المتصفّح — ليُطابَق الشراءُ بزائر الإعلان (`meta-capi.ts`) */
  meta?: { fbp?: string; fbc?: string }
  /** من الطلب لا من الجسم: المتصفّحُ والعنوان — يُرسلان إلى Meta مع الشراء وحدَه */
  client?: { ua?: string; ip?: string }
}

export interface FriendInput {
  fullName: string
  email: string
  phoneCountry: string
  phone: string
}

/* ═══ شخصان بسعر (٢١ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة (اقتراحُ «٧»): «شخصين يكون السعر ٢٠ لأن السعر الأصلي ١٤». فالحاجزُ يكتب صديقَه في النموذج نفسِه،
   فيُحجز لهما في الشعبة نفسِها، و`pairId` معرّفُ الحاجز في الصفّين: `lead` له يدفع ٢٠ دينارا عنهما، و`friend` لصديقه لا
   يدفع. وما يفعله صاحبُ الدورة بأحدهما يقع على الآخر: التأكيدُ وبريدُه لكلٍّ منهما، والرفضُ، والإعادةُ، ونقلُ الشعبة. */

/** ما يُحوَّل عن هذا الحجز — ومن دُفع عنه لا شيءَ عليه */
export function amountJodOf(r: Pick<PrivateRegistration, 'pairRole'>): number {
  return r.pairRole === 'lead' ? AI_JOBS.pair.priceJod : r.pairRole === 'friend' ? 0 : AI_JOBS.priceJod
}

/** شريكُه في السعر — من دفع عنه، أو من دفع هو عنه */
export async function partnerOf(prisma: PrismaClient, r: Pick<PrivateRegistration, 'id' | 'pairId'>): Promise<PrivateRegistration | null> {
  if (!r.pairId) return null
  return prisma.privateRegistration.findFirst({ where: { pairId: r.pairId, id: { not: r.id } } })
}

/** الصفُّ وشريكُه معا — ما يُفعل بأحدهما يُفعل بالآخر */
async function pairIds(prisma: PrismaClient, r: Pick<PrivateRegistration, 'id' | 'pairId'>): Promise<string[]> {
  if (!r.pairId) return [r.id]
  const rows = await prisma.privateRegistration.findMany({ where: { pairId: r.pairId }, select: { id: true } })
  return rows.length ? rows.map((x) => x.id) : [r.id]
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full
}

/** الصديقُ يُفحص كلُّه قبل أن يُكتب شيء — فلا يبقى حجزٌ بنصف شريك */
async function checkFriend(
  prisma: PrismaClient, slug: string, input: FriendInput, leadEmail: string, leadId: string | null,
) {
  const fullName = input.fullName.trim().replace(/\s+/g, ' ')
  if (fullName.length < 3) throw new AuthError('friend_name', 'اكتب اسم صديقك الكامل', 400)
  const email = input.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new AuthError('friend_email', 'بريد صديقك غير صحيح', 400)
  if (email === leadEmail) throw new AuthError('friend_same', 'بريد صديقك مثل بريدك — اكتب بريده هو', 400)
  const phone = normalizePhone(input.phoneCountry, input.phone)
  if (!phone.ok) throw new AuthError('friend_phone', `رقم صديقك: ${phone.error}`, 400)
  const existing = await prisma.privateRegistration.findUnique({ where: { courseSlug_email: { courseSlug: slug, email } } })
  if (existing?.status === 'confirmed') throw new AuthError('friend_confirmed', 'صديقك مسجل ومؤكد من قبل بهذا البريد', 409)
  if (existing?.pairId && existing.pairId !== leadId) {
    throw new AuthError('friend_paired', 'صديقك مسجل مع شخص آخر — راسلنا على واتساب', 409)
  }
  return { fullName, email, phone, existing }
}

const FBP = /^fb\.\d\.\d{10,13}\.[A-Za-z0-9_-]{1,64}$/
const FBC = /^fb\.\d\.\d{10,13}\.[\x21-\x7e]{1,400}$/

/** ما يُحفظ للمطابقة عند Meta — كعكتان بصيغتهما، ومتصفّحٌ وعنوانٌ مقصوصان. وغيرُ ذلك يُترك */
function metaClickOf(input: PublicRegistrationInput): Prisma.InputJsonValue | undefined {
  const fbp = input.meta?.fbp && FBP.test(input.meta.fbp) ? input.meta.fbp : undefined
  const fbc = input.meta?.fbc && FBC.test(input.meta.fbc) ? input.meta.fbc : undefined
  const ua = input.client?.ua?.slice(0, 400) || undefined
  const ip = input.client?.ip?.slice(0, 64) || undefined
  if (!fbp && !fbc && !ua && !ip) return undefined
  return { ...(fbp ? { fbp } : {}), ...(fbc ? { fbc } : {}), ...(ua ? { ua } : {}), ...(ip ? { ip } : {}) }
}

function decodeProof(base64: string): Buffer {
  const clean = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64
  const buffer = Buffer.from(clean, 'base64')
  if (!buffer.length) throw new AuthError('empty', 'ارفع صورة الحوالة', 400)
  if (buffer.length > PROOF_MAX_BYTES) {
    throw new AuthError('too_large', `الملف أكبر من ${Math.floor(PROOF_MAX_BYTES / (1024 * 1024))}MB — صغّر الصورة أو التقط لقطة شاشة`, 413)
  }
  return buffer
}

/** يكتب صورةَ الحوالة على القرص ويعيد أعمدتَها — والنوعُ من البايتات لا من الاسم ولا ممّا يعلنه المتصفّح:
    صفحةُ HTML مسمّاةٌ «حوالة.png» تُردّ (العلّةُ عند `APPLICATION_DOC_MIMES` في `storage.service.ts`) */
async function storeProof(proof: ProofInput) {
  const buffer = decodeProof(proof.base64)
  const mime = sniffDocumentMime(buffer)
  if (!mime) throw new AuthError('bad_mime', 'الملف ليس صورة ولا PDF — ارفع صورة الحوالة (JPG أو PNG) أو PDF', 415)
  const proofKey = newStorageKey()
  const proofName = proof.name.trim().slice(0, 200) || 'proof'
  await putObject(proofKey, buffer, { mime, originalName: proofName })
  return { proofKey, proofName, proofMime: mime, proofSize: buffer.length, proofUploadedAt: new Date() }
}

/** المصدرُ نصٌّ قصيرٌ يُقرأ في اللوحة — لا يُخزَّن منه ما يتجاوز سطرا */
function cleanSource(raw: string | undefined): string | null {
  const v = (raw ?? '').replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
  return v || null
}

function reference(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

export async function registerPublic(prisma: PrismaClient, slug: string, input: PublicRegistrationInput) {
  const course = await ensureCourse(prisma, slug)
  if (!course.open) throw new AuthError('closed', 'التسجيل مغلق الآن — راسلنا على واتساب', 409)
  const section = aiJobsSection(input.sectionKey)
  if (!section) throw new AuthError('bad_section', 'اختر الشعبة', 400)
  const phone = normalizePhone(input.phoneCountry, input.phone)
  if (!phone.ok) throw new AuthError('bad_phone', phone.error, 400)
  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim().replace(/\s+/g, ' ')

  const existing = await prisma.privateRegistration.findUnique({ where: { courseSlug_email: { courseSlug: slug, email } } })
  if (existing?.status === 'confirmed') {
    throw new AuthError('already_confirmed', 'تسجيلك مؤكد من قبل — تفقد بريدك، وإن لم تجد الرسالة راسلنا على واتساب', 409)
  }
  if (input.friend && existing?.pairRole === 'friend') {
    throw new AuthError('already_friend', 'سجلك صديق من قبل ويدفع عنكما — راسلنا على واتساب', 409)
  }
  const friend = input.friend ? await checkFriend(prisma, slug, input.friend, email, existing?.id ?? null) : null
  const metaClick = metaClickOf(input)

  const proof = input.proof ? await storeProof(input.proof) : null
  const data = {
    sectionKey: section.key,
    fullName,
    phone: phone.e164,
    phoneCountry: phone.country.iso2,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    /* الإيصالُ لا يُرفع إلّا لـCliQ: من دفع بالبطاقة يصله إيصالُها ويصل صاحبَ الدورة الدفعُ (٢١ نوفمبر ٢٠٢٦) */
    ...(proof ? { ...proof, payMethod: 'cliq' } : {}),
    ...(metaClick ? { metaClick } : {}),
  }
  try {
    /* وتسجيلٌ ثانٍ بالبريد نفسِه يحدّث الأوّل: رابطُ دفعه كما هو، وحوالتُه كما هي ما لم تُرفع أخرى،
       ومصدرُه الأوّلُ لا يُمحى بدخولٍ مباشرٍ بعده */
    let row = existing
      ? await prisma.privateRegistration.update({
          where: { id: existing.id },
          data: { ...data, status: 'pending', rejectedAt: null, ...(cleanSource(input.source) ? { source: cleanSource(input.source) } : {}) },
        })
      : await prisma.privateRegistration.create({
          data: { ...data, courseSlug: slug, email, payToken: newStorageKey(), source: cleanSource(input.source) },
        })
    if (existing?.proofKey && proof) await deleteObject(existing.proofKey)
    if (friend) {
      const pairId = row.id
      /* صديقٌ سابقٌ غيرُ هذا يُفكّ — يبقى حجزُه بسعره هو */
      await prisma.privateRegistration.updateMany({
        where: { pairId, id: { notIn: [row.id, ...(friend.existing ? [friend.existing.id] : [])] } },
        data: { pairId: null, pairRole: null },
      })
      row = await prisma.privateRegistration.update({ where: { id: row.id }, data: { pairId, pairRole: 'lead' } })
      const friendData = {
        sectionKey: section.key, fullName: friend.fullName, phone: friend.phone.e164, phoneCountry: friend.phone.country.iso2,
        pairId, pairRole: 'friend',
      }
      if (friend.existing) {
        await prisma.privateRegistration.update({ where: { id: friend.existing.id }, data: { ...friendData, status: 'pending', rejectedAt: null } })
      } else {
        await prisma.privateRegistration.create({
          data: { ...friendData, courseSlug: slug, email: friend.email, payToken: newStorageKey(), source: cleanSource(input.source) },
        })
      }
    }
    const partner = await partnerOf(prisma, row)
    return {
      reference: reference(row.id),
      updated: Boolean(existing),
      sectionTitle: section.title,
      payToken: row.payToken,
      hasProof: Boolean(row.proofKey),
      cardUrl: cardLinkFor(course, reference(row.id)),
      abroad: row.phoneCountry !== 'JO',
      cardChosen: cardOn(course) && row.payMethod === 'card' && !row.proofKey,
      cardAuto: cardOn(course) && await stripeAutoReady(prisma),
      amountJod: amountJodOf(row),
      pair: partner ? { role: row.pairRole as 'lead' | 'friend', firstName: firstName(partner.fullName) } : null,
    }
  } catch (e) {
    /* لا يبقى على القرص ملفٌّ لا يملكه صفّ */
    if (proof) await deleteObject(proof.proofKey)
    throw e
  }
}

/* ── رابطُ الدفع — `/ai-jobs/pay/<payToken>` ── */

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16,128}$/

async function byToken(prisma: PrismaClient, slug: string, token: string) {
  assertKnownCourse(slug)
  if (!TOKEN_SHAPE.test(token)) throw new AuthError('not_found', 'الرابط غير صحيح — راسلنا على واتساب', 404)
  const r = await prisma.privateRegistration.findUnique({ where: { payToken: token }, include: { course: true } })
  if (!r || r.courseSlug !== slug) throw new AuthError('not_found', 'الرابط غير صحيح — راسلنا على واتساب', 404)
  return r
}

/** ما تعرضه صفحةُ الدفع — الاسمُ الأوّلُ والشعبةُ والحال، لا البريدُ ولا الرقم: الرابطُ قد يُرسَل في محادثة */
function payView(r: PrivateRegistration, course: Pick<PrivateCourse, 'cardUrl'>, auto: boolean, partner: PrivateRegistration | null) {
  return {
    firstName: r.fullName.split(' ')[0],
    reference: reference(r.id),
    sectionTitle: aiJobsSection(r.sectionKey)?.title ?? '',
    status: r.status as RegistrationStatus,
    hasProof: Boolean(r.proofKey),
    /** خيارُ البطاقة إن ضُبط رابطُه — ويُقدَّم لمن رقمُه خارجَ الأردن */
    cardUrl: cardLinkFor(course, reference(r.id)),
    abroad: r.phoneCountry !== 'JO',
    /** ضغط «ادفع بالبطاقة» ولم يرفع حوالة — فيرى «نؤكد مقعدك بعد وصول الدفع» إن عاد للرابط */
    cardChosen: cardOn(course) && r.payMethod === 'card' && !r.proofKey,
    /** Stripe مربوط: دفعُ البطاقة يؤكّد مقعده وحدَه (`stripe-webhook.ts`) */
    cardAuto: cardOn(course) && auto,
    /** سجّلا معا: ما يُحوَّل عنهما، واسمُ الآخر الأوّل — ومن دُفع عنه لا يدفع (٢١ نوفمبر ٢٠٢٦) */
    amountJod: amountJodOf(r),
    pair: partner ? { role: r.pairRole as 'lead' | 'friend', firstName: firstName(partner.fullName) } : null,
  }
}

export async function payInfo(prisma: PrismaClient, slug: string, token: string) {
  const r = await byToken(prisma, slug, token)
  return payView(r, r.course, await stripeAutoReady(prisma), await partnerOf(prisma, r))
}

export type PayMethod = 'cliq' | 'card'

/** صورةُ حوالة CliQ من رابط الدفع. والبطاقةُ لا إيصالَ لها هنا — قرارُ صاحب المنصّة (٢١ نوفمبر ٢٠٢٦): «لو دفع
    يصل له التأكيد مباشرة، لا حاجة ليثبته» — فيكفي أن يُعلَم أنّه ذهب إليها (`chooseCard`) */
export async function submitProof(
  prisma: PrismaClient, slug: string, token: string,
  input: { proof: ProofInput; note?: string },
) {
  const r = await byToken(prisma, slug, token)
  if (r.status === 'confirmed') throw new AuthError('already_confirmed', 'مقعدك مؤكد — تفقد بريدك', 409)
  const proof = await storeProof(input.proof)
  try {
    const row = await prisma.privateRegistration.update({
      where: { id: r.id },
      /* ومن رُفض فرفع حوالةً جديدةً عاد للمراجعة */
      data: {
        ...proof, status: 'pending', rejectedAt: null, payMethod: 'cliq',
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      },
    })
    if (r.proofKey) await deleteObject(r.proofKey)
    return payView(row, r.course, await stripeAutoReady(prisma), await partnerOf(prisma, row))
  } catch (e) {
    await deleteObject(proof.proofKey)
    throw e
  }
}

/** ضغط «ادفع بالبطاقة» — يُكتب أنّه اختارها، فيرى صاحبُ الدورة في لوحته من يطابقه في Stripe برقم مرجعه،
    ولا يصله تذكيرٌ يقول «لم تدفع» كأنّه لم يفعل شيئا. ومن رفع حوالةً أو تأكّد لا يتغيّر عنده شيء */
export async function chooseCard(prisma: PrismaClient, slug: string, token: string) {
  const r = await byToken(prisma, slug, token)
  const auto = await stripeAutoReady(prisma)
  if (!cardOn(r.course) || r.status === 'confirmed' || r.proofKey || r.payMethod === 'card') return payView(r, r.course, auto, await partnerOf(prisma, r))
  const row = await prisma.privateRegistration.update({ where: { id: r.id }, data: { payMethod: 'card' } })
  return payView(row, r.course, auto, await partnerOf(prisma, row))
}

/* ── اللوحة ── */

type Partner = Pick<PrivateRegistration, 'fullName' | 'proofKey' | 'cardPaidAt'> | null

function view(r: PrivateRegistration, course: PrivateCourse, partner: Partner = null) {
  const zoom = zoomOf(course, r.sectionKey)
  return {
    id: r.id,
    reference: reference(r.id),
    fullName: r.fullName,
    email: r.email,
    phone: r.phone,
    phoneCountry: r.phoneCountry,
    sectionKey: r.sectionKey,
    note: r.note,
    /** `null` حتى يرفعها — «حجز ولم يدفع بعد» */
    proof: r.proofKey ? { name: r.proofName ?? 'proof', mime: r.proofMime ?? '', size: r.proofSize ?? 0 } : null,
    proofUploadedAt: r.proofUploadedAt?.toISOString() ?? null,
    payToken: r.payToken,
    source: r.source,
    payMethod: (r.payMethod as PayMethod | null) ?? null,
    status: r.status as RegistrationStatus,
    createdAt: r.createdAt.toISOString(),
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
    rejectedAt: r.rejectedAt?.toISOString() ?? null,
    mailSentAt: r.mailSentAt?.toISOString() ?? null,
    /** تذكيرُ من لم يدفع بالبريد — بعد يوم، و«آخر فرصة» بعد ثلاثة (`reminders.ts`) */
    remindedAt: r.remindedAt?.toISOString() ?? null,
    lastChanceAt: r.lastChanceAt?.toISOString() ?? null,
    reminderError: r.reminderError,
    /** دفعُ البطاقة كما أخبر به Stripe — ومعرّفُه يفتح الدفعةَ في لوحة Stripe */
    cardPaidAt: r.cardPaidAt?.toISOString() ?? null,
    cardAmount: r.cardAmount,
    cardCurrency: r.cardCurrency,
    stripePaymentId: r.stripePaymentId,
    mailError: r.mailError,
    /** مؤكَّدٌ لم يصله رابطُ Zoom الحاليّ لشعبته — بريدٌ قبل ضبط الرابط، أو قبل تغييره */
    zoomMissing: r.status === 'confirmed' && Boolean(zoom) && r.mailZoomUrl !== zoom?.url,
    /** سجّلا معا (٢١ نوفمبر ٢٠٢٦): دورُه، واسمُ شريكه، وهل دفع شريكُه عنهما، وما عليه هو */
    pairRole: (r.pairRole as 'lead' | 'friend' | null) ?? null,
    partnerName: partner?.fullName ?? null,
    partnerPaid: Boolean(partner && (partner.proofKey || partner.cardPaidAt)),
    amountJod: amountJodOf(r),
    /** وصله رابطُ التسجيل — ورابطُه الذي وصله، فيُعرف من لم يصله الرابطُ الحاليّ */
    recordingSentAt: r.recordingSentAt?.toISOString() ?? null,
    /** أُبلغ Meta بشرائه حين تأكّد — أو سببُ إخفاقه (`meta-capi.ts`) */
    metaSentAt: r.metaSentAt?.toISOString() ?? null,
    metaError: r.metaError,
    recordingMissing: r.status === 'confirmed' && Boolean(recordingMap(course)[r.sectionKey]) && r.recordingUrl !== recordingMap(course)[r.sectionKey],
  }
}

/** صفوفٌ بعينها بشركائها — بعد فعلٍ وقع على الاثنين معا */
async function viewsOf(prisma: PrismaClient, ids: string[], course: PrivateCourse) {
  const rows = await prisma.privateRegistration.findMany({ where: { id: { in: ids } } })
  const partners = await Promise.all(rows.map((r) => partnerOf(prisma, r)))
  return rows.map((r, i) => view(r, course, partners[i]))
}

/** نتيجةُ فعلٍ على حجز: صفُّه، وشريكُه معه إن كان — فتتبدّل البطاقتان في اللوحة معا */
async function actionResult(prisma: PrismaClient, id: string, ids: string[], course: PrivateCourse) {
  const views = await viewsOf(prisma, ids, course)
  return { registration: views.find((v) => v.id === id)!, partners: views.filter((v) => v.id !== id) }
}

export type RegistrationView = ReturnType<typeof view>

async function fileView(course: PrivateCourse) {
  return course.fileKey
    ? { name: course.fileName ?? 'course-file', custom: true }
    : { name: DEFAULT_FILE.name, custom: false }
}

export async function ownerOverview(prisma: PrismaClient, slug: string) {
  const course = await ensureCourse(prisma, slug)
  const rows = await prisma.privateRegistration.findMany({ where: { courseSlug: slug }, orderBy: { createdAt: 'desc' } })
  const zoom = zoomMap(course)
  return {
    course: {
      slug,
      title: AI_JOBS.title,
      open: course.open,
      priceJod: AI_JOBS.priceJod,
      cardUrl: course.cardUrl,
      /** البطاقةُ مخفيّةٌ كلّيّا — فلا تُعرض إعداداتُها في اللوحة (٢١ نوفمبر ٢٠٢٦) */
      cardPayments,
      file: await fileView(course),
      sections: AI_JOBS.sections.map((s) => ({
        key: s.key,
        title: s.title,
        timeLabel: s.timeLabel,
        zoom: zoom[s.key] ?? null,
        recording: recordingMap(course)[s.key] ?? null,
      })),
    },
    gmail: await gmailView(prisma),
    stripe: await stripeView(prisma),
    meta: await metaView(prisma),
    registrations: rows.map((r) => view(r, course, rows.find((x) => x.id !== r.id && r.pairId !== null && x.pairId === r.pairId) ?? null)),
  }
}

export async function updateCourse(
  prisma: PrismaClient, slug: string,
  input: {
    open?: boolean; zoom?: Record<string, { url: string; passcode?: string } | null>; cardUrl?: string
    recordings?: Record<string, string | null>
  },
) {
  const course = await ensureCourse(prisma, slug)
  const zoom = zoomMap(course)
  const recordings = recordingMap(course)
  if (input.recordings) {
    for (const [key, link] of Object.entries(input.recordings)) {
      if (!aiJobsSection(key)) throw new AuthError('bad_section', 'شعبة غير معروفة', 400)
      const url = link ? cleanRecordingUrl(link) : ''
      if (!url) delete recordings[key]
      else recordings[key] = url
    }
  }
  if (input.zoom) {
    for (const [key, link] of Object.entries(input.zoom)) {
      if (!aiJobsSection(key)) throw new AuthError('bad_section', 'شعبة غير معروفة', 400)
      const url = link ? cleanZoomUrl(link.url) : ''
      if (!url) delete zoom[key]
      else zoom[key] = { url, ...(link?.passcode?.trim() ? { passcode: link.passcode.trim().slice(0, 40) } : {}) }
    }
  }
  await prisma.privateCourse.update({
    where: { slug },
    data: {
      ...(input.open !== undefined ? { open: input.open } : {}),
      ...(input.cardUrl !== undefined ? { cardUrl: cleanCardUrl(input.cardUrl) || null } : {}),
      zoom: zoom as object,
      recordings: recordings as object,
    },
  })
  return ownerOverview(prisma, slug)
}

/* ── ملفُّ الدورة ── */

export async function setCourseFile(prisma: PrismaClient, slug: string, buffer: Buffer, name: string) {
  const course = await ensureCourse(prisma, slug)
  if (!buffer.length) throw new AuthError('empty', 'الملف فارغ', 400)
  if (buffer.length > COURSE_FILE_MAX_BYTES) {
    throw new AuthError('too_large', `الملف أكبر من ${Math.floor(COURSE_FILE_MAX_BYTES / (1024 * 1024))}MB`, 413)
  }
  const mime = sniffDocumentMime(buffer)
  if (!mime) throw new AuthError('bad_mime', 'ملف الدورة PDF أو صورة', 415)
  const key = newStorageKey()
  const fileName = name.trim().slice(0, 200) || 'course-file.pdf'
  await putObject(key, buffer, { mime, originalName: fileName })
  await prisma.privateCourse.update({ where: { slug }, data: { fileKey: key, fileName, fileMime: mime } })
  if (course.fileKey) await deleteObject(course.fileKey)
  return ownerOverview(prisma, slug)
}

/** يعود إلى الملفّ المضمَّن */
export async function clearCourseFile(prisma: PrismaClient, slug: string) {
  const course = await ensureCourse(prisma, slug)
  await prisma.privateCourse.update({ where: { slug }, data: { fileKey: null, fileName: null, fileMime: null } })
  if (course.fileKey) await deleteObject(course.fileKey)
  return ownerOverview(prisma, slug)
}

export async function courseFile(prisma: PrismaClient, slug: string): Promise<{ content: Buffer; name: string; mime: string } | null> {
  const course = await ensureCourse(prisma, slug)
  if (course.fileKey) {
    const content = await getObject(course.fileKey)
    if (content) return { content, name: course.fileName ?? 'course-file', mime: course.fileMime ?? 'application/pdf' }
  }
  try {
    return { content: await readFile(DEFAULT_FILE.path), name: DEFAULT_FILE.name, mime: DEFAULT_FILE.mime }
  } catch {
    return null
  }
}

/* ── التسجيلُ الواحد ── */

async function load(prisma: PrismaClient, id: string) {
  const r = await prisma.privateRegistration.findUnique({ where: { id }, include: { course: true } })
  if (!r) throw new AuthError('not_found', 'التسجيل غير موجود', 404)
  return r
}

export async function proofOf(prisma: PrismaClient, id: string) {
  const r = await load(prisma, id)
  const content = r.proofKey ? await getObject(r.proofKey) : null
  if (!content) throw new AuthError('not_found', 'لم يرفع صورة الحوالة بعد', 404)
  return { content, mime: r.proofMime ?? 'application/octet-stream', name: r.proofName ?? 'proof' }
}

/** يرسل بريدَ التأكيد ويكتب نتيجتَه في الصفّ — نجاحا أو سببَ إخفاق يُقرأ في اللوحة */
export async function sendConfirmation(prisma: PrismaClient, id: string) {
  const r = await load(prisma, id)
  if (r.status !== 'confirmed') throw new AuthError('not_confirmed', 'أكّد التسجيل أولا', 409)
  const section = aiJobsSection(r.sectionKey) as PrivateSection
  const zoom = zoomOf(r.course, r.sectionKey)
  const file = await courseFile(prisma, r.courseSlug)
  const gmail = await getGmailConfig(prisma)
  const sentAt = new Date()
  const input = {
    registrationId: r.id, fullName: r.fullName, email: r.email, section, zoom,
    fileName: file?.name ?? null, sentAt, organizerEmail: gmail.user,
  }
  const result = await sendPrivateMail(prisma, {
    to: r.email,
    toName: r.fullName,
    subject: confirmationSubject(),
    html: confirmationHtml(input),
    text: confirmationText(input),
    attachments: file ? [{ filename: file.name, content: file.content, contentType: file.mime }] : [],
    ics: confirmationIcs(input),
  })
  const row = await prisma.privateRegistration.update({
    where: { id },
    data: result.ok
      ? { mailSentAt: sentAt, mailZoomUrl: zoom?.url ?? null, mailError: null }
      : { mailError: result.error },
  })
  return { mail: result, registration: view(row, r.course) }
}

export async function confirmRegistration(prisma: PrismaClient, id: string, opts: { sendMail: boolean }) {
  const r = await load(prisma, id)
  /* وشريكُه معه: سجّلا معا ودُفع عنهما مرّةً — فيتأكّدان معا، ويصل كلًّا بريدُه (٢١ نوفمبر ٢٠٢٦) */
  const ids = await pairIds(prisma, r)
  await prisma.privateRegistration.updateMany({
    where: { id: { in: ids }, status: { not: 'confirmed' } },
    data: { status: 'confirmed', confirmedAt: new Date(), rejectedAt: null },
  })
  let mail: Awaited<ReturnType<typeof sendConfirmation>>['mail'] | null = null
  if (opts.sendMail) {
    const sent = []
    for (const x of ids) sent.push((await sendConfirmation(prisma, x)).mail)
    mail = sent.find((m) => !m.ok) ?? sent[0]
  }
  /* ويُبلَّغ Meta بالشراء — لا يرمي، وما سقط يُكتب على الصفّ ويُعاد من اللوحة (`meta-capi.ts`) */
  for (const x of ids) await reportPurchase(prisma, x)
  return { mail, ...(await actionResult(prisma, id, ids, r.course)) }
}

/** يعيد إبلاغ Meta بشراء حجزٍ مؤكَّدٍ سقط إبلاغُه — أو قبل ضبط الرمز */
export async function retryMetaPurchase(prisma: PrismaClient, id: string) {
  const r = await load(prisma, id)
  const report = await reportPurchase(prisma, id)
  return { report, ...(await actionResult(prisma, id, [id], r.course)) }
}

export async function rejectRegistration(prisma: PrismaClient, id: string) {
  const r = await load(prisma, id)
  const ids = await pairIds(prisma, r)
  await prisma.privateRegistration.updateMany({ where: { id: { in: ids } }, data: { status: 'rejected', rejectedAt: new Date(), confirmedAt: null } })
  return actionResult(prisma, id, ids, r.course)
}

/** يعيده «قيد المراجعة» — تراجعٌ عن تأكيدٍ أو رفضٍ بالخطأ */
export async function reopenRegistration(prisma: PrismaClient, id: string) {
  const r = await load(prisma, id)
  const ids = await pairIds(prisma, r)
  await prisma.privateRegistration.updateMany({ where: { id: { in: ids } }, data: { status: 'pending', rejectedAt: null, confirmedAt: null } })
  return actionResult(prisma, id, ids, r.course)
}

/** ونقلُ الشعبة لهما معا — سجّلا ليحضرا معا */
export async function moveSection(prisma: PrismaClient, id: string, sectionKey: string) {
  const r = await load(prisma, id)
  if (!aiJobsSection(sectionKey)) throw new AuthError('bad_section', 'شعبة غير معروفة', 400)
  const ids = await pairIds(prisma, r)
  await prisma.privateRegistration.updateMany({ where: { id: { in: ids } }, data: { sectionKey } })
  return actionResult(prisma, id, ids, r.course)
}

/** يرسل رابطَ تسجيل الشعبة لمؤكَّديها الذين لم يصلهم الرابطُ الحاليّ — ويوقف عند أوّل رفضٍ لـGmail غير رفض المستلم */
export async function sendRecording(prisma: PrismaClient, slug: string, sectionKey: string) {
  const course = await ensureCourse(prisma, slug)
  const section = aiJobsSection(sectionKey)
  if (!section) throw new AuthError('bad_section', 'شعبة غير معروفة', 400)
  const url = recordingMap(course)[sectionKey]
  if (!url) throw new AuthError('no_recording', 'اكتب رابط التسجيل أولا', 400)
  const rows = await prisma.privateRegistration.findMany({
    where: { courseSlug: slug, sectionKey, status: 'confirmed', OR: [{ recordingUrl: null }, { recordingUrl: { not: url } }] },
    orderBy: { createdAt: 'asc' },
  })
  let sent = 0
  const errors: string[] = []
  for (const r of rows) {
    const input = { fullName: r.fullName, section, url }
    const res = await sendPrivateMail(prisma, {
      to: r.email, toName: r.fullName, subject: recordingSubject(), html: recordingHtml(input), text: recordingText(input),
    })
    if (res.ok) {
      await prisma.privateRegistration.update({ where: { id: r.id }, data: { recordingSentAt: new Date(), recordingUrl: url } })
      sent += 1
      continue
    }
    errors.push(`${r.fullName}: ${res.error}`)
    if (!res.recipient) break
  }
  return { sent, failed: errors.length, left: rows.length - sent, errors: errors.slice(0, 5), overview: await ownerOverview(prisma, slug) }
}

/** والحذفُ لصفٍّ وحدَه — وشريكُه يبقى حجزا بسعره هو */
export async function deleteRegistration(prisma: PrismaClient, id: string) {
  const r = await load(prisma, id)
  if (r.pairId) {
    await prisma.privateRegistration.updateMany({ where: { pairId: r.pairId, id: { not: id } }, data: { pairId: null, pairRole: null } })
  }
  await prisma.privateRegistration.delete({ where: { id } })
  if (r.proofKey) await deleteObject(r.proofKey)
  return { ok: true }
}

/* ── التصدير ── */

const STATUS_AR: Record<RegistrationStatus, string> = { pending: 'قيد المراجعة', confirmed: 'مؤكد', rejected: 'مرفوض' }

export async function exportXlsx(
  prisma: PrismaClient, slug: string, filter: { status?: RegistrationStatus; section?: string },
): Promise<{ buffer: Buffer; fileName: string }> {
  await ensureCourse(prisma, slug)
  const rows = await prisma.privateRegistration.findMany({
    where: { courseSlug: slug, ...(filter.status ? { status: filter.status } : {}), ...(filter.section ? { sectionKey: filter.section } : {}) },
    orderBy: [{ sectionKey: 'asc' }, { createdAt: 'asc' }],
  })
  const wb = new ExcelJS.Workbook()
  const columns = [
    { header: 'الاسم', key: 'name', width: 26 },
    { header: 'البريد', key: 'email', width: 32 },
    { header: 'الهاتف', key: 'phone', width: 18 },
    { header: 'الشعبة', key: 'section', width: 18 },
    { header: 'الحالة', key: 'status', width: 14 },
    { header: 'سجل في', key: 'created', width: 20 },
    { header: 'تأكد في', key: 'confirmed', width: 20 },
    { header: 'وصله البريد', key: 'mailed', width: 20 },
    { header: 'الحوالة', key: 'proof', width: 18 },
    { header: 'طريقة الدفع', key: 'method', width: 14 },
    { header: 'المصدر', key: 'source', width: 26 },
    { header: 'مع صديق', key: 'pair', width: 24 },
    { header: 'ملاحظة', key: 'note', width: 30 },
  ]
  const sheets = filter.section
    ? AI_JOBS.sections.filter((s) => s.key === filter.section)
    : AI_JOBS.sections
  const add = (title: string, list: PrivateRegistration[]) => {
    const ws = wb.addWorksheet(title)
    ws.columns = columns
    for (const r of list) {
      ws.addRow({
        name: r.fullName, email: r.email, phone: r.phone,
        section: aiJobsSection(r.sectionKey)?.title ?? r.sectionKey,
        status: STATUS_AR[r.status as RegistrationStatus] ?? r.status,
        created: fmtDateTime(r.createdAt),
        confirmed: r.confirmedAt ? fmtDateTime(r.confirmedAt) : '',
        mailed: r.mailSentAt ? fmtDateTime(r.mailSentAt) : '',
        proof: r.proofUploadedAt ? fmtDateTime(r.proofUploadedAt) : r.cardPaidAt ? `دفع بالبطاقة ${fmtDateTime(r.cardPaidAt)}` : 'لم يرفعها بعد',
        method: r.payMethod === 'card' ? 'بطاقة' : r.payMethod === 'cliq' ? 'CliQ' : '',
        source: r.source ?? 'مباشر',
        pair: r.pairId ? (rows.find((x) => x.id !== r.id && x.pairId === r.pairId)?.fullName ?? '') + (r.pairRole === 'lead' ? ' (دفع عنهما)' : '') : '',
        note: r.note ?? '',
      })
    }
    ws.getRow(1).font = { bold: true }
    ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
  }
  if (!filter.section) add('الكل', rows)
  for (const s of sheets) add(s.title, rows.filter((r) => r.sectionKey === s.key))
  const parts = ['مسجلو الدورة', filter.section ? aiJobsSection(filter.section)?.title : null, filter.status ? STATUS_AR[filter.status] : null]
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), fileName: `${parts.filter(Boolean).join(' - ')}.xlsx` }
}

/* ── تجربةُ البريد ── */

export async function sendTestMail(prisma: PrismaClient, to: string) {
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:16px;color:#142240">وصلت رسالة التجربة — Gmail مضبوط ويرسل من الخادم.</div>`
  return sendPrivateMail(prisma, { to, subject: 'تجربة بريد الدورة', html, text: 'وصلت رسالة التجربة — Gmail مضبوط ويرسل من الخادم.' })
}
