/* /api/version — «هل المنشور هو آخر نسخة؟» في عنوان واحد.
 *
 * كان جواب هذا السؤال تنقّلا بين لوحة Vercel وGitHub ومقارنة بصمات بالعين،
 * ويتكرر بعد كل دفعة. والمقارنة ممكنة ذاتيا لأن تسمية اللقطة الآلية تحمل
 * بصمة التزامها، فيقارن الخادم نفسه بنفسه بلا مصدر خارجي.
 *
 * وأخطر ما في نقطة كهذه ليس أن تخطئ الحساب، بل أن **تدّعي علما لا تملكه**.
 * التسمية شكلان: auto-<sha7>-<hash6> حين يعرف البناء التزامه، وauto-<hash12>
 * حين لا يعرفه. وأول تنفيذ لهذا المسار قرأ الشكل الثاني كأنه الأول، فقارن
 * sha7 بأول ١٢ حرفا من بصمة المحتوى وأعلن «لا تطابق» عن حالة لا حكم فيها
 * أصلا — إنذار كاذب يدفع صاحبه إلى مطاردة عطل غير موجود.
 *
 * فأكثر ما دونه اختبارات للامتناع عن الحكم لا للحكم.
 *
 * وأُضيف بعدها حارسٌ لعمًى من نوع آخر: البصمة كانت تُقرأ من متغيّر اسمه
 * `VERCEL_*` وحده، فلمّا انتقلت المنصّة إلى Cloudways اختفى المتغيّر وامتنع
 * المسار عن الحكم دائما — امتناعٌ صادق عن سؤال صار أعمى. فيُفحص هنا أن
 * البصمة تُقرأ بأيّ اسم أعلنها المضيف، وأن `وقت_البناء` يبقى دليلا حين
 * يُجهل الالتزام أصلا.
 */

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { publishSnapshotIfChanged } from '../../services/auto-publish.service'
import { resetBuildStampCache } from '../../build-stamp'
import { writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let prisma: PrismaClient
let app: FastifyInstance
const ENV_KEYS = [
  'VERCEL_GIT_COMMIT_SHA', 'VERCEL_GIT_COMMIT_REF', 'VERCEL_ENV',
  'GIT_COMMIT_SHA', 'GIT_COMMIT_REF', 'APP_ENV', 'BUILD_STAMP_PATH',
] as const
const saved: Record<string, string | undefined> = {}

async function version() {
  /* الختم يُخزَّن في العملية — والاختبار يغيّر البيئة بين الحالات */
  resetBuildStampCache()
  const res = await app.inject({ method: 'GET', url: '/api/version' })
  expect(res.statusCode).toBe(200)
  return res.json() as {
    الكود: {
      الالتزام: string | null; الفرع: string | null; البيئة: string; رسالة_الالتزام: string | null
      وقت_البناء: string | null; مصدر_البصمة: string
    }
    اللقطة_المنشورة: { التسمية: string | null; من_التزام: string | null; أسئلة: number | null }
    متطابقان: string
  }
}

/* بناءٌ لا يعرف التزامه: لا متغيّر بيئة، ولا ملفّ ختمٍ يُقرأ.
   وتوجيه `BUILD_STAMP_PATH` إلى مسار غير موجود يمنع التقاط ختمٍ حقيقيّ
   تركه بناءٌ محلّي في جذر المستودع — وإلا صار الاختبار رهنَ من بنى آخر مرة. */
function blind() {
  for (const k of ['VERCEL_GIT_COMMIT_SHA', 'GIT_COMMIT_SHA'] as const) delete process.env[k]
  process.env.BUILD_STAMP_PATH = '/nonexistent/build-stamp.json'
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  for (const k of ENV_KEYS) saved[k] = process.env[k]
})

afterAll(async () => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  await app?.close()
})

