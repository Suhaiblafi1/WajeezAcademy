/* المهامّ والإشعارات — تكليفٌ يعلم به صاحبُه.

   قرارُ صاحب المنصّة: «يحقّ للسوبر إعطاء مهام للمستخدمين وإرسال إشعارات
   لهم». ولم يكن في القاعدة نموذجُ «مهمّة» إطلاقا — إلّا `AdvisorTask`،
   وهي مربوطةٌ بحالة عميلٍ بعينها فلا تصلح لتكليفٍ عامّ.

   وثلاثةٌ تُحرَس هنا:

   ١) **التكليفُ يُشعِر دائما** — تكليفٌ لا يعلم به صاحبُه ليس تكليفا: يبقى
      صفّا في جدولٍ ويُحاسَب عليه من لم يره.
   ٢) **ولا يُكلَّف من هو أعلى رتبة** — «مهمّة» من أدنى إلى أعلى إمّا بلا
      معنى وإمّا أداةُ إزعاج.
   ٣) **ويُغلقها مكلَّفُها أو مكلِّفُها لا غيرُهما** — ومن يملك التكليفَ لا
      يملك أن يُغلق مهمّةَ غيره فيمحو أثرَ تقصير. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance

let superCookie = ''
let supportCookie = ''
let academicCookie = ''
let supportId = ''
let academicId = ''
let superId = ''

const STAMP = Date.now()
const cookieFor = async (email: string, password: string) =>
  `${SESSION_COOKIE}=${(await auth.login(email, password)).token}`

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)

  const sa = await auth.register(`st-super-${STAMP}@test.local`, 'Super#12345', 'مدير النظام')
  superId = sa.userId
  await auth.setRoles(superId, ['super_admin'])
  superCookie = await cookieFor(`st-super-${STAMP}@test.local`, 'Super#12345')

  const sup = await auth.register(`st-support-${STAMP}@test.local`, 'Supp#12345', 'الدعم')
  supportId = sup.userId
  await auth.setRoles(supportId, ['support'])
  supportCookie = await cookieFor(`st-support-${STAMP}@test.local`, 'Supp#12345')

  const acad = await auth.register(`st-acad-${STAMP}@test.local`, 'Acad#12345', 'المدير الأكاديمي')
  academicId = acad.userId
  await auth.setRoles(academicId, ['academic_manager'])
  academicCookie = await cookieFor(`st-acad-${STAMP}@test.local`, 'Acad#12345')
})

let taskId = ''

describe('التكليفُ يُشعِر مكلَّفَه', () => {
  it('يُنشأ التكليف ويصل الإشعارُ في الفعل نفسِه', async () => {
    const before = await prisma.notification.count({ where: { userId: supportId } })
    const r = await app.inject({
      method: 'POST', url: '/api/staff/tasks', headers: { cookie: superCookie },
      payload: { assigneeId: supportId, title: 'راجع تذاكر الأسبوع', bodyAr: 'أغلق ما تجاوز ثلاثة أيام.', priority: 'high' },
    })
    expect(r.statusCode, r.body).toBe(201)
    taskId = r.json().id
    expect(
      await prisma.notification.count({ where: { userId: supportId } }),
      'كُلّف ولم يُشعَر — تكليفٌ لا يعلم به صاحبُه',
    ).toBe(before + 1)
  })

  it('ويراه المكلَّفُ في «مهامّي» — بلا حبّةِ صلاحية', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/staff/tasks/mine', headers: { cookie: supportCookie } })
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json().map((t: { id: string }) => t.id)).toContain(taskId)
  })

  it('ولا يراه غيرُه في مهامّه', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/staff/tasks/mine', headers: { cookie: academicCookie } })
    expect(r.json().map((t: { id: string }) => t.id)).not.toContain(taskId)
  })

  it('ومن لا يملك التكليفَ لا يكلّف أحدا', async () => {
    const r = await app.inject({
      method: 'POST', url: '/api/staff/tasks', headers: { cookie: supportCookie },
      payload: { assigneeId: academicId, title: 'مهمّةٌ من أسفل' },
    })
    expect(r.statusCode).toBe(403)
  })
})

describe('ولا يُكلَّف من هو أعلى رتبة', () => {
  it('المديرُ الأكاديميّ (٨٠) لا يكلّف مديرَ النظام (١٠٠)', async () => {
    await prisma.userPermission.create({
      data: { userId: academicId, permissionKey: 'staff.task.assign', effect: 'grant', reason: 'اختبار قيد الرتبة' },
    })
    const cookie = await cookieFor(`st-acad-${STAMP}@test.local`, 'Acad#12345')
    const r = await app.inject({
      method: 'POST', url: '/api/staff/tasks', headers: { cookie },
      payload: { assigneeId: superId, title: 'مهمّةٌ إلى الأعلى' },
    })
    expect(r.statusCode, 'كُلّف من هو أعلى رتبة').toBe(403)
  })

  it('ويكلّف من هو دونه', async () => {
    const cookie = await cookieFor(`st-acad-${STAMP}@test.local`, 'Acad#12345')
    const r = await app.inject({
      method: 'POST', url: '/api/staff/tasks', headers: { cookie },
      payload: { assigneeId: supportId, title: 'راجع مسوّدات الأسبوع' },
    })
    expect(r.statusCode, r.body).toBe(201)
  })
})

describe('والإغلاقُ لطرفَيها لا لثالث', () => {
  it('يُغلقها مكلَّفُها ويصل مكلِّفَها إشعارُ الإنجاز', async () => {
    const before = await prisma.notification.count({ where: { userId: superId } })
    const r = await app.inject({
      method: 'POST', url: `/api/staff/tasks/${taskId}/complete`, headers: { cookie: supportCookie },
      payload: { noteAr: 'أُغلقت أربعُ تذاكر.' },
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json().status).toBe('done')
    expect(
      await prisma.notification.count({ where: { userId: superId } }),
      'أُنجزت ولم يعلم من كلّف',
    ).toBe(before + 1)
  })

  it('ولا تُغلق مرّتين', async () => {
    const r = await app.inject({
      method: 'POST', url: `/api/staff/tasks/${taskId}/complete`, headers: { cookie: supportCookie }, payload: {},
    })
    expect(r.statusCode).toBe(409)
  })

  /* من يملك التكليفَ لا يملك أن يُغلق مهمّةَ غيره فيمحو أثرَ تقصير */
  it('وثالثٌ يملك التكليفَ لا يُغلق مهمّةً ليست له', async () => {
    const fresh = await app.inject({
      method: 'POST', url: '/api/staff/tasks', headers: { cookie: superCookie },
      payload: { assigneeId: supportId, title: 'مهمّةٌ لطرفين' },
    })
    const id = fresh.json().id
    const cookie = await cookieFor(`st-acad-${STAMP}@test.local`, 'Acad#12345')
    const r = await app.inject({
      method: 'POST', url: `/api/staff/tasks/${id}/complete`, headers: { cookie }, payload: {},
    })
    expect(r.statusCode, 'أغلق ثالثٌ مهمّةً ليست له').toBe(403)
  })
})

