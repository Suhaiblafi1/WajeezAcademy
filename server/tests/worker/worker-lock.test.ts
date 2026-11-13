/* قفلُ العامل يبقى ما بقي العامل — ولو خمل اتّصالُه (١٣ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة «Dedicated connection»).

   كان القفلُ يؤخذ من بركة اتّصالات Prisma، وهي تُغلق الخاملَ بعد عشر ثوانٍ — فيسقط القفلُ بين دورتين (ستّون ثانية)،
   ونسخةٌ ثانيةٌ تأخذه وتعمل معها: تذكيرٌ مرّتين وحالةٌ مرّتين. فصار على اتّصالٍ له وحدَه (`acquireWorkerLock`).
   ويُنتظر هنا أكثرُ من عشر ثوانٍ بلا عمل، ثمّ تُسأل نسخةٌ ثانية. */

import { beforeAll, describe, expect, it } from 'vitest'
import { setupTestDb, TEST_DATABASE_URL } from '../helpers/db'
import { acquireWorkerLock } from '../../worker/index'

beforeAll(async () => { await setupTestDb() }, 240_000)

describe('قفل العامل', () => {
  it('⚠️ بعد خمول أطول من مهلة البركة: النسخة الثانية لا تأخذ القفل — وتأخذه بعد فكه', async () => {
    const first = await acquireWorkerLock(TEST_DATABASE_URL)
    expect(first, 'لم يؤخذ القفل أصلا').not.toBeNull()
    try {
      await new Promise((r) => setTimeout(r, 11_500))
      const second = await acquireWorkerLock(TEST_DATABASE_URL)
      if (second) await second.release()
      expect(second, 'سقط القفل بخمول الاتصال — نسختان تعملان معا').toBeNull()
    } finally {
      await first?.release()
    }
    const third = await acquireWorkerLock(TEST_DATABASE_URL)
    expect(third, 'بقي القفل بعد فكه').not.toBeNull()
    await third?.release()
  }, 60_000)
})
