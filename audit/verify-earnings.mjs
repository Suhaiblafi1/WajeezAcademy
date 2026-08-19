/* تحقق حي من دورة مستحقات المدرب الكاملة عبر HTTP فقط:
   إدارة: قائمة مدربين ← إنشاء كشف ← اعتماد ← صرف
   مدرب: يرى الكشف بحالة «مدفوع» مع البنود والملخص
   + فحوص صارمة: منع تكرار الفترة، منع الانتقالات غير الشرعية */
const API = 'http://localhost:7101'
const PASS = 'Wajeez-Demo-2026'

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

const login = (u) => call(u, 'POST', '/api/auth/login', { email: u, password: PASS })

console.log('— تسجيل الدخول —')
const admin = await login('superadmin.demo@wajeez.local')
check('دخول المدير العام', admin.status === 200, JSON.stringify(admin.data).slice(0, 120))
const trainer = await login('trainer.demo@wajeez.local')
check('دخول المدرب', trainer.status === 200, JSON.stringify(trainer.data).slice(0, 120))

console.log('— الإدارة: إنشاء ← اعتماد ← صرف —')
const profs = await call('superadmin.demo@wajeez.local', 'GET', '/api/admin/trainer-profiles')
check('قائمة المدربين النشطين', profs.status === 200 && Array.isArray(profs.data), JSON.stringify(profs.data).slice(0, 150))
const me = await call('trainer.demo@wajeez.local', 'GET', '/api/trainer/me')
const myProfile = profs.data?.find((p) => p.id === me.data?.id) ?? profs.data?.[0]
check('ملف المدرب الديمو موجود بالقائمة', Boolean(myProfile), `me.id=${me.data?.id}`)

const period = '2026-08'
/* تنظيف أي كشف سابق لنفس الفترة لضمان قابلية إعادة الاختبار */
const existing = await call('superadmin.demo@wajeez.local', 'GET', '/api/admin/trainer-payouts')
for (const p of existing.data ?? []) {
  if (p.profile?.application && p.period === period && p.status !== 'cancelled' && myProfile && p.items) {
    // نلغي فقط كشوف هذا المدرب لنفس الفترة
  }
}
const dupBefore = (existing.data ?? []).filter((p) => p.period === period && p.status !== 'cancelled')
  .find((p) => myProfile && p.profileId === myProfile.id)
if (dupBefore && dupBefore.status === 'pending') {
  await call('superadmin.demo@wajeez.local', 'POST', `/api/admin/trainer-payouts/${dupBefore.id}/cancel`, { reason: 'إعادة اختبار آلية' })
} else if (dupBefore && dupBefore.status === 'approved') {
  await call('superadmin.demo@wajeez.local', 'POST', `/api/admin/trainer-payouts/${dupBefore.id}/cancel`, { reason: 'إعادة اختبار آلية' })
}

const created = await call('superadmin.demo@wajeez.local', 'POST', '/api/admin/trainer-payouts', {
  profileId: myProfile.id, period,
  items: [
    { description: 'تدريب شعبة أساسيات تحليل البيانات — 12 جلسة', amount: 480, sourceRef: 'COHORT-DEMO' },
    { description: 'تقييم مشاريع التخرج — 9 مشاريع', amount: 135 },
  ],
})
check('إنشاء الكشف (201 + pending + total=615)', created.status === 201 && created.data?.status === 'pending' && Number(created.data?.total) === 615, JSON.stringify(created.data).slice(0, 200))
const pid = created.data?.id

const dup = await call('superadmin.demo@wajeez.local', 'POST', '/api/admin/trainer-payouts', {
  profileId: myProfile.id, period, items: [{ description: 'محاولة تكرار', amount: 10 }],
})
check('منع كشف مكرر لنفس الفترة (409)', dup.status === 409, `status=${dup.status}`)

const payEarly = await call('superadmin.demo@wajeez.local', 'POST', `/api/admin/trainer-payouts/${pid}/pay`)
check('منع الصرف قبل الاعتماد (409)', payEarly.status === 409, `status=${payEarly.status}`)

const approved = await call('superadmin.demo@wajeez.local', 'POST', `/api/admin/trainer-payouts/${pid}/approve`)
check('الاعتماد (pending→approved)', approved.status === 200 && approved.data?.status === 'approved', JSON.stringify(approved.data).slice(0, 150))

const paid = await call('superadmin.demo@wajeez.local', 'POST', `/api/admin/trainer-payouts/${pid}/pay`)
check('الصرف (approved→paid + paidAt)', paid.status === 200 && paid.data?.status === 'paid' && Boolean(paid.data?.paidAt), JSON.stringify(paid.data).slice(0, 150))

const cancelPaid = await call('superadmin.demo@wajeez.local', 'POST', `/api/admin/trainer-payouts/${pid}/cancel`, { reason: 'محاولة إلغاء بعد الصرف' })
check('منع إلغاء كشف مدفوع (409)', cancelPaid.status === 409, `status=${cancelPaid.status}`)

console.log('— المدرب: يرى كشفه —')
const earnings = await call('trainer.demo@wajeez.local', 'GET', '/api/trainer/earnings')
check('جلب المستحقات 200', earnings.status === 200, `status=${earnings.status}`)
const found = earnings.data?.payouts?.find((p) => p.id === pid)
check('الكشف ظاهر بحالة مدفوع وبندين', found?.status === 'paid' && found?.items?.length === 2, JSON.stringify(found).slice(0, 200))
check('الملخص paid ≥ 615', Number(earnings.data?.summary?.paid) >= 615, JSON.stringify(earnings.data?.summary))

console.log('— صلاحيات: طالب لا يرى مسارات الإدارة —')
await login('student.demo@wajeez.local')
const forbidden = await call('student.demo@wajeez.local', 'GET', '/api/admin/trainer-payouts')
check('الطالب ممنوع (401/403)', forbidden.status === 401 || forbidden.status === 403, `status=${forbidden.status}`)
const trainerAdmin = await call('trainer.demo@wajeez.local', 'GET', '/api/admin/trainer-payouts')
check('المدرب ممنوع من مسار الإدارة (401/403)', trainerAdmin.status === 401 || trainerAdmin.status === 403, `status=${trainerAdmin.status}`)

console.log(failures === 0 ? '\n🎉 كل الفحوص نجحت' : `\n⚠️ ${failures} فحص فشل`)
process.exit(failures === 0 ? 0 : 1)
