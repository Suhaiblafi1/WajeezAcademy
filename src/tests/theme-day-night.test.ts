/* حارسُ قاعدة المظهر — نهارا وليلا بالجهاز، واختيارُ اليد يعلو ويبقى.

   القاعدةُ في `src/services/theme.ts` (قرارُ صاحب المنصّة ١٨ سبتمبر ٢٠٢٦)،
   وهي نسخٌ لقاعدةٍ قبلها كانت تفتح الموقعَ داكنا دائما. فالحارسُ هنا يحرس
   **الانعكاسَ نفسَه**: لو عاد أحدٌ إلى «داكنٌ دائما»، أو أعاد الحفظَ إلى
   `sessionStorage` فضاع اختيارُ الزائر بإغلاق اللسان، سقط هذا الملفّ.

   ولماذا يُشغَّل السلوكُ لا يُقرأ النصّ: المستودَعُ مرّ بثلاثة حرّاسٍ خضراءَ
   لأسبابٍ خاطئة — طابقوا نصّا في تعليقٍ أو اسما جزءا من اسم (`CLAUDE.md`).
   و«`localStorage` مكتوبةٌ في الملفّ» تخضرّ ولو كان السطرُ في تعليق. فهنا
   تُركَّب بيئةٌ صغيرةٌ ويُسأل المظهرُ عمّا فعل فعلا.

   ولا `jsdom` في هذا المستودَع — فالبيئةُ هذه الأسطرُ وحدَها: ما تمسّه
   الوحدةُ لا أكثر. */

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = () => void

function fakeStore() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
  }
}

/** بيئةٌ جديدةٌ لكلّ حالة — ووحدةٌ جديدةٌ معها، فحالةُ المشتركين لا تتسرّب */
async function boot({ deviceDark, stored }: { deviceDark: boolean; stored?: string }) {
  const local = fakeStore()
  const session = fakeStore()
  if (stored) local.setItem('wajeez_theme', stored)

  const changeListeners: Listener[] = []
  const root = { dataset: {} as Record<string, string> }

  vi.stubGlobal('localStorage', local)
  vi.stubGlobal('sessionStorage', session)
  vi.stubGlobal('document', { documentElement: root, querySelector: () => null })
  vi.stubGlobal('window', {
    matchMedia: (q: string) => ({
      /* الوحدةُ تسأل عن الداكن وحدَه — فإن سألت عن غيره فالسؤالُ تغيّر */
      matches: q.includes('dark') ? deviceDark : false,
      addEventListener: (_e: string, fn: Listener) => { changeListeners.push(fn) },
      removeEventListener: () => {},
    }),
  })

  vi.resetModules()
  const mod = await import('@/services/theme')
  return { mod, root, local, session, fireDeviceChange: (d: boolean) => { deviceDark = d; changeListeners.forEach((f) => f()) } }
}

beforeEach(() => { vi.unstubAllGlobals() })

describe('المظهر يتبع الجهاز نهارا وليلا', () => {
  it('بلا اختيارٍ من الزائر — الجهازُ الداكنُ يفتح داكنا', async () => {
    const { mod } = await boot({ deviceDark: true })
    expect(mod.getTheme()).toBe('dark')
  })

  it('وبلا اختيارٍ — الجهازُ النهاريُّ يفتح نهاريّا، لا داكنا كما كانت القاعدةُ القديمة', async () => {
    const { mod } = await boot({ deviceDark: false })
    expect(mod.getTheme(), 'عاد الموقعُ يفتح داكنا رغم جهازٍ نهاريّ — القاعدةُ القديمةُ رجعت').toBe('light')
  })

  it('واختيارُ الزائر يعلو على الجهاز', async () => {
    const { mod } = await boot({ deviceDark: true, stored: 'light' })
    expect(mod.getTheme()).toBe('light')
    const other = await boot({ deviceDark: false, stored: 'dark' })
    expect(other.mod.getTheme()).toBe('dark')
  })

  it('وقيمةٌ محفوظةٌ لا تُعرَف تُهمَل ويحكم الجهاز', async () => {
    const { mod } = await boot({ deviceDark: true, stored: 'sepia' })
    expect(mod.getTheme()).toBe('dark')
  })
})

describe('اختيارُ اليد يبقى بين الزيارات', () => {
  it('يُكتب في localStorage لا في sessionStorage — وإلّا ضاع بإغلاق اللسان', async () => {
    const { mod, local, session } = await boot({ deviceDark: true })
    expect(mod.toggleTheme()).toBe('light')
    expect(local.getItem('wajeez_theme'), 'اختيارُ الزائر لم يُحفَظ حفظا باقيا').toBe('light')
    expect(session.map.size, 'رجع الحفظُ إلى تخزين الزيارة — فيضيع الاختيارُ بإغلاق اللسان').toBe(0)
  })

  it('ويُطبَّق على <html data-theme> فورا', async () => {
    const { mod, root } = await boot({ deviceDark: true })
    mod.toggleTheme()
    expect(root.dataset.theme).toBe('light')
  })
})

describe('تبديلُ الجهاز أثناء الجلسة', () => {
  it('يُتبَع ما دام الزائرُ لم يختر بيده — فالغروبُ يقلب الموقعَ من نفسه', async () => {
    const { mod, root, fireDeviceChange } = await boot({ deviceDark: false })
    mod.initTheme()
    expect(root.dataset.theme).toBe('light')
    fireDeviceChange(true)
    expect(root.dataset.theme, 'غرَبت الشمسُ ولم يتبعها الموقع').toBe('dark')
  })

  it('ولا يُتبَع إن كان للزائر اختيار — فلا يُنتزع منه المظهرُ عند الغروب', async () => {
    const { mod, root, fireDeviceChange } = await boot({ deviceDark: false, stored: 'light' })
    mod.initTheme()
    fireDeviceChange(true)
    expect(root.dataset.theme, 'انتُزع اختيارُ الزائر حين بدّل الجهازُ').toBe('light')
  })
})
