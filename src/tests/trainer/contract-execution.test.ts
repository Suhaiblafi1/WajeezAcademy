/* سجلُّ تنفيذ العقد — ما حُفظ يُعرَض، وما وُقّع لا يُزاد عليه.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * اثنا عشرَ عمودا هي دليلُ توقيع المدرّب تُكتب لحظةَ توقيعه: اسمُه القانونيُّ
 * بخطّه، وعنوانُه وهاتفُه، ونصُّ الإقرار، والجملُ التي أقرّ بها، وبصمةُ ما
 * عُرض عليه، ثمّ من اعتمده عنّا وصفتُه وتاريخُه. **ولا واحدٌ منها كان
 * يُعرَض له** — فتصله نسختُه «نصّا طويلا غير موقَّع» ويسأل: أين نضع توقيعنا؟
 *
 * فالحارسُ الأوّلُ يقابل ما تُخرجه الشاشةُ بما حُفظ، قيمةً قيمة: حقلٌ يُحذف
 * من المكوّن بعد شهرٍ يعيد العطبَ بعينه بلا أن يحمرَّ شيء.
 *
 * ── والثاني أخطرُ ──
 *
 * سجلُّ التنفيذ **لا يدخل `bodyAr`**: المتنُ مهشَّشٌ وهاشُه يُقابَل لحظةَ
 * التوقيع، فمن ألحق به سجلَّ التوقيع نقض بصمتَه ومنع كلَّ توقيعٍ لاحق على
 * ملحقٍ أو بديل. وأقربُ طريقٍ إلى ذلك أن يُقال يوما: «ضعِ التوقيعَ في النصّ
 * ليخرج في الطباعة». فيُقاس أنّ مولِّدَ المتن **لا يرى الخَتمَ أصلا**.
 */

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ContractExecution from '@/components/ContractExecution'
import {
  SEAL_FIELDS, bodyIntact, executionStage, readConsentAcks,
  type ContractSeal,
} from '@/application/trainer/contract-execution'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const HASH = 'b'.repeat(64)

/** خَتمٌ تامُّ الطرفين — كما يخرج من صفٍّ اعتُمد */
const SEALED: ContractSeal = {
  signedAt: '2026-09-20T08:30:00.000Z',
  signerLegalName: 'فلانُ بنُ فلانٍ الفلانيّ',
  signerAddressAr: 'عمّان — الصويفيّة، شارعُ كذا 12',
  signerPhone: '+962790000001',
  consentTextAr: 'أقرُّ بأنّي قرأتُ هذه الوثيقةَ كاملةً ووافقتُ على ما فيها',
  consentAcksAr: [
    { key: 'qualify', textAr: 'أفهم أنّ إدراجَ الدورة تأهيلٌ لا إسناد' },
    { key: 'discounts', textAr: 'أفهم أنّ خصما أُصدره يُحسم من مستحقّاتي' },
  ],
  signedBodyHash: HASH,
  bodyHash: HASH,
  countersignedAt: '2026-09-22T11:00:00.000Z',
  academySignatoryName: 'اسمُ المفوَّض',
  academySignatoryTitle: 'مدير عام الشركة',
}

const render = (seal: ContractSeal) => renderToStaticMarkup(
  createElement(ContractExecution, { seal, academyLegalNameAr: 'شركةٌ ما' }),
)

