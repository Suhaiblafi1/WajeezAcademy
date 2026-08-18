/* مسارات التقارير — 16 تقريرا تشغيليا بطريقة حساب معلنة لكل مؤشر.
   العرض بصلاحية reports.view؛ التصدير CSV/XLSX بصلاحية reports.export. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { ReportsService } from '../../services/reports.service'
import { requirePermission } from '../auth-plugin'

const filterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cohortId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
})

export function registerReportRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const reports = new ReportsService(prisma)

  app.get('/api/admin/reports', {
    preHandler: requirePermission('reports.view'),
    schema: { tags: ['reports'], summary: 'فهرس التقارير مع طريقة حساب كل مؤشر' },
  }, async () => reports.listReports())

  app.get('/api/admin/reports/:key', {
    preHandler: requirePermission('reports.view'),
    schema: { tags: ['reports'], summary: 'تشغيل تقرير بفلاتر تاريخ ودورة وشعبة' },
  }, async (req) => {
    const { key } = z.object({ key: z.string().min(2) }).parse(req.params)
    const filter = filterSchema.parse(req.query)
    return reports.run(key, filter)
  })

  app.get('/api/admin/reports/:key/export', {
    preHandler: requirePermission('reports.export'),
    schema: { tags: ['reports'], summary: 'تصدير التقرير CSV أو XLSX' },
  }, async (req, reply) => {
    const { key } = z.object({ key: z.string().min(2) }).parse(req.params)
    const filter = filterSchema.parse(req.query)
    const { format } = z.object({ format: z.enum(['csv', 'xlsx']).default('csv') }).parse(req.query)
    const result = await reports.run(key, filter)
    if (format === 'xlsx') {
      const buf = await reports.toXlsx(result.titleAr, result.rows)
      return reply
        .header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('content-disposition', `attachment; filename="report-${key}.xlsx"`)
        .send(buf)
    }
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="report-${key}.csv"`)
      .send(reports.toCsv(result.rows))
  })
}
