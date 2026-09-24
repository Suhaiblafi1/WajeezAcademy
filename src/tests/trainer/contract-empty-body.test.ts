/* لا يُوقَّع على لا شيء.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * `bodyAr` عمودٌ يقبل `null`، وعقودُ البابِ القديم رُكِّبت قبل أن يُجمَّد
 * المتن. وكان `sendContract` وحدَه يسأل عنه — فبقيت ثلاثةُ مواضعَ تفترق:
 *
 * ① `replyToAmendment` يردّ العقدَ إلى `sent` ويسكّ رمزا يعمل، بلا سؤال.
 * ② والتوقيعُ كان يُمنع بالعرَض: `bodyHash` يسقط مع المتن. و`sha256('')`
 *    هاشٌ صحيحٌ تامّ، فمتنٌ خاوٍ لا `null` يمرّ نظيفا.
 * ③ وبوّابةُ «اقرأه إلى آخره» تُرضي نفسَها حين لا شريطَ تمرير — صوابٌ
 *    لنصٍّ قصير، وخطأٌ حين لا نصَّ البتّة.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { contractHasBodyAr } from '@/application/trainer/contract-body'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
/** نصُّ المصدر بلا تعليقات — فلا يُطابَق شرحُ الحارس بدل الحارس */
const bare = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** جسمُ دالّةٍ بعينها لا إلى آخر الملفّ — فلا تلتقط المطابقةُ ما بعدها */
function fnBody(src: string, name: string): string {
  const at = src.indexOf(`async ${name}(`)
  if (at < 0) return ''
  const next = src.indexOf('\n  async ', at + 1)
  return src.slice(at, next < 0 ? src.length : next)
}

describe('السؤالُ عن المتن واحدٌ، والفراغُ كالعدم', () => {
  it('الغائبُ والخاوي سواء — ومسافاتٌ ليست وثيقة', () => {
    expect(contractHasBodyAr(null)).toBe(false)
    expect(contractHasBodyAr(undefined)).toBe(false)
    expect(contractHasBodyAr('')).toBe(false)
    /* وهذه هي التي كانت تمرّ: `sha256(' ')` هاشٌ صحيحٌ تامّ */
    expect(contractHasBodyAr('   \n\t  ')).toBe(false)
  })

  it('ومتنٌ فيه حرفٌ يُقرأ متنا', () => {
    expect(contractHasBodyAr('نص')).toBe(true)
    expect(contractHasBodyAr('  نص  ')).toBe(true)
  })
})

describe('كلُّ بابٍ يفتح التوقيعَ يسأل عنه', () => {
  const svc = bare('server/services/trainer-review.service.ts')

  /* والقياسُ على البنية: كلُّ دالّةٍ تنقل العقدَ إلى `sent` أو تُوقّعه
     تستدعي المميِّزَ **في جسمها هي**. */
  for (const fn of ['sendContract', 'replyToAmendment', 'signContractByToken']) {
    it(`${fn} لا يمضي بلا متن`, () => {
      const body = fnBody(svc, fn)
      expect(body, `لم تُقرأ ${fn}`).not.toBe('')
      expect(body, `${fn}: لا تسأل عن المتن — فتفتح بابا على وثيقةٍ خاوية`)
        .toContain('contractHasBodyAr(')
    })
  }

  /* وردُّ التعديل يسأل **قبل** أن يسكّ الرمز: رمزٌ مسكوكٌ ثمّ ردٌّ
     يترك رمزا حيّا على عقدٍ رُفض إرسالُه. */
  it('وردُّ التعديل يسأل قبل سكّ الرمز لا بعده', () => {
    const body = fnBody(svc, 'replyToAmendment')
    const ask = body.indexOf('contractHasBodyAr(')
    const mint = body.indexOf('mintContractToken(')
    expect(ask, 'لا سؤال').toBeGreaterThan(-1)
    expect(mint, 'لا سكّ').toBeGreaterThan(-1)
    expect(ask, 'سُكّ الرمزُ قبل السؤال').toBeLessThan(mint)
  })

  /* والتوقيعُ يسأل **قبل** مقابلة الهاش: وإلّا ارتدّ الخاوي برسالة
     «تغيّر نصُّ العقد» — وهي تكذب على من لا نصَّ عنده. */
  it('والتوقيعُ يسأل قبل مقابلة الهاش', () => {
    const body = fnBody(svc, 'signContractByToken')
    const ask = body.indexOf('contractHasBodyAr(')
    const cmp = body.indexOf('input.bodyHash !== c.bodyHash')
    expect(ask, 'لا سؤال').toBeGreaterThan(-1)
    expect(cmp, 'لا مقابلة').toBeGreaterThan(-1)
    expect(ask, 'قُوبل الهاشُ قبل السؤال — فيُقال له «تغيّر النصّ» ولا نصّ')
      .toBeLessThan(cmp)
  })
})

describe('والشاشةُ لا تَعِد ببابٍ سيُردّ', () => {
  const page = bare('src/pages/ContractSign.tsx')

  it('البوّابةُ تسأل عن المتن قبل أن تُرضي نفسَها بغياب الشريط', () => {
    /* المقيسُ أنّ `checkRead` تخرج بلا متن — لا مجرّدُ ورودِ الاسم */
    const at = page.indexOf('const checkRead =')
    expect(at, 'لا `checkRead`').toBeGreaterThan(-1)
    const body = page.slice(at, page.indexOf('}, [', at))
    expect(body, 'تُرضي البوّابةُ نفسَها بلا متن').toContain('!hasBody')
    /* والخروجُ قبل القياس: لو سُئل بعد `setReadToEnd` لَفُتحت ثمّ أُغلقت */
    expect(body.indexOf('!hasBody'), 'سُئل بعد أن فُتحت البوّابة')
      .toBeLessThan(body.indexOf('setReadToEnd'))
  })

  it('والزرُّ مقفلٌ بلا متن', () => {
    const m = /const canSign = ([^\n]+)/.exec(page)
    expect(m, 'لا `canSign`').not.toBeNull()
    expect(m![1], '`canSign` لا يسأل عن المتن').toContain('hasBody')
  })

  it('ويُقال إنّ الناقصَ هو المتنُ لا القراءة', () => {
    expect(page, 'لا يُقال سببُ القفل').toMatch(/!hasBody &&\s*'متنُ العقد/)
    /* ولا يُقال «اقرأ إلى آخره» لمن لا شيءَ عنده يقرؤه */
    expect(page, 'يُطلَب منه أن يقرأ ولا نصّ').toMatch(/hasBody && !readToEnd &&/)
  })
})
