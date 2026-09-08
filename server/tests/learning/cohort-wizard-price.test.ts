/* السعرُ الذي يُعرض هو السعرُ الذي يُطبَّق.

   ── العطبُ الذي فُتح له هذا الحارس ──

   معالجُ الشعبة كان يقول في خطوة السعر «سعرُ قائمة الدورة: **—** USD»، وفي
   المراجعة «**بلا سعر — وشرطُ الفتح يمنع شعبةً بلا سعر**». ثمّ تُنشأ الشعبةُ
   بـ`125.00 USD` وتُفتح بلا مانع.

   والسببُ أنّ الشاشةَ كانت تقرأ السعرَ من **الكتالوج المضمَّن** بينما
   `createCohort` يرثه من **القاعدة**. والمضمَّنُ لا يُثبَّت إلّا حين تُطلب
   `/api/public/core-catalog` — و`/admin/cohorts` لا تطلبها أصلا. فكان
   `courseById` يردّ `undefined` للدوراتِ الإحدى والثمانين كلِّها.

   والأثرُ ليس تجميليّا: رقمُ مالٍ يُعرض خطأً في لحظةِ قرار، وتحذيرٌ من مانعٍ
   لا وجودَ له، والسعرُ الذي سيُنشر لا يُرى قبل نشره.

   فالحدُّ هنا: **مصدرٌ واحدٌ للسعر** — ما يعرضه المسارُ الإداريّ هو ما يرثه
   إنشاءُ الشعبة. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CatalogAdminService } from '../../services/catalog-admin.service'
import { CohortService } from '../../services/cohort.service'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

let prisma: PrismaClient
let admin: CatalogAdminService
let cohorts: CohortService
let actorId = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  admin = new CatalogAdminService(prisma)
  cohorts = new CohortService(prisma)
  const u = await prisma.user.create({
    data: { email: `price-${Date.now()}@wajeez.test`, displayName: 'مديرُ السعر', passwordHash: 'x' },
  })
  actorId = u.id
}, 240_000)

describe('السعرُ المعروضُ هو السعرُ المطبَّق', () => {
  it('المسارُ الإداريُّ يحمل سعرَ القائمة وعملتَها — لا يُترك للشاشة أن تخمّنه', async () => {
    const list = await admin.listCourses()
    expect(list.length, 'لم تُقرأ دورةٌ واحدة').toBeGreaterThan(3)
    const withPrice = list.filter((c) => c.listPrice != null)
    expect(
      withPrice.length,
      'ولا دورةَ تحمل سعرا في ردّ `/api/admin/catalog/courses` — فالشاشةُ ستقول «بلا سعر» '
      + 'بينما يرث إنشاءُ الشعبة سعرَ القاعدة.',
    ).toBeGreaterThan(0)
    expect(typeof withPrice[0].listCurrency).toBe('string')
  })

  it('وما تعرضه الشاشةُ هو ما تُنشأ به الشعبةُ فعلا', async () => {
    const course = (await admin.listCourses()).find((c) => c.listPrice != null)!
    const cohort = await cohorts.create(actorId, {
      courseId: course.id, title: 'شعبةُ فحصِ السعر', capacity: 10,
    })
    /* لا سعرَ يُمرَّر — فيرثه الخادمُ من الدورة، وهو ما رأته الشاشةُ قبل النقر */
    expect(Number(cohort.price)).toBe(course.listPrice)
    expect(cohort.currency).toBe(course.listCurrency)
  })

  it('ولا تقرأ الشاشةُ السعرَ من الكتالوج المضمَّن', () => {
    /* التعليقاتُ تُمحى أوّلا: شرحُ الإصلاح يذكر `courseById` بالاسم، فلو
       قيس على النصّ الخام لعدّ الحارسُ شرحَه عطبا. وهي مصيدةُ `CLAUDE.md`:
       الفحصُ على البنية لا على ورودِ حرفٍ في ملفّ. */
    const ui = read('src/pages/admin/AdminCohorts.tsx')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')
    const wizardProps = ui.slice(ui.indexOf('<CohortWizard'), ui.indexOf('onDone', ui.indexOf('<CohortWizard')))
    expect(
      wizardProps,
      '`courseById` تقرأ الكتالوجَ المضمَّن، و`/admin/cohorts` لا تطلب '
      + '`/api/public/core-catalog` — فيعود `undefined` لكلّ دورة، وتقول الشاشةُ «بلا سعر».',
    ).not.toContain('courseById')
  })

  it('ومرشِّحُ «المجال» يُبنى من أسماءٍ تصل فعلا', async () => {
    const list = await admin.listCourses()
    const named = list.filter((c) => c.pathwayNames.length > 0)
    expect(
      named.length,
      'ولا دورةَ تحمل اسمَ مجال — فمرشِّحُ «المجال» في شاشة الشعب يخرج فارغا، '
      + 'لا لأنّ الشعبَ بلا مجال بل لأنّ الاسمَ لم يصل.',
    ).toBeGreaterThan(0)
  })
})
