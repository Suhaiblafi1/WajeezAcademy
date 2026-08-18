/* تشغيل بيئة التطوير كاملة بأمر واحد:
   خادم API (Fastify + PostgreSQL المدمج على 7101/5433) ثم واجهة Vite.
   يمرّر أي وسائط إضافية (مثل --port/--host) إلى Vite،
   ويقتل العمليتين معا عند الإيقاف (Ctrl+C أو SIGTERM). */

import { spawn } from 'node:child_process'

const extraArgs = process.argv.slice(2)
const children = []
let shuttingDown = false

function run(name, command, args) {
  const child = spawn(command, args, { stdio: 'inherit', env: process.env })
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`\n[dev-all] ${name} توقف (code ${code}) — إيقاف الباقي`)
      shutdown(code ?? 0)
    }
  })
  children.push(child)
  return child
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const c of children) {
    try { c.kill('SIGTERM') } catch { /* already dead */ }
  }
  setTimeout(() => process.exit(code), 800)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

// 1) خادم API — يشغّل قاعدة PostgreSQL المدمجة تلقائيا عند غياب DATABASE_URL
run('API', 'npx', ['tsx', 'server/index.ts'])

// 2) واجهة Vite — بروكسي /api إلى 7101 مضبوط في vite.config.ts
run('Vite', 'npx', ['vite', ...extraArgs])
