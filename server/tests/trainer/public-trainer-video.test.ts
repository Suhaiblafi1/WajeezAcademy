/* «تعرّف على مدرّبك» — فيديو المدرّب على صفحة الدورة وصفحته، ولمن أُعلن وحدَه (٨ نوفمبر ٢٠٢٦).

   كان رابطُ الفيديو في «التسويق» لا يُعرض للعامّة في أيّ موضع. وصار يخرج مع مدرّبي الدورة المعلَنين
   (`/api/courses/:courseId/trainer`) ومع صفحته باسمه (`/api/public/trainers/:slug`). وهنا على قاعدةٍ حقيقيّة
   ومن المسار العامّ نفسِه:

   ① فيديو المدرّب لهذه الدورة يخرج معه، جاهزا للتضمين لا رابطا خاما.
   ② والتعريفُ بديلُه حين لا فيديو للدورة — وفيديو الدورة يغلبه حين يوجدان.
   ③ ومن لم يجز عرضُه لا يخرج فيديوه ولو حُفظ — لا وحدَه ولا بجانب مدرّبٍ معلَن.
   ④ وصفحتُه باسمه تعرض تعريفَه وحدَه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'

let prisma: PrismaClient
let app: FastifyInstance
let courses: string[] = []
let seq = 0

const YT = 'dQw4w9WgXcQ'
const YT_EMBED = `https://www.youtube-nocookie.com/embed/${YT}`
const VIMEO_EMBED = 'https://player.vimeo.com/video/76979871'

async function trainer(name: string, visible = true) {
  seq += 1
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-PTV-${Date.now()}-${seq}`, fullName: name, email: `ptv-${seq}-${Date.now()}@test.local`, status: 'active' },
  })
  return (await prisma.trainerProfile.create({
    data: {
      applicationId: application.id, headline: 'مدرّب تفاوض', publicSlug: `ptv-${seq}-${Date.now()}`,
      ...(visible ? { publicVisibility: true, isVerified: true, publishApprovedAt: new Date() } : {}),
    },
  }))
}
/** أصيلُ شعبةٍ مفتوحةٍ في الدورة */
async function leads(courseId: string, profileId: string) {
  seq += 1
  const cohort = await prisma.cohort.create({ data: { courseId, title: `شعبة ${seq}`, status: 'open', capacity: 20 } })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
}
async function video(profileId: string, targetKind: 'bio' | 'course' | 'path', targetId: string, url: string) {
  await prisma.trainerMarketingVideo.create({ data: { profileId, targetKind, targetId, url } })
}

type Reply = { announced: boolean; trainers: { id: string; name: string; video: unknown }[] }
const courseTrainers = async (courseId: string) =>
  (await app.inject({ method: 'GET', url: `/api/courses/${encodeURIComponent(courseId)}/trainer` })).json() as Reply

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  courses = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' } }))
    .map((c) => c.id).slice(12, 20)
}, 240_000)

describe('① فيديو الدورة يخرج مع مدرّبها المعلَن', () => {
  it('⚠️ رابطُ يوتيوب يصير إطارا من youtube-nocookie — لا الرابطَ الخام', async () => {
    const c = courses[0]!
    const t = await trainer('مدرّبة الفيديو')
    await leads(c, t.id)
    await video(t.id, 'course', c, `https://www.youtube.com/watch?v=${YT}&t=10s`)
    const r = await courseTrainers(c)
    expect(r.announced).toBe(true)
    expect(r.trainers).toEqual([expect.objectContaining({
      id: t.id, video: { kind: 'embed', provider: 'youtube', src: YT_EMBED },
    })])
  })

  it('ومن لا فيديو له يخرج بلا فيديو — لا صندوقَ فارغ', async () => {
    const c = courses[1]!
    const t = await trainer('مدرّب بلا فيديو')
    await leads(c, t.id)
    /* فيديو دورةٍ أخرى ومسارٍ لا يُعرضان على هذه الدورة */
    await video(t.id, 'course', courses[7]!, 'https://vimeo.com/76979871')
    await video(t.id, 'path', 'path-x', 'https://vimeo.com/76979871')
    expect((await courseTrainers(c)).trainers).toEqual([expect.objectContaining({ id: t.id, video: null })])
  })
})

