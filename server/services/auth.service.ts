/* خدمة المصادقة — تسجيل، دخول، جلسات آمنة، استعادة كلمة مرور،
   خروج من كل الأجهزة، إيقاف حساب، وسجل محاولات دخول.
   مبادئ: كلمات المرور bcrypt، رموز الجلسات والاستعادة تُحفظ هاش SHA-256 فقط،
   ورسائل الخطأ لا تكشف وجود الحساب. */

import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { PrismaClient } from '@prisma/client'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')

export class AuthError extends Error {
  code: string
  messageAr: string
  status: number
  constructor(code: string, messageAr: string, status = 400) {
    super(messageAr)
    this.code = code
    this.messageAr = messageAr
    this.status = status
  }
}

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 30)
const GENERIC_LOGIN_FAIL = 'البريد أو كلمة المرور غير صحيحة'

export interface AuthContext {
  userId: string
  email: string
  displayName: string
  roles: string[]
  permissions: string[]
}

export class AuthService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** تسجيل متعلم جديد — الدور الافتراضي learner فقط، لا تصعيد ذاتي */
  async register(email: string, password: string, displayName: string): Promise<{ userId: string }> {
    const normalized = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new AuthError('invalid_email', 'صيغة البريد غير صحيحة')
    if (password.length < 8) throw new AuthError('weak_password', 'كلمة المرور 8 أحرف على الأقل')
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } })
    if (existing) throw new AuthError('email_taken', 'هذا البريد مسجل — جرّب تسجيل الدخول', 409)
    const user = await this.prisma.user.create({
      data: {
        email: normalized,
        displayName: displayName.trim() || normalized.split('@')[0],
        passwordHash: await bcrypt.hash(password, 10),
        roles: { create: { roleId: 'learner' } },
      },
    })
    return { userId: user.id }
  }

  /** دخول — يسجل المحاولة دائما، ولا يكشف هل البريد موجود */
  async login(email: string, password: string, ip?: string, userAgent?: string): Promise<{ token: string; expiresAt: Date }> {
    const normalized = email.trim().toLowerCase()
    const user = await this.prisma.user.findUnique({ where: { email: normalized } })
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false
    await this.prisma.loginAttempt.create({ data: { email: normalized, ip, success: ok } })
    if (!user || !ok) throw new AuthError('bad_credentials', GENERIC_LOGIN_FAIL, 401)
    if (user.status !== 'active') throw new AuthError('account_suspended', 'هذا الحساب موقوف — تواصل مع الدعم', 403)
    const token = newToken()
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000)
    await this.prisma.session.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt, ip, userAgent },
    })
    return { token, expiresAt }
  }

  /** يحلّ رمز الجلسة إلى سياق مستخدم كامل الصلاحيات — يُستدعى في كل طلب محمي */
  async resolve(token: string | undefined): Promise<AuthContext | null> {
    if (!token) return null
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: { include: { roles: { include: { role: { include: { permissions: true } } } } } } },
    })
    if (!session || session.revokedAt || session.expiresAt < new Date()) return null
    if (session.user.status !== 'active') return null
    const permissions = new Set<string>()
    const roles: string[] = []
    for (const ur of session.user.roles) {
      roles.push(ur.roleId)
      for (const rp of ur.role.permissions) permissions.add(rp.permissionKey)
    }
    return { userId: session.user.id, email: session.user.email, displayName: session.user.displayName, roles, permissions: [...permissions] }
  }

  async logout(token: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  /** الخروج من جميع الأجهزة — إبطال كل الجلسات الحية للمستخدم */
  async logoutAll(userId: string): Promise<number> {
    const r = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return r.count
  }

  /** طلب استعادة كلمة مرور — يعيد الرمز للقناة الموثوقة فقط؛ الرد العام لا يكشف وجود البريد */
  async requestPasswordReset(email: string): Promise<{ tokenForDelivery: string | null }> {
    const normalized = email.trim().toLowerCase()
    const user = await this.prisma.user.findUnique({ where: { email: normalized } })
    if (!user) return { tokenForDelivery: null } // نفس الرد للعميل سواء وُجد البريد أم لا
    const token = newToken()
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) },
    })
    return { tokenForDelivery: token }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) throw new AuthError('weak_password', 'كلمة المرور 8 أحرف على الأقل')
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } })
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new AuthError('invalid_token', 'رابط الاستعادة غير صالح أو منتهي', 400)
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } }),
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      /* أمن: تغيير كلمة المرور يبطل كل الجلسات القائمة */
      this.prisma.session.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ])
  }

  /** إيقاف حساب — يبطل جلساته فورا */
  async suspend(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status: 'suspended', suspendedAt: new Date() } }),
      this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ])
  }

  async setRoles(userId: string, roleIds: string[]): Promise<void> {
    const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds } } })
    if (roles.length !== roleIds.length) throw new AuthError('unknown_role', 'دور غير معروف ضمن القائمة')
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })) }),
    ])
  }
}
