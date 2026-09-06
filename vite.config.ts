import path from "path"
import { existsSync, readFileSync, writeFileSync } from "fs"
import { spawn, execSync, type ChildProcess } from "child_process"
import { createConnection } from "net"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

/* تشغيل خادم API تلقائيا مع خادم التطوير — أيًا كان من يشغّل vite
   (npm run dev أو مشغّل المعاينة) يعمل الخادمان معا دائما.
   يتخطى الإقلاع إن كان API يعمل أصلا على 7101، ويقتل العملية عند إيقاف vite. */
function portAlive(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createConnection({ port, host: "127.0.0.1" })
    s.once("connect", () => { s.destroy(); resolve(true) })
    s.once("error", () => resolve(false))
    s.setTimeout(1200, () => { s.destroy(); resolve(false) })
  })
}

/** API حي وقاعدته تعمل؟ — المنفذ وحده لا يكفي: قد يكون يتيمًا ماتت قاعدته */
async function apiHealthy(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:7101/api/health", { signal: AbortSignal.timeout(2500) })
    return res.ok
  } catch {
    return false
  }
}

/** يقتل من يستمع على 7101 — يتيم قديم فقط، بيئة محلية حصرا */
function killStaleApi(): void {
  try {
    execSync("lsof -tiTCP:7101 -sTCP:LISTEN | xargs kill 2>/dev/null || true")
  } catch { /* لا مستمع أصلا */ }
}

/* حقن الأصل القانوني في index.html وقت البناء.

   الوسوم الساكنة (canonical وog:url وog:image وJSON-LD) هي ما تقرؤه بوتات
   المعاينة وزاحف الفهرسة — لا تشغّل React فلا يبلغها SeoHead. وكانت تعلن
   النطاق النهائي دائما، والموقع في فترة تجريبية على نطاق آخر: canonical إلى
   عنوان لا يستجيب، ومعاينةُ رابطٍ يُشارَك تفشل.

   الترتيب: VITE_SITE_ORIGIN إن ضُبط، ثم النطاق الحيّ. ولا يُترك
   %VITE_SITE_ORIGIN% حرفيا في أي حال — وسمٌ نصفُ مستبدَل أسوأ من نطاق خاطئ.

   وكان بينهما ثالثٌ: `VERCEL_PROJECT_PRODUCTION_URL` يحقنه البناءُ على
   Vercel. فلمّا انتقلت المنصّةُ عن Vercel لم يعد يُحقَن أبدا — حلقةٌ ميّتةٌ في
   السلسلة توهم القارئ أنّ للنطاق مصدرا ثالثا، فحُذفت. والبديلُ عندنا أن
   يُمرَّر `VITE_SITE_ORIGIN` وسيطَ بناءٍ إلى `Dockerfile` — ولا يُمرَّر اليوم،
   فيقع البناءُ على النطاق الحيّ المكتوب أدناه (`docs/DEPLOYMENT.md` §٣).

   والقيمةُ مكرّرةٌ هنا عمدا: هذا الملفّ يعمل في Node قبل أن تُترجَم شيفرةُ
   التطبيق، فلا يستورد من `src/`. ولذلك يحرس `src/tests/site-origin.test.ts`
   تطابقَها مع `CANONICAL_ORIGIN` هناك — فقد افترقتا فعلا يوم انتقل الموقع
   إلى نطاقه الحيّ، وبقي البناءُ يطبع النطاقَ القديم في كلّ وسمٍ ساكن. */
