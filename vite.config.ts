import path from "path"
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

function withApi(): Plugin {
  let api: ChildProcess | null = null
  return {
    name: "wajeez-api-dev",
    configureServer() {
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
  plugins: [inspectAttr(), react(), withApi()],
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
