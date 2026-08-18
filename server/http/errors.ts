/* معالجة الأخطاء الموحدة — كل رد خطأ بصيغة { error: { code, message_ar } } */

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { AuthError } from '../services/auth.service'

export function errorHandler(err: FastifyError | AuthError | ZodError, _req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof ZodError) {
    const first = err.issues[0]
    return reply.status(422).send({
      error: { code: 'validation', message_ar: `حقل غير صالح: ${first?.path.join('.') ?? ''} — ${first?.message ?? ''}` },
    })
  }
  if (err instanceof AuthError) {
    return reply.status(err.status).send({ error: { code: err.code, message_ar: err.messageAr } })
  }
  const fe = err as FastifyError
  const status = fe.statusCode && fe.statusCode >= 400 ? fe.statusCode : 500
  if (status >= 500) console.error('[api]', fe)
  return reply.status(status).send({
    error: {
      code: fe.code ?? 'internal',
      message_ar: status >= 500 ? 'خطأ داخلي غير متوقع' : fe.message,
    },
  })
}
