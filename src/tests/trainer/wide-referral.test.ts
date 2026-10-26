/* رابطُ المدرّب على مستواه، وصفحتُه باسمه — المرحلة «أ» من مسار المدرّب.

   قال صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «أتِح للمدرّب رابطَ دعوةٍ لكافّة
   دوراته وليس لدورةٍ دورة»، و«عند العميل يجب أن يظهر مسارٌ خاصٌّ باسم
   المدرّب للعامّة في الرابط ليقوموا بالتسجيل فيه»، و«خاصّةً كم شخصٌ سجّل
   من خلال رابطه».

   وثلاثةُ مواضعَ تسقط بصمتٍ إن أُفلتت، فهذه حرّاسُها:

   ① **فرادةُ الرابط الواسع**: `@@unique([cohortId, profileId])` لا يمنع
      رابطَين واسعَين لمدرّبٍ واحد — PostgreSQL يعدّ كلَّ `NULL` مختلفا عن
      أخيه. فلولا الفهرسُ الجزئيُّ في الترحيل لأنشأ كلُّ نداءٍ رمزا جديدا
      وبطل ما نُشر قبله.

   ② **حدُّ الرابط الواسع**: يُقبل على ما يدرّبه صاحبُه من السلّة وحدَه. ولو
      قُبل على كلِّ ما فيها لأخذ المدرّبُ أجرَ إحالةٍ على شعبةِ زميله.

   ③ **بوّابةُ الظهور**: لا اسمَ مدرّبٍ يُعرض قبل اعتماد نشره — قاعدةُ
      المستودَع. وصفحةٌ عامّةٌ باسمه أوّلُ ما ينقضها لو أُغفلت. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const raw = (p: string) => readFileSync(join(root, p), 'utf8')
/* بلا تعليقات — كي لا يمرّ حارسٌ بذكرِ الكلمة في شرحٍ فوقها */
const code = (p: string) =>
  raw(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*(\/\/|--).*$/gm, '')

const MIGRATION = 'prisma/migrations/20260913140000_trainer_wide_referral/migration.sql'

describe('① الرابط الواسع صفّ واحد لا صفوف', () => {
  it('و`cohortId` صار يقبل الفراغ — وإلّا فلا رابط واسع أصلا', () => {
    const schema = code('prisma/schema.prisma')
    const model = schema.slice(schema.indexOf('model TrainerReferralLink'))
    const body = model.slice(0, model.indexOf('}'))
    expect(body, 'الشعبة ما زالت إلزاميّة').toMatch(/cohortId\s+String\?/)
    expect(body, 'العلاقة ما زالت إلزاميّة').toMatch(/cohort\s+Cohort\?/)
  })

  it('وفرادته بفهرس جزئيّ لا بـ`@@unique` — فالثاني لا يمنع تكرار الفراغ', () => {
    const sql = raw(MIGRATION)
    /* الفحصُ على **بنية** الفهرس: فريدٌ، على `profileId`، بشرطِ الفراغ.
       فهرسٌ بلا `WHERE` يمنع رابطَ الشعبة الثاني للمدرّب نفسِه، وفهرسٌ بلا
       `UNIQUE` لا يمنع شيئا. */
    const idx = sql.slice(sql.indexOf('CREATE UNIQUE INDEX "TrainerReferralLink'))
    expect(idx, 'لا فهرس فريد للرابط الواسع').toContain('CREATE UNIQUE INDEX')
    expect(idx.slice(0, 300)).toMatch(/ON "TrainerReferralLink"\s*\(\s*"profileId"\s*\)/)
    expect(idx.slice(0, 300), 'الفهرس غير مشروط بالفراغ — فيمنع روابط الشعب').toMatch(/WHERE\s+"cohortId"\s+IS\s+NULL/)
  })

  it('والترحيل يرفع الإلزام عن العمود — وإلّا رفض PostgreSQL الصفّ الواسع', () => {
    expect(raw(MIGRATION)).toMatch(/ALTER TABLE "TrainerReferralLink" ALTER COLUMN "cohortId" DROP NOT NULL/)
  })

  it('ومساره العامّ عمود فريد على الملفّ — لا مشتقّ في كلّ نداء', () => {
    const schema = code('prisma/schema.prisma')
    const model = schema.slice(schema.indexOf('model TrainerProfile'))
    expect(model.slice(0, model.indexOf('\n}')), 'لا عمود للمسار العامّ').toMatch(/publicSlug\s+String\?\s+@unique/)
    expect(raw(MIGRATION)).toMatch(/CREATE UNIQUE INDEX "TrainerProfile_publicSlug_key"/)
  })
})

