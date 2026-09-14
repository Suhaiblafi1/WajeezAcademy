/* الحذفُ جملةً — والعطبُ الذي يحرسه هذا الملفّ ليس في المحو.

   ثلاثةُ أعطابٍ بعينها:

   ١) **آخرُ مديرِ نظامٍ أعلى يُحسب على الحساب لا على الدفعة.** فلو سُئل كلٌّ
      وحدَه «أأنت الأخير؟» أجاب اثنان من اثنين «لا، ثمّة غيري» — فيُحذفان معا
      وتُقفَل المنصّةُ على الجميع. وهو عطبٌ يمرّ على كلّ حالةٍ مفردةٍ ويسقط
      على الدفعة وحدَها، فلا يراه إلّا من فكّر فيه.

   ٢) **رسالةُ «تمّ» بعد دفعةٍ نصفُها مردود.** فمن اختار أربعين ورأى «تمّ»
      مضى ظانّا أنّ الأربعين ذهبت، وتسعةٌ منها قائمةٌ تحمل شهاداتٍ وفواتير.

   ٣) **تأكيدٌ يُكتب بلا قراءة.** «اكتب delete» تُكتب بالعادة؛ والعددُ يُقرأ:
      من ظنّ أنّه يحذف ثلاثةً فرأى نفسَه يكتب ٣١ توقّف. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  decideBulk, deletableIds, bulkConfirmMatches, bulkExecuteBlockerAr, TOP_ROLE, MAX_BULK_PURGE,
} from '@/application/admin/bulk-purge'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const plain = (id: string) => ({ id, email: `${id}@x.test`, displayName: id, roles: [] as string[], blockers: [] as string[] })
const top = (id: string) => ({ ...plain(id), roles: [TOP_ROLE] })

describe('القرارُ على الدفعة لا على الحساب', () => {
  /* ═══ الحارسُ الأوّل، وهو سببُ الملفّ ═══ */
  it('مديران أعلَيان في المنصّة وكلاهما في الدفعة: يُردّان معا', () => {
    const out = decideBulk([top('a'), top('b')], { actorId: 'zz', topAdminsBefore: 2 })
    expect(deletableIds(out), 'حُذف المديران الأعلَيان معا فبقيت المنصّةُ بلا مديرٍ أعلى').toEqual([])
    for (const d of out) expect(d.whyAr).toContain('مديرٍ أعلى')
  })

  it('وواحدٌ منهما في الدفعة: يُحذف، فيبقى الآخر', () => {
    const out = decideBulk([top('a')], { actorId: 'zz', topAdminsBefore: 2 })
    expect(deletableIds(out)).toEqual(['a'])
  })

  it('وثلاثةٌ من أربعة: تُحذف الثلاثةُ ويبقى الرابعُ خارجَ الدفعة', () => {
    const out = decideBulk([top('a'), top('b'), top('c')], { actorId: 'zz', topAdminsBefore: 4 })
    expect(deletableIds(out)).toEqual(['a', 'b', 'c'])
  })

  it('والأخيرُ وحدَه يُردّ', () => {
    const out = decideBulk([top('a')], { actorId: 'zz', topAdminsBefore: 1 })
    expect(deletableIds(out)).toEqual([])
  })
})