describe('ما حُفظ عن التوقيع يُعرَض لصاحبه', () => {
  /* والمقابلةُ على القيم لا على وجودِ عناوين: عنوانُ «الهاتف» يبقى ظاهرا
     ولو عُرض تحته فراغ، والمقصودُ أن يقرأ رقمَه هو. */
  it('كلُّ قيمةٍ محفوظةٍ تخرج في السجلّ — لا عنوانٌ فوق فراغ', () => {
    const html = render(SEALED)
    for (const v of [
      SEALED.signerLegalName!, SEALED.signerAddressAr!, SEALED.signerPhone!,
      SEALED.consentTextAr!, SEALED.academySignatoryName!, SEALED.academySignatoryTitle!,
      SEALED.signedBodyHash!,
    ]) {
      expect(html, `لا يُعرَض: ${v}`).toContain(v)
    }
    /* والتواريخُ تُنسَّق فلا تُطابق حرفا — فيُقاس يومُها وسنتُها */
    expect(html, 'تاريخُ التوقيع لا يُعرَض').toContain('2026')
    for (const a of readConsentAcks(SEALED.consentAcksAr)) {
      expect(html, `جملةُ إقرارٍ لا تُعرَض: ${a.textAr}`).toContain(a.textAr)
    }
  })

  /* وأقربُ ما يُنسى: الخانةُ الأخرى حين لم تُختَم. والموقِّعُ حينها أشدُّ
     حاجةً لمعرفة أين وقف عقدُه. */
  it('وما لم يُعتمَد بعد يُقال إنّه ينتظر — لا خانةٌ تُطوى بصمت', () => {
    const html = render({ ...SEALED, countersignedAt: null, academySignatoryName: null, academySignatoryTitle: null })
    expect(html).toContain('ينتظر اعتمادَنا')
    expect(html, 'وتوقيعُه هو يبقى معروضا').toContain(SEALED.signerLegalName!)
  })

  it('ولا سجلَّ لعقدٍ لم يُوقَّع — خانتان فارغتان تُوهمان بتنفيذٍ لم يقع', () => {
    expect(render({ ...SEALED, signedAt: null, countersignedAt: null })).toBe('')
  })

  /* ولا يُرسَم خطُّ يدٍ لم يخطّه صاحبُه: صورةُ توقيعٍ مصطنعةٌ تزييفٌ في وثيقة،
     والصدقُ أن يُقال إنّه توقيعٌ إلكترونيٌّ بكتابة الاسم. */
  it('ويُقال إنّ التوقيعَ إلكترونيٌّ — لا خطُّ يدٍ مصطنع', () => {
    expect(render(SEALED)).toContain('وقّع إلكترونيّا')
  })
})

describe('بصمةُ النصّ — والفراغُ لا يُقرأ تطابقا', () => {
  it('المتطابقتان تُقرآن تطابقا', () => {
    expect(bodyIntact({ bodyHash: HASH, signedBodyHash: HASH })).toBe(true)
  })

  it('والمختلفتان لا', () => {
    expect(bodyIntact({ bodyHash: HASH, signedBodyHash: 'c'.repeat(64) })).toBe(false)
  })

  /* و`null === null` صحيحٌ في JavaScript وخطأٌ هنا: عقدٌ بلا بصمةٍ محفوظةٍ
     لا يُقال عنه إنّ نصَّه سليم. وهو أوّلُ ما يُكتب خطأً. */
  it('وعقدٌ بلا بصمةٍ لا يُعلَن سليما', () => {
    expect(bodyIntact({})).toBe(false)
    expect(bodyIntact({ bodyHash: HASH })).toBe(false)
    expect(bodyIntact({ signedBodyHash: HASH })).toBe(false)
    expect(bodyIntact({ bodyHash: '  ', signedBodyHash: '  ' })).toBe(false)
  })

  it('وما لم تُحفَظ بصمتُه يُقال لصاحبه ولا يُموَّه', () => {
    const html = render({ ...SEALED, signedBodyHash: null })
    expect(html).toContain('لم تُحفَظ بصمةُ التوقيع')
    expect(html, 'ولا يُقال إنّها متطابقةٌ وهي غيرُ محفوظة').not.toContain('بصمتاهما متطابقتان')
  })
})

describe('طورُ التنفيذ — والعقدُ لا ينفُذ بتوقيعٍ واحد', () => {
  it('ثلاثةُ أطوارٍ لا اثنان', () => {
    expect(executionStage({})).toBe('unsigned')
    expect(executionStage({ signedAt: SEALED.signedAt })).toBe('signed')
    expect(executionStage(SEALED)).toBe('countersigned')
  })
})

