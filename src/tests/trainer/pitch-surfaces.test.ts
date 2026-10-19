/* «لماذا اخترناه» على سطوحه الثلاثة — بنيةٌ لا نصّ.

   قرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦): نكتب سطورا تشجّع الناس على المدرّب، وهو
   يقبلها أو يرفضها. فيُفحص هنا:
   · أنّ الصفحةَ العامّةَ تقرأ **المقبولَ** وحدَه (`pitchLines`) لا الاقتراح؛
   · وأنّ بطاقةَ المدرّب تنادي القبولَ والرفض، وهي في «إعدادات الحساب» للمدرّب؛
   · وأنّ المسارات خلف صلاحيّاتها: النشرُ للاقتراح، والبوّابةُ للقرار؛
   · وأنّ المسوّداتِ نفسَها تجتاز القواعد — ثلاثةُ أسطرٍ على الأكثر، وبلا تشكيل
     (قرارُ ١١ أكتوبر ٢٠٢٦: «بلا حركاتٍ ولا تنوينٍ ولا سكون — والشدّةُ وحدَها تبقى»). */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PITCH_DRAFTS } from '../../../server/services/trainer-pitch-drafts'
import { pitchProblemAr, pitchHeadingAr } from '@/application/trainer/pitch'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const page = code('src/pages/Trainers.tsx')
const review = code('server/services/trainer-review.service.ts')
const card = code('src/components/trainer/PitchCard.tsx')
const account = code('src/pages/student/Account.tsx')
const adminRoutes = code('server/http/routes/admin-trainer.routes.ts')
const trainerRoutes = code('server/http/routes/trainer-portal.routes.ts')
const ops = code('src/pages/admin/TrainerRunOps.tsx')

/** جسمُ دالّةٍ بالاسم — إلى أوّل سطرٍ يغلقها بمسافتين */
const body = (src: string, name: string) => {
  const at = src.indexOf(name)
  return at < 0 ? '' : src.slice(at, src.indexOf('\n  }\n', at))
}

describe('الصفحة العامّة تقرأ المقبول وحده', () => {
  it('⚠️ القائمة العامّة تحمل pitchLines — لا الاقتراحات المعلّقة', () => {
    const list = body(review, 'async listPublicTrainers()')
    expect(list, 'لم يعثر على القائمة العامّة — تعطّل الفحص نفسه').not.toBe('')
    expect(list, 'القائمة العامّة لا تحمل المقبول').toMatch(/pitch:\s*p\.pitchLines/)
    expect(list, 'القائمة العامّة تقرأ الاقتراحات — فيظهر ما لم يقبله').not.toContain('pitchSuggestions')
  })

  it('والبطاقة تعرضه مكان النبذة، والنبذة تنتقل إلى ما يفتح', () => {
    expect(page).toMatch(/pitched \? <PitchBlock t=\{t\} \/> : t\.bio/)
    expect(page).toMatch(/pitched && t\.bio &&/)
  })
})

describe('بطاقة المدرّب: قبل وبعد، وقبول أو رفض', () => {
  it('تنادي القبول والرفض بمعرّف الاقتراح', () => {
    expect(card).toContain('`/api/trainer/pitch/${data.pending.id}/${accept ? "accept" : "reject"}`')
    expect(card).toMatch(/label="قبل"[\s\S]*label="بعد"/)
  })

  it('وتظهر في إعدادات حساب المدرّب', () => {
    expect(account).toMatch(/roles\?\.includes\("trainer"\) && <PitchCard/)
  })

  it('والمسارات خلف صلاحيّاتها — النشر للاقتراح، والبوّابة للقرار', () => {
    for (const path of ['/api/admin/trainers/:profileId/pitch\'', '/api/admin/trainers/:profileId/pitch/withdraw\'']) {
      const at = adminRoutes.indexOf(path)
      expect(at, `${path}: لا مسار`).toBeGreaterThan(-1)
      expect(adminRoutes.slice(at, at + 200), `${path}: بلا حارس النشر`).toContain("requirePermission('trainer.publish')")
    }
    for (const path of ['/api/trainer/pitch\'', '/api/trainer/pitch/:id/accept\'', '/api/trainer/pitch/:id/reject\'']) {
      const at = trainerRoutes.indexOf(path)
      expect(at, `${path}: لا مسار`).toBeGreaterThan(-1)
      expect(trainerRoutes.slice(at, at + 200), `${path}: بلا حارس البوّابة`).toContain("requirePermission('trainer.portal')")
    }
    expect(ops, 'شاشة الإدارة لا ترسل الاقتراح').toContain('`/api/admin/trainers/${trainer.profileId}/pitch`')
  })
})

describe('المسوّدات تجتاز القواعد نفسها', () => {
  const drafts = Object.entries(PITCH_DRAFTS)

  it('عشر مسوّدات — لكلّ مدرّب معتمد اليوم واحدة', () => {
    expect(drafts.length).toBe(10)
  })

  it.each(drafts)('%s: ثلاثة أسطر على الأكثر وكلّ سطر في حدّه', (_, lines) => {
    expect(pitchProblemAr(lines)).toBeNull()
  })

  /* الحركاتُ والتنوينُ والسكون: U+064B–U+0650 وU+0652. والشدّةُ (U+0651) وحدَها تبقى */
  it.each(drafts)('⚠️ %s: بلا تشكيل — والشدّة وحدها تبقى', (_, lines) => {
    for (const l of lines) expect(l, `سطر مشكول: ${l}`).not.toMatch(/[ً-ِْ]/)
  })

  it('والعنوان باسمه الأوّل كما كتبه', () => {
    expect(pitchHeadingAr('Reine Metlej')).toBe('لماذا اخترنا Reine')
    expect(pitchHeadingAr('منار قاسم محمد الوديان')).toBe('لماذا اخترنا منار')
  })
})