describe('② التعريفُ بديلُه، وفيديو الدورة يغلبه', () => {
  it('⚠️ لا فيديو لهذه الدورة: فيديو تعريفه', async () => {
    const c = courses[2]!
    const t = await trainer('مدرّب بتعريف')
    await leads(c, t.id)
    await video(t.id, 'bio', '', 'https://vimeo.com/76979871')
    expect((await courseTrainers(c)).trainers[0]?.video).toEqual({ kind: 'embed', provider: 'vimeo', src: VIMEO_EMBED })
  })

  it('⚠️ وحين يوجدان: فيديو الدورة', async () => {
    const c = courses[3]!
    const t = await trainer('مدرّبة بالاثنين')
    await leads(c, t.id)
    await video(t.id, 'bio', '', 'https://vimeo.com/76979871')
    await video(t.id, 'course', c, `https://youtu.be/${YT}`)
    expect((await courseTrainers(c)).trainers[0]?.video).toEqual({ kind: 'embed', provider: 'youtube', src: YT_EMBED })
  })

  it('ورابطٌ من غير المزوّدين الثلاثة يخرج زرّا لا إطارا', async () => {
    const c = courses[4]!
    const t = await trainer('مدرّب بإنستغرام')
    await leads(c, t.id)
    await video(t.id, 'bio', '', 'https://www.instagram.com/reel/Cabc123/')
    expect((await courseTrainers(c)).trainers[0]?.video).toEqual({ kind: 'link', href: 'https://www.instagram.com/reel/Cabc123/' })
  })
})

describe('③ ومن لم يجز عرضُه لا يخرج فيديوه', () => {
  it('⚠️ أصيلٌ لم يُعتمد نشرُه وله فيديو محفوظ — لا مدرّبَ ولا فيديو', async () => {
    const c = courses[5]!
    const hidden = await trainer('مدرّب مخفيّ', false)
    await leads(c, hidden.id)
    await video(hidden.id, 'course', c, `https://youtu.be/${YT}`)
    await video(hidden.id, 'bio', '', 'https://vimeo.com/76979871')
    const r = await courseTrainers(c)
    expect(r.announced).toBe(false)
    expect(r.trainers).toEqual([])
  })

  it('⚠️ ولا بجانب مدرّبٍ معلَنٍ في الدورة نفسِها — ولا الموقوف', async () => {
    const c = courses[6]!
    const shown = await trainer('مدرّبة معلَنة')
    const hidden = await trainer('مدرّب لم يعتمد', false)
    const suspended = await trainer('مدرّب موقوف')
    await prisma.trainerProfile.update({ where: { id: suspended.id }, data: { suspendedAt: new Date() } })
    for (const t of [shown, hidden, suspended]) await leads(c, t.id)
    await video(hidden.id, 'course', c, `https://youtu.be/${YT}`)
    await video(suspended.id, 'course', c, `https://youtu.be/${YT}`)
    await video(shown.id, 'bio', '', 'https://vimeo.com/76979871')
    const r = await courseTrainers(c)
    expect(r.trainers.map((t) => t.id)).toEqual([shown.id])
    /* وفيديوهما لا يرد في أيّ موضعٍ من الردّ — لا تحت اسمٍ آخر ولا في حقلٍ جانبيّ */
    expect(r.trainers.map((t) => t.video)).toEqual([{ kind: 'embed', provider: 'vimeo', src: VIMEO_EMBED }])
    expect(JSON.stringify(r)).not.toContain(YT)
  })
})

describe('④ وصفحتُه باسمه تعرض تعريفَه وحدَه', () => {
  it('⚠️ تعريفُه يخرج مع صفحته — لا فيديو دورة', async () => {
    const c = courses[7]!
    const t = await trainer('مدرّبة بصفحة')
    await leads(c, t.id)
    await video(t.id, 'course', c, `https://youtu.be/${YT}`)
    await video(t.id, 'bio', '', 'https://vimeo.com/76979871')
    const page = (await app.inject({ method: 'GET', url: `/api/public/trainers/${t.publicSlug}` })).json() as { video: unknown }
    expect(page.video).toEqual({ kind: 'embed', provider: 'vimeo', src: VIMEO_EMBED })
  })

  it('وبلا تعريف: لا فيديو', async () => {
    const t = await trainer('مدرّب بصفحة بلا تعريف')
    await leads(courses[7]!, t.id)
    await video(t.id, 'course', courses[7]!, `https://youtu.be/${YT}`)
    const page = (await app.inject({ method: 'GET', url: `/api/public/trainers/${t.publicSlug}` })).json() as { video: unknown }
    expect(page.video).toBeNull()
  })

  it('ومن لم يُعتمد نشرُه لا صفحةَ له أصلا — فلا فيديو', async () => {
    const t = await trainer('مدرّب مخفيّ بصفحة', false)
    await leads(courses[7]!, t.id)
    await video(t.id, 'bio', '', 'https://vimeo.com/76979871')
    const res = await app.inject({ method: 'GET', url: `/api/public/trainers/${t.publicSlug}` })
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain('76979871')
  })
})
