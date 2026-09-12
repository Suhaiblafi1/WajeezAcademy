/* تسجيلُ اشتراك Calendly مرّةً واحدة — الخطوةُ التي لا يفعلها النشر.

   ═══ لماذا سكربتٌ أصلا ═══

   شيفرةُ المزامنة كاملةٌ في المستودَع (`/api/webhooks/calendly`)، لكنّها لا
   تسمع شيئا حتّى يوجد **اشتراكٌ عند Calendly** يوجّه الأحداثَ إليها. ولا
   تُنشئ لوحةُ Calendly هذا الاشتراكَ بالضغط: يُنشأ بنداءٍ إلى واجهتها
   البرمجيّة وحدَها. فبقيت خطوةٌ يدويّةٌ مكتوبةٌ في دليل النشر ينسخها المشغّلُ
   بيده — ونسخُ نداءٍ فيه سرّان مطبعةُ أخطاء.

   ═══ والمعاينةُ هي الافتراضيّ ═══

   الاشتراكُ يُنشأ على النطاق الحيّ ويُطلق أحداثا حقيقيّة، فلا يُنشأ إلّا
   بـ`--apply` صريحة — كما في `align-cohort-prices`. وقبلها يُطبع ما سيقع
   بالضبط.

   ═══ ولا يُنشأ ثانٍ فوق أوّل ═══

   الاشتراكاتُ تُقرأ أوّلا: إن وُجد واحدٌ على عنواننا طُبع حالُه وخرج
   السكربتُ راضيا. فإعادةُ التشغيل بعد نشرٍ أو شكٍّ آمنةٌ ولا تُضاعف الأحداث.

   ═══ ولا يُطبع سرّ ═══

   الرمزُ الشخصيُّ ومفتاحُ التوقيع يُقرآن من البيئة ولا يظهران في المخرَج —
   وهذا سجلٌّ يُنسخ في محادثةٍ أو تذكرةٍ بعد دقيقة.

   الاستعمال:
     CALENDLY_PAT=… CALENDLY_WEBHOOK_SIGNING_KEY=… APP_URL=… \
       npm run calendly:webhook            # معاينة
     … npm run calendly:webhook -- --apply  # إنشاء
*/

const APPLY = process.argv.includes('--apply')
const API = 'https://api.calendly.com'
const EVENTS = ['invitee.created', 'invitee.canceled'] as const

/** `--url=https://…` يسبق `APP_URL` — للتجربة على نطاقٍ غيرِ الإنتاج */
function argUrl(): string | null {
  const arg = process.argv.find((a) => a.startsWith('--url='))
  return arg ? arg.slice('--url='.length) : null
}

function fail(message: string): never {
  console.error(`⛔ ${message}`)
  process.exit(1)
}

/** عنوانُ المستقبِل — بلا شرطةٍ مكرّرة، وبـhttps وحدَها (Calendly يرفض غيرها) */
function callbackUrl(): string {
  const base = (argUrl() ?? process.env.APP_URL ?? '').trim().replace(/\/+$/, '')
  if (!base) fail('لا APP_URL ولا ‎--url=‎ — لا يُعرف أين تصل الأحداث.')
  if (!base.startsWith('https://')) fail(`العنوانُ يجب أن يكون https — جاء «${base}».`)
  return `${base}/api/webhooks/calendly`
}

interface CalendlyUser {
  resource?: { uri?: string; name?: string; email?: string; current_organization?: string }
}

interface Subscription {
  uri?: string
  callback_url?: string
  state?: string
  events?: string[]
  created_at?: string
}

async function call<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) {
    /* رسالةُ Calendly تُطبع كما جاءت — لا الرمزُ الذي أرسلناه */
    fail(`ردّ Calendly ${res.status} على ${path}:\n${text.slice(0, 800)}`)
  }
  return (text ? JSON.parse(text) : {}) as T
}

const main = async () => {
  const token = process.env.CALENDLY_PAT?.trim()
  if (!token) fail('CALENDLY_PAT غيرُ مضبوط — رمزٌ شخصيٌّ من إعدادات Calendly.')
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY?.trim()
  if (!signingKey) {
    fail('CALENDLY_WEBHOOK_SIGNING_KEY غيرُ مضبوط — وهو نفسُه الذي يقرؤه الخادم.')
  }
  const url = callbackUrl()

  const me = await call<CalendlyUser>('/users/me', token)
  const organization = me.resource?.current_organization
  if (!organization) fail('لم تُعرف المنظّمةُ من ‎/users/me‎ — راجع صلاحيّةَ الرمز.')
  console.log(`الحساب: ${me.resource?.name ?? '—'} <${me.resource?.email ?? '—'}>`)
  console.log(`المنظّمة: ${organization}`)
  console.log(`المستقبِل: ${url}`)
  console.log(`الحدثان: ${EVENTS.join(' · ')}`)

  const existing = await call<{ collection?: Subscription[] }>(
    `/webhook_subscriptions?organization=${encodeURIComponent(organization)}&scope=organization&count=100`,
    token,
  )
  const already = (existing.collection ?? []).find((s) => s.callback_url === url)
  if (already) {
    console.log('\n✔ الاشتراكُ موجودٌ سلفا — لا يُنشأ ثانٍ فوقه.')
    console.log(`  الحالة: ${already.state ?? '—'} · الأحداث: ${(already.events ?? []).join(' · ') || '—'}`)
    console.log(`  أُنشئ: ${already.created_at ?? '—'}`)
    const missing = EVENTS.filter((e) => !(already.events ?? []).includes(e))
    if (missing.length > 0) {
      console.log(`\n⚠️ ينقصه: ${missing.join(' · ')} — احذفه من Calendly وأعد التشغيل بـ--apply.`)
    }
    return
  }

  if (!APPLY) {
    console.log('\n· معاينة: لا اشتراكَ على هذا العنوان، ولم يُنشأ شيء.')
    console.log('  للإنشاء فعلا: npm run calendly:webhook -- --apply')
    return
  }

  const created = await call<{ resource?: Subscription }>('/webhook_subscriptions', token, {
    method: 'POST',
    body: JSON.stringify({
      url,
      events: [...EVENTS],
      organization,
      scope: 'organization',
      signing_key: signingKey,
    }),
  })
  console.log('\n✔ أُنشئ الاشتراك.')
  console.log(`  ${created.resource?.uri ?? '—'} · الحالة: ${created.resource?.state ?? '—'}`)
  console.log('  جرّب حجزا حقيقيّا: يظهر الموعدُ في صفحة حالة المتقدّم، ويعيده الإلغاءُ إلى زرّ الحجز.')
}

await main()
