/* ك-٣ — دورةٌ بلا مهاراتٍ تُنشَر ولا يراها أحد.

   ═══ العطبُ الذي كُتب له ═══

   الوصولُ إلى التشخيص شرطُه `Course.status === 'published'` وحدَه: لا علَمَ
   ولا رابطةَ مهارة. وحاجزُ النشر كان يفحص أنّ **كلَّ رابطةٍ تُحلّ إلى مهارةٍ
   حقيقيّة** — وهو فحصٌ صحيحٌ لا يحرس من الصفر: حلقةٌ على مصفوفةٍ فارغةٍ لا
   تدور، فلا خطأ.

   فدورةٌ تُنشَر بلا مهارةٍ تدخل الكتالوجَ **ولا يرشّحها مطابقُ المهارات
   لأحدٍ أبدا**: حيّةٌ في القائمة، ميّتةٌ في المحرّك. ولا شكوى تصل — من لم
   يُرشَّح له شيءٌ لا يعرف أنّه فاته.

   وبابُ دخولها مفتوح: `skillIds` في مسار الإنشاء `default([])`.

   ═══ والنصفُ الثاني: ولا سبيلَ إلى إصلاحها ═══

   `CourseSkillLink` كانت تُكتب في موضعَين لا ثالثَ لهما — `createCourse`
   والمستورِد. فما وُلد بلا مهارةٍ بقي كذلك، **ولا شاشةَ تُصلحه**. فحاجزٌ بلا
   بابٍ يفتحه سجنٌ لا حارس: يمنع النشرَ ولا يدلّ على مخرج. ولذلك يُبنيان معا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CatalogAdminService } from '../../services/catalog-admin.service'
import { PublishingService } from '../../services/publishing.service'

let prisma: PrismaClient
let admin: CatalogAdminService
let pub: PublishingService
let makerId = ''
let checkerId = ''

const S = Date.now().toString(36).toUpperCase().slice(-4)
/* المعرّفُ يولّده الخادمُ الآن (`mintCourseId`) فلا يُكتب هنا — ويُقرأ من
   ردّ الإنشاء. وهذا هو المقصود: من يكتبه صار النظامَ لا الإنسان. */
let COURSE = ''
const SKILL_A = `SK-X-K3A-${S}`
const SKILL_B = `SK-X-K3B-${S}`

/** أخطاءُ حاجز النشر التي تخصّ دورتَنا وحدَها — الساحةُ فيها غيرُها */
const oursIn = (errors: string[]) => errors.filter((e) => e.includes(COURSE))

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  admin = new CatalogAdminService(prisma)
  pub = new PublishingService(prisma)

  const m = await auth.register(`k3-maker-${S}@test.local`, 'Maker#12345', 'صانع')
  const c = await auth.register(`k3-checker-${S}@test.local`, 'Checker#12345', 'مراجع')
  makerId = m.userId
  checkerId = c.userId
  await auth.setRoles(makerId, ['academic_manager'])
  await auth.setRoles(checkerId, ['academic_manager'])

  await admin.createSkill({ id: SKILL_A, slug: `k3_a_${S.toLowerCase()}`, nameAr: 'مهارةُ اختبارٍ أولى', familyId: 'COG' }, makerId)
  await admin.createSkill({ id: SKILL_B, slug: `k3_b_${S.toLowerCase()}`, nameAr: 'مهارةُ اختبارٍ ثانية', familyId: 'COG' }, makerId)

  /* ═══ وهذا هو البابُ بعينه ═══
     `skillIds: []` مقبولةٌ في مسار الإنشاء — فالدورةُ تُولد عمياءَ بلا اعتراض. */
  COURSE = (await admin.createCourse({
    pathwayId: 'PW-STU-003', sequence: 9,
    titleAr: 'دورةٌ وُلدت بلا مهارات', totalHours: 2, skillIds: [],
    modules: [{ sequence: 1, titleAr: 'وحدةٌ أولى', hours: 2 }],
  }, makerId)).id

  /* تُعتمد بالطريق الحقيقيّ — صانعٌ ومراجعٌ لا كتابةَ حالةٍ باليد */
  const cr = await admin.submitChangeRequest('course', COURSE, { kind: 'k3_fixture' }, makerId)
  await admin.decide(cr.id, 'approve', 'اعتمادٌ للاختبار', checkerId)
}, 240_000)

