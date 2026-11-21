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

import type { PrismaClient, PrivateCourse, PrivateRegistration } from '@prisma/client'
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
  return { open: course.open, card: Boolean(course.cardUrl) }
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
  if (!course.cardUrl) return null
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

  const proof = input.proof ? await storeProof(input.proof) : null
  const data = {
    sectionKey: section.key,
    fullName,
    phone: phone.e164,
    phoneCountry: phone.country.iso2,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(proof ?? {}),
  }
  try {
    /* وتسجيلٌ ثانٍ بالبريد نفسِه يحدّث الأوّل: رابطُ دفعه كما هو، وحوالتُه كما هي ما لم تُرفع أخرى،
       ومصدرُه الأوّلُ لا يُمحى بدخولٍ مباشرٍ بعده */
    const row = existing
      ? await prisma.privateRegistration.update({
          where: { id: existing.id },
          data: { ...data, status: 'pending', rejectedAt: null, ...(cleanSource(input.source) ? { source: cleanSource(input.source) } : {}) },
        })
      : await prisma.privateRegistration.create({
          data: { ...data, courseSlug: slug, email, payToken: newStorageKey(), source: cleanSource(input.source) },
        })
    if (existing?.proofKey && proof) await deleteObject(existing.proofKey)
    return {
      reference: reference(row.id),
      updated: Boolean(existing),
      sectionTitle: section.title,
      payToken: row.payToken,
      hasProof: Boolean(row.proofKey),
      cardUrl: cardLinkFor(course, reference(row.id)),
      abroad: row.phoneCountry !== 'JO',
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
function payView(r: PrivateRegistration, course: Pick<PrivateCourse, 'cardUrl'>) {
  return {
    firstName: r.fullName.split(' ')[0],
    reference: reference(r.id),
    sectionTitle: aiJobsSection(r.sectionKey)?.title ?? '',
    status: r.status as RegistrationStatus,
    hasProof: Boolean(r.proofKey),
    /** خيارُ البطاقة إن ضُبط رابطُه — ويُقدَّم لمن رقمُه خارجَ الأردن */
    cardUrl: cardLinkFor(course, reference(r.id)),
    abroad: r.phoneCountry !== 'JO',
  }
}

export async function payInfo(prisma: PrismaClient, slug: string, token: string) {
  const r = await byToken(prisma, slug, token)
  return payView(r, r.course)
}

export type PayMethod = 'cliq' | 'card'

export async function submitProof(
  prisma: PrismaClient, slug: string, token: string,
  input: { proof: ProofInput; note?: string; payMethod?: PayMethod },
) {
  const r = await byToken(prisma, slug, token)
  if (r.status === 'confirmed') throw new AuthError('already_confirmed', 'مقعدك مؤكد — تفقد بريدك', 409)
  const proof = await storeProof(input.proof)
  try {
    const row = await prisma.privateRegistration.update({
      where: { id: r.id },
      /* ومن رُفض فرفع حوالةً جديدةً عاد للمراجعة */
      data: {
        ...proof, status: 'pending', rejectedAt: null, payMethod: input.payMethod ?? 'cliq',
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      },
    })
    if (r.proofKey) await deleteObject(r.proofKey)
    return payView(row, r.course)
  } catch (e) {
    await deleteObject(proof.proofKey)
    throw e
  }
}

/* ── اللوحة ── */

function view(r: PrivateRegistration, course: PrivateCourse) {
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
    mailError: r.mailError,
    /** مؤكَّدٌ لم يصله رابطُ Zoom الحاليّ لشعبته — بريدٌ قبل ضبط الرابط، أو قبل تغييره */
    zoomMissing: r.status === 'confirmed' && Boolean(zoom) && r.mailZoomUrl !== zoom?.url,
  }
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
      file: await fileView(course),
      sections: AI_JOBS.sections.map((s) => ({
        key: s.key,
        title: s.title,
        timeLabel: s.timeLabel,
        zoom: zoom[s.key] ?? null,
      })),
    },
    gmail: await gmailView(prisma),
    registrations: rows.map((r) => view(r, course)),
  }
}

export async function updateCourse(
  prisma: PrismaClient, slug: string,
  input: { open?: boolean; zoom?: Record<string, { url: string; passcode?: string } | null>; cardUrl?: string },
) {
  const course = await ensureCourse(prisma, slug)
  const zoom = zoomMap(course)
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
  const row = r.status === 'confirmed'
    ? r
    : await prisma.privateRegistration.update({ where: { id }, data: { status: 'confirmed', confirmedAt: new Date(), rejectedAt: null } })
  if (!opts.sendMail) return { mail: null, registration: view(row, r.course) }
  return sendConfirmation(prisma, id)
}

export async function rejectRegistration(prisma: PrismaClient, id: string) {
  const r = await load(prisma, id)
  const row = await prisma.privateRegistration.update({
    where: { id }, data: { status: 'rejected', rejectedAt: new Date(), confirmedAt: null },
  })
  return { registration: view(row, r.course) }
}

/** يعيده «قيد المراجعة» — تراجعٌ عن تأكيدٍ أو رفضٍ بالخطأ */
export async function reopenRegistration(prisma: PrismaClient, id: string) {
  const r = await load(prisma, id)
  const row = await prisma.privateRegistration.update({
    where: { id }, data: { status: 'pending', rejectedAt: null, confirmedAt: null },
  })
  return { registration: view(row, r.course) }
}

export async function moveSection(prisma: PrismaClient, id: string, sectionKey: string) {
  const r = await load(prisma, id)
  if (!aiJobsSection(sectionKey)) throw new AuthError('bad_section', 'شعبة غير معروفة', 400)
  const row = await prisma.privateRegistration.update({ where: { id }, data: { sectionKey } })
  return { registration: view(row, r.course) }
}

export async function deleteRegistration(prisma: PrismaClient, id: string) {
  const r = await load(prisma, id)
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
        proof: r.proofUploadedAt ? fmtDateTime(r.proofUploadedAt) : 'لم يرفعها بعد',
        method: r.payMethod === 'card' ? 'بطاقة' : r.payMethod === 'cliq' ? 'CliQ' : '',
        source: r.source ?? 'مباشر',
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
