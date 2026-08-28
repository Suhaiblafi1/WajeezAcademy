# تشغيل `webapp-testing` في هذا المستودع

الملحق يخصّ البيئة لا المنهج. مبدأ المهارة الأصلية سليم — استطلاعٌ ثم فعل،
والانتظار للشرط لا للوقت — لكن تشغيلها المكتوب ببايثون لا يعمل هنا:

```
$ python3 -c "from playwright.sync_api import sync_playwright"
ModuleNotFoundError: No module named 'playwright'
```

المثبَّت `playwright-core` على Node، ومتصفّحه مثبَّت المسار في
`/opt/pw-browsers/`. فاتّباع الأصل حرفا يكتب سكربتا لا يُقلع.

## الشكل الصحيح هنا

```js
const { chromium } = require('playwright-core')
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],            // لازم: لا حاوية مميّزة
})
const p = await b.newPage({ viewport: { width: 1280, height: 1000 } })
await p.goto('http://localhost:3000/…', { waitUntil: 'networkidle' })
```

`executablePath` و`--no-sandbox` ليسا تفصيلا: بدونهما لا يُقلع المتصفّح أصلا.

## الخادم

لا حاجة إلى `with_server.py`: `npm run dev` يشغّل Vite على 3000 **ويقلع معه
خادم API على 7101 تلقائيا** (إضافة `wajeez-api-dev` في `vite.config.ts`).
فالانتظار يكون على الخادم لا على مهلة:

```bash
until curl -sf -o /dev/null http://localhost:3000/; do sleep 1; done
```

## أين يوضع سكربت الفحص

**داخل جذر المستودع** — لا في `/tmp`: يحتاج `playwright-core` من
`node_modules`. ويُحذف بعد الفحص فورا؛ ملفُّ فحصٍ منسيٌّ يصل إلى الالتزام.

## المتصفّح لا يبلغ الإنترنت

هذا المتصفّح لا يصل إلى شبكة عامة. فحصُ الموقع المنشور يكون بـ`curl` عبر
الوسيط، لا بفتح الصفحة في Playwright.

## ما يبقى من الأصل كما هو

- `waitUntil: 'networkidle'` قبل أي فحص للـDOM — أهمّ قاعدة فيها.
- الاستطلاع أولا: لقطة أو قراءة DOM لاكتشاف المحدِّدات، ثم الفعل بها.
- المحدِّدات الواصفة (`text=`, `role=`, معرّف) لا المواضع.
- إغلاق المتصفّح دائما.
