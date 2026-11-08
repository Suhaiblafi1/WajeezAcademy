/* فيديو المدرّب للعامّة — «تعرّف على مدرّبك» (٨ نوفمبر ٢٠٢٦).

   القرارُ وترتيبُ الاختيار وبناءُ رابط التضمين في `src/application/trainer/marketing-video.ts`.
   وهنا القراءةُ من القاعدة وحدَها.

   ═══ والبوّابةُ عند من يسأل، لا هنا ═══

   هذه لا تعرف من يجوز عرضُه: تأخذ ملفّاتٍ **مرّت ببوّابة الظهور** وتردّ فيديو كلٍّ منها. ومن يسألها
   اثنان: مدرّبو الدورة المعلَنون (`publicCourseTrainer` بعد `trainerPubliclyVisible`)، وصفحتُه باسمه
   (`trainerPublicPage` بعد `publicTrainerWhere()`). فالاستعلامُ مقصورٌ على المعرّفات الممرَّرة بالبناء
   — لا يُقرأ فيديو من لم يُمرَّر، ولو كان أصيلَ شعبةٍ في الدورة نفسِها. */

import type { PrismaClient } from '@prisma/client'
import { pickPublicVideo, type PublicTrainerVideo } from '../../src/application/trainer/marketing-video'

/** فيديو كلِّ ملفٍّ ظاهر: لهذه الدورة أوّلا ثمّ تعريفُه. و`courseId` بـ`null` لتعريفه وحدَه. ومن لا فيديو له لا يرد في الخريطة */
export async function publicVideosOf(
  prisma: PrismaClient, visibleProfileIds: readonly string[], courseId: string | null,
): Promise<Map<string, PublicTrainerVideo>> {
  if (visibleProfileIds.length === 0) return new Map()
  const rows = await prisma.trainerMarketingVideo.findMany({
    where: {
      profileId: { in: [...visibleProfileIds] },
      OR: [
        { targetKind: 'bio', targetId: '' },
        ...(courseId ? [{ targetKind: 'course', targetId: courseId }] : []),
      ],
    },
    select: { profileId: true, targetKind: true, targetId: true, url: true },
  })
  const out = new Map<string, PublicTrainerVideo>()
  for (const id of visibleProfileIds) {
    const v = pickPublicVideo(rows.filter((r) => r.profileId === id), courseId)
    if (v) out.set(id, v)
  }
  return out
}
