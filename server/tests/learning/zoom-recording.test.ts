/* ═══ تسجيلُ اللقاء يُكتب صفًّا من بلاغ Zoom — لا يُرفع بيد (م٦) ═══

   «شغله» — قرارُ صاحب المنصّة (١٨ سبتمبر ٢٠٢٦). فصار الاجتماعُ يُنشأ
   بـ`auto_recording: 'cloud'`، ويبلّغ Zoom بـ`recording.completed` حين يجهز.

   ── وما يُقاس هنا دون غيره ──

   **الانتقاءُ** قرارٌ خالصٌ مفحوصٌ في `src/tests/trainer/session-recording`:
   أيُّ ملفٍّ، وما رابطُه، وكم مدّتُه. وما هنا **الكتابة**: أنّ الصفَّ يُخلق
   فعلا في القاعدة معلَّقا بجلسته، وأنّ إعادةَ إرسالٍ من Zoom لا تُنتج صفًّا
   ثانيا، وأنّ بلاغا عن اجتماعٍ لا نعرفه لا يكتب شيئا.

   ويُقاس عبر **المسار** لا الدالّة وحدَها: التوقيعُ يُحسب على الجسم الخامّ
   كما وصل، والبلاغُ يعبر محلّلَ المحتوى قبل أن يبلغ الخدمة. ومن اختبر
   الخدمةَ وحدَها لم يختبر أنّ `recording_files` تصلها أصلا — وهو حقلٌ لم
   يكن في شكل الجسم المُعلَن في المسلك قبل هذا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'

const SECRET = 'zoom-recording-secret-for-tests'
let prisma: PrismaClient
let app: FastifyInstance
let sessionId = ''
let bareSessionId = ''
const MEETING_ID = '55443322'
const BARE_MEETING_ID = '55443399'
const SHARE = 'https://zoom.us/rec/share/recorded-lesson'
const PASS = 'r3c#pass'

const sign = (raw: string, ts: string) =>
  `v0=${createHmac('sha256', SECRET).update(`v0:${ts}:${raw}`).digest('hex')}`

const post = (payload: unknown) => {
  const raw = JSON.stringify(payload)
  const ts = '1788880000'
  return app.inject({
    method: 'POST',
    url: '/api/webhooks/zoom',
    headers: {
      'content-type': 'application/json',
      'x-zm-signature': sign(raw, ts),
      'x-zm-request-timestamp': ts,
    },
    payload: raw,
  })
}

/* والردُّ يسبق العمل (Zoom يُعطّل نقطةً تتأخّر) — فيُنتظَر بعده */
const settle = () => new Promise((r) => setTimeout(r, 200))

const MP4 = {
  file_type: 'MP4',
  recording_type: 'shared_screen_with_speaker_view',
  status: 'completed',
  recording_start: '2026-12-02T09:03:00Z',
  recording_end: '2026-12-02T10:33:00Z',
  play_url: 'https://zoom.us/rec/play/file-one',
}

const recordingsOf = (id: string) => prisma.recording.findMany({ where: { sessionId: id } })

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
    data: { courseId: 'C-BIZ-101', title: 'شعبةُ التسجيل', status: 'active', capacity: 10 },
  })
  const s = await prisma.cohortSession.create({
    data: { cohortId: cohort.id, title: 'لقاءُ التسجيل', startsAt: new Date('2026-12-02T09:00:00Z'), status: 'done' },
  })
  sessionId = s.id
  await prisma.zoomMeeting.create({
    data: { sessionId, provider: 'zoom_api', joinUrl: 'https://zoom.us/j/55443322', meetingId: MEETING_ID },
  })

  const b = await prisma.cohortSession.create({
    data: { cohortId: cohort.id, title: 'لقاءٌ بلا مرئيّ', startsAt: new Date('2026-12-03T09:00:00Z'), status: 'done' },
  })
  bareSessionId = b.id
  await prisma.zoomMeeting.create({
    data: { sessionId: bareSessionId, provider: 'zoom_api', joinUrl: 'https://zoom.us/j/55443399', meetingId: BARE_MEETING_ID },
  })
}, 240_000)

