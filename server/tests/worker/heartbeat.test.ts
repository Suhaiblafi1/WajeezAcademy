/* نبضةُ العامل — الحارسُ على أن تقول الصدقَ في الاتّجاهَين.

   نقطةُ مراقبةٍ تكذب أسوأُ من غيابها: من لا نقطةَ عنده يفتح صدفةً على
   الخادم، ومن عنده نقطةٌ تقول «يعمل» وهو ساقطٌ يطمئنّ ولا يفتح. فأكثرُ ما
   دونه هنا اختباراتٌ للامتناع عن الحكم وللحكم بالسلب — لا للحكم بالإيجاب.

   وأخطرُ ما يُحرَس **مصدرُ المهلة**: النبضةُ تحمل دورتَها معها، والقارئُ
   يقيس بها. ولو رُدّت المهلةُ إلى رقمٍ مكتوبٍ هنا، لصار من غيّر `everyMs`
   في `jobs.ts` يكسر الحكمَ بلا أن يحمرّ شيء. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { JOBS } from '../../worker/jobs'
import { beat } from '../../worker/index'
import {
  BEAT_KEY, GRACE_TICKS, beatReport, judgeBeat, lastBeat, recordBeat, type WorkerBeat,
} from '../../worker/heartbeat'

let prisma: PrismaClient
let app: FastifyInstance

const MINUTE = 60_000
const NOW = new Date('2026-09-07T12:00:00.000Z')

/** نبضةٌ كاملةٌ عمرُها ما يُطلب — تُبنى ولا تُكتب */
const aged = (ageMs: number, over: Partial<WorkerBeat> = {}): WorkerBeat => ({
  at: new Date(NOW.getTime() - ageMs).toISOString(),
  startedAt: new Date(NOW.getTime() - ageMs - MINUTE).toISOString(),
  tickMs: MINUTE,
  jobs: 7,
  commit: 'abcdef1234567890',
  ...over,
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
}, 240_000)

