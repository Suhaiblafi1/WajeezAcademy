/* تذكيرُ التوثيق — اثنان ثمّ صمتٌ دائم (ي-٥).

   ═══ ولمَ بالقاعدة لا بقراءة الدالّة ═══

   الدعوى هنا ليست «أنّ في الوظيفة نداءَ إرسال» — بل **متى يقع ومتى يمتنع**.
   وأربعةُ أبوابٍ للامتناع، كلُّها تُقاس بصفوفٍ تُقرأ لا بنصٍّ يُطابَق:
   من وثّق، ومن بلغه الاثنان، ومن مضت نافذتُه، ومن أُوقف حسابُه.

   والوقتُ يُحقَن (`now`) ولا يُنتظَر: اختبارٌ ينتظر يوما ليس اختبارا.

   ═══ وما لوحظ حين نُقضت هذه الحرّاسُ واحدا واحدا ═══

   ثلاثةٌ منها تحمرّ بنقضِ سطرٍ واحد. أمّا **«ومن وثّق لا يُذكَّر»** فله
   بابان مستقلّان: شرطُ `emailVerifiedAt: null` في الاستعلام، و
   `issueEmailVerification` التي تردّ `null` لمن وثّق. فنزعُ أحدِهما وحدَه
   يُبقيه أخضرَ بحقّ — ولا يحمرّ إلّا بنزعهما معا، وقد جُرّب.

   ويُكتب هذا كي لا يُقرأ يوما أنّه «حارسٌ لا يسقط»: يسقط، ولكن بعد أن يسقط
   البابان. وحصانةٌ من طبقتَين مقصودةٌ هنا — إرسالُ تذكيرٍ إلى من وثّق
   للتوّ يقول له إنّنا لا نعرف حالَ حسابه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { sendVerificationReminders } from '../../worker/jobs'

let prisma: PrismaClient
let auth: AuthService

const S = Date.now().toString(36).slice(-5)
const HOUR = 3_600_000
const DAY = 24 * HOUR

/** حسابٌ غيرُ موثَّقٍ أُنشئ قبل كذا — والقاعدةُ تكتب `createdAt` فيُرجَع بيدٍ */
async function unverifiedAgedBy(ms: number, tag: string): Promise<string> {
  const u = await auth.register(`vr-${tag}-${S}@test.local`, 'Learner#12345', `متعلّمُ ${tag}`)
  await prisma.user.update({
    where: { id: u.userId },
    data: { createdAt: new Date(Date.now() - ms), emailVerifiedAt: null },
  })
  return u.userId
}

const bellsFor = (userId: string) =>
  prisma.notification.findMany({
    where: { userId, templateKey: { startsWith: 'account.verify.reminder.' } },
    select: { templateKey: true },
  })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  /* قناةُ بريدٍ موصولةٌ في القاعدة — والوظيفةُ تسأل عنها قبل أن تمسّ أحدا.
     ولا يخرج بريدٌ حقيقيٌّ رغم ذلك: بوّابةُ `MAIL_LIVE` تردّ الإرسالَ في غير
     الإنتاج، فتُقرأ الرسالةُ `failed` — وهو بعينه ما يُفحَص أدناه: الجرسُ
     يُكتب وإن سقط المزوّد، فلا يُطرَق البابُ ثانيةً. */
  await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled: true, config: { apiKey: 'test-key', fromEmail: 'no-reply@test.local' } },
    create: { provider: 'email', enabled: true, config: { apiKey: 'test-key', fromEmail: 'no-reply@test.local' } },
  })
}, 240_000)