describe('/api/version', () => {
  it('يقرأ اللقطة الحية فعلا — الأرقام ليست أصفارا مبهمة', async () => {
    blind()
    const v = await version()
    expect(v.اللقطة_المنشورة.التسمية).toBeTruthy()
    expect(v.اللقطة_المنشورة.أسئلة).toBeGreaterThan(100)
  })

  it('بلا التزام معروف: يمتنع عن الحكم ولا يدّعي اختلافا', async () => {
    blind()
    const v = await version()
    expect(v.الكود.الالتزام).toBeNull()
    expect(v.متطابقان).toContain('لا يمكن الحكم')
    expect(v.متطابقان).not.toContain('لا —')
  })

  it('لقطة بلا بصمة التزام: يمتنع كذلك — وهذا هو الإنذار الكاذب الذي وقع', async () => {
    /* لقطة منشورة محليا تحمل الشكل auto-<hash12> بلا التزام */
    const r = await publishSnapshotIfChanged(prisma, { commit: undefined })
    const label = r.published ? r.label! : (await version()).اللقطة_المنشورة.التسمية!
    expect(label, 'التسمية ليست بالشكل بلا-التزام').toMatch(/^auto-[0-9a-f]{12}$/)

    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890'
    const v = await version()
    expect(v.الكود.الالتزام).toBe('abcdef1')
    expect(v.اللقطة_المنشورة.من_التزام, 'قرأ بصمة محتوى كأنها بصمة التزام').toBeNull()
    expect(v.متطابقان).toContain('لا يمكن الحكم')
  })

  it('التزام مطابق لتسمية اللقطة: يقول نعم', async () => {
    const sha = 'a1b2c3d4e5f60000'
    /* انحراف مقصود ليُنشر شيء جديد بالتزام معروف */
    const victim = (await prisma.question.findFirst({ where: { active: true }, orderBy: { id: 'asc' } }))!.id
    await prisma.question.update({ where: { id: victim }, data: { active: false } })
    try {
      const r = await publishSnapshotIfChanged(prisma, { commit: sha })
      expect(r.published).toBe(true)
      process.env.VERCEL_GIT_COMMIT_SHA = sha
      const v = await version()
      expect(v.اللقطة_المنشورة.من_التزام).toBe('a1b2c3d')
      expect(v.متطابقان).toContain('نعم')
    } finally {
      await prisma.question.update({ where: { id: victim }, data: { active: true } })
    }
  })

  it('اختلاف الالتزامين: يقول لا صراحة — ولا يدّعي أيّهما أقدم', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = '9999999000000000'
    const v = await version()
    expect(v.اللقطة_المنشورة.من_التزام).toBe('a1b2c3d')
    expect(v.متطابقان).toContain('لا —')

    /* كان يُشترط هنا ذكر «أقدم». والمسار لا يملك تاريخ الالتزامين ليرتّبهما،
       فكان يجزم بأن اللقطة الأقدم في كل اختلاف — ورُصد يكذب أثناء نشر متعثّر:
       اللقطة من الالتزام الجديد والدالة ما زالت تخدم القديم، فقال العكس تماما.
       والمطلوب أن يقول «لا» بلا مواربة، لا أن يخترع اتجاها لا يعرفه. */
    expect(v.متطابقان, 'ادّعى اتجاها لا يملك ما يثبته').not.toMatch(/أقدم|أحدث/)
  })
  /* ــــ ختمُ البناء: العمى الذي وقع فعلا على الإنتاج ــــ */

  it('يقرأ البصمة باسمٍ محايدٍ للمضيف — لا VERCEL وحده', async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA
    process.env.GIT_COMMIT_SHA = 'facade9876543210'
    process.env.GIT_COMMIT_REF = 'main'
    const v = await version()
    expect(v.الكود.الالتزام, 'اسمٌ محايدٌ لم يُقرأ — وهذا هو عطبُ Cloudways بعينه').toBe('facade9')
    expect(v.الكود.الفرع).toBe('main')
    expect(v.الكود.مصدر_البصمة).toBe('بيئة')
    delete process.env.GIT_COMMIT_SHA
    delete process.env.GIT_COMMIT_REF
  })

  it('وحين لا بيئةَ ولا ملفّ: يقول إنّ البناءَ بلا ختم — لا «تشغيل محلي»', async () => {
    blind()
    const v = await version()
    expect(v.الكود.الالتزام).toBeNull()
    expect(v.الكود.وقت_البناء).toBeNull()
    expect(v.الكود.مصدر_البصمة).toBe('مجهول')
    expect(v.متطابقان, 'يجب أن يدلّ على السبب لا أن يخمّن بيئة').toContain('بلا ختم')
  })

  it('ويقرأ ختمَ ملفٍّ كتبه البناء — ووقتُ البناء يظهر', async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA
    delete process.env.GIT_COMMIT_SHA
    const file = join(tmpdir(), `build-stamp-test-${process.pid}.json`)
    const builtAt = '2026-09-05T12:00:00.000Z'
    writeFileSync(file, JSON.stringify({
      commit: 'deadbeefcafe0000', ref: 'main', message: 'سطرٌ أوّل\nوسطرٌ ثانٍ يُقصى', builtAt,
    }), 'utf8')
    process.env.BUILD_STAMP_PATH = file
    try {
      const v = await version()
      expect(v.الكود.الالتزام).toBe('deadbee')
      expect(v.الكود.وقت_البناء).toBe(builtAt)
      expect(v.الكود.مصدر_البصمة).toBe('ملفّ')
      expect(v.الكود.رسالة_الالتزام, 'رسالةٌ متعدّدةُ الأسطر تُقصّ إلى أوّلها').toBe('سطرٌ أوّل')
    } finally {
      rmSync(file, { force: true })
      delete process.env.BUILD_STAMP_PATH
    }
  })
})
