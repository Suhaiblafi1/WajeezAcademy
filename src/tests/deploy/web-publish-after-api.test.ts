/* الواجهةُ الجديدةُ لا تُنشر قبل أن يجيب خادمُها (٢٠ أكتوبر ٢٠٢٦) — `deploy/docker-entrypoint.sh`.

   «لماذا يجب أن أعمل رفرش كلّ مرّة لتظهر أسماءُ المدرّبين؟» (صاحب المنصّة). وكان من أسبابه أنّ نقطةَ
   الدخول تنسخ الواجهةَ أوّلَ ما تقلع أيُّ حاويةٍ من الصورة — ومنها حاويةُ الهجرة في `deploy.sh` —
   فتصير الصفحاتُ الجديدةُ حيّةً والخادمُ الذي تطلبه لم يقم.

   والحارسُ يشغّل السكربتَ نفسَه لا يقرؤه: مجلّدان مؤقّتان مكانَ `/srv/web` و`/app/dist`، وخادمٌ صغيرٌ
   يجيب `/api/version` أو لا يجيب.

   ١) بلا خادمٍ يجيب لا يُمسّ الحجم — وهذه حالُ الهجرة وكلِّ `compose run`.
   ٢) ومتى أجاب نُشر الجديدُ ومُحي ما ليس منه.
   ٣) والأمرُ الأصليُّ يجري فورا — النشرُ في الخلفية لا يؤخّر إقلاعَ الخادم.

   ورُئي ساقطا: أُعيد النسخُ قبل `exec` بلا انتظار، فسقط ①. وأُسقط مسحُ ما ليس في الإصدار، فسقط ②. */

import { afterEach, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AddressInfo } from 'node:net'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const ENTRY = join(root, 'deploy/docker-entrypoint.sh')

const cleanups: (() => void)[] = []
afterEach(() => { while (cleanups.length) cleanups.pop()!() })

function folders() {
  const base = mkdtempSync(join(tmpdir(), 'web-publish-'))
  cleanups.push(() => rmSync(base, { recursive: true, force: true }))
  const web = join(base, 'web')
  const dist = join(base, 'dist')
  mkdirSync(join(web, 'assets'), { recursive: true })
  mkdirSync(join(dist, 'assets'), { recursive: true })
  writeFileSync(join(web, 'index.html'), 'القديم')
  writeFileSync(join(web, 'assets', 'old-1.js'), 'old')
  writeFileSync(join(web, 'stale.txt'), 'من إصدار سابق')
  writeFileSync(join(dist, 'index.html'), 'الجديد')
  writeFileSync(join(dist, 'assets', 'new-2.js'), 'new')
  return { web, dist }
}

async function api(answers: boolean): Promise<{ port: number; server: Server }> {
  const server = createServer((req, res) => {
    res.statusCode = answers && req.url === '/api/version' ? 200 : 503
    res.end('{}')
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  cleanups.push(() => server.close())
  return { port: (server.address() as AddressInfo).port, server }
}

/* يُنتظر خروجُ العمليّة لا إغلاقُ مخارجها: المنتظِرُ في الخلفية يرث المخرجَ ويبقى بعدها — كما في الحاوية */
function run(env: Record<string, string>, ...cmd: string[]): Promise<{ status: number | null; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn('sh', [ENTRY, ...cmd], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'ignore'] })
    let stdout = ''
    child.stdout.on('data', (d) => { stdout += String(d) })
    child.on('exit', (status) => resolve({ status, stdout }))
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function until(check: () => boolean, ms: number) {
  const end = Date.now() + ms
  while (Date.now() < end) { if (check()) return true; await sleep(100) }
  return check()
}

describe('نشر الواجهة بعد أن يجيب الخادم', () => {
  it('⚠️ ① بلا خادم يجيب لا يمسّ الحجم — كحاوية الهجرة', async () => {
    const { web, dist } = folders()
    const { port } = await api(false)
    const r = await run({ WEB_ROOT: web, WEB_DIST: dist, API_PORT: String(port), WEB_PUBLISH_WAIT: '1' }, 'echo', 'ran')
    expect(r.status).toBe(0)
    await sleep(3_000)
    expect(readFileSync(join(web, 'index.html'), 'utf8'), 'نُشرت الواجهة بلا خادم').toBe('القديم')
    expect(existsSync(join(web, 'assets', 'old-1.js'))).toBe(true)
    expect(existsSync(join(web, 'stale.txt'))).toBe(true)
  }, 20_000)

  it('⚠️ ② ومتى أجاب نُشر الجديد ومُحي ما ليس منه', async () => {
    const { web, dist } = folders()
    const { port } = await api(true)
    await run({ WEB_ROOT: web, WEB_DIST: dist, API_PORT: String(port), WEB_PUBLISH_WAIT: '10' }, 'true')
    const published = await until(() => readFileSync(join(web, 'index.html'), 'utf8') === 'الجديد', 10_000)
    expect(published, 'لم تُنشر الواجهة والخادم يجيب').toBe(true)
    /* والمسحُ بترتيب `find` لا بترتيبٍ معلوم — فيُنتظر الملفّان معا لا أحدُهما ثمّ يُسأل عن الآخر */
    const stale = [join(web, 'stale.txt'), join(web, 'assets', 'old-1.js')]
    expect(await until(() => stale.every((f) => !existsSync(f)), 5_000), 'بقي ملف من إصدار سابق').toBe(true)
    expect(existsSync(join(web, 'assets', 'new-2.js'))).toBe(true)
  }, 20_000)

  it('③ والأمر الأصلي يجري فورا — لا ينتظر النشر', async () => {
    const { web, dist } = folders()
    const { port } = await api(false)
    const started = Date.now()
    const r = await run({ WEB_ROOT: web, WEB_DIST: dist, API_PORT: String(port), WEB_PUBLISH_WAIT: '5' }, 'echo', 'ran')
    expect(r.stdout).toContain('ran')
    expect(Date.now() - started, 'أخّر النشرُ إقلاع الخادم').toBeLessThan(3_000)
  }, 20_000)
})
