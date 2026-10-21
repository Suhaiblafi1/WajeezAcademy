/* فلاترُ «ما ينتظر قرارك» في «تشغيل المدرّبين» — بالسلوك لا بالنصّ.

   قرارُ صاحب المنصّة (٢١ أكتوبر ٢٠٢٦): «أعطني فلاترَ على ما ينتظرني، فلا أقرأ الكلَّ حين أنظر فيمن أعتمد
   صورتَه أو نصَّه، أو أرسل لمن لم أرسل له». فيُحرس هنا:
   ١) أنّ كلَّ فلترٍ يجمع من ينتظره وحدَه — والمدرّبُ في أكثرَ من واحدٍ إن اجتمعت له؛
   ٢) وأنّ «نصوص تنتظرك» تجمع ما كتبه هو وما عدّله من «لماذا نفتخر» — وكلاهما ينتظر اعتمادَنا؛
   ٣) وأنّ الشاشةَ تفرز به، وتفتح بطاقاتِ من فيه، وترفع فلترَ الحال.

   ورُئي ساقطا: أُسقط `edited` من «نصوص تنتظرك» فغاب من عدّل «لماذا نفتخر»، وأُسقط الفرزُ من القائمة
   فبقي الكلُّ ظاهرا. ثمّ أُعيدا. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { draftKindsAr, hasNeed, TRAINER_NEEDS, trainersAr, type NeedInput } from '@/application/trainer/trainer-needs'

const none: NeedInput = { pendingPhotoUrl: null, pendingText: null, pitchLatest: null, pitchDraft: null, bioDraft: null }
const ids = (t: NeedInput) => TRAINER_NEEDS.filter((n) => hasNeed(t, n.id)).map((n) => n.id)

describe('من في كلّ فلتر', () => {
  it('⚠️ لا شيء ينتظر — لا فلتر', () => {
    expect(ids(none)).toEqual([])
    expect(ids({ ...none, pitchLatest: { status: 'pending' } }), 'عُدّ ما عند المدرّب نصّا ينتظرنا').toEqual([])
  })

  it('⚠️ صورة رفعها', () => {
    expect(ids({ ...none, pendingPhotoUrl: '/api/x.jpg' })).toEqual(['photo'])
  })

  it('⚠️ ونصّ كتبه — أو «لماذا نفتخر» عدّله وعاد إلينا', () => {
    expect(ids({ ...none, pendingText: { headline: 'مدرب', bio: null, name: null, at: '' } })).toEqual(['text'])
    expect(ids({ ...none, pitchLatest: { status: 'edited' } }), 'غاب من عدّل «لماذا نفتخر»').toEqual(['text'])
  })

  it('⚠️ واقتراح لم يرسل — أيّ المسوّدتين', () => {
    expect(ids({ ...none, pitchDraft: ['سطر'] })).toEqual(['unsent'])
    expect(ids({ ...none, bioDraft: 'نبذة' })).toEqual(['unsent'])
  })

  it('والمدرّب في أكثر من واحد إن اجتمعت له', () => {
    expect(ids({ ...none, pendingPhotoUrl: '/api/x.jpg', bioDraft: 'نبذة' })).toEqual(['photo', 'unsent'])
  })
})

describe('وما يقال', () => {
  it('عدد المدربين بصيغته، وما يصل كلّا', () => {
    expect(trainersAr(12)).toBe('12 مدربا')
    expect(trainersAr(5)).toBe('5 مدربين')
    expect(draftKindsAr(['pitch', 'bio'])).toBe('«لماذا نفتخر» والنبذة')
  })
})

describe('والشاشة تفرز به', () => {
  const ops = readFileSync(join(process.cwd(), 'src/pages/admin/TrainerRunOps.tsx'), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

  it('⚠️ القائمة لا تعرض إلّا من في الفلتر', () => {
    expect(ops, 'القائمة لا تفرز بما ينتظرك').toMatch(/\.filter\(\(r\) => \(filter === "all" \|\| r\.state === filter\) && \(need === "any" \|\| hasNeed\(r\.t, need\)\)/)
  })

  it('⚠️ واختياره يرفع فلتر الحال ويفتح بطاقات من فيه', () => {
    expect(ops).toMatch(/const pickNeed = [\s\S]*?setFilter\("all"\);\s*setOpenIds\(new Set\(rows\.filter\(\(r\) => hasNeed\(r\.t, next\)\)/)
    expect(ops).toContain('ariaLabel="ما ينتظر قرارك" value={need} onChange={pickNeed}')
  })
})
