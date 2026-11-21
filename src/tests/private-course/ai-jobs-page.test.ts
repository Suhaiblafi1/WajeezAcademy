/* ═══ صفحةُ دورة صاحب المنصّة الخاصّة — ما لا يُرى إلّا بقراءة (١٩ نوفمبر ٢٠٢٦) ═══

   ① **الرقمُ بمفتاح الدولة** — قرارُه: «الرقم يجب أن يكون بمفتاح الدولة». والقاعدةُ واحدةٌ تقرؤها الصفحةُ والخادم.
   ② **معاينةُ الرابط** — الرابطُ يُنشر في واتساب، وزاحفُه لا يشغّل جافاسكربت: عنوانُ الدورة وصورتُها لا وجهُ الأكاديميّة.
   ③ **النصُّ بلا تشكيل** — قرارُه (١١ أكتوبر ٢٠٢٦)، والمنشورُ الأصليُّ فيه «مبكراً» و«بُعد».
   ④ **ولا تُعرض المساحةُ الخاصّةُ في شريط الإدارة** — رابطُها لصاحبها وحدَه. */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizePhone } from '@/application/private-course/phone'
import { renderAiJobsPage } from '@/application/private-course/landing-seo'
import { AI_JOBS, AI_JOBS_SEO, seatsLabel, seatsLeft } from '@/application/private-course/ai-jobs'
import { allSections } from '@/pages/admin/nav-map'
import { PUBLIC_PAGES } from '@/application/site/public-pages'
import { markedTexts } from '../helpers/marked-text'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('① الرقم بمفتاح الدولة', () => {
  it('صفر البداية والمسافات تسقط، والمحفوظ بالمفتاح', () => {
    expect(normalizePhone('JO', '079 123 4567')).toMatchObject({ ok: true, e164: '+962791234567' })
  })

  it('ومن لصق رقمه كاملا بمفتاحه أو بـ00 يقبل', () => {
    expect(normalizePhone('AE', '+971 50 123 4567')).toMatchObject({ ok: true, e164: '+971501234567' })
    expect(normalizePhone('AE', '00971501234567')).toMatchObject({ ok: true, e164: '+971501234567' })
  })

  it('والأرقام الهندية تقرأ', () => {
    expect(normalizePhone('KW', '٥١٢٣٤٥٦٧')).toMatchObject({ ok: true, e164: '+96551234567' })
  })

  it('⚠️ ورقم بلد آخر باسم بلده يرد — لا يحفظ رقم سعودي على مفتاح الأردن', () => {
    const r = normalizePhone('JO', '+966512345678')
    expect(r.ok).toBe(false)
  })

  it('⚠️ وطول لا يطابق بلده يرد بمثال', () => {
    const r = normalizePhone('SA', '51234')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('512345678')
  })

  it('وبلد لا نعرف أطواله يقبل بالحد العام', () => {
    expect(normalizePhone('NZ', '211234567')).toMatchObject({ ok: true, e164: '+64211234567' })
  })
})

describe('② معاينة الرابط', () => {
  const template = read('index.html').replace(/%VITE_SITE_ORIGIN%/g, 'https://www.wajeezacademy.com')
  const html = renderAiJobsPage(template, 'https://www.wajeezacademy.com')

  it('عنوان الدورة وصورة منشورها — بلا ذيل اسم الأكاديمية', () => {
    expect(html).toContain(`<title>${AI_JOBS_SEO.title}</title>`)
    expect(html).toContain(`<meta property="og:title" content="${AI_JOBS_SEO.title}" />`)
    expect(html).toContain('<meta property="og:image" content="https://www.wajeezacademy.com/campaigns/ai-jobs/og.jpg" />')
    expect(html).not.toMatch(/<title>[^<]*أكاديمية وجيز/)
    expect(html).toContain('<link rel="canonical" href="https://www.wajeezacademy.com/ai-jobs" />')
  })

  it('والصورتان في المستودع', () => {
    const files = readdirSync(join(process.cwd(), 'public/campaigns/ai-jobs'))
    expect(files.sort()).toEqual(['og.jpg', 'suhaib.jpg'])
  })

  it('وليست في صفحات الأكاديمية العامة ولا خريطة موقعها', () => {
    expect(PUBLIC_PAGES.map((p) => p.path)).not.toContain('/ai-jobs')
  })

  it('والتهيئة تكتبها بعد كل بناء', () => {
    expect(read('scripts/prerender-seo.ts')).toMatch(/write\(AI_JOBS_PATH, renderAiJobsPage\(template, ORIGIN\)\)/)
  })
})

