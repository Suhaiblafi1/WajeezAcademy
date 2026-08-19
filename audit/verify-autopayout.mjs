/* تحقق حي: قواعد الأتعاب والتوليد التلقائي من الشعب المكتملة
   السيناريو: قاعدة «لكل متعلم» ← شعبة جديدة ← إسناد مدرب ← تسجيل طالب
   ← انتقالات حتى «مكتملة» ← الكشف يُولَّد تلقائياً ← منع التكرار ← إغلاق القاعدة القديمة */
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
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) jar.set(user, setCookie.split(';')[0])
  let data = null
  try { data = await res.json() } catch { /* لا جسم */ }
  return { status: res.status, data }
}
function check(name, cond, extra = '') {
  if (cond) console.log(`  ✅ ${name}`)
  else { failures++; console.log(`  ❌ ${name} ${extra}`) }
}

for (const u of [ADMIN, TRAINER, STUDENT]) {
  const r = await call(u, 'POST', '/api/auth/login', { email: u, password: PASS })
  check(`دخول ${u.split('@')[0]}`, r.status === 200, `status=${r.status}`)
  if (r.status !== 200) { console.log('توقف مبكر — الدخول فشل'); process.exit(1) }
}

console.log('— تنظيف كشف الصفر من الجولة السابقة —')
const prev = await call(ADMIN, 'GET', '/api/admin/trainer-payouts?status=pending')
for (const p of prev.data ?? []) {
  if (Number(p.total) === 0 && p.items?.some((i) => i.sourceRef?.startsWith('cohort:'))) {
    await call(ADMIN, 'POST', `/api/admin/trainer-payouts/${p.id}/cancel`, { reason: 'تصحيح اختبار — وُلّد بصفر قبل فتح باب التسجيل' })
    console.log('  🧹 أُلغي كشف صفري سابق:', p.id)
  }
}

console.log('— المعرفات الأساسية —')
const meT = await call(TRAINER, 'GET', '/api/trainer/me')
const profileId = meT.data?.id
const meS = await call(STUDENT, 'GET', '/api/auth/me')
const studentId = meS.data?.user?.userId
const quals = await call(TRAINER, 'GET', '/api/trainer/me/qualifications')
const courseId = quals.data?.[0]?.courseId // دورة يجيزها المدرب فعلاً — شرط الإسناد
check('ملف المدرب + الطالب + دورة موجودة', Boolean(profileId && studentId && courseId), `p=${profileId} s=${studentId} c=${courseId}`)

console.log('— قاعدة الأتعاب: لكل متعلم × 40 —')
const rule1 = await call(ADMIN, 'POST', '/api/admin/trainer-compensation-rules', { profileId, type: 'per_seat', rate: 40 })
check('تعيين القاعدة (201)', rule1.status === 201, JSON.stringify(rule1.data).slice(0, 150))
const badRule = await call(ADMIN, 'POST', '/api/admin/trainer-compensation-rules', { profileId, type: 'revenue_share', rate: 150 })
check('رفض نسبة إيراد > 100 (400)', badRule.status === 400, `status=${badRule.status}`)

console.log('— شعبة جديدة: إسناد + تسجيل + انتقالات —')
const cohort = await call(ADMIN, 'POST', '/api/admin/cohorts', {
  courseId, title: 'شعبة اختبار التوليد التلقائي', capacity: 10, price: 100,
})
check('إنشاء الشعبة (201)', cohort.status === 201, JSON.stringify(cohort.data).slice(0, 150))
const cohortId = cohort.data?.id

const assign = await call(ADMIN, 'POST', `/api/admin/trainers/${profileId}/assignments`, { courseId, cohortId })
check('إسناد المدرب للشعبة', assign.status === 200 || assign.status === 201, JSON.stringify(assign.data).slice(0, 150))

const openT = await call(ADMIN, 'POST', `/api/admin/cohorts/${cohortId}/transition`, { to: 'open' })
check('انتقال ← open', openT.status === 200, JSON.stringify(openT.data).slice(0, 120))
const reg = await call(ADMIN, 'PATCH', `/api/admin/cohorts/${cohortId}`, { registrationOpen: true })
check('فتح باب التسجيل', reg.status === 200, JSON.stringify(reg.data).slice(0, 120))
const enroll = await call(ADMIN, 'POST', `/api/admin/cohorts/${cohortId}/enrollments`, { userId: studentId })
check('تسجيل الطالب (201)', enroll.status === 201, JSON.stringify(enroll.data).slice(0, 150))
const actT = await call(ADMIN, 'POST', `/api/admin/cohorts/${cohortId}/transition`, { to: 'active' })
check('انتقال ← active', actT.status === 200, JSON.stringify(actT.data).slice(0, 120))

console.log('— المعاينة قبل الإكمال —')
const preview = await call(ADMIN, 'GET', `/api/admin/trainer-payouts/preview-cohort/${cohortId}`)
check('المعاينة: متعلم واحد × 40 = 40', preview.status === 200 && Number(preview.data?.total) === 40, JSON.stringify(preview.data).slice(0, 200))

console.log('— الإكمال = التوليد التلقائي —')
const done = await call(ADMIN, 'POST', `/api/admin/cohorts/${cohortId}/transition`, { to: 'completed' })
check('انتقال ← completed', done.status === 200, JSON.stringify(done.data).slice(0, 120))

const earnings = await call(TRAINER, 'GET', '/api/trainer/earnings')
const auto = earnings.data?.payouts?.find((p) => p.items?.some((i) => i.sourceRef === `cohort:${cohortId}`))
check('الكشف وُلّد تلقائياً عند الإكمال (pending, 40 JOD)', auto?.status === 'pending' && Number(auto?.total) === 40, String(JSON.stringify(auto)).slice(0, 200))

console.log('— منع التكرار والدفعي —')
const dup = await call(ADMIN, 'POST', '/api/admin/trainer-payouts/generate', { cohortId })
check('توليد يدوي مكرر لنفس الشعبة (409)', dup.status === 409, `status=${dup.status} ${JSON.stringify(dup.data).slice(0, 120)}`)
const batch = await call(ADMIN, 'POST', '/api/admin/trainer-payouts/generate', { batch: true })
check('الدفعي: يتخطى المولَّدة ولا يكررها', batch.status === 200 && batch.data?.skipped?.some((s) => s.cohortId === cohortId), JSON.stringify(batch.data).slice(0, 250))

console.log('— إغلاق القاعدة القديمة عند تعيين جديدة —')
const rule2 = await call(ADMIN, 'POST', '/api/admin/trainer-compensation-rules', { profileId, type: 'fixed_per_cohort', rate: 250 })
check('تعيين قاعدة ثابتة 250', rule2.status === 201, JSON.stringify(rule2.data).slice(0, 120))
const rules = await call(ADMIN, 'GET', `/api/admin/trainer-compensation-rules?profileId=${profileId}`)
const oldClosed = rules.data?.find((r) => r.id === rule1.data?.id)
const newOpen = rules.data?.find((r) => r.id === rule2.data?.id)
check('القديمة أُغلقت (effectiveTo) والجديدة مفتوحة', Boolean(oldClosed?.effectiveTo) && !newOpen?.effectiveTo, JSON.stringify(rules.data).slice(0, 250))

console.log(failures === 0 ? '\n🎉 كل فحوص التوليد التلقائي نجحت' : `\n⚠️ ${failures} فحص فشل`)
process.exit(failures === 0 ? 0 : 1)
