/* ═══ فتحُ الشعبة ينشر اسمَ مدرّبها (٢٠ أكتوبر ٢٠٢٦) ═══

   ═══ ما كان ═══

   اسمُ المدرّب لا يُعرض إلّا بزرّ «اعتمد ظهوره العامّ» في «تشغيل المدرّبين» — والزرُّ لا يضغطه أحدٌ حين تُفتح
   الشعبة. فقِيس في الإنتاج يومين متتاليين: ستُّ شعبٍ تُباع بلا اسم مدرّب، ثلاثٌ منها لحفصة، وأربعةُ مدرّبين
   غائبون عن صفحة المدرّبين ولهم شعبٌ مفتوحةٌ وجارية. وسأل صاحبُ المنصّة: «لماذا حفصة لا تظهر بقائمة المدرّبين؟
   لها شعب».

   ═══ والقرار ═══

   خُيّر بين إبقاء الاعتماد يدويّا ونشره مع فتح الشعبة، فاختار الثاني: فتحُ الشعبة لا يقع إلّا بعد اعتماد خطّة
   مدرّبها (`openChecklist`)، فهو نفسُه اعتمادٌ لدوراته ونشرٌ لها — وهو شرطُ الظهور منذ ١٩ أكتوبر («لا ينشر حساب
   لمن لم نعتمد دوراته ولم تنشر»). فاسمُه يُنشر في اللحظة نفسِها.

   ═══ وأين يقع ═══

   · عند الفتح (`CohortService.open`) — والطرقُ كلُّها إليه: الزرُّ، و«افتح المعتمدة كلها»، و«اعتمد وافتح».
   · وفي العامل كلَّ ربع ساعة (`publish_live_trainers`) — لكلّ شعبةٍ مفتوحةٍ أو ممتلئةٍ أو جارية: يلحق مَن
     فُتحت شعبتُه قبل هذا القرار، ومَن أُضيف إلى شعبةٍ بعد فتحها.

   ═══ وما لا يُنشر ═══

   · الموقوف: الإيقافُ قرارٌ بإخفائه، فلا يُنقض آليّا.
   · ومن ليس طلبُه نشطا: صفحةُ المدرّبين لا تعرضه أصلا، وزرُّ الاعتماد يرفضه. فيُعدّ ويُقال في خبر العامل،
     والوسمُ الأحمرُ في «تشغيل المدرّبين» يبقى عليه.

   والأثرُ والإشعارُ أثرُ الاعتماد اليدويّ نفسُه (`trainer.publish_approve`)، وفي الأثر `auto` والشعبُ التي نشرته. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { recordAudit } from './audit'
import { safeNotify } from './notification.service'

/** الشعبُ التي تُعرض للعامّة — مفتوحةٌ أو ممتلئةٌ أو جارية */
export const LIVE_COHORT_STATUSES = ['open', 'full', 'active'] as const

/** إشعارُ صاحب الاسم حين يصير يُعرض — واحدٌ للاعتماد اليدويّ والآليّ */
export const PUBLISH_APPROVED_NOTICE = {
  templateKey: 'trainer.publish.approved',
  title: 'اعتمد ظهورك للعامّة',
  body: 'صار ملفّك — اسمك وسيرتك ودوراتك — يظهر في صفحة مدرّبي الأكاديمية وفي صفحتك باسمك. راجعه، فما فيه هو ما يقرؤه الناس.',
} as const

/** مَن لا يُعرض اسمُه بعد — عكسُ `PUBLIC_TRAINER_WHERE` في حقوله الثلاثة */
const NOT_YET_SHOWN: Prisma.TrainerProfileWhereInput = {
  suspendedAt: null,
  OR: [{ publicVisibility: false }, { isVerified: false }, { publishApprovedAt: null }],
}

/** ينشر اسمَ مدرّبي الشعب المعروضة — كلِّها أو المسمّاة منها. يُعاد بلا ضرر: مَن نُشر لا يُمسّ ثانية */
export async function publishCohortTrainers(
  prisma: PrismaClient,
  opts: { cohortIds?: readonly string[]; actorId: string | null; now?: Date },
): Promise<{ published: string[]; notActive: number }> {
  const rows = await prisma.cohortTrainer.findMany({
    where: {
      cohort: { status: { in: [...LIVE_COHORT_STATUSES] }, ...(opts.cohortIds ? { id: { in: [...opts.cohortIds] } } : {}) },
      profile: NOT_YET_SHOWN,
    },
    select: { cohortId: true, profileId: true, profile: { select: { userId: true, application: { select: { status: true } } } } },
  })
  const byProfile = new Map<string, { cohortIds: string[]; userId: string | null; active: boolean }>()
  for (const r of rows) {
    const p = byProfile.get(r.profileId) ?? { cohortIds: [], userId: r.profile.userId, active: r.profile.application.status === 'active' }
    p.cohortIds.push(r.cohortId)
    byProfile.set(r.profileId, p)
  }

  const published: string[] = []
  let notActive = 0
  const at = opts.now ?? new Date()
  for (const [profileId, p] of byProfile) {
    if (!p.active) { notActive++; continue }
    /* والشرطُ في التحديث نفسِه: لا يُنشر مَن أُوقف بين القراءة والكتابة */
    const { count } = await prisma.trainerProfile.updateMany({
      where: { id: profileId, ...NOT_YET_SHOWN },
      data: { isVerified: true, publicVisibility: true, publishApprovedAt: at, publishApprovedBy: opts.actorId },
    })
    if (count === 0) continue
    published.push(profileId)
    await recordAudit(prisma, {
      actorId: opts.actorId, action: 'trainer.publish_approve', entityType: 'trainer_profile', entityId: profileId,
      meta: { auto: true, cohortIds: p.cohortIds },
    })
    if (p.userId) {
      await safeNotify(prisma, { userId: p.userId, channel: 'in_app', audience: 'trainer', ...PUBLISH_APPROVED_NOTICE })
    }
  }
  return { published, notActive }
}