describe('③ النص بلا تشكيل', () => {
  for (const f of [
    'src/pages/ai-jobs/AiJobs.tsx',
    'src/pages/ai-jobs/RegisterForm.tsx',
    'src/pages/ai-jobs/content.ts',
    'src/pages/private/PrivateWorkspace.tsx',
    'src/application/private-course/ai-jobs.ts',
    'server/services/private-course/confirmation-mail.ts',
  ]) {
    it(f, () => {
      expect(markedTexts(f, read(f))).toEqual([])
    })
  }
})

describe('④ المساحة الخاصة خارج شريط الإدارة', () => {
  it('لا بند لـ /private في أقسام الإدارة', () => {
    const all = allSections.flatMap((s) => s.items.map((i) => i.to))
    expect(all).not.toContain('/private')
  })

  it('والشعبتان بتوقيت عمّان (+3): 11 صباحا و6 مساء', () => {
    expect(AI_JOBS.sections.map((s) => new Date(s.startsAt).getUTCHours() + 3)).toEqual([11, 18])
    expect(AI_JOBS.sections.map((s) => new Date(s.endsAt).getUTCHours() + 3)).toEqual([15, 22])
  })
})

/* ═══ ⑤ المقاعد المتبقية — «كل يوم تقل المقاعد مقعدين، الصباحية من 24 والمسائية 26» (١٩ نوفمبر ٢٠٢٦) ═══ */
describe('⑤ المقاعد المتبقية بدل عداد الوقت', () => {
  /* الساعةُ بتوقيت عمّان (+3): اليومُ يتبدّل عند منتصف ليلها لا ليل غرينتش */
  const at = (iso: string) => Date.parse(iso)

  it('يوم القرار: 24 للصباحية و26 للمسائية', () => {
    expect(seatsLeft('morning', at('2026-11-19T10:00:00+03:00'))).toBe(24)
    expect(seatsLeft('evening', at('2026-11-19T23:59:00+03:00'))).toBe(26)
  })

  it('⚠️ وتنقص مقعدين عند منتصف ليل عمّان — لا ليل غرينتش', () => {
    /* 22:30 بتوقيت غرينتش يوم ١٩ = 01:30 بتوقيت عمّان يوم ٢٠ */
    expect(seatsLeft('morning', at('2026-11-19T22:30:00Z'))).toBe(22)
    expect(seatsLeft('evening', at('2026-11-20T12:00:00+03:00'))).toBe(24)
  })

  it('⚠️ ولا تبلغ الصفر والتسجيل مفتوح — تقف عند مقعدين', () => {
    expect(seatsLeft('morning', at('2026-11-30T12:00:00+03:00'))).toBe(2)
    expect(seatsLeft('evening', at('2026-11-30T12:00:00+03:00'))).toBe(4)
    expect(seatsLeft('morning', at('2026-12-05T09:00:00+03:00'))).toBe(2)
    expect(seatsLeft('evening', at('2026-12-05T09:00:00+03:00'))).toBe(2)
  })

  it('والعدد بصيغته', () => {
    expect(seatsLabel(24)).toBe('متوفر 24 مقعد')
    expect(seatsLabel(4)).toBe('متوفر 4 مقاعد')
    expect(seatsLabel(2)).toBe('آخر مقعدين')
  })

  it('ولا عداد وقت باق في الصفحة، والخصم «حتى نفاد المقاعد»', () => {
    const page = read('src/pages/ai-jobs/AiJobs.tsx')
    expect(page).not.toMatch(/موعد الدورة/)
    expect(page).toMatch(/<b>حتى نفاد المقاعد<\/b>/)
  })
})

