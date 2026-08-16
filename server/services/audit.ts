/* سجل التدقيق العام — كل إجراء حساس في منظومة المدربين يُكتب هنا.
   actorId = null تعني فعلًا نظاميًا (مثل انتهاء رمز أو نشر مجدول). */

import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export async function recordAudit(
  db: Db,
  entry: { actorId?: string | null; action: string; entityType: string; entityId: string; meta?: unknown },
): Promise<void> {
  await db.auditEvent.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      meta: (entry.meta ?? null) as Prisma.InputJsonValue,
    },
  })
}
