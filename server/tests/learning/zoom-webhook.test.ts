/* نقطةُ Zoom — ما يُقبل وما يُردّ.

   ── ثلاثةُ أعطابٍ تسقط صامتةً ──

   ١) **نقطةٌ بلا توقيع** مفتوحةٌ على الإنترنت: يكتب فيها من شاء حضورا
      مختلَقا في سجلٍّ أكاديميّ. والسجلُّ يُبنى عليه إصدارُ الشهادة.

   ٢) **بلا سرٍّ مضبوط** يجب أن تُرفض كلُّ الأحداث. والخطأُ السهلُ أن يُقرأ
      «لا سرَّ» فيُقبل ما يصل — وهو أخطرُ من رفضِ كلّ شيء.

   ٣) **تحدّي إثبات الملكيّة** يُردّ عليه مرّةً عند حفظ العنوان في لوحة Zoom.
      ومن لم يردّه لم تُفعَّل نقطتُه — فلا يصل حدثٌ واحدٌ بعدها، بلا خطأ يُقرأ
      في أيّ مكان. عطبٌ صامتٌ تماما: كلُّ شيءٍ يبدو سليما ولا شيءَ يعمل.

   ويُقاس عبر **المسار** لا الدالّة: التوقيعُ يُحسب على الجسم الخامّ كما وصل،
   ومحلّلُ المحتوى في `app.ts` هو من يلتقطه. فمن اختبر الدالّةَ وحدَها لم
   يختبر أنّ الخامَّ يصلها أصلا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'

const SECRET = 'zoom-hook-secret-for-tests'
let prisma: PrismaClient
let app: FastifyInstance
let sessionId = ''
const MEETING_ID = '99887766'

const sign = (raw: string, ts: string, secret = SECRET) =>
  `v0=${createHmac('sha256', secret).update(`v0:${ts}:${raw}`).digest('hex')}`

/** يرسل الحدثَ كما يرسله Zoom — جسمٌ خامٌّ وترويستان */
const post = (payload: unknown, opts: { secret?: string; signed?: boolean } = {}) => {
  const raw = JSON.stringify(payload)
  const ts = '1788880000'
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.signed !== false) {
    headers['x-zm-signature'] = sign(raw, ts, opts.secret ?? SECRET)
    headers['x-zm-request-timestamp'] = ts
  }
  return app.inject({ method: 'POST', url: '/api/webhooks/zoom', headers, payload: raw })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)

  await prisma.integrationSetting.upsert({
    where: { provider: 'zoom' },
    update: { enabled: true, config: { accountId: 'a', clientId: 'c', clientSecret: 's', hostEmail: 'h@wajeez.test', webhookSecret: SECRET } },
    create: { provider: 'zoom', enabled: true, config: { accountId: 'a', clientId: 'c', clientSecret: 's', hostEmail: 'h@wajeez.test', webhookSecret: SECRET } },
  })

  const cohort = await prisma.cohort.create({
    data: { courseId: 'C-BIZ-101', title: 'شعبةُ الأحداث', status: 'active', capacity: 10 },
  })
  const s = await prisma.cohortSession.create({
    data: { cohortId: cohort.id, title: 'لقاءُ الأحداث', startsAt: new Date('2026-12-01T09:00:00Z'), status: 'scheduled' },
  })
  sessionId = s.id
  await prisma.zoomMeeting.create({
    data: { sessionId, provider: 'zoom_api', joinUrl: 'https://zoom.us/j/99887766', meetingId: MEETING_ID },
  })
}, 240_000)

describe('لا يُقبل حدثٌ بلا توقيعٍ صحيح', () => {
  it('بلا ترويسةِ توقيعٍ أصلا — ٤٠١', async () => {
    const res = await post({ event: 'meeting.ended', payload: { object: { id: MEETING_ID } } }, { signed: false })
    expect(
      res.statusCode,
      'نقطةٌ تقبل بلا توقيعٍ يكتب فيها من شاء حضورا مختلَقا في سجلٍّ أكاديميّ.',
    ).toBe(401)
  })

  it('وبتوقيعٍ من سرٍّ آخر — ٤٠١', async () => {
    const res = await post(
      { event: 'meeting.ended', payload: { object: { id: MEETING_ID } } },
      { secret: 'a-different-secret' },
    )
    expect(res.statusCode).toBe(401)
  })

  it('ولا يُكتب شيءٌ من حدثٍ مرفوض', async () => {
    const zoom = await prisma.zoomMeeting.findUnique({ where: { sessionId } })
    expect(zoom?.actualEndAt, 'كُتبت نهايةٌ من حدثٍ لم يُوقَّع').toBeNull()
  })

  /* ── والحالةُ الأخطر: لا سرَّ مضبوطا أصلا ──

     أوّلُ صياغةٍ لهذا الملفّ **لم تختبرها**، فمرّ نقضُها خضراءَ: قلبتُ
     `if (!c.webhookSecret) return false` إلى `return true` — أي «بلا سرٍّ
     يُقبل كلُّ شيء» — ولم يسقط حارسٌ واحد، لأنّ السرَّ مضبوطٌ في كلّ حالاتي.

     وهي الحالةُ التي تقع فعلا: منصّةٌ تُنشر ولم يُدخَل سرُّها بعد. فنقطةٌ
     مفتوحةٌ على الإنترنت تقبل أيَّ جسمٍ يُرسَل إليها. */
  it('وبلا سرٍّ مضبوطٍ تُرفض الأحداثُ كلُّها — لا تُقبل', async () => {
    await prisma.integrationSetting.update({
      where: { provider: 'zoom' },
      data: { config: { accountId: 'a', clientId: 'c', clientSecret: 's', hostEmail: 'h@wajeez.test' } },
    })
    try {
      const res = await post({ event: 'meeting.ended', payload: { object: { id: MEETING_ID } } })
      expect(
        res.statusCode,
        'بلا سرٍّ تصير النقطةُ مفتوحةً: يكتب من شاء حضورا في سجلٍّ أكاديميّ. '
        + 'والرفضُ الصامتُ أسلمُ من القبول الصامت.',
      ).toBe(401)
    } finally {
      await prisma.integrationSetting.update({
        where: { provider: 'zoom' },
        data: { config: { accountId: 'a', clientId: 'c', clientSecret: 's', hostEmail: 'h@wajeez.test', webhookSecret: SECRET } },
      })
    }
  })
})

