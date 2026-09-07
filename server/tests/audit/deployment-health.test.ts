/* البند ٦ · «صحّةُ النظام» تقول أيَّ نسخةٍ تعمل، وعلى أيّ عنوان.

   ── لماذا هنا، والجوابُ في `‎/api/version` منذ إصلاحِ ختم البناء ──

   لأنّ **معلومةً لا شاشةَ لها معلومةٌ غيرُ موجودة**. بقي سؤالُ «لماذا أرى
   موقعا قديما؟» مفتوحا أسبوعا، وذهبت جلسةٌ في تشخيصٍ على بيئةٍ خاطئة، والجوابُ
   طوالَ ذلك في مسارِ JSON لا يفتحه أحدٌ إلّا من يعرف أنّه موجود.

   ── وأخطرُ بندٍ فيها `site_url` ──

   غيابُ `APP_URL` في الإنتاج **لا أثرَ له في السجلّات**: البناءُ ينجح، والموقعُ
   يعمل، والاختباراتُ خضراء. وأثرُه كلُّه عند المشتري — يعود بعد دفعٍ **ناجحٍ**
   إلى `localhost`، والمالُ مقبوضٌ والتسجيلُ مسوًّى لأنّ الـwebhook مستقلٌّ عن
   المتصفّح. عطبٌ صامتٌ حيث نقرأ، صاخبٌ حيث لا نرى — وهو أسوأُ ترتيب. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { SystemHealthService } from '../../services/system-health.service'
import { resetBuildStampCache } from '../../build-stamp'

let prisma: PrismaClient
let health: SystemHealthService

interface Item { key: string; titleAr: string; valueAr: string; level: string; meaningAr: string; actionAr?: string }
interface Snapshot { groups: { titleAr: string; items: Item[] }[]; worst: string }

const item = async (key: string) => {
  const s = (await health.snapshot()) as unknown as Snapshot
  return s.groups.flatMap((g) => g.items).find((i) => i.key === key)
}

const savedUrl = process.env.APP_URL
const savedEnv = process.env.NODE_ENV

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  health = new SystemHealthService(prisma)
}, 240_000)

afterAll(() => {
  if (savedUrl === undefined) delete process.env.APP_URL
  else process.env.APP_URL = savedUrl
  if (savedEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = savedEnv
  resetBuildStampCache()
})

describe('البنودُ الأربعةُ تصل الشاشةَ فعلا', () => {
  it('مجموعةُ «النسخةُ العاملةُ والبيئة» موجودةٌ في اللقطة', async () => {
    const s = (await health.snapshot()) as unknown as Snapshot
    const g = s.groups.find((x) => x.titleAr.includes('النسخةُ العاملة'))
    expect(g, 'بلا المجموعةِ يبقى الجوابُ في curl').toBeTruthy()
    expect(g!.items.map((i) => i.key)).toEqual(
      expect.arrayContaining(['running_build', 'snapshot_sync', 'site_url', 'built_site_origin']),
    )
  })

  it('وكلُّ بندٍ يقول ما يعنيه — لا رقما مجرّدا', async () => {
    for (const key of ['running_build', 'snapshot_sync', 'site_url', 'built_site_origin']) {
      const i = await item(key)
      expect(i!.meaningAr.length, `${key} بلا معنًى مكتوب`).toBeGreaterThan(40)
      expect(i!.valueAr.length, `${key} بلا قيمةٍ مقروءة`).toBeGreaterThan(0)
    }
  })
})

describe('`site_url` — العطبُ الصامتُ يُعطى صوتا', () => {
  it('غيابُ APP_URL في الإنتاج **معطَّل** لا «يحتاج نظرة»', async () => {
    delete process.env.APP_URL
    process.env.NODE_ENV = 'production'
    const i = await item('site_url')
    expect(
      i!.level,
      'المشتري يعود بعد دفعٍ ناجحٍ إلى localhost — وهذا ليس أمرا «يُنظر فيه»',
    ).toBe('broken')
    expect(i!.valueAr, 'القيمةُ تخفي أنّها احتياطيّ').toContain('localhost')
    expect(i!.valueAr).toContain('احتياطي')
    expect(i!.actionAr, 'بلا إجراءٍ مكتوبٍ يبقى الأحمرُ بلا مخرج').toContain('APP_URL')
  })

  it('وغيابُه في التطوير سليم — فلا يحمرّ جهازُ مطوّرٍ بلا سبب', async () => {
    delete process.env.APP_URL
    process.env.NODE_ENV = 'test'
    /* حاجزٌ يحمرّ على الحال القائم يُعلّم قارئَه تجاهلَ الأحمر — وهي القاعدةُ
       نفسُها المكتوبةُ في بوّابة التأليف. */
    expect((await item('site_url'))!.level).toBe('ok')
  })

  it('وضبطُه يُطفئه ويعرض العنوانَ نفسَه', async () => {
    process.env.NODE_ENV = 'production'
    process.env.APP_URL = 'https://www.wajeezacademy.com'
    const i = await item('site_url')
    expect(i!.level).toBe('ok')
    expect(i!.valueAr).toBe('https://www.wajeezacademy.com')
    expect(i!.actionAr).toBeUndefined()
  })
})

describe('`snapshot_sync` — الاختلافُ نظرةٌ لا عطب', () => {
  it('بلا لقطةٍ منشورةٍ يمتنع عن الحكم ولا يعلن اختلافا', async () => {
    /* قاعدةُ اختبارٍ بلا نشرٍ آليّ: لا تسميةَ أصلا. والامتناعُ هو الصواب —
       وإعلانُ «لا، من التزامَين مختلفَين» هنا إنذارٌ كاذبٌ يُطارَد. */
    const i = await item('snapshot_sync')
    expect(i!.level).toBe('unknown')
    expect(i!.valueAr).toBe('لا يمكن الحكم')
  })
})