describe('الحكمُ على النبضة — بلا قاعدة', () => {
  it('نبضةٌ طازجةٌ: يعمل', () => {
    const r = judgeBeat(aged(30_000), { appCommit: null, uptimeSec: 9_999, now: NOW })
    expect(r.يعمل).toMatch(/^نعم/)
    expect(r.منذ_ثانية).toBe(30)
  })

  it('نبضةٌ شاخت فوق المهلة: **لا** — ولا يُقال «نعم» بحالٍ', () => {
    const r = judgeBeat(aged(MINUTE * GRACE_TICKS + 1_000), { appCommit: null, uptimeSec: 9_999, now: NOW })
    expect(r.يعمل).toMatch(/^لا —/)
    expect(r.يعمل, 'طمأنَ عن عاملٍ ساقط').not.toMatch(/^نعم/)
    expect(r.يعمل, 'لا يقول أين يُنظَر').toContain('logs worker')
  })

  it('وعند الحدّ تماما يبقى حيّا — الحدُّ يُغتفر ولا يُعاقَب عليه', () => {
    const r = judgeBeat(aged(MINUTE * GRACE_TICKS), { appCommit: null, uptimeSec: 9_999, now: NOW })
    expect(r.يعمل).toMatch(/^نعم/)
  })

  /* ═══ المهلةُ من النبضةِ لا من رقمٍ في القارئ ═══

     دورةٌ عشرُ دقائقَ ونبضةٌ عمرُها عشرون: ميّتةٌ لو قيست بدورةِ الدقيقة
     المفترَضة (مهلتُها ثلاثُ دقائق)، وحيّةٌ بدورتِها هي (مهلتُها ثلاثون).
     فلو رُدّت المهلةُ إلى رقمٍ مكتوبٍ في القارئ لسقط هذا. */
  it('المهلةُ تُشتقّ من دورةِ العامل المعلَنة في النبضة نفسِها', () => {
    const slow = judgeBeat(aged(20 * MINUTE, { tickMs: 10 * MINUTE }), { appCommit: null, uptimeSec: 9_999, now: NOW })
    expect(slow.يعمل, 'قِيست بدورةٍ مفترَضةٍ لا بالمعلَنة').toMatch(/^نعم/)
    expect(slow.نبض_الحلقة_ثانية).toBe(600)

    const fast = judgeBeat(aged(20 * MINUTE), { appCommit: null, uptimeSec: 9_999, now: NOW })
    expect(fast.يعمل, 'العمرُ نفسُه بدورةِ الدقيقة يجب أن يكون ميّتا').toMatch(/^لا —/)
  })

  describe('ولا نبضةَ قطّ — وهنا يقع الإنذارُ الكاذب', () => {
    it('خادمٌ أقلع للتوّ: يمتنع عن الحكم ولا يجزم بالسقوط', () => {
      const r = judgeBeat(null, { appCommit: null, uptimeSec: 5, now: NOW })
      expect(r.يعمل).toMatch(/^لا يمكن الحكم/)
      expect(r.يعمل, 'جزم بالسقوط بعد نشرةٍ عمرُها خمسُ ثوان').not.toMatch(/^لا —/)
      expect(r.يعمل, 'لا يقول متى يُسأل ثانية').toMatch(/اسأل بعد/)
    })

    it('وخادمٌ قائمٌ منذ ساعة: **لا** بلا تردّد', () => {
      const r = judgeBeat(null, { appCommit: null, uptimeSec: 3_600, now: NOW })
      expect(r.يعمل).toMatch(/^لا —/)
      expect(r.يعمل).toContain('logs worker')
    })
  })

  describe('العاملُ والخادمُ — أمن التزامٍ واحد؟', () => {
    it('نعم حين يتطابقان', () => {
      const r = judgeBeat(aged(0), { appCommit: 'abcdef1234567890', uptimeSec: 9_999, now: NOW })
      expect(r.مع_الكود).toMatch(/^نعم/)
    })

    it('ولا حين يفترقان — وهو عاملٌ لم يُستبدَل في النشرة', () => {
      const r = judgeBeat(aged(0), { appCommit: '9999999000000000', uptimeSec: 9_999, now: NOW })
      expect(r.مع_الكود).toMatch(/^لا —/)
      expect(r.مع_الكود).toContain('9999999')
      expect(r.مع_الكود).toContain('abcdef1')
    })

    it('ويمتنع حين يُجهل أحدُ الطرفَين — لا يُخترع اختلاف', () => {
      expect(judgeBeat(aged(0), { appCommit: null, uptimeSec: 9_999, now: NOW }).مع_الكود)
        .toMatch(/^لا يمكن الحكم/)
      expect(judgeBeat(aged(0, { commit: null }), { appCommit: 'abcdef1234567890', uptimeSec: 9_999, now: NOW }).مع_الكود)
        .toMatch(/^لا يمكن الحكم/)
    })
  })
})

describe('الكتابةُ والقراءةُ على القاعدة', () => {
  it('تُكتب فتُقرأ كما كُتبت', async () => {
    const startedAt = new Date(NOW.getTime() - 5 * MINUTE)
    await recordBeat(prisma, { startedAt, tickMs: 90_000, jobs: 7, now: NOW })
    const b = await lastBeat(prisma)
    expect(b).toBeTruthy()
    expect(b!.at).toBe(NOW.toISOString())
    expect(b!.startedAt).toBe(startedAt.toISOString())
    expect(b!.tickMs).toBe(90_000)
    expect(b!.jobs).toBe(7)
  })

  it('وصفٌّ واحدٌ يُكتب فوقه — النبضةُ حالةٌ لا سجلٌّ ينمو', async () => {
    await recordBeat(prisma, { startedAt: NOW, tickMs: MINUTE, jobs: 7, now: NOW })
    await recordBeat(prisma, { startedAt: NOW, tickMs: MINUTE, jobs: 7, now: new Date(NOW.getTime() + MINUTE) })
    expect(await prisma.systemSetting.count({ where: { key: BEAT_KEY } })).toBe(1)
  })

  it('وصفٌّ تالفٌ يُعامَل كغيابه ولا يُرمى خطأ', async () => {
    await prisma.systemSetting.upsert({
      where: { key: BEAT_KEY },
      create: { key: BEAT_KEY, value: { at: 'ليس تاريخا' } },
      update: { value: { at: 'ليس تاريخا' } },
    })
    await expect(lastBeat(prisma)).resolves.toBeNull()
  })
})

