/* إتاحةُ المدرّب — ساعاتٌ يعلنها وغيابٌ يسجّله (المهمّة ٧١).

   ولمَ خدمةٌ لا سطران في المسار: الحدودُ هنا **قواعدُ عملٍ** لا تحقّقَ شكل.
   نافذةٌ تنتهي قبل أن تبدأ، ونافذتان متداخلتان في اليوم نفسِه، وغيابٌ في
   الماضي، وغيابٌ يمتدّ سنة — كلُّها تُقبل شكلا وتُفسد المعنى: من أعلن
   نافذتَين متداخلتَين لا يعرف أحدٌ ماذا أراد، ومن سجّل غيابا مضى لا يمنع
   شيئا ويُشوّش القائمة.

   والحكمُ في `cohort.service.ts`: الغيابُ يردّ الإسناد، والساعاتُ تُعَدّ
   للمُسنِد ولا تمنعه. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

export interface AvailabilityWindow {
  weekday: number
  startMinute: number
  endMinute: number
}

/** أقصى مدّةِ غيابٍ تُسجَّل مرّةً واحدة — أطولُ منها يُقسَّم أو يُراجَع مع الإدارة */
export const MAX_BLACKOUT_DAYS = 120

export class TrainerAvailabilityService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** الملفُّ المرتبطُ بالحساب — رفضٌ صريحٌ لمن لا ملفَّ له بدل تعطّلٍ صامت */
  private async profileFor(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId } })
    if (!profile) throw new AuthError('no_trainer_profile', 'لا ملفَّ مدرّبٍ مرتبطا بهذا الحساب', 404)
    return profile
  }

  async mine(userId: string) {
    const profile = await this.profileFor(userId)
    const [windows, blackouts] = await Promise.all([
      this.prisma.trainerAvailability.findMany({
        where: { profileId: profile.id },
        orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
      }),
      this.prisma.trainerBlackout.findMany({
        where: { profileId: profile.id },
        orderBy: { startsAt: 'asc' },
      }),
    ])
    return {
      windows: windows.map((w) => ({ weekday: w.weekday, startMinute: w.startMinute, endMinute: w.endMinute })),
      blackouts: blackouts.map((b) => ({
        id: b.id, startsAt: b.startsAt, endsAt: b.endsAt, reason: b.reason,
        past: b.endsAt.getTime() < Date.now(),
      })),
      /* يُقال للمدرّب صراحةً ما يعنيه إعلانُه — فلا يظنّ أنّه قفلٌ ولا أنّه بلا أثر */
      meaningAr: windows.length === 0
        ? 'لم تُعلن ساعاتك بعد — ولا يمنعك ذلك من شيء، لكنّ من يُسنِد لا يعرف وقتَك المناسب'
        : 'ساعاتُك المعلنة تظهر لمن يُسنِد الشعب، وما يقع خارجها يُعَدُّ له تنبيها لا منعا',
    }
  }

  /** استبدالٌ كامل: الأسبوعُ يُعلَن مرّةً واحدةً كلَّه، فلا صفوفٌ يتيمةٌ تبقى */
  async replaceWindows(userId: string, windows: AvailabilityWindow[]) {
    const profile = await this.profileFor(userId)
    for (const w of windows) {
      if (!Number.isInteger(w.weekday) || w.weekday < 0 || w.weekday > 6) {
        throw new AuthError('bad_weekday', 'اليوم من ٠ (الأحد) إلى ٦ (السبت)', 400)
      }
      if (!Number.isInteger(w.startMinute) || !Number.isInteger(w.endMinute)) {
        throw new AuthError('bad_minutes', 'الوقت بالدقائق من منتصف الليل', 400)
      }
      if (w.startMinute < 0 || w.endMinute > 1440 || w.startMinute >= w.endMinute) {
        throw new AuthError('bad_window', 'نافذةٌ تنتهي قبل أن تبدأ — راجع الوقت', 400)
      }
    }
    /* التداخلُ في اليوم نفسِه يُردّ: نافذتان متداخلتان لا تقولان شيئا زائدا،
       وتجعلان عدَّ «ما خارج الساعات» غامضا. */
    for (let d = 0; d <= 6; d++) {
      const day = windows.filter((w) => w.weekday === d).sort((a, b) => a.startMinute - b.startMinute)
      for (let i = 1; i < day.length; i++) {
        if (day[i].startMinute < day[i - 1].endMinute) {
          throw new AuthError('overlapping_windows', 'نافذتان متداخلتان في اليوم نفسه — اجمعهما في واحدة', 400)
        }
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerAvailability.deleteMany({ where: { profileId: profile.id } })
      if (windows.length > 0) {
        await tx.trainerAvailability.createMany({
          data: windows.map((w) => ({ profileId: profile.id, ...w })),
        })
      }
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.availability.set', entityType: 'trainer_profile', entityId: profile.id,
      meta: { windows: windows.length },
    })
    return this.mine(userId)
  }

  async addBlackout(userId: string, input: { startsAt: Date; endsAt: Date; reason?: string }) {
    const profile = await this.profileFor(userId)
    if (input.endsAt <= input.startsAt) {
      throw new AuthError('bad_range', 'تاريخُ النهاية يجب أن يكون بعد البداية', 400)
    }
    const days = (input.endsAt.getTime() - input.startsAt.getTime()) / 86_400_000
    if (days > MAX_BLACKOUT_DAYS) {
      throw new AuthError('too_long', `أقصى مدّةِ غيابٍ تُسجَّل مرّةً ${MAX_BLACKOUT_DAYS} يوما — قسّمها أو راجع الإدارة`, 400)
    }
    /* غيابٌ مضى لا يمنع شيئا ويُشوّش القائمة — وهو غالبا خطأُ سنةٍ في التاريخ */
    if (input.endsAt.getTime() < Date.now()) {
      throw new AuthError('in_the_past', 'هذه المدّة مضت — تحقّق من التاريخ', 400)
    }
    const created = await this.prisma.trainerBlackout.create({
      data: { profileId: profile.id, startsAt: input.startsAt, endsAt: input.endsAt, reason: input.reason ?? null },
    })
    /* الأثرُ يُسجَّل: الغيابُ يردُّ إسنادا، فمن سأل «لماذا لم يُسنَد؟» يجد الجواب */
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.blackout.add', entityType: 'trainer_profile', entityId: profile.id,
      meta: { from: input.startsAt.toISOString(), to: input.endsAt.toISOString(), reason: input.reason ?? null },
    })
    return created
  }

  async removeBlackout(userId: string, id: string) {
    const profile = await this.profileFor(userId)
    const row = await this.prisma.trainerBlackout.findUnique({ where: { id } })
    if (!row || row.profileId !== profile.id) {
      throw new AuthError('not_found', 'لا سجلَّ غيابٍ بهذا المعرّف في ملفّك', 404)
    }
    await this.prisma.trainerBlackout.delete({ where: { id } })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.blackout.remove', entityType: 'trainer_profile', entityId: profile.id,
      meta: { from: row.startsAt.toISOString(), to: row.endsAt.toISOString() },
    })
    return { ok: true }
  }
}
