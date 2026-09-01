/* دالة Vercel السحابية — تغلّف خادم Fastify كاملاً كدالة واحدة.
   تلتقط كل مسارات /api/* (و/docs للتوثيق) مع الحفاظ على المسار الأصلي.

   ─────────── لماذا يُخزَّن الوعدُ لا الناتج ───────────

   كان الحارس `if (cached) return cached` على **الناتج**، والإقلاعُ بينهما
   غيرُ ذرّيّ: `getPrisma()` ثمّ `ensureRbacSeeded()` ثمّ `buildApp()` ثمّ
   `ready()` — أربعُ خطواتٍ فيها رحلاتُ شبكةٍ إلى Neon.

   ودالّةُ Vercel تستقبل طلباتٍ متزامنة على النسخة الواحدة. فأوّلُ فتحٍ بعد
   خمول يرسل عدّة نداءات معا، فتجدها كلُّها `cached === null` وتُقلع كلُّها
   من الصفر: عدّةُ عملاء Prisma، وعدّةُ برك اتّصال، وعدّةُ نسخٍ من Fastify —
   ويفوز آخرُها بالإسناد ويُهدر الباقي وتبقى بركُه مفتوحة. وحدُّ اتّصالات
   Neon ليس كبيرا، فمن يستنفده ينتظر لا يفشل.

   وهذا هو ما وصفه صاحب المنصّة: «الخروج من الحسابات والدخول لها أحيانا
   يتعطّل وبطيء جدا» — بطءٌ وتعطّلٌ في أوّل نداءٍ بعد خمول، لا دائما.

   وخزنُ **الوعد** يجعل الإقلاع واحدا مهما تزامنت النداءات: من يجده قائما
   ينتظره ولا يبدأ إقلاعا ثانيا. وإن فشل الإقلاعُ مُسح الوعد، فلا تُخزَّن
   نسخةٌ معطوبة إلى الأبد. */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { FastifyInstance } from 'fastify'
import { getPrisma } from '../db/client'
import { ensureRbacSeeded } from '../auth/rbac-seed'
import { buildApp } from './app'

let booting: Promise<FastifyInstance> | null = null

async function boot(): Promise<FastifyInstance> {
  const prisma = await getPrisma()
  /* فحصٌ واحد لا ٩٩ كتابة: البناء يبذر، وهذا يتأكّد فقط — انظر rbac-seed.ts */
  await ensureRbacSeeded(prisma)
  const app = await buildApp(prisma)
  await app.ready()
  return app
}

function getApp(): Promise<FastifyInstance> {
  if (!booting) {
    booting = boot().catch((e) => {
      /* إقلاعٌ فاشل لا يُخزَّن: النداءُ التالي يحاول من جديد بدل أن يرث عطبا */
      booting = null
      throw e
    })
  }
  return booting
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp()
  app.server.emit('request', req, res)
}
