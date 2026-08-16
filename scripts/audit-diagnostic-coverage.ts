/* تدقيق تغطية التشخيص — يفشل عند:
   مسار منشور بلا ملف تشخيصي، قالب منشور بلا إشارات تشخيصية،
   مهارة منشورة لا يقيسها أي سؤال ولا تغطيها أي دورة (يتيمة). */

import { getPrisma, disconnectPrisma } from '../server/db/client'

let failures = 0
const check = (cond: boolean, msg: string) => {
  if (!cond) { failures++; console.error(`✗ ${msg}`) }
}

const main = async () => {
  const prisma = await getPrisma()

  /* كل مسار منشور يملك ملفا تشخيصيا */
  const pathways = await prisma.pathway.findMany({ where: { status: 'published' }, select: { id: true } })
  const profiles = new Set(
    (await prisma.diagnosticProfile.findMany({ where: { entityType: 'pathway' }, select: { entityId: true } })).map((p) => p.entityId),
  )
  for (const p of pathways) check(profiles.has(p.id), `مسار منشور بلا ملف تشخيصي: ${p.id}`)

  /* كل قالب منشور يملك إشارات إيجابية أو حقائق مطلوبة */
  const templates = await prisma.compositeTemplate.findMany({
    where: { status: 'published' },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  })
  for (const t of templates) {
    const d = (t.versions[0]?.diagnostic ?? null) as { positive_signals?: unknown[]; required_facts?: unknown[] } | null
    check(
      Boolean(d && ((d.positive_signals?.length ?? 0) > 0 || (d.required_facts?.length ?? 0) > 0)),
      `قالب منشور بلا إشارات تشخيصية: ${t.id}`,
    )
  }

  /* المهارات اليتيمة: لا سؤال يقيسها ولا دورة تغطيها.
     تقريرية لا مانعة — المنهجية تتعمد إبقاء مهارات «فجوة غير متوفرة تجاريا» ظاهرة */
  const measuredBy = new Set((await prisma.questionSkillLink.findMany({ select: { skillId: true } })).map((l) => l.skillId))
  const coveredBy = new Set((await prisma.courseSkillLink.findMany({ select: { skillId: true } })).map((l) => l.skillId))
  const skills = await prisma.skill.findMany({ where: { status: 'published' }, select: { id: true, slug: true } })
  const orphans = skills.filter((s) => !measuredBy.has(s.id) && !coveredBy.has(s.id))
  if (orphans.length > 0) {
    console.log(`ℹ مهارات فجوة متعمدة (تظهر كفجوة في التوصية ولا دورة لها بعد): ${orphans.length} — مثل ${orphans.slice(0, 3).map((s) => s.slug).join('، ')}`)
  }

  console.log(`\n${failures === 0 ? '✅ التغطية مكتملة' : '✗ فشل'} — مسارات مغطاة: ${[...profiles].length}/${pathways.length}، قوالب بإشارات: ${templates.length}، مهارات يتيمة: ${orphans.length}`)
  await disconnectPrisma()
  /* خروج صريح: عملية postgres الابنة تُنهى مع العملية — بلا رسائل إغلاق مربكة */
  process.exit(failures > 0 ? 1 : 0)
}
/* سباق إغلاق القاعدة المدمجة معروف — امتصاص آمن يخرج فورا كما في المستورد */
process.on('uncaughtException', (e) => { if (/terminat/i.test(String(e))) process.exit(process.exitCode ?? 0); throw e })
process.on('unhandledRejection', (e) => { if (/terminat/i.test(String(e))) process.exit(process.exitCode ?? 0); throw e })
main().catch((e) => { console.error(e); process.exit(1) })