describe('② الرابط الواسع يقبل على ما يدرّبه صاحبه وحده', () => {
  const svc = code('server/services/referral.service.ts')

  it('عند التسوية: يقاطع ما في السلّة بما يدرّبه — لا يؤخذ أوّلها', () => {
    const fn = svc.slice(svc.indexOf('async acceptAtCheckout'))
    const body = fn.slice(0, fn.indexOf('\n  }'))
    expect(body, 'لا فرع للرابط الواسع').toMatch(/link\.cohortId === null/)
    /* والقبولُ **مشتقٌّ من الإسناد**: من تُحتسب له كلُّ شعبةٍ في السلّة (`cohortLeadTrainers`) هو صاحبُ الرمز.
       وبلا هذا يصير الرمزُ الواسعُ أجرَ إحالةٍ على شعبةِ زميله — ومنذ ٢٠ أكتوبر ٢٠٢٦ لا على شعبةٍ هو مساعدٌ فيها. */
    expect(body, 'القبول غير مقيّد بإسناد صاحب الرمز').toMatch(
      /const leads = await cohortLeadTrainers\(this\.prisma, cohortIds\)\s*const owned = new Set\(cohortIds\.filter\(\(id\) => leads\.get\(id\) === link\.profileId\)\)/,
    )
    expect(body, 'لا يهمل الرمز حين لا يدرّب شيئا من السلّة').toMatch(/reason: 'not_his_cohort'/)
  })

  it('وعند ختم التسجيل: الرمز الواسع لا يختم إلّا على شعبة يدرّبها', () => {
    const enr = code('server/services/enrollment.service.ts')
    const fn = enr.slice(enr.indexOf('private async referralFor'))
    const body = fn.slice(0, fn.indexOf('\n  }'))
    expect(body, 'رمز الشعبة لا يطابق بشعبتها').toMatch(/link\.cohortId === cohortId/)
    /* ومنذ ٢٠ أكتوبر ٢٠٢٦ لمن تُحتسب له الشعبة (`cohortLeadTrainer`) — لا لمساعدٍ لا يُدفع له عنها */
    expect(body, 'الواسع يختم بلا فحص إسناد').toMatch(
      /\(await cohortLeadTrainer\(this\.prisma, cohortId\)\) === link\.profileId \? \{ profileId: link\.profileId, code: link\.code \} : null/,
    )
  })

  it('والعدّ على ختم التسجيل لا على النقرات — والمنسحب خارجه', () => {
    const fn = svc.slice(svc.indexOf('async reachOf'))
    const body = fn.slice(0, fn.indexOf('\n  }'))
    expect(body).toMatch(/enrollment\.count\(\{[\s\S]{0,120}referralProfileId: profile\.id/)
    /* والملتحقُ وحدَه منذ ٢٠ أكتوبر ٢٠٢٦ — لا قائمةُ الانتظار */
    expect(body, 'المنسحب يعدّ مسجّلا').toMatch(/status: \{ in: \['enrolled', 'completed'\] \}/)
  })
})

describe('③ صفحة المدرّب العامّة خلف بوّابة الظهور', () => {
  const cat = code('server/services/public-catalog.service.ts')
  const fn = cat.slice(cat.indexOf('async trainerPublicPage'))
  const body = fn.slice(0, fn.indexOf('\n  }'))

  it('لا تعرض لمن لم يعتمد نشر ملفّه — والبوّابة المشتركة لا شرط مكتوب بيدها', () => {
    /* الفحصُ على **الاستيراد والاستعمال** معا: شرطٌ منسوخٌ بيدٍ يمرّ اليومَ
       ويفترق غدا عن `trainer-visibility.ts` — وهي موضعُ القاعدة الواحد. */
    /* والبوّابةُ دالّةٌ منذ ١٩ أكتوبر ٢٠٢٦: اليومُ جزءٌ منها (دوراتُه هذا الفصلَ أو بعده) */
    expect(cat, 'البوّابة المشتركة غير مستوردة').toMatch(/import \{[^}]*publicTrainerWhere[^}]*\} from '\.\/trainer-visibility'/)
    expect(body, 'الصفحة لا تمرّ بالبوّابة').toMatch(/\.\.\.publicTrainerWhere\(\)/)
  })

  it('والمسار الذي لا مدرّب له غير موجود — لا موجود فارغ', () => {
    expect(body).toMatch(/if \(!profile\) throw new AuthError\('not_found'/)
  })

  it('وشعبها من الاستعلام المشترك لا من نسخة ثانية', () => {
    /* نسختان تفترقان: عدُّ المقاعد هنا يجمع المحجوزَ مع المسجَّل، وأوّلُ من
       ينسخ ينسى. فالترشيحُ وسيطٌ والجسدُ واحد. */
    expect(body, 'الصفحة تستعلم الشعب بنفسها').not.toMatch(/cohort\.findMany/)
    expect(body).toMatch(/this\.openCohorts\(\{ trainers: \{ some: \{ profileId: profile\.id \} \} \}\)/)
    const list = cat.slice(cat.indexOf('async cohorts()'))
    expect(list.slice(0, list.indexOf('\n  }')), 'القائمة العامّة لم تعد تستعمل المشترك').toMatch(/return this\.openCohorts\(\{\}\)/)
  })

  it('والبابان مفتوحان: مسار الخادم ومسار الواجهة', () => {
    expect(code('server/http/routes/public.routes.ts')).toContain("'/api/public/trainers/:slug'")
    expect(code('src/App.tsx')).toMatch(/<Route path="\/t\/:slug"/)
  })
})

describe('الباب ينسب لصاحبه، واللوحة تقول كم دخل منه', () => {
  it('الصفحة تحفظ رمز صاحبها في الجلسة — بالمفتاح نفسه الذي يقرؤه الشراء', () => {
    const page = code('src/pages/TrainerPublic.tsx')
    expect(page, 'مفتاح مكتوب بيد لا المشترك').toMatch(/import \{ REFERRAL_KEY \} from "@\/application\/commerce\/referral"/)
    expect(page).toMatch(/sessionStorage\.setItem\(REFERRAL_KEY, code\)/)
    /* والرمزُ من الخادم لا من العنوان: زائرٌ وصل بلا `?ref=` يُنسب لصاحب
       الصفحة كذلك — وهو بابُه. */
    expect(page).toMatch(/page\?\.referralCode/)
  })

  /* ب-٥ (١٣ سبتمبر ٢٠٢٦): البطاقةُ انتقلت من «الرئيسية» إلى تبويب «دعوتي».
     والمحروسُ هو هو — الرابطُ والرقمُ من نداءٍ واحد، والبوّابةُ تُقال لا
     تُخفى — وموضعُه وحدَه تبدّل. ويحرس **النقلَ نفسَه** ملفٌّ آخر
     (`referral-tab.test.ts`) كيلا تعود نسخةٌ ثانيةٌ في الرئيسية. */
  it('وصفحة «دعوتي» تعرض الرابط والرقم معا من نداء واحد', () => {
    const home = code('src/pages/trainer/Referral.tsx')
    expect(home).toContain('/api/trainer/me/referral')
    expect(home, 'الرقم محسوب في الواجهة لا مأخوذ من ختم التسجيل').toMatch(/referral\.registered/)
    /* والنسخُ صار دالّةً واحدةً بمفتاح (`copy`) منذ نزلت روابطُ الشعب
       بجانبه (١٥ سبتمبر ٢٠٢٦): رايةُ «نُسخ» كانت واحدةً، فلو بقيت أضاءت
       تحت كلّ زرٍّ معا ولم يدرِ الناسخُ أيَّها نسخ. والمحروسُ هو هو —
       رابطُ الملفّ الكامل يُنسخ بنقرة. */
    /* والمنسوخُ قصيرُه إن كان (٢٦ أكتوبر ٢٠٢٦) — يحمل إلى الرابط نفسِه — وإلّا الطويل */
    expect(home, 'لا رابط ينسخ').toMatch(/copy\("wide", kit\?\.short\.wide \?\? referral\.url\)/)
    expect(home, 'النسخ لا يبلغ الحافظة').toMatch(/writeText\(url\)/)
  })

  it('وتقول متى لا يعمل الرابط بدل أن تعطيه رابطا يردّ ٤٠٤', () => {
    const home = code('src/pages/trainer/Referral.tsx')
    expect(home).toMatch(/!referral\.publicReady/)
    const svc = code('server/services/referral.service.ts')
    const fn = svc.slice(svc.indexOf('async wideLinkFor'))
    /* و`publicReady` مشتقٌّ من البوّابة نفسِها لا ثابتا — وبشرط صفحته كلِّه منذ ٢٠ أكتوبر ٢٠٢٦ (`publicTrainerWhere`) */
    expect(fn.slice(0, fn.indexOf('\n  }'))).toMatch(
      /publicReady: \(await this\.prisma\.trainerProfile\.count\(\{\s*where: \{ id: profile\.id, \.\.\.publicTrainerWhere\(\), application: \{ status: 'active' \} \},\s*\}\)\) > 0/,
    )
  })
})
