/* تسجيلُ اللقاء يُرفع بثّا إلى القرص — لا يقف عند أربعة ميغابايت (٣٠ سبتمبر ٢٠٢٦).

   كان رابطُ رفع التسجيل يشير إلى مسار الذاكرة (`PUT /api/v1/uploads/:key`)،
   وحدُّه أربعةُ ميغابايت — فكلُّ تسجيلِ لقاءٍ حقيقيٍّ يُردّ، والخادمُ يَعِد
   بثلاثمئة. فصار له مسارُ بثٍّ يكتب ما يصل كما يصل.

   ═══ ما يُحرَس ═══
   ① تسجيلٌ من ستّة ميغابايت يُكتب كاملا من مسار البثّ.
   ② ومسارُ الذاكرة يبقى عند سقفه — البثُّ بابٌ ثانٍ لا رفعٌ للأوّل.
   ③ ولا يُقبل في البثّ من لا سقفَ بثٍّ له — فلا تصير مادّةٌ أو وثيقةٌ
      ثلاثَمئة ميغابايت من هذا الباب.
   ④ ورابطُ رفع التسجيل الذي تُعطيه الخدمةُ يشير إلى البثّ. */

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { newStorageKey, signKey, SIGNED_URL_TTL_MS } from '../../services/storage.service'
import { getObject } from '../../services/object-store'

let prisma: PrismaClient
let app: FastifyInstance
let sessionId = ''
let cohortId = ''
const SIX_MB = Buffer.alloc(6 * 1024 * 1024, 7)

const signed = (key: string, suffix = '') => {
  const exp = Date.now() + SIGNED_URL_TTL_MS
  return `/api/v1/uploads/${key}${suffix}?exp=${exp}&sig=${signKey(key, exp, 'write')}`
}

beforeAll(async () => {
  process.env.STORAGE_ROOT = mkdtempSync(join(tmpdir(), 'wajeez-stream-'))
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  const course = await prisma.course.create({ data: { id: `C-STREAM-${Date.now()}`, status: 'published', currentVersion: 1 } })
  const cohort = await prisma.cohort.create({ data: { courseId: course.id, title: 'شعبةُ البثّ' } })
  cohortId = cohort.id
  const session = await prisma.cohortSession.create({
    data: { cohortId, title: 'لقاء', startsAt: new Date(), timezone: 'Asia/Amman' },
  })
  sessionId = session.id
}, 240_000)

describe('تسجيلُ اللقاء بثّا', () => {
  it('① ستّةُ ميغابايت تُكتب كاملةً من مسار البثّ', async () => {
    const key = newStorageKey()
    await prisma.recording.create({ data: { sessionId, title: 'تسجيلٌ طويل', storageKey: key, mime: 'video/mp4', sizeBytes: SIX_MB.length } })
    const res = await app.inject({
      method: 'PUT', url: signed(key, '/stream'),
      headers: { 'content-type': 'video/mp4' }, payload: SIX_MB,
    })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().sizeBytes).toBe(SIX_MB.length)
    expect((await getObject(key))?.length).toBe(SIX_MB.length)
  })

  it('② ومسارُ الذاكرة يبقى عند سقفه', async () => {
    const key = newStorageKey()
    await prisma.recording.create({ data: { sessionId, title: 'تسجيلٌ آخر', storageKey: key, mime: 'video/mp4', sizeBytes: SIX_MB.length } })
    const res = await app.inject({
      method: 'PUT', url: signed(key), headers: { 'content-type': 'video/mp4' }, payload: SIX_MB,
    })
    expect(res.statusCode).toBe(413)
  })

  it('③ ولا يُقبل في البثّ من لا سقفَ بثٍّ له', async () => {
    const key = newStorageKey()
    await prisma.learningMaterial.create({ data: { cohortId, title: 'مادّة', storageKey: key } })
    const res = await app.inject({
      method: 'PUT', url: signed(key, '/stream'),
      headers: { 'content-type': 'application/pdf' }, payload: Buffer.from('%PDF-1.4 small'),
    })
    expect(res.statusCode).toBe(415)
  })

  it('④ ورابطُ الرفع الذي تُعطيه الخدمةُ يشير إلى البثّ', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(join(process.cwd(), 'server/services/cohort.service.ts'), 'utf8')
    const at = src.indexOf('async registerRecording(')
    const body = src.slice(at, src.indexOf('\n  }\n', at))
    expect(body, 'رابطُ رفع التسجيل يشير إلى مسار الذاكرة ذي الأربعة ميغابايت').toMatch(/uploads\/\$\{storageKey\}\/stream\?/)
  })
})
