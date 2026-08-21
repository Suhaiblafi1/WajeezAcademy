/* تدقيق سلامة الكتالوج — وضعان (البند د-٢):
   الافتراضي: القاعدة **بعد** الاستيراد — مرجع مفقود (دورة/مهارة/وحدة)، مسار بلا
   دورات، دورة بلا وحدات أو بلا مهارات، سؤال منشور بلا خيارات، قالب بلا دورات،
   إصدار منشور بلا لقطة.
   `--source`: ملفات JSON **قبل** الاستيراد، بلا قاعدة بيانات ولا خادم. مفيد في
   CI وعلى جهاز بلا قاعدة، ويجيب السؤال الصحيح قبل الكتابة لا بعدها.

   الاستعمال: npm run audit:catalog        (القاعدة)
              npm run audit:catalog -- --source   (الملفات) */

import { getPrisma, disconnectPrisma } from '../server/db/client'
import { assertCatalogSourceValid } from '../server/catalog/validate-source'

/* وضع المصدر أولا: لا يفتح قاعدة ولا ينتظرها */
if (process.argv.includes('--source')) {
  try {
    assertCatalogSourceValid({ verbose: true })
    process.exit(0)
  } catch {
    process.exit(1)
  }
}

let failures = 0
const check = (cond: boolean, msg: string) => {
  if (!cond) { failures++; console.error(`✗ ${msg}`) }
}

const main = async () => {
  const prisma = await getPrisma()

  /* مراجع الدورات داخل المسارات */
  const pathwayLinks = await prisma.pathwayCourse.findMany()
  const courseIds = new Set((await prisma.course.findMany({ select: { id: true } })).map((c) => c.id))
  for (const l of pathwayLinks) check(courseIds.has(l.courseId), `مسار ${l.pathwayId} يشير لدورة مفقودة ${l.courseId}`)

  /* مراجع الدورات داخل القوالب */
  const templateLinks = await prisma.templateCourse.findMany()
  for (const l of templateLinks) check(courseIds.has(l.courseId), `قالب ${l.templateId} يشير لدورة مفقودة ${l.courseId}`)

  /* مراجع المهارات */
  const skillIds = new Set((await prisma.skill.findMany({ select: { id: true } })).map((s) => s.id))
  for (const l of await prisma.courseSkillLink.findMany()) {
    check(courseIds.has(l.courseId), `رابط مهارة يشير لدورة مفقودة ${l.courseId}`)
    check(skillIds.has(l.skillId), `دورة ${l.courseId} تشير لمهارة مفقودة ${l.skillId}`)
  }
  for (const l of await prisma.questionSkillLink.findMany()) {
    check(skillIds.has(l.skillId), `سؤال ${l.questionId} يشير لمهارة مفقودة ${l.skillId}`)
  }

  /* اكتمال بنيوي للمنشور */
  const publishedPathways = await prisma.pathway.findMany({ where: { status: 'published' }, include: { courses: true, versions: true } })
  for (const p of publishedPathways) {
    check(p.courses.length > 0, `مسار منشور بلا دورات: ${p.id}`)
    check(p.versions.length > 0, `مسار منشور بلا إصدار محتوى: ${p.id}`)
  }
  const publishedCourses = await prisma.course.findMany({ where: { status: 'published' }, include: { modules: true, skillLinks: true, versions: true } })
  for (const c of publishedCourses) {
    check(c.modules.length > 0, `دورة منشورة بلا وحدات: ${c.id}`)
    check(c.skillLinks.length > 0, `دورة منشورة بلا مهارات: ${c.id}`)
    check(c.versions.length > 0, `دورة منشورة بلا إصدار محتوى: ${c.id}`)
  }
  const publishedQuestions = await prisma.question.findMany({ where: { status: 'published', active: true }, include: { options: true } })
  /* أسئلة النص الحر والهجينة (or_text) بلا خيارات مسبقة بطبيعتها — لا تدقيق خيارات عليها */
  const choiceTypes = ['single_choice', 'multi_choice', 'rank_top3', 'yes_no']
  for (const q of publishedQuestions) {
    if (choiceTypes.includes(q.answerType)) check(q.options.length >= 2, `سؤال اختياري منشور بأقل من خيارين: ${q.id}`)
  }

  /* الإصدار المنشور يحمل لقطة */
  const published = await prisma.catalogVersion.findMany({ where: { status: 'published' }, include: { snapshots: true } })
  for (const v of published) check(v.snapshots.length > 0, `إصدار منشور بلا لقطة: ${v.label}`)

  console.log(`\n${failures === 0 ? '✅ سليم' : '✗ فشل'} — مسارات: ${publishedPathways.length}، دورات: ${publishedCourses.length}، أسئلة: ${publishedQuestions.length}`)
  await disconnectPrisma()
  /* خروج صريح: عملية postgres الابنة تُنهى مع العملية — بلا رسائل إغلاق مربكة */
  process.exit(failures > 0 ? 1 : 0)
}
/* سباق إغلاق القاعدة المدمجة معروف — امتصاص آمن يخرج فورا كما في المستورد */
process.on('uncaughtException', (e) => { if (/terminat/i.test(String(e))) process.exit(process.exitCode ?? 0); throw e })
process.on('unhandledRejection', (e) => { if (/terminat/i.test(String(e))) process.exit(process.exitCode ?? 0); throw e })
main().catch((e) => { console.error(e); process.exit(1) })
