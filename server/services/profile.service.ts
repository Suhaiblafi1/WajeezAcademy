/* خدمة الملف الشخصي للمتعلم — قراءة وتحديث البيانات الاختيارية التي يملكها الطالب نفسه.
   القواعد:
   - كل الحقول اختيارية؛ الحذف يكون بإرسال null.
   - diagnosticSnapshot لا تُعدَّل من هنا أبدا — تُربط عبر diagnostic-attach فقط.
   - البريد لا يُغيَّر من هذه الخدمة (له مسار تحقق خاص لاحقا). */

import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const str = (max: number) => z.string().trim().max(max).nullable().optional()
const patchSchema = z.object({
  displayName: z.string().trim().min(2, 'الاسم حرفان على الأقل').max(80).optional(),
  avatarUrl: str(500),
  phone: str(24),
  country: str(60),
  city: str(60),
  birthDate: z.string().datetime().nullable().optional(),
  gender: z.enum(['male', 'female']).nullable().optional(),
  preferredLanguage: str(20),
  education: str(80),
  university: str(120),
  major: str(120),
  jobTitle: str(120),
  company: str(120),
  experienceYears: str(10),
  careerGoal: str(300),
  goalAr: str(300),
  interests: z.array(z.string().trim().min(1).max(40)).max(12).nullable().optional(),
})

export type ProfilePatch = z.infer<typeof patchSchema>

export class ProfileService {
  private readonly prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** يقرأ الملف الكامل — ينشئ صفا فارغا عند أول زيارة حتى لا تتعامل الواجهة مع غياب */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, createdAt: true, status: true },
    })
    const profile = await this.prisma.learnerProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    })
    return { user, profile }
  }

  /** يحدّث ما أرسله الطالب فقط — بقية الحقول كما هي */
  async updateProfile(userId: string, raw: unknown) {
    const patch = patchSchema.parse(raw)
    const { displayName, ...profileFields } = patch

    if (displayName !== undefined) {
      await this.prisma.user.update({ where: { id: userId }, data: { displayName } })
    }

    const data: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(profileFields)) {
      if (value === undefined) continue
      if (key === 'birthDate') {
        data.birthDate = value ? new Date(value as string) : null
        continue
      }
      data[key] = value
    }

    const profile = await this.prisma.learnerProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    })
    return { profile }
  }
}
