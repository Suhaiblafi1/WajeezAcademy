/* صفحةُ المدرّبين: دوراتُه بمواسمها، والرأسُ اسمُ الموسم وحدَه — بنيةٌ لا نصّ (١٩–٢٠ أكتوبر ٢٠٢٦).

   «لماذا تظهر كلُّ الدورات للمدرّب وليس للموسم القادم؟» (صاحب المنصّة). فالبطاقةُ تقرأ `offer` بمواسمه من
   الخادم، ولكلّ موسمٍ رأسُه باسم المدرّب. والتعليقاتُ تُنزع قبل الفحص. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(process.cwd(), 'src/pages/Trainers.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('صفحة المدربين — الموسم القادم', () => {
  it('البطاقة تقرأ ما يقدمه بمواسمه', () => {
    expect(page).toMatch(/<TrainerOffer groups=\{t\.offer/)
  })

  it('ولكل موسم رأسه — اسم الموسم، لا «دوراته» عامة', () => {
    expect(page).toMatch(/seasons\.map\(\(g, i\) =>[\s\S]*?seasonHeadingAr\(g\.termAr\)/)
    expect(page, 'عاد رأس «دوراته» العام').not.toContain('دوراته — تشترى من صفحتها')
  })

  /* ═══ «الكلام مكتظ» — الأقربُ مفتوحٌ وما بعده يُطوى (١٩ أكتوبر ٢٠٢٦) ═══
     «يجب أن تنسدل دورات الفصول الأخرى، واترك مسافات، وخفّف حجم الخط واجعله لايت» (صاحب المنصّة).
     ثمّ صار كلُّ موسمٍ ينسدل، والأقربُ مفتوحٌ ابتداءً (٢٤ أكتوبر ٢٠٢٦). رُئي ساقطا على المواسم كلِّها مفتوحة. */
  it('⚠️ الموسم الأقرب مفتوح، وما بعده مطوي برأسه وعدد دوراته', () => {
    const block = page.slice(page.indexOf('seasons.map((g, i) =>'))
    expect(block, 'المواسم كلها مفتوحة').toMatch(/<details key=\{[^}]*\} open=\{i === 0\}/)
    expect(block, 'المطوي بلا رأسه').toMatch(/<summary[\s\S]*?seasonHeadingAr\(g\.termAr\)[\s\S]*?coursesCountAr\(g\.courses\.length\)[\s\S]*?<\/summary>/)
  })

  /* ═══ ورأسُ الموسم شريطٌ ينسدل، لا سطرٌ كالدورات (٢٤ أكتوبر ٢٠٢٦) ═══
     «ميّز عناوين الفصول عن الدورات. اجعل عناوين الفصول بطريقة تبدو وكأنها عنوانٌ له انسدال» (صاحب المنصّة)،
     واختار من ثلاث صورٍ «الشريط الملوّن». فنُسخ به «اسم الموسم ١٢» (٢٠ أكتوبر). رُئي ساقطا على الرأس القديم:
     سطرٌ ١٢ بلا خلفيّةٍ ولا سهم، كأسماء الدورات تحته. */
  it('⚠️ ورأس الموسم شريط ملون عريض بسهم — أكبر من أسماء الدورات', () => {
    const block = page.slice(page.indexOf('seasons.map((g, i) =>'))
    const head = block.match(/<summary className="([^"]*)">([\s\S]*?)<\/summary>/)
    expect(head, 'رأس الموسم غاب').not.toBeNull()
    const cls = head![1].split(/\s+/)
    expect(cls, 'الرأس بلا شريط').toEqual(expect.arrayContaining(['rounded-2xl', 'bg-[#38A7B4]/10', 'font-bold', 'text-read']))
    expect(head![2], 'الرأس بلا سهم').toMatch(/<ChevronDown[^>]*group-open:rotate-180/)
  })

  /* «غيّر كلمة تفاصيل الدورة لـ"التفاصيل"» (صاحب المنصّة، ٢٠ أكتوبر ٢٠٢٦) — السطرُ اسمُ الدورة، فـ«الدورة»
     بعده تكرار. رُئي ساقطا على البطاقة القديمة. */
  it('⚠️ وزر كل دورة «التفاصيل» — لا «تفاصيل الدورة»', () => {
    const block = page.slice(page.indexOf('seasons.map((g, i) =>'))
    const list = block.slice(block.indexOf('{g.courses.map((c) =>'), block.indexOf('</ul>'))
    expect(list, 'قائمة الدورات غابت').toContain('to={`/build/${c.id}`}')
    expect(list).toMatch(/>\s*التفاصيل\s*<ArrowLeft/)
    expect(list).not.toContain('تفاصيل الدورة')
  })

  it('⚠️ وأسماء الدورات أصغر وأخف — لا ١٤ عريضة', () => {
    const row = page.match(/<span className="([^"]*)">\{c\.name\}<\/span>/)
    expect(row, 'سطر اسم الدورة غاب').not.toBeNull()
    expect(row![1].split(/\s+/)).toEqual(expect.arrayContaining(['text-fine', 'font-light']))
    expect(row![1], 'عاد الخط العريض').not.toMatch(/font-(bold|semibold)|text-read/)
  })
})
