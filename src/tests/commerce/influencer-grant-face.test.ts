/* وجهُ منحة المؤثّر في صفحته من مصدرٍ واحد (٢٣ نوفمبر ٢٠٢٦) — والعلّةُ في رأس `influencer-grant-face.ts`.

   رأى صاحبُ المنصّة في صفحة كاسيت شعارَ كاسيت و«منحة ChatTree تغطي 60%». وقرارُه «Move to the new one».
   ① **ما حُفظ لمؤثّرٍ آخر لا يُعرض في صفحة غيره** قبل النموذج.
   ② **والاسمُ والرأسُ من وجهٍ واحد** — فلا يقول الاسمُ مؤثّرا والشعارُ غيرَه.
   ③ **ومن بقي كودُه لغير مؤثّر الصفحة يُقال له باسمه ونسبته** سطرا واحدا.
   ④ **والصفحةُ تبنيها منها** — بنيتُها: لا رأسَ في حالةٍ وحدَه، ولا اسمَ من غير `face`. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { heldByOtherAr, influencerGrantFace, storedForInfluencerPage } from '@/application/commerce/influencer-grant-face'

/* الشيفرةُ بلا تعليقاتها — فلا يُطابَق حرفٌ في تعليق */
const code = (f: string) => readFileSync(join(process.cwd(), f), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/MemberGrantPage.tsx')
const DIACRITICS = /[ً-ِْٰ]/

const KASEET = { nameAr: 'كاسيت', code: 'KASEET', brand: { logoUrl: '/influencers/kaseet.png' }, whatsAppText: 'مرحبا - كاسيت' }
const CHATTREE = { nameAr: 'ChatTree', code: 'CHATTREE' }

describe('① ما حفظ لمؤثر آخر لا يعرض في صفحة غيره', () => {
  const stored = { ref: 'r', influencer: 'CHATTREE' }
  it('⚠️ كود ChatTree في صفحة كاسيت: لا شيء — يرى نموذجها', () => {
    expect(storedForInfluencerPage(stored, 'KASEET')).toBeNull()
  })
  it('⚠️ وفي صفحة مؤثره نفسه يعرض — ولو كتب الرابط بحروف صغيرة', () => {
    expect(storedForInfluencerPage(stored, 'CHATTREE')).toBe(stored)
    expect(storedForInfluencerPage(stored, 'chattree')).toBe(stored)
  })
  it('⚠️ والصفحة بلا كود في رابطها، أو ما حفظ بلا مؤثر: كما كان', () => {
    expect(storedForInfluencerPage(stored, null)).toBe(stored)
    const bare = { ref: 'r', influencer: null }
    expect(storedForInfluencerPage(bare, 'KASEET')).toBe(bare)
    expect(storedForInfluencerPage(null, 'KASEET')).toBeNull()
  })
})

describe('② الاسم والرأس من وجه واحد', () => {
  it('⚠️ كاسيت: «منحة كاسيت» ورأسها باسمها', () => {
    const f = influencerGrantFace(KASEET)
    expect(f.nameAr).toBe('منحة كاسيت')
    expect(f.cobrand).toEqual({ nameAr: 'كاسيت', brand: KASEET.brand, whatsAppText: KASEET.whatsAppText })
  })
  it('⚠️ ChatTree بلا شعار عندنا: اسمها ولا رأس — لا رأس كاسيت مع اسمها', () => {
    const f = influencerGrantFace(CHATTREE)
    expect(f.nameAr).toBe('منحة ChatTree')
    expect(f.cobrand).toBeNull()
  })
})

describe('③ من بقي كوده لغير مؤثر الصفحة', () => {
  it('⚠️ يقال باسمه ونسبته — بلا حركات', () => {
    const line = heldByOtherAr(CHATTREE, 'KASEET', 60)
    expect(line).toBe('لديك منحة من ChatTree بخصم 60%')
    expect(line).not.toMatch(DIACRITICS)
  })
  it('⚠️ ومن انتقل كوده إلى مؤثر الصفحة لا يقال له شيء', () => {
    expect(heldByOtherAr(KASEET, 'KASEET', 70)).toBeNull()
    expect(heldByOtherAr(KASEET, 'kaseet', 70)).toBeNull()
    expect(heldByOtherAr(null, 'KASEET', 70)).toBeNull()
  })
})

describe('④ الصفحة تبني الاسم والرأس والنسبة من مصدر واحد', () => {
  it('⚠️ لا رأس في حالة وحده — يشتق من الوجه', () => {
    expect(PAGE, 'الرأس حالة تكتب وحدها').not.toMatch(/setCobrand|useState<Cobrand/)
    expect(PAGE).toMatch(/const shown = influencerGrantFace\(face\);/)
    expect(PAGE).toMatch(/const cobrand = shown\.cobrand;/)
    expect(PAGE.match(/influencerGrantFace\(/g)?.length, 'وجه ثان يبنى من غير face').toBe(1)
  })

  it('⚠️ والوجه يكتب من الخادم وحده: الصفحة حين تحمل، ثم جواب النموذج', () => {
    const sets = [...PAGE.matchAll(/setFace\(([^)]*)\)/g)].map((m) => m[1].trim())
    expect(sets.sort()).toEqual(['out.influencer ?? null', 'v.influencer ?? null'])
    /* ولا اسمُ مؤثّرٍ يُقرأ من الصفحة المحمّلة بعد النموذج */
    expect(PAGE, 'اسم المؤثر من view لا من face').not.toMatch(/view\??\.influencer/)
  })

  it('⚠️ وما حفظ يمر بقاعدة الصفحة قبل أن يعرض — والسطر باسم من بقي له كوده ونسبته المعروضة', () => {
    expect(PAGE).toMatch(/forInfluencer \? storedForInfluencerPage\(kept, urlCode\)/)
    expect(PAGE).toMatch(/heldByOtherAr\(face, pageCode, pct\)/)
  })
})
