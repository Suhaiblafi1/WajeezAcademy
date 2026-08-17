/* إيقاف المهارات الميتة للمراجعة الأكاديمية — لا حذف ولا دمج.
   يقرأ docs/skill-coverage-matrix.json (مولَّد من audit:skill-coverage)
   ويحوّل كل مهارة مصنفة «ميتة» إلى status = pending_academic_review.
   - idempotent: إعادة التشغيل لا تفعل شيئا جديدا.
   - لا يمس أي مهارة مقاسة أو مغطاة أو مطلوبة من مسار.
   - محرك التشخيص لا يتأثر: هذه المهارات غير مرتبطة بأي سؤال نشط أصلا. */

import { readFileSync } from 'node:fs'
import { getPrisma, disconnectPrisma } from '../server/db/client'

export const PENDING_REVIEW = 'pending_academic_review'

async function main() {
  const matrix = JSON.parse(readFileSync('docs/skill-coverage-matrix.json', 'utf8')) as {
    rows: { id: string; kind: string }[]
  }
  const deadIds = matrix.rows.filter((r) => r.kind === 'ميتة').map((r) => r.id)
  if (deadIds.length === 0) {
    console.log('لا مهارات ميتة في المصفوفة — لا شيء لإيقافه')
    process.exit(0)
  }

  const prisma = await getPrisma()

  /* حماية مزدوجة: نعيد التحقق من القاعدة نفسها أن كل مهارة بلا قياس ولا تغطية ولا طلب */
  const skills = await prisma.skill.findMany({
    where: { id: { in: deadIds } },
    include: {
      questionLinks: { include: { question: { select: { active: true, status: true } } } },
      courseLinks: { select: { courseId: true } },
      pathwayReqs: { select: { pathwayId: true } },
    },
  })
  const unsafe = skills.filter(
    (s) =>
      s.questionLinks.some((l) => l.question.active && l.question.status === 'published') ||
      s.courseLinks.length > 0 ||
      s.pathwayReqs.length > 0,
  )
  if (unsafe.length > 0) {
    console.error(`✗ مرفوض: ${unsafe.length} مهارة في القائمة ليست ميتة فعلا: ${unsafe.map((s) => s.id).join('، ')}`)
    process.exit(1)
  }

  const result = await prisma.skill.updateMany({
    where: { id: { in: deadIds }, status: 'published' },
    data: { status: PENDING_REVIEW },
  })
  const already = deadIds.length - result.count
  console.log(`✅ أُوقفت للمراجعة الأكاديمية: ${result.count} مهارة${already > 0 ? ` — (${already} كانت موقوفة مسبقا)` : ''}`)
  console.log('   الحالة الجديدة:', PENDING_REVIEW, '— القرار النهائي لكل مهارة في docs/ACADEMIC_DECISION_MATRIX_AR.md')

  await disconnectPrisma()
  process.exit(0)
}
main()
