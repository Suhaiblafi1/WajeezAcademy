/* نبضةُ العامل الخلفيّ — «هل الحاويةُ الثانيةُ حيّة؟» بجوابٍ لا يحتاج صدفةً على الخادم.

   ─────────── العطبُ الذي وُلد منه هذا الملفّ ───────────

   شُغّل العاملُ على الإنتاج في ٧ سبتمبر ٢٠٢٦، ثمّ سُئل السؤالُ البديهيُّ
   بعده: **هل حاويتُه Up؟** ولم يكن للجواب طريقٌ إلّا صدفةٌ على الخادم.
   ولا شيءَ في المنصّة كان يقوله: العاملُ لا ينشر منفذا، وفحصُ صحّتِه مُطفأٌ
   بقصد (`deploy/compose.prod.yml`) لأنّ فحصَ الصورة يسأل `/api/version`
   ولا خادمَ ويبٍ عنده. فسقوطُه **صامتٌ تماما**: الموقعُ يعمل، والصفحاتُ
   تُخدَم، و`‎/api/health` يقول `ok` — وطابورُ الإشعارات يمتلئ ولا يُفرَّغ،
   وتذكيراتُ الجلسات لا تُرسَل، والنشرُ المجدولُ يمرّ موعدُه ولا يُنشَر عنده
   شيء. أي أنّ كلَّ «سنُعلمك» في الواجهة يعود وعدا لا يُنفَّذ، ولا أحدَ يعلم.

   وهذا هو عطبُ `‎/api/version` الأوّلُ نفسُه بثوبٍ آخر: «لماذا أرى موقعا
   قديما؟» بقي أسبوعا لأنّ الجوابَ لم تكن له **نقطةٌ تُسأل**. فالعلاجُ هو
   العلاجُ: يقيسُ الخادمُ نفسَه بنفسِه، ويُعرَض ما قاس حيث يُنظَر.

   ─────────── ولماذا نبضةٌ صريحةٌ ولا يُستدَلّ بأثرٍ قائم ───────────

   كان في القاعدة ما يصلح دليلا بلا سطرٍ جديد: `syncStatusesByDate` تكتب
   صفَّ أثرٍ (`cohort.status.sync`) كلَّ ربعِ ساعةٍ ولو لم تتغيّر شعبةٌ
   واحدة. لكنّها **لا تُميّز العاملَ من غيره**: `account-reset.service.ts`
   يستدعيها بالفاعلِ نفسِه (`null`) عند إعادةِ ضبط الحسابات — فصفٌّ منها
   يُقرأ نبضةً، و`‎/api/version` يقول «العاملُ يعمل» وهو ساقط.

   **وإنذارٌ كاذبٌ بالسلامةِ أسوأُ من لا شيء**: من لا نقطةَ عنده يفتح صدفةً،
   ومن عنده نقطةٌ تكذب يطمئنّ ولا يفتح. فالنبضةُ تكتبها حلقةُ العامل وحدَها
   ولا يكتبها سواها.

   ─────────── وأين تُخزَّن — ولا جدولَ جديدا ───────────

   في `SystemSetting`: مفتاحٌ وقيمةٌ JSON، وهو الموضعُ نفسُه الذي يسكنه
   إثباتُ الاسترجاع (`backup-attestation.ts`). والنبضةُ **حالةٌ راهنةٌ لا
   تاريخ** — صفٌّ واحدٌ يُكتب فوقه، فلا ينمو شيءٌ ولا يُقلَّم.

   ولا تُكتب في سجلّ الأثر: ذاك معجمُ **أفعالِ فاعلين** يقرؤه بشرٌ، وصفٌّ
   كلَّ دقيقةٍ يُغرقه — ألفٌ وأربعُمئةِ صفٍّ في اليوم تدفن ما يُقرأ لأجله.

   ─────────── وحدُّ ما تقوله ───────────

   تقول «نبضَت قبل كذا» لا «الوظائفُ تعمل». وظيفةٌ تسقط في كلّ دورةٍ تُبقي
   النبضَ حيّا — وذاك بابُ `‎/api/admin/system-health` وسجلِّ الحاوية، لا
   بابُ هذه. والخلطُ بينهما يجعل النبضةَ تَعِدُ بما لا تراه. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { buildStamp } from '../build-stamp'

/** مفتاحُ الصفّ في `SystemSetting` — صفٌّ واحدٌ يُكتب فوقه لا سجلٌّ يُضاف إليه */
export const BEAT_KEY = 'worker.lastBeat'

/** كم دورةً تُغتفر قبل الحكم بالتوقّف؟ ثلاثٌ — دورةٌ متعثّرةٌ لا تُعلَن موتا */
export const GRACE_TICKS = 3

