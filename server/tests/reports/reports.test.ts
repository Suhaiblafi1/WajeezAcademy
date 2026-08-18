/* اختبار E2E للتقارير:
   16 تقريرا بطريقة حساب معلنة لكل مؤشر → تشغيل بفلاتر → مفتاح مجهول يرفض →
   تصدير CSV بعلامة BOM وXLSX سليم → بوابة الصلاحيات عبر HTTP:
   المتعلم ممنوع من العرض والتصدير، المدير يصل لكليهما. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { ReportsService } from '../../services/reports.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let reports: ReportsService
let app: FastifyInstance
let adminCookie = ''
let learnerCookie = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  reports = new ReportsService(prisma)
  app = await buildApp(prisma)

  const admin = await auth.register('rep-admin@test.local', 'Admin#12345', 'مدير التقارير')
  await auth.setRoles(admin.userId, ['academic_manager'])
  adminCookie = `${SESSION_COOKIE}=${(await auth.login('rep-admin@test.local', 'Admin#12345')).token}`

  await auth.register('rep-learner@test.local', 'Learner#12345', 'متعلم')
  learnerCookie = `${SESSION_COOKIE}=${(await auth.login('rep-learner@test.local', 'Learner#12345')).token}`
}, 240_000)

describe('التقارير التشغيلية', () => {
  it('1) ستة عشر تقريرا — كل مؤشر له طريقة حساب معلنة', () => {
    const list = reports.listReports()
    expect(list.length).toBe(16)
    for (const r of list) {
      expect(r.key).toBeTruthy()
      expect(r.titleAr).toBeTruthy()
      expect(r.methodAr.length).toBeGreaterThan(10)
    }
  })

  it('2) تشغيل تقارير بفلاتر التاريخ — مصفوفات صفوف سليمة', async () => {
    const enrollments = await reports.run('enrollments', { from: new Date('2026-01-01'), to: new Date('2027-01-01') })
    expect(enrollments.titleAr).toBe('التسجيلات')
    expect(Array.isArray(enrollments.rows)).toBe(true)
    const diagnostic = await reports.run('diagnostic', {})
    expect(Array.isArray(diagnostic.rows)).toBe(true)
    const support = await reports.run('support-tickets', {})
    expect(Array.isArray(support.rows)).toBe(true)
  })

  it('3) مفتاح تقرير مجهول يرفض برسالة واضحة', async () => {
    await expect(reports.run('nope')).rejects.toThrow(/unknown_report/)
  })

  it('4) تصدير CSV بعلامة BOM لعربية Excel سليمة', async () => {
    const csv = reports.toCsv([{ الاسم: 'سالم', العدد: 3 }])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('"الاسم","العدد"')
    expect(csv).toContain('"سالم","3"')
  })

  it('5) تصدير XLSX ينتج ملفا سليما', async () => {
    const buf = await reports.toXlsx('تجربة', [{ a: 1, b: 'نص' }])
    expect(buf[0]).toBe(0x50) // PK — حزمة xlsx
    expect(buf[1]).toBe(0x4b)
    expect(buf.length).toBeGreaterThan(1000)
  })
})

describe('صلاحيات التقارير عبر HTTP', () => {
  it('6) المتعلم ممنوع من العرض والتصدير 403', async () => {
    const view = await app.inject({ method: 'GET', url: '/api/admin/reports', headers: { cookie: learnerCookie } })
    expect(view.statusCode).toBe(403)
    const exp = await app.inject({ method: 'GET', url: '/api/admin/reports/enrollments/export?format=csv', headers: { cookie: learnerCookie } })
    expect(exp.statusCode).toBe(403)
  })

  it('7) الزائر بلا جلسة مرفوض 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/reports' })
    expect(res.statusCode).toBe(401)
  })

  it('8) المدير يعرض الفهرس ويشغل تقريرا ويصدّره', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/admin/reports', headers: { cookie: adminCookie } })
    expect(list.statusCode).toBe(200)
    expect(list.json().length).toBe(16)
    const run = await app.inject({ method: 'GET', url: '/api/admin/reports/enrollments', headers: { cookie: adminCookie } })
    expect(run.statusCode).toBe(200)
    const csv = await app.inject({ method: 'GET', url: '/api/admin/reports/enrollments/export?format=csv', headers: { cookie: adminCookie } })
    expect(csv.statusCode).toBe(200)
    expect(csv.headers['content-type']).toContain('text/csv')
    const xlsx = await app.inject({ method: 'GET', url: '/api/admin/reports/enrollments/export?format=xlsx', headers: { cookie: adminCookie } })
    expect(xlsx.statusCode).toBe(200)
    expect(xlsx.headers['content-disposition']).toContain('attachment')
  })
})
