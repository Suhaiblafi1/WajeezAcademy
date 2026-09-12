/* مزامنةُ مقابلات Calendly — الخادمُ هو مصدرُ الحقيقة، لا رسالةُ المتصفّح.

   حدثُ `postMessage` مفيدٌ ليقول للمتقدّم إنّ نافذةَ الحجز انتهت، لكنه لا
   يحمل وقتَ الموعد، ويمكن لأيّ متصلٍ أن يستدعي مسارا عاما لو جعلناه يكتب.
   لذلك لا تُنشأ المقابلةُ إلّا من webhook موقّع على الجسم الخام، بطابعٍ لا
   يُقبل بعد ثلاث دقائق. */

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import {
  ALLOWED_TRANSITIONS,
  TrainerApplicationService,
  type TrainerStatus,
} from './trainer-application.service'
import { sendInterviewDossier } from './trainer-dossier.service'

export const CALENDLY_TIMESTAMP_TOLERANCE_S = 180

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** صيغة Calendly: `t=<unix>,v1=<hmac>`، والبصمة على `<t>.<raw body>`. */
export function verifyCalendlyWebhookSignature(
  rawBody: string,
  header: string,
  signingKey: string | undefined,
  nowS: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!signingKey || !header) return false
  const fields = new Map<string, string[]>()
  for (const part of header.split(',')) {
    const i = part.indexOf('=')
    if (i < 1) continue
    const key = part.slice(0, i).trim()
    const value = part.slice(i + 1).trim()
    fields.set(key, [...(fields.get(key) ?? []), value])
  }
  const timestamp = fields.get('t')?.[0]
  const signatures = fields.get('v1') ?? []
  if (!timestamp || signatures.length === 0) return false
  const timestampNumber = Number(timestamp)
  if (!Number.isFinite(timestampNumber)) return false
  if (Math.abs(nowS - timestampNumber) > CALENDLY_TIMESTAMP_TOLERANCE_S) return false
  const expected = createHmac('sha256', signingKey).update(`${timestamp}.${rawBody}`).digest('hex')
  return signatures.some((signature) => safeEqual(expected, signature))
}

interface CalendlyQuestionAnswer {
  answer?: unknown
}

interface CalendlyTracking {
  utm_source?: unknown
  utm_medium?: unknown
  utm_content?: unknown
}

interface CalendlyWebhookPayload {
  uri?: unknown
  email?: unknown
  questions_and_answers?: CalendlyQuestionAnswer[]
  tracking?: CalendlyTracking
  scheduled_event?: {
    uri?: unknown
    start_time?: unknown
  }
}

export interface CalendlyWebhookEvent {
  event?: unknown
  payload?: CalendlyWebhookPayload
}

const REFERENCE = /^WJ-TR-\d{4}-\d{5}$/i

function trainerReference(payload: CalendlyWebhookPayload): string | null {
  const tracked = payload.tracking?.utm_content
  if (
    payload.tracking?.utm_source === 'wajeezacademy'
    && payload.tracking?.utm_medium === 'trainer_application'
    && typeof tracked === 'string'
    && REFERENCE.test(tracked.trim())
  ) return tracked.trim().toUpperCase()

  for (const item of payload.questions_and_answers ?? []) {
    if (typeof item.answer === 'string' && REFERENCE.test(item.answer.trim())) {
      return item.answer.trim().toUpperCase()
    }
  }
  return null
}

function parsedDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export class CalendlyWebhookService {
  private apps: TrainerApplicationService
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.apps = new TrainerApplicationService(prisma)
  }

  async handle(input: CalendlyWebhookEvent): Promise<{ recorded?: boolean; canceled?: boolean; duplicate?: boolean; ignored?: boolean }> {
    const event = input.event
    if (event !== 'invitee.created' && event !== 'invitee.canceled') return { ignored: true }

    const payload = input.payload ?? {}
    const reference = trainerReference(payload)
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    const externalId = typeof payload.uri === 'string' ? payload.uri : ''
    if (!reference || !email || !externalId) return { ignored: true }

    const application = await this.prisma.trainerApplication.findFirst({
      where: { reference, email },
      select: { id: true, status: true },
    })
    if (!application) return { ignored: true }

    if (event === 'invitee.created') {
      const scheduledAt = parsedDate(payload.scheduled_event?.start_time)
      if (!scheduledAt) throw new AuthError('bad_calendly_payload', 'حدث Calendly بلا موعد صالح', 400)
      const scheduledEventUri = typeof payload.scheduled_event?.uri === 'string' ? payload.scheduled_event.uri : null

      const result = await this.prisma.$transaction(async (tx) => {
        /* `find` ثمّ `create` يتسابقان عند تسليمَين متزامنَين: كلاهما يرى
           الفراغَ، والثاني يصطدم بالمفتاح الفريد ويردّ ٥٠٠. أمّا الإدخالُ
           المتجاهلُ للتكرار فذريٌّ، فيبقى ردُّ الإعادة ٢٠٠ كما يطلب Calendly. */
        const inserted = await tx.trainerInterview.createMany({
          data: [{
            applicationId: application.id,
            scheduledAt,
            mode: 'remote',
            provider: 'calendly',
            externalId,
            notes: scheduledEventUri
              ? `حجزها المتقدّم عبر Calendly — ${scheduledEventUri}`
              : 'حجزها المتقدّم عبر Calendly',
          }],
          skipDuplicates: true,
        })
        if (inserted.count === 0) return { duplicate: true }
        const interview = await tx.trainerInterview.findUniqueOrThrow({ where: { externalId } })

        const status = application.status as TrainerStatus
        if (status !== 'interview_scheduled' && ALLOWED_TRANSITIONS[status]?.includes('interview_scheduled')) {
          await this.apps.transition(application.id, 'interview_scheduled', null, 'حجز المتقدّم مقابلته عبر Calendly', tx)
        }
        await recordAudit(tx, {
          actorId: null,
          action: 'trainer.interview.self_booked',
          entityType: 'trainer_application',
          entityId: application.id,
          meta: { interviewId: interview.id, provider: 'calendly', scheduledAt: scheduledAt.toISOString() },
        })
        return { recorded: true }
      })

      /* ═══ ملفُّ المتقدّم يُرسَل بعد المعاملة لا داخلَها ═══

         التوليدُ يفتح متصفّحا والإرسالُ ينادي Resend: ثوانٍ تُمسك فيها
         معاملةَ قاعدةٍ مفتوحةً بلا سبب، وفشلُ أيٍّ منهما يُرجِع المقابلةَ
         المكتوبةَ. فالحجزُ يُثبَّت أوّلا، ثمّ يُرسَل الملفّ.

         ولا يُرسَل عند التكرار: Calendly يعيد التسليمَ حتّى يرى ٢٠٠، ورسالةٌ
         بمرفقَين تتكرّر على لجنة المراجعة أسوأُ من ألّا تصل. */
      if (result.recorded) {
        /* وفشلُه لا يردّ ٥٠٠: الحجزُ مكتوب، وإعادةُ التسليم ستُعدّ تكرارا
           فلا تُرسل شيئا. فيُبتلع هنا بعد أن سُجّل في الأثر داخلَ الخدمة. */
        try {
          await sendInterviewDossier(this.prisma, application.id, scheduledAt)
        } catch { /* الملفُّ رفاهيةٌ — والمقابلةُ هي الواجب */ }
      }
      return result
    }

    return this.prisma.$transaction(async (tx) => {
      const interview = await tx.trainerInterview.findUnique({ where: { externalId } })
      if (!interview) return { ignored: true }
      if (interview.canceledAt) return { duplicate: true }
      await tx.trainerInterview.update({ where: { id: interview.id }, data: { canceledAt: new Date() } })
      await recordAudit(tx, {
        actorId: null,
        action: 'trainer.interview.self_canceled',
        entityType: 'trainer_application',
        entityId: application.id,
        meta: { interviewId: interview.id, provider: 'calendly' },
      })

      const activeCount = await tx.trainerInterview.count({
        where: { applicationId: application.id, canceledAt: null },
      })
      if (activeCount === 0 && application.status === 'interview_scheduled') {
        const previous = await tx.trainerStatusHistory.findFirst({
          where: { applicationId: application.id, toStatus: 'interview_scheduled' },
          orderBy: { createdAt: 'desc' },
          select: { fromStatus: true },
        })
        const backTo = previous?.fromStatus as TrainerStatus | undefined
        if (backTo && ALLOWED_TRANSITIONS.interview_scheduled.includes(backTo)) {
          await this.apps.transition(application.id, backTo, null, 'ألغى المتقدّم موعد Calendly', tx)
        }
      }
      return { canceled: true }
    })
  }
}