describe('ما يُردّ ولماذا', () => {
  it('لا يحذف الضاغطُ حسابَه من هنا', () => {
    const [d] = decideBulk([plain('me')], { actorId: 'me', topAdminsBefore: 3 })
    expect(d.deletable).toBe(false)
    expect(d.whyAr).toContain('حسابَك')
  })

  it('ومن حمل سجلّا يُردّ، وسجلُّه مكتوبٌ في السبب لا مُجمَل', () => {
    const t = { ...plain('x'), blockers: ['3 شهادات', '2 طلبَ شراءٍ وفواتيرَه'] }
    const [d] = decideBulk([t], { actorId: 'zz', topAdminsBefore: 3 })
    expect(d.deletable).toBe(false)
    expect(d.whyAr).toContain('3 شهادات')
    expect(d.whyAr).toContain('2 طلبَ شراءٍ وفواتيرَه')
    /* ويُقال له ما يفعل بدلا منه — لا «تعذّر الحذف» وحدَها */
    expect(d.whyAr).toContain('أوقفه')
  })

  it('والفارغُ يُحذف بلا سبب', () => {
    const [d] = decideBulk([plain('x')], { actorId: 'zz', topAdminsBefore: 3 })
    expect(d).toEqual({ id: 'x', deletable: true, whyAr: null })
  })

  it('والدفعةُ تُقسَم قسمين: لا كلُّها تمضي ولا كلُّها تُردّ', () => {
    const out = decideBulk(
      [plain('a'), { ...plain('b'), blockers: ['شهادة'] }, plain('c')],
      { actorId: 'zz', topAdminsBefore: 3 },
    )
    expect(deletableIds(out)).toEqual(['a', 'c'])
  })
})

describe('التأكيدُ عددٌ يُقرأ لا كلمةٌ تُكتب بالعادة', () => {
  it('الكلمةُ لا تمرّ ولو كانت الصحيحةَ في نظر كاتبها', () => {
    expect(bulkConfirmMatches('delete', 3)).toBe(false)
    expect(bulkConfirmMatches('احذف', 3)).toBe(false)
  })

  it('والعددُ الخاطئُ لا يمرّ — وهو الحارسُ نفسُه', () => {
    expect(bulkConfirmMatches('4', 3)).toBe(false)
    expect(bulkConfirmMatches('30', 3)).toBe(false)
  })

  it('والصفرُ لا يمرّ ولو طابق', () => {
    expect(bulkConfirmMatches('0', 0)).toBe(false)
  })

  it('والصحيحُ يمرّ، وتُتجاوَز المسافاتُ حولَه', () => {
    expect(bulkConfirmMatches('3', 3)).toBe(true)
    expect(bulkConfirmMatches(' 31 ', 31)).toBe(true)
  })
})

describe('مانعُ التنفيذ يقول العددَ لا «تعذّر»', () => {
  const decisions = [
    { id: 'a', deletable: true, whyAr: null },
    { id: 'b', deletable: false, whyAr: 'له شهادة' },
    { id: 'c', deletable: true, whyAr: null },
  ]

  it('دفعةٌ لا يُحذف منها شيء تُردّ بسببها', () => {
    const blocker = bulkExecuteBlockerAr([decisions[1]], '1')
    expect(blocker).toBe('لا حسابَ في هذه الدفعة يُحذف')
  })

  it('والعددُ الخاطئُ يُردّ بالعدد الصحيح مكتوبا — لا برسالةٍ صمّاء', () => {
    expect(bulkExecuteBlockerAr(decisions, '3')).toContain('2')
  })

  it('والصحيحُ يمرّ', () => {
    expect(bulkExecuteBlockerAr(decisions, '2')).toBeNull()
  })

  /* ═══ ولمَ العددُ عددُ ما يُحذف لا عددُ ما اختير ═══
     من اختار ثلاثةً ورأى «اكتب ٣» لم يقرأ شيئا. ومن رآها «اكتب ٢» سأل: ولمَ
     اثنان؟ — فقرأ. وهذا الفرقُ هو الميزةُ كلُّها. */
  it('العددُ المطلوبُ هو ما سيُحذف فعلا لا ما اختير', () => {
    expect(bulkExecuteBlockerAr(decisions, String(decisions.length))).not.toBeNull()
  })
})

/* ═══ والشاشةُ تعرض القسمةَ ولا تحسبها ═══

   فحصٌ على البنية: الصفحةُ تُنادي بابَ المعاينة قبل بابِ التنفيذ، ولا تعيد
   بناءَ القاعدة عندها. ولو نسخت الشرطَ صار له صاحبان — وهو أسوأُ انحرافٍ في
   هذه المنصّة: يمضيان معا حتّى يتغيّر أحدُهما. */