describe('وتحدّي إثبات الملكيّة يُردّ عليه', () => {
  it('يعود الرمزُ نفسُه ومعه بصمتُه — وبلا ذلك لا تُفعَّل النقطةُ أصلا', async () => {
    const res = await post({ event: 'endpoint.url_validation', payload: { plainToken: 'tok-abc' } })
    expect(res.statusCode).toBe(200)
    const j = res.json() as { plainToken: string; encryptedToken: string }
    expect(j.plainToken).toBe('tok-abc')
    expect(j.encryptedToken).toBe(createHmac('sha256', SECRET).update('tok-abc').digest('hex'))
  })
})

describe('والحدثُ الموقَّعُ يُكتب في موضعه', () => {
  it('«بدأ الاجتماع» يكتب البدايةَ الحقيقيّة — والمجدولُ لا يُمسّ', async () => {
    const res = await post({
      event: 'meeting.started',
      payload: { object: { id: MEETING_ID, start_time: '2026-12-01T09:04:00Z' } },
    })
    expect(res.statusCode).toBe(200)
    await new Promise((r) => setTimeout(r, 120))
    const zoom = await prisma.zoomMeeting.findUnique({ where: { sessionId } })
    expect(zoom?.actualStartAt?.toISOString()).toBe('2026-12-01T09:04:00.000Z')
    const session = await prisma.cohortSession.findUnique({ where: { id: sessionId } })
    expect(
      session?.startsAt.toISOString(),
      'المجدولُ نيّةٌ والواقعُ خبر — وخلطُهما يجعل التأخّرَ يُقرأ التزاما.',
    ).toBe('2026-12-01T09:00:00.000Z')
  })

  it('و«انتهى» يكتب النهايةَ والمدّة', async () => {
    const res = await post({
      event: 'meeting.ended',
      payload: { object: { id: MEETING_ID, end_time: '2026-12-01T10:30:00Z', duration: 86 } },
    })
    expect(res.statusCode).toBe(200)
    await new Promise((r) => setTimeout(r, 120))
    const zoom = await prisma.zoomMeeting.findUnique({ where: { sessionId } })
    expect(zoom?.actualEndAt?.toISOString()).toBe('2026-12-01T10:30:00.000Z')
    expect(zoom?.durationMin).toBe(86)
  })

  /* ── ويُقاس هذا على الخدمة لا على المسار ──

     المسارُ يردّ ٢٠٠ **قبل** أن يعمل (Zoom يُعطّل نقطةً تتأخّر)، ويبتلع ما
     يُرمى بعده. فأوّلُ صياغةٍ قاست الحالةَ بالمسار **ومرّت خضراءَ على
     نقضِها**: جعلتُ المجهولَ يرمي، فابتلعه `.catch` وبقي الردُّ ٢٠٠. */
  it('وحدثٌ عن اجتماعٍ لا نعرفه يُتجاهَل بلا خطأ — لا يرمي', async () => {
    const { ZoomEventService } = await import('../../services/zoom-events.service')
    const svc = new ZoomEventService(prisma)
    /* قد يكون اجتماعا أنشأه أحدٌ في الحساب نفسِه من خارج المنصّة */
    await expect(
      svc.handle('meeting.ended', { id: '404040404', end_time: '2026-12-01T10:30:00Z' }),
      'بلاغٌ عن اجتماعٍ غريبٍ ليس خطأً في منصّتنا — والرميُ يملأ السجلَّ ضجيجا',
    ).resolves.toBe(false)
  })

  it('والمسارُ يردّ ٢٠٠ عليه كذلك — فلا يُعطّل Zoom النقطةَ', async () => {
    const res = await post({
      event: 'meeting.ended',
      payload: { object: { id: '404040404', end_time: '2026-12-01T10:30:00Z' } },
    })
    expect(res.statusCode).toBe(200)
  })
})
