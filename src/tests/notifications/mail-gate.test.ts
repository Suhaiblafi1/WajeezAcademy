/* لا بريدَ حقيقيٌّ يخرج من بيئةٍ لم تقل إنّها تُرسل.

   ═══ ما يُحرَس، ولماذا هذه الأربعةُ بعينها ═══

   ① **البيئةُ الصامتةُ لا تُرسل** — وهو جوهرُ البوّابة: الرفضُ افتراضٌ.
   ② **والإنتاجُ يُرسل** — فحارسٌ يُسكت بريدَ الإنتاج أسوأُ من الثغرة التي
      يسدّها. والعلامتان تُقرآن معا لأنّ إحداهما غابت في هذه المنصّة من قبل.
   ③ **والبابُ الصريحُ يفتح** — `MAIL_LIVE=on` وعدٌ مكتوب، فيُختبَر كالبقيّة.
   ④ **وموضعُ البناءِ واحدٌ والبوّابةُ فوقه** — وهذا ما يجعل الثلاثةَ الأولى
      تعني شيئا. فلو بُني عميلُ Resend في موضعٍ ثانٍ لَخرج البريدُ من تحت
      البوّابة وهي مغلقةٌ خضراء. فالفحصُ على **البنية**: كم موضعا يبني
      العميل، وأيُّهما أسبقُ في `sendEmail` — البوّابةُ أم البناء. */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { liveMailAllowed, MAIL_GATE_REFUSAL_AR } from '@/application/notifications/mail-gate'

const MAIL_TS = join(process.cwd(), 'server/services/mail.ts')

function serverSources(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        if (entry !== 'node_modules') walk(full)
      } else if (full.endsWith('.ts')) out.push(full)
    }
  }
  walk(join(process.cwd(), 'server'))
  return out
}

/* جسمُ `sendEmail` وحدَه — لا الملفُّ كلُّه: بوّابةٌ في دالّةٍ أخرى لا تحرس
   هذه، وترتيبُ سطرَين في ملفٍّ لا يعني ترتيبَهما في مسارِ التنفيذ. */
function sendEmailBody(): string {
  const src = readFileSync(MAIL_TS, 'utf-8')
  const start = src.indexOf('export async function sendEmail(')
  expect(start, 'دالّةُ sendEmail — تغيّر اسمُها أو زالت').toBeGreaterThan(-1)
  const end = src.indexOf('\n}', start)
  expect(end, 'نهايةُ جسم sendEmail').toBeGreaterThan(start)
  return src.slice(start, end)
}

describe('بوّابةُ الإرسال الحقيقيّ', () => {
  it('بيئةٌ لم تقل شيئا لا تُرسل', () => {
    expect(liveMailAllowed({})).toBe(false)
    expect(liveMailAllowed({ NODE_ENV: 'development' })).toBe(false)
    expect(liveMailAllowed({ NODE_ENV: 'test' })).toBe(false)
    /* ومفتاحٌ صحيحٌ في القاعدة لا يفتحها — وهو بيتُ القصيد: من استعاد نسخةَ
       الإنتاج على جهازه ورث مفاتيحَها، ولا يُرسل جهازُه شيئا. */
    expect(liveMailAllowed({ RESEND_API_KEY: 're_live_key' })).toBe(false)
  })

  it('الإنتاجُ يُرسل — بأيّ العلامتَين ضُبطت', () => {
    expect(liveMailAllowed({ NODE_ENV: 'production' })).toBe(true)
    expect(liveMailAllowed({ APP_ENV: 'production' })).toBe(true)
  })

  it('MAIL_LIVE=on بابٌ صريحٌ خارج الإنتاج', () => {
    expect(liveMailAllowed({ MAIL_LIVE: 'on', NODE_ENV: 'development' })).toBe(true)
    /* وقيمةٌ أخرى ليست فتحا — `on` وحدَها، فلا يفتحه `off` ولا `false` */
    expect(liveMailAllowed({ MAIL_LIVE: 'off' })).toBe(false)
    expect(liveMailAllowed({ MAIL_LIVE: 'true' })).toBe(false)
  })

  it('عميلُ Resend يُبنى في موضعٍ واحدٍ في الخادم كلِّه', () => {
    const sites = serverSources().filter((f) => /new\s+Resend\s*\(/.test(readFileSync(f, 'utf-8')))
    expect(sites.map((f) => f.replace(process.cwd() + '/', ''))).toEqual(['server/services/mail.ts'])
  })

  it('والبوّابةُ تسبق البناءَ في مسار sendEmail', () => {
    const body = sendEmailBody()
    const gate = body.indexOf('liveMailAllowed(')
    const build = body.search(/new\s+Resend\s*\(/)
    expect(gate, 'sendEmail لا تسأل البوّابةَ أصلا').toBeGreaterThan(-1)
    expect(build, 'sendEmail لا تبني عميلَ Resend').toBeGreaterThan(-1)
    expect(gate).toBeLessThan(build)
    /* وسؤالٌ بلا خروجٍ ليس بوّابة: الرفضُ يخرج من الدالّة بسببه المكتوب */
    expect(body).toMatch(/if\s*\(\s*!\s*liveMailAllowed\(\s*\)\s*\)\s*return[^\n]*MAIL_GATE_REFUSAL_AR/)
  })

  it('ورفضُها نصٌّ عربيٌّ يقول ما يُفعل', () => {
    expect(MAIL_GATE_REFUSAL_AR).toContain('MAIL_LIVE=on')
  })
})