describe('شاشةُ الحسابات لا تكتب القاعدةَ ثانيةً', () => {
  const src = read('src/pages/admin/Users.tsx')
  /* التعليقاتُ تشرح القاعدةَ فتسمّيها — والفحصُ على ما يُنفَّذ لا على شرحه */
  const code = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

  /* ═══ ولمَ يُقصّ الموضعُ ولا يُفحَص الملفُّ كلُّه ═══

     `super_admin` مكتوبٌ في هذه الصفحة بحقٍّ: جدولُ أسماء الأدوار بالعربيّة
     يحتاجه. فمن منعه في الملفّ كلِّه حرسَ ما لا يُحرَس وحمّر ما لا ذنبَ له
     — وهو عطبٌ وقع في هذه الجلسة مرّةً. فالفحصُ على موضع الدفعة وحدَه:
     مُناديها وحوارُها. */
  const handlers = /const openBulkPreview[\s\S]*?const runBulkPurge[\s\S]*?\n {2}\};/.exec(code)?.[0] ?? ''
  const dialog = /\{preview && \([\s\S]*?<\/ConfirmAction>/.exec(code)?.[0] ?? ''

  it('موضعُ الدفعة موجودٌ أصلا — وإلّا فما بعدَه يحرس الفراغ', () => {
    expect(handlers, 'مُنادي المعاينة والتنفيذ غيرُ موجود').toBeTruthy()
    expect(dialog, 'حوارُ المعاينة غيرُ موجود').toBeTruthy()
  })

  it('تُنادي المعاينةَ والتنفيذَ كليهما', () => {
    expect(handlers).toContain('/api/admin/users/bulk-purge/preview')
    expect(handlers).toContain('"/api/admin/users/bulk-purge"')
  })

  it('ولا تفحص الأدوارَ ولا «آخرَ مديرٍ أعلى» بنفسها', () => {
    const bulk = handlers + dialog
    expect(bulk, 'موضعُ الدفعة يفحص الدورَ الأعلى بيده').not.toContain(TOP_ROLE)
    expect(bulk, 'موضعُ الدفعة يقرأ أدوارَ الحساب ليقرّر').not.toMatch(/roles[.[]/)
    expect(bulk, 'موضعُ الدفعة يبني بصمةَ الحساب بيده').not.toContain('blockers')
  })

  it('وقسمةُ الحوار من علَم الخادم لا من حسابٍ عندها', () => {
    /* `r.deletable` تُقرأ ولا تُكتب: الشاشةُ ترشّح بها، ولا تُسندها */
    expect(dialog, 'الحوارُ لا يرشّح بعلَم الخادم').toMatch(/\(r\) => r\.deletable/)
    expect(dialog, 'الحوارُ يُسند القرارَ بنفسه').not.toMatch(/deletable\s*[=:][^=]/)
  })

  it('وتعرض سببَ الردّ لكلّ مردود — لا عددا مجرّدا', () => {
    expect(dialog, 'سببُ الردّ لا يُعرض').toContain('whyAr')
  })

  it('والخبرُ يقول الرقمَين حين يُردّ بعضُ الدفعة', () => {
    const msg = /res\.refused > 0[\s\S]{0,220}?;/.exec(handlers)?.[0] ?? ''
    expect(msg, 'الرسالةُ لا تفرّق بين دفعةٍ تامّةٍ وأخرى نصفُها مردود').toBeTruthy()
    expect(msg).toContain('res.purged')
    expect(msg).toContain('res.refused')
  })
})

describe('حاجزُ المدخَل', () => {
  it('للدفعة سقفٌ معلَن', () => {
    expect(MAX_BULK_PURGE).toBeGreaterThan(0)
    expect(MAX_BULK_PURGE).toBeLessThanOrEqual(500)
  })
})
