import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CV_CONSENT_TEXT_AR, CV_MAX_BYTES, validateCvFile } from '../../application/cv/cv-store'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('رفع السيرة الذاتية — التحقق الصارم', () => {
  const ok = (name: string, type: string, size = 100_000) => validateCvFile({ name, type, size })

  it('يقبل PDF وDOC وDOCX الصحيحة', () => {
    expect(ok('cv.pdf', 'application/pdf').ok).toBe(true)
    expect(ok('cv.doc', 'application/msword').ok).toBe(true)
    expect(
      ok('cv.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').ok,
    ).toBe(true)
  })

  it('يرفض التنفيذيات والصور مهما تظاهرت', () => {
    expect(ok('virus.exe', 'application/x-msdownload').ok).toBe(false)
    expect(ok('photo.jpg', 'image/jpeg').ok).toBe(false)
    expect(ok('photo.png', 'image/png').ok).toBe(false)
  })

  it('يرفض امتدادا صحيحا مع نوع MIME لا يطابقه (ملف معاد تسميته)', () => {
    const r = ok('cv.pdf', 'image/jpeg')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason_ar).toContain('لا يطابق')
  })

  it('يرفض الحجم فوق 5MB والملف الفارغ', () => {
    expect(ok('cv.pdf', 'application/pdf', CV_MAX_BYTES + 1).ok).toBe(false)
    expect(ok('cv.pdf', 'application/pdf', 0).ok).toBe(false)
    expect(ok('cv.pdf', 'application/pdf', CV_MAX_BYTES).ok).toBe(true)
  })

  it('يرفض الاسم الفارغ أو الطويل جدا', () => {
    expect(ok('', 'application/pdf').ok).toBe(false)
    expect(ok('a'.repeat(200) + '.pdf', 'application/pdf').ok).toBe(false)
  })

  it('رسائل الرفض كلها عربية واضحة', () => {
    const cases = [
      ok('x.exe', 'application/x-msdownload'),
      ok('cv.pdf', 'image/jpeg'),
      ok('cv.pdf', 'application/pdf', CV_MAX_BYTES + 1),
      ok('', 'application/pdf'),
    ]
    for (const c of cases) {
      expect(c.ok).toBe(false)
      if (!c.ok) expect(/[؀-ۿ]/.test(c.reason_ar)).toBe(true)
    }
  })

  it('نص الموافقة موجود ويذكر الغرض صراحة', () => {
    expect(CV_CONSENT_TEXT_AR).toContain('أوافق')
    expect(CV_CONSENT_TEXT_AR).toContain('أكاديمية وجيز')
  })

  it('المخزن لا يرسل شيئا للشبكة أبدا — لا fetch ولا XMLHttpRequest', () => {
    const src = readFileSync(join(root, 'src/application/cv/cv-store.ts'), 'utf8')
    expect(src).not.toContain('fetch(')
    expect(src).not.toContain('XMLHttpRequest')
    expect(src).not.toContain('axios')
  })
})
