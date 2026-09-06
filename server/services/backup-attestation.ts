/* إثباتُ الاسترجاع — البند ٦٥، وشرطُ البند ٦٦.

   ─────────── لماذا هذا الملفّ ───────────

   «نسخٌ احتياطيّةٌ محقَّقةٌ بالاستعادة» كان **جملةً في وثيقة**: يُطلب من
   صاحب الخادم أن يشغّل `deploy/backup.sh --verify` مرّةً، ويُصدَّق أنّه
   فعل. والتدقيقُ السابقُ سجّل أنّ النسخَ «مصمَّمةٌ ولم تعمل» — وهذا بعينه
   ما يقع حين يكون الشرطُ وعدا لا فحصا.

   والفرقُ ليس تشدّدا: **إعادةُ ضبط الحسابات لا رجعةَ فيها**. فإن كانت
   النسخةُ لا تُسترجَع، لم يبقَ من المنصّة شيءٌ يُستعاد إليه. فالشرطُ يجب
   أن يمنع لا أن يُذكَّر به.

   ─────────── وكيف ───────────

   `backup.sh --verify` ينزّل آخرَ نسخةٍ **ويسترجعها في قاعدة خدش** ويعدّ
   صفوفَها. فإن نجح كتب صفَّه في `SystemSetting` — وهو جدولٌ كان في
   المخطَّط بلا مستعمِلٍ واحد. وهذا الملفُّ يقرؤه.

   ─────────── وحدٌّ مقصود ───────────

   الإثباتُ **يشيخ**. نسخةٌ استُرجعت في يناير لا تقول شيئا عن قاعدة مارس:
   تغيّر المخطَّطُ، وتغيّر حجمُ البيانات، وقد يكون المؤقّتُ توقّف بينهما.
   فله عمرٌ (`MAX_AGE_DAYS`)، وما شاخ يُعامَل كما لو لم يكن. */

import type { PrismaClient } from '@prisma/client'

export const ATTESTATION_KEY = 'backup.lastVerifiedRestore'

/** أقصى عمرٍ يبقى فيه الإثباتُ معتبَرا — شهرٌ، وهي دوريّةُ الاختبار الموصى بها */
export const MAX_AGE_DAYS = 31

export interface RestoreAttestation {
  at: string
  file: string
  users: number
  orders: number
  remote?: string
}

export interface AttestationState {
  ok: boolean
  attestation: RestoreAttestation | null
  ageDays: number | null
  reasonAr: string | null
}

/** آخرُ استرجاعٍ مُثبَت — و`null` إن لم يجرِ قطّ أو كان الصفُّ تالفا */
export async function lastVerifiedRestore(prisma: PrismaClient): Promise<RestoreAttestation | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key: ATTESTATION_KEY } })
  if (!row) return null
  const v = row.value as Partial<RestoreAttestation> | null
  /* صفٌّ موجودٌ بقيمةٍ لا تحمل تاريخا ليس إثباتا — يُعامَل كغيابه، ولا يُرمى
     خطأٌ: عطبُ صفٍّ في جدولٍ جانبيٍّ لا يُسقط المنصّة. */
  if (!v || typeof v.at !== 'string' || Number.isNaN(Date.parse(v.at))) return null
  return {
    at: v.at,
    file: typeof v.file === 'string' ? v.file : '—',
    users: typeof v.users === 'number' ? v.users : 0,
    orders: typeof v.orders === 'number' ? v.orders : 0,
    ...(typeof v.remote === 'string' ? { remote: v.remote } : {}),
  }
}

/** أيصلح هذا الإثباتُ لأن يُبنى عليه محوٌ لا رجعةَ فيه؟ */
export async function attestationState(
  prisma: PrismaClient,
  now = new Date(),
): Promise<AttestationState> {
  const attestation = await lastVerifiedRestore(prisma)
  if (!attestation) {
    return {
      ok: false, attestation: null, ageDays: null,
      reasonAr:
        'لا استرجاعَ مُثبَتٌ لنسخةٍ احتياطيّة. شغّل على الخادم: bash deploy/backup.sh --verify — ' +
        'ينزّل آخرَ نسخةٍ ويسترجعها في قاعدةِ خدشٍ ويعدّ صفوفَها. وقبل ذلك لا يُمحى شيءٌ لا رجعةَ فيه.',
    }
  }
  const ageDays = Math.floor((now.getTime() - Date.parse(attestation.at)) / 86_400_000)
  if (ageDays > MAX_AGE_DAYS) {
    return {
      ok: false, attestation, ageDays,
      reasonAr:
        `آخرُ استرجاعٍ مُثبَتٍ عمرُه ${ageDays} يوما (الحدّ ${MAX_AGE_DAYS}). ` +
        'وإثباتٌ قديمٌ لا يقول شيئا عن قاعدةِ اليوم — أعد: bash deploy/backup.sh --verify',
    }
  }
  return { ok: true, attestation, ageDays, reasonAr: null }
}
