/* ج-١ — مجالات المسارات تُنشر داخل اللقطة لا تُستورد وقت البناء.
   الحقيقة التي تحميها هذه الاختبارات: مسار يُضاف بعد النشر يمكن أن يحصل على
   مجال ويدخل مطابقة احتياج المستخدم — قبل هذا البند كان يبقى بلا مجال للأبد. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const sourceMap = (
  JSON.parse(readFileSync(join(root, 'src/data/catalog/v2/pathway-domains.v2.json'), 'utf8')) as {
    pathway_domains: Record<string, string[]>
  }
).pathway_domains

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 180_000)

/* حالة المحرك عامة (روابط ES حية) — نرجّعها للحزمة المضمنة كي لا يورّث
   هذا الملف خريطة اختبارية لأي ملف يليه في نفس العملية. */
afterAll(async () => {
  const { installPathwayDomains } = await import('../../../src/domain/diagnostic/v2/data')
  installPathwayDomains(null)
})

describe('استيراد مجالات المسارات', () => {
  it('صف لكل (مسار، مجال) بالترتيب المصدري', async () => {
    const rows = await prisma.pathwayDomain.findMany({ orderBy: [{ pathwayId: 'asc' }, { orderIndex: 'asc' }] })
    const fromDb: Record<string, string[]> = {}
    for (const r of rows) (fromDb[r.pathwayId] ??= []).push(r.domainId)

    expect(Object.keys(fromDb).sort()).toEqual(Object.keys(sourceMap).sort())
    for (const [pid, ids] of Object.entries(sourceMap)) {
      expect(fromDb[pid], `مجالات ${pid}`).toEqual(ids)
    }
  })

  it('لا مسار منشور بلا مجال', async () => {
    const published = await prisma.pathway.findMany({ where: { status: 'published' }, select: { id: true } })
    expect(published.length).toBeGreaterThan(0)
    for (const p of published) {
      expect(await prisma.pathwayDomain.count({ where: { pathwayId: p.id } }), `${p.id} بلا مجال`).toBeGreaterThan(0)
    }
  })
})

describe('اللقطة تحمل المجالات', () => {
  it('حمولة اللقطة تطابق المصدر مسارا بمسار', async () => {
    const { buildSnapshotFromDb } = await import('../../catalog/snapshot-builder')
    const snap = await buildSnapshotFromDb(prisma)
    const payload = snap.payload as { pathwayDomains: { pathway_domains: Record<string, string[]> } }
    expect(payload.pathwayDomains.pathway_domains).toEqual(sourceMap)
    expect(snap.counts.pathwayDomains).toBe(Object.values(sourceMap).flat().length)
  })

  it('المحرك يقرأ خريطة اللقطة لا الملف المضمن', async () => {
    const { installCatalogSnapshot } = await import('../../../src/domain/diagnostic/catalog')
    const { domainsOfPathway } = await import('../../../src/domain/diagnostic/v2/data')
    const { buildSnapshotFromDb } = await import('../../catalog/snapshot-builder')
    const snap = await buildSnapshotFromDb(prisma)
    const payload = JSON.parse(JSON.stringify(snap.payload)) as {
      pathwayDomains: { pathway_domains: Record<string, string[]> }
    }

    /* مسار جديد لا وجود له في pathway-domains.v2.json — لو كان المحرك يقرأ الملف
       لبقي بلا مجال؛ ولأنه يقرأ اللقطة يظهر مجاله فورا. هذا جوهر البند. */
    payload.pathwayDomains.pathway_domains['PW-NEW-999'] = ['ai_productivity']
    payload.pathwayDomains.pathway_domains['PW-BIZ-001'] = ['operations']

    installCatalogSnapshot(payload as never, 'domains-test')
    expect(domainsOfPathway('PW-NEW-999')).toEqual(['ai_productivity'])
    expect(domainsOfPathway('PW-BIZ-001')).toEqual(['operations'])
  })

  it('لقطة أقدم من ج-١ (بلا مفتاح) ترجع للملف المضمن بلا انكسار', async () => {
    const { installCatalogSnapshot } = await import('../../../src/domain/diagnostic/catalog')
    const { domainsOfPathway } = await import('../../../src/domain/diagnostic/v2/data')
    const { buildSnapshotFromDb } = await import('../../catalog/snapshot-builder')
    const payload = JSON.parse(JSON.stringify((await buildSnapshotFromDb(prisma)).payload)) as Record<string, unknown>
    delete payload.pathwayDomains

    installCatalogSnapshot(payload as never, 'pre-c1-snapshot')
    expect(domainsOfPathway('PW-BIZ-001')).toEqual(sourceMap['PW-BIZ-001'])
  })
})

describe('حاجز النشر', () => {
  it('يرفض مسارا معتمدا بلا مجال برسالة تقول السبب', async () => {
    const { PublishingService } = await import('../../services/publishing.service')
    const id = 'PW-TEST-NODOMAIN'
    await prisma.pathway.upsert({ where: { id }, update: { status: 'approved' }, create: { id, status: 'approved' } })
    try {
      const { errors } = await new PublishingService(prisma).validateDrafts()
      expect(errors.some((e) => e.includes(id) && e.includes('بلا مجال'))).toBe(true)

      /* وبمجال واحد يزول هذا الخطأ بعينه (وتبقى أخطاء أخرى للمسار الناقص) */
      await prisma.pathwayDomain.create({ data: { pathwayId: id, domainId: 'operations' } })
      const after = await new PublishingService(prisma).validateDrafts()
      expect(after.errors.some((e) => e.includes(id) && e.includes('بلا مجال'))).toBe(false)
    } finally {
      await prisma.pathway.delete({ where: { id } })
    }
  })
})