/* ═══ ⑥ ما يزيد البيع — قرارُ صاحب المنصّة (٢٠ نوفمبر ٢٠٢٦): «ابدأ بالأوّل ونفّذ ٤ و٥ و٦ و٨» ═══ */
describe('⑥ احجز أولا، ومن أين جاء، ولمن الدورة، والضمان، وواتساب', () => {
  it('⚠️ المصدر من ?src= أولا، ثم utm، ثم الموقع الذي أحاله', async () => {
    const { readSource } = await import('@/application/private-course/source')
    expect(readSource('?src=ig&utm_campaign=bf1', '', 'www.wajeezacademy.com')).toBe('Instagram · bf1')
    expect(readSource('?utm_source=linkedin&utm_medium=post', 'https://www.google.com/', 'www.wajeezacademy.com')).toBe('LinkedIn · post')
    expect(readSource('', 'https://l.instagram.com/?u=x', 'www.wajeezacademy.com')).toBe('Instagram')
    expect(readSource('', 'https://lnkd.in/abc', 'www.wajeezacademy.com')).toBe('LinkedIn')
    expect(readSource('?fbclid=123', '', 'www.wajeezacademy.com')).toBe('Facebook/Instagram')
  })

  it('⚠️ والدخول المباشر أو من الموقع نفسه لا مصدر له — ولا يطابق اسما جزءا من نطاق', async () => {
    const { readSource } = await import('@/application/private-course/source')
    expect(readSource('', '', 'www.wajeezacademy.com')).toBeNull()
    expect(readSource('', 'https://www.wajeezacademy.com/grant', 'www.wajeezacademy.com')).toBeNull()
    expect(readSource('', 'https://notinstagram.com.evil.io/', 'www.wajeezacademy.com')).toBe('notinstagram.com.evil.io')
  })

  it('⚠️ النموذج فيه صورة الحوالة اختيارية — من حوّل يرفعها معه، ومن لم يحوّل يحجز وتأتيه الخطوة الثانية', () => {
    /* قرارُ صاحب المنصّة (٢١ نوفمبر ٢٠٢٦): «اعمل فورم التسجيل مع رفع صورة الحوالة» — والحجزُ بلاها باقٍ */
    const form = read('src/pages/ai-jobs/RegisterForm.tsx')
    expect(form).toMatch(/<ProofDrop id="aij-proof"/)
    expect(form).toMatch(/\.\.\.\(proof \? \{ proof: \{ name: proof\.name, base64: proof\.base64 \}, payMethod: method \} : \{\}\)/)
    expect(form, 'صارت الصورة شرطا للحجز').not.toMatch(/e\.proof = /)
    expect(form).toMatch(/<PayStep /)
    expect(form).toMatch(/storedSource\(\)/)
    expect(read('src/pages/ai-jobs/ProofDrop.tsx')).toMatch(/type="file"/)
  })

  it('ورابط الدفع صفحة عامة قبل حارس الأدوار', () => {
    const app = read('src/App.tsx')
    const route = app.indexOf('path="/ai-jobs/pay/:token"')
    expect(route).toBeGreaterThan(0)
    expect(route).toBeLessThan(app.indexOf('<RequireRole'))
  })

  it('ولمن هذه الدورة، والضمان في العرض والنتيجة والأسئلة، وواتساب ثابت', () => {
    const page = read('src/pages/ai-jobs/AiJobs.tsx')
    expect(page).toMatch(/WHO\.map/)
    expect((page.match(/GUARANTEE\.text/g) ?? []).length).toBe(2)
    expect(read('src/pages/ai-jobs/content.ts')).toMatch(/q: 'ماذا لو لم أستفد؟'/)
    expect(page).toMatch(/className=\{`aij-wa/)
  })
})

/* ═══ ⑦ الدفع بالبطاقة لمن هو خارج الأردن (٢١ نوفمبر ٢٠٢٦) ═══ */
describe('⑦ الدفع بالبطاقة', () => {
  const step = read('src/pages/ai-jobs/PayStep.tsx')
  const page = read('src/pages/ai-jobs/AiJobs.tsx')

  it('⚠️ خطوة الدفع تقدم البطاقة أولا لمن رقمه خارج الأردن — وCliQ لغيره', () => {
    expect(step).toMatch(/useState<Method>\(info\.cardUrl && info\.abroad \? 'card' : 'cliq'\)/)
    expect(step).toMatch(/payMethod: card \? 'card' : 'cliq'/)
  })

  it('⚠️ ولا خيار بطاقة بلا رابط — لا زر يقود إلى لا شيء', () => {
    expect(step).toMatch(/\{info\.cardUrl && \(\s*<div className="aij-methods"/)
    expect(step).toMatch(/const card = method === 'card' && Boolean\(info\.cardUrl\)/)
    expect(page).toMatch(/\{card && \(\s*<p className="aij-card-note">/)
    expect(page).toMatch(/card \? \[\.\.\.FAQS\.slice\(0, 3\), CARD_FAQ/)
  })
})

/* ═══ ⑧ بكسل Meta — في صفحة الدورة ورابط الدفع وحدهما (٢١ نوفمبر ٢٠٢٦) ═══ */
describe('⑧ بكسل Meta', () => {
  const csp = /Content-Security-Policy "([^"]+)"/.exec(read('deploy/Caddyfile'))?.[1] ?? ''
  const directive = (name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? ''

  it('⚠️ السياسة تسمح بسكربته وإرساله — وإلا رد صامتا', () => {
    expect(directive('script-src')).toContain('https://connect.facebook.net')
    expect(directive('img-src')).toContain('https://www.facebook.com')
    expect(directive('connect-src')).toContain('https://www.facebook.com')
  })

  it('⚠️ ولا يحمل في صفحات الأكاديمية — في صفحة الدورة ورابط الدفع وحدهما', () => {
    expect(read('index.html')).not.toMatch(/fbevents|1150707094391273/)
    const loaders = ['src/pages/ai-jobs/AiJobs.tsx', 'src/pages/ai-jobs/PayPage.tsx']
    for (const f of loaders) expect(read(f), f).toMatch(/loadMetaPixel\(\)/)
    expect(read('src/App.tsx')).not.toMatch(/meta-pixel/)
  })

  it('والحجز يرسل Lead، والإيصال AddPaymentInfo، والبطاقة InitiateCheckout، وواتساب Contact', () => {
    expect(read('src/pages/ai-jobs/RegisterForm.tsx')).toMatch(/trackPixel\('Lead'/)
    const step = read('src/pages/ai-jobs/PayStep.tsx')
    expect(step).toMatch(/trackPixel\('AddPaymentInfo'/)
    expect(step).toMatch(/trackPixel\('InitiateCheckout'/)
    expect(read('src/pages/ai-jobs/AiJobs.tsx')).toMatch(/trackPixel\('Contact'\)/)
  })

  it('⚠️ يحمل مرة واحدة ويهيأ بالمعرف — وبلا بكسل لا يكسر الحجز', async () => {
    const appended: { src?: string }[] = []
    const g = globalThis as unknown as { window?: unknown; document?: unknown }
    const prev = { window: g.window, document: g.document }
    g.window = {}
    g.document = { createElement: () => ({}), head: { appendChild: (el: { src?: string }) => appended.push(el) } }
    try {
      const { loadMetaPixel, trackPixel, META_PIXEL_ID } = await import('@/pages/ai-jobs/meta-pixel')
      trackPixel('Lead')
      loadMetaPixel()
      loadMetaPixel()
      trackPixel('Lead', { value: 20 })
      const fbq = (g.window as { fbq: { queue: unknown[][] } }).fbq
      expect(appended.map((e) => e.src)).toEqual(['https://connect.facebook.net/en_US/fbevents.js'])
      expect(fbq.queue).toEqual([['init', META_PIXEL_ID], ['track', 'Lead', { value: 20 }]])
    } finally {
      g.window = prev.window
      g.document = prev.document
    }
  })
})
