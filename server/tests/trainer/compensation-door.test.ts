/* المالية تملك المفتاحَ — فلتملك البابَ.

   ── العطبُ الذي فُتح له هذا الحارس ──

   محرِّرُ قواعد الأتعاب كان لسانا في شاشة «طلبات انضمام المدربين»، وبابُها
   `trainer.applications.view`. والأتعابُ محروسةٌ بـ`trainer.compensation.manage`.
   والصلاحيّتان لا تلتقيان إلّا في `super_admin`:

     · `trainer.applications.view` — المديرُ الأكاديميّ · المنسّقُ · مديرُ العمليّات
     · `trainer.compensation.manage` — **المالية**

   فالماليةُ تُردّ على الباب، والمديرُ الأكاديميُّ يبلغ اللسانَ ويُردّ عند
   أوّل فعل. وليس هذا إزعاجا: بلا قاعدةِ أتعابٍ **لا يُولَّد كشفٌ إطلاقا**
   (`computeCohort` يرمي `no_rule`) — فالبابُ المسدودُ هو بعينه ما يُبقي
   «مستحقّاتي» صفرا عند كلّ مدرّب.

   ── والعطبُ الثاني، وُجد وأنا أُصلح الأوّل ──

   الشاشةُ كانت تقرأ الشعبَ من `‎/api/admin/cohorts` — وهي وراء
   `cohort.manage`، **ولا تملكها المالية**. فلو فُتح لها البابُ وحدَه لَسقط
   `Promise.all` بـ٤٠٣ وماتت الشاشةُ بتمامها: لا كشفَ ولا قاعدةَ ولا مدرّب،
   بل «تعذر تحميل الكشوف». فنقلُ البابِ بلا هذا نصفُ إصلاح.

   ومنحُ الماليّةِ `cohort.manage` جوابٌ أوسعُ من السؤال — تصير تُنشئ الشعبَ
   وتفتحها. فقراءةٌ ضيّقةٌ خلف صلاحيّة الأتعاب نفسِها.

   ── ولمَ يُقاس بحسابِ ماليّةٍ حقيقيّ ──

   لا بجدول `RolePermission` ولا بنصّ الشاشة: الدورُ يُبذَر من
   `server/auth/permissions.ts`، والطلبُ يمرّ بالحارس نفسِه الذي يمرّ به في
   الإنتاج. فما يُقاس هنا هو ما سيراه صاحبُ الحساب. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const readCode = (p: string) => readFileSync(join(root, p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')

let prisma: PrismaClient
let app: FastifyInstance
let financeCookie = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  const auth = new AuthService(prisma)
  const u = await auth.register('door-finance@test.local', 'Finance#12345', 'موظّفُ المالية')
  await auth.setRoles(u.userId, ['finance'])
  const { token } = await auth.login('door-finance@test.local', 'Finance#12345')
  financeCookie = `${SESSION_COOKIE}=${token}`
}, 240_000)

const get = (url: string) => app.inject({ method: 'GET', url, headers: { cookie: financeCookie } })

describe('المالية تبلغ أدواتِ الأتعاب كلَّها', () => {
  it('الكشوفُ والقواعدُ والملفّاتُ تُقرأ — وهي ما تحمله الشاشة', async () => {
    for (const url of [
      '/api/admin/trainer-payouts',
      '/api/admin/trainer-compensation-rules',
      '/api/admin/trainer-profiles',
    ]) {
      const res = await get(url)
      expect(res.statusCode, `${url} ← ${res.body}`).toBeLessThan(300)
    }
  })

  it('والشعبُ كذلك — وإلّا سقط `Promise.all` وماتت الشاشةُ بتمامها', async () => {
    const res = await get('/api/admin/trainer-payouts/cohort-options')
    expect(
      res.statusCode,
      'حقلُ الشعب يُردّ ٤٠٣ فلا يسقط وحدَه: الشاشةُ تحمّل الأربعةَ معا، '
      + 'فتقول «تعذر تحميل الكشوف» ولا كشفَ ولا قاعدةَ ولا مدرّب.',
    ).toBeLessThan(300)
    expect(Array.isArray(res.json())).toBe(true)
  })

  it('ولا يتّسع المفتاحُ بأكثرَ من الحاجة — الشعبُ تُقرأ ولا تُدار', async () => {
    /* لو مُنحت `cohort.manage` لَمرّت هذه — وهي إنشاءُ شعبةٍ لا قراءتُها */
    const res = await app.inject({
      method: 'POST', url: '/api/admin/cohorts', headers: { cookie: financeCookie },
      payload: { courseId: 'C-BIZ-101', title: 'شعبةٌ من المالية', capacity: 5 },
    })
    expect(res.statusCode, 'المالية تُنشئ شعبا — وهو أوسعُ من ضبط رقم').toBe(403)
  })
})

describe('وبابُها في مكانه', () => {
  it('للأتعاب شاشتُها ومسارُها — لا لسانٌ في شاشةٍ بابُها صلاحيّةٌ أخرى', () => {
    const routes = readCode('src/App.tsx')
    expect(routes, 'لا مسارَ للأتعاب').toContain('/admin/trainer-compensation')
    const apps = readCode('src/pages/admin/TrainerApplications.tsx')
    expect(
      apps,
      'اللسانُ ما زال في شاشة الطلبات — بابُها `trainer.applications.view`، '
      + 'فالماليةُ تُردّ عليه والمديرُ الأكاديميُّ يُردّ عند أوّل فعل.',
    ).not.toContain('<TrainerPayouts')
  })

  it('وحارسُ البابِ صلاحيّةُ الأتعاب نفسُها — لا أوسعُ ولا أضيق', () => {
    const nav = readCode('src/pages/admin/AdminLayout.tsx')
    const i = nav.indexOf('/admin/trainer-compensation')
    expect(i, 'لا بابَ في القائمة — فلا يبلغه إلّا من يكتب مسارَه بيده').toBeGreaterThan(0)
    const entry = nav.slice(i, nav.indexOf('\n', i))
    expect(entry).toContain('need: "trainer.compensation.manage"')
  })
})
