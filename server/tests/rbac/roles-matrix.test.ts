/* اختبار مصفوفة الأدوار التسعة على واجهات HTTP الفعلية:
   - بذر RBAC ينشئ الأدوار التسعة بمنح تطابق المصفوفة المعلنة حرفيا.
   - كل دور يصل ما خُصّ له ويُرفض عمّا سواه — لا تصعيد ضمني.
   - الزائر بلا جلسة 401، والحساب بلا دور إداري 403. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { ROLE_PERMISSIONS } from '../../auth/permissions'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance

const NINE_ROLES = [
  'super_admin', 'academic_manager', 'diagnostic_manager', 'operations_manager',
  'advisor', 'trainer', 'finance', 'support', 'learner',
] as const

async function cookieFor(email: string, password: string): Promise<string> {
  const { token } = await auth.login(email, password)
  return `${SESSION_COOKIE}=${token}`
}

async function makeUserWithRole(email: string, role: string): Promise<string> {
  const password = 'Matrix#12345'
  const user = await auth.register(email, password, role)
  await auth.setRoles(user.userId, [role])
  return cookieFor(email, password)
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
}, 240_000)

describe('بذر مصفوفة الأدوار', () => {
  it('الأدوار التسعة موجودة ومنحها تطابق ROLE_PERMISSIONS حرفيا', async () => {
    for (const roleId of NINE_ROLES) {
      const role = await prisma.role.findUnique({ where: { id: roleId }, include: { permissions: true } })
      expect(role, `الدور ${roleId} غير موجود`).toBeTruthy()
      const granted = role!.permissions.map((g) => g.permissionKey).sort()
      const expected = [...ROLE_PERMISSIONS[roleId]].sort()
      expect(granted, `منح الدور ${roleId} لا تطابق المصفوفة`).toEqual(expected)
    }
  })
})

describe('إنفاذ الأدوار عبر HTTP', () => {
  it('super_admin يصل نقاط المالية والجودة معا', async () => {
    const cookie = await makeUserWithRole('rbac-super@test.local', 'super_admin')
    const invoices = await app.inject({ method: 'GET', url: '/api/admin/invoices', headers: { cookie } })
    expect(invoices.statusCode).toBe(200)
    const quality = await app.inject({ method: 'GET', url: '/api/admin/quality/regression-runs', headers: { cookie } })
    expect(quality.statusCode).toBe(200)
  })

  it('diagnostic_manager يصل الجودة ويُرفض من المالية', async () => {
    const cookie = await makeUserWithRole('rbac-diag@test.local', 'diagnostic_manager')
    const quality = await app.inject({ method: 'GET', url: '/api/admin/quality/regression-runs', headers: { cookie } })
    expect(quality.statusCode).toBe(200)
    const invoices = await app.inject({ method: 'GET', url: '/api/admin/invoices', headers: { cookie } })
    expect(invoices.statusCode).toBe(403)
  })

  it('finance يصل المالية ويُرفض من الجودة', async () => {
    const cookie = await makeUserWithRole('rbac-finance@test.local', 'finance')
    const invoices = await app.inject({ method: 'GET', url: '/api/admin/invoices', headers: { cookie } })
    expect(invoices.statusCode).toBe(200)
    const quality = await app.inject({ method: 'GET', url: '/api/admin/quality/regression-runs', headers: { cookie } })
    expect(quality.statusCode).toBe(403)
  })

  it('operations_manager يُرفض من المالية والجودة معا', async () => {
    const cookie = await makeUserWithRole('rbac-ops@test.local', 'operations_manager')
    const invoices = await app.inject({ method: 'GET', url: '/api/admin/invoices', headers: { cookie } })
    expect(invoices.statusCode).toBe(403)
    const quality = await app.inject({ method: 'GET', url: '/api/admin/quality/regression-runs', headers: { cookie } })
    expect(quality.statusCode).toBe(403)
  })

  it('advisor وtrainer وsupport وlearner يُرفضون جميعا من المالية والجودة', async () => {
    for (const role of ['advisor', 'trainer', 'support', 'learner'] as const) {
      const cookie = await makeUserWithRole(`rbac-${role}@test.local`, role)
      const invoices = await app.inject({ method: 'GET', url: '/api/admin/invoices', headers: { cookie } })
      expect(invoices.statusCode, `${role} وصل المالية!`).toBe(403)
      const quality = await app.inject({ method: 'GET', url: '/api/admin/quality/regression-runs', headers: { cookie } })
      expect(quality.statusCode, `${role} وصل الجودة!`).toBe(403)
    }
  })

  it('الزائر بلا جلسة يُرفض 401 على النقطتين', async () => {
    const a = await app.inject({ method: 'GET', url: '/api/admin/invoices' })
    expect(a.statusCode).toBe(401)
    const b = await app.inject({ method: 'GET', url: '/api/admin/quality/regression-runs' })
    expect(b.statusCode).toBe(401)
  })
})
