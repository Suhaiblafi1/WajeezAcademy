/* تحقق حي: إشعارات الطالب عبر رحلة التسجيل الكاملة
   طالب يطلب ← إدارة تقبل (إشعار قبول) ← طالب يدفع (إشعار تأكيد) ← عدّاد غير المقروء */
const API = 'http://localhost:7101'
const PASS = 'Wajeez-Demo-2026'
const ADMIN = 'superadmin.demo@wajeez.local'
const TRAINER = 'trainer.demo@wajeez.local'
const STUDENT = 'student.demo@wajeez.local'

let failures = 0
const jar = new Map()
async function call(user, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), cookie: jar.get(user) ?? '' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const sc = res.headers.get('set-cookie')
  if (sc) jar.set(user, sc.split(';')[0])
  let data = null
  try { data = await res.json() } catch { }
  return { status: res.status, data }
}
const check = (name, cond, extra = '') => {
  if (cond) console.log(`  ✅ ${name}`)
  else { failures++; console.log(`  ❌ ${name} ${extra}`) }
}

for (const u of [ADMIN, TRAINER, STUDENT]) {
  const r = await call(u, 'POST', '/api/auth/login', { email: u, password: PASS })
  if (r.status !== 200) { console.log(`دخول فشل ${u}: ${r.status}`); process.exit(1) }
}
console.log('— دخول الثلاثة ✅ —')

const profileId = (await call(TRAINER, 'GET', '/api/trainer/me')).data?.id
const courseId = (await call(TRAINER, 'GET', '/api/trainer/me/qualifications')).data?.[0]?.courseId

console.log('— شعبة مفتوحة للطلب —')
const c = await call(ADMIN, 'POST', '/api/admin/cohorts', { courseId, title: 'شعبة اختبار إشعارات الطالب', capacity: 10, price: 100 })
const cohortId = c.data?.id
await call(ADMIN, 'POST', `/api/admin/trainers/${profileId}/assignments`, { courseId, cohortId })
await call(ADMIN, 'POST', `/api/admin/cohorts/${cohortId}/transition`, { to: 'open' })
await call(ADMIN, 'PATCH', `/api/admin/cohorts/${cohortId}`, { registrationOpen: true })

console.log('— الطالب يطلب ← الإدارة تقبل —')
const reqRes = await call(STUDENT, 'POST', '/api/learner/enrollment-requests', { cohortId })
check('طلب التسجيل (201)', reqRes.status === 201, JSON.stringify(reqRes.data).slice(0, 150))
const requestId = reqRes.data?.id

const approve = await call(ADMIN, 'POST', `/api/admin/enrollment-requests/${requestId}/approve`, {})
check('القبول (200/201)', approve.status === 200 || approve.status === 201, JSON.stringify(approve.data).slice(0, 150))
const orderId = approve.data?.id

const notifs1 = await call(STUDENT, 'GET', '/api/learner/notifications')
const list1 = Array.isArray(notifs1.data) ? notifs1.data : []
check('إشعار «قُبِل طلب تسجيلك» وصل', list1.some((n) => n.title?.includes('قُبِل طلب تسجيلك')), list1.map((n) => n.title).slice(0, 4).join(' | '))

console.log('— الطالب يدفع —')
const pay = await call(STUDENT, 'POST', `/api/learner/orders/${orderId}/pay-test`, { idempotencyKey: `test-${Date.now()}-notifs` })
check('الدفع الاختباري نجح', pay.status === 200 || pay.status === 201, JSON.stringify(pay.data).slice(0, 150))

const notifs2 = await call(STUDENT, 'GET', '/api/learner/notifications')
const list2 = Array.isArray(notifs2.data) ? notifs2.data : []
check('إشعار «تأكد دفعك» وصل', list2.some((n) => n.title?.includes('تأكد دفعك')), list2.map((n) => n.title).slice(0, 5).join(' | '))

const unread = await call(STUDENT, 'GET', '/api/learner/notifications/unread-count')
check('عدّاد غير المقروء ≥ 2', (unread.data?.unread ?? 0) >= 2, JSON.stringify(unread.data))

const myLearning = await call(STUDENT, 'GET', '/api/learner/my-learning')
check('التسجيل تحول فعلياً (يظهر في تعلّمي)', JSON.stringify(myLearning.data).includes(cohortId), '')

console.log(failures === 0 ? '\n🎉 إشعارات الطالب تعمل عبر الرحلة الكاملة' : `\n⚠️ ${failures} فحص فشل`)
process.exit(failures === 0 ? 0 : 1)
