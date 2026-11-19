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
