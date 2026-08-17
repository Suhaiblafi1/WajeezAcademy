/* توليد مصفوفة القرار الأكاديمي — docs/ACADEMIC_DECISION_MATRIX_AR.md
   تشمل: المهارات الموقوفة للمراجعة (pending_academic_review)
   + المهارات الأربع «المقاسة بلا تغطية» من مصفوفة التغطية.
   لكل مهارة: تعريفها، عائلتها، من يقيسها/يغطيها/يطلبها، والخيارات المتاحة
   مع خانة قرار فارغة تُملأ يدويا واحدة واحدة.
   القاعدة: لا سؤال جديد ولا تغيير محرك قبل اكتمال عمود «القرار». */

import { writeFileSync } from 'node:fs'
import { getPrisma, disconnectPrisma } from '../server/db/client'
import { PENDING_REVIEW } from './mark-skills-pending-review'

const OPTIONS = [
  'يبقى مخرج تعلم (تغطيه دورة لاحقا)',
  'يُربط بدورة/مسار قائم (يصبح مطلوبا)',
  'يدخل التشخيص (يحتاج سؤالا جديدا — بعد المراجعة فقط)',
  'يُدمج في مهارة شقيقة',
  'يُؤرشف نهائيا',
]

async function main() {
  const prisma = await getPrisma()

  const pending = await prisma.skill.findMany({
    where: { status: PENDING_REVIEW },
    include: {
      questionLinks: { include: { question: { select: { id: true, active: true, status: true } } } },
      courseLinks: { select: { courseId: true } },
      pathwayReqs: { select: { pathwayId: true } },
    },
    orderBy: [{ familyId: 'asc' }, { id: 'asc' }],
  })

  /* الأربع المقاسة بلا تغطية — من مصفوفة التغطية الحية */
  const published = await prisma.skill.findMany({
    where: { status: 'published' },
    include: {
      questionLinks: { include: { question: { select: { id: true, active: true, status: true } } } },
      courseLinks: { select: { courseId: true } },
      pathwayReqs: { select: { pathwayId: true } },
    },
  })
  const measuredUncovered = published.filter((s) => {
    const measured = s.questionLinks.some((l) => l.question.active && l.question.status === 'published')
    return measured && s.courseLinks.length === 0
  })

  const md: string[] = []
  md.push('# مصفوفة القرار الأكاديمي — المهارات قيد المراجعة', '')
  md.push(`توليد: ${new Date().toISOString().slice(0, 10)} — من قاعدة البيانات الحية.`, '')
  md.push('## كيف نقرر', '')
  md.push('كل صف مهارة تحتاج قرارا واحدا من الخيارات الخمسة. لا يُضاف أي سؤال جديد ولا يتغير محرك التوصية قبل اكتمال عمود «القرار» لكل الصفوف.', '')
  md.push('الخيارات:')
  OPTIONS.forEach((o, i) => md.push(` ${i + 1}. ${o}`))
  md.push('')
  md.push(`## أ) مهارات موقوفة للمراجعة (${pending.length}) — كانت «ميتة»: لا قياس ولا تغطية ولا مسار يطلبها`, '')
  md.push('| المهارة | المعرف | العائلة | التعريف | القرار | ملاحظة المراجع |')
  md.push('|---|---|---|---|---|---|')
  for (const s of pending) {
    md.push(`| ${s.nameAr} | \`${s.id}\` | ${s.familyId ?? '—'} | ${(s.definitionAr ?? '—').replace(/\|/g, '\\|')} | ☐ | |`)
  }
  md.push('')
  md.push(`## ب) مهارات مقاسة في التشخيص بلا تغطية دوراتية (${measuredUncovered.length}) — حالتها قائمة وتحتاج قرار تغطية`, '')
  md.push('| المهارة | المعرف | العائلة | يقيسها | القرار | ملاحظة المراجع |')
  md.push('|---|---|---|---|---|---|')
  for (const s of measuredUncovered) {
    const qs = s.questionLinks.filter((l) => l.question.active && l.question.status === 'published').map((l) => `\`${l.question.id}\``).join('، ')
    md.push(`| ${s.nameAr} | \`${s.id}\` | ${s.familyId ?? '—'} | ${qs || '—'} | ☐ | |`)
  }
  md.push('')
  md.push('## بعد اكتمال القرارات', '')
  md.push('- «يُدمج/يُؤرشف» → تُنفَّذ عبر سكربت موثق مع تحديث مصفوفة التغطية.')
  md.push('- «يُربط بدورة/مسار» → ربط مرجعي فقط (CourseSkillLink / PathwaySkillRequirement) — الدورة تبقى كيانا مركزيا واحدا.')
  md.push('- «يدخل التشخيص» → يتطلب سؤالا جديدا بأثر موثق، ويمر على audit:diagnostic وaudit:skill-coverage قبل النشر.')

  writeFileSync('docs/ACADEMIC_DECISION_MATRIX_AR.md', md.join('\n'))
  console.log(`📄 docs/ACADEMIC_DECISION_MATRIX_AR.md — ${pending.length} موقوفة + ${measuredUncovered.length} مقاسة بلا تغطية`)

  await disconnectPrisma()
  process.exit(0)
}
main()