describe('حلقةُ العامل تكتبها فعلا — وبدورتِها هي', () => {
  it('`beat` تكتب نبضةً دورتُها أقصرُ ما في جدول الوظائف', async () => {
    await prisma.systemSetting.deleteMany({ where: { key: BEAT_KEY } })
    await beat(prisma, new Date(NOW.getTime() - MINUTE), NOW)
    const b = await lastBeat(prisma)
    expect(b, 'الحلقةُ لا تكتب نبضةً — فالنقطةُ عمياء').toBeTruthy()
    /* على البنية: الدورةُ المكتوبةُ هي المشتقّةُ من `everyMs` لا رقمٌ ثانٍ */
    expect(b!.tickMs).toBe(Math.min(...JOBS.map((j) => j.everyMs)))
    expect(b!.jobs).toBe(JOBS.length)
  })
})

describe('وعطبُ القراءة لا يُسقط المسار — فهو فحصُ صحّةِ الحاوية', () => {
  /* `‎/api/version` هو `healthcheck` حاويةِ الخادم في `Dockerfile`. فخطأٌ
     يخرج من قراءةِ النبضة يجعل Docker يُعيد تشغيلَ الموقع لأنّ صفًّا في
     جدولٍ جانبيٍّ لم يُقرأ — وهو ثمنٌ باهظٌ لنقطةِ مراقبة. */
  const exploding = {
    systemSetting: { findUnique: () => Promise.reject(new Error('القاعدةُ لا تردّ')) },
  } as unknown as PrismaClient

  it('يردّ «لا يمكن الحكم» ولا يرمي', async () => {
    const r = await beatReport(exploding, { appCommit: null, uptimeSec: 9_999 })
    expect(r.يعمل).toMatch(/^لا يمكن الحكم/)
    expect(r.يعمل, 'لا يسمّي سببَ العمى').toContain('القاعدةُ لا تردّ')
  })

  it('ولا يقول «لا» — عطبُ قراءةٍ ليس عاملا ساقطا', async () => {
    const r = await beatReport(exploding, { appCommit: null, uptimeSec: 9_999 })
    expect(r.يعمل).not.toMatch(/^لا —/)
    expect(r.يعمل).not.toMatch(/^نعم/)
  })
})

describe('و`‎/api/version` يعرضها', () => {
  it('الكتلةُ حاضرةٌ وتقرأ النبضةَ الحيّة', async () => {
    await recordBeat(prisma, { startedAt: new Date(), tickMs: MINUTE, jobs: JOBS.length })
    const res = await app.inject({ method: 'GET', url: '/api/version' })
    expect(res.statusCode).toBe(200)
    const v = res.json() as { العامل_الخلفي?: { يعمل: string; منذ_ثانية: number | null } }
    expect(v.العامل_الخلفي, 'الكتلةُ غائبةٌ عن الردّ').toBeTruthy()
    expect(v.العامل_الخلفي!.يعمل).toMatch(/^نعم/)
    expect(v.العامل_الخلفي!.منذ_ثانية).toBeLessThan(60)
  })

  it('ونبضةٌ شائخةٌ تُقلب الحكمَ في الردّ نفسِه — لا تُقرأ من ذاكرة', async () => {
    await recordBeat(prisma, {
      startedAt: new Date(), tickMs: MINUTE, jobs: JOBS.length,
      now: new Date(Date.now() - 60 * MINUTE),
    })
    const res = await app.inject({ method: 'GET', url: '/api/version' })
    const v = res.json() as { العامل_الخلفي: { يعمل: string } }
    expect(v.العامل_الخلفي.يعمل).toMatch(/^لا —/)
  })
})
