/* أيّامُ الشعبة رموزٌ لا نصٌّ حرّ.

   كان نموذجا الإنشاء والتحرير حقلا نصّيّا يقترح «الأحد، الثلاثاء»، ويُشقّ
   على الفاصلة ويُخزَّن كما كُتب. والقاعدةُ تحفظ رموزا (`sun`…`sat`) يعرّبها
   `dayLabelAr` عند العرض، وهو يُرجع ما لا يعرفه كما هو — فبدا «الأحد» صحيحا
   على الشاشة، وفي القاعدة تمثيلان ليومٍ واحد لا يجمعهما فرزٌ ولا مقارنة.
   وقد وقع فعلا: وجدتُ في القاعدة `tue` و«الأربعاء» جنبا إلى جنب.

   والمنتقي في الواجهة يغلق الباب بالنقر، لكنّ الواجهة ليست الحدّ: من ينادي
   الـAPI مباشرةً يتجاوزها. فالحدُّ هنا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { DAY_CODES } from '../../../src/application/schedule/days'

let prisma: PrismaClient
let app: FastifyInstance
let cookie = ''

const COURSE = 'C-BIZ-101'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  app = await buildApp(prisma)
  const ops = await auth.register('daycodes-ops@test.local', 'Ops#12345', 'مدير العمليات')
  await auth.setRoles(ops.userId, ['operations_manager'])
  cookie = `${SESSION_COOKIE}=${(await auth.login('daycodes-ops@test.local', 'Ops#12345')).token}`
}, 240_000)

const create = (daysOfWeek: string[], title: string) =>
  app.inject({
    method: 'POST', url: '/api/admin/cohorts', headers: { cookie },
    payload: { courseId: COURSE, title, daysOfWeek, startTime: '18:00' },
  })

describe('الأيّامُ رموزٌ معروفة — والخادمُ هو الحدّ', () => {
  it('يقبل الرموز السبعة كلَّها', async () => {
    const res = await create([...DAY_CODES], 'شعبةُ الأيّام السبعة')
    expect(res.statusCode, res.body).toBe(201)
    const created = await prisma.cohort.findFirst({ where: { title: 'شعبةُ الأيّام السبعة' } })
    expect(created?.daysOfWeek).toEqual([...DAY_CODES])
  })

  it('ويردّ الاسمَ العربيَّ المكتوب باليد — لا يخزّنه', async () => {
    const res = await create(['الأحد', 'الثلاثاء'], 'شعبةُ النصّ الحرّ')
    expect(res.statusCode, 'قُبل يومٌ بالعربية فصار في القاعدة تمثيلان').toBe(422)
    expect(await prisma.cohort.findFirst({ where: { title: 'شعبةُ النصّ الحرّ' } })).toBeNull()
  })

  it('ويردّ رمزا مخترعا', async () => {
    const res = await create(['sun', 'funday'], 'شعبةُ الرمز المخترع')
    expect(res.statusCode).toBe(422)
    expect(await prisma.cohort.findFirst({ where: { title: 'شعبةُ الرمز المخترع' } })).toBeNull()
  })

  it('والتعديلُ محروسٌ كالإنشاء — لا بابَ خلفيّ', async () => {
    const ok = await create(['mon'], 'شعبةُ التعديل')
    expect(ok.statusCode).toBe(201)
    const id = (JSON.parse(ok.body) as { id: string }).id
    const bad = await app.inject({
      method: 'PATCH', url: `/api/admin/cohorts/${id}`, headers: { cookie },
      payload: { daysOfWeek: ['الاثنين'] },
    })
    expect(bad.statusCode, 'التعديل يقبل ما يردّه الإنشاء').toBe(422)
    expect((await prisma.cohort.findUnique({ where: { id } }))?.daysOfWeek).toEqual(['mon'])
  })
})