describe('والإشعارُ بلا مهمّة — حبّةٌ منفصلة', () => {
  it('السوبر يبثّ إشعارا لأكثر من واحد', async () => {
    const before = await prisma.notification.count({ where: { userId: supportId } })
    const r = await app.inject({
      method: 'POST', url: '/api/staff/notify', headers: { cookie: superCookie },
      payload: { userIds: [supportId, academicId], title: 'اجتماع الاثنين', bodyAr: 'العاشرة صباحا في القاعة الكبرى.' },
    })
    expect(r.statusCode, r.body).toBe(201)
    expect(r.json().sent).toBe(2)
    expect(await prisma.notification.count({ where: { userId: supportId } })).toBe(before + 1)
  })

  it('ومن يملك التكليفَ وحدَه لا يبثّ — الحبّتان منفصلتان', async () => {
    /* المديرُ الأكاديميّ مُنح `staff.task.assign` أعلاه ولم يُمنح `staff.notify` */
    const cookie = await cookieFor(`st-acad-${STAMP}@test.local`, 'Acad#12345')
    const r = await app.inject({
      method: 'POST', url: '/api/staff/notify', headers: { cookie },
      payload: { userIds: [supportId], title: 'إعلان', bodyAr: 'نصّ الإعلان.' },
    })
    expect(r.statusCode, 'منحُ التكليف صار منحا للبثّ').toBe(403)
  })
})