/* نبضُ الحلقة حين **لا نبضةَ قطّ** فلا `tickMs` يُقرأ. وهو الموضعُ الوحيدُ
   الذي يُكتب فيه رقمُ الدورة هنا: النبضةُ الموجودةُ تحمل دورتَها معها، فيقيس
   القارئُ بما يعمل به العاملُ فعلا لا بما ظُنّ أنّه يعمل به. */
const ASSUMED_TICK_MS = 60_000

export interface WorkerBeat {
  /** وقتُ آخرِ دورةٍ **اكتملت** — لا وقتُ بدئها */
  at: string
  /** إقلاعُ العمليّة الحاليّة — يفضح عاملا يسقط ويُعاد تشغيلُه في حلقة */
  startedAt: string
  /** نبضُ الحلقة كما تعمل به هذه النسخةُ فعلا */
  tickMs: number
  jobs: number
  /** الالتزامُ الذي بُني منه العامل — الصورةُ مشتركةٌ مع الخادم فقد يفترقان */
  commit: string | null
}

/** تكتبها حلقةُ العامل بعد كلّ دورةٍ تكتمل. وإخفاقُها لا يُسقط العامل. */
export async function recordBeat(
  prisma: PrismaClient,
  beat: { startedAt: Date; tickMs: number; jobs: number; now?: Date },
): Promise<void> {
  const value: WorkerBeat = {
    at: (beat.now ?? new Date()).toISOString(),
    startedAt: beat.startedAt.toISOString(),
    tickMs: beat.tickMs,
    jobs: beat.jobs,
    commit: buildStamp().commit,
  }
  /* `WorkerBeat` واجهةٌ مسمّاةٌ بلا توقيعِ فهرسة، وحقلُ Json يشترطه.
     والتحويلُ هنا لا يفقد شيئا: الحقولُ كلُّها بدائيّةٌ تُسلسَل كما هي. */
  const json = value as unknown as Prisma.InputJsonObject
  await prisma.systemSetting.upsert({
    where: { key: BEAT_KEY },
    create: { key: BEAT_KEY, value: json },
    update: { value: json },
  })
}

/** آخرُ نبضةٍ — و`null` إن لم يَنبض قطّ أو كان الصفُّ تالفا.

    وصفٌّ موجودٌ بقيمةٍ بلا تاريخٍ صالحٍ ليس نبضةً: يُعامَل كغيابه ولا يُرمى
    خطأ — عطبُ صفٍّ في جدولٍ جانبيٍّ لا يُسقط `‎/api/version`. */
export async function lastBeat(prisma: PrismaClient): Promise<WorkerBeat | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key: BEAT_KEY } })
  if (!row) return null
  const v = row.value as Partial<WorkerBeat> | null
  if (!v || typeof v.at !== 'string' || Number.isNaN(Date.parse(v.at))) return null
  const tickMs = typeof v.tickMs === 'number' && v.tickMs > 0 ? v.tickMs : ASSUMED_TICK_MS
  return {
    at: v.at,
    startedAt: typeof v.startedAt === 'string' ? v.startedAt : v.at,
    tickMs,
    jobs: typeof v.jobs === 'number' ? v.jobs : 0,
    commit: typeof v.commit === 'string' ? v.commit : null,
  }
}

/** كتلةُ «العامل_الخلفي» كما تُعرَض في `‎/api/version` */
export interface BeatReport {
  آخر_نبضة: string | null
  منذ_ثانية: number | null
  نبض_الحلقة_ثانية: number | null
  أقلع_في: string | null
  وظائف: number | null
  الالتزام: string | null
  يعمل: string
  مع_الكود: string
}

/* ═══ الحكمُ — ودقّتُه في التمييز بين «لا» و«لا يمكن الحكم» ═══

   لا نبضةَ في القاعدة يحتمل أمرَين: عاملٌ ساقط، أو نشرةٌ أُقلعت قبل ثوانٍ
   ولم تحلّ أوّلُ دورةٍ بعد. والجزمُ في الثانية إنذارٌ كاذبٌ بعد كلّ نشرة —
   وهو بعينه ما يجعل النقطةَ تُهمَل.

   والفاصلُ **عمرُ عمليّةِ الخادم نفسِها**: الحاويتان تُقلعان معا
   (`docker compose up -d`)، فخادمٌ قائمٌ منذ ما يفوق مهلةَ السماحِ ولا نبضةَ
   عنده جوابُه «لا» بلا تردّد. وخادمٌ أقلع للتوّ لا يعرف بعد، فيقول إنّه لا
   يعرف ويقول متى يُسأل ثانيةً. */
