/* قالبُ قاعدةِ الاختبار — العزلُ باقٍ، والكلفةُ عُشرُها.

   ── ما يحرسه هذا الملفّ ──

   صارت قاعدةُ الاختبار تُبنى مبذورةً **مرّةً واحدةً** في `global-setup`، ثمّ
   يأخذ كلُّ ملفٍّ نسخةً عنها بـ`CREATE DATABASE … TEMPLATE …`. والجولةُ هبطت
   من خمسَ عشرةَ إلى ستِّ دقائق (وكانت تُلغى عند سقفِ الثلاثين).

   **والخطرُ في التسريع أن يُشترى بالعزل.** فلو «حُسّنت» يوما بإعادة استعمال
   القاعدة كما هي بين الملفّات، لصار ملفٌّ يقرأ ما كتبه غيرُه — وأسوأُ من ذلك
   أنّ الأثرَ لا يظهر إلّا بترتيبِ تشغيلٍ بعينه، فيُقرأ عطبا في اختبارٍ بريء.
   وقد وقع هذا في هذا المستودَع فعلا: اختبارُ إعادةِ ضبط الحسابات يمحو كلَّ
   حسابٍ غيرِ محميّ، فسقطت ثلاثةُ اختباراتِ مصادقةٍ في CI برسالة «المستخدم غير
   موجود» — وتمرّ محلّيّا حين تُشغَّل وحدَها.

   فالمحروسُ هنا **سلوكٌ لا شكل**: تُكتب علامةٌ، ثمّ يُعاد البناء، ثمّ يُسأل
   أثمّ هي — ويُسأل معها أنّ البذرَ حاضرٌ في النسخة، فنسخةٌ نظيفةٌ بلا بذرٍ
   عزلٌ بلا قاعدةٍ يُبنى عليها. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { rebuildTestDb, setupTestDb, testPrisma } from '../helpers/db'

let prisma: PrismaClient
const MARK = 'test.template.mark'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 240_000)

describe('نسخةُ القالب نظيفةٌ ومبذورة', () => {
  it('البذرُ حاضرٌ في النسخة — صلاحيّاتٌ وكتالوج', async () => {
    /* نسخةٌ فارغةٌ تعزل ولا تصلح للبناء عليها: كلُّ ملفٍّ يفترض هذين */
    expect(await prisma.permission.count(), 'الصلاحياتُ لم تُبذَر في القالب').toBeGreaterThan(0)
    expect(await prisma.question.count(), 'الكتالوجُ لم يُستورَد في القالب').toBeGreaterThan(100)
  })

  it('وما كُتب في ملفٍّ لا يعبر إلى نسخةٍ بعده', async () => {
    await prisma.systemSetting.upsert({
      where: { key: MARK }, create: { key: MARK, value: { at: 'الآن' } }, update: { value: {} },
    })
    expect(await prisma.systemSetting.count({ where: { key: MARK } })).toBe(1)
    await prisma.$disconnect()

    /* إعادةُ البناء تنسخ القالبَ من جديد — وهو ما يفعله كلُّ ملفّ عند إقلاعه */
    await rebuildTestDb()
    const fresh = await testPrisma()
    try {
      expect(
        await fresh.systemSetting.count({ where: { key: MARK } }),
        'العلامةُ نجت — القاعدةُ تُعاد استعمالُها بدل أن تُنسَخ، والعزلُ ذهب',
      ).toBe(0)
      /* والبذرُ ما زال حاضرا بعد إعادة البناء */
      expect(await fresh.permission.count()).toBeGreaterThan(0)
    } finally {
      await fresh.$disconnect()
    }
    prisma = await testPrisma()
  })
})