describe('قراءةُ `consentAcksAr` — عمودُ JSON لا نوعَ له', () => {
  /* والعقودُ الموقَّعةُ قبل ٢٢ سبتمبر ٢٠٢٦ تقرؤه `null`: العمودُ أُضيف بعدها.
     فقارئٌ أعمى يسقط عند `textAr` من `undefined` في صفحةٍ يقرؤها مدرّب. */
  it('الفراغُ وما لا يُفهَم يُقرأ قائمةً فارغةً لا انهيارا', () => {
    for (const bad of [null, undefined, 'نصّ', 42, {}, [null], [42], [{}]]) {
      expect(readConsentAcks(bad)).toEqual([])
    }
  })

  it('والصفُّ الناقصُ يسقط وحدَه ولا يُسقط ما معه', () => {
    expect(readConsentAcks([
      { key: 'a', textAr: 'جملةٌ تامّة' },
      { key: 'b' },
      { textAr: 'بلا مفتاح' },
      { key: ' ', textAr: 'مفتاحٌ فراغ' },
      { key: 'c', textAr: 'جملةٌ أخرى' },
    ])).toEqual([
      { key: 'a', textAr: 'جملةٌ تامّة' },
      { key: 'c', textAr: 'جملةٌ أخرى' },
    ])
  })
})

describe('وسجلُّ التنفيذ لا يدخل المتنَ الموقَّعَ عليه', () => {
  /* المتنُ مهشَّشٌ (`bodyHash`) ويُقابَل هاشُه لحظةَ التوقيع. فمن ألحق به
     سجلَّ التوقيع نقض بصمتَه — ولا يمرّ توقيعٌ لاحقٌ على ملحقٍ ولا بديل.

     والقياسُ على أنّ **المولِّدَ لا يرى الخَتم**: لا يستورد وحدتَه، ولا
     يذكر عمودا من أعمدتها. فلا يُعوَّل على أنّ أحدا لن يُلحقه — يُعوَّل على
     أنّه لا يملك ما يُلحقه به. */
  const BODY = 'src/application/trainer/contract-body.ts'

  it('مولِّدُ المتن لا يستورد وحدةَ سجلِّ التنفيذ', () => {
    expect(read(BODY)).not.toMatch(/from ['"][^'"]*contract-execution['"]/)
  })

  it('ولا يذكر عمودا من أعمدة الخَتم — فلا يملك ما يطبعه', () => {
    const src = read(BODY)
    for (const f of SEAL_FIELDS) {
      /* و`bodyHash` مستثنى: المولِّدُ لا يحسبه، لكنّ رأسَ الملفّ يشرح أنّ
         المتنَ يُهشَّم — فذكرُه في تعليقٍ شرحٌ لا طبع. فيُقاس على الشيفرة
         بلا تعليقاتها. */
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      expect(code, `مولِّدُ المتن يذكر «${f}» — أدخلَ الخَتمَ في الموقَّع عليه؟`)
        .not.toContain(f)
    }
  })

  /* وقائمةُ الأعمدة لا تتخلّف عن الواجهة بصمت: من زاد حقلا في `ContractSeal`
     ولم يزده في `SEAL_FIELDS` تركَ اختبارَ الخادم يقيس على قائمةٍ ناقصةٍ —
     فيمرّ `select` لا يجلبه، وتعرض الشاشةُ فراغا. */
  it('و`SEAL_FIELDS` تطابق حقولَ `ContractSeal` حقلا بحقل', () => {
    const src = read('src/application/trainer/contract-execution.ts')
    const iface = /export interface ContractSeal \{([\s\S]*?)\n\}/.exec(src)
    expect(iface, 'لم تُقرأ واجهةُ `ContractSeal` — أبُدّل شكلُها؟').toBeTruthy()
    const body = iface![1].replace(/\/\*\*?[\s\S]*?\*\//g, '')
    const fields = [...body.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*)\??:/gm)].map((m) => m[1])
    expect(fields.length, 'لم يُقرأ حقلٌ واحدٌ — أفسدَ النمطُ القراءةَ؟').toBeGreaterThan(5)
    expect([...fields].sort()).toEqual([...SEAL_FIELDS].sort())
  })
})
