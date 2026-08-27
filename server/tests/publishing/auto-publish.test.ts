/* النشر الآلي مع البناء — ما يفعله، ومتى يمتنع.
 *
 * الغرض: إدخال اللقطة في مجرى Git مع بقية الطبقات. الكود والمحتوى وبنية
 * القاعدة كانت تصل بدفعة، واللقطة — وهي ما يقرأه المحرك — تنتظر أربع ضغطات.
 *
 * والأهم في اختبار شيء ينشر تلقائيا ليس أنه ينشر، بل أنه **يمتنع** حين لا
 * جديد، وأنه يبقي التراجع ممكنا، ويسجّل الأثر قبل النشر لا بعده.
 *
 * ملاحظة على الحالة الابتدائية: المستورد يخزّن لقطة مبنية من ملفات المستودع
 * مباشرة، لا من الجداول — فبصمتها لا تساوي بصمة buildSnapshotFromDb أبدا،
 * لاختلاف الشكل لا لاختلاف المحتوى. فأول نشر بعد استيراد جديد يجري دائما،
 * ويستبدل لقطة الإقلاع بأخرى مبنية من الجداول كبقية اللقطات. ولهذا يبدأ كل
 * اختبار هنا بتسوية الحالة، فيقيس ما يقصده لا ما ورثه عمّا قبله.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { publishSnapshotIfChanged, autoLabel } from '../../services/auto-publish.service'
import { getActiveSnapshot } from '../../catalog/snapshot-builder'

let prisma: PrismaClient

/** يجعل اللقطة الحية مطابقة للجداول، فيبدأ الاختبار من أرضية معروفة */
async function settle(commit: string) {
  await publishSnapshotIfChanged(prisma, { commit })
}

/** سؤال فعّال لم يُستعمل في اختبار آخر — الترتيب ثابت فالاختيار حتمي */
async function nthActiveQuestion(n: number): Promise<string> {
  const rows = await prisma.question.findMany({
    where: { active: true }, orderBy: { id: 'asc' }, skip: n, take: 1, select: { id: true },
  })
  expect(rows[0], `لا سؤال فعّال عند الترتيب ${n}`).toBeTruthy()
  return rows[0].id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
})

describe('النشر الآلي', () => {
  it('أول نشر بعد الاستيراد يستبدل لقطة الإقلاع بأخرى مبنية من الجداول', async () => {
    const boot = await getActiveSnapshot(prisma)
    expect(boot, 'المستورد لم يترك لقطة إقلاع').toBeTruthy()

    const r = await publishSnapshotIfChanged(prisma, { commit: 'boot001' })
    expect(r.published).toBe(true)

    const now = await getActiveSnapshot(prisma)
    expect(now!.label).toBe(r.label)
    expect(now!.hash).toBe(r.candidateHash)
  })

  it('يمتنع حين تطابق الجداول اللقطة المنشورة — لا إصدار بلا سبب', async () => {
    await settle('settle01')
    const before = await prisma.catalogVersion.count()

    const r = await publishSnapshotIfChanged(prisma, { commit: 'settle01' })
    expect(r.published).toBe(false)
    expect(r.skippedAr).toBeTruthy()
    expect(await prisma.catalogVersion.count(), 'أنشأ إصدارا بلا جديد').toBe(before)
  })

  it('ينشر حين تنحرف الجداول، ويصير المنشور هو ما تقوله الجداول', async () => {
    await settle('drift001')
    const previous = await getActiveSnapshot(prisma)
    const victim = await nthActiveQuestion(0)
    await prisma.question.update({ where: { id: victim }, data: { active: false } })

    try {
      const r = await publishSnapshotIfChanged(prisma, { commit: 'drift001' })
      expect(r.published).toBe(true)
      expect(r.label).toBe(autoLabel('drift001', r.candidateHash))

      /* اللقطة الحية صارت المرشّح — وإلا فالنشر لم يصل المحرك */
      const now = await getActiveSnapshot(prisma)
      expect(now!.label).toBe(r.label)
      expect(now!.hash).toBe(r.candidateHash)

      /* والسابقة لم تُمحَ: التراجع يحتاج لقطتها */
      const old = await prisma.catalogVersion.findFirst({
        where: { label: previous!.label }, include: { snapshots: true },
      })
      expect(old!.status).toBe('superseded')
      expect(old!.snapshots.length).toBeGreaterThan(0)
    } finally {
      await prisma.question.update({ where: { id: victim }, data: { active: true } })
    }
  })

  it('يخزّن تحليل الأثر قبل النشر — السجل يحلّ محلّ قراءة اللوحة', async () => {
    await settle('rec00001')
    const baselineBefore = await getActiveSnapshot(prisma)
    /* سؤال غير الذي استعمله اختبار الانحراف، وإلا أعاد إنتاج لقطة سابقة */
    const victim = await nthActiveQuestion(1)
    await prisma.question.update({ where: { id: victim }, data: { active: false } })

    try {
      const r = await publishSnapshotIfChanged(prisma, { commit: 'rec00001' })
      expect(r.published).toBe(true)

      const run = await prisma.impactAnalysisRun.findUnique({ where: { id: r.impactRunId! } })
      expect(run, 'نشرٌ بلا سجل أثر').toBeTruthy()
      expect(run!.changeRef).toBe('نشر آلي مع البناء')

      /* قِيس على ما كان حيّا قبل هذا النشر، لا على ما نُشر للتو */
      const summary = run!.summary as { baselineLabel: string | null }
      expect(summary.baselineLabel).toBe(baselineBefore!.label)
      expect(summary.baselineLabel).not.toBe(r.label)
    } finally {
      await prisma.question.update({ where: { id: victim }, data: { active: true } })
    }
  })

  it('نشران متتاليان بلا تغيير: الثاني يمتنع — لا حلقة نشر دائمة', async () => {
    await settle('loop0001')
    const first = await publishSnapshotIfChanged(prisma, { commit: 'loop0001' })
    expect(first.published).toBe(false)
    const second = await publishSnapshotIfChanged(prisma, { commit: 'loop0001' })
    expect(second.published).toBe(false)
    expect(second.activeLabel).toBe(first.activeLabel)
  })

  it('التسمية تربط اللقطة بالالتزام وبمحتواها، وتقبلها قاعدة التسميات', () => {
    const label = autoLabel('0123456789abcdef', 'deadbeefcafe0000')
    expect(label).toBe('auto-0123456-deadbe')
    expect(label).toMatch(/^[\w.-]{3,40}$/)
    /* وبلا التزام معروف تبقى فريدة بالمحتوى وحده */
    expect(autoLabel(undefined, 'deadbeefcafe0000')).toBe('auto-deadbeefcafe')
    expect(autoLabel(undefined, 'deadbeefcafe0000')).toMatch(/^[\w.-]{3,40}$/)
  })
})
