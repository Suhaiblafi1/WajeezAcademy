/* السلسلة التشغيلية الكاملة من الصفر — إثبات أن النظام يعمل كنظام داخلي مترابط:
   إنشاء شعبة → تعيين مدرب مؤهل → جلسة → جاهزية مالية → فحص الفتح → فتح
   → طالب يطلب → أدمن يوافق (مقعد+طلب+فاتورة) → دفع → تسجيل نشط → البوابة تُفتح
   + مسار الرفض + فصل الصلاحيات. */
const BASE = 'http://localhost:7101'
const PASS = 'Wajeez-Demo-2026'
const jars = {}

async function login(as, email) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASS }),
  })
  if (!res.ok) throw new Error(`فشل دخول ${as}: ${res.status}`)
  jars[as] = res.headers.get('set-cookie')?.split(';')[0] ?? ''
}
async function call(as, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: { 'content-type': 'application/json', cookie: jars[as] },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data; try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}
const ok = (cond, label, extra = '') => { console.log(`${cond ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`); if (!cond) process.exitCode = 1 }

await login('admin', 'superadmin.demo@wajeez.local')
await login('trainer', 'trainer.demo@wajeez.local')

/* ═══ المرحلة ١: تجهيز شعبة جديدة من الصفر ═══ */
const meT = (await call('trainer', 'GET', '/api/trainer/me')).data
const profileId = meT.profileId ?? meT.profile?.id ?? meT.id
ok(!!profileId, 'ملف المدرب موجود', String(profileId).slice(0, 8))

const cohorts = (await call('admin', 'GET', '/api/admin/cohorts')).data
const source = cohorts.find((c) => c.status === 'active')
const courseId = source.courseId

/* موعد عشوائي بعيد يتفادى تعارض جدول المدرب مع شعب الاختبارات السابقة */
const sessionAt = new Date(Date.now() + (30 + Math.floor(Math.random() * 300)) * 864e5).toISOString()

const created = await call('admin', 'POST', '/api/admin/cohorts', {
  courseId, title: `شعبة اختبار السلسلة ${Date.now() % 100000}`,
  capacity: 15, price: 1200, currency: 'SAR',
  startsAt: sessionAt,
  deliveryMode: 'remote', language: 'ar',
})
ok(created.status === 201, '١) أُنشئت شعبة (مسودة)', created.data?.status)
const cid = created.data?.id

const assign = await call('admin', 'POST', `/api/admin/cohorts/${cid}/trainers`, { profileId, role: 'lead' })
ok(assign.status < 300, '٢) عُيّن المدرب المؤهل قائداً للشعبة', assign.data?.error?.message_ar ?? '')

const sess = await call('admin', 'POST', `/api/admin/cohorts/${cid}/sessions`, {
  title: 'الجلسة الافتتاحية', startsAt: sessionAt,
})
ok(sess.status < 300, '٣) أُضيفت جلسة مجدولة', sess.data?.error?.message_ar ?? '')

const patch = await call('admin', 'PATCH', `/api/admin/cohorts/${cid}`, { financialReady: true, registrationOpen: true })
ok(patch.status < 300, '٤) اكتمل الإعداد المالي وفُتح باب التسجيل', patch.data?.error?.message_ar ?? '')

/* خطة التقديم — ناتجها الطبيعي سلسلة «اقتراح مدرب → اعتماد» (مختبرة وحدها عبر شاشة المقترحات) */
const { execSync } = await import('node:child_process')
execSync(`npx tsx audit/seed-plan.ts ${cid} ${profileId}`, { stdio: 'pipe' })
ok(true, '٤-ب) أُرفقت خطة تقديم للشعبة')

const check = await call('admin', 'GET', `/api/admin/cohorts/${cid}/open-checklist`)
ok(check.data?.ready === true, '٥) فحص شروط الفتح الستة', check.data?.ready ? 'كل الشروط مكتملة' : `نواقص: ${(check.data?.missing ?? []).join('، ')}`)

const openRes = await call('admin', 'POST', `/api/admin/cohorts/${cid}/open`, {})
ok(openRes.status < 300, '٦) فُتحت الشعبة رسمياً', openRes.data?.error?.message_ar ?? '')

/* ═══ المرحلة ٢: رحلة الطالب الكاملة ═══ */
const mk = async (label) => {
  const email = `chain-${label}-${Date.now()}@wajeez.local`
  await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASS, displayName: `طالب ${label}` }) })
  await login(label, email)
}
await mk('s1')

const reqRes = await call('s1', 'POST', '/api/learner/enrollment-requests', { cohortId: cid, note: 'اختبار السلسلة الكاملة' })
ok(reqRes.status === 201, '٧) الطالب طلب التسجيل', `الحالة: ${reqRes.data?.status}`)
const reqId = reqRes.data?.id

const pending = (await call('admin', 'GET', '/api/admin/enrollment-requests?status=pending')).data
ok(pending.some((r) => r.id === reqId), '٨) الطلب وصل لشاشة مراجعة الأدمن')

const appr = await call('admin', 'POST', `/api/admin/enrollment-requests/${reqId}/approve`, {})
ok(appr.status === 201, '٩) الموافقة: حُجز مقعد وأُنشئ طلب وفاتورة', appr.status === 201 ? 'تمت' : JSON.stringify(appr.data).slice(0, 100))

const orders = (await call('s1', 'GET', '/api/learner/orders')).data
const order = orders.find?.((o) => o.invoice?.id === appr.data?.invoice?.id) ?? orders[0]
ok(!!order, '١٠) الفاتورة ظهرت في حساب الطالب')

const pay = await call('s1', 'POST', `/api/learner/orders/${order.id}/pay-test`, { idempotencyKey: `chain-${Date.now()}` })
ok(pay.status < 300, '١١) الدفع نجح (مزود اختباري)', `الحالة: ${pay.data?.status ?? pay.status}`)

const learning = (await call('s1', 'GET', '/api/learner/my-learning')).data
const enrolled = learning.find?.((e) => (e.cohort?.id ?? e.cohortId) === cid)
ok(!!enrolled, '١٢) التسجيل نشط — بوابة الطالب فُتحت تلقائياً بلا تدخل يدوي', enrolled ? `الحالة: ${enrolled.status}` : '')

/* ═══ المرحلة ٣: مسار الرفض ═══ */
await mk('s2')
const req2 = await call('s2', 'POST', '/api/learner/enrollment-requests', { cohortId: cid })
const rej = await call('admin', 'POST', `/api/admin/enrollment-requests/${req2.data?.id}/reject`, { reason: 'اكتملت المقاعد المخصصة لهذه الدفعة — نعتذر منك' })
ok(rej.status < 300 && rej.data?.status === 'rejected', '١٣) الرفض بسبب مفهوم يعمل', `الحالة: ${rej.data?.status}`)

/* ═══ المرحلة ٤: فصل الصلاحيات ═══ */
const forbidden = await call('s1', 'GET', '/api/admin/enrollment-requests')
ok(forbidden.status === 403, '١٤) الطالب ممنوع من شاشات المراجعة الإدارية')
const selfApprove = await call('s1', 'POST', `/api/admin/enrollment-requests/${reqId}/approve`, {})
ok(selfApprove.status === 403, '١٥) لا أحد يوافق على طلبه بنفسه')

console.log('\n══ انتهى اختبار السلسلة الكاملة ═══')
