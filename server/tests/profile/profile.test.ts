/* اختبار الملف الشخصي للمتعلم: إنشاء عند أول قراءة، تحديث جزئي لا يمس الحقول غير المرسلة،
   حذف بإرسال null، رفض القيم غير الصالحة، وعدم المساس بلقطة التشخيص من هذا المسار. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { ProfileService } from '../../services/profile.service'

let prisma: PrismaClient
let auth: AuthService
let profiles: ProfileService
let learnerId: string

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  profiles = new ProfileService(prisma)
  const u = await auth.register('profile-learner@test.local', 'Learner#12345', 'طالب تجريبي')
  learnerId = u.userId
})

describe('الملف الشخصي للمتعلم', () => {
  it('ينشئ صفا فارغا عند أول قراءة ويعيد بيانات الحساب معه', async () => {
    const { user, profile } = await profiles.getProfile(learnerId)
    expect(user.email).toBe('profile-learner@test.local')
    expect(user.displayName).toBe('طالب تجريبي')
    expect(profile.userId).toBe(learnerId)
    expect(profile.country).toBeNull()
  })

  it('يحفظ تحديثا جزئيا ويسترجعه من القاعدة', async () => {
    await profiles.updateProfile(learnerId, {
      country: 'الأردن', city: 'عمّان', phone: '+962771052222',
      education: 'بكالوريوس', university: 'الجامعة الأردنية', major: 'إدارة أعمال',
      jobTitle: 'أخصائي تسويق', company: 'شركة تجريبية', experienceYears: '4-7',
      careerGoal: 'قيادة فريق تسويق', interests: ['التسويق الرقمي', 'تحليل البيانات'],
      birthDate: '1996-05-14T00:00:00.000Z', gender: 'male',
    })
    const { profile } = await profiles.getProfile(learnerId)
    expect(profile.country).toBe('الأردن')
    expect(profile.city).toBe('عمّان')
    expect(profile.interests).toEqual(['التسويق الرقمي', 'تحليل البيانات'])
    expect(profile.birthDate?.toISOString()).toBe('1996-05-14T00:00:00.000Z')
  })

  it('يحدّث الاسم المعروض على نموذج المستخدم', async () => {
    await profiles.updateProfile(learnerId, { displayName: 'طالب التجربة' })
    const { user } = await profiles.getProfile(learnerId)
    expect(user.displayName).toBe('طالب التجربة')
  })

  it('لا يمس الحقول غير المرسلة ويحذف بـnull', async () => {
    await profiles.updateProfile(learnerId, { company: null })
    const { profile } = await profiles.getProfile(learnerId)
    expect(profile.company).toBeNull()
    expect(profile.country).toBe('الأردن') // بقي كما هو
  })

  it('يرفض جنسا غير معروف واسما قصيرا', async () => {
    await expect(profiles.updateProfile(learnerId, { gender: 'other' })).rejects.toThrow()
    await expect(profiles.updateProfile(learnerId, { displayName: 'ط' })).rejects.toThrow()
  })

  it('لا تعدل هذه الخدمة لقطة التشخيص إطلاقا', async () => {
    await profiles.updateProfile(learnerId, { goalAr: 'هدف تعلمي جديد' } as never)
    const { profile } = await profiles.getProfile(learnerId)
    expect(profile.goalAr).toBe('هدف تعلمي جديد')
    expect(profile.diagnosticSnapshot).toBeNull() // لم تُنشأ ولم تُعدَّل من هنا
  })

  /* انحدار على مستوى HTTP: جسر الواجهة→الخادم كان يحذف الحقول بصمت
     (Fastify schema بلا properties + additionalProperties:false) — لا تكرار */
  it('يحفظ الحقول عبر مسار HTTP نفسه لا الخدمة فقط', async () => {
    const { buildApp } = await import('../../http/app')
    const app = await buildApp(prisma)
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'profile-learner@test.local', password: 'Learner#12345' } })
    expect(login.statusCode).toBe(200)
    const cookie = login.cookies.find((c) => c.name === 'wajeez_session')!
    const patch = await app.inject({
      method: 'PATCH', url: '/api/learner/profile',
      cookies: { wajeez_session: cookie.value },
      payload: { city: 'إربد', jobTitle: 'مديرة تسويق' },
    })
    expect(patch.statusCode).toBe(200)
    const after = await app.inject({ method: 'GET', url: '/api/learner/profile', cookies: { wajeez_session: cookie.value } })
    const body = after.json() as { profile: { city: string; jobTitle: string } }
    expect(body.profile.city).toBe('إربد')
    expect(body.profile.jobTitle).toBe('مديرة تسويق')
    await app.close()
  })
})