export function judgeBeat(
  beat: WorkerBeat | null,
  ctx: { appCommit: string | null; uptimeSec: number; now?: Date },
): BeatReport {
  const now = ctx.now ?? new Date()
  const appSha7 = ctx.appCommit ? ctx.appCommit.slice(0, 7) : null

  if (!beat) {
    const graceSec = Math.round((ASSUMED_TICK_MS * GRACE_TICKS) / 1000)
    const settling = ctx.uptimeSec < graceSec
    return {
      آخر_نبضة: null, منذ_ثانية: null, نبض_الحلقة_ثانية: null,
      أقلع_في: null, وظائف: null, الالتزام: null,
      يعمل: settling
        ? `لا يمكن الحكم — الخادمُ أقلع قبل ${Math.round(ctx.uptimeSec)} ثانية، ولم تحلّ أوّلُ نبضةٍ بعد. اسأل بعد ${graceSec} ثانيةً من الإقلاع.`
        : `لا — لا نبضةَ في القاعدة والخادمُ قائمٌ منذ ${Math.round(ctx.uptimeSec / 60)} دقيقة. راجع: docker compose -f deploy/compose.prod.yml logs worker`,
      مع_الكود: 'لا يمكن الحكم — لا نبضة',
    }
  }

  const ageMs = now.getTime() - Date.parse(beat.at)
  const ageSec = Math.round(ageMs / 1000)
  /* المهلةُ من دورةِ العامل نفسِه لا من رقمٍ هنا: من غيّر `everyMs` غيّر
     المهلةَ معه بلا أن يمسّ هذا الملفّ — ورقمان يُضبطان في موضعَين يفترقان. */
  const graceMs = beat.tickMs * GRACE_TICKS
  const alive = ageMs <= graceMs

  return {
    آخر_نبضة: beat.at,
    منذ_ثانية: ageSec,
    نبض_الحلقة_ثانية: Math.round(beat.tickMs / 1000),
    أقلع_في: beat.startedAt,
    وظائف: beat.jobs,
    الالتزام: beat.commit ? beat.commit.slice(0, 7) : null,
    يعمل: alive
      ? `نعم — نبضَ قبل ${ageSec} ثانية (نبضُ الحلقة ${Math.round(beat.tickMs / 1000)} ثانية)`
      : `لا — آخرُ نبضةٍ قبل ${ageSec} ثانية، والمهلةُ ${Math.round(graceMs / 1000)}. راجع: docker compose -f deploy/compose.prod.yml logs worker`,
    /* الصورةُ واحدةٌ (`wajeez-app:latest`) والحاويتان تُبدَّلان معا — فافتراقُهما
       يعني عاملا لم يُستبدَل في النشرة الأخيرة، وهو يشغّل شيفرةً غيرَ التي
       تُخدَم. ولا يُجزَم بذلك حين يُجهل أحدُ الطرفَين. */
    مع_الكود:
      appSha7 && beat.commit
        ? appSha7 === beat.commit.slice(0, 7)
          ? 'نعم — العاملُ والخادمُ من التزامٍ واحد'
          : `لا — الخادمُ على ${appSha7} والعاملُ على ${beat.commit.slice(0, 7)}؛ لم يُستبدَل في النشرة الأخيرة`
        : 'لا يمكن الحكم — أحدُ البناءَين بلا ختمِ التزام',
  }
}

/** حكمٌ بلا نبضةٍ ولا قراءة — لا «نعم» ولا «لا»، بل تسميةُ سببِ العمى */
function blind(reason: string): BeatReport {
  return {
    آخر_نبضة: null, منذ_ثانية: null, نبض_الحلقة_ثانية: null,
    أقلع_في: null, وظائف: null, الالتزام: null,
    يعمل: `لا يمكن الحكم — ${reason}`,
    مع_الكود: 'لا يمكن الحكم — لا نبضة',
  }
}

/** القراءةُ والحكمُ معا — ما يستدعيه `‎/api/version`.

    ⚠️ **ولا يُرمى من هنا خطأٌ أبدا.** `‎/api/version` هو فحصُ صحّةِ حاويةِ
    الخادم في `Dockerfile` — فخطأٌ يخرج من هذه الدالّة يجعل Docker يحكم على
    حاويةٍ سليمةٍ بالسقوط **ويعيد تشغيلَ الموقع** لأنّ صفًّا في جدولٍ جانبيٍّ
    لم يُقرأ. فعطبُ القراءة يُقال ولا يُرفع: «لا يمكن الحكم» بسببها. */
export async function beatReport(
  prisma: PrismaClient,
  ctx: { appCommit: string | null; uptimeSec?: number; now?: Date },
): Promise<BeatReport> {
  let beat: WorkerBeat | null
  try {
    beat = await lastBeat(prisma)
  } catch (e) {
    return blind(`تعذّرت قراءةُ النبضة: ${e instanceof Error ? e.message : 'سببٌ غير معروف'}`)
  }
  return judgeBeat(beat, {
    appCommit: ctx.appCommit,
    uptimeSec: ctx.uptimeSec ?? process.uptime(),
    now: ctx.now,
  })
}
