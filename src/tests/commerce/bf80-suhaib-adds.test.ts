/* المسارُ العامّ /go/BF80: الإضافةُ دورتا صهيب لافي وحدَهما، وصندوقُها تحت اختيار الثلاث، وسعرُ كلّ دورةٍ بجانبها،
   و«منظومة كاملة» ستُّ خاناتٍ صغيرة (٢٣ نوفمبر ٢٠٢٦، قرارا صاحب المنصّة).

   قال: «اجعل خيارات الإضافات فقط 2 وتكون دورات خاصّة بصهيب لافي فقط… وضع بوكس الإضافة أسفل البوكس الذي يحدّد فيه أيّ
   الدورات يريد من 3، فيختار ثمّ يضيف»، و«يجب أن تكون أسعار الدورات بجانب كلّ دورة ليعلم الشخص على ماذا سيدفع»، و«البوكس
   الذي أسفل… يُختصر بشكل 6 مربّعات بجانب بعضها». */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PUBLIC_PATHS, publicPathAddIds, publicPathOf, pathCoursePrice } from '@/application/commerce/private-path'

const PAGE = readFileSync(join(process.cwd(), 'src/pages/PrivatePath.tsx'), 'utf8')
const CHROME = readFileSync(join(process.cwd(), 'src/components/PathwayChrome.tsx'), 'utf8')

describe('BF80: إضافة صهيب لافي وسعر كل دورة', () => {
  it('⚠️ الإضافة دورتا صهيب لافي وحدهما — لا قائمة الحملة', () => {
    expect(PUBLIC_PATHS.BF80.addCourseIds).toEqual(['C-AI-101', 'C-COMX-107'])
    expect(publicPathAddIds(publicPathOf('bf80'), ['C-MKT-103', 'C-AI-101'])).toEqual(['C-AI-101', 'C-COMX-107'])
    /* ومسارٌ بلا قائمته يبقى على قائمة حملته */
    expect(publicPathAddIds({ code: 'X', campaign: 'c', courseIds: [] }, ['C-MKT-103'])).toEqual(['C-MKT-103'])
    expect(PAGE).toMatch(/publicPathCandidates\(all, publicPathAddIds\(publicPathOf\(v\.code\), v\.grantCourseIds\), courseIds\)/)
  })

  it('⚠️ صندوق الإضافة في العام تحت اختيار الثلاث — وفي الخاص مكانه', () => {
    const pick = PAGE.indexOf('data-testid="public-path-pick"')
    const pubAdd = PAGE.indexOf('{isPublic && journeyReady && addBox}')
    expect(pick).toBeGreaterThan(-1)
    expect(pubAdd, 'الإضافة فوق الاختيار').toBeGreaterThan(pick)
    expect(PAGE).toMatch(/\{!isPublic && addBox\}/)
  })

  it('⚠️ سعر كل دورة بجانبها — قبل الخصم مشطوبا وبعده', () => {
    expect(pathCoursePrice(110, 80)).toEqual({ before: 110, after: 22 })
    expect(pathCoursePrice(110, 0)).toEqual({ before: 110, after: 110 })
    expect((PAGE.match(/\{priceTag\((?:id|s\.courseId)\)\}/g) ?? []).length, 'دورة بلا سعرها').toBeGreaterThanOrEqual(3)
  })

  it('⚠️ «منظومة كاملة» في /go ست خانات صغيرة ثلاث في الصف — بلا شرح', () => {
    expect(PAGE).toMatch(/<PathwayEcosystemPanel compact \/>/)
    expect(CHROME).toMatch(/if \(compact\)[\s\S]*?grid grid-cols-3[\s\S]*?\{b\.s\}/)
    const compact = CHROME.slice(CHROME.indexOf('if (compact)'), CHROME.indexOf('if (compact)') + 900)
    expect(compact, 'عاد الشرح').not.toMatch(/\{b\.d\}/)
  })
})
