/* Caddy يُمسك الطلبَ ما دام التطبيقُ يُبدَّل — لا 502 في ثواني النشر (٢٧ أكتوبر ٢٠٢٦).

   ── العطب ──

   كلُّ نشرٍ يُعيد إنشاءَ حاوية التطبيق (`deploy/deploy.sh` ← `up -d`)، وفي تلك الثواني لا يجيب أحدٌ على 7101.
   فكان Caddy يردّ 502 فورا. وقيس في نشر ١٧:٢٣ (UTC) يومَها بطلبٍ كلَّ ثانية:

     17:23:14 api=502 · 17:23:19 api=000 · 17:23:21 api=502 · 17:23:24 api=200

   أي نحوُ عشر ثوانٍ. ومن ضغط «ادفع» فيها رأى «تعذّر إتمام الشراء — أعد المحاولة» (بلاغُ صاحب المنصّة بصورته).
   والنشرُ تلقائيٌّ بعد كلّ دمج، فيقع مرارا في اليوم.

   ── ما يُحرس ──

   كلُّ تمريرٍ إلى التطبيق في الكتلة الخادمة ينتظره (`lb_try_duration`) ضعفَ ما قيس على الأقلّ، ويعيد المحاولةَ
   بفاصلٍ قصير. ولا يوسَّع ما يُعاد بعد أن وصل الطلبُ التطبيق (`lb_retry_match`): الإعادةُ حيث تعذّر الاتّصالُ
   وحدَه، فلا يُرسَل دفعٌ مرّتين.

   والفحصُ على الأسطر المنفَّذة لا التعليقات — فشرحٌ يذكر `lb_try_duration` لا يُخضرّه. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CADDY = readFileSync(join(__dirname, '..', '..', '..', 'deploy', 'Caddyfile'), 'utf8')
/** ما قيس من ثواني 502 في نشرٍ واحد */
const MEASURED_GAP_S = 10

/** أسطرٌ تُنفَّذ وحدَها — لا تعليقٌ يشرح ولا فراغ */
const executable = (text: string) =>
  text.split('\n').map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#'))

/** متنُ كلِّ `reverse_proxy app:…` — كتلتُه إن كانت له، وإلّا فارغ */
function proxies(text: string): { handle: string; body: string[] }[] {
  const lines = executable(text)
  const out: { handle: string; body: string[] }[] = []
  let handle = ''
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('handle')) handle = lines[i]
    if (!lines[i].startsWith('reverse_proxy app:')) continue
    const body: string[] = []
    if (lines[i].endsWith('{')) {
      for (let j = i + 1, depth = 1; j < lines.length && depth > 0; j++) {
        if (lines[j].endsWith('{')) depth++
        if (lines[j] === '}') { depth--; continue }
        body.push(lines[j])
      }
    }
    out.push({ handle, body })
  }
  return out
}

const seconds = (v: string) => {
  const m = v.match(/^(\d+)(ms|s|m)$/)
  if (!m) return NaN
  return Number(m[1]) / (m[2] === 'ms' ? 1000 : 1) * (m[2] === 'm' ? 60 : 1)
}

describe('Caddy ينتظر التطبيق حين يُبدَّل — فلا يرى المشتري «تعذّر إتمام الشراء» في ثواني النشر', () => {
  const all = proxies(CADDY)
  /* `/docs*` بابُ توثيقٍ مغلقٌ على الإنتاج — لا يمرّ به مشترٍ */
  const serving = all.filter((p) => !p.handle.startsWith('handle /docs'))

  it('⚠️ واجهةُ البرمجة بين ما يُفحص — فلا يخضرّ الحارسُ لأنّه لم يجد شيئا', () => {
    expect(serving.some((p) => p.handle === 'handle /api/* {'), 'لم تُقرأ كتلة /api').toBe(true)
    expect(serving.length).toBeGreaterThanOrEqual(3)
  })

  it('⚠️ كلُّ تمريرٍ إلى التطبيق ينتظره ضعفَ ما قيس على الأقلّ، ويعيد المحاولة بفاصلٍ قصير', () => {
    for (const p of serving) {
      const dur = p.body.find((l) => l.startsWith('lb_try_duration '))
      expect(dur, `${p.handle} لا ينتظر التطبيق — 502 في ثواني النشر`).toBeDefined()
      expect(seconds(dur!.split(/\s+/)[1]), `${p.handle}: ${dur}`).toBeGreaterThanOrEqual(2 * MEASURED_GAP_S)
      const every = p.body.find((l) => l.startsWith('lb_try_interval '))
      expect(every, `${p.handle} بلا فاصل محاولة`).toBeDefined()
      expect(seconds(every!.split(/\s+/)[1]), `${p.handle}: ${every}`).toBeLessThanOrEqual(1)
    }
  })

  it('⚠️ ولا يُعاد ما وصل التطبيقَ — فلا يُرسَل دفعٌ مرّتين', () => {
    for (const p of serving) {
      expect(p.body.filter((l) => l.startsWith('lb_retry_match')), `${p.handle} وسّع ما يُعاد`).toEqual([])
    }
  })
})
