/* ما نقترحه على بطاقة المدرّب على سطوحه الثلاثة — بنيةٌ لا نصّ.

   قرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦): «لماذا نفتخر بك» إضافةٌ تُطرح «نريد إضافةَ كذا
   عنك» ويعدّلها المدرّبُ بعدّادِ كلمات، والنبذةُ بصياغتنا «قبل/بعد»، ورابطٌ إلى صفحة
   المدرّبين «ليلقي نظرةً أين تظهر». فيُفحص هنا:
   · أنّ الصفحةَ العامّةَ تقرأ **المقبولَ** وحدَه لا الاقتراحات، وأنّ لكلّ بطاقةٍ مرساتَها؛
   · وأنّ بطاقةَ المدرّب تطرح الإضافةَ حقولا تُعدَّل، والنبذةَ «قبل/بعد»، ومعها الرابط؛
   · وأنّ المسارات خلف صلاحيّاتها: النشرُ لما نقترح ونعتمد، والبوّابةُ لقراره؛
   · وأنّ المسوّداتِ نفسَها تجتاز القواعد — وبلا تشكيل (قرارُ ١١ أكتوبر ٢٠٢٦). */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BIO_DRAFTS, PITCH_DRAFTS } from '../../../server/services/trainer-suggestion-drafts'
import { bioSuggestionProblemAr, pitchHeadingAr, pitchProblemAr } from '@/application/trainer/pitch'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const page = code('src/pages/Trainers.tsx')
const review = code('server/services/trainer-review.service.ts')
const card = code('src/components/trainer/ProfileSuggestions.tsx')
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
    expect(list, 'القائمة العامّة تقرأ الاقتراحات — فيظهر ما لم يقبله').not.toContain('textSuggestions')
  })

  it('والبطاقة تعرضه مكان النبذة، ولكلّ بطاقة مرساتها لرابط المدرّب', () => {
    expect(page).toMatch(/pitched \? <PitchBlock t=\{t\} \/> : t\.bio/)
    expect(page).toContain('id={`trainer-${t.id}`}')
  })
})

describe('بطاقة المدرّب: إضافة تعدّل، ونبذة قبل وبعد، ورابط', () => {
  it('«نريد أن نضيف عنك هذا» حقول تعدّل وتضاف، بعدّاد كلمات', () => {
    expect(card).toContain('نريد أن نضيف عنك هذا')
    expect(card, 'السطور لا تعدّل').toMatch(/setLines\(\(cur\) => cur\.map/)
    expect(card, 'لا إضافة سطر').toMatch(/setLines\(\(cur\) => \[\.\.\.cur, ""\]\)/)
    expect(card, 'لا عدّاد كلمات').toMatch(/\{words\} \/ \{PITCH_MAX_WORDS\} كلمة/)
  })

  it('⚠️ والقبول يحمل تعديله حين عدّل — فيعود للمراجعة', () => {
    expect(card).toContain('changed ? { lines: clean } : {}')
  })

  it('والنبذة «قبل/بعد» بزرّين', () => {
    const bio = card.slice(card.indexOf('function BioPanel'))
    expect(bio).toMatch(/قبل: [\s\S]*بعد: /)
    expect(bio).toContain('`/api/trainer/suggestions/${pending.id}/accept`')
  })

  it('ورابط إلى بطاقته في صفحة المدرّبين', () => {
    expect(card).toContain('href={`/trainers#trainer-${data.profileId}`}')
  })

  it('وتظهر في إعدادات حساب المدرّب', () => {
    expect(account).toMatch(/roles\?\.includes\("trainer"\) && <ProfileSuggestions/)
  })

  it('والمسارات خلف صلاحيّاتها — النشر لما نقترح ونعتمد، والبوّابة لقراره', () => {
    for (const path of [
      "/api/admin/trainers/:profileId/suggestions'",
      "/api/admin/trainers/:profileId/suggestions/:kind/withdraw'",
      "/api/admin/trainers/:profileId/suggestions/pitch/approve-edit'",
    ]) {
      const at = adminRoutes.indexOf(path)
      expect(at, `${path}: لا مسار`).toBeGreaterThan(-1)
      expect(adminRoutes.slice(at, at + 200), `${path}: بلا حارس النشر`).toContain("requirePermission('trainer.publish')")
    }
    for (const path of ["/api/trainer/suggestions'", "/api/trainer/suggestions/:id/accept'", "/api/trainer/suggestions/:id/reject'"]) {
      const at = trainerRoutes.indexOf(path)
      expect(at, `${path}: لا مسار`).toBeGreaterThan(-1)
      expect(trainerRoutes.slice(at, at + 200), `${path}: بلا حارس البوّابة`).toContain("requirePermission('trainer.portal')")
    }
    expect(ops, 'شاشة الإدارة لا تعتمد تعديل المدرّب').toContain('`${base}/pitch/approve-edit`')
    expect(ops, 'شاشة الإدارة لا تقترح النبذة').toContain('{ kind: "bio", lines: [text] }')
  })
})

describe('المسوّدات تجتاز القواعد نفسها', () => {
  /* الحركاتُ والتنوينُ والسكون: U+064B–U+0650 وU+0652. والشدّةُ (U+0651) وحدَها تبقى */
  const HARAKAT = /[ً-ِْ]/

  it('عشر مسوّدات من كلّ نوع — لكلّ مدرّب معتمد اليوم واحدة', () => {
    expect(Object.keys(PITCH_DRAFTS).length).toBe(10)
    expect(Object.keys(BIO_DRAFTS).sort()).toEqual(Object.keys(PITCH_DRAFTS).sort())
  })

  it.each(Object.entries(PITCH_DRAFTS))('«لماذا نفتخر به» %s: ثلاثة أسطر واثنتا عشرة كلمة للسطر، بلا تشكيل', (_, lines) => {
    expect(pitchProblemAr(lines)).toBeNull()
    for (const l of lines) expect(l, `سطر مشكول: ${l}`).not.toMatch(HARAKAT)
  })

  it.each(Object.entries(BIO_DRAFTS))('⚠️ النبذة %s: بحدود النبذة، بلا تشكيل', (_, text) => {
    expect(bioSuggestionProblemAr(text)).toBeNull()
    expect(text, 'نبذة مشكولة').not.toMatch(HARAKAT)
  })

  it('والعنوان «نفتخر» باسمه الأوّل كما كتبه — والباء تتّصل بالعربيّ وتنفصل عن اللاتينيّ', () => {
    expect(pitchHeadingAr('Reine Metlej')).toBe('لماذا نفتخر بـ Reine')
    expect(pitchHeadingAr('منار قاسم محمد الوديان')).toBe('لماذا نفتخر بمنار')
  })
})
