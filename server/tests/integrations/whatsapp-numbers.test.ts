/* حفظُ أرقام واتساب — ما يُكتب في الجدول وما يُمحى منه.

   ═══ لماذا قاعدةٌ حقيقيّة ═══

   السلوكُ المحروسُ هنا كلُّه في الجدول: أنّ الفراغَ **يمحو** المفتاحَ ولا
   يحفظ فراغا، وأنّ الحفظَ **دمجٌ** لا استبدالٌ فلا يُطيح موضعا لم يُرسَل،
   وأنّ `enabled` تتبع وجودَ رقمٍ واحدٍ على الأقلّ.

   ولو حُفظ فراغٌ بدل المحو لصار `numbers.discount_proof = ''`، فقرأته
   `whatsAppFor` قيمةً موجودةً كاذبةً… لا، بل `''` زائفةٌ فيرجع — لكنّ
   الجدولَ يمتلئ بمفاتيحَ خاويةٍ لا يعرف أحدٌ متى كُتبت. والنظافةُ هنا
   ليست ترفا: هذه القيمُ تُقرأ في مسارٍ **عامٍّ بلا جلسة**.

   ═══ وما لا يُسجَّل ═══

   سجلُّ الأثر يحفظ **مواضعَ** ما ضُبط لا أرقامَه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { getWhatsAppNumbers, saveWhatsAppNumbers } from '../../services/integrations.service'

let prisma: PrismaClient
const ACTOR = '00000000-0000-0000-0000-000000000001'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 240_000)

describe('أرقامُ واتساب في جدول الإعدادات', () => {
  it('تُطبَّع في الخادم كذلك — فمن أرسل بغير الواجهة لا يُدخل رقما لا يفتح', async () => {
    await saveWhatsAppNumbers(prisma, ACTOR, { advisor: '+962 77 105 2222' })
    expect(await getWhatsAppNumbers(prisma)).toEqual({ advisor: '962771052222' })
  })

  it('والحفظُ دمجٌ لا استبدال — موضعٌ لم يُرسَل يبقى كما هو', async () => {
    await saveWhatsAppNumbers(prisma, ACTOR, { discount_proof: '00962700000000' })
    expect(await getWhatsAppNumbers(prisma)).toEqual({
      advisor: '962771052222',
      discount_proof: '962700000000',
    })
  })

  it('والفراغُ يمحو المفتاحَ ولا يحفظ فراغا — فالموضعُ يرجع إلى الرقم العامّ', async () => {
    await saveWhatsAppNumbers(prisma, ACTOR, { discount_proof: '   ' })
    const numbers = await getWhatsAppNumbers(prisma)
    expect(Object.keys(numbers)).toEqual(['advisor'])
    expect('discount_proof' in numbers).toBe(false)
  })

  it('ورقمٌ لا يصلح يُردّ ولا يُكتب شيءٌ منه', async () => {
    await expect(
      saveWhatsAppNumbers(prisma, ACTOR, { advisor: '962711111111', discount_proof: '123' }),
    ).rejects.toThrow(/discount_proof/)
    /* ولم يُكتب حتّى الصالحُ منهما: الرفضُ قبل الكتابة لا بعد نصفِها */
    expect((await getWhatsAppNumbers(prisma)).advisor).toBe('962771052222')
  })

  it('ومفتاحٌ خارجَ السجلّ يُردّ — فلا يمتلئ الجدولُ بمواضعَ لا تقرؤها شاشة', async () => {
    await expect(
      saveWhatsAppNumbers(prisma, ACTOR, { not_a_spot: '962711111111' }),
    ).rejects.toThrow(/not_a_spot/)
    expect('not_a_spot' in (await getWhatsAppNumbers(prisma))).toBe(false)
  })

  it('و`enabled` تتبع وجودَ رقم — فمحوُ الكلّ يُطفئ التكامل', async () => {
    await saveWhatsAppNumbers(prisma, ACTOR, { advisor: '' })
    const row = await prisma.integrationSetting.findUnique({ where: { provider: 'whatsapp' } })
    expect(row?.enabled).toBe(false)
    expect(await getWhatsAppNumbers(prisma)).toEqual({})

    await saveWhatsAppNumbers(prisma, ACTOR, { advisor: '962771052222' })
    const back = await prisma.integrationSetting.findUnique({ where: { provider: 'whatsapp' } })
    expect(back?.enabled).toBe(true)
  })

  it('وسجلُّ الأثر يحفظ المواضعَ لا الأرقام', async () => {
    const last = await prisma.auditEvent.findFirst({
      where: { action: 'integration.whatsapp.save' },
      orderBy: { createdAt: 'desc' },
    })
    expect(last, 'لا أثرَ للحفظ').not.toBeNull()
    const meta = JSON.stringify(last!.meta ?? {})
    expect(meta).toContain('advisor')
    expect(meta, 'الرقمُ مكتوبٌ في السجلّ').not.toContain('962771052222')
  })
})
