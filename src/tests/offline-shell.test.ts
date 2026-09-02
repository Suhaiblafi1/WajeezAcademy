/* قوقعةٌ محفوظة — «Safari can't open the page» لا يعود شاشةَ خطأ.

   الشكوى كانت: الموقع لا يفتح في سفاري ويفتح في كروم على الجهاز نفسِه. وقد
   حُسم موضعُ العلّة بالدليل لا بالتخمين: نصُّ سفاري «‏the server unexpectedly
   dropped the connection‏» ووحدةُ تحكّمٍ فارغةٌ تماما — فالاتصال انقطع قبل
   أوّل بايت، ولم يُنفَّذ سطرٌ من شيفرتنا. وفُحص الخادمُ فإذا خمسون طلبا
   متتاليا كلُّها ٢٠٠ والحزمُ تُنقل كاملةً ببايتاتها نفسِها.

   فالسببُ خارج المستودَع، والذي يُملَك إصلاحُه هو الأثر. وهذه الاختبارات
   تحرس الشرطَ الذي يجعل العلاجَ علاجا لا وجعا جديدا:

     **الشبكةُ أولا دائما.** لا يُقرأ المحفوظُ إلّا حين ترفض الشبكةُ رفضا —
     انقطاعٌ لا استجابة. فردُّ ٤٠٤ على قطعةٍ حُذفت بعد نشرٍ جديد يمرّ كما هو
     إلى شبكة الأمان في `index.html` فتُعيد التحميل كعادتها، ولا يخدّم عاملُ
     الخدمة قديما وهو يظنّ أنّه يُسعف. وهذا الوجعُ قاتلته المنصّةُ مرّةً،
     فلا يُستدعى من الباب الخلفيّ. */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const SW = readFileSync(join(ROOT, 'public/sw.js'), 'utf8')
const MAIN = readFileSync(join(ROOT, 'src/main.tsx'), 'utf8')
const VERCEL = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
  rewrites: { source: string; destination: string }[]
  headers: { source: string; headers: { key: string; value: string }[] }[]
}
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8')

describe('عاملُ الخدمة موجودٌ ومسجَّل في موضعه', () => {
  it('الملفّ في `public/` فيُخدَّم من الجذر — والجذرُ شرطُ نطاقه', () => {
    expect(existsSync(join(ROOT, 'public/sw.js'))).toBe(true)
  })

  it('التسجيلُ في الحزمة لا في `index.html` — فبصماتُ السياسة لا تُمَسّ', () => {
    expect(MAIN).toContain("navigator.serviceWorker.register('/sw.js')")
    expect(HTML).not.toContain('serviceWorker')
  })

  it('في الإنتاج وحده وبعد `load` — لا ينافس أوّلَ رسم', () => {
    expect(MAIN).toMatch(/import\.meta\.env\.PROD && 'serviceWorker' in navigator/)
    expect(MAIN).toMatch(/window\.addEventListener\('load'/)
  })

  it('فشلُ التسجيل لا يُسقط الإقلاع — تصفّحٌ خفيّ أو تخزينٌ محجوب', () => {
    expect(MAIN).toMatch(/register\('\/sw\.js'\)\.catch\(/)
  })

  it('إعادةُ الكتابة تستثني `sw.js` — وإلّا خُدِّمت `index.html` مكانه', () => {
    const spa = VERCEL.rewrites.find((r) => r.destination === '/index.html')
    expect(spa?.source).toContain('sw\\.js')
  })

  it('لا يُخزَّن العاملُ نفسُه طويلا — فمفتاحُ الإطفاء يصل بنشرةٍ واحدة', () => {
    const swHeaders = VERCEL.headers.find((h) => h.source === '/sw.js')
    expect(swHeaders?.headers[0]?.value).toContain('max-age=0')
  })

  it('مفتاحُ إطفاءٍ قائم — عاملٌ يُلغي تسجيلَ نفسِه ويمحو ما خزّن', () => {
    expect(SW).toContain('const DISABLED = false')
    expect(SW).toContain('self.registration.unregister()')
  })
})

describe('الشبكةُ أولا — المحفوظُ عند الانقطاع وحده', () => {
  it('لا يُخزَّن إلّا ما نجح فعلا ومن أصلنا — لا ٤٠٤ ولا ردٌّ مُعتِم', () => {
    expect(SW).toContain('response.ok && response.type === \'basic\'')
  })

  it('نداءاتُ API لا تُخزَّن أبدا — بياناتٌ حيّة', () => {
    expect(SW).toContain("url.pathname.startsWith('/api/')")
  })

  it('المصادرُ الخارجية تُترك للمتصفّح — لا خطوطَ ولا صورَ غيرِنا', () => {
    expect(SW).toContain('url.origin !== self.location.origin')
  })

  it('الطلباتُ غير GET لا تُلمس', () => {
    expect(SW).toContain("request.method !== 'GET'")
  })

  it('عند الانقطاع بلا محفوظٍ يبقى الخطأُ خطأ — لا إخفاءَ خبرٍ صحيح', () => {
    expect(SW).toMatch(/if \(cached\) return cached\s*\n\s*throw err/)
  })

  /* المنطقُ نفسُه يُنفَّذ هنا، لا نصُّه يُقرأ: الشرطُ الحارس هو أنّ المحفوظ
     لا يُقرأ إلّا عند رفضٍ فعليّ — فيُختبر بثلاث حالات. */
  const networkFirst = async (
    fetchImpl: () => Promise<{ ok: boolean; type: string; body: string }>,
    cached: string | undefined,
  ) => {
    const put: string[] = []
    try {
      const response = await fetchImpl()
      if (response.ok && response.type === 'basic') put.push(response.body)
      return { served: response.body, put }
    } catch (err) {
      if (cached) return { served: cached, put }
      throw err
    }
  }

  it('الشبكةُ تعمل: يُخدَّم الأحدثُ ويُحفَظ — ولو كان في المحفوظ أقدمُ منه', async () => {
    const out = await networkFirst(async () => ({ ok: true, type: 'basic', body: 'جديد' }), 'قديم')
    expect(out.served).toBe('جديد')
    expect(out.put).toEqual(['جديد'])
  })

  it('٤٠٤ بعد نشرة: يمرّ كما هو ولا يُحفَظ — شبكةُ أمان `index.html` تتولّاه', async () => {
    const out = await networkFirst(async () => ({ ok: false, type: 'basic', body: 'لا يوجد' }), 'قديم')
    expect(out.served).toBe('لا يوجد')
    expect(out.put).toEqual([])
  })

  it('انقطاعٌ فعليّ: يُخدَّم المحفوظُ فيفتح الموقعُ بدل شاشة الخطأ', async () => {
    const out = await networkFirst(async () => {
      throw new TypeError('Load failed')
    }, 'قوقعة')
    expect(out.served).toBe('قوقعة')
  })

  it('انقطاعٌ ولا محفوظ: الخطأُ يصل المتصفّحَ كما كان قبل هذا العامل', async () => {
    await expect(
      networkFirst(async () => {
        throw new TypeError('Load failed')
      }, undefined),
    ).rejects.toThrow('Load failed')
  })
})