describe('حاجزُ النشر يرى الصفر', () => {
  it('دورةٌ معتمدةٌ بلا مهارةٍ واحدةٍ لا تُنشر', async () => {
    const { errors } = await pub.validateDrafts()
    const ours = oursIn(errors)
    expect(ours.join(' | '), 'مرّت دورةٌ بلا مهارةٍ إلى النشر').toContain('بلا مهارات')
  })

  it('والرسالةُ تقول ما يترتّب لا «ناقصة» وحدَها', async () => {
    const { errors } = await pub.validateDrafts()
    expect(oursIn(errors).join(' | ')).toContain('لن يرشّحها التشخيص')
  })
})

describe('وبابٌ يفتحه — ربطُ المهارات بعد الميلاد', () => {
  it('يربط، فيسكت الحاجزُ عن دورتنا', async () => {
    const out = await admin.setCourseSkills(COURSE, [SKILL_A], makerId)
    expect(out.skillIds).toEqual([SKILL_A])
    expect(await prisma.courseSkillLink.count({ where: { courseId: COURSE } })).toBe(1)

    const { errors } = await pub.validateDrafts()
    expect(oursIn(errors).join(' | '), 'رُبطت مهارةٌ والحاجزُ ما زال يمنع').not.toContain('بلا مهارات')
  })

  it('ويستبدل الربطَ كلَّه لا يضيف إليه — ففكُّ ما أُلحق خطأً حاجةٌ كإلحاقه', async () => {
    await admin.setCourseSkills(COURSE, [SKILL_B], makerId)
    const links = await prisma.courseSkillLink.findMany({ where: { courseId: COURSE }, select: { skillId: true } })
    expect(links.map((l) => l.skillId), 'أُضيفت الثانيةُ وبقيت الأولى — فالربطُ يتراكم ولا يُصحَّح').toEqual([SKILL_B])
  })

  it('ولا يُكرَّر ما أُرسل مرّتين', async () => {
    const out = await admin.setCourseSkills(COURSE, [SKILL_A, SKILL_A, SKILL_B], makerId)
    expect(out.skillIds).toEqual([SKILL_A, SKILL_B])
    expect(await prisma.courseSkillLink.count({ where: { courseId: COURSE } })).toBe(2)
  })

  it('والتفريغُ يعيد الحاجزَ — فالبابُ يفتح ويغلق', async () => {
    await admin.setCourseSkills(COURSE, [], makerId)
    expect(await prisma.courseSkillLink.count({ where: { courseId: COURSE } })).toBe(0)
    const { errors } = await pub.validateDrafts()
    expect(oursIn(errors).join(' | ')).toContain('بلا مهارات')
    await admin.setCourseSkills(COURSE, [SKILL_A], makerId)
  })

  it('ومهارةٌ لا وجودَ لها تُردّ بالاسم قبل أن تُكتب', async () => {
    await expect(admin.setCourseSkills(COURSE, [SKILL_A, 'SK-LA-YUJAD'], makerId))
      .rejects.toThrow(/SK-LA-YUJAD/)
    /* ولا يُمسّ القائمُ حين تُردّ الدفعة — إمّا كلٌّ أو لا شيء */
    expect(await prisma.courseSkillLink.count({ where: { courseId: COURSE } })).toBe(1)
  })

  it('ودورةٌ لا وجودَ لها تُردّ', async () => {
    await expect(admin.setCourseSkills('C-LA-YUJAD', [SKILL_A], makerId)).rejects.toThrow(/الدورة/)
  })
})

describe('والأثرُ يقول ما فُكّ وما رُبط', () => {
  it('صفُّ أثرٍ بحالتَي قبلُ وبعدُ — لا «عُدّلت الدورة» وحدَها', async () => {
    await admin.setCourseSkills(COURSE, [SKILL_A, SKILL_B], makerId)
    const row = await prisma.auditEvent.findFirst({
      where: { action: 'catalog.course.skills_set', entityId: COURSE },
      orderBy: { createdAt: 'desc' },
    })
    expect(row, 'ربطُ المهارات لا يترك أثرا').not.toBeNull()
    expect((row!.before as { skillIds: string[] }).skillIds).toEqual([SKILL_A])
    expect((row!.after as { skillIds: string[] }).skillIds).toEqual([SKILL_A, SKILL_B].sort())
  })
})
