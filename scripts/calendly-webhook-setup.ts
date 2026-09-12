/* تسجيلُ اشتراك Calendly من سطر الأوامر — والبابُ الأوّلُ شاشةُ التكاملات.

   ═══ متى يُستعمل هذا ═══

   الطريقُ المعتاد `/admin/integrations` ← بطاقةُ Calendly ← «سجّل الاشتراك»:
   لا SSH ولا سطرَ أوامرَ ولا إعادةَ نشر. وهذا السكربتُ لمن لا شاشةَ أمامه —
   تركيبٌ أوّلٌ قبل أن يوجد حسابُ مديرٍ مثلا، أو تشخيصٌ من الخادم.

   ═══ والمنطقُ ليس هنا ═══

   نداءاتُ Calendly في `server/services/calendly-api.service.ts` يقرؤها هذا
   والشاشةُ معا — فلا نسختان تفترقان عند أوّل تعديل.

   ═══ ولا يُطبع سرّ ═══

   الرمزُ الشخصيُّ ومفتاحُ التوقيع يُقرآن من البيئة ولا يظهران في المخرَج —
   وهذا سجلٌّ يُنسخ في محادثةٍ أو تذكرةٍ بعد دقيقة.

   الاستعمال:
     CALENDLY_PAT=… CALENDLY_WEBHOOK_SIGNING_KEY=… APP_URL=… \
       npm run calendly:webhook            # معاينة
     … npm run calendly:webhook -- --apply  # إنشاء
*/

import { CalendlyApiError, registerCalendlyWebhook } from '../server/services/calendly-api.service'

const APPLY = process.argv.includes('--apply')

/** `--url=https://…` يسبق `APP_URL` — للتجربة على نطاقٍ غيرِ الإنتاج */
function argUrl(): string | null {
  const arg = process.argv.find((a) => a.startsWith('--url='))
  return arg ? arg.slice('--url='.length) : null
}

function fail(message: string): never {
  console.error(`⛔ ${message}`)
  process.exit(1)
}

const main = async () => {
  const token = process.env.CALENDLY_PAT?.trim()
  if (!token) fail('CALENDLY_PAT غيرُ مضبوط — رمزٌ شخصيٌّ من إعدادات Calendly.')
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY?.trim()
  if (!signingKey) {
    fail('CALENDLY_WEBHOOK_SIGNING_KEY غيرُ مضبوط — وهو نفسُه الذي يقرؤه الخادم.')
  }
  const siteUrl = (argUrl() ?? process.env.APP_URL ?? '').trim()
  if (!siteUrl) fail('لا APP_URL ولا ‎--url=‎ — لا يُعرف أين تصل الأحداث.')

  const result = await registerCalendlyWebhook({ token, signingKey, siteUrl, apply: APPLY })

  console.log(`الحساب: ${result.account.name} <${result.account.email}>`)
  console.log(`المنظّمة: ${result.account.organization}`)
  console.log(`المستقبِل: ${result.callbackUrl}`)

  if (result.outcome === 'existing') {
    console.log('\n✔ الاشتراكُ موجودٌ سلفا — لا يُنشأ ثانٍ فوقه.')
    console.log(`  الحالة: ${result.subscription?.state ?? '—'} · الأحداث: ${(result.subscription?.events ?? []).join(' · ') || '—'}`)
    if (result.missingEvents.length > 0) {
      console.log(`\n⚠️ ينقصه: ${result.missingEvents.join(' · ')} — احذفه من Calendly وأعد التشغيل بـ--apply.`)
    }
    return
  }
  if (result.outcome === 'would_create') {
    console.log('\n· معاينة: لا اشتراكَ على هذا العنوان، ولم يُنشأ شيء.')
    console.log('  للإنشاء فعلا: npm run calendly:webhook -- --apply')
    return
  }
  console.log('\n✔ أُنشئ الاشتراك.')
  console.log(`  ${result.subscription?.uri ?? '—'} · الحالة: ${result.subscription?.state ?? '—'}`)
  console.log('  جرّب حجزا حقيقيّا: يظهر الموعدُ في صفحة حالة المتقدّم، ويعيده الإلغاءُ إلى زرّ الحجز.')
}

try {
  await main()
} catch (e) {
  if (e instanceof CalendlyApiError) fail(e.message)
  throw e
}
