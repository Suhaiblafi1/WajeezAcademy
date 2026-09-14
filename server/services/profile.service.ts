/* خدمة الملف الشخصي للمتعلم — قراءة وتحديث البيانات الاختيارية التي يملكها الطالب نفسه.
   القواعد:
   - كل الحقول اختيارية؛ الحذف يكون بإرسال null.
   - diagnosticSnapshot لا تُعدَّل من هنا أبدا — تُربط عبر diagnostic-attach فقط.
   - البريد لا يُغيَّر من هذه الخدمة (له مسار تحقق خاص لاحقا). */

import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import {
  assertFileUploadsEnabled, newStorageKey, signKey,
  MAX_PHOTO_BYTES, PHOTO_MIMES, PHOTO_KEY_PREFIX, SIGNED_URL_TTL_MS, photoStorageKey,
} from './storage.service'
import { deleteObject } from './object-store'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

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
    /* العمودُ يحمل `storage:<key>` لما رُفع عندنا، ورابطا خارجيّا لما أُلصق.
       والشاشةُ لا تفكّ مفاتيح: تُعطى عنوانا يفتح، وتعرف أنّ ما بدأ بـ`/api/`
       صورةٌ مرفوعةٌ لا نصٌّ يُحرَّر. */
    const key = photoStorageKey(profile.avatarUrl)
    return { user, profile: { ...profile, avatarUrl: key ? `/api/v1/avatars/${key}` : profile.avatarUrl } }
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

  /* ═══ صورةُ الحساب: يرفعها صاحبُها، ولا تُعرض للعامّة بذلك ═══

     قرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «everyone can put their picture and
     the admin approves it» — والاعتمادُ **على العامّ وحدَه**. فهذه تسري فورا
     في ترويسة صاحبها وشهاداته، ومن كان مدرّبا وُضعت صورتُه كذلك في
     `photoPendingKey` تنتظر الإدارة، ولا تمسّ `photoUrl` الذي تقرؤه الصفحةُ
     العامّة. فالرفعُ حرٌّ والعرضُ العامُّ محكوم.

     والمفتاحُ يُكتب **قبل** أن تُصدَر رابطُ الرفع، لأنّ `resolveStorageOwner`
     يقرأ المالكَ من القاعدة: فلو أُصدر الرابطُ أوّلا لَرُدّت بايتاتُه بـ٤٠٤. */
  async startAvatarUpload(userId: string, mime: string) {
    assertFileUploadsEnabled('والبديلُ الآن: ألصِق رابطَ صورةٍ مباشرا في الحقل.')
    if (!(PHOTO_MIMES as readonly string[]).includes(mime)) {
      throw new AuthError('bad_mime', 'الصورةُ JPEG أو PNG أو WebP', 422)
    }
    const existing = await this.prisma.learnerProfile.findUnique({
      where: { userId }, select: { avatarUrl: true },
    })
    const oldKey = photoStorageKey(existing?.avatarUrl)
    const storageKey = newStorageKey()

    await this.prisma.learnerProfile.upsert({
      where: { userId },
      create: { userId, avatarUrl: `${PHOTO_KEY_PREFIX}${storageKey}` },
      update: { avatarUrl: `${PHOTO_KEY_PREFIX}${storageKey}` },
    })

    /* ومن كان مدرّبا فصورتُه تنتظر الاعتماد — لا تُعرض بالرفع وحدَه */
    const trainer = await this.prisma.trainerProfile.findFirst({
      where: { userId }, select: { id: true },
    })
    if (trainer) {
      await this.prisma.trainerProfile.update({
        where: { id: trainer.id }, data: { photoPendingKey: storageKey },
      })
    }

    /* غيابُ القديمةِ ليس عطبا — المهمُّ ألّا تبقى بلا مالك */
    if (oldKey) { try { await deleteObject(oldKey) } catch { /* لا شيء */ } }

    const exp = Date.now() + SIGNED_URL_TTL_MS
    await recordAudit(this.prisma, {
      actorId: userId, action: 'account.avatar.upload', entityType: 'learner_profile', entityId: userId,
      meta: { awaitingApproval: Boolean(trainer) },
    })
    return {
      storageKey,
      uploadUrl: `/api/v1/uploads/${storageKey}?exp=${exp}&sig=${signKey(storageKey, exp, 'write')}`,
      maxBytes: MAX_PHOTO_BYTES,
      avatarUrl: `/api/v1/avatars/${storageKey}`,
      awaitingApproval: Boolean(trainer),
    }
  }
}
