/* عاملُ الخدمة — «Safari can't open the page» لا يعود شاشةَ خطأ.

   الشكوى: الموقع لا يفتح في سفاري، ويفتح في كروم على الجهاز نفسِه. والصورةُ
   حسمت موضعَ العلّة: نصُّ سفاري «‏the server unexpectedly dropped the
   connection‏»، ووحدةُ التحكّم فارغةٌ تماما — لا خطأ واحد. أي أنّ الاتصال
   انقطع قبل أن يصل بايتٌ واحد، فلم يُنفَّذ سطرٌ من شيفرتنا. وطلبُ الجذر
   أصلا لا يمرّ بخادمنا: يُعاد كتابتُه إلى ملفٍّ ساكن يخدمه المضيف — وكان
   ذلك `vercel.json` وشبكةَ توزيع Vercel (‏x-vercel-cache: HIT‏)، وصار
   `deploy/Caddyfile` على خادمنا. والعلّةُ والعلاجُ لا يتغيّران بتغيّره.

   وفُحص الخادمُ من هنا فإذا هو سليم: خمسون طلبا متتاليا كلُّها ٢٠٠، والحزمُ
   تُنقل كاملةً ببايتاتها نفسِها في كلّ مرّة. فلا عطبَ يُصلَح في المصدر.

   ولأنّ السببَ خارج المستودَع — مسارُ شبكةٍ أو حافةٌ تُسقط الاتصال — فالذي
   يُملَك إصلاحُه هو **الأثر**: أن يكون انقطاعُ الاتصال شاشةَ خطأٍ أو موقعا
   يفتح. وهذا ما يفعله هذا الملفّ: نسخةٌ من قوقعة التطبيق تُحفَظ عند كلّ
   زيارةٍ ناجحة، فإن سقط الطلبُ التالي خُدِّمت من المحفوظ.

   ── والقاعدةُ التي تمنعه أن يصير عطبا في نفسه: الشبكةُ أولا دائما ──

   خطرُ عاملِ الخدمة المعروف أن يخدّم قديما وهو يظنّ أنّه يُسعف — وهذه المنصّة
   قاتلت هذا الوجعَ مرّةً (شبكةُ أمان الحزمة المحذوفة في `index.html`). فلا
   يُقرأ المحفوظُ هنا إلّا حين **ترفض الشبكةُ رفضا** — أي انقطاعٌ لا استجابة.
   وردُّ ٤٠٤ على قطعةٍ حُذفت بعد نشرٍ جديد استجابةٌ لا رفض، فيمرّ كما هو إلى
   شبكة الأمان تلك فتُعيد التحميل كعادتها. فما دامت الشبكةُ تعمل فالمستخدم
   يرى الأحدثَ دائما، حرفا بحرف.

   ومفتاحُ الإطفاء: `DISABLED = true` ثمّ نشرة — يُلغي العاملُ تسجيلَ نفسِه
   ويمحو ما خزّن، فيعود الموقعُ إلى ما كان بلا انتظار انتهاء صلاحية. */

const CACHE = 'wajeez-shell-v1'
const SHELL = '/index.html'
const DISABLED = false

/* الإطفاء: عاملٌ يُنهي نفسَه. يُنشَر مرّةً فينظّف أثرَه من كلّ متصفّح زاره */
if (DISABLED) {
  self.addEventListener('install', () => self.skipWaiting())
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        for (const key of await caches.keys()) await caches.delete(key)
        await self.registration.unregister()
      })(),
    )
  })
} else {
  self.addEventListener('install', () => self.skipWaiting())

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        /* نسخُ التخزين القديمة تُمحى — الاسم يحمل رقمَه فلا تتراكم */
        for (const key of await caches.keys()) {
          if (key !== CACHE) await caches.delete(key)
        }
        await self.clients.claim()
      })(),
    )
  })

  /** أصولُنا المبنيّة وحدها تُخزَّن — لا نداءات API ولا مصادر خارجية */
  const isOurAsset = (url) => url.origin === self.location.origin && url.pathname.startsWith('/assets/')

  /* الشبكةُ أولا، والمحفوظُ عند الانقطاع وحده.

     `fetch` لا يرفض إلّا حين يسقط الاتصالُ فعلا (انقطاع، إعادةُ ضبط، تعذّرُ
     وصول). وكلُّ استجابةٍ — حتى ٤٠٤ و٥٠٠ — تمرّ كما هي، فلا نُخفي عن التطبيق
     خبرا صحيحا. */
  const networkFirst = async (request, cacheKey) => {
    try {
      const response = await fetch(request)
      /* لا يُخزَّن إلّا ما نجح فعلا وجاء من أصلنا — لا ٤٠٤ ولا ردٌّ مُعتِم */
      if (response.ok && response.type === 'basic') {
        const copy = response.clone()
        const cache = await caches.open(CACHE)
        await cache.put(cacheKey, copy)
      }
      return response
    } catch (err) {
      const cached = await caches.match(cacheKey)
      if (cached) return cached
      throw err                            // لا محفوظَ: يبقى الخطأُ خطأ
    }
  }

  self.addEventListener('fetch', (event) => {
    const { request } = event

    if (request.method !== 'GET') return
    if (request.headers.has('range')) return         // طلبُ مدى: يُترك للمتصفّح
    const url = new URL(request.url)
    if (url.origin !== self.location.origin) return  // خطوطٌ وصورٌ خارجية
    if (url.pathname.startsWith('/api/')) return     // بياناتٌ حيّة لا تُخزَّن أبدا

    /* التنقّلُ كلُّه يرثُ قوقعةً واحدة: التطبيقُ صفحةٌ واحدة، و`.htaccess`
       يعيد كتابة كلّ مسارٍ إلى `index.html` — فمفتاحٌ واحد يكفي كلَّ المسارات */
    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request, SHELL))
      return
    }

    if (isOurAsset(url)) {
      event.respondWith(networkFirst(request, request))
    }
  })
}