describe('① البلاغُ يُنتج صفَّ تسجيلٍ معلَّقا بجلسته', () => {
  it('⚠️ صفٌّ واحدٌ برابطٍ يُفتح ومدّةٍ وعنوانٍ يقول جلستَه', async () => {
    const res = await post({
      event: 'recording.completed',
      payload: {
        object: {
          id: MEETING_ID, uuid: 'uuid-rec-1', duration: 90,
          share_url: SHARE, recording_play_passcode: PASS, recording_files: [MP4],
        },
      },
    })
    expect(res.statusCode).toBe(200)
    await settle()

    const rows = await recordingsOf(sessionId)
    expect(rows, 'لم يُكتب تسجيل — والمدرّبُ يرفع بيده ما وصل وحدَه').toHaveLength(1)
    expect(rows[0].externalUrl, 'الرابطُ بلا رمزِه يفتح سؤالا لا درسا')
      .toBe(`${SHARE}?pwd=${encodeURIComponent(PASS)}`)
    expect(rows[0].title).toBe('تسجيلُ «لقاءُ التسجيل»')
    expect(rows[0].durationSec, 'المدّةُ من مدى الملفّ').toBe(90 * 60)
    expect(rows[0].status, 'وصل معطَّلا فلا يراه أحد').toBe('active')
  })

  it('⚠️ والصفُّ يصل شاشةَ المدرّب فعلا — لا يرقد في القاعدة', async () => {
    /* `signCohortContent` كان يُسقط ما لا `storageKey` له: `readUrl` فارغٌ
       والعمودُ الخارجيُّ لا يُقرأ — فالتسجيلُ مكتوبٌ ولا يُرى. */
    const row = await prisma.cohortSession.findUnique({
      where: { id: sessionId },
      include: { recordings: true },
    })
    expect(row?.recordings[0]?.externalUrl, 'الإسقاطُ لا يحمل الرابطَ الخارجيّ').toBeTruthy()
    expect(row?.recordings[0]?.storageKey, 'حُجز مفتاحُ تخزينٍ لملفٍّ ليس عندنا').toBeNull()
  })

  it('⚠️ وأثرٌ يقول من أين جاء — لا صفٌّ يظهر بلا أصل', async () => {
    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'zoom.recording_ready', entityId: sessionId },
    })
    expect(audit, 'لا أثرَ لوصول التسجيل').not.toBeNull()
  })
})

describe('② وإعادةُ الإرسال لا تُنتج صفًّا ثانيا', () => {
  it('⚠️ البلاغُ نفسُه مرّتَين — صفٌّ واحد', async () => {
    /* Zoom يُعيد إرسالَ ما لم يُردَّ عليه سريعا، والصفّان لتسجيلٍ واحدٍ
       سطران متطابقان أمام المتعلّم. */
    await post({
      event: 'recording.completed',
      payload: {
        object: {
          id: MEETING_ID, uuid: 'uuid-rec-1', duration: 90,
          share_url: SHARE, recording_play_passcode: PASS, recording_files: [MP4],
        },
      },
    })
    await settle()
    expect(await recordingsOf(sessionId), 'تكرّر الصفُّ على إعادة إرسال').toHaveLength(1)
  })

  it('وتسجيلٌ آخرُ للجلسة نفسِها يُكتب — لا يُخنق بالأوّل', async () => {
    /* جلسةٌ سُجّلت مرّتَين (انقطعت وعادت) لها رابطان — والتقييدُ بالجلسة
       وحدَها كان يبتلع الثاني. */
    await post({
      event: 'recording.completed',
      payload: {
        object: {
          id: MEETING_ID, uuid: 'uuid-rec-2',
          share_url: 'https://zoom.us/rec/share/second-part', recording_files: [MP4],
        },
      },
    })
    await settle()
    expect(await recordingsOf(sessionId)).toHaveLength(2)
  })
})

describe('③ وما لا مرئيَّ فيه ولا رابطَ لا يُكتب', () => {
  it('⚠️ بلاغٌ بدردشةٍ وصوتٍ وحدَهما — لا صفَّ يُسكت طابورَ «لم يُرفع»', async () => {
    await post({
      event: 'recording.completed',
      payload: {
        object: {
          id: BARE_MEETING_ID, uuid: 'uuid-bare',
          recording_files: [
            { file_type: 'CHAT', status: 'completed', play_url: 'https://zoom.us/rec/play/chat' },
            { file_type: 'M4A', status: 'completed', play_url: 'https://zoom.us/rec/play/audio' },
          ],
        },
      },
    })
    await settle()
    expect(await recordingsOf(bareSessionId), 'كُتب صفٌّ لا يفتح درسا').toHaveLength(0)
  })

  it('وبلاغٌ عن اجتماعٍ لا نعرفه لا يرمي ولا يكتب', async () => {
    const { ZoomEventService } = await import('../../services/zoom-events.service')
    const svc = new ZoomEventService(prisma)
    await expect(
      svc.handle('recording.completed', { id: '404040404', share_url: SHARE, recording_files: [MP4] }),
    ).resolves.toBe(false)
  })
})
