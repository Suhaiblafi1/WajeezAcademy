/* `wajeezacademy.com/wa` — واتساب مستشار المنحة ورسالتُه جاهزة (١٧ نوفمبر ٢٠٢٦). والعلّةُ في `src/application/site/wa-start.ts`.

   ① الرسالةُ الجاهزة: منحةُ بلاك فرايدي، ومساعدةٌ باختيار الدورات بحسب سيرته الذاتيّة المرفقة — وكودُ المصدر في سطرها الأوّل («KASEET Code») بشكله وحدَه.
   ② والصفحةُ على `/wa` تفتح رقمَ مستشار المنحة من الإعدادات (لا رقمٌ في الشيفرة) بالرسالة، وتنتقل وحدَها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WA_START_TEXT_AR, waStartText } from '@/application/site/wa-start'
import { waHref } from '@/application/site/whatsapp'

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8')

describe('① الرسالة الجاهزة', () => {
  it('⚠️ تطلب المنحة والمساعدة باختيار الدورات بحسب السيرة المرفقة — بلا حركات إلا الشدة', () => {
    expect(WA_START_TEXT_AR).toContain('منحة بلاك فرايدي')
    expect(WA_START_TEXT_AR).toContain('اختيار الدورات التي تناسب سيرتي الذاتية')
    expect(WA_START_TEXT_AR).toContain('مرفقة لكم')
    expect(WA_START_TEXT_AR).not.toMatch(/[ً-ِْ]/)
    expect(waStartText('')).toBe(WA_START_TEXT_AR)
  })

  /* والكودُ في سطرها الأوّل بجانبه «Code» (١٧ نوفمبر ٢٠٢٦، «ChatTree Code») */
  it('⚠️ وكود المصدر في سطرها الأول وحده بجانبه Code — بشكله وحده', () => {
    expect(waStartText('?k=kaseet')).toBe(`KASEET Code\n${WA_START_TEXT_AR}`)
    expect(waStartText('?k=CHATTREE').split('\n')[0]).toBe('CHATTREE Code')
    expect(waStartText('?k=<b>x</b>')).toBe(WA_START_TEXT_AR)
  })

  it('⚠️ ورابط واتساب برقم مستشار المنحة والرسالة كاملة', () => {
    const href = waHref({ grant_advisor: '962794050524' }, 'grant_advisor', '', WA_START_TEXT_AR)!
    expect(href.startsWith('https://wa.me/962794050524?text=')).toBe(true)
    expect(decodeURIComponent(href.split('text=')[1])).toBe(WA_START_TEXT_AR)
  })
})

describe('② الصفحة على /wa', () => {
  it('⚠️ مسارها، ورقم مستشار المنحة من الإعدادات، وتنتقل وحدها', () => {
    expect(read('App.tsx')).toMatch(/<Route path="\/wa" element=\{<WaStart \/>\} \/>/)
    const page = read('pages/WaStart.tsx')
    expect(page).toMatch(/fetch\("\/api\/site\/whatsapp"\)/)
    expect(page).toMatch(/waHref\(numbers, "grant_advisor", CONTACT\.whatsapp, text\)/)
    expect(page).toMatch(/window\.location\.replace\(to\)/)
  })
})
