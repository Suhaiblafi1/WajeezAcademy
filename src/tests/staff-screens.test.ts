/* عطبان في شاشات العاملين — وحرسُهما (البندان ٢٣ · ٢٦).

   ٢٣ · **لوحُ المدرّب من ٧٢٤ سطرا يحمل كلَّ شيء**، ويُكرّر تبويبَي
        «التصحيح» و«الجدول» بالكامل. فتبويبُ التصحيح لا يُصحّح — يعرض
        قائمةً كلُّ سطرٍ فيها زرٌّ يقول «قيّمه من شعبي» — والأدواتُ في اللوح
        مدفونةً تحت ستّة أقسام. و«متعلّموني» **حرفيّا مكوّنُ الإدارة نفسُه**:
        جدولُ حساباتٍ بشكلٍ إداريّ، والمدرّبُ يسأل «كيف حالُ كلِّ طالبٍ عندي؟».

   ٢٦ · **بندُ «الاستثناءات» يفتح الشاشةَ الخطأ**: اسمُه لا يدلّ على محتواه،
        وحارسُه `enrollment.request.review` بينما الشاشةُ تقرأ مسارا محروسا
        بـ`advisor.assign`. **وطابورُ طلبات التسجيل الحقيقيُّ في شاشةٍ أخرى
        لا يراها صاحبُ تلك الصلاحيّة أصلا.**

   والمقيسُ هنا بنيةُ الشيفرة لا مظهرُها: هذه شاشاتٌ تُقرأ بالعين، والحارسُ
   يمنع عودةَ السبب لا يرسم الشكل. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const board = read('src/pages/trainer/CohortBoard.tsx')
const grading = read('src/pages/trainer/GradingQueue.tsx')
const schedule = read('src/pages/trainer/Schedule.tsx')
const learners = read('src/pages/trainer/MyLearners.tsx')
const adminNav = read('src/pages/admin/AdminLayout.tsx')

describe('٢٣ · التصحيحُ في موضعٍ واحد — لا تبويبٌ يُحيل إلى لوح', () => {
  it('طابورُ التصحيح يحمل أدواتَه: المراجعةُ والدرجةُ والتغذيةُ الراجعة', () => {
    for (const route of ['/api/trainer/submissions/', '/api/trainer/grade', '/feedback']) {
      expect(grading, `أداةُ ${route} ليست في تبويب التصحيح`).toContain(route)
    }
  })

  it('ولوحُ الشعب لم يعد يحملها — فلا تصحيحَ في موضعين', () => {
    for (const route of ['/api/trainer/submissions/', '/api/trainer/grade']) {
      expect(board, `التصحيحُ ما زال مكرَّرا في اللوح: ${route}`).not.toContain(route)
    }
  })

  it('ولم يعد يُحيل المدرّبَ إلى شاشةٍ أخرى ليُصحّح', () => {
    expect(grading, 'التبويبُ يحمل اسمَ عملٍ يفعله غيرُه').not.toContain('قيّمه من «شعبي»')
  })

  it('واللوحُ انكمش — الكثافةُ هي العلّة لا المحتوى', () => {
    expect(board.split('\n').length, 'اللوحُ ما زال يحمل ما ليس له').toBeLessThan(650)
  })
})

describe('٢٣ · ومآلُ اقتراح التأجيل حيث المواعيد', () => {
  it('«جدولي» يعرض الاقتراحاتِ ويسحبها', () => {
    expect(schedule).toContain('/api/trainer/reschedules')
    expect(schedule).toContain('/withdraw')
  })

  it('واللوحُ يقترح ولا يتابع — ويقول أين يُتابَع', () => {
    expect(board, 'المتابعةُ ما زالت مكرَّرةً في اللوح').not.toContain('/withdraw')
    expect(board, 'اقتراحٌ بلا دلالةٍ على مآله').toContain('/trainer/schedule')
  })
})

describe('٢٣ · «متعلّموني» بالتقدّم لا بالحساب', () => {
  /* يُقاس الاستيرادُ لا نصُّ الشرح: ذكرُ المكوّن في تعليقٍ يشرح ما كان
     لا يجعل الشاشةَ تعرضه. */
  it('لم تعد لوحَ الإدارة نفسَه', () => {
    expect(learners, 'المدرّبُ يقرأ جدولَ حساباتٍ بشكلٍ إداريّ')
      .not.toMatch(/^import .*LearnersPanel.*$/m)
  })

  it('بل تقرأ شعبَه وتقيس تقدّمَه وحضورَه وما ينتظر تصحيحَه', () => {
    expect(learners).toContain('/api/trainer/my-cohorts')
    expect(learners).toContain('courseProgress')
    expect(learners).toContain('attendance')
    expect(learners).toContain('/api/trainer/grading-queue')
  })

  it('وتُقدّم من يحتاجه أوّلا — لا ترتيبَ أبجديّا', () => {
    expect(learners).toMatch(/sort\(\(a, b\) => b\.concern - a\.concern/)
  })

  it('ولا يُقال «غاب» عمّن لم تبدأ شعبتُه — ما لا يُقاس لا يُلوَّن', () => {
    expect(learners).toContain('لا جلسةَ مضت بعد')
  })
})

describe('٢٦ · بندُ القائمة يحرس ما وراءه ويقول محتواه', () => {
  it('«حالات بلا مستشار» محروسٌ بصلاحيّةِ مسارها لا بصلاحيّةٍ أخرى', () => {
    const row = adminNav.split('\n').find((l) => l.includes('/admin/exceptions'))
    expect(row, 'اختفى بندُ الشاشة من القائمة').toBeTruthy()
    expect(row, 'حارسٌ لا يحرس ما وراءه — يُفتح فيُردّ عند الخادم').toContain('advisor.assign')
    expect(row, 'اسمٌ لا يدلّ على محتواه').not.toContain('الاستثناءات')
  })

  it('ومن مُنح مراجعةَ طلبات التسجيل يرى طابورَه — وكان لا يراه', () => {
    const row = adminNav.split('\n').find((l) => l.includes('/admin/finance'))
    expect(row).toContain('enrollment.request.review')
  })

  it('والقائمةُ تفهم «أيًّا من هذه الصلاحيّات» — شاشةٌ تخدم اثنتين لا تُحرَس بواحدة', () => {
    expect(adminNav).toMatch(/need\?: string \| string\[\]/)
    expect(adminNav).toContain('canAny')
  })
})
