/* عميل Prisma الموحد — Prisma 7 عبر محول pg.
   كل طبقات الخادم (Repository/Service) تستورد من هنا فقط.

   ─────────── الوعدُ يُخزَّن لا الناتج ───────────

   كان الحارس على **الناتج** (`if (client) return client`)، وبين دخولِ
   الدالّة وإسنادِ `client` رحلةٌ إلى القاعدة. فنداءان متزامنان — وهو
   الشائعُ لا النادر في أوّل طلبٍ بعد خمولِ دالّةٍ لا سيرفريّة — يُنشئان
   عميلين، ولكلِّ عميلٍ بركةُ اتّصالاتٍ خاصّة. ثمّ يفوز آخرُهما بالإسناد
   ويبقى الأوّلُ ممسكا ببركته بلا من يستعملها.

   وحدُّ اتّصالات Neon ليس كبيرا: من يستنفده لا يُرمى له خطأ سريع بل ينتظر.
   وهذا بعضُ ما يجعل الدخولَ والخروجَ «يتعطّل وبطيء جدا» أوّلَ مرّة. */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { ensureEmbeddedPostgres } from './embedded'

let connecting: Promise<PrismaClient> | null = null

/* حدُّ البركة ومهلتُها.

   أخطرُهما المهلة: افتراضُ `pg` لـ`connectionTimeoutMillis` **صفرٌ يعني
   انتظارا بلا نهاية**. فحين تُستنفد اتّصالاتُ القاعدة لا يُرمى خطأ — يعلّق
   النداءُ حتّى تقطعه المهلةُ القصوى للدالّة. وهو الفرقُ بين «الموقع بطيء»
   وبين «الموقع يتعطّل»، وقد وُصف الاثنان معا.

   والحدُّ خمسةٌ لا عشرة (افتراضُ `pg`): أثقلُ مسلكٍ عندنا أربعُ رحلاتٍ
   متتالية ورحلتان متوازيتان، فخمسةٌ تكفي النسخةَ الواحدة — وعشرةٌ في كلّ
   نسخةٍ دافئة تستنفد حدَّ Neon بعددٍ قليلٍ منها. ويُرفع بمتغيّر بيئةٍ عند
   الحاجة بلا نشرِ شيفرة. */
const POOL = {
  max: Number(process.env.DB_POOL_MAX ?? 5),
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
}

async function connect(): Promise<PrismaClient> {
  const connectionString = process.env.DATABASE_URL ?? await ensureEmbeddedPostgres()
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, ...POOL }) })
}

/** عميل حي — يستخدم DATABASE_URL إن ضُبطت، وإلا يشغّل PostgreSQL المدمج */
export function getPrisma(): Promise<PrismaClient> {
  if (!connecting) {
    connecting = connect().catch((e) => {
      /* اتّصالٌ فاشل لا يُخزَّن — النداءُ التالي يحاول من جديد */
      connecting = null
      throw e
    })
  }
  return connecting
}

export async function disconnectPrisma(): Promise<void> {
  const pending = connecting
  connecting = null
  if (pending) await (await pending).$disconnect()
}