const CANONICAL_ORIGIN = "https://www.wajeezacademy.com"
function siteOriginHtml(): Plugin {
  const origin = (
    process.env.VITE_SITE_ORIGIN ||
    CANONICAL_ORIGIN
  ).replace(/\/+$/, "")
  if (!/^https?:\/\/[^/\s]+$/.test(origin)) {
    throw new Error(`VITE_SITE_ORIGIN غير صالح: «${origin}» — يُتوقع أصل مطلق بلا مسار، مثل https://www.wajeezacademy.com`)
  }
  return {
    name: "wajeez-site-origin",
    /* order: "pre" لازم لا تجميل. فيت نفسه يستبدل %VITE_*% في index.html من
       البيئة بقيمتها الخام، فلو سبقنا لَورثت الوسومُ الشرطةَ المائلة الزائدة
       («…com//»). السبق هنا يجعل التطبيع نافذا في الحالتين: بمتغيّر وبدونه. */
    transformIndexHtml: {
      order: "pre",
      handler(html: string) {
        return html.replaceAll("%VITE_SITE_ORIGIN%", origin)
      },
    },
    /* sitemap.xml وrobots.txt يُنسخان من public/ كما هما — لا يمرّان بالتحويل.
       فيُعاد كتابتهما بعد النسخ. ولو فُقد أحدهما فالبناء يسقط: خريطةٌ فيها
       %VITE_SITE_ORIGIN% حرفيا تُقدَّم لمحرك البحث فتُرفض كلها. */
    closeBundle() {
      const out = path.resolve(__dirname, "dist")
      for (const name of ["sitemap.xml", "robots.txt"]) {
        const file = path.join(out, name)
        if (!existsSync(file)) throw new Error(`dist/${name} مفقود — لا يمكن حقن الأصل القانوني فيه`)
        writeFileSync(file, readFileSync(file, "utf8").replaceAll("%VITE_SITE_ORIGIN%", origin))
      }
    },
  }
}

function withApi(): Plugin {
  let api: ChildProcess | null = null
  return {
    name: "wajeez-api-dev",
    /* خادم التطوير وحده — لا تحت الاختبار.

       Vitest ينشئ خادم Vite داخليا، فيُستدعى `configureServer` عند كل تشغيل
       اختبارات، فيُشعل هذا الملحق خادم API على قاعدة `wajeez` المدمجة. وتلك
       القاعدة لا تُهاجَر في CI (المهاجَرة هي `wajeez_test` وحدها)، فيسقط
       الخادم بـ«الجدول public.Permission غير موجود» ويُنهي العملية برمز 1 —
       فتحمرّ وظيفة «اختبارات الخادم بقاعدة حقيقية» بينما كلّ اختبار فيها ناجح.

       وسقوطه سباقٌ لا حتمية: التزام e173905 نفسه نجح على main وسقط على الفرع.
       ومحلّيا كان يزاحم الاختبارات على PostgreSQL المدمج فتسقط ملفات بـ«the
       database system is shutting down». */
    configureServer() {
      if (process.env.VITEST) return
      void (async () => {
        if (await apiHealthy()) return // API سليم من نافذة أخرى — نستخدمه
        if (await portAlive(7101)) {
          console.warn("[wajeez-api] منفذ 7101 مشغول بعملية غير سليمة — تُنهى ويُعاد الإقلاع")
          killStaleApi()
          await new Promise((r) => setTimeout(r, 1500))
        }
        api = spawn("npx", ["tsx", "server/index.ts"], {
          stdio: "inherit",
          env: {
            DEMO_MODE: "true", // عرض محلي فقط — لا قيمة له في بناء الإنتاج
            SESSION_SECRET: "local-dev-only-9f2b7c41d8e3a6f5b0c9d2e7a4f1b8c5",
            NODE_ENV: "development",
            ...process.env,
          },
        })
        api.on("exit", (code) => {
          if (code !== 0 && code !== null) console.error(`[wajeez-api] توقف بخطأ (${code})`)
          api = null
        })
        const stop = () => { api?.kill("SIGTERM") }
        process.on("exit", stop)
        process.on("SIGINT", stop)
        process.on("SIGTERM", stop)
      })()
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [inspectAttr(), react(), siteOriginHtml(), withApi()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:7101",
        changeOrigin: true,
      },
    },
  },
  test: {
    /* البند ع-١: الكتالوج المضمن كسول في الإنتاج — تثبّته الاختبارات صراحة */
    setupFiles: ['./src/tests/setup-catalog.ts'],
    /* البند ب-٣: خطافات اختبارات الخادم تُسقط قاعدة الاختبار وتنشر الترحيلات
       وتبذر الصلاحيات وتستورد الكتالوج كاملا — وهذا أطول من مهلة الخطاف
       الافتراضية (١٠ ثوان). كان ملفان يفشلان بالمهلة لا بالمنطق، وفشلٌ زائف
       في CI أسوأ من لا CI. مهلة جسم الاختبار تبقى على الافتراضي (٥ ثوان) فلا
       يتوارى اختبارٌ معلَّق دقيقتين. */
    hookTimeout: 180_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        /* فصل نواة React في حزمة مستقلة — تُخزَّن مؤقتا طويلا في المتصفح
           وتُحمَّل بالتوازي، فيخف زمن أول ظهور للصفحة */
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router"],
        },
      },
    },
  },
});
