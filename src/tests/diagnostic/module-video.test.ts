import { describe, expect, it } from 'vitest'
import { embedAt, parseVideo, toEmbed, validateVideo } from '../../application/content/module-video'

describe('فيديو الوحدة — المضيف بقائمة بيضاء (ح-٢)', () => {
  it('يقبل YouTube بصيغه الثلاث ويحوّله إلى nocookie', () => {
    for (const u of [
      'https://www.youtube.com/watch?v=aircAruvnKk',
      'https://youtube.com/watch?v=aircAruvnKk',
      'https://youtu.be/aircAruvnKk',
      'https://www.youtube.com/embed/aircAruvnKk',
    ]) {
      expect(toEmbed(u)).toEqual({ embedUrl: 'https://www.youtube-nocookie.com/embed/aircAruvnKk', provider: 'youtube' })
    }
  })

  it('يقبل Vimeo بمعرّفه الرقمي', () => {
    expect(toEmbed('https://vimeo.com/123456789')).toEqual({ embedUrl: 'https://player.vimeo.com/video/123456789', provider: 'vimeo' })
  })

  it('يرفض كل مضيف آخر — قائمة بيضاء لا قائمة حجب', () => {
    for (const u of [
      'https://evil.example.com/embed/x',
      'https://youtube.evil.com/watch?v=aircAruvnKk',
      'https://vimeo.com.evil.com/123456789',
      'https://dailymotion.com/video/x1',
    ]) {
      expect(toEmbed(u)).toBeNull()
    }
  })

  it('يرفض غير https ويرفض javascript:', () => {
    expect(toEmbed('http://www.youtube.com/watch?v=aircAruvnKk')).toBeNull()
    expect(toEmbed('javascript:alert(1)')).toBeNull()
    expect(toEmbed('not a url')).toBeNull()
  })

  it('يرفض معرّفا مشوّها', () => {
    expect(toEmbed('https://www.youtube.com/watch?v=x')).toBeNull()
    expect(toEmbed('https://vimeo.com/abc')).toBeNull()
  })
})

describe('فيديو الوحدة — الفصول', () => {
  const RAW = [
    'https://www.youtube.com/watch?v=aircAruvnKk',
    '7:10 الفصل الثالث',
    '0:00 الفصل الأول',
    '1:02:30 الفصل بعد الساعة',
  ].join('\n')

  it('فارغ لا فيديو ولا أخطاء', () => {
    for (const v of [null, undefined, '', '  \n ']) expect(parseVideo(v)).toEqual({ video: null, errorsAr: [] })
  })

  it('الفصول تُرتَّب زمنيا حتما لا بترتيب المؤلّف', () => {
    const { video, errorsAr } = parseVideo(RAW)
    expect(errorsAr).toEqual([])
    expect(video!.chapters.map((c) => c.atSec)).toEqual([0, 430, 3750])
    expect(video!.chapters[0].titleAr).toBe('الفصل الأول')
  })

  it('الطابع يُقرأ بصيغتي د:ث وس:د:ث', () => {
    const { video } = parseVideo('https://youtu.be/aircAruvnKk\n2:30 أ\n1:00:01 ب')
    expect(video!.chapters.map((c) => c.atSec)).toEqual([150, 3601])
  })

  it('سطر فصل غير مفهوم يُبلَّغ ولا يُتجاهل صامتا', () => {
    const { errorsAr } = parseVideo('https://youtu.be/aircAruvnKk\nبلا طابع زمني')
    expect(errorsAr.join(' ')).toContain('سطر فصل غير مفهوم')
  })

  it('رابط مرفوض يُوقف التحليل بخطأ مقروء', () => {
    const { video, errorsAr } = parseVideo('https://evil.example.com/x\n0:00 أ')
    expect(video).toBeNull()
    expect(errorsAr.join(' ')).toContain('YouTube وVimeo')
  })

  it('فيديو بلا فصول مقبول — الفصول ميزة لا شرط', () => {
    const { video, errorsAr } = parseVideo('https://youtu.be/aircAruvnKk')
    expect(errorsAr).toEqual([])
    expect(video!.chapters).toEqual([])
  })

  it('طابع البداية بالصيغة التي يفهمها كل مضيف، وصفر لا يضيف شيئا', () => {
    const yt = parseVideo('https://youtu.be/aircAruvnKk').video!
    const vm = parseVideo('https://vimeo.com/123456789').video!
    expect(embedAt(yt, 0)).toBe(yt.embedUrl)
    expect(embedAt(yt, 150)).toBe(`${yt.embedUrl}?start=150`)
    expect(embedAt(vm, 150)).toBe(`${vm.embedUrl}#t=150s`)
  })

  it('التحقق عند الحفظ يرفض المضيف غير المسموح والفارغ', () => {
    expect(validateVideo('https://youtu.be/aircAruvnKk')).toEqual({ ok: true })
    expect(validateVideo('https://evil.example.com/x')).toMatchObject({ ok: false })
    expect(validateVideo('')).toMatchObject({ ok: false })
  })
})
