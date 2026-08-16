/* تدقيق تكرار الكتالوج — يفشل عند:
   course_id مكرر (محال: المفتاح الأساسي)، دورتان بنفس العنوان أو نفس مجموعة المهارات
   بلا سبب موثق، وحدات مكررة العنوان داخل نفس الدورة، أسئلة مكررة النص. */

import { getPrisma, disconnectPrisma } from '../server/db/client'

let failures = 0
const check = (cond: boolean, msg: string) => {
  if (!cond) { failures++; console.error(`✗ ${msg}`) }
}

const main = async () => {
  const prisma = await getPrisma()

  /* عناوين الدورات */
  const versions = await prisma.courseVersion.findMany({ orderBy: { version: 'desc' } })
  const latestByCourse = new Map<string, string>()
  for (const v of versions) if (!latestByCourse.has(v.courseId)) latestByCourse.set(v.courseId, v.titleAr.trim())
  const byTitle = new Map<string, string[]>()
  for (const [cid, title] of latestByCourse) {
    byTitle.set(title, [...(byTitle.get(title) ?? []), cid])
  }
  for (const [title, ids] of byTitle) check(ids.length === 1, `عنوان دورة مكرر بين ${ids.join(' و')}: «${title}»`)

  /* بصمة المهارات لكل دورة — بصمتان متطابقتان تعنيان تكرار محتوى محتملا */
  const links = await prisma.courseSkillLink.findMany({ orderBy: { skillId: 'asc' } })
  const skillsByCourse = new Map<string, string[]>()
  for (const l of links) skillsByCourse.set(l.courseId, [...(skillsByCourse.get(l.courseId) ?? []), l.skillId])
  const byFingerprint = new Map<string, string[]>()
  for (const [cid, skills] of skillsByCourse) {
    const fp = skills.join('|')
    byFingerprint.set(fp, [...(byFingerprint.get(fp) ?? []), cid])
  }
  for (const [fp, ids] of byFingerprint) {
    if (fp === '') continue
    check(ids.length === 1, `دورات بنفس بصمة المهارات تماما: ${ids.join('، ')}`)
  }

  /* وحدات مكررة العنوان داخل الدورة */
  const moduleVersions = await prisma.courseModuleVersion.findMany()
  const seen = new Map<string, string>()
  for (const m of moduleVersions) {
    const key = `${m.moduleId.split('-M')[0]}::${m.titleAr.trim()}`
    check(!seen.has(key), `عنوان وحدة مكرر داخل دورة: ${m.titleAr} (${m.moduleId})`)
    seen.set(key, m.moduleId)
  }

  /* أسئلة مكررة النص */
  const questionVersions = await prisma.questionVersion.findMany({ orderBy: { version: 'desc' } })
  const latestText = new Map<string, string>()
  for (const q of questionVersions) if (!latestText.has(q.questionId)) latestText.set(q.questionId, q.textAr.trim())
  const byText = new Map<string, string[]>()
  for (const [qid, text] of latestText) byText.set(text, [...(byText.get(text) ?? []), qid])
  for (const [text, ids] of byText) check(ids.length === 1, `نص سؤال مكرر بين ${ids.join(' و')}: «${text.slice(0, 40)}…»`)

  const total = latestByCourse.size
  console.log(`\n${failures === 0 ? '✅ لا تكرار' : '✗ فشل'} — ${total} دورة فريدة، ${latestText.size} سؤالا فريدا`)
  await disconnectPrisma()
  if (failures > 0) process.exit(1)
}
process.on('uncaughtException', (e) => { if (!/terminat/i.test(String(e))) throw e })
main().catch((e) => { console.error(e); process.exit(1) })
