/* سجل التدقيق العام — كل إجراء حساس في المنظومة يُكتب هنا.
   actorId = null تعني فعلًا نظاميًا (مثل انتهاء رمز أو نشر مجدول).
   القاعدة الصارمة: لا كلمات مرور ولا رموز جلسات ولا مفاتيح خدمات ولا بيانات بطاقات
   تدخل هذا السجل — يُنقَّى كل حمولة قبل الكتابة. */

import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

/* مفاتيح محظورة في أي حمولة تدقيق — تُستبدل قيمتها بـ [محذوف] */
const FORBIDDEN_KEYS = /password|passwd|secret|token|apikey|api_key|private_key|card|cvv|pan|passcode/i

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value ?? null
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = FORBIDDEN_KEYS.test(k) ? '[محذوف — بيانات حساسة لا تُسجل]' : sanitize(v, depth + 1)
    }
    return out
  }
  return value
}

export async function recordAudit(
  db: Db,
  entry: {
    actorId?: string | null; action: string; entityType: string; entityId: string
    meta?: unknown; reason?: string; ip?: string; before?: unknown; after?: unknown
  },
): Promise<void> {
  await db.auditEvent.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      meta: (sanitize(entry.meta) ?? null) as Prisma.InputJsonValue,
      reason: entry.reason ?? null,
      ip: entry.ip ?? null,
      before: (entry.before === undefined ? null : sanitize(entry.before)) as Prisma.InputJsonValue,
      after: (entry.after === undefined ? null : sanitize(entry.after)) as Prisma.InputJsonValue,
    },
  })
}
