/* تحقق حي: الحد الأدنى للمقاعد + قاعدة مخصصة لشعبة + إشعارات المدرب
   أ) قاعدة عامة: 40/متعلم بحد أدنى 5 — سجّل 1 ← يُحتسب 5×40 = 200
   ب) قاعدة مخصصة لشعبة: 30/متعلم بلا حد أدنى — تغلب العامة ← 1×30 = 30
   ج) المدرب يستلم إشعارات التوليد والاعتماد والصرف داخل المنصة */
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
  if (r.status !== 200) { console.log(`دخول فشل ${u}: ${r.status} — توقف`); process.exit(1) }
}
console.log('— دخول الثلاثة ✅ —')

const profileId = (await call(TRAINER, 'GET', '/api/trainer/me')).data?.id
const studentId = (await call(STUDENT, 'GET', '/api/auth/me')).data?.user?.userId
const courseId = (await call(TRAINER, 'GET', '/api/trainer/me/qualifications')).data?.[0]?.courseId

/* أدوات مساعدة لدورة شعبة كاملة حتى الإكمال */
async function runCohort(title) {
  const c = await call(ADMIN, 'POST', '/api/admin/cohorts', { courseId, title, capacity: 10, price: 100 })
  const id = c.data?.id
  await call(ADMIN, 'POST', `/api/admin/trainers/${profileId}/assignments`, { courseId, cohortId: id })
  await call(ADMIN, 'POST', `/api/admin/cohorts/${id}/transition`, { to: 'open' })
  await call(ADMIN, 'PATCH', `/api/admin/cohorts/${id}`, { registrationOpen: true })
  await call(ADMIN, 'POST', `/api/admin/cohorts/${id}/enrollments`, { userId: studentId })
  await call(ADMIN, 'POST', `/api/admin/cohorts/${id}/transition`, { to: 'active' })
  return id
}

console.log('— أ) قاعدة عامة بحد أدنى 5 مقاعد —')
const r1 = await call(ADMIN, 'POST', '/api/admin/trainer-compensation-rules', { profileId, type: 'per_seat', rate: 40, minSeats: 5 })
check('قاعدة عامة: 40/متعلم + حد أدنى 5 (201)', r1.status === 201, JSON.stringify(r1.data).slice(0, 150))

const cohortA = await runCohort('شعبة اختبار الحد الأدنى')
const prevA = await call(ADMIN, 'GET', `/api/admin/trainer-payouts/preview-cohort/${cohortA}`)
check('المعاينة: فعلي 1 ← يُحتسب 5×40 = 200', prevA.status === 200 && Number(prevA.data?.total) === 200, JSON.stringify(prevA.data).slice(0, 250))
check('وصف البند يذكر تطبيق الحد الأدنى', String(prevA.data?.items?.[0]?.description).includes('الحد الأدنى'), prevA.data?.items?.[0]?.description)

await call(ADMIN, 'POST', `/api/admin/cohorts/${cohortA}/transition`, { to: 'completed' })
const earnA = await call(TRAINER, 'GET', '/api/trainer/earnings')
const payA = earnA.data?.payouts?.find((p) => p.items?.some((i) => i.sourceRef === `cohort:${cohortA}`))
check('وُلّد تلقائياً عند الإكمال بـ 200', payA?.status === 'pending' && Number(payA?.total) === 200, JSON.stringify(payA).slice(0, 200))

console.log('— ب) قاعدة مخصصة لشعبة تغلب العامة —')
const cohortB = await runCohort('شعبة اختبار القاعدة المخصصة')
const r2 = await call(ADMIN, 'POST', '/api/admin/trainer-compensation-rules', { profileId, type: 'per_seat', rate: 30, cohortId: cohortB })
check('قاعدة مخصصة للشعبة: 30/متعلم (201)', r2.status === 201, JSON.stringify(r2.data).slice(0, 150))
const prevB = await call(ADMIN, 'GET', `/api/admin/trainer-payouts/preview-cohort/${cohortB}`)
check('المعاينة: المخصصة تفوز ← 1×30 = 30 بلا حد أدنى', prevB.status === 200 && Number(prevB.data?.total) === 30 && prevB.data?.rule?.scope === 'cohort', JSON.stringify(prevB.data).slice(0, 250))
/* العامة بقيت مفتوحة — المخصصة أغلقت نطاقها فقط */
const rulesNow = await call(ADMIN, 'GET', `/api/admin/trainer-compensation-rules?profileId=${profileId}`)
const general = rulesNow.data?.find((r) => r.id === r1.data?.id)
check('القاعدة العامة ما زالت سارية (لم تُغلق)', general && !general.effectiveTo, JSON.stringify(general).slice(0, 150))

await call(ADMIN, 'POST', `/api/admin/cohorts/${cohortB}/transition`, { to: 'completed' })
const earnB = await call(TRAINER, 'GET', '/api/trainer/earnings')
const payB = earnB.data?.payouts?.find((p) => p.items?.some((i) => i.sourceRef === `cohort:${cohortB}`))
check('وُلّد كشف الشعبة المخصصة بـ 30', payB?.status === 'pending' && Number(payB?.total) === 30, JSON.stringify(payB).slice(0, 200))

console.log('— ج) إشعارات المدرب —')
const notifs = await call(TRAINER, 'GET', '/api/learner/notifications')
const titles = (notifs.data ?? []).map((n) => n.title ?? '')
const list = Array.isArray(notifs.data) ? notifs.data : (notifs.data?.notifications ?? notifs.data?.items ?? [])
const allTitles = list.map((n) => n.title)
check('إشعار «وُلّد كشف مستحقاتك تلقائياً» وصل', allTitles.some((t) => t.includes('وُلّد كشف')), allTitles.slice(0, 5).join(' | '))

/* أكمل دورة كشف الشعبة أ: اعتماد ← صرف ← إشعاران */
if (payA?.id) {
  await call(ADMIN, 'POST', `/api/admin/trainer-payouts/${payA.id}/approve`)
  await call(ADMIN, 'POST', `/api/admin/trainer-payouts/${payA.id}/pay`)
  const notifs2 = await call(TRAINER, 'GET', '/api/learner/notifications')
  const list2 = Array.isArray(notifs2.data) ? notifs2.data : (notifs2.data?.notifications ?? notifs2.data?.items ?? [])
  const titles2 = list2.map((n) => n.title)
  check('إشعارا الاعتماد والصرف وصلا', titles2.some((t) => t.includes('اعتُمد')) && titles2.some((t) => t.includes('صُرفت')), titles2.slice(0, 6).join(' | '))
} else { check('كشف الشعبة أ موجود للإكمال', false) }

console.log(failures === 0 ? '\n🎉 كل فحوص الحد الأدنى والنطاق والإشعارات نجحت' : `\n⚠️ ${failures} فحص فشل`)
process.exit(failures === 0 ? 0 : 1)
