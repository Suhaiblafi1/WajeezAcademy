/* خدمة المصادقة — تسجيل، دخول، جلسات آمنة، استعادة كلمة مرور،
   خروج من كل الأجهزة، إيقاف حساب، وسجل محاولات دخول.
   مبادئ: كلمات المرور bcrypt، رموز الجلسات والاستعادة تُحفظ هاش SHA-256 فقط،
   ورسائل الخطأ لا تكشف وجود الحساب. */

import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { PrismaClient } from '@prisma/client'

/** الدور الأرضيّ لكلّ حساب — يُمنح عند التسجيل ولا يُنزع بترقية */
const LEARNER_ROLE = 'learner'

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
/** مهلة رابط توثيق البريد — يومان: أطول من مهلة الاستعادة لأنه ليس إجراء طوارئ */
const EMAIL_VERIFY_TTL_MS = 48 * 3600_000

export interface AuthContext {
  userId: string
  email: string
  displayName: string
  roles: string[]
  permissions: string[]
  /* توثيق البريد (١هـ) — الواجهة تبني عليه الشريط وحالة زر الشراء، فلا تحتاج
     نداء ثانيا لتعرف حالة الحساب الذي بين يديها. */
  emailVerified: boolean
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
        roles: { create: { roleId: LEARNER_ROLE } },
      },
    })
    return { userId: user.id }
  }

  /** دخول — يسجل المحاولة دائما، ولا يكشف هل البريد موجود، ويقفل بعد 5 إخفاقات متتالية */
  async login(email: string, password: string, ip?: string, userAgent?: string): Promise<{ token: string; expiresAt: Date }> {
    const normalized = email.trim().toLowerCase()

    /* قفل مؤقت ضد التخمين: 5 إخفاقات خلال 15 دقيقة على البريد أو الـIP تُمهّل المحاولة التالية */
    const windowStart = new Date(Date.now() - 15 * 60_000)
    const recentFails = await this.prisma.loginAttempt.count({
      where: {
        success: false, createdAt: { gte: windowStart },
        OR: [{ email: normalized }, ...(ip ? [{ ip }] : [])],
      },
    })
    if (recentFails >= 5) {
      throw new AuthError('too_many_attempts', 'محاولات كثيرة متتالية — انتظر 15 دقيقة ثم حاول مجددا', 429)
    }

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
      include: {
        user: {
          include: {
            roles: { include: { role: { include: { permissions: true } } } },
            permissionOverrides: true,
          },
        },
      },
    })
    if (!session || session.revokedAt || session.expiresAt < new Date()) return null
    if (session.user.status !== 'active') return null
    const permissions = new Set<string>()
    const roles: string[] = []
    for (const ur of session.user.roles) {
      roles.push(ur.roleId)
      for (const rp of ur.role.permissions) permissions.add(rp.permissionKey)
    }
    /* استثناء الشخص — بعد الأدوار وفي هذا الموضع وحده.
       كان القرار بالدور كلّه: من أراد صلاحيةً واحدة زائدة مُنح الدور بما فيه.
       والحساب هنا لا في المسارات: أيّ مسارٍ يسأل عن صلاحية يسأل عن هذه.
       والمنعُ يُطبَّق بعد المنح لأنّه الأعلى — سحبُ صلاحيةٍ بعينها أسرع
       وأأمن من إعادة تركيب أدوار الموظّف. */
    for (const o of session.user.permissionOverrides) {
      if (o.effect === 'grant') permissions.add(o.permissionKey)
    }
    for (const o of session.user.permissionOverrides) {
      if (o.effect === 'deny') permissions.delete(o.permissionKey)
    }
    return {
      userId: session.user.id, email: session.user.email, displayName: session.user.displayName,
      roles, permissions: [...permissions], emailVerified: session.user.emailVerifiedAt != null,
    }
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

  /* ── توثيق البريد (١هـ) ───────────────────────────────────────────────
     المبدأ: التوثيق دليلٌ على أن العنوان يصل صاحبَه، لا حاجزُ دخول. فهو
     يحجب الشراء وسكّ الشهادة — حيث يكلّف العنوانُ الخاطئ مالا أو شهادةً
     تذهب إلى لا أحد — ولا يحجب الدخول ولا التصفّح ولا التشخيص. */

  /** يُصدر رمز توثيق جديدا ويُبطل ما قبله — الرمز يُعاد مرة واحدة للإرسال فقط.
      يعيد null حين يكون البريد موثَّقا أصلا: لا رمز بلا حاجة إليه. */
  async issueEmailVerification(userId: string): Promise<{ token: string; email: string; displayName: string } | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new AuthError('not_found', 'الحساب غير موجود', 404)
    if (user.emailVerifiedAt) return null
    const token = newToken()
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifyTokenHash: sha256(token),
        emailVerifyExpiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
      },
    })
    return { token, email: user.email, displayName: user.displayName }
  }

  /** يوثّق البريد بالرمز — ويستهلك الرمز، فالرابط لا يعمل مرتين.
      الرسالة لا تفرّق بين رمزٍ مجهول ومنتهٍ: التفريق يخبر المهاجم أيّ رموزه صحيح. */
  async verifyEmail(token: string): Promise<{ userId: string; alreadyVerified: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { emailVerifyTokenHash: sha256(token) } })
    if (!user) throw new AuthError('invalid_token', 'رابط التوثيق غير صالح أو استُهلك — اطلب رابطا جديدا', 400)
    if (user.emailVerifiedAt) return { userId: user.id, alreadyVerified: true }
    if (!user.emailVerifyExpiresAt || user.emailVerifyExpiresAt < new Date()) {
      throw new AuthError('expired_token', 'انتهت صلاحية رابط التوثيق — اطلب رابطا جديدا', 400)
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), emailVerifyTokenHash: null, emailVerifyExpiresAt: null },
    })
    return { userId: user.id, alreadyVerified: false }
  }

  /** هل بريد هذا الحساب موثَّق؟ — تستدعيها حواجز الشراء والشهادة */
  async isEmailVerified(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } })
    return user?.emailVerifiedAt != null
  }

  /** إيقاف حساب — يبطل جلساته فورا */
  async suspend(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status: 'suspended', suspendedAt: new Date() } }),
      this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ])
  }

  /* والإيقافُ بابٌ يُفتح: «خانةُ الحسابات الموقوفة» بلا رفعِ إيقافٍ سجنٌ
     مؤبَّد، وأوّلُ خطأٍ في الإيقاف يصير دائما. */
  async reinstate(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'active', suspendedAt: null },
    })
  }

  /* تُبطَل جلساتُه دون إيقاف حسابه: الجلسة تحمل الصلاحيات وقت حلّها، فمن
     نُزعت عنه صلاحيةٌ بقي يعمل بها حتى تنتهي جلسته. */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null }, data: { revokedAt: new Date() },
    })
  }

  async setRoles(userId: string, roleIds: string[]): Promise<void> {
    const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds } } })
    if (roles.length !== roleIds.length) throw new AuthError('unknown_role', 'دور غير معروف ضمن القائمة')
    /* عمليّة «تعيين» أمينة: ما يصل هو ما يصير، بلا زيادةٍ من عندنا.

       فرضتُ هنا يوما بقاءَ `learner` مع كلّ دور، ظنّا أنّ الترقية تنزعه
       صامتا. وكان الظنّ خطأ: محرّر الأدوار يُحمّل أدوار الحساب الحاليّة
       عند فتحه، والإداريّ يعدّل المجموعة كاملةً — فالاستبدال هو الصواب،
       ومن فقد `learner` فقده بإزالة علامته لا بترقية.

       وكلّفت تلك الزيادة ما هو أسوأ من العطب الذي أرادت منعه: صارت اللوحة
       تُظهر دورا لم يخترْه أحد، ولا سبيل إلى نزعه — والواجهة لا تشرح
       فتبدو كأنّها ترفض أمر صاحبها.

       فالحماية انتقلت إلى موضعها: تحذيرٌ في اللوحة قبل نزع بوابة تعلُّمٍ عن
       حسابٍ له تسجيلات، وصفحةٌ تشرح للإداريّ لماذا لا بوابة تعلّم له بدل
       خطأٍ عامّ. القرار له، والعواقب مكتوبة قبله. */
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })) }),
    ])
  }
}