describe('تذكيرُ توثيق البريد', () => {
  it('لا يقع قبل يومٍ من إنشاء الحساب', async () => {
    const id = await unverifiedAgedBy(6 * HOUR, 'fresh')
    await sendVerificationReminders(prisma)
    expect(await bellsFor(id), 'ذُكِّر من أنشأ حسابَه قبل ساعات').toEqual([])
  })

  it('ويقع الأوّلُ بعد يوم — ولا يقع الثاني معه', async () => {
    const id = await unverifiedAgedBy(2 * DAY, 'day2')
    await sendVerificationReminders(prisma)
    expect(
      (await bellsFor(id)).map((b) => b.templateKey),
      'لم يصل التذكيرُ الأوّلُ بعد يومَين',
    ).toEqual(['account.verify.reminder.1'])
  })

  it('ثمّ الثاني بعد أربعةٍ — ثمّ لا ثالثَ مهما أُعيدت الدورة', async () => {
    const id = await unverifiedAgedBy(9 * DAY, 'day9')
    /* دورتان: الأولى تُرسل الأوّلَ، والثانيةُ الثانيَ — فلا يخرج تذكيران
       في لحظةٍ واحدةٍ على صاحبٍ واحد. */
    await sendVerificationReminders(prisma)
    await sendVerificationReminders(prisma)
    expect(
      (await bellsFor(id)).map((b) => b.templateKey).sort(),
      'لم يبلغه الاثنان',
    ).toEqual(['account.verify.reminder.1', 'account.verify.reminder.2'])

    /* وثلاثُ دوراتٍ أُخَر لا تزيد شيئا — العلمُ من القاعدة لا من ذاكرة الوظيفة */
    for (let i = 0; i < 3; i += 1) await sendVerificationReminders(prisma)
    expect((await bellsFor(id)).length, 'وصل تذكيرٌ ثالث').toBe(2)
  })

  it('ومن وثّق لا يُذكَّر بما فعله', async () => {
    const id = await unverifiedAgedBy(9 * DAY, 'done')
    await prisma.user.update({ where: { id }, data: { emailVerifiedAt: new Date() } })
    await sendVerificationReminders(prisma)
    expect(await bellsFor(id), 'ذُكِّر بالتوثيق من وثّق').toEqual([])
  })

  it('ومن مضت نافذتُه لا يُذكَّر — فالمحاولةُ لا تدوم أبدا', async () => {
    /* بلا هذا الحدِّ تبقى الوظيفةُ تحاول كلَّ ساعةٍ سنةً كاملةً على عنوانٍ
       لا يقبل: الإرسالُ يسقط فلا يُكتب صفٌّ، وما لا صفَّ له يُختار ثانية. */
    const id = await unverifiedAgedBy(60 * DAY, 'stale')
    await sendVerificationReminders(prisma)
    expect(await bellsFor(id), 'ذُكِّر حسابٌ مضى على إنشائه شهران').toEqual([])
  })

  it('والموقوفُ لا يُذكَّر بخطوةٍ لا تنفعه', async () => {
    const id = await unverifiedAgedBy(2 * DAY, 'susp')
    await prisma.user.update({ where: { id }, data: { status: 'suspended' } })
    await sendVerificationReminders(prisma)
    expect(await bellsFor(id), 'ذُكِّر حسابٌ موقوف').toEqual([])
  })

  /* ═══ وهذا هو العطبُ الذي كشفه نقضُ هذا الملفّ، لا قراءتُه ═══

     كانت الوظيفةُ تمرّ على الحسابات ثمّ تسأل عن القناة عند الإرسال. و
     `issueEmailVerification` **تسكّ رمزا جديدا وتكتبه في الصفّ** — فتُبطل
     ما قبله. فبقناةٍ مغلقةٍ كانت تدور كلَّ ساعةٍ تسكّ رمزا لكلّ حسابٍ غيرِ
     موثَّقٍ ثمّ تسقط: ورابطُ التوثيق الذي وصل صاحبَه ساعةَ سجّل يموت بعد
     ساعة لا بعد ثمانٍ وأربعين. يضغطه فيُقال له «غيرُ صالح» فيظنّ العطبَ
     فينا — وأثرُه في حسابِ من لم نرسل إليه شيئا أصلا. */
  it('وبقناةٍ مغلقةٍ لا يُمَسّ رمزُ أحد — فلا تُبطَل روابطُ توثيقٍ قائمة', async () => {
    const id = await unverifiedAgedBy(2 * DAY, 'closed')
    const issued = await auth.issueEmailVerification(id)
    const before = await prisma.user.findUnique({
      where: { id }, select: { emailVerifyTokenHash: true },
    })
    expect(issued, 'لم يُسَكّ رمزٌ أصلا فالفحصُ لا يفحص شيئا').not.toBeNull()

    await prisma.integrationSetting.update({ where: { provider: 'email' }, data: { enabled: false } })
    const out = await sendVerificationReminders(prisma)
    await prisma.integrationSetting.update({ where: { provider: 'email' }, data: { enabled: true } })

    expect(out.done, 'ذُكِّر أحدٌ وقناةُ البريد مغلقة').toBe(0)
    const after = await prisma.user.findUnique({
      where: { id }, select: { emailVerifyTokenHash: true },
    })
    expect(
      after!.emailVerifyTokenHash,
      'أُبطل رمزُ توثيقٍ قائمٌ في دورةٍ لم تُرسل شيئا — فمات رابطٌ في يد صاحبه',
    ).toBe(before!.emailVerifyTokenHash)
    expect(await bellsFor(id), 'كُتب جرسٌ بلا قناةٍ تُرسل').toEqual([])
  })

  it('ورمزُ التوثيق يُجدَّد مع كلِّ تذكير — فلا يصل رابطٌ ميّت', async () => {
    /* صلاحيّةُ الرمز ثمانٍ وأربعون ساعة، والتذكيرُ الثاني في اليوم الرابع.
       فلو أُعيد إرسالُ الرمز الأوّل لَوصل رابطٌ منتهٍ ساعةَ يصل — وهو أسوأُ
       من ألّا يصل: يضغطه صاحبُه فيُقال له «غيرُ صالح» فيظنّ العطبَ فينا. */
    const id = await unverifiedAgedBy(2 * DAY, 'token')
    await sendVerificationReminders(prisma)
    const after = await prisma.user.findUnique({
      where: { id }, select: { emailVerifyExpiresAt: true, emailVerifyTokenHash: true },
    })
    expect(after!.emailVerifyTokenHash, 'ذُكِّر بلا رمزٍ يُوثّق به').not.toBeNull()
    expect(
      after!.emailVerifyExpiresAt!.getTime(),
      'الرمزُ المرسَلُ ينتهي قبل أن يُقرأ',
    ).toBeGreaterThan(Date.now() + HOUR)
  })
})
